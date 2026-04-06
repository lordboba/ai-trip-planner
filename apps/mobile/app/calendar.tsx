import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, router } from "expo-router";
import * as AuthSession from "expo-auth-session";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { createMobileApiClient, assertApiBaseUrl } from "@/src/lib/api";
import { useTripPlannerState } from "@/src/state/trip-planner-state";

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

export default function CalendarScreen() {
  const {
    hasAccess,
    sessionToken,
    importedCalendar,
    setImportedCalendar,
    draft,
    setDraft,
    storeGoogleTokens,
  } = useTripPlannerState();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"ics" | "google" | null>(null);

  const clientId = useMemo(() => {
    if (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID && process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) {
      return Platform.select({
        ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
        default: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      });
    }

    return null;
  }, []);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "aitripplanner" });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? "missing-google-client-id",
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ],
      usePKCE: true,
      extraParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
    GOOGLE_DISCOVERY,
  );

  useEffect(() => {
    async function finishGoogleAuth() {
      if (!response || response.type !== "success" || !request?.codeVerifier || !clientId) {
        return;
      }

      try {
        assertApiBaseUrl();
        setBusy("google");
        setError(null);

        const tokenResponse = await fetch(GOOGLE_DISCOVERY.tokenEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            code: response.params.code,
            code_verifier: request.codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }).toString(),
        });
        const tokenPayload = await tokenResponse.json();

        if (!tokenResponse.ok || !tokenPayload.access_token) {
          throw new Error("Google token exchange failed.");
        }

        await storeGoogleTokens({
          accessToken: tokenPayload.access_token,
          refreshToken: tokenPayload.refresh_token,
          expiresIn: tokenPayload.expires_in,
        });

        const api = createMobileApiClient(sessionToken);
        const imported = await api.importGoogleCalendar({
          startDate: draft.startDate,
          endDate: draft.endDate,
          googleAccessToken: tokenPayload.access_token,
        });

        setImportedCalendar(imported);
      } catch (googleError) {
        setError(googleError instanceof Error ? googleError.message : "Google Calendar import failed.");
      } finally {
        setBusy(null);
      }
    }

    void finishGoogleAuth();
  }, [clientId, draft.endDate, draft.startDate, redirectUri, request?.codeVerifier, response, sessionToken, setImportedCalendar, storeGoogleTokens]);

  if (!hasAccess) {
    return <Redirect href="/" />;
  }

  async function handlePickIcs() {
    try {
      assertApiBaseUrl();
      setBusy("ics");
      setError(null);
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const file = new File(asset.uri);
      const text = await file.text();
      const api = createMobileApiClient(sessionToken);
      const imported = await api.importIcsCalendar({
        icsText: text,
        startDate: draft.startDate,
        endDate: draft.endDate,
      });

      setImportedCalendar(imported);
    } catch (icsError) {
      setError(icsError instanceof Error ? icsError.message : "ICS import failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogleConnect() {
    if (!clientId) {
      setError("Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID first.");
      return;
    }

    setError(null);
    await promptAsync();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.title}>Import your calendar</Text>
          <Text style={styles.copy}>
            Choose the travel window first, then import either an `.ics` file or Google Calendar events.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Trip start date</Text>
          <TextInput
            value={draft.startDate}
            onChangeText={(value) => setDraft((current) => ({ ...current, startDate: value }))}
            style={styles.input}
            placeholder="YYYY-MM-DD"
          />
          <Text style={styles.fieldLabel}>Trip end date</Text>
          <TextInput
            value={draft.endDate}
            onChangeText={(value) => setDraft((current) => ({ ...current, endDate: value }))}
            style={styles.input}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.card}>
          <Pressable onPress={handlePickIcs} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {busy === "ics" ? "Importing..." : "Pick an .ics file"}
            </Text>
          </Pressable>
          <Pressable onPress={handleGoogleConnect} style={styles.secondaryButton} disabled={!request}>
            <Text style={styles.secondaryButtonText}>
              {busy === "google" ? "Connecting..." : "Connect Google Calendar"}
            </Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Current import</Text>
          {importedCalendar ? (
            <>
              <Text style={styles.summary}>
                {importedCalendar.events.length} events · {importedCalendar.cityInference.city ?? "Unknown city"}
              </Text>
              <Text style={styles.copySmall}>
                Source: {importedCalendar.source.toUpperCase()} · Imported {new Date(importedCalendar.importedAt).toLocaleString()}
              </Text>
            </>
          ) : (
            <Text style={styles.copySmall}>No calendar imported yet.</Text>
          )}
        </View>

        <Pressable
          onPress={() => router.push("/preferences")}
          disabled={!importedCalendar || busy !== null}
          style={[styles.primaryButton, !importedCalendar || busy ? styles.disabledButton : null]}
        >
          <Text style={styles.primaryButtonText}>Continue to planner</Text>
        </Pressable>
      </ScrollView>
      {busy ? <ActivityIndicator style={styles.spinner} color="#FF6B42" /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FEFCFB",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1614",
  },
  copy: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5E5550",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3D3632",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E8E3DF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F5F1EE",
  },
  primaryButton: {
    backgroundColor: "#FF6B42",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#E8E3DF",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#F5F1EE",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButtonText: {
    color: "#1A1614",
    fontWeight: "700",
    fontSize: 16,
  },
  summary: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1614",
  },
  copySmall: {
    color: "#5E5550",
    lineHeight: 20,
  },
  error: {
    color: "#B42318",
  },
  disabledButton: {
    opacity: 0.5,
  },
  spinner: {
    paddingBottom: 20,
  },
});

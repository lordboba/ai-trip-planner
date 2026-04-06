import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { assertApiBaseUrl } from "@/src/lib/api";
import { useTripPlannerState } from "@/src/state/trip-planner-state";

export default function UnlockScreen() {
  const { ready, hasAccess, unlock } = useTripPlannerState();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!ready) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B42" />
      </SafeAreaView>
    );
  }

  if (hasAccess) {
    return <Redirect href="/calendar" />;
  }

  async function handleUnlock() {
    try {
      assertApiBaseUrl();
      setSubmitting(true);
      setError(null);
      await unlock(code);
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Unable to unlock the app.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Work trips, unlocked</Text>
        <Text style={styles.title}>Hidden gems between your meetings.</Text>
        <Text style={styles.copy}>
          Use the same shared access gate as the web app, then import your calendar and generate a trip plan.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Access code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          secureTextEntry
          placeholder="Enter the shared access code"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={handleUnlock} disabled={submitting} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{submitting ? "Unlocking..." : "Enter app"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FEFCFB",
    padding: 24,
    justifyContent: "center",
    gap: 24,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEFCFB",
  },
  hero: {
    gap: 12,
  },
  eyebrow: {
    color: "#E8543A",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1A1614",
  },
  copy: {
    fontSize: 16,
    lineHeight: 24,
    color: "#5E5550",
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 20,
    gap: 12,
    shadowColor: "#1A1614",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3D3632",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E8E3DF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1A1614",
    backgroundColor: "#F5F1EE",
  },
  error: {
    color: "#B42318",
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: "#FF6B42",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});

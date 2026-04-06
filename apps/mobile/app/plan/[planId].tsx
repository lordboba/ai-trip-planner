import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { ClientSchedulePlan } from "@ai-trip-planner/core";
import { createMobileApiClient, assertApiBaseUrl } from "@/src/lib/api";
import { useTripPlannerState } from "@/src/state/trip-planner-state";

function formatRange(startsAt: string, endsAt: string) {
  return `${new Date(startsAt).toLocaleString()} - ${new Date(endsAt).toLocaleTimeString()}`;
}

export default function PlanDetailsScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { sessionToken, googleAccessToken } = useTripPlannerState();
  const [plan, setPlan] = useState<ClientSchedulePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        assertApiBaseUrl();
        setLoading(true);
        setError(null);
        const api = createMobileApiClient(sessionToken);
        const fetchedPlan = await api.fetchSchedulePlan(planId);
        setPlan(fetchedPlan);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load the plan.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [planId, sessionToken]);

  async function handleAddSuggestion(suggestionId: string) {
    try {
      assertApiBaseUrl();
      setPendingSuggestionId(suggestionId);
      const api = createMobileApiClient(sessionToken);
      const updatedPlan = await api.addSuggestionToSchedulePlan(planId, suggestionId, {
        googleAccessToken,
      });
      setPlan(updatedPlan);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Unable to add suggestion.");
    } finally {
      setPendingSuggestionId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B42" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {plan ? (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>{plan.tripContext.cityInference.city ?? "Imported trip"}</Text>
              <Text style={styles.copy}>
                {plan.tripContext.travelDayCount} days · {plan.suggestions.length} suggestions
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Suggestions</Text>
              {plan.suggestions.map((suggestion) => (
                <View key={suggestion.id} style={styles.listItem}>
                  <Text style={styles.itemTitle}>{suggestion.place.name}</Text>
                  <Text style={styles.itemSubtitle}>{formatRange(suggestion.startsAt, suggestion.endsAt)}</Text>
                  <Text style={styles.copy}>{suggestion.message}</Text>
                  <Pressable
                    onPress={() => handleAddSuggestion(suggestion.id)}
                    disabled={pendingSuggestionId === suggestion.id || suggestion.status === "added"}
                    style={[styles.primaryButton, suggestion.status === "added" ? styles.disabledButton : null]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {suggestion.status === "added"
                        ? "Added to calendar"
                        : pendingSuggestionId === suggestion.id
                          ? "Adding..."
                          : suggestion.actionLabel}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              {plan.timeline.map((event) => (
                <View key={event.id} style={styles.timelineItem}>
                  <Text style={styles.itemTitle}>{event.title}</Text>
                  <Text style={styles.itemSubtitle}>{formatRange(event.startsAt, event.endsAt)}</Text>
                  {event.location ? <Text style={styles.copy}>{event.location}</Text> : null}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FEFCFB",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEFCFB",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  errorCard: {
    backgroundColor: "#FEF3F2",
    borderRadius: 16,
    padding: 16,
  },
  errorText: {
    color: "#B42318",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1614",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1614",
  },
  copy: {
    color: "#5E5550",
    lineHeight: 20,
  },
  listItem: {
    borderTopWidth: 1,
    borderTopColor: "#F5F1EE",
    paddingTop: 12,
    gap: 8,
  },
  timelineItem: {
    borderTopWidth: 1,
    borderTopColor: "#F5F1EE",
    paddingTop: 12,
    gap: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1614",
  },
  itemSubtitle: {
    color: "#8A7F79",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B42",
    borderRadius: 14,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
});

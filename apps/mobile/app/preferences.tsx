import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, router } from "expo-router";
import { type BudgetBand, type LLMProvider, type Pace, type ScheduleTransportMode } from "@ai-trip-planner/domain";
import { assertApiBaseUrl, createMobileApiClient } from "@/src/lib/api";
import { useTripPlannerState } from "@/src/state/trip-planner-state";

const interestOptions = ["food", "nightlife", "nature", "culture", "shopping", "wellness", "adventure", "hidden gems"];
const providerOptions: LLMProvider[] = ["openai", "claude"];
const budgetOptions: BudgetBand[] = ["lean", "comfort", "luxury"];
const paceOptions: Pace[] = ["relaxed", "balanced", "packed"];
const transportOptions: ScheduleTransportMode[] = ["walk", "transit", "rideshare", "rental-car", "mixed"];

function ToggleRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.optionChip, value === option ? styles.optionChipActive : null]}
          >
            <Text style={[styles.optionChipText, value === option ? styles.optionChipTextActive : null]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function PreferencesScreen() {
  const { hasAccess, sessionToken, importedCalendar, draft, setDraft } = useTripPlannerState();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!hasAccess) {
    return <Redirect href="/" />;
  }

  if (!importedCalendar) {
    return <Redirect href="/calendar" />;
  }

  const activeCalendar = importedCalendar;

  async function handleGeneratePlan() {
    try {
      assertApiBaseUrl();
      setSubmitting(true);
      setError(null);
      const api = createMobileApiClient(sessionToken);
      const created = await api.createSchedulePlan({
        importedSchedule: activeCalendar,
        preferences: {
          provider: draft.provider,
          budgetBand: draft.budgetBand,
          interests: draft.interests,
          pace: draft.pace,
          transport: draft.transport,
          earliestTime: draft.earliestTime,
          latestTime: draft.latestTime,
          comments: draft.comments,
        },
        startDate: draft.startDate,
        endDate: draft.endDate,
      });

      router.push(`/plan/${created.planId}`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Plan generation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Planner preferences</Text>
          <Text style={styles.copy}>
            Imported {activeCalendar.events.length} events for {activeCalendar.cityInference.city ?? "your destination"}.
          </Text>
        </View>

        <View style={styles.card}>
          <ToggleRow
            label="Provider"
            options={providerOptions}
            value={draft.provider}
            onChange={(provider) => setDraft((current) => ({ ...current, provider }))}
          />
          <ToggleRow
            label="Budget"
            options={budgetOptions}
            value={draft.budgetBand}
            onChange={(budgetBand) => setDraft((current) => ({ ...current, budgetBand }))}
          />
          <ToggleRow
            label="Pace"
            options={paceOptions}
            value={draft.pace}
            onChange={(pace) => setDraft((current) => ({ ...current, pace }))}
          />
          <ToggleRow
            label="Transport"
            options={transportOptions}
            value={draft.transport}
            onChange={(transport) => setDraft((current) => ({ ...current, transport }))}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Interests</Text>
          <View style={styles.optionRow}>
            {interestOptions.map((interest) => {
              const active = draft.interests.includes(interest);

              return (
                <Pressable
                  key={interest}
                  onPress={() => setDraft((current) => ({
                    ...current,
                    interests: active
                      ? current.interests.filter((entry) => entry !== interest)
                      : [...current.interests, interest],
                  }))}
                  style={[styles.optionChip, active ? styles.optionChipActive : null]}
                >
                  <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>
                    {interest}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Planning window</Text>
          <TextInput
            value={draft.earliestTime}
            onChangeText={(earliestTime) => setDraft((current) => ({ ...current, earliestTime }))}
            style={styles.input}
            placeholder="08:00"
          />
          <TextInput
            value={draft.latestTime}
            onChangeText={(latestTime) => setDraft((current) => ({ ...current, latestTime }))}
            style={styles.input}
            placeholder="21:00"
          />
          <Text style={styles.fieldLabel}>Comments</Text>
          <TextInput
            value={draft.comments}
            onChangeText={(comments) => setDraft((current) => ({ ...current, comments }))}
            style={[styles.input, styles.commentsInput]}
            multiline
            placeholder="Any dining, vibe, or scheduling notes"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={handleGeneratePlan} disabled={submitting} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{submitting ? "Generating..." : "Generate plan"}</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1614",
  },
  copy: {
    color: "#5E5550",
    lineHeight: 22,
  },
  fieldBlock: {
    gap: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3D3632",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E8E3DF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F5F1EE",
  },
  optionChipActive: {
    backgroundColor: "#FF6B42",
    borderColor: "#FF6B42",
  },
  optionChipText: {
    color: "#1A1614",
    fontWeight: "600",
  },
  optionChipTextActive: {
    color: "#FFFFFF",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E8E3DF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F5F1EE",
  },
  commentsInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#FF6B42",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  error: {
    color: "#B42318",
  },
});

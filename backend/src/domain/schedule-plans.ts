import { z } from "zod";
import {
  budgetBandSchema,
  generationMetadataSchema,
  llmProviderSchema,
  paceSchema,
  placeCandidateSchema,
} from "./planning.ts";
import {
  DEFAULT_PLANNING_EARLIEST_TIME,
  DEFAULT_PLANNING_LATEST_TIME,
  isPlanningWindowValid,
  TIME_STRING_PATTERN,
} from "../../../lib/timezone.ts";

export const calendarImportSourceSchema = z.enum(["ics", "google"]);

export const normalizedCalendarEventTypeSchema = z.enum([
  "flight",
  "hotel",
  "meeting",
  "meal",
  "focus",
  "commute",
  "hold",
  "other",
]);

export const scheduleTransportModeSchema = z.enum([
  "walk",
  "transit",
  "rideshare",
  "rental-car",
  "mixed",
]);

export const scheduleGapKindSchema = z.enum(["quick-stop", "meal-window"]);
export const scheduleSuggestionStatusSchema = z.enum(["pending", "added"]);
export const scheduleWorkflowStatusSchema = z.enum(["completed"]);
export const scheduleWorkflowStepSchema = z.enum(["dining", "itinerary", "budget"]);
export const scheduleTimeStringSchema = z.string().regex(TIME_STRING_PATTERN, "Expected HH:MM");

export const cityInferenceSchema = z.object({
  city: z.string().nullable(),
  region: z.string().nullable().default(null),
  country: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1),
  matchedFrom: z.array(z.string()).default([]),
});

export const normalizedCalendarEventSchema = z.object({
  id: z.string(),
  source: calendarImportSourceSchema,
  sourceEventId: z.string().optional(),
  title: z.string(),
  description: z.string().default(""),
  location: z.string().nullable().default(null),
  startsAt: z.string(),
  endsAt: z.string(),
  isAllDay: z.boolean().default(false),
  timezone: z.string().nullable().default(null),
  type: normalizedCalendarEventTypeSchema,
  inferredCity: z.string().nullable().default(null),
  locked: z.boolean().default(true),
});

export const importedCalendarSchema = z.object({
  source: calendarImportSourceSchema,
  importedAt: z.string(),
  timezone: z.string().nullable().default(null),
  cityInference: cityInferenceSchema,
  warnings: z.array(z.string()).default([]),
  events: z.array(normalizedCalendarEventSchema).default([]),
});

export const schedulePlanPreferencesSchema = z.object({
  provider: llmProviderSchema,
  budgetBand: budgetBandSchema,
  interests: z.array(z.string()).default([]),
  pace: paceSchema,
  transport: scheduleTransportModeSchema,
  earliestTime: scheduleTimeStringSchema.default(DEFAULT_PLANNING_EARLIEST_TIME),
  latestTime: scheduleTimeStringSchema.default(DEFAULT_PLANNING_LATEST_TIME),
  comments: z.string().default(""),
}).refine(
  (value) => isPlanningWindowValid(value.earliestTime, value.latestTime),
  {
    message: "Latest planning time must be after earliest planning time.",
    path: ["latestTime"],
  },
);

export const scheduleTripContextSchema = z.object({
  cityInference: cityInferenceSchema,
  timezone: z.string().nullable().default(null),
  tripStart: z.string().nullable(),
  tripEnd: z.string().nullable(),
  totalEvents: z.number().int().nonnegative(),
  travelDayCount: z.number().int().nonnegative(),
});

export const scheduleSlotSchema = z.object({
  id: z.string(),
  kind: scheduleGapKindSchema,
  label: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  durationMinutes: z.number().int().positive(),
  city: z.string().nullable().default(null),
  previousEventId: z.string().nullable().default(null),
  nextEventId: z.string().nullable().default(null),
});

export const scheduleSuggestionSchema = z.object({
  id: z.string(),
  slotId: z.string(),
  status: scheduleSuggestionStatusSchema,
  title: z.string(),
  subtitle: z.string(),
  message: z.string(),
  category: z.string(),
  place: placeCandidateSchema,
  agentReason: z.string(),
  budgetReason: z.string(),
  estimatedCost: z.string(),
  estimatedDurationMinutes: z.number().int().positive(),
  startsAt: z.string(),
  endsAt: z.string(),
  transitNote: z.string(),
  actionLabel: z.string(),
  addedEventId: z.string().nullable().default(null),
});

export const scheduleWorkflowStepResultSchema = z.object({
  step: scheduleWorkflowStepSchema,
  status: scheduleWorkflowStatusSchema,
  summary: z.string(),
  execution: generationMetadataSchema,
});

export const schedulePlanWorkflowSchema = z.object({
  status: scheduleWorkflowStatusSchema,
  startedAt: z.string(),
  completedAt: z.string(),
  steps: z.array(scheduleWorkflowStepResultSchema),
});

export const schedulePlanRequestSchema = z.object({
  importedSchedule: importedCalendarSchema,
  preferences: schedulePlanPreferencesSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
});

export const schedulePlanSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  request: schedulePlanRequestSchema,
  tripContext: scheduleTripContextSchema,
  generation: generationMetadataSchema,
  workflow: schedulePlanWorkflowSchema,
  slots: z.array(scheduleSlotSchema),
  suggestions: z.array(scheduleSuggestionSchema),
  timeline: z.array(normalizedCalendarEventSchema),
});

export type CalendarImportSource = z.infer<typeof calendarImportSourceSchema>;
export type NormalizedCalendarEventType = z.infer<typeof normalizedCalendarEventTypeSchema>;
export type ScheduleTransportMode = z.infer<typeof scheduleTransportModeSchema>;
export type ScheduleGapKind = z.infer<typeof scheduleGapKindSchema>;
export type ScheduleSuggestionStatus = z.infer<typeof scheduleSuggestionStatusSchema>;
export type ScheduleWorkflowStatus = z.infer<typeof scheduleWorkflowStatusSchema>;
export type ScheduleWorkflowStep = z.infer<typeof scheduleWorkflowStepSchema>;
export type CityInference = z.infer<typeof cityInferenceSchema>;
export type NormalizedCalendarEvent = z.infer<typeof normalizedCalendarEventSchema>;
export type ImportedCalendar = z.infer<typeof importedCalendarSchema>;
export type SchedulePlanPreferences = z.infer<typeof schedulePlanPreferencesSchema>;
export type ScheduleTripContext = z.infer<typeof scheduleTripContextSchema>;
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
export type ScheduleSuggestion = z.infer<typeof scheduleSuggestionSchema>;
export type ScheduleWorkflowStepResult = z.infer<typeof scheduleWorkflowStepResultSchema>;
export type SchedulePlanWorkflow = z.infer<typeof schedulePlanWorkflowSchema>;
export type SchedulePlanRequest = z.infer<typeof schedulePlanRequestSchema>;
export type SchedulePlan = z.infer<typeof schedulePlanSchema>;

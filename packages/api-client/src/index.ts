import { z } from "zod";
import {
  type ClientSchedulePlan,
} from "@ai-trip-planner/core";
import {
  importedCalendarSchema,
  schedulePlanRequestSchema,
  type ImportedCalendar,
  type SchedulePlanRequest,
} from "@ai-trip-planner/domain";

const unlockResponseSchema = z.object({
  ok: z.boolean(),
  enabled: z.boolean(),
  sessionToken: z.string().optional(),
  expiresAt: z.string().optional(),
});

const createPlanResponseSchema = z.object({
  planId: z.string().uuid(),
});

const connectGoogleResponseSchema = z.object({
  ok: z.boolean(),
  provider: z.literal("google-calendar"),
  status: z.literal("ready"),
  message: z.string(),
  authorizeUrl: z.string().url().optional(),
});

const clientSchedulePlanSchema: z.ZodType<ClientSchedulePlan> = z.any();

type ClientOptions = {
  baseUrl?: string;
  getSessionToken?: () => string | null | undefined;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  formData?: FormData;
  token?: string | null;
};

export class TripPlannerApiClient {
  constructor(private readonly options: ClientOptions = {}) {}

  private buildUrl(path: string) {
    const baseUrl = this.options.baseUrl?.replace(/\/$/, "");

    if (!baseUrl) {
      return path;
    }

    return `${baseUrl}${path}`;
  }

  private async request<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers();
    const token = options.token ?? this.options.getSessionToken?.() ?? null;

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let body: BodyInit | undefined;

    if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    const response = await fetch(this.buildUrl(path), {
      method: options.method ?? "GET",
      headers,
      body,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed with status ${response.status}.`;
      throw new Error(message);
    }

    return schema.parse(payload);
  }

  unlock(code: string, input?: { issueSessionToken?: boolean }) {
    return this.request("/api/access/verify", unlockResponseSchema, {
      method: "POST",
      body: {
        code,
        issueSessionToken: input?.issueSessionToken ?? false,
      },
    });
  }

  connectGoogleCalendar(input?: { startDate?: string | null; endDate?: string | null }) {
    return this.request("/api/calendar/google/connect", connectGoogleResponseSchema, {
      method: "POST",
      body: input ?? {},
    });
  }

  importIcsCalendar(input: {
    icsText?: string;
    file?: File;
    startDate?: string | null;
    endDate?: string | null;
    token?: string | null;
  }) {
    const formData = new FormData();

    if (input.file) {
      formData.append("file", input.file);
    }

    if (input.icsText) {
      formData.append("ics", input.icsText);
    }

    if (input.startDate) {
      formData.append("startDate", input.startDate);
    }

    if (input.endDate) {
      formData.append("endDate", input.endDate);
    }

    return this.request("/api/calendar/import", importedCalendarSchema, {
      method: "POST",
      formData,
      token: input.token,
    });
  }

  importGoogleCalendar(input: {
    startDate?: string | null;
    endDate?: string | null;
    googleAccessToken?: string | null;
    token?: string | null;
  }) {
    return this.request("/api/calendar/import", importedCalendarSchema, {
      method: "POST",
      body: {
        source: "google",
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        googleAccessToken: input.googleAccessToken ?? null,
      },
      token: input.token,
    });
  }

  createSchedulePlan(input: SchedulePlanRequest, token?: string | null) {
    const parsed = schedulePlanRequestSchema.parse(input);

    return this.request("/api/schedule-plans", createPlanResponseSchema, {
      method: "POST",
      body: parsed,
      token,
    });
  }

  fetchSchedulePlan(planId: string, token?: string | null) {
    return this.request(`/api/schedule-plans/${planId}`, clientSchedulePlanSchema, {
      method: "GET",
      token,
    });
  }

  addSuggestionToSchedulePlan(
    planId: string,
    suggestionId: string,
    input?: { googleAccessToken?: string | null; token?: string | null },
  ) {
    return this.request(`/api/schedule-plans/${planId}/suggestions/${suggestionId}/add`, clientSchedulePlanSchema, {
      method: "POST",
      body: {
        googleAccessToken: input?.googleAccessToken ?? null,
      },
      token: input?.token,
    });
  }
}

export function createTripPlannerApiClient(options?: ClientOptions) {
  return new TripPlannerApiClient(options);
}

export type { ImportedCalendar, SchedulePlanRequest };

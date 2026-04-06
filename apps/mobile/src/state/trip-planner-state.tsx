import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import type {
  BudgetBand,
  ImportedCalendar,
  LLMProvider,
  Pace,
  ScheduleTransportMode,
} from "@ai-trip-planner/domain";
import { createMobileApiClient } from "@/src/lib/api";

const SESSION_TOKEN_KEY = "tripwise-session-token";
const SESSION_EXPIRY_KEY = "tripwise-session-expiry";
const GOOGLE_ACCESS_TOKEN_KEY = "tripwise-google-access-token";
const GOOGLE_REFRESH_TOKEN_KEY = "tripwise-google-refresh-token";
const GOOGLE_EXPIRY_KEY = "tripwise-google-expiry";

type PlannerDraft = {
  startDate: string;
  endDate: string;
  earliestTime: string;
  latestTime: string;
  provider: LLMProvider;
  budgetBand: BudgetBand;
  pace: Pace;
  interests: string[];
  transport: ScheduleTransportMode;
  comments: string;
};

type TripPlannerStateValue = {
  ready: boolean;
  hasAccess: boolean;
  sessionToken: string | null;
  sessionExpiresAt: string | null;
  googleAccessToken: string | null;
  importedCalendar: ImportedCalendar | null;
  draft: PlannerDraft;
  setDraft: (next: PlannerDraft | ((current: PlannerDraft) => PlannerDraft)) => void;
  setImportedCalendar: (calendar: ImportedCalendar | null) => void;
  storeGoogleTokens: (input: {
    accessToken: string;
    refreshToken?: string | null;
    expiresIn?: number;
  }) => Promise<void>;
  unlock: (code: string) => Promise<void>;
  clearAccess: () => Promise<void>;
};

const TripPlannerStateContext = createContext<TripPlannerStateValue | null>(null);

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

const initialDraft: PlannerDraft = {
  startDate: todayString(),
  endDate: todayString(),
  earliestTime: "08:00",
  latestTime: "21:00",
  provider: "openai",
  budgetBand: "comfort",
  pace: "balanced",
  interests: ["food", "culture", "hidden gems"],
  transport: "mixed",
  comments: "",
};

export function TripPlannerStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [importedCalendar, setImportedCalendar] = useState<ImportedCalendar | null>(null);
  const [draft, setDraft] = useState(initialDraft);

  useEffect(() => {
    async function restore() {
      const [
        storedSessionToken,
        storedSessionExpiry,
        storedGoogleAccessToken,
      ] = await Promise.all([
        SecureStore.getItemAsync(SESSION_TOKEN_KEY),
        SecureStore.getItemAsync(SESSION_EXPIRY_KEY),
        SecureStore.getItemAsync(GOOGLE_ACCESS_TOKEN_KEY),
      ]);

      if (storedSessionToken) {
        setSessionToken(storedSessionToken);
        setHasAccess(true);
      }

      if (storedSessionExpiry) {
        setSessionExpiresAt(storedSessionExpiry);
      }

      if (storedGoogleAccessToken) {
        setGoogleAccessToken(storedGoogleAccessToken);
      }

      setReady(true);
    }

    void restore();
  }, []);

  async function unlock(code: string) {
    const api = createMobileApiClient(null);
    const result = await api.unlock(code, { issueSessionToken: true });

    if (result.sessionToken) {
      await Promise.all([
        SecureStore.setItemAsync(SESSION_TOKEN_KEY, result.sessionToken),
        result.expiresAt
          ? SecureStore.setItemAsync(SESSION_EXPIRY_KEY, result.expiresAt)
          : SecureStore.deleteItemAsync(SESSION_EXPIRY_KEY),
      ]);
      setSessionToken(result.sessionToken);
      setSessionExpiresAt(result.expiresAt ?? null);
    }

    setHasAccess(true);
  }

  async function storeGoogleTokens(input: {
    accessToken: string;
    refreshToken?: string | null;
    expiresIn?: number;
  }) {
    const expiresAt = input.expiresIn
      ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
      : null;

    await Promise.all([
      SecureStore.setItemAsync(GOOGLE_ACCESS_TOKEN_KEY, input.accessToken),
      input.refreshToken
        ? SecureStore.setItemAsync(GOOGLE_REFRESH_TOKEN_KEY, input.refreshToken)
        : SecureStore.deleteItemAsync(GOOGLE_REFRESH_TOKEN_KEY),
      expiresAt
        ? SecureStore.setItemAsync(GOOGLE_EXPIRY_KEY, expiresAt)
        : SecureStore.deleteItemAsync(GOOGLE_EXPIRY_KEY),
    ]);

    setGoogleAccessToken(input.accessToken);
  }

  async function clearAccess() {
    await Promise.all([
      SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
      SecureStore.deleteItemAsync(SESSION_EXPIRY_KEY),
      SecureStore.deleteItemAsync(GOOGLE_ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(GOOGLE_REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(GOOGLE_EXPIRY_KEY),
    ]);

    setHasAccess(false);
    setSessionToken(null);
    setSessionExpiresAt(null);
    setGoogleAccessToken(null);
    setImportedCalendar(null);
    setDraft(initialDraft);
  }

  const value = useMemo<TripPlannerStateValue>(() => ({
    ready,
    hasAccess,
    sessionToken,
    sessionExpiresAt,
    googleAccessToken,
    importedCalendar,
    draft,
    setDraft: (next) => setDraft((current) => typeof next === "function" ? next(current) : next),
    setImportedCalendar,
    storeGoogleTokens,
    unlock,
    clearAccess,
  }), [draft, googleAccessToken, hasAccess, importedCalendar, ready, sessionExpiresAt, sessionToken]);

  return (
    <TripPlannerStateContext.Provider value={value}>
      {children}
    </TripPlannerStateContext.Provider>
  );
}

export function useTripPlannerState() {
  const context = useContext(TripPlannerStateContext);

  if (!context) {
    throw new Error("useTripPlannerState must be used inside TripPlannerStateProvider.");
  }

  return context;
}

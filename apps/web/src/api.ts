import type { PlanTripResponse, TripPreferences } from "@mlt/contracts";

const PLAN_POLL_MS = 3000;
const SAVED_TRIP_WAIT_MS = 10 * 60 * 1000;

/**
 * After the planning job disappeared (API restart), waits for the trip the
 * old process was writing: a saved trip created after the job started, or
 * the re-planned trip when one was being updated.
 */
async function waitForSavedTrip(startedAt: number, tripId?: number): Promise<PlanTripResponse & { trip_id: number; run_id: string }> {
  const deadline = startedAt + SAVED_TRIP_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, PLAN_POLL_MS * 2));
    let trips: any[] = [];
    try {
      trips = await http<any[]>("/api/trips");
    } catch (error) {
      if (isTerminal(error)) throw error;
      continue;
    }
    const found = trips.find((trip) => {
      if (!trip?.plan_json) return false;
      if (tripId) return trip.id === tripId && Date.parse(`${String(trip.updated_at ?? trip.created_at).replace(" ", "T")}Z`) >= startedAt - 1000;
      return Date.parse(`${String(trip.created_at).replace(" ", "T")}Z`) >= startedAt - 1000;
    });
    if (found) return { ...found.plan_json, trip_id: found.id, run_id: "" };
  }
  throw new Error("planning_interrupted");
}
const API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8787" : "https://api.monpetitvoyageur.com")).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}
const isTerminal = (error: unknown) => error instanceof ApiError && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status);
// Only the dev build carries the seed login: `import.meta.env.DEV` is a
// compile-time constant, so the production bundle keeps the empty branch and
// the real credentials never ship to the browser or pre-fill the form.
const DEV_TEST_CREDENTIALS = import.meta.env.DEV
  ? { email: "marion2malaine@gmail.com", password: "MonPetitVoyageur123!" }
  : { email: "", password: "" };

export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "canceled";

export interface AuthUser {
  id: number;
  email: string;
  preferred_language: "fr" | "en";
  subscription_status: SubscriptionStatus;
  subscription_plan: string | null;
  current_period_end: string | null;
  trial_used: boolean;
  billing_enabled: boolean;
  has_access: boolean;
  has_premium?: boolean;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      // A JSON content-type without a body makes Fastify reject the request.
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {})
    },
    credentials: "include",
    signal: init?.signal ?? AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/")) {
      window.dispatchEvent(new Event("mlt:session-expired"));
      throw new ApiError("Votre session a expiré. Reconnectez-vous ; votre formulaire est conservé.", 401);
    }
    // The API answers {"error": "..."}: surface the message, never raw JSON.
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.error === "string") message = parsed.error;
    } catch {
      // Not JSON: keep the body as is.
    }
    throw new ApiError(message || `HTTP ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}

export const api = {
  premiumState: (id: number) => http<any>(`/api/premium/trips/${id}`),
  premiumSave: (id: number, body: unknown) => http<any>(`/api/premium/trips/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  premiumRate: (from: string, to: string) => http<any>(`/api/premium/rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  premiumNearby: (lat: number, lon: number, kind: string) => http<any>("/api/premium/nearby", { method: "POST", body: JSON.stringify({ lat, lon, kind }) }),
  premiumCheckout: () => http<{url: string}>("/api/billing/checkout", { method: "POST", body: JSON.stringify({plan: "premium"}) }),
  getDevTestCredentials: () => DEV_TEST_CREDENTIALS,
  me: () => http<AuthUser>("/api/auth/me"),
  register: (payload: { email: string; password: string; preferred_language: "fr" | "en" }) =>
    http<AuthUser>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  login: (payload: { email: string; password: string }) =>
    http<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  logout: () =>
    http<{ ok: boolean }>("/api/auth/logout", {
      method: "POST"
    }),
  // Planning is a job: start it, then poll until the plan is ready.
  planTrip: async (payload: { message: string; locale: "fr" | "en"; trip_id?: number; preferences?: Partial<TripPreferences> }) => {
    const startedAt = Date.now();
    const started = await http<{ job_id: string }>("/api/trips/plan", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    while (Date.now() - startedAt < SAVED_TRIP_WAIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, PLAN_POLL_MS));
      let job: { status: string; result?: PlanTripResponse & { trip_id: number; run_id: string }; error?: string };
      try {
        job = await http(`/api/trips/plan/${started.job_id}`);
      } catch (error) {
        // A blip on one poll is not a failed plan. A vanished job means the
        // API restarted: the old process still saves the trip when it finishes,
        // so the saved trips are watched for it instead of giving up.
        if (/job_not_found/.test((error as Error).message)) return waitForSavedTrip(startedAt, payload.trip_id);
        if (isTerminal(error)) throw error;
        continue;
      }
      if (job.status === "done" && job.result) return job.result;
      if (job.status === "error") throw new Error(job.error || "planning_failed");
    }
    throw new Error("planning_timeout");
  },
  listTrips: () => http<any[]>("/api/trips"),
  editItinerary: (tripId: number, edit: unknown) => http<PlanTripResponse & { trip_id: number }>(`/api/trips/${tripId}/itinerary`, { method: "PATCH", body: JSON.stringify(edit) }),
  getGuide: (tripId: number, locale: "fr" | "en", embed: boolean) =>
    http<{ filename: string; html: string }>(
      `/api/trips/${tripId}/guide?locale=${locale}&embed=${embed ? "1" : "0"}`
    ),
  chooseStay: (tripId: number, index: number) =>
    http<{ chosen_stay_index: number }>(`/api/trips/${tripId}/stay`, {
      method: "PATCH",
      body: JSON.stringify({ index })
    }),
  emailGuide: (tripId: number, locale: "fr" | "en", to?: string) =>
    http<{ sent: boolean; to: string; filename: string }>(`/api/trips/${tripId}/guide/email`, {
      method: "POST",
      body: JSON.stringify({ locale, embed: true, ...(to ? { to } : {}) })
    }),
  // Starts Stripe Checkout for the chosen plan and returns the URL to send the
  // browser to.
  checkout: (plan: "monthly" | "annual") =>
    http<{ url: string }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan })
    }),
  billingPortal: () =>
    http<{ url: string }>("/api/billing/portal", { method: "POST" }),
  // Where the browser goes for "Sign in with Google".
  googleLoginUrl: () => `${API_BASE}/api/auth/google`
};

/**
 * Downloads the illustrated guide.
 *
 * The document is fetched with the session cookie and saved from a blob: a
 * direct link to the API origin would not carry credentials.
 */
export async function downloadGuide(tripId: number, locale: "fr" | "en"): Promise<void> {
  // Photos are embedded so the saved file still works offline, abroad.
  const { filename, html } = await api.getGuide(tripId, locale, true);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

/** Downloads the guide as a PDF produced by the API. */
export async function downloadGuidePdf(tripId: number, locale: "fr" | "en"): Promise<void> {
  const response = await fetch(`${API_BASE}/api/trips/${tripId}/guide.pdf?locale=${locale}`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = (response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]) ?? "guide.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Opens the guide in a new tab so it can be read or printed to PDF.
 *
 * Photos stay as remote URLs here: the preview loads in a moment instead of
 * shipping a document of embedded images the browser has to parse first.
 */
export async function previewGuide(tripId: number, locale: "fr" | "en"): Promise<void> {
  const { html } = await api.getGuide(tripId, locale, false);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank", "noopener");
  // The tab keeps its own reference to the blob once loaded.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

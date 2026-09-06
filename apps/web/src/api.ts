import type { PlanTripResponse, TripPreferences } from "@mlt/contracts";

const PLAN_POLL_MS = 3000;
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const DEV_TEST_CREDENTIALS = {
  email: "marion2malaine@gmail.com",
  password: "MonPetitVoyageur123!"
} as const;

export interface AuthUser {
  id: number;
  email: string;
  preferred_language: "fr" | "en";
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      // A JSON content-type without a body makes Fastify reject the request.
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {})
    },
    credentials: "include"
  });

  if (!response.ok) {
    // The API answers {"error": "..."}: surface the message, never raw JSON.
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.error === "string") message = parsed.error;
    } catch {
      // Not JSON: keep the body as is.
    }
    throw new Error(message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
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
    const started = await http<{ job_id: string }>("/api/trips/plan", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, PLAN_POLL_MS));
      let job: { status: string; result?: PlanTripResponse & { trip_id: number; run_id: string }; error?: string };
      try {
        job = await http(`/api/trips/plan/${started.job_id}`);
      } catch (error) {
        // A blip on one poll is not a failed plan; a vanished job is.
        if (/job_not_found/.test((error as Error).message)) throw new Error("planning_interrupted");
        continue;
      }
      if (job.status === "done" && job.result) return job.result;
      if (job.status === "error") throw new Error(job.error || "planning_failed");
    }
  },
  listTrips: () => http<any[]>("/api/trips"),
  getGuide: (tripId: number, locale: "fr" | "en", embed: boolean) =>
    http<{ filename: string; html: string }>(
      `/api/trips/${tripId}/guide?locale=${locale}&embed=${embed ? "1" : "0"}`
    ),
  emailGuide: (tripId: number, locale: "fr" | "en", to?: string) =>
    http<{ sent: boolean; to: string; filename: string }>(`/api/trips/${tripId}/guide/email`, {
      method: "POST",
      body: JSON.stringify({ locale, embed: true, ...(to ? { to } : {}) })
    })
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

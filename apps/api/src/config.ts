import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// Nothing else loads .env (no dotenv dependency): read it here, without
// overriding variables already set in the environment. Skipped in tests so
// they stay hermetic. The file can sit at the repo root or next to the app.
function loadDotEnv(): void {
  if (process.env.NODE_ENV === "test") return;

  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined && match[2] !== "") {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8787),
  SQLITE_PATH: z.string().default("apps/api/data/mlt.sqlite"),
  JWT_SECRET: z.string().default("dev-super-secret-change-me"),
  LLM_PROVIDER: z.enum(["deepseek", "openai", "auto"]).default("auto"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default("deepseek-v4-flash"),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com/v1"),
  // Live flight and hotel prices (Google Flights / Google Hotels via SerpApi).
  SERPAPI_API_KEY: z.string().optional(),
  // Local ceiling under the plan (free plan: 250 a month), and where the
  // answers are cached; defaults next to the SQLite database.
  SERPAPI_MONTHLY_CAP: z.coerce.number().int().positive().default(200),
  SERPAPI_CACHE_PATH: z.string().optional(),
  // Travelpayouts (Aviasales) Data API: month-wide flight prices, free with an
  // affiliate account. The marker stamps Aviasales links with the affiliation.
  TRAVELPAYOUTS_TOKEN: z.string().optional(),
  TRAVELPAYOUTS_MARKER: z.string().optional(),
  // Viator affiliate ids, stamped on every Viator link (see tools/links.ts).
  VIATOR_AFFILIATE_PID: z.string().default("P00277065"),
  VIATOR_AFFILIATE_MCID: z.string().default("42383"),
  // Viator Partner API key (affiliate access): the exact activity, with its photo.
  VIATOR_API_KEY: z.string().trim().optional().transform((v) => v || undefined),
  // How many departure dates are tried when the traveler gave a month or no
  // date at all: each is a flight search.
  SERPAPI_FLEX_DATE_SAMPLES: z.coerce.number().int().min(1).max(6).default(3),
  SHERPA_API_KEY: z.string().optional(),
  SHERPA_BASE_URL: z.string().default("https://requirements-api.sherpa.com"),
  // Trimmed, and blank counts as absent: an empty placeholder left in the
  // environment must read as "not configured" rather than send a doomed
  // request to Google.
  GOOGLE_MAPS_API_KEY: z.string().trim().optional().transform((v) => v || undefined),
  // Mapbox public token (pk.…) for the interactive map in the guide and the
  // app. Free up to 50 000 map loads a month; without it the guide falls back
  // to Leaflet + OpenStreetMap and the app shows no map.
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  // Server-side Mapbox calls (the still map picture): a URL-restricted token
  // only answers browsers, so this one must be unrestricted. Falls back to the
  // public token when it is not restricted.
  MAPBOX_SERVER_TOKEN: z.string().optional(),
  // Guide illustrations work without any key (Wikipedia, Wikimedia Commons,
  // Openverse). These only add extra sources for generic shots (food, mood).
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  PEXELS_API_KEY: z.string().optional(),
  // Sending the guide by email. Any SMTP provider works (Gmail app password,
  // Brevo, Mailgun...). Without these the endpoint reports the feature as
  // unconfigured instead of failing silently.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  // z.coerce.boolean() turns the string "false" into true, so the flag is read
  // explicitly: only "true"/"1" enable implicit TLS (port 465). Port 587 uses
  // STARTTLS and must stay false.
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((v) => v.trim().toLowerCase() === "true" || v.trim() === "1"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // Where the web app lives, used to build Stripe/Google redirect URLs. In
  // production set this to https://monpetitvoyageur.com.
  APP_URL: z.string().default("http://localhost:5173"),
  // Stripe. Without STRIPE_SECRET_KEY the billing endpoints report the feature
  // as unconfigured (like SMTP) and access is granted to everyone, so the app
  // keeps working before Stripe is set up. Set the two price ids to the
  // recurring prices created in the Stripe dashboard (price_...).
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ANNUAL: z.string().optional(),
  STRIPE_PRICE_PREMIUM: z.string().optional(),
  // Free trial length, in days, applied once per account (trial_used guards it).
  TRIAL_DAYS: z.coerce.number().int().min(0).max(90).default(7),
  // Comptes offerts : emails (séparés par des virgules) qui gardent un accès
  // illimité même quand le paiement est activé — pour l'équipe / la fondatrice.
  COMP_EMAILS: z.string().default(""),
  // Google sign-in (OAuth 2.0). Create credentials at
  // https://console.cloud.google.com → APIs & Services → Credentials.
  // The redirect URI must be <API origin>/api/auth/google/callback.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional()
});

export type AppConfig = z.infer<typeof EnvSchema>;

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  loadDotEnv();
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  // A default or weak signing secret in production means anyone can forge a
  // session token, so fail fast rather than boot insecurely.
  if (
    parsed.data.NODE_ENV === "production" &&
    (parsed.data.JWT_SECRET === "dev-super-secret-change-me" || parsed.data.JWT_SECRET.length < 32)
  ) {
    throw new Error(
      "JWT_SECRET must be a strong random value (32+ characters) in production. " +
        "Generate one with: node -e \"console.log(require('node:crypto').randomBytes(48).toString('base64url'))\""
    );
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

export interface LlmSettings {
  apiKey: string;
  baseURL?: string;
  model: string;
  provider: "deepseek" | "openai";
}

// "auto" prefers DeepSeek when its key is present, otherwise falls back to OpenAI.
export function resolveLlmSettings(config: AppConfig): LlmSettings | null {
  const wantsDeepseek = config.LLM_PROVIDER === "deepseek" || (config.LLM_PROVIDER === "auto" && !!config.DEEPSEEK_API_KEY);

  if (wantsDeepseek) {
    if (!config.DEEPSEEK_API_KEY) return null;
    return {
      provider: "deepseek",
      apiKey: config.DEEPSEEK_API_KEY,
      baseURL: config.DEEPSEEK_BASE_URL,
      model: config.DEEPSEEK_MODEL
    };
  }

  if (!config.OPENAI_API_KEY) return null;
  return {
    provider: "openai",
    apiKey: config.OPENAI_API_KEY,
    model: config.OPENAI_MODEL
  };
}

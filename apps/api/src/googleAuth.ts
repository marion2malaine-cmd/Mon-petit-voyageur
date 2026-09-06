import type { AppConfig } from "./config";

/**
 * Google sign-in with the plain OAuth 2.0 endpoints — no SDK, just two fetches.
 *
 * Left unconfigured (no client id/secret) the routes answer 503, exactly like
 * the Stripe and SMTP features, so the app runs without Google set up.
 */

function redirectUri(config: AppConfig): string | undefined {
  return config.GOOGLE_REDIRECT_URI;
}

export function isGoogleConfigured(config: AppConfig): boolean {
  return !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && redirectUri(config));
}

/**
 * The Google consent URL to send the browser to, or null when not configured.
 * `state` is an unguessable token the caller also stores in a cookie: the
 * callback rejects any response whose state does not match, which is what stops
 * a login CSRF (an attacker signing the victim into the attacker's account).
 */
export function startGoogleLogin(config: AppConfig, state: string): string | null {
  if (!isGoogleConfigured(config)) return null;
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(config)!,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string | null;
}

/** Exchanges the callback code for the user's Google profile, or null on failure. */
export async function completeGoogleLogin(config: AppConfig, code: string): Promise<GoogleProfile | null> {
  if (!isGoogleConfigured(config)) return null;
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.GOOGLE_CLIENT_ID!,
        client_secret: config.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(config)!,
        grant_type: "authorization_code"
      })
    });
    if (!tokenResponse.ok) return null;
    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) return null;

    const infoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!infoResponse.ok) return null;
    const info = (await infoResponse.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    // Only trust an email Google has itself verified: an unverified address
    // could otherwise be used to match — and take over — an existing account.
    if (!info.sub || !info.email || info.email_verified !== true) return null;

    return { googleId: info.sub, email: info.email.toLowerCase(), name: info.name ?? null };
  } catch {
    return null;
  }
}

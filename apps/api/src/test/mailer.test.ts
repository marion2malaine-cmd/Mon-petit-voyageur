import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { Mailer } from "../tools/mailer";
import { buildServer } from "../server";
import { resetConfigCache } from "../config";

const BASE_CONFIG = {
  NODE_ENV: "test" as const,
  PORT: 8787,
  SQLITE_PATH: ":memory:",
  JWT_SECRET: "test",
  LLM_PROVIDER: "auto" as const,
  OPENAI_MODEL: "gpt-4.1-mini",
  DEEPSEEK_MODEL: "deepseek-chat",
  DEEPSEEK_BASE_URL: "https://api.deepseek.com/v1",
  SHERPA_BASE_URL: "https://requirements-api.sherpa.com",
  SMTP_PORT: 587,
  SMTP_SECURE: false
};

describe("mailer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports itself as unconfigured without SMTP credentials", async () => {
    const mailer = new Mailer(BASE_CONFIG as any);
    expect(mailer.isConfigured).toBe(false);

    const result = await mailer.sendGuide({
      to: "someone@example.com",
      subject: "Guide",
      intro: "Voici votre guide",
      filename: "guide.html",
      html: "<html></html>",
      locale: "fr"
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("not_configured");
    expect(result.message).toContain("SMTP_HOST");
  });

  it("attaches the guide and never sends it as the body alone", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "abc" });
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as any);

    const mailer = new Mailer({
      ...BASE_CONFIG,
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "user@example.com",
      SMTP_PASS: "secret"
    } as any);

    const result = await mailer.sendGuide({
      to: "marion@example.com",
      subject: "Votre guide — Séville",
      intro: "Voici votre guide personnalisé",
      filename: "guide-seville.html",
      html: "<html><body>Guide</body></html>",
      locale: "fr"
    });

    expect(result.sent).toBe(true);
    const payload = sendMail.mock.calls[0][0];
    expect(payload.to).toBe("marion@example.com");
    expect(payload.from).toBe("user@example.com");
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].filename).toBe("guide-seville.html");
    expect(payload.html).toContain("Votre guide — Séville");
  });

  it("refuses a guide too large for an email instead of failing at the provider", async () => {
    const sendMail = vi.fn();
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as any);

    const mailer = new Mailer({
      ...BASE_CONFIG,
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "user@example.com",
      SMTP_PASS: "secret"
    } as any);

    const result = await mailer.sendGuide({
      to: "marion@example.com",
      subject: "Guide",
      intro: "Guide",
      filename: "guide.html",
      html: "x".repeat(13_000_000),
      locale: "fr"
    });

    expect(result.sent).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
    expect(result.message).toContain("trop volumineux");
  });
});

describe("guide email endpoint", () => {
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.SQLITE_PATH = path.join(os.tmpdir(), `mlt-${randomUUID()}.sqlite`);
    process.env.JWT_SECRET = "test-secret";
    delete process.env.SMTP_HOST;

    resetConfigCache();
    app = buildServer();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    resetConfigCache();
  });

  it("tells the caller when email is not configured rather than pretending to send", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "test@example.com", password: "supersecure123", preferred_language: "fr" }
    });
    const cookie = register.cookies.find((c) => c.name === "mlt_token");

    const response = await app.inject({
      method: "POST",
      url: "/api/trips/1/guide/email",
      headers: { cookie: `mlt_token=${cookie?.value}` },
      payload: {}
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toBe("email_not_configured");
  });
});

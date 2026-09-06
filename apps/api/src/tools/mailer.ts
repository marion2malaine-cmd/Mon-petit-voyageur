import nodemailer, { type Transporter } from "nodemailer";
import type { AppConfig } from "../config";

// Beyond this, most providers reject the message: the guide is then sent with
// remote photo URLs instead of embedded ones.
const MAX_ATTACHMENT_BYTES = 12_000_000;

export interface GuideMail {
  to: string;
  subject: string;
  intro: string;
  filename: string;
  html: string;
  locale: "fr" | "en";
}

export interface MailResult {
  sent: boolean;
  reason?: "not_configured" | "error";
  message?: string;
  messageId?: string;
}

export class Mailer {
  private readonly transporter: Transporter | null;
  private readonly from: string | null;

  constructor(private readonly config: AppConfig) {
    if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
      this.transporter = null;
      this.from = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS }
    });
    this.from = config.SMTP_FROM ?? config.SMTP_USER;
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  /** Sends the guide as an attachment, with a short readable body. */
  async sendGuide(mail: GuideMail): Promise<MailResult> {
    if (!this.transporter || !this.from) {
      return {
        sent: false,
        reason: "not_configured",
        message:
          mail.locale === "fr"
            ? "L'envoi par mail n'est pas configuré : renseignez SMTP_HOST, SMTP_USER et SMTP_PASS dans .env."
            : "Email sending is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS in .env."
      };
    }

    const attachment = Buffer.from(mail.html, "utf8");
    if (attachment.byteLength > MAX_ATTACHMENT_BYTES) {
      return {
        sent: false,
        reason: "error",
        message:
          mail.locale === "fr"
            ? "Le guide est trop volumineux pour un envoi par mail. Réessayez sans intégrer les photos."
            : "The guide is too large to email. Try again without embedding the photos."
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.intro,
        html: renderMailBody(mail),
        attachments: [{ filename: mail.filename, content: attachment, contentType: "text/html; charset=utf-8" }]
      });

      return { sent: true, messageId: info.messageId };
    } catch (error) {
      return { sent: false, reason: "error", message: (error as Error).message };
    }
  }
}

// The body stays deliberately plain: the guide itself is the attachment, and
// mail clients mangle elaborate layouts.
function renderMailBody(mail: GuideMail): string {
  const fr = mail.locale === "fr";

  return `<div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#334d3e;background:#f0ebe6;padding:28px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ddd0c6;border-radius:12px;padding:26px 28px">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#57705f">Mon Petit Voyageur</p>
    <h1 style="margin:0 0 14px;font-size:24px;font-weight:700;letter-spacing:-.02em">${escapeHtml(mail.subject)}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#57705f">${escapeHtml(mail.intro)}</p>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.55">
      ${
        fr
          ? "Le guide est en pièce jointe. Ouvrez-le dans votre navigateur : le bouton en bas à droite l'imprime ou l'enregistre en PDF."
          : "The guide is attached. Open it in your browser: the button at the bottom right prints it or saves it as a PDF."
      }
    </p>
    <p style="margin:18px 0 0;font-size:13px;color:#57705f">
      ${fr ? "Bon voyage." : "Safe travels."}
    </p>
  </div>
</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

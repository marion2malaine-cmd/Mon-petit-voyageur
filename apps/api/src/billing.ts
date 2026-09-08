import Stripe from "stripe";
import type { AppConfig } from "./config";
import type { AppDb, SubscriptionStatus, UserRecord } from "./db";

export type BillingPlan = "monthly" | "annual" | "premium";

/**
 * Guards against placeholder values left in the environment (`sk_live_xxx`,
 * `price_xxx`, a copied example line...). A bogus key is worse than a missing
 * one: the API would believe billing is on, turn the paywall on and fail every
 * checkout at Stripe. Anything that is not shaped like a real credential is
 * treated as "not configured".
 */
export const isRealSecretKey = (value: string | undefined): value is string =>
  !!value && /^(sk|rk)_(live|test)_[A-Za-z0-9]{16,}$/.test(value);

const isRealPriceId = (value: string | undefined): value is string =>
  !!value && /^price_[A-Za-z0-9]{10,}$/.test(value);

/**
 * Thin wrapper around Stripe.
 *
 * Mirrors the Mailer pattern: when STRIPE_SECRET_KEY is missing the feature is
 * simply "not configured" — the endpoints answer 503 with a readable message
 * and access is granted to everyone, so the product keeps working before Stripe
 * is set up. Once the key and price ids are provided, the paywall turns on.
 */
export class Billing {
  private readonly stripe: Stripe | null;

  constructor(private readonly config: AppConfig) {
    if (config.STRIPE_SECRET_KEY && !isRealSecretKey(config.STRIPE_SECRET_KEY)) {
      console.warn(
        "[billing] STRIPE_SECRET_KEY est présente mais ne ressemble pas à une clé Stripe " +
          "(attendu sk_live_… ou sk_test_…). Les paiements restent désactivés."
      );
    }
    this.stripe = isRealSecretKey(config.STRIPE_SECRET_KEY) ? new Stripe(config.STRIPE_SECRET_KEY) : null;
  }

  /** True when Stripe is set up: a secret key and at least one recurring price. */
  get isConfigured(): boolean {
    return (
      !!this.stripe &&
      [this.config.STRIPE_PRICE_MONTHLY, this.config.STRIPE_PRICE_ANNUAL, this.config.STRIPE_PRICE_PREMIUM].some(
        isRealPriceId
      )
    );
  }

  private priceId(plan: BillingPlan): string | undefined {
    const configured =
      plan === "premium"
        ? this.config.STRIPE_PRICE_PREMIUM
        : plan === "annual"
        ? this.config.STRIPE_PRICE_ANNUAL
        : this.config.STRIPE_PRICE_MONTHLY;
    return isRealPriceId(configured) ? configured : undefined;
  }

  /** Finds or creates the Stripe customer for a user and stores its id. */
  private async ensureCustomer(user: UserRecord, db: AppDb): Promise<string> {
    if (user.stripe_customer_id) return user.stripe_customer_id;
    const customer = await this.stripe!.customers.create({
      email: user.email,
      metadata: { userId: String(user.id) }
    });
    db.updateBilling({ userId: user.id, stripeCustomerId: customer.id });
    return customer.id;
  }

  /**
   * A Stripe Checkout session for a subscription. The free trial is applied
   * once (trial_used guards it): a returning subscriber pays immediately.
   */
  async createCheckoutSession(input: {
    user: UserRecord;
    plan: BillingPlan;
    db: AppDb;
  }): Promise<{ url: string } | { error: string }> {
    if (!this.isConfigured) return { error: "not_configured" };
    const price = this.priceId(input.plan);
    if (!price) return { error: "plan_unavailable" };
    if (input.plan === "premium") {
      const productPrice = await this.stripe!.prices.retrieve(price);
      if (productPrice.unit_amount !== 999 || productPrice.currency !== "eur" || productPrice.recurring?.interval !== "month" || productPrice.recurring.interval_count !== 1) return { error: "premium_price_invalid" };
      if (["active", "trialing"].includes(input.user.subscription_status ?? "")) return { error: "use_billing_portal_to_upgrade" };
    }

    const customerId = await this.ensureCustomer(input.user, input.db);
    const trialDays = input.plan === "premium" || input.user.trial_used ? undefined : this.config.TRIAL_DAYS || undefined;

    const session = await this.stripe!.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      // A card is collected up front even during the trial: it removes most
      // throwaway-email abuse without charging the traveler before the trial ends.
      subscription_data: trialDays ? { trial_period_days: trialDays } : undefined,
      client_reference_id: String(input.user.id),
      allow_promotion_codes: true,
      success_url: `${this.config.APP_URL}/?checkout=success`,
      cancel_url: `${this.config.APP_URL}/?checkout=cancel`
    });

    return session.url ? { url: session.url } : { error: "no_url" };
  }

  /** A Stripe Billing Portal session so the user can manage/cancel their plan. */
  async createPortalSession(user: UserRecord): Promise<{ url: string } | { error: string }> {
    if (!this.stripe) return { error: "not_configured" };
    if (!user.stripe_customer_id) return { error: "no_customer" };
    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${this.config.APP_URL}/`
    });
    return { url: session.url };
  }

  /** Verifies a webhook payload and returns the parsed event, or null. */
  constructEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event | null {
    if (!this.stripe || !this.config.STRIPE_WEBHOOK_SECRET || !signature) return null;
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, this.config.STRIPE_WEBHOOK_SECRET);
    } catch {
      return null;
    }
  }

  /** Reads the current subscription for a customer and returns our view of it. */
  async syncSubscription(customerId: string): Promise<{
    status: SubscriptionStatus;
    plan: string | null;
    currentPeriodEnd: string | null;
    trialUsed: boolean;
  } | null> {
    if (!this.stripe) return null;
    const subs = await this.stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
    const sub = subs.data[0];
    if (!sub) return { status: "none", plan: null, currentPeriodEnd: null, trialUsed: false };
    return this.mapSubscription(sub);
  }

  mapSubscription(sub: Stripe.Subscription): {
    status: SubscriptionStatus;
    plan: string | null;
    currentPeriodEnd: string | null;
    trialUsed: boolean;
  } {
    const priceId = sub.items.data[0]?.price?.id ?? null;
    const plan =
      priceId === this.config.STRIPE_PRICE_PREMIUM && !!this.config.STRIPE_PRICE_PREMIUM
        ? "premium"
        : priceId === this.config.STRIPE_PRICE_ANNUAL
        ? "annual"
        : priceId === this.config.STRIPE_PRICE_MONTHLY
        ? "monthly"
        : priceId;
    return {
      status: mapStatus(sub.status),
      plan,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      // Once a trial has started (or been skipped and gone straight to active),
      // the account has consumed its trial and never gets another.
      trialUsed: sub.status === "trialing" || sub.status === "active" || !!sub.trial_end
    };
  }
}

/** Maps Stripe's many statuses onto the five we store. */
function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return "none";
  }
}

/** Whether a user may use paid features right now. */
export function hasActiveAccess(
  user: Pick<UserRecord, "subscription_status" | "email">,
  billingConfigured: boolean,
  compEmails?: Set<string>
): boolean {
  // Comp accounts (team / founder) always have access, even once billing is on.
  if (compEmails && user.email && compEmails.has(user.email.toLowerCase())) return true;
  // Before Stripe is configured the app is open, so nothing breaks in the
  // meantime; once it is configured, only trialing/active accounts get in.
  if (!billingConfigured) return true;
  return user.subscription_status === "active" || user.subscription_status === "trialing";
}

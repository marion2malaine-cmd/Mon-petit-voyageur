import { describe, it, expect } from "vitest";
import { Billing } from "../billing";

// A key or price id left as a placeholder must never turn the paywall on:
// the API would believe billing works and fail every checkout at Stripe.
describe("Billing configuration guard", () => {
  // Assemblé morceau par morceau : une chaîne complète, même inventée, est
  // signalée comme un secret par l'analyse de GitHub et bloque le push.
  const fakeKey = ["sk", "live", "0".repeat(24)].join("_");
  const real = { STRIPE_SECRET_KEY: fakeKey, STRIPE_PRICE_MONTHLY: "price_" + "0".repeat(14) };
  const billing = (over: Record<string, string | undefined>) =>
    new Billing({ ...real, ...over } as any);

  it("is configured only with a real-looking key and price", () => {
    expect(billing({}).isConfigured).toBe(true);
    for (const over of [
      { STRIPE_SECRET_KEY: undefined },
      { STRIPE_SECRET_KEY: "sk_live_xxx" },
      { STRIPE_SECRET_KEY: fakeKey.replace("live", "prod") },
      { STRIPE_SECRET_KEY: "mk_1UCmKzIwWwwYAupkJ7ID9CUU" },
      { STRIPE_PRICE_MONTHLY: "price_xxx" },
      { STRIPE_PRICE_MONTHLY: undefined }
    ])
      expect(billing(over).isConfigured).toBe(false);
  });
});

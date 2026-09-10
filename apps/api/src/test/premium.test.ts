import { describe, it, expect } from "vitest";
import { premiumAccess, walletSchema } from "../premium";

describe("Premium entitlement", () => {
  const valid = { subscription_plan: "premium", subscription_status: "active", current_period_end: "2099-01-01T00:00:00Z" };
  it("requires an active unexpired Premium subscription", () => {
    expect(premiumAccess(valid)).toBe(true);
    for (const user of [null, {}, { ...valid, subscription_plan: "monthly" }, { ...valid, subscription_status: "past_due" }, { ...valid, current_period_end: "2020-01-01" }, { ...valid, current_period_end: null }]) expect(premiumAccess(user)).toBe(false);
  });
  it("rejects invalid participants and executable photo data", () => {
    const wallet = { revision: 0, currency: "EUR", people: ["A"], expenses: [], photos: [] };
    expect(walletSchema.safeParse(wallet).success).toBe(true);
    expect(walletSchema.safeParse({ ...wallet, people: ["A", "A"] }).success).toBe(false);
    expect(walletSchema.safeParse({ ...wallet, photos: [{ id: "acfdca65-e9cd-41eb-88d2-14718a41b44a", title: "x", note: "", date: "2026-09-07T00:00:00Z", image: "data:image/svg+xml;base64,PHN2Zz4=" }] }).success).toBe(false);
  });
});

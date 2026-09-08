import { describe, it, expect } from "vitest";
import { balances, repayments } from "../PremiumMobile";

describe("shared expense ledger", () => {
  it("splits odd cents without losing money", () => {
    const balance = balances(["A", "B", "C"], [{ payer: "A", cents: 100, participants: ["A", "B", "C"] }]);
    expect(balance).toEqual({ A: 66, B: -33, C: -33 });
    expect(repayments(balance)).toEqual([{ from: "B", to: "A", cents: 33 }, { from: "C", to: "A", cents: 33 }]);
  });
  it("settles mixed payments and a payer outside the beneficiaries", () => {
    const balance = balances(["A", "B", "C"], [
      { payer: "A", cents: 151, participants: ["B", "C"] },
      { payer: "B", cents: 300, participants: ["A", "B", "C"] }
    ]);
    for (const transfer of repayments(balance)) { balance[transfer.from] += transfer.cents; balance[transfer.to] -= transfer.cents; }
    expect(Object.values(balance)).toEqual([0, 0, 0]);
  });
});

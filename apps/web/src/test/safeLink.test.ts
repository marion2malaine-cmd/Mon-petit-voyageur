import { describe, it, expect } from "vitest";
import { safeLink } from "../safeLink";

// Trip URLs come from the model and from external tools: only http(s) may
// reach an href, or a link click would run code in the traveller's session.
describe("safeLink", () => {
  it("keeps ordinary web addresses", () => {
    for (const url of ["https://booking.com/hotel", "http://example.org", "HTTPS://Example.org/x?a=1"])
      expect(safeLink(url)).toBe(url);
  });
  it("rejects anything that is not http(s)", () => {
    for (const bad of [
      "javascript:alert(document.cookie)",
      " javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "//evil.example.com",
      "",
      null,
      undefined,
      42
    ])
      expect(safeLink(bad)).toBeUndefined();
  });
});

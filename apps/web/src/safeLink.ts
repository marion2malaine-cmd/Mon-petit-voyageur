/**
 * Only http(s) addresses may reach an `href`. Trip data carries URLs produced
 * by the model and by external tools, and a `javascript:` address in an href
 * runs as code in the traveller's session instead of opening a page. Anything
 * else returns undefined: React then omits the attribute, so the label stays
 * visible but is no longer clickable.
 */
export const safeLink = (value: unknown): string | undefined =>
  typeof value === "string" && /^https?:\/\//i.test(value) ? value : undefined;

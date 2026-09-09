import { text } from "./appTranslations";

export function PricingPlans({
  t,
  trialUsed,
  busy,
  onChoose
}: {
  t: (typeof text)["fr"] | (typeof text)["en"];
  trialUsed: boolean;
  busy: boolean;
  onChoose: (plan: "monthly" | "annual") => void;
}) {
  const cta = trialUsed ? t.planCta : t.planTrialCta;
  return (
    <div className="pricing">
      <div className="pricing-grid">
        <article className="plan-card">
          <h3>{t.planMonthlyName}</h3>
          <p className="plan-price">
            <strong>{t.planMonthlyPrice}</strong> <span>{t.planMonthlyPer}</span>
          </p>
          <ul className="plan-features">
            {t.planFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <button type="button" onClick={() => onChoose("monthly")} disabled={busy}>
            {cta}
          </button>
        </article>
        <article className="plan-card is-featured">
          <span className="plan-badge">{t.planPopular}</span>
          <h3>{t.planAnnualName}</h3>
          <p className="plan-price">
            <strong>{t.planAnnualPrice}</strong> <span>{t.planAnnualPer}</span>
          </p>
          <p className="plan-save">{t.planAnnualNote}</p>
          <ul className="plan-features">
            {t.planFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <button type="button" onClick={() => onChoose("annual")} disabled={busy}>
            {cta}
          </button>
        </article>
      </div>
      {trialUsed && <p className="plan-note">{t.planTrialUsedNote}</p>}
      <p className="plan-reassurance">{t.planReassurance}</p>
    </div>
  );
}

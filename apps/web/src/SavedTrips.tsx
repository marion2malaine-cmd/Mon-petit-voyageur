import type { ReactNode } from "react";
import { text } from "./appTranslations";
export function SavedTrips({ locale, trips, activeTripId, tripsError, hasMoreTrips, tripsBusy, loadMoreTrips, openTrip, onPlan, featureIcons }: {
  locale: "fr" | "en"; trips: any[]; activeTripId?: number; tripsError: string; hasMoreTrips: boolean; tripsBusy: boolean;
  loadMoreTrips: () => void; openTrip: (trip: any) => void; onPlan: () => void; featureIcons: { compass: ReactNode; map: ReactNode };
}) {
  const t = text[locale];
  return (
        <main className="layout trips-page">
          <section className="card trips">
            <div className="trips-head">
              <div>
                <h3>{t.recentTrips}</h3>
                <p className="trips-hint">{t.tripsHint}</p>
              </div>
              <button type="button" className="secondary" onClick={() => onPlan()}>
                {t.navPlan}
              </button>
            </div>

            {tripsError && <p role="alert">{tripsError}</p>}
            {hasMoreTrips && <button type="button" disabled={tripsBusy} onClick={loadMoreTrips}>{locale === "fr" ? "Charger plus de voyages" : "Load more trips"}</button>}
            {trips.length === 0 ? (
              <div className="trips-empty">
                <span className="feature-icon">{featureIcons.compass}</span>
                <p>{t.tripsEmpty}</p>
                <button type="button" onClick={() => onPlan()}>
                  {t.tripsEmptyCta}
                </button>
              </div>
            ) : (
              <div className="trip-grid">
                {trips.map((trip) => {
                  const brief = trip.brief_json ?? {};
                  const dates = brief.exact_dates ?? {};
                  const isOpen = activeTripId === trip.id;
                  const destination = brief.destination ?? trip.title?.replace(/^Trip - /, "") ?? "";
                  const dateLabel =
                    dates.start && dates.end
                      ? `${formatDate(dates.start, locale)} → ${formatDate(dates.end, locale)}`
                      : brief.date_window ?? t.datesFlexible;
                  const facts = [
                    brief.duration_days ? `${brief.duration_days} ${t.daysShort}` : null,
                    brief.travelers_count ? `${brief.travelers_count} ${t.travelersShort}` : null,
                    brief.budget_total ? `${brief.budget_total} ${brief.currency ?? "EUR"}` : null
                  ].filter(Boolean);
                  return (
                    <article key={trip.id} className={`trip-card${isOpen ? " is-open" : ""}`}>
                      <div className="trip-card-head">
                        <span className="trip-card-icon">{featureIcons.map}</span>
                        {isOpen && <span className="tag">{t.tripOpen}</span>}
                      </div>
                      <h4>{destination || trip.title}</h4>
                      <p className="trip-card-dates">{dateLabel}</p>
                      {facts.length > 0 && <p className="trip-card-facts">{facts.join(" · ")}</p>}
                      <small>
                        {t.updatedOn} {formatDate(trip.updated_at, locale)}
                      </small>
                      <button type="button" disabled={tripsBusy} onClick={() => openTrip(trip)}>
                        {t.openTrip}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
  );
}
function formatDate(value: string, locale: "fr" | "en"): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}

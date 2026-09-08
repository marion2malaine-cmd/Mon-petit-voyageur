const labels = {
  fr: { title: "Se déplacer sur place", sub: "VTC, taxis, tuk-tuks et chauffeurs : des repères de prix avant de partir.", available: "Disponible", limited: "Disponibilité limitée", unavailable: "Indisponible", unknown: "À vérifier", estimated: "Estimation", published: "Tarif publié", drivers: "Réserver un chauffeur", checked: "Disponibilité vérifiée le", warning: "Les prix varient selon le trafic, l’horaire et la demande. Vérifiez le prix dans l’application ou avec le chauffeur avant de partir." },
  en: { title: "Getting around", sub: "Ride-hailing, taxis, tuk-tuks and drivers: useful price benchmarks before you go.", available: "Available", limited: "Limited availability", unavailable: "Unavailable", unknown: "Check locally", estimated: "Estimate", published: "Published fare", drivers: "Book a driver", checked: "Availability checked", warning: "Prices vary with traffic, time and demand. Confirm the fare in the app or with the driver before leaving." }
};

export default function LocalMobility({ transport, locale }: { transport: any; locale: "fr" | "en" }) {
  if (!transport?.local_mobility?.length && !transport?.driver_services?.length) return null;
  const t = labels[locale];
  return <section className="local-mobility">
    <header><div><h4>{t.title}</h4><p>{t.sub}</p></div>{transport.mobility_checked_on && <small>{t.checked} {transport.mobility_checked_on}</small>}</header>
    <div className="mobility-grid">{(transport.local_mobility ?? []).map((option: any) => <article key={`${option.kind}-${option.name}`}>
      <div className="mobility-head"><strong>{option.name}</strong><span className={`mobility-status ${option.availability}`}>{(t as any)[option.availability] ?? t.unknown}</span></div>
      {option.booking_method && <p>{option.booking_method}</p>}
      <div className="mobility-fares">{(option.typical_fares ?? []).map((fare: any, index: number) => <span key={index}><strong>{fare.duration_minutes} min</strong>{fare.price_min_eur != null ? `${fare.price_min_eur}–${fare.price_max_eur ?? fare.price_min_eur} €` : fare.price_note || t.unknown}<small>{fare.price_note}</small></span>)}</div>
      {(option.notes ?? []).map((note: string) => <small key={note}>{note}</small>)}
      <em>{option.estimated ? t.estimated : t.published}</em>
    </article>)}</div>
    <p className="mobility-warning">{t.warning}</p>
    {(transport.driver_services ?? []).length > 0 && <><h5>{t.drivers}</h5><div className="driver-links">{transport.driver_services.map((service: any) => <a key={service.website} href={service.website} target="_blank" rel="noreferrer"><strong>{service.name}</strong><span>{service.service_type.replaceAll("_", " ")} · {(t as any)[service.availability] ?? t.unknown}</span>{service.notes && <small>{service.notes}</small>}</a>)}</div></>}
  </section>;
}

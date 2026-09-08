import { safeLink } from "./safeLink";
import { useState } from "react";
import { api } from "./api";

const escape = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export default function TripCompanion({ result, onChange, locale }: { result: any; onChange: (p: any) => void; locale: "fr" | "en" }) {
  const fr = locale === "fr";
  const s = result.structured_json;
  const days = s?.itinerary?.itinerary_by_day ?? [];
  const research = s?.research ?? {};
  const hotel = research.recommended_stays?.[research.chosen_stay_index];
  const [active, setActive] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [people, setPeople] = useState(s.budget_choices?.people ?? s.brief?.travelers_count ?? 1);
  const [rooms, setRooms] = useState(s.budget_choices?.rooms ?? 1);
  const [nights, setNights] = useState(s.budget_choices?.nights ?? Math.max(0, days.length - 1));
  const [transport, setTransport] = useState(String(s.budget_choices?.transport ?? research.ground_transport?.total_estimate_eur ?? ""));
  const current = days.find((d: any) => d.day === active) ?? days.find((d: any) => d.date === new Date().toLocaleDateString("en-CA")) ?? days[0];
  if (!current) return null;
  const selected = days.flatMap((d: any) => (d.paid_options ?? []).filter((p: any) => p.selected));
  const activity = selected.reduce((total: number, p: any) => total + (p.price_from_eur ?? 0) * people, 0);
  const lodging = hotel?.currency === "EUR" && hotel?.price_per_night != null ? hotel.price_per_night * rooms * nights : null;
  const transportCost = transport === "" ? null : Number(transport);
  const nextStop = [...(current.free_visits ?? []), ...(current.paid_options ?? []).filter((p: any) => p.selected), ...(current.restaurants ?? [])].find((p: any) => !p.completed);

  async function edit(payload: any) {
    setBusy(true); setError("");
    try { onChange(await api.editItinerary(result.trip_id, payload)); }
    catch { setError(fr ? "Modification non enregistrée. Réessayez." : "Changes were not saved. Please retry."); }
    finally { setBusy(false); }
  }
  function offline() {
    const body = days.map((d: any) => `<section><h2>${escape(d.title)}</h2>${d.route ? `<p>${escape(d.route.from)} → ${escape(d.route.to)} · ${escape(d.route.mode)} · ${escape(d.route.duration)}</p>` : ""}${[...(d.free_visits ?? []), ...(d.paid_options ?? []).filter((p: any) => p.selected), ...(d.restaurants ?? [])].map((p: any) => `<article><h3>${escape(p.name ?? p.title)}</h3><p>${escape(p.address ?? p.area ?? "")}</p><p>${escape(p.opening_hours ?? "")}</p>${(p.booking_links ?? []).filter((l: any) => safeLink(l.url)).map((l: any) => `<p><a href="${escape(l.url)}">${escape(l.label)}</a></p>`).join("")}</article>`).join("")}</section>`).join("");
    const html = `<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mon voyage</title><style>body{font:17px system-ui;background:#faf7f0;color:#173b4c;max-width:760px;margin:auto;padding:24px}article{background:white;border-radius:16px;padding:16px;margin:12px 0}a{color:#a74b36}</style><h1>${fr ? "Mon voyage hors connexion" : "My offline trip"}</h1><p>${escape(new Date().toLocaleString(locale))} · ${fr ? "Les liens nécessitent Internet." : "Links require Internet."}</p>${hotel ? `<h2>${escape(hotel.name)}</h2><p>${escape(hotel.area)}</p>` : ""}${body}</html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `voyage-${result.trip_id}-hors-connexion.html`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="trip-companion">
    <header><div><h3>{fr ? "Mon voyage, à ma façon" : "My trip, my way"}</h3><p>{fr ? "Vos choix sont enregistrés dans votre voyage." : "Your choices are saved to your trip."}</p></div><button type="button" onClick={offline}>{fr ? "Télécharger hors connexion" : "Download offline"}</button></header>
    <details className="companion-budget"><summary>{fr ? "Budget de mes choix" : "My selected budget"} · {(activity + (lodging ?? 0) + (transportCost ?? 0)).toFixed(2)} €</summary>
      <div className="companion-fields"><label>{fr ? "Voyageurs" : "Travelers"}<input type="number" min="1" value={people} onChange={e => setPeople(Math.max(1, Number(e.target.value)))} /></label><label>{fr ? "Chambres" : "Rooms"}<input type="number" min="1" value={rooms} onChange={e => setRooms(Math.max(1, Number(e.target.value)))} /></label><label>{fr ? "Nuits" : "Nights"}<input type="number" min="0" value={nights} onChange={e => setNights(Math.max(0, Number(e.target.value)))} /></label><label>{fr ? "Transports et vols · total estimé (€)" : "Transport and flights · estimated total (€)"}<input type="number" min="0" value={transport} onChange={e => setTransport(e.target.value)} /></label></div>
      <p>{fr ? "Hôtel" : "Hotel"} : {lodging === null ? "—" : `${lodging.toFixed(2)} €`} · {fr ? "Activités sélectionnées" : "Selected activities"} : {activity.toFixed(2)} €</p>
      <button type="button" disabled={busy} onClick={() => edit({ action: "budget", values: { people, rooms, nights, transport: transportCost } })}>{fr ? "Enregistrer mes hypothèses" : "Save budget assumptions"}</button>
      <small>{fr ? "Sous-total estimatif, hors repas et postes non renseignés. Prix d’activités calculés par personne ; vérifiez les tarifs de groupe. Les montants inconnus ne sont pas gratuits." : "Estimated subtotal excludes meals and unspecified costs. Activities use per-person pricing; check group rates. Unknown prices are not free."}</small>
      {selected.some((p: any) => p.price_from_eur == null) && <p>{fr ? "Certaines activités sélectionnées n’ont pas de prix." : "Some selected activities have no price."}</p>}
    </details>
    <h4>{fr ? "Ma journée" : "My day"}</h4><nav className="companion-days">{days.map((d: any) => <button type="button" key={d.day} aria-pressed={current.day === d.day} onClick={() => setActive(d.day)}>{fr ? "Jour" : "Day"} {d.day}</button>)}</nav>
    <h4>{current.title}</h4>
    {nextStop && <p><strong>{fr ? "Prochaine étape : " : "Next stop: "}{nextStop.name ?? nextStop.title}</strong></p>}
    {current.route && <p>{current.route.from} → {current.route.to} · {current.route.mode} · {current.route.duration} {current.route.distance_km ? `· ${current.route.distance_km} km` : ""}</p>}
    {error && <p role="alert">{error}</p>}
    {s.previous_itinerary && <button type="button" className="secondary" disabled={busy} onClick={() => edit({ action: "undo" })}>{fr ? "Annuler la dernière modification" : "Undo last edit"}</button>}
    {(["free_visits", "paid_options", "restaurants"] as const).map(collection => <div key={collection}><h5>{collection === "free_visits" ? (fr ? "Visites" : "Visits") : collection === "paid_options" ? (fr ? "Activités au choix" : "Optional activities") : (fr ? "Restaurants" : "Restaurants")}</h5>{(current[collection] ?? []).map((p: any, index: number) => <article key={`${current.day}-${collection}-${index}`} className="companion-stop">
      <strong>{p.name ?? p.title}</strong>{p.address && <p>{p.address}</p>}
      {(collection !== "paid_options" || p.selected) && <label><input type="checkbox" disabled={busy} checked={!!p.completed} onChange={e => edit({ action: "complete", day: current.day, collection, index, completed: e.target.checked })} />{fr ? "Étape terminée" : "Stop completed"}</label>}
      <small>{p.opening_hours ?? (fr ? "Horaires à vérifier sur le site officiel" : "Check opening hours with the venue")}</small>
      {p.photo?.source_url && safeLink(p.photo.source_url) && <a href={p.photo.source_url} target="_blank" rel="noreferrer">{fr ? "Source photo" : "Photo source"}{p.photo.credit ? ` · ${p.photo.credit}` : ""}</a>}
      {safeLink(p.official_url ?? p.website) && <a href={p.official_url ?? p.website} target="_blank" rel="noreferrer">{fr ? "Site officiel" : "Official website"} ↗</a>}
      {collection === "paid_options" && <><small>{p.price_from_eur == null ? (fr ? "Prix inconnu" : "Unknown price") : `${p.price_from_eur} € · ${p.price_source === "estimate" ? (fr ? "Estimation" : "Estimate") : (fr ? "Prix annoncé, à reconfirmer" : "Listed price, reconfirm")}`} · {fr ? "Date de vérification non disponible" : "Verification date unavailable"}</small><label><input type="checkbox" disabled={busy} checked={!!p.selected} onChange={e => edit({ action: "select", day: current.day, collection, index, selected: e.target.checked })} />{fr ? "Inclure dans mon parcours et mon budget" : "Include in my route and budget"}</label></>}
      {p.coordinates && <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.coordinates.lat},${p.coordinates.lon}&travelmode=walking`} target="_blank" rel="noreferrer">{fr ? "Y aller à pied" : "Walk there"} ↗</a>}
      {(p.booking_links ?? []).filter((l: any) => safeLink(l.url)).slice(0, 2).map((l: any) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}
      <div className="companion-actions"><select aria-label={fr ? "Déplacer vers une journée" : "Move to day"} value="" disabled={busy} onChange={e => edit({ action: "move", day: current.day, collection, index, targetDay: Number(e.target.value) })}><option value="">{fr ? "Déplacer vers…" : "Move to…"}</option>{days.filter((d: any) => d.day !== current.day).map((d: any) => <option value={d.day} key={d.day}>{fr ? "Jour" : "Day"} {d.day}</option>)}</select><button className="secondary" type="button" disabled={busy} onClick={() => edit({ action: "remove", day: current.day, collection, index })}>{fr ? "Retirer" : "Remove"}</button>
      {collection === "restaurants" && <button className="secondary" type="button" disabled={busy} onClick={() => { const name = window.prompt(fr ? "Nom du restaurant de remplacement" : "Replacement restaurant name"); if (name?.trim()) edit({ action: "rename", day: current.day, collection, index, name }); }}>{fr ? "Remplacer" : "Replace"}</button>}</div>
    </article>)}</div>)}
  </section>;
}

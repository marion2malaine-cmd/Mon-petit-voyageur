// The guide is laid out like the printed carnet: cream paper, deep-blue serif
// titles, terracotta kickers and a sage panel for the tables of the day. Body
// text stays in the system sans-serif the site uses.
export const GUIDE_CSS = `
:root {
  --bg: #faf6ef;
  --ink: #22384a;
  --primary: #c0664a;
  --primary-dark: #a4543b;
  --primary-pale: #e7ece7;
  --secondary: #f3eee5;
  --card: #ffffff;
  --border: #ddd6cb;
  --muted: #5f6570;
  --radius: 12px;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--sans);
  color: var(--ink);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  line-height: 1.55;
}

img { max-width: 100%; display: block; }
a { color: inherit; }

/* Icons are inline SVG (never emoji, which print inconsistently): without a
   default size they stretch to fill their container. */
svg {
  width: 1em;
  height: 1em;
  flex: none;
  vertical-align: -0.14em;
  color: var(--primary-dark);
}

/* ---------- Layout ---------- */

.band { padding: 4.5rem 1.5rem; }
.band-cream { background: var(--bg); }
.band-soft { background: var(--secondary); }
.band-deep { background: var(--ink); color: #f4f1ec; }
.band-deep .section-sub,
.band-deep .muted { color: rgba(244, 241, 236, 0.75); }
.inner { max-width: 940px; margin: 0 auto; }

.section-title {
  margin: 0 0 0.6rem;
  font-family: var(--serif);
  font-size: clamp(1.9rem, 4vw, 2.8rem);
  font-weight: 400;
  letter-spacing: -0.015em;
  line-height: 1.1;
}
.section-rule { display: none; }
.section-sub {
  max-width: 640px; margin: 0 0 2.4rem;
  color: var(--muted); font-size: 1rem;
}

/* Small capitals in terracotta above a title, as on each page of the carnet. */
.kicker {
  font-size: 0.74rem; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--primary); margin-bottom: 0.9rem;
}
.band-deep .kicker { color: #e6a58e; }
.page-title {
  margin: 0 0 1.6rem;
  font-family: var(--serif);
  font-size: clamp(2.4rem, 5.5vw, 3.8rem);
  font-weight: 400; line-height: 1.08; letter-spacing: -0.02em;
}
.running-head {
  display: flex; justify-content: space-between;
  padding-bottom: 1rem; margin-bottom: 2.8rem; border-bottom: 1px solid var(--border);
  font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink);
}

/* ---------- Cover ---------- */

.cover { padding: 5.5rem 1.5rem 4rem; text-align: center; background: var(--bg); }
.cover-pill {
  display: inline-flex; align-items: center; gap: 0.55rem;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(51, 77, 62, 0.1);
  border-radius: 999px; padding: 0.45rem 1.15rem;
  font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--muted);
}
.cover-title {
  margin: 1.6rem 0 0.9rem;
  font-family: var(--serif);
  font-size: clamp(2.8rem, 7vw, 4.6rem);
  font-weight: 400; letter-spacing: -0.02em; line-height: 1.05;
}
.cover-title em { font-style: normal; color: var(--primary-dark); }
.cover-sub { max-width: 620px; margin: 0 auto; color: var(--muted); font-size: 1.02rem; }

.stats {
  display: flex; flex-wrap: wrap; justify-content: center;
  gap: 2.6rem; margin: 3rem auto 0;
}
.stat-value { font-family: var(--serif); font-size: 2.4rem; font-weight: 400; letter-spacing: -0.02em; color: var(--ink); }
.stat-label {
  font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--muted); margin-top: 0.2rem;
}

.cover-note {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem 1.6rem;
  margin: 3rem auto 0; padding: 1.1rem 1.4rem; max-width: 820px;
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  font-size: 0.86rem; color: var(--muted);
}
.cover-note span {
  display: flex; align-items: flex-start; gap: 0.5rem;
  flex: 1 1 220px; max-width: 260px; text-align: left;
}
.cover-note svg { margin-top: 0.22em; }
.cover-note strong { color: var(--ink); }

/* ---------- Chips ---------- */

.chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.chip {
  display: inline-flex; align-items: center; gap: 0.35rem;
  background: var(--primary-pale); color: var(--ink);
  border: 1px solid rgba(120, 161, 137, 0.35);
  border-radius: 999px; padding: 0.3rem 0.75rem;
  font-size: 0.78rem; white-space: nowrap;
}
.chip-free { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 600; }
.chip-price { background: var(--secondary); border-color: var(--border); }
.chip svg { width: 0.85rem; height: 0.85rem; flex: none; }
.band-deep .chip { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); color: #f4f1ec; }

/* ---------- Calendar ---------- */

.calendar { display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center; }
.cal-day {
  width: 104px; padding: 0.75rem 0.5rem; text-align: center;
  background: var(--card); border: 1px solid var(--border); border-radius: 10px;
}
.cal-day.is-highlight { background: var(--primary); border-color: var(--primary); color: #fff; }
.cal-day.is-rest { background: var(--secondary); }
.cal-dow { font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.7; }
.cal-num { font-size: 1.5rem; font-weight: 700; line-height: 1.2; }
.cal-theme { font-size: 0.66rem; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.85; margin-top: 0.15rem; }

.legend { display: flex; flex-wrap: wrap; gap: 1.1rem; justify-content: center; margin-top: 1.4rem; font-size: 0.78rem; color: var(--muted); }
.legend span { display: inline-flex; align-items: center; gap: 0.4rem; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

/* ---------- Day page ---------- */

.day { margin-bottom: 3.4rem; padding-top: 2.4rem; border-top: 1px solid var(--border); }
.day:first-of-type { border-top: none; padding-top: 0; }
.day-hero { aspect-ratio: 21 / 8; border-radius: var(--radius); overflow: hidden; background: var(--secondary); margin-bottom: 1.8rem; }
.day-hero img { width: 100%; height: 100%; object-fit: cover; }
.day-hero-fallback { width: 100%; height: 100%; background: linear-gradient(135deg, var(--primary-pale) 0%, #c9d3cc 100%); }
.day-head { margin-bottom: 2rem; }
.day-title {
  margin: 0 0 0.9rem;
  font-family: var(--serif);
  font-size: clamp(2rem, 4.6vw, 3.1rem);
  font-weight: 400; line-height: 1.12; letter-spacing: -0.015em;
}
.day-sub { margin: 0; color: var(--muted); font-size: 1.02rem; max-width: 640px; }
.day-body > .chips { margin-bottom: 1.2rem; }

.day-columns { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 2.4rem; align-items: start; }

.block-title {
  display: flex; align-items: center; gap: 0.5rem;
  margin: 2rem 0 0.9rem;
  font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase;
  font-weight: 500; color: var(--primary);
}
.block-title svg { width: 1rem; height: 1rem; color: var(--primary); }

/* ---------- Timeline ---------- */

.timeline { list-style: none; margin: 0; padding: 0 0 0 1.6rem; border-left: 1px solid var(--border); }
.tl-step { position: relative; padding-bottom: 1.6rem; }
.tl-step:last-child { padding-bottom: 0.4rem; }
.tl-step::before {
  content: ""; position: absolute; left: calc(-1.6rem - 6px); top: 0.3rem;
  width: 11px; height: 11px; border-radius: 50%; background: var(--primary);
}
.tl-time { font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.35rem; }
.tl-label { margin: 0 0 0.4rem; font-family: var(--serif); font-size: 1.45rem; font-weight: 400; line-height: 1.2; }
.tl-detail { margin: 0; color: var(--muted); font-size: 0.95rem; max-width: 520px; }

/* ---------- Tables of the day ---------- */

.tables { background: var(--primary-pale); padding: 1.6rem 1.5rem 1.2rem; border-radius: 4px; }
.tables .kicker { margin-bottom: 0.6rem; }
.tables-title { margin: 0 0 1.2rem; font-family: var(--serif); font-size: 1.55rem; font-weight: 400; line-height: 1.15; }
.table-row { display: flex; gap: 0.8rem; padding: 0.85rem 0; border-top: 1px solid rgba(34, 56, 74, 0.14); }
.table-thumb { flex: none; width: 56px; height: 56px; border-radius: 6px; overflow: hidden; background: var(--secondary); }
.table-thumb img { width: 100%; height: 100%; object-fit: cover; }
.table-body { min-width: 0; }
.table-meal { font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
.table-name { font-size: 1rem; font-weight: 500; margin: 0.15rem 0; }
.table-name a { text-decoration: none; }
.table-name a:hover { text-decoration: underline; }
.table-rating { font-size: 0.78rem; color: var(--primary); margin-left: 0.45rem; font-weight: 500; }
.table-meta { font-size: 0.86rem; color: var(--muted); }
.table-links { margin-top: 0.3rem; font-size: 0.8rem; }
.table-links a { color: var(--primary-dark); }

/* ---------- Folds: alternatives and plan B ---------- */

.fold { border-top: 1px solid var(--border); margin-top: 1.6rem; }
.fold summary { cursor: pointer; padding: 1rem 0; font-size: 1.02rem; color: var(--ink); list-style: none; display: flex; align-items: center; gap: 0.6rem; }
.fold summary::-webkit-details-marker { display: none; }
.fold summary::before {
  content: ""; width: 0; height: 0; flex: none;
  border-left: 7px solid var(--ink); border-top: 5px solid transparent; border-bottom: 5px solid transparent;
  transition: transform 0.15s ease;
}
.fold[open] summary::before { transform: rotate(90deg); }
.fold-body { padding: 0.2rem 0 1.4rem; }
.fold-body .backup { margin-top: 0; }

/* ---------- Free visits ---------- */

.free-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 0.9rem; }
.free-card { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--primary-pale); }
.free-thumb { aspect-ratio: 4 / 3; background: var(--secondary); }
.free-thumb img { width: 100%; height: 100%; object-fit: cover; }
.free-thumb-fallback { width: 100%; height: 100%; background: linear-gradient(135deg, #cfdfd5, #a8c4b4); }
.free-body { padding: 0.75rem 0.85rem 0.9rem; }
.free-name { font-weight: 700; font-size: 0.95rem; margin: 0 0 0.25rem; }
.free-desc { margin: 0 0 0.55rem; font-size: 0.84rem; color: var(--muted); }
.free-meta { display: flex; flex-wrap: wrap; gap: 0.35rem; }

/* ---------- Paid options ---------- */

.option {
  border: 1px solid var(--border); border-radius: 10px;
  overflow: hidden; margin-bottom: 0.9rem; background: var(--card);
  display: grid; grid-template-columns: 190px 1fr;
}
.option-a { background: var(--primary-pale); }
.option-b { background: var(--secondary); }
.option-photo { background: var(--secondary); min-height: 130px; }
.option-photo img { width: 100%; height: 100%; object-fit: cover; }
.option-photo-fallback { width: 100%; height: 100%; background: linear-gradient(135deg, #cfdfd5, #90b0a0); }
.option-body { padding: 0.95rem 1.1rem 1rem; }
.option-label {
  font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase;
  font-weight: 700; color: var(--primary-dark);
}
.option-title { margin: 0.15rem 0 0.35rem; font-size: 1.05rem; font-weight: 700; }
.option-desc { margin: 0 0 0.65rem; font-size: 0.88rem; color: var(--muted); }

.btn-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
.btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: var(--primary); color: #fff; text-decoration: none;
  border-radius: 999px; padding: 0.45rem 1rem;
  font-size: 0.82rem; font-weight: 600;
}
.btn-ghost { background: var(--card); color: var(--ink); border: 1px solid var(--border); }
.btn svg { width: 0.85rem; height: 0.85rem; }

/* ---------- Cheaper booking ---------- */

.reseller-note {
  display: flex; gap: 0.4rem; align-items: flex-start; margin: 0.7rem 0 0.3rem;
  padding: 0.5rem 0.7rem; border-radius: 10px; background: var(--secondary);
  border: 1px dashed var(--border); font-size: 0.8rem; color: var(--muted); line-height: 1.4;
}
.reseller-note svg { flex: none; width: 15px; height: 15px; margin-top: 2px; }
.saving {
  background: var(--primary-pale);
  border: 1px dashed rgba(120, 161, 137, 0.6);
  border-radius: 10px; padding: 0.7rem 0.9rem; margin-top: 0.75rem;
}
.saving-head {
  display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;
  font-size: 0.74rem; letter-spacing: 0.12em; text-transform: uppercase;
  font-weight: 700; color: var(--primary-dark); margin-bottom: 0.35rem;
}
.saving p { margin: 0.2rem 0 0; font-size: 0.87rem; color: var(--muted); }
.saving-forum { display: flex; align-items: flex-start; gap: 0.4rem; font-style: italic; }
.saving-forum svg { margin-top: 0.25em; }

.ladder { list-style: none; margin: 0 0 1.4rem; padding: 0; counter-reset: ladder; }
.ladder li {
  display: flex; align-items: flex-start; gap: 0.8rem;
  background: var(--card); border: 1px solid var(--border);
  border-radius: 10px; padding: 0.8rem 1rem; margin-bottom: 0.55rem;
  font-size: 0.92rem;
}
.ladder-step {
  flex: none; width: 1.6rem; height: 1.6rem; border-radius: 50%;
  background: var(--primary); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.82rem; font-weight: 700;
}

/* ---------- Restaurants ---------- */

.resto-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; }
.resto { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--card); }
.band-deep .resto { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.16); }
.resto-photo { aspect-ratio: 3 / 2; background: var(--secondary); }
.resto-photo img { width: 100%; height: 100%; object-fit: cover; }
.resto-photo-fallback { width: 100%; height: 100%; background: linear-gradient(135deg, #e3d6c9, #c9b8a6); }
.resto-body { padding: 0.85rem 0.95rem 1rem; }
.resto-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
.resto-name { margin: 0; font-size: 1rem; font-weight: 700; }
.resto-price { font-weight: 700; color: var(--primary-dark); font-size: 0.9rem; }
.band-deep .resto-price { color: var(--primary); }
.resto-cuisine { font-size: 0.74rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 0.15rem 0 0.5rem; }
.resto-why { margin: 0 0 0.6rem; font-size: 0.86rem; color: var(--muted); }

/* ---------- Map ---------- */

.trip-map {
  height: 460px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
  background: var(--secondary);
}
.map-static { width: 100%; height: 100%; object-fit: cover; display: block; }
.map-print { display: none; }
.map-fallback {
  margin: 0; padding: 2rem; text-align: center; color: var(--muted); font-size: 0.9rem;
}
.map-legend { justify-content: center; margin-top: 1rem; }
.map-legend .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 0.4rem; }
.leaflet-container, .mapboxgl-map { font: inherit; }
.map-marker {
  width: 24px; height: 24px; border-radius: 50%; border: 2px solid #fff;
  color: #fff; font-size: 0.72rem; font-weight: 700; line-height: 20px; text-align: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25); cursor: pointer;
}
.map-marker-food {
  width: 20px; height: 20px; line-height: 16px; font-size: 0.62rem; background: #fff !important;
}
.mapboxgl-popup-content { border-radius: 10px; padding: 0.6rem 0.8rem; font-size: 0.85rem; }

@media print {
  /* The WebGL canvas prints blank: paper gets the still picture. */
  .trip-map { display: none; }
  .map-print { display: block; border-radius: var(--radius); overflow: hidden; border: 1px solid var(--border); }
  .map-print .map-static { height: auto; }
}

/* ---------- Airport transfers ---------- */

.transfer {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 10px; padding: 0.85rem 1.05rem; margin-bottom: 0.7rem;
}
.transfer-head { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.45rem; }
.transfer-head strong { font-size: 1rem; }

/* ---------- Car rental ---------- */

.car-option {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 10px; padding: 1rem 1.15rem; margin-bottom: 0.8rem;
}
.car-option.is-recommended { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary) inset; }
.car-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.5rem; }
.car-head h4 { margin: 0; font-size: 1.05rem; font-weight: 700; }
/* The comparator links of a flight between two stages: a chip the traveler
   taps, so it has to read as clickable next to the plain informative ones. */
.chip-link { color: var(--primary); text-decoration: none; font-weight: 600; }
.chip-link:hover { text-decoration: underline; }
.route-flight { margin-top: -0.4rem; }
.chip-warn { background: #f4e3d7; border-color: #dbbfa6; color: #7a4a22; }

.chip-warn svg { color: #7a4a22; }

.alert {
  background: var(--card); border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  border-radius: 10px; padding: 0.95rem 1.15rem; margin-bottom: 1.1rem;
}
.alert-title {
  display: flex; align-items: center; gap: 0.5rem;
  font-weight: 700; font-size: 0.95rem; margin-bottom: 0.35rem;
}
.alert p { margin: 0; font-size: 0.9rem; color: var(--muted); }
.alert ul { margin: 0.4rem 0 0; padding-left: 1.1rem; font-size: 0.89rem; color: var(--muted); }
.alert li { margin-bottom: 0.35rem; }
.alert-card { border-left-color: #c98a4b; }
.alert-card .alert-title svg { color: #c98a4b; }

/* ---------- Info cards ---------- */

.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.info-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.1rem 1.2rem;
}
.band-deep .info-card { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.16); }
.info-card h4 { margin: 0 0 0.5rem; font-size: 0.95rem; }
.info-card ul { margin: 0; padding-left: 1.1rem; font-size: 0.88rem; color: var(--muted); }
.band-deep .info-card ul { color: rgba(244, 241, 236, 0.78); }
.info-card li { margin-bottom: 0.3rem; }

.tips { background: var(--primary-pale); border-radius: 10px; padding: 0.9rem 1.1rem; margin-top: 1.4rem; }
.tips ul { margin: 0; padding-left: 1.1rem; font-size: 0.86rem; color: var(--muted); }
.backup { margin-top: 0.9rem; font-size: 0.86rem; color: var(--muted); }
.backup strong { color: var(--ink); }

/* ---------- Budget page ---------- */

.budget-amount { font-family: var(--serif); font-size: clamp(3rem, 7vw, 4.6rem); line-height: 1; letter-spacing: -0.02em; margin-top: 0.4rem; }
.budget-amount-label { margin: 0.5rem 0 2.6rem; color: var(--muted); font-size: 0.9rem; }
.budget-table { border-top: 1px solid var(--border); }
.budget-row {
  display: flex; justify-content: space-between; gap: 1rem;
  padding: 1rem 0; border-bottom: 1px solid var(--border); font-size: 1.02rem;
}
.budget-row span:last-child { white-space: nowrap; }
.budget-total { color: var(--primary); }
.transfer .budget-row, .car-option .budget-row { padding: 0.6rem 0; font-size: 0.92rem; border-bottom: 1px dashed var(--border); }
.callout {
  margin-top: 2rem; padding: 1.2rem 1.4rem;
  background: var(--primary-pale); border-left: 3px solid var(--primary);
}
.callout p { margin: 0; font-size: 0.98rem; color: var(--ink); }
.callout p + p { margin-top: 0.3rem; color: var(--muted); }
.callout-title { font-weight: 500; }
.footnote { margin: 1.6rem 0 0; font-size: 0.86rem; color: var(--muted); }

.credit { font-size: 0.68rem; color: var(--muted); padding: 0.35rem 0.85rem 0; }
.band-deep .credit { color: rgba(244, 241, 236, 0.55); }

.credits-provider { text-align: center; margin: 0 0 1rem; font-size: 0.9rem; }
.credits-provider a { color: var(--primary); font-weight: 600; }
.credits-list {
  list-style: none; margin: 0; padding: 0; columns: 3; column-gap: 1.5rem; font-size: 0.78rem; color: var(--muted);
}
.credits-list li { break-inside: avoid; margin-bottom: 0.3rem; }
.credits-list a { color: var(--ink); }
.credit-license { opacity: 0.75; }
@media (max-width: 700px) { .credits-list { columns: 1; } }
.footer { background: var(--ink); color: rgba(244, 241, 236, 0.7); padding: 2.4rem 1.5rem; text-align: center; font-size: 0.82rem; }
.footer strong { color: #f4f1ec; }

/* ---------- Print toolbar ---------- */

.toolbar {
  position: fixed; bottom: 1.2rem; right: 1.2rem; z-index: 50;
  display: flex; gap: 0.6rem;
}
.toolbar .btn { box-shadow: 0 8px 22px rgba(51, 77, 62, 0.28); padding: 0.6rem 1.2rem; }

@media (max-width: 760px) { .day-columns { grid-template-columns: 1fr; gap: 1.6rem; } }
/* The overview table of the roadbook: the page the traveler comes back to. */
.stages { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.stages th {
  text-align: left; padding: 0.55rem 0.6rem; border-bottom: 2px solid var(--border);
  font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); font-weight: 600;
}
.stages td { padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--border); vertical-align: top; }
.stages tr:last-child td { border-bottom: none; }
.stages td:nth-child(3), .stages th:nth-child(3) { text-align: center; }
.stages td:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }

/* The drive of the day, above the timeline. */
.route { margin: 0 0 1rem; padding: 0.8rem 1rem; border-left: 3px solid var(--primary); background: var(--secondary); border-radius: 0 var(--radius) var(--radius) 0; }

/* The bed at the end of the day. A hotel change is what the eye must catch. */
.lodging {
  display: grid; grid-template-columns: 150px 1fr; gap: 1rem; margin-top: 1.4rem;
  border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); overflow: hidden;
}
.lodging-change { border-color: var(--primary); box-shadow: inset 4px 0 0 var(--primary); }
.lodging-photo { height: 100%; min-height: 120px; }
.lodging-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lodging-body { padding: 0.9rem 1rem 1rem 0.2rem; }
.lodging-change .lodging-body .kicker { color: var(--primary); }
.lodging .btn-row { margin-top: 0.6rem; }

@media (max-width: 640px) {
  .lodging { grid-template-columns: 1fr; }
  .lodging-body { padding: 0 1rem 1rem; }
  .stages { font-size: 0.82rem; }
}

@media (max-width: 640px) {
  .band { padding: 3rem 1.1rem; }
  .option { grid-template-columns: 1fr; }
  .option-photo { aspect-ratio: 16 / 9; }
  .stats { gap: 1.6rem; }
}

@media print {
  .toolbar { display: none; }
  body { background: #fff; }
  .band { padding: 1.6rem 0; }
  .band-deep { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .free-card, .option, .resto, .info-card, .tables, .lodging, .route { break-inside: avoid; page-break-inside: avoid; }
  .stages tr { break-inside: avoid; }
  .day { break-before: page; }
  .fold[open] summary::before { transform: rotate(90deg); }
  .fold { break-inside: auto; }
  @page { size: A4; margin: 12mm; }
}
`;

// Inline SVG rather than emoji: the site itself uses SVG icons, and emoji
// render inconsistently once the guide is printed to PDF.
const ICON_PATHS: Record<string, string> = {
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ticket: '<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 6 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-6Z"/><path d="M13 7v10"/>',
  gift: '<path d="M4 11h16v9H4z"/><path d="M2 7h20v4H2z"/><path d="M12 7v13"/><path d="M12 7S9.5 3 7.5 4.5 9 7 12 7Zm0 0s2.5-4 4.5-2.5S15 7 12 7Z"/>',
  map: '<path d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6l5-2Z"/><path d="M9 4v14M15 6v14"/>',
  fork: '<path d="M7 3v7a2 2 0 0 0 4 0V3"/><path d="M9 10v11"/><path d="M17 3c-1.5 1-2 3-2 5s.5 3 2 3v10"/>',
  landmark: '<path d="M4 21h16"/><path d="M5 21V10M9.5 21V10M14.5 21V10M19 21V10"/><path d="m3 10 9-6 9 6Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  bed: '<path d="M3 18V7"/><path d="M3 12h18v6"/><path d="M7 12V9h6a4 4 0 0 1 4 3"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7H5a2 2 0 0 1-2-2Z"/><circle cx="17" cy="14" r="1"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  boat: '<path d="M3 17s2 2 4.5 2 4-2 4.5-2 2 2 4.5 2 4-2 4.5-2"/><path d="M5 14 12 4l7 10"/><path d="M12 4v10"/>',
  plane: '<path d="M10 3 4 12l2 3 5-2 3 6 2-1-1-7 5-2-1-3-6 1-3-4Z"/>',
  walk: '<circle cx="13" cy="4" r="1.6"/><path d="m9 21 3-6-2-3 1-4 3 2 3 1"/><path d="m11 12-3 2"/>',
  car: '<path d="M5 17h14"/><path d="M3 17v-4l2-5h14l2 5v4"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>',
  download: '<path d="M12 3v12"/><path d="m7 12 5 5 5-5"/><path d="M4 21h16"/>',
  print: '<path d="M6 9V3h12v6"/><path d="M6 18H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-2"/><path d="M6 14h12v7H6z"/>'
};

export function icon(name: keyof typeof ICON_PATHS | string): string {
  const path = ICON_PATHS[name] ?? ICON_PATHS.check;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/**
 * The wait animation while a trip is being planned: a small plane crossing a
 * strip of sky along a dotted flight path, clouds drifting the other way.
 * Pure CSS motion, SVG only — no emoji, per the design charter.
 */
export default function PlaneLoader() {
  return (
    <div className="plane-loader" aria-hidden="true">
      <svg className="plane-sky" viewBox="0 0 320 100" preserveAspectRatio="none">
        <path className="plane-path" d="M10 72 C 100 18, 200 92, 310 34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" strokeLinecap="round" />
      </svg>
      <span className="plane-cloud plane-cloud-a" />
      <span className="plane-cloud plane-cloud-b" />
      <span className="plane-cloud plane-cloud-c" />
      <svg className="plane" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" />
      </svg>
    </div>
  );
}

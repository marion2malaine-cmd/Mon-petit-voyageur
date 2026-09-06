import { legalDocs, type LegalDoc } from "./legalContent";

interface LegalPageProps {
  active: LegalDoc["key"];
  onSelect: (key: LegalDoc["key"]) => void;
  onBack: () => void;
  backLabel: string;
}

function renderBody(body: string[]) {
  const blocks: JSX.Element[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="legal-list">
        {bullets.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  for (const line of body) {
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
      continue;
    }
    flush();
    blocks.push(<p key={`p-${blocks.length}`}>{line}</p>);
  }
  flush();
  return blocks;
}

export function LegalPage({ active, onSelect, onBack, backLabel }: LegalPageProps) {
  const doc = legalDocs.find((d) => d.key === active) ?? legalDocs[0];

  return (
    <main className="layout legal-page">
      <div className="card legal-card">
        <nav className="legal-tabs">
          {legalDocs.map((d) => (
            <button
              key={d.key}
              type="button"
              className={`ghost${d.key === doc.key ? " is-active" : ""}`}
              onClick={() => onSelect(d.key)}
            >
              {d.label}
            </button>
          ))}
          <button type="button" className="secondary legal-back" onClick={onBack}>
            {backLabel}
          </button>
        </nav>

        <article className="legal-doc">
          <h1>{doc.title}</h1>
          <p className="legal-updated">Dernière mise à jour : {doc.updated}</p>
          {doc.intro.map((line, i) => (
            <p key={i} className="legal-intro">
              {line}
            </p>
          ))}
          {doc.sections.map((section) => (
            <section key={section.title} className="legal-section">
              <h2>{section.title}</h2>
              {renderBody(section.body)}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}

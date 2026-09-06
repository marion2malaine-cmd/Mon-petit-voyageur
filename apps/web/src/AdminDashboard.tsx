import { useMemo, useState } from "react";
import "./admin.css";

type IconName = "grid" | "users" | "card" | "mouse" | "chart" | "route" | "file" | "settings" | "bell" | "search" | "down" | "up" | "more" | "external" | "check" | "alert" | "clock" | "download";

const paths: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></>,
  mouse: <><rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/></>,
  chart: <><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/></>,
  route: <><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M8.6 17.5 16 6.5M9 5h3M9 9h5"/></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.17.37.38.7.6 1 .27.34.65.54 1.1.6h.1v4h-.1a1.7 1.7 0 0 0-1.7.4z"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  down: <path d="m6 9 6 6 6-6"/>, up: <path d="m18 15-6-6-6 6"/>, more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>, external: <><path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>,
  check: <path d="m20 6-11 11-5-5"/>, alert: <><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/></>
};
function Icon({ name, size = 18 }: { name: IconName; size?: number }) { return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>; }

const nav = [
  ["Vue d’ensemble", "grid"], ["Utilisateurs", "users"], ["Abonnements", "card"], ["Clics & trafic", "mouse"], ["Revenus", "chart"], ["Voyages", "route"], ["Contenu", "file"]
] as const;
const users = [
  { initials:"SD", name:"Sophie Dubois", email:"sophie.dubois@gmail.com", plan:"Premium", color:"lavender", state:"Actif", date:"05 sept. 2026", amount:"19,90 €" },
  { initials:"TM", name:"Thomas Martin", email:"thomas.martin@icloud.com", plan:"Essentiel", color:"blue", state:"Actif", date:"04 sept. 2026", amount:"9,90 €" },
  { initials:"EC", name:"Emma Chen", email:"emma.chen@outlook.fr", plan:"Premium", color:"lavender", state:"Essai", date:"04 sept. 2026", amount:"0,00 €" },
  { initials:"LH", name:"Lucas Hernandez", email:"lucas.h@gmail.com", plan:"Essentiel", color:"blue", state:"Annulé", date:"03 sept. 2026", amount:"9,90 €" },
  { initials:"CM", name:"Camille Moreau", email:"camille.moreau@gmail.com", plan:"Premium", color:"lavender", state:"Actif", date:"02 sept. 2026", amount:"19,90 €" }
];
const bars = [34,45,40,56,48,65,60,72,69,82,77,88,80,91,86,96,89,100,95,105,96,112,106,118,111,124,120,132,128,142];

export default function AdminDashboard() {
  const [active, setActive] = useState("Vue d’ensemble");
  const [period, setPeriod] = useState("30 derniers jours");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const filtered = useMemo(() => users.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return <div className="admin-root">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/" aria-label="Retour au site"><span className="brand-mark">M</span><span><strong>Mon Petit</strong><small>VOYAGEUR · ADMIN</small></span></a>
      <nav className="admin-nav" aria-label="Navigation principale">
        <p>GESTION</p>
        {nav.map(([label, icon]) => <button key={label} className={active===label?"active":""} onClick={()=>setActive(label)}><Icon name={icon}/><span>{label}</span>{label==="Abonnements"&&<b>24</b>}</button>)}
        <p>SYSTÈME</p>
        <button><Icon name="settings"/><span>Paramètres</span></button>
      </nav>
      <div className="admin-profile"><span>MD</span><div><strong>Marion Demalaine</strong><small>Administratrice</small></div><Icon name="more"/></div>
    </aside>

    <main className="admin-main">
      <header className="admin-topbar">
        <div className="admin-search"><Icon name="search"/><input aria-label="Rechercher" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un utilisateur, un voyage..."/><kbd>⌘ K</kbd></div>
        <div className="top-actions"><button className="icon-button" aria-label="Notifications"><Icon name="bell"/><i/></button><span className="live-dot"/> <small>Données actualisées</small></div>
      </header>

      <div className="admin-content">
        <div className="page-heading"><div><p className="eyebrow-admin">TABLEAU DE BORD</p><h1>Bonjour Marion <span>👋</span></h1><p>Voici ce qui se passe sur Mon Petit Voyageur aujourd’hui.</p></div><div className="heading-actions"><select value={period} onChange={e=>setPeriod(e.target.value)} aria-label="Période"><option>7 derniers jours</option><option>30 derniers jours</option><option>Cette année</option></select><button className="export"><Icon name="download"/>Exporter</button></div></div>

        <section className="metric-grid" aria-label="Indicateurs clés">
          <Metric icon="users" label="UTILISATEURS ACTIFS" value="2 847" trend="+12,5 %" note="vs période précédente" tone="green" spark={[8,10,9,13,12,15,14,18]}/>
          <Metric icon="card" label="ABONNEMENTS ACTIFS" value="1 294" trend="+8,2 %" note="24 nouveaux aujourd’hui" tone="purple" spark={[8,7,10,9,13,12,16,18]}/>
          <Metric icon="mouse" label="CLICS TOTAUX" value="48 392" trend="+18,7 %" note="1 847 aujourd’hui" tone="blue" spark={[7,11,9,15,12,17,16,21]}/>
          <Metric icon="chart" label="REVENU MENSUEL" value="18 642 €" trend="+14,3 %" note="Objectif : 22 000 €" tone="orange" spark={[5,8,7,12,11,15,14,19]}/>
        </section>

        <section className="dashboard-grid">
          <article className="panel revenue-panel">
            <div className="panel-head"><div><h2>Revenus</h2><p>Évolution du revenu récurrent mensuel</p></div><div className="legend"><span><i className="purple-dot"/>Cette période</span><span><i/>Période précédente</span></div></div>
            <div className="revenue-summary"><strong>18 642 €</strong><span><Icon name="up" size={13}/>14,3 %</span></div>
            <div className="bar-chart" aria-label="Graphique des revenus sur 30 jours">
              <div className="axis"><span>20k</span><span>15k</span><span>10k</span><span>5k</span><span>0</span></div>
              <div className="bars">{bars.map((b,i)=><div key={i} className={i===bars.length-1?"current":""}><i style={{height:`${Math.max(17,b*.58)}px`}}/><b style={{height:`${Math.max(10,b*.42)}px`}}/></div>)}</div>
              <div className="dates"><span>7 août</span><span>14 août</span><span>21 août</span><span>28 août</span><span>5 sept.</span></div>
            </div>
          </article>

          <article className="panel plans-panel"><div className="panel-head"><div><h2>Répartition des offres</h2><p>1 294 abonnements actifs</p></div><button aria-label="Plus d’options"><Icon name="more"/></button></div>
            <div className="donut-wrap"><div className="donut"><span><strong>1 294</strong><small>abonnés</small></span></div>
              <div className="plan-legend"><div><i className="premium"/><span><strong>Premium</strong><small>19,90 € / mois</small></span><b>62 %</b></div><div><i className="essential"/><span><strong>Essentiel</strong><small>9,90 € / mois</small></span><b>31 %</b></div><div><i className="trial"/><span><strong>Essai gratuit</strong><small>7 jours</small></span><b>7 %</b></div></div></div>
            <button className="text-button" onClick={()=>setActive("Abonnements")}>Voir tous les abonnements <span>→</span></button>
          </article>
        </section>

        <section className="dashboard-grid lower-grid">
          <article className="panel activity-panel"><div className="panel-head"><div><h2>Activité des clics</h2><p>Les pages et actions les plus consultées</p></div><button className="text-link" onClick={()=>setActive("Clics & trafic")}>Rapport complet <Icon name="external" size={14}/></button></div>
            {[["Création d’un voyage","/creer-mon-voyage","12 847","26,5%"],["Page des offres","/tarifs","9 326","19,3%"],["Génération du guide","/mon-voyage/guide","7 184","14,8%"],["Lien partenaire — Booking","booking.com","5 921","12,2%"],["Téléchargement du guide","action:download","4 216","8,7%"]].map((r,i)=><div className="activity-row" key={r[0]}><span className={`rank rank-${i+1}`}>{i+1}</span><span><strong>{r[0]}</strong><small>{r[1]}</small></span><div><b>{r[2]}</b><small>{r[3]}</small></div><div className="mini-progress"><i style={{width:r[3]}}/></div></div>)}
          </article>

          <article className="panel alerts-panel"><div className="panel-head"><div><h2>À surveiller</h2><p>Actions recommandées</p></div><span className="alert-count">3</span></div>
            <Alert icon="alert" tone="red" title="3 paiements échoués" body="Relance automatique prévue demain" action="Consulter"/>
            <Alert icon="clock" tone="orange" title="8 essais expirent bientôt" body="Dans les prochaines 48 heures" action="Voir les clients"/>
            <Alert icon="check" tone="green" title="Tous les services opérationnels" body="Dernière vérification il y a 2 min"/>
            <button className="text-button">Centre de notifications <span>→</span></button>
          </article>
        </section>

        <section className="panel users-panel"><div className="panel-head"><div><h2>Derniers utilisateurs</h2><p>Les inscriptions et abonnements les plus récents</p></div><button className="text-link" onClick={()=>setShowAll(!showAll)}>{showAll?"Réduire":"Voir tous les utilisateurs"} <span>→</span></button></div>
          <div className="table-wrap"><table><thead><tr><th>UTILISATEUR</th><th>OFFRE</th><th>STATUT</th><th>DATE D’INSCRIPTION</th><th>REVENU</th><th/></tr></thead><tbody>{filtered.slice(0,showAll?filtered.length:5).map(u=><tr key={u.email}><td><span className={`avatar ${u.color}`}>{u.initials}</span><span><strong>{u.name}</strong><small>{u.email}</small></span></td><td><span className={`plan-badge ${u.color}`}>{u.plan}</span></td><td><span className={`status ${u.state.toLowerCase()}`}><i/>{u.state}</span></td><td>{u.date}</td><td><strong>{u.amount}</strong></td><td><button aria-label={`Actions pour ${u.name}`}><Icon name="more"/></button></td></tr>)}</tbody></table>{filtered.length===0&&<div className="empty-state">Aucun utilisateur ne correspond à « {query} ».</div>}</div>
        </section>
        <footer className="admin-footer"><span>Mon Petit Voyageur · Administration</span><span>Mode démonstration · Connectez Stripe et votre outil analytics pour alimenter ces indicateurs en temps réel.</span></footer>
      </div>
    </main>
  </div>;
}

function Metric({icon,label,value,trend,note,tone,spark}:{icon:IconName;label:string;value:string;trend:string;note:string;tone:string;spark:number[]}) {
  const points=spark.map((v,i)=>`${i*(84/(spark.length-1))},${27-v}`).join(" ");
  return <article className={`metric-card ${tone}`}><div className="metric-top"><span><Icon name={icon}/></span><button aria-label="Plus d’options"><Icon name="more"/></button></div><p>{label}</p><div className="metric-value"><strong>{value}</strong><svg viewBox="0 0 84 28"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"/><polyline points={`0,28 ${points} 84,28`} fill="currentColor" opacity=".08"/></svg></div><div className="metric-foot"><span><Icon name="up" size={12}/>{trend}</span><small>{note}</small></div></article>
}
function Alert({icon,tone,title,body,action}:{icon:IconName;tone:string;title:string;body:string;action?:string}) { return <div className="alert-row"><span className={`alert-icon ${tone}`}><Icon name={icon}/></span><span><strong>{title}</strong><small>{body}</small></span>{action&&<button>{action}</button>}</div> }

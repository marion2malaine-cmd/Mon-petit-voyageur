// Cluster : budgets · Intention principale : « budget voyage » (informationnelle,
// forte valeur GEO). Aucun chiffre inventé : la page explique une méthode et la
// façon dont l'application applique le budget, pas des moyennes de dépenses.
export default {
  slug: "budget-voyage",
  navLabel: "Budget voyage",
  schemaType: "Article",
  cluster: "budgets",
  intent: "budget voyage",
  secondaryKeywords: ["calculer budget voyage", "répartir budget vacances", "voyage dans le budget", "prévoir budget voyage"],
  datePublished: "2026-09-08",
  dateModified: "2026-09-08",
  title: "Budget voyage : fixer son enveloppe et la répartir en 5 étapes | Mon Petit Voyageur",
  description:
    "Combien prévoir et dans quel ordre dépenser ? La méthode « budget d'abord » en 5 étapes, les postes qu'on oublie (voiture, visa, change) et les outils pour rester dans l'enveloppe.",
  h1: "Budget voyage : comment fixer et répartir votre enveloppe",
  lead:
    "Le budget se décide avant la destination, pas après. Voici la méthode « budget d'abord » que suit Mon Petit Voyageur, et comment l'appliquer même sans l'application.",
  related: ["planificateur-voyage-ia", "planificateur-road-trip-ia", "organiser-un-voyage-avec-l-ia"],
  howTo: {
    name: "La méthode en cinq étapes",
    description: "Fixer un budget voyage et le répartir sans dépasser : billets d'abord, hébergement ensuite, puis le reste pour vivre sur place.",
    steps: [
      { name: "Fixez l'enveloppe totale", text: "Transport compris, pour tous les voyageurs. C'est le seul chiffre à décider ; le reste en découle." },
      { name: "Les billets d'abord", text: "Le transport est le poste le plus rigide : une fois les vols choisis, le budget restant est connu. Si vos dates sont flexibles, comparez le mois entier." },
      { name: "L'hébergement ensuite", text: "Dans ce qui reste, en tenant compte du nombre de nuits et de la zone : dormir près des visites économise des transports." },
      { name: "Le reste pour vivre sur place", text: "Activités, restaurants, transports locaux. Répartissez cette somme par jour pour savoir ce que vous pouvez vous permettre chaque journée." },
      { name: "Gardez une marge", text: "Pour les imprévus et les postes oubliés : voiture de location et caution, formalités, change, transports locaux." }
    ]
  },
  ctaTitle: "Un voyage qui tient dans votre budget",
  ctaText: "Indiquez votre enveloppe totale dans le questionnaire : vols, hôtels, activités et restaurants sont choisis pour y rester, avec des prix en direct.",
  body: `
<div class="summary"><p><strong>En bref :</strong> fixez une enveloppe totale, réglez d'abord les deux gros postes fixes (billets puis hébergement), et consacrez ce qui reste aux activités et aux restaurants. Vérifiez chaque prix sur une source en direct plutôt que sur une estimation, et n'oubliez pas les postes invisibles : voiture de location et caution, formalités, change, transports locaux.</p></div>

<h2>Pourquoi fixer le budget avant la destination</h2>
<p>Choisir la destination d'abord, puis découvrir ce qu'elle coûte, conduit presque toujours à dépasser. À l'inverse, partir d'une enveloppe permet de comparer des destinations à prix égal, de choisir la bonne période et de garder de la marge pour les imprévus. C'est le principe de Mon Petit Voyageur : le budget total est la première question du questionnaire, et tout le plan est construit pour y tenir.</p>

<h2>La méthode en cinq étapes</h2>
<ol>
<li><strong>Fixez l'enveloppe totale</strong>, transport compris, pour tous les voyageurs. C'est le seul chiffre à décider ; le reste en découle.</li>
<li><strong>Les billets d'abord.</strong> Le transport est le poste le plus rigide : une fois les vols choisis, le budget restant est connu. Si vos dates sont flexibles, comparez le mois entier : la différence entre le jour le moins cher et le plus cher peut représenter une part importante de l'enveloppe.</li>
<li><strong>L'hébergement ensuite</strong>, dans ce qui reste, en tenant compte du nombre de nuits et de la zone (dormir près des visites économise des transports).</li>
<li><strong>Le reste pour vivre sur place :</strong> activités, restaurants, transports locaux. Répartissez cette somme par jour pour savoir ce que vous pouvez vous permettre chaque journée.</li>
<li><strong>Gardez une marge</strong> pour les imprévus et les postes oubliés listés ci-dessous.</li>
</ol>

<h2>Les postes qu'on oublie</h2>
<div class="table-wrap"><table>
<thead><tr><th>Poste</th><th>Pourquoi il surprend</th><th>Ce que fait l'application</th></tr></thead>
<tbody>
<tr><td>Voiture de location</td><td>La caution bloquée, l'assurance imposée sans vraie carte de crédit, le carburant.</td><td>Propose la catégorie la moins chère adaptée au groupe et signale ces pièges.</td></tr>
<tr><td>Formalités d'entrée</td><td>Visa, autorisation électronique, passeport à renouveler.</td><td>Les conditions d'entrée sont vérifiées et rappelées dans le plan.</td></tr>
<tr><td>Change et frais bancaires</td><td>Le taux réel diffère du taux affiché, et chaque paiement peut porter des frais.</td><td>Le taux de change du jour est intégré au plan (hors frais bancaires).</td></tr>
<tr><td>Transports locaux</td><td>Navettes d'aéroport, métro, taxis entre les étapes.</td><td>Conseils de transport et informations de transports en commun quand elles sont disponibles.</td></tr>
<tr><td>Activités</td><td>Les billets « incontournables » s'additionnent vite.</td><td>Trois options par jour comparées à l'enveloppe activités, avec la voie la moins chère (agence locale, kiosque, site officiel).</td></tr>
</tbody></table></div>

<h2>Comment l'application applique votre budget</h2>
<ul>
<li><strong>Billets d'abord, puis l'IA organise dans ce qui reste :</strong> le budget restant (budget moins vols moins hébergement) est transmis à l'itinéraire, qui en déduit les gammes de prix des restaurants et l'enveloppe activités. Si les billets absorbent l'essentiel, le plan vous en avertit.</li>
<li><strong>Badges « dans le budget » / « au-dessus du budget »</strong> sur les vols, les hôtels et les activités, pour voir d'un coup d'œil ce qui dépasse.</li>
<li><strong>Prix en direct :</strong> vols sur Google Flights, hôtels sur Google Hotels, activités GetYourGuide avec tarif « dès X € » quand une offre réelle correspond. Un prix non confirmé est marqué indicatif.</li>
<li><strong>Visites gratuites chaque jour :</strong> musées, quartiers, panoramas et sites gratuits sont intégrés au programme, ce qui allège la part activités sans appauvrir le voyage.</li>
<li><strong>Restaurants dans votre gamme :</strong> les adresses proposées sont filtrées sur la gamme de prix cohérente avec votre budget.</li>
</ul>

<h2>Économiser sans sacrifier le voyage</h2>
<p>Trois leviers pèsent plus que tous les autres : la date (comparer le mois entier quand c'est possible), la zone d'hébergement (près des visites, pas forcément dans le centre le plus cher) et le mode d'achat des activités (l'agence locale, le kiosque du port ou le site officiel coûtent souvent moins cher que les plateformes, ce que les forums de voyageurs confirment destination par destination). Pour aller plus loin sur la préparation, lisez <a href="/organiser-un-voyage-avec-l-ia">comment organiser un voyage avec l'IA</a> et, pour un voyage itinérant, le <a href="/planificateur-road-trip-ia">planificateur de road trip</a>.</p>
`,
  faq: [
    {
      q: "Quel budget prévoir pour un voyage ?",
      a: "Il n'existe pas de chiffre universel : le coût dépend de la destination, de la période, de la durée, du nombre de voyageurs et du confort attendu. La bonne démarche est d'inverser la question : fixez l'enveloppe que vous pouvez consacrer au voyage, puis choisissez la destination, la période et le niveau de confort qui y tiennent. Mon Petit Voyageur fait ce calcul avec des prix en direct."
    },
    {
      q: "Dans quel ordre répartir son budget ?",
      a: "Billets d'abord, hébergement ensuite, puis le reste pour les activités, les restaurants et les transports locaux, en gardant une marge pour les imprévus."
    },
    {
      q: "Les prix affichés par l'application sont-ils fiables ?",
      a: "Les prix de vols et d'hôtels viennent de recherches en direct sur Google Flights et Google Hotels, conservées en cache jusqu'à 24 heures ; les activités affichent le tarif réel de GetYourGuide quand une offre correspond, sinon un prix indicatif clairement signalé. Le prix final est toujours celui du site de réservation au moment de l'achat."
    },
    {
      q: "Comment économiser sur les activités ?",
      a: "Comparez la voie d'achat : agence locale, kiosque sur place ou site officiel sont souvent moins chers que les plateformes. Le plan indique pour chaque activité la voie la moins chère et l'économie typique relevée sur les forums de voyageurs, et intègre des visites gratuites chaque jour."
    }
  ]
};

// Source unique des documents juridiques du site, en français et en anglais.
// Le composant LegalPage affiche la version correspondant à la langue choisie.
//
// L'identité de l'éditeur est celle de MARA LABS SAS, reprise des mentions
// légales publiées sur toutmonimmo.com. Reste à compléter avant mise en ligne :
// le médiateur de la consommation nommément désigné (obligatoire dès qu'une
// offre payante est ouverte aux consommateurs).

export type LegalLocale = "fr" | "en";

export interface LegalSection {
  title: string;
  // Une entrée par paragraphe. Une entrée commençant par "- " est une puce.
  body: string[];
}

export interface LegalDoc {
  key: "privacy" | "terms" | "sales";
  label: string;
  title: string;
  updated: string;
  intro: string[];
  sections: LegalSection[];
}

const UPDATED_FR = "6 septembre 2026";
const UPDATED_EN = "6 September 2026";

const EDITOR_FR =
  "MARA LABS, société par actions simplifiée, dont le siège est situé 41 rue Jacquemars Giélée, 59800 Lille, France, immatriculée sous le numéro SIREN 104 321 104 (SIRET 104 321 104 00010, RCS Lille Métropole, code NAF 70.10Z), représentée par sa Présidente, Marion Demalaine";

const EDITOR_EN =
  "MARA LABS, a French simplified joint-stock company (société par actions simplifiée) with registered office at 41 rue Jacquemars Giélée, 59800 Lille, France, registered under company number 104 321 104 (SIRET 104 321 104 00010, Lille Métropole Trade and Companies Register, NAF code 70.10Z), represented by its President, Marion Demalaine";

const CONTACT = "contact@monpetitvoyageur.fr";

/* ------------------------------------------------------------------ */
/* Français                                                            */
/* ------------------------------------------------------------------ */

const privacyFr: LegalDoc = {
  key: "privacy",
  label: "Politique de confidentialité",
  title: "Politique de confidentialité",
  updated: UPDATED_FR,
  intro: [
    "Cette politique explique quelles données personnelles Mon Petit Voyageur collecte, pourquoi, combien de temps elles sont conservées, avec qui elles sont partagées et comment exercer vos droits.",
    "Elle s'applique au site monpetitvoyageur.com et à l'application associée. Le responsable de traitement au sens de l'article 4.7 du RGPD est " +
      EDITOR_FR +
      ". Pour toute question relative aux données personnelles : " +
      CONTACT +
      ", objet « Protection des données ».",
    "Un délégué à la protection des données a été désigné : Marion Demalaine, joignable à la même adresse. MARA LABS étant établie en France, aucun représentant dans l'Union européenne au titre de l'article 27 du RGPD n'est requis.",
  ],
  sections: [
    {
      title: "1. Les données que nous collectons",
      body: [
        "Nous ne collectons que les données nécessaires au fonctionnement du service. Aucune donnée bancaire ne transite par nos serveurs.",
        "- Données de compte : votre adresse e-mail et votre mot de passe. Le mot de passe n'est jamais stocké en clair : seule une empreinte chiffrée (bcrypt) est conservée.",
        "- Préférence de langue : français ou anglais.",
        "- Données de voyage que vous saisissez : destination ou envie de destination, dates ou période, nombre de voyageurs, type de voyageurs (par exemple famille, couple, amis), budget, styles de séjour souhaités, aéroport de départ, et le texte libre de votre demande.",
        "- Plans générés : l'itinéraire produit pour vous, les vols, hébergements, activités, restaurants et guides associés, rattachés à votre compte pour que vous les retrouviez.",
        "- Journaux techniques d'exécution : trace des étapes de génération d'un voyage, conservée pour diagnostiquer les erreurs.",
        "- Données de connexion strictement nécessaires à la sécurité du service (adresse IP, horodatage des requêtes) dans les journaux de notre hébergeur.",
        "Nous ne demandons ni votre nom, ni votre adresse postale, ni votre numéro de téléphone, ni de document d'identité. Merci de ne pas saisir de données sensibles (santé, opinions, convictions) dans le champ libre de description du voyage.",
      ],
    },
    {
      title: "2. Pourquoi nous les utilisons et sur quelle base légale",
      body: [
        "- Créer et gérer votre compte, vous authentifier : exécution du contrat qui nous lie (article 6.1.b du RGPD).",
        "- Générer votre programme de voyage, rechercher des vols, hébergements, activités et restaurants correspondant à votre demande : exécution du contrat.",
        "- Conserver vos voyages pour que vous puissiez les consulter à nouveau : exécution du contrat.",
        "- Assurer la sécurité du service, prévenir les abus et les usages automatisés : intérêt légitime.",
        "- Améliorer la qualité du service à partir de données agrégées et anonymes : intérêt légitime.",
        "- Vous envoyer un e-mail relatif à votre compte ou à un voyage que vous avez demandé : exécution du contrat. Toute communication commerciale, s'il en existe un jour, ne vous sera adressée qu'avec votre consentement et pourra être refusée à tout moment.",
      ],
    },
    {
      title: "3. Combien de temps nous les conservons",
      body: [
        "- Compte et voyages associés : tant que votre compte est actif, puis supprimés dans les 30 jours suivant votre demande de suppression.",
        "- Compte resté inactif pendant 3 ans : supprimé après un e-mail de préavis resté sans réponse.",
        "- Journaux techniques d'exécution : 12 mois au maximum.",
        "- Journaux de connexion de l'hébergeur : 12 mois, conformément aux obligations légales de conservation.",
      ],
    },
    {
      title: "4. Qui reçoit vos données",
      body: [
        "Nous ne vendons ni ne louons vos données personnelles. Elles sont transmises uniquement aux prestataires techniques nécessaires au service, et seulement dans la mesure utile à la demande que vous formulez.",
        "- Fournisseur d'intelligence artificielle (DeepSeek, ou OpenAI selon la configuration retenue) : le texte de votre demande de voyage et les contraintes associées lui sont transmis pour rédiger le programme. Ce traitement implique un transfert hors de l'Union européenne, vers la Chine pour DeepSeek et vers les États-Unis pour OpenAI. N'incluez pas d'informations que vous ne souhaitez pas voir quitter l'Union européenne.",
        "- SerpApi (États-Unis) : recherche de vols, d'hébergements et de restaurants réels. Seuls la destination, les dates et les critères de recherche sont transmis, jamais votre identité.",
        "- Travelpayouts et Aviasales : calendriers de prix de billets d'avion, sur la seule base d'une destination et d'une période.",
        "- Services cartographiques et d'images (OpenStreetMap Nominatim, Wikipédia, Wikimedia Commons, Openverse, Mapbox, Pexels) : coordonnées de lieux et photographies, sur la base de noms de lieux uniquement.",
        "- Services d'information voyage (Open-Meteo pour la météo, Frankfurter pour les taux de change, Sherpa pour les formalités d'entrée, Google Maps Transit pour les transports) : destination et dates uniquement.",
        "- Railway Corp. (États-Unis), notre hébergeur : stockage de la base de données et exécution des serveurs.",
        "Les transferts hors de l'Union européenne s'appuient sur les clauses contractuelles types de la Commission européenne ou sur les garanties équivalentes proposées par ces prestataires. Nous pouvons également transmettre des données sur réquisition d'une autorité judiciaire ou administrative habilitée.",
      ],
    },
    {
      title: "5. Cookies et traceurs",
      body: [
        "Le site dépose un cookie de session strictement nécessaire à votre connexion. Il est de type httpOnly, ce qui empêche tout script de le lire, et il expire à la fin de votre session ou à la déconnexion. Ce cookie ne requiert pas votre consentement car il est indispensable au service que vous demandez.",
        "Le site charge le script Travelpayouts Drive, qui transforme les liens de réservation en liens d'affiliation et peut déposer un identifiant de suivi permettant d'attribuer une réservation à notre site. Ce traceur n'est pas nécessaire au fonctionnement du service : il n'est activé qu'après votre consentement, que vous pouvez retirer à tout moment depuis le bandeau de gestion des cookies.",
        "Les sites de nos partenaires de réservation, vers lesquels vous êtes redirigé, appliquent leurs propres politiques de cookies, sur lesquelles nous n'avons aucun contrôle.",
      ],
    },
    {
      title: "6. Vos droits",
      body: [
        "Conformément au Règlement général sur la protection des données et à la loi Informatique et Libertés, vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, ainsi que du droit de définir des directives relatives à leur sort après votre décès.",
        "Pour les exercer, écrivez à " +
          CONTACT +
          ". Nous répondons dans un délai d'un mois. Nous pouvons vous demander un élément permettant de vérifier que la demande émane bien du titulaire du compte.",
        "Vous pouvez à tout moment demander la suppression de votre compte, ce qui entraîne l'effacement de vos voyages enregistrés.",
        "Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la Commission nationale de l'informatique et des libertés, 3 place de Fontenoy, 75007 Paris, www.cnil.fr.",
      ],
    },
    {
      title: "7. Sécurité",
      body: [
        "Les échanges avec le site sont chiffrés en HTTPS. Les mots de passe sont hachés avec bcrypt. L'accès à la base de données est restreint aux personnes qui en ont besoin pour exploiter le service.",
        "Aucun système n'est infaillible. En cas de violation de données présentant un risque pour vos droits, nous en informerons la CNIL dans les 72 heures et vous préviendrons si le risque est élevé.",
      ],
    },
    {
      title: "8. Mineurs",
      body: [
        "Le service n'est pas destiné aux personnes de moins de 15 ans. Un compte ne peut être créé que par une personne majeure. Un voyage peut évidemment concerner des enfants, mais nous ne collectons alors aucune donnée nominative les concernant : seuls leur nombre et leur tranche d'âge éventuelle servent à adapter le programme.",
      ],
    },
    {
      title: "9. Modifications",
      body: [
        "Cette politique peut évoluer avec le service. Toute modification substantielle vous sera signalée sur le site ou par e-mail avant son entrée en vigueur. La date de dernière mise à jour figure en tête de ce document.",
      ],
    },
  ],
};

const termsFr: LegalDoc = {
  key: "terms",
  label: "Conditions d'utilisation",
  title: "Conditions générales d'utilisation",
  updated: UPDATED_FR,
  intro: [
    "Les présentes conditions régissent l'accès au site monpetitvoyageur.com et son utilisation. En créant un compte ou en utilisant le service, vous les acceptez sans réserve.",
    "Éditeur : " +
      EDITOR_FR +
      ". Directrice de la publication : Marion Demalaine. Contact : " +
      CONTACT +
      ".",
    "Hébergeur : Railway Corp., 2093 Philadelphia Pike #7078, Claymont, DE 19703, États-Unis, railway.com.",
  ],
  sections: [
    {
      title: "1. Ce qu'est le service",
      body: [
        "Mon Petit Voyageur est un outil d'aide à la préparation de voyage. À partir des informations que vous fournissez, il génère un programme jour par jour, propose des visites, des activités, des restaurants, des estimations de vols et d'hébergement, un guide illustré téléchargeable, et vous oriente vers des sites tiers pour réserver.",
        "Mon Petit Voyageur n'est ni une agence de voyages, ni un tour-opérateur, ni un intermédiaire de réservation. Nous ne vendons aucun voyage, aucun billet, aucune nuitée et aucune activité. Nous n'encaissons aucun paiement au titre d'une prestation de voyage. Aucun contrat de voyage n'est conclu avec nous.",
        "Toute réservation se fait directement auprès du prestataire concerné (compagnie aérienne, hôtel, plateforme de réservation, loueur, prestataire d'activité), sous ses propres conditions générales, que nous vous invitons à lire.",
      ],
    },
    {
      title: "2. Accès et compte",
      body: [
        "L'accès au service suppose la création d'un compte avec une adresse e-mail valide et un mot de passe d'au moins huit caractères. Vous devez être majeur et disposer de la capacité juridique de contracter.",
        "Vous êtes responsable de la confidentialité de votre mot de passe et de toute activité menée depuis votre compte. Prévenez-nous sans délai en cas d'utilisation non autorisée.",
        "Un compte est personnel. Le partage d'identifiants, la revente d'accès et la création de comptes automatisée sont interdits.",
      ],
    },
    {
      title: "3. Ce que vous vous engagez à ne pas faire",
      body: [
        "- Extraire ou réutiliser massivement le contenu du site, notamment par aspiration, robot ou script.",
        "- Solliciter le service de manière anormale au point d'en dégrader le fonctionnement ou d'en épuiser les quotas auprès de nos fournisseurs de données.",
        "- Tenter d'accéder à des comptes ou à des données qui ne sont pas les vôtres, ou contourner une mesure de sécurité.",
        "- Saisir des contenus illicites, injurieux, ou des données personnelles concernant des tiers sans leur accord.",
        "- Utiliser le service pour un usage commercial de revente des programmes générés sans notre accord écrit.",
        "En cas de manquement, nous pouvons suspendre ou fermer votre compte, après avertissement lorsque les circonstances le permettent.",
      ],
    },
    {
      title: "4. Fiabilité des informations : ce que nous garantissons et ce que nous ne garantissons pas",
      body: [
        "Les programmes sont générés automatiquement, en partie par un système d'intelligence artificielle, et enrichis de données provenant de services tiers. Malgré nos contrôles, une erreur, une omission ou une information périmée reste possible.",
        "Les prix affichés sont des estimations ou des relevés à un instant donné. Ils changent en permanence et ne constituent jamais une offre ferme. Seul le prix affiché par le prestataire au moment de la réservation fait foi.",
        "Les horaires d'ouverture, la disponibilité des activités, les conditions météorologiques et l'existence même d'un établissement doivent être vérifiés avant votre départ.",
        "Les informations relatives aux formalités d'entrée, aux visas, aux passeports, à la santé et aux vaccinations sont fournies à titre indicatif. Vous devez impérativement les vérifier auprès des sources officielles, notamment le site France Diplomatie du ministère de l'Europe et des Affaires étrangères et les autorités consulaires du pays de destination.",
        "Vous restez seul responsable de vos décisions de voyage, de vos réservations, de vos documents de voyage et de votre assurance.",
      ],
    },
    {
      title: "5. Liens d'affiliation",
      body: [
        "Certains liens de réservation présents sur le site et dans les guides sont des liens d'affiliation, notamment via Travelpayouts, Aviasales et Viator. Si vous réservez après avoir suivi l'un de ces liens, nous pouvons percevoir une commission de la part du partenaire.",
        "Cette commission ne modifie pas le prix que vous payez. Elle n'oriente pas le classement des propositions : les activités et les liens sont ordonnés selon leur intérêt pour vous, en particulier du moins cher au plus cher lorsque plusieurs voies d'achat existent.",
      ],
    },
    {
      title: "6. Propriété intellectuelle",
      body: [
        "Le site, sa charte graphique, ses textes, son code et ses bases de données sont protégés et demeurent la propriété de MARA LABS ou celle de ses concédants. Aucune reproduction ou réutilisation n'est autorisée sans accord écrit préalable, hors usage privé.",
        "Le programme et le guide générés pour vous sont fournis pour votre usage personnel de voyage. Vous pouvez les imprimer, les enregistrer et les partager avec vos compagnons de voyage. Toute exploitation commerciale, publication ou revente est interdite sans notre accord.",
        "Les photographies proviennent de sources libres ou sous licence, notamment Wikipédia, Wikimedia Commons, Openverse, Pexels et Google Maps, et restent la propriété de leurs auteurs. Leurs crédits sont affichés à côté des images.",
        "Les marques et logos des partenaires de réservation cités appartiennent à leurs titulaires respectifs.",
      ],
    },
    {
      title: "7. Disponibilité du service",
      body: [
        "Nous nous efforçons d'assurer un service accessible en continu, sans obligation de résultat. Le service peut être interrompu pour maintenance, mise à jour, ou du fait d'une défaillance d'un fournisseur tiers ou d'un cas de force majeure.",
        "Certaines fonctions dépendent de quotas mensuels auprès de nos fournisseurs de données. Lorsqu'un quota est atteint, une recherche de prix en direct peut être remplacée par une estimation, ce qui est alors signalé dans le programme.",
      ],
    },
    {
      title: "8. Responsabilité",
      body: [
        "Notre responsabilité ne peut être engagée à raison des dommages résultant de l'utilisation d'informations affichées sur le site, de l'inexécution ou de la mauvaise exécution d'une prestation par un tiers, d'une annulation, d'un retard, d'un refus d'embarquement, d'un refus d'entrée sur un territoire, ou d'une réservation effectuée sur un site partenaire.",
        "Aucune stipulation des présentes ne limite notre responsabilité en cas de faute lourde, de dol, ou de dommage corporel, ni ne prive le consommateur des droits que la loi lui garantit.",
      ],
    },
    {
      title: "9. Suppression du compte",
      body: [
        "Vous pouvez fermer votre compte à tout moment en écrivant à " +
          CONTACT +
          ". Vos voyages enregistrés sont alors supprimés dans les conditions décrites par la politique de confidentialité.",
      ],
    },
    {
      title: "10. Modification des conditions",
      body: [
        "Nous pouvons modifier ces conditions pour tenir compte d'évolutions du service ou de la réglementation. La version applicable est celle en ligne au moment de votre utilisation. Toute modification substantielle vous sera signalée avant son entrée en vigueur.",
      ],
    },
    {
      title: "11. Droit applicable et litiges",
      body: [
        "Les présentes conditions sont soumises au droit français. La version française de ces documents fait foi ; la traduction anglaise est fournie pour votre confort.",
        "En cas de différend, adressez-nous d'abord une réclamation à " +
          CONTACT +
          ". À défaut de solution sous trente jours, vous pouvez recourir gratuitement à un médiateur de la consommation, dont les coordonnées vous seront communiquées sur simple demande à cette même adresse, ou utiliser la plateforme européenne de règlement en ligne des litiges.",
        "À défaut d'accord amiable, les tribunaux français sont compétents dans les conditions prévues par la loi.",
      ],
    },
  ],
};

const salesFr: LegalDoc = {
  key: "sales",
  label: "Conditions générales de vente",
  title: "Conditions générales de vente",
  updated: UPDATED_FR,
  intro: [
    "Les présentes conditions régissent la vente des prestations payantes proposées par Mon Petit Voyageur aux consommateurs. Elles complètent les conditions générales d'utilisation, qui restent applicables.",
    "Vendeur : " + EDITOR_FR + ". Contact : " + CONTACT + ".",
    "À la date de mise à jour indiquée ci-dessus, le service est proposé gratuitement et aucune offre payante n'est commercialisée. Les articles qui suivent s'appliqueront dès l'ouverture d'une offre payante, dont le prix et le contenu seront affichés avant tout paiement.",
  ],
  sections: [
    {
      title: "1. Objet des prestations vendues",
      body: [
        "Les prestations vendues portent exclusivement sur l'accès à un service numérique d'aide à la préparation de voyage : génération de programmes, guides illustrés téléchargeables, et fonctions associées.",
        "Elles ne comprennent aucun transport, aucun hébergement, aucune activité et aucune assurance. Mon Petit Voyageur ne vend pas de voyages et n'agit pas comme intermédiaire de réservation. Les prestations de voyage sont contractées directement par vous auprès des prestataires concernés.",
      ],
    },
    {
      title: "2. Prix",
      body: [
        "Les prix sont indiqués en euros, toutes taxes comprises. Le prix applicable est celui affiché au moment de la commande.",
        "Nous pouvons modifier nos prix à tout moment. Un changement de prix est sans effet sur une commande déjà validée. Pour un abonnement, un nouveau prix ne s'applique qu'après information préalable et à compter de la période de renouvellement suivante, avec faculté de résilier avant cette échéance.",
      ],
    },
    {
      title: "3. Commande",
      body: [
        "La commande suppose un compte utilisateur. Avant de payer, un récapitulatif vous présente la prestation, son prix et sa durée. La validation de la commande, précédée de la case d'acceptation des présentes conditions, vaut acceptation du prix et engagement de payer.",
        "Le contrat est conclu à la confirmation de la commande, que nous vous adressons par e-mail.",
        "Nous pouvons refuser une commande en cas de litige de paiement antérieur, de soupçon de fraude, ou de manquement aux conditions d'utilisation.",
      ],
    },
    {
      title: "4. Paiement",
      body: [
        "Le paiement s'effectue en ligne, par carte bancaire, via un prestataire de paiement agréé. Vos données bancaires sont saisies directement sur l'interface sécurisée de ce prestataire et ne sont ni traitées ni conservées par MARA LABS.",
        "L'accès à la prestation est ouvert après encaissement effectif. En cas d'incident de paiement ou d'impayé sur un abonnement, l'accès peut être suspendu après information de votre part.",
      ],
    },
    {
      title: "5. Livraison de la prestation",
      body: [
        "La prestation étant entièrement numérique, elle est fournie immédiatement après la validation du paiement, par la mise à disposition des fonctions concernées dans votre compte.",
        "Le guide illustré est mis à disposition en téléchargement dans votre compte. Il vous appartient de le conserver.",
      ],
    },
    {
      title: "6. Droit de rétractation",
      body: [
        "Vous disposez en principe d'un délai de quatorze jours à compter de la conclusion du contrat pour vous rétracter, sans motif ni pénalité, en écrivant à " +
          CONTACT +
          " ou en utilisant le formulaire type de rétractation.",
        "Conformément à l'article L. 221-28 du code de la consommation, ce droit ne s'applique plus si vous avez demandé expressément l'exécution immédiate du service numérique, reconnu perdre votre droit de rétractation de ce fait, et que le service a été pleinement exécuté avant la fin du délai. Cette demande et cette reconnaissance vous sont présentées explicitement au moment de la commande.",
        "Lorsque la rétractation est valablement exercée, nous vous remboursons dans les quatorze jours suivant sa réception, par le même moyen de paiement que celui utilisé lors de la commande.",
      ],
    },
    {
      title: "7. Durée, renouvellement et résiliation d'un abonnement",
      body: [
        "Un abonnement est souscrit pour la durée annoncée lors de la commande et se renouvelle par tacite reconduction pour une durée identique, sauf résiliation.",
        "Vous pouvez résilier à tout moment depuis votre compte ou par e-mail. La résiliation prend effet à la fin de la période en cours ; l'accès est maintenu jusqu'à cette date et aucun remboursement au prorata n'est dû, sauf disposition légale contraire.",
        "Nous vous informons de chaque échéance de reconduction dans les conditions prévues par l'article L. 215-1 du code de la consommation.",
      ],
    },
    {
      title: "8. Garantie de conformité",
      body: [
        "Le contenu et les services numériques sont garantis conformes au contrat dans les conditions des articles L. 224-25-12 et suivants du code de la consommation.",
        "En cas de défaut de conformité, vous pouvez exiger la mise en conformité sans frais dans un délai raisonnable, et à défaut obtenir une réduction du prix ou la résolution du contrat. Cette garantie légale s'applique indépendamment de toute garantie commerciale.",
        "Les articles L. 224-25-12 à L. 224-25-26 du code de la consommation et l'article 1641 du code civil sont reproduits sur simple demande adressée à " +
          CONTACT +
          ".",
      ],
    },
    {
      title: "9. Limites de la prestation",
      body: [
        "La prestation consiste en une aide à la décision. Elle ne garantit ni la disponibilité, ni le prix, ni la qualité des prestations de voyage citées, qui relèvent de tiers.",
        "Une erreur de contenu générée par le système est traitée au titre de la garantie de conformité, par correction ou nouvelle génération du programme concerné.",
      ],
    },
    {
      title: "10. Réclamations, médiation et droit applicable",
      body: [
        "Toute réclamation doit être adressée à " + CONTACT + ". Nous accusons réception sous cinq jours ouvrés.",
        "En cas de litige non résolu, vous pouvez recourir gratuitement au médiateur de la consommation dont les coordonnées vous seront communiquées sur simple demande à cette même adresse, ou à la plateforme européenne de règlement en ligne des litiges.",
        "Les présentes conditions sont soumises au droit français, sans préjudice des dispositions plus protectrices du pays de votre résidence habituelle dans l'Union européenne. La version française fait foi.",
      ],
    },
    {
      title: "Formulaire type de rétractation",
      body: [
        "À l'attention de MARA LABS, Mon Petit Voyageur, 41 rue Jacquemars Giélée, 59800 Lille, " + CONTACT + " :",
        "Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de service numérique ci-dessous : [désignation de la prestation]. Commandée le [date de commande]. Nom du consommateur : [nom]. Adresse e-mail du compte : [e-mail]. Date : [date]. Signature en cas de notification sur papier.",
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* English                                                             */
/* ------------------------------------------------------------------ */

const privacyEn: LegalDoc = {
  key: "privacy",
  label: "Privacy policy",
  title: "Privacy policy",
  updated: UPDATED_EN,
  intro: [
    "This policy explains what personal data Mon Petit Voyageur collects, why, how long it is kept, who it is shared with, and how to exercise your rights.",
    "It applies to monpetitvoyageur.com and the associated application. The controller within the meaning of Article 4(7) GDPR is " +
      EDITOR_EN +
      ". For any question about personal data, write to " +
      CONTACT +
      " with the subject line “Data protection”.",
    "A data protection officer has been appointed: Marion Demalaine, reachable at the same address. As MARA LABS is established in France, no representative in the European Union under Article 27 GDPR is required.",
    "This English text is a courtesy translation. In case of any discrepancy, the French version prevails.",
  ],
  sections: [
    {
      title: "1. The data we collect",
      body: [
        "We collect only the data the service needs to work. No bank or card data passes through our servers.",
        "- Account data: your email address and your password. The password is never stored in clear text; only a bcrypt hash is kept.",
        "- Language preference: French or English.",
        "- Trip data you enter: destination or destination idea, dates or period, number of travellers, traveller type (for example family, couple, friends), budget, preferred travel styles, departure airport, and the free-text description of your request.",
        "- Generated plans: the itinerary produced for you, along with flights, accommodation, activities, restaurants and guides, linked to your account so that you can find them again.",
        "- Technical execution logs: a trace of the steps taken to generate a trip, kept to diagnose errors.",
        "- Connection data strictly necessary for the security of the service (IP address, request timestamps) in our host's logs.",
        "We do not ask for your name, postal address, phone number or any identity document. Please do not enter sensitive data (health, opinions, beliefs) in the free-text trip description.",
      ],
    },
    {
      title: "2. Why we use it, and on what legal basis",
      body: [
        "- Creating and managing your account and authenticating you: performance of our contract with you (Article 6(1)(b) GDPR).",
        "- Generating your travel programme and searching for flights, accommodation, activities and restaurants matching your request: performance of the contract.",
        "- Keeping your trips so that you can consult them again: performance of the contract.",
        "- Securing the service and preventing abuse and automated use: legitimate interest.",
        "- Improving the quality of the service using aggregated, anonymous data: legitimate interest.",
        "- Sending you an email about your account or a trip you requested: performance of the contract. Any marketing message, should there ever be one, will only be sent with your consent and can be refused at any time.",
      ],
    },
    {
      title: "3. How long we keep it",
      body: [
        "- Account and associated trips: for as long as your account is active, then deleted within 30 days of your deletion request.",
        "- Account inactive for 3 years: deleted after a warning email that goes unanswered.",
        "- Technical execution logs: 12 months at most.",
        "- Host connection logs: 12 months, in line with statutory retention obligations.",
      ],
    },
    {
      title: "4. Who receives your data",
      body: [
        "We neither sell nor rent your personal data. It is passed only to the technical providers the service needs, and only as far as your request requires.",
        "- Artificial intelligence provider (DeepSeek, or OpenAI depending on the configuration in use): the text of your trip request and its constraints are sent so the programme can be written. This involves a transfer outside the European Union, to China for DeepSeek and to the United States for OpenAI. Do not include information you would not want to leave the European Union.",
        "- SerpApi (United States): searching for real flights, accommodation and restaurants. Only the destination, dates and search criteria are sent, never your identity.",
        "- Travelpayouts and Aviasales: airfare price calendars, on the basis of a destination and a period only.",
        "- Mapping and image services (OpenStreetMap Nominatim, Wikipedia, Wikimedia Commons, Openverse, Mapbox, Pexels): place coordinates and photographs, based on place names only.",
        "- Travel information services (Open-Meteo for weather, Frankfurter for exchange rates, Sherpa for entry requirements, Google Maps Transit for local transport): destination and dates only.",
        "- Railway Corp. (United States), our host: database storage and server execution.",
        "Transfers outside the European Union rely on the European Commission's standard contractual clauses or on equivalent safeguards offered by these providers. We may also disclose data at the request of a competent judicial or administrative authority.",
      ],
    },
    {
      title: "5. Cookies and trackers",
      body: [
        "The site sets a session cookie that is strictly necessary for you to stay signed in. It is httpOnly, meaning no script can read it, and it expires at the end of your session or when you sign out. This cookie does not require your consent because it is essential to the service you asked for.",
        "The site loads the Travelpayouts Drive script, which turns booking links into affiliate links and may set a tracking identifier so that a booking can be attributed to our site. This tracker is not necessary for the service to work: it is activated only after your consent, which you can withdraw at any time from the cookie settings banner.",
        "Our booking partners' sites, to which you are redirected, apply their own cookie policies, over which we have no control.",
      ],
    },
    {
      title: "6. Your rights",
      body: [
        "Under the General Data Protection Regulation and the French Data Protection Act, you have the rights of access, rectification, erasure, restriction, objection and portability, as well as the right to give directions on what happens to your data after your death.",
        "To exercise them, write to " +
          CONTACT +
          ". We reply within one month. We may ask for something that lets us check the request comes from the account holder.",
        "You may ask for your account to be deleted at any time, which erases your saved trips.",
        "If you believe your rights are not respected, you may lodge a complaint with the French data protection authority: CNIL, 3 place de Fontenoy, 75007 Paris, www.cnil.fr.",
      ],
    },
    {
      title: "7. Security",
      body: [
        "Traffic to and from the site is encrypted with HTTPS. Passwords are hashed with bcrypt. Database access is restricted to the people who need it to run the service.",
        "No system is infallible. In the event of a data breach that presents a risk to your rights, we will notify the CNIL within 72 hours and inform you if the risk is high.",
      ],
    },
    {
      title: "8. Minors",
      body: [
        "The service is not intended for people under 15. Only an adult may create an account. A trip may of course involve children, but we then collect no data identifying them: only their number and, where relevant, their age range are used to adapt the programme.",
      ],
    },
    {
      title: "9. Changes",
      body: [
        "This policy may change as the service evolves. Any substantial change will be announced on the site or by email before it takes effect. The date of the latest update appears at the top of this document.",
      ],
    },
  ],
};

const termsEn: LegalDoc = {
  key: "terms",
  label: "Terms of use",
  title: "Terms of use",
  updated: UPDATED_EN,
  intro: [
    "These terms govern access to and use of monpetitvoyageur.com. By creating an account or using the service, you accept them in full.",
    "Publisher: " + EDITOR_EN + ". Publication director: Marion Demalaine. Contact: " + CONTACT + ".",
    "Host: Railway Corp., 2093 Philadelphia Pike #7078, Claymont, DE 19703, United States, railway.com.",
    "This English text is a courtesy translation. In case of any discrepancy, the French version prevails.",
  ],
  sections: [
    {
      title: "1. What the service is",
      body: [
        "Mon Petit Voyageur is a travel planning aid. From the information you provide, it generates a day-by-day programme, suggests visits, activities and restaurants, estimates flights and accommodation, produces a downloadable illustrated guide, and points you to third-party sites to book.",
        "Mon Petit Voyageur is not a travel agency, a tour operator, or a booking intermediary. We sell no trips, no tickets, no nights and no activities. We take no payment for any travel service. No travel contract is entered into with us.",
        "Every booking is made directly with the provider concerned (airline, hotel, booking platform, car rental company, activity provider), under their own terms, which we encourage you to read.",
      ],
    },
    {
      title: "2. Access and account",
      body: [
        "Using the service requires an account with a valid email address and a password of at least eight characters. You must be of full age and legally able to enter into a contract.",
        "You are responsible for keeping your password confidential and for all activity carried out from your account. Tell us without delay if it is used without your authorisation.",
        "An account is personal. Sharing credentials, reselling access and creating accounts automatically are prohibited.",
      ],
    },
    {
      title: "3. What you agree not to do",
      body: [
        "- Extract or reuse the site's content on a large scale, in particular by scraping, robot or script.",
        "- Call on the service so heavily that it degrades its operation or exhausts our data providers' quotas.",
        "- Try to reach accounts or data that are not yours, or work around a security measure.",
        "- Enter unlawful or abusive content, or personal data about other people without their agreement.",
        "- Use the service to resell generated programmes commercially without our written agreement.",
        "If these rules are broken we may suspend or close your account, with prior warning where circumstances allow.",
      ],
    },
    {
      title: "4. Reliability of the information: what we do and do not guarantee",
      body: [
        "Programmes are generated automatically, partly by an artificial intelligence system, and enriched with data from third-party services. Despite our checks, an error, an omission or out-of-date information remains possible.",
        "Displayed prices are estimates or readings taken at one moment in time. They change constantly and never constitute a binding offer. Only the price shown by the provider at the time of booking is authoritative.",
        "Opening hours, activity availability, weather conditions and even the continued existence of a venue must be checked before you travel.",
        "Information about entry requirements, visas, passports, health and vaccination is indicative. You must check it with official sources, in particular your own government's travel advice and the consular authorities of the destination country.",
        "You remain solely responsible for your travel decisions, your bookings, your travel documents and your insurance.",
      ],
    },
    {
      title: "5. Affiliate links",
      body: [
        "Some booking links on the site and in the guides are affiliate links, in particular through Travelpayouts, Aviasales and Viator. If you book after following one of them, we may receive a commission from the partner.",
        "That commission does not change the price you pay. It does not drive the ranking of suggestions: activities and links are ordered by what serves you, in particular from cheapest to most expensive where several purchase routes exist.",
      ],
    },
    {
      title: "6. Intellectual property",
      body: [
        "The site, its visual identity, texts, code and databases are protected and remain the property of MARA LABS or its licensors. No reproduction or reuse is allowed without prior written agreement, other than private use.",
        "The programme and guide generated for you are provided for your personal travel use. You may print them, save them and share them with your travel companions. Any commercial exploitation, publication or resale is prohibited without our agreement.",
        "Photographs come from free or licensed sources, in particular Wikipedia, Wikimedia Commons, Openverse, Pexels and Google Maps, and remain the property of their authors. Credits are displayed next to the images.",
        "The trade marks and logos of the booking partners mentioned belong to their respective owners.",
      ],
    },
    {
      title: "7. Availability of the service",
      body: [
        "We aim to keep the service continuously available, without any obligation of result. It may be interrupted for maintenance or updates, or because of a third-party provider failure or an event of force majeure.",
        "Some features depend on monthly quotas with our data providers. When a quota is reached, a live price search may be replaced by an estimate, which is then flagged in the programme.",
      ],
    },
    {
      title: "8. Liability",
      body: [
        "We are not liable for loss arising from the use of information shown on the site, from a third party failing to perform or performing badly, from a cancellation, a delay, a denied boarding, a refusal of entry to a territory, or a booking made on a partner site.",
        "Nothing in these terms limits our liability for gross negligence, wilful misconduct or personal injury, nor deprives consumers of the rights the law guarantees them.",
      ],
    },
    {
      title: "9. Deleting your account",
      body: [
        "You may close your account at any time by writing to " +
          CONTACT +
          ". Your saved trips are then deleted as described in the privacy policy.",
      ],
    },
    {
      title: "10. Changes to these terms",
      body: [
        "We may amend these terms to reflect changes in the service or in the law. The version that applies is the one online when you use the service. Any substantial change will be announced before it takes effect.",
      ],
    },
    {
      title: "11. Governing law and disputes",
      body: [
        "These terms are governed by French law. The French version of these documents is authoritative; the English translation is provided for your convenience.",
        "In the event of a dispute, first send a complaint to " +
          CONTACT +
          ". If it is not resolved within thirty days, you may use a consumer mediator free of charge, whose details will be provided on request at the same address, or the European online dispute resolution platform.",
        "Failing an amicable settlement, the French courts have jurisdiction as provided by law.",
      ],
    },
  ],
};

const salesEn: LegalDoc = {
  key: "sales",
  label: "Terms of sale",
  title: "Terms of sale",
  updated: UPDATED_EN,
  intro: [
    "These terms govern the sale of paid services offered by Mon Petit Voyageur to consumers. They supplement the terms of use, which continue to apply.",
    "Seller: " + EDITOR_EN + ". Contact: " + CONTACT + ".",
    "As at the update date above, the service is free and no paid offer is on sale. The articles below will apply as soon as a paid offer opens, with its price and content shown before any payment.",
    "This English text is a courtesy translation. In case of any discrepancy, the French version prevails.",
  ],
  sections: [
    {
      title: "1. What is sold",
      body: [
        "What is sold is access to a digital travel planning service: generated programmes, downloadable illustrated guides, and related features.",
        "It includes no transport, no accommodation, no activity and no insurance. Mon Petit Voyageur does not sell trips and does not act as a booking intermediary. Travel services are contracted by you directly with the providers concerned.",
      ],
    },
    {
      title: "2. Prices",
      body: [
        "Prices are shown in euros, inclusive of all taxes. The price that applies is the one displayed when you order.",
        "We may change our prices at any time. A price change has no effect on an order already validated. For a subscription, a new price applies only after prior notice and from the following renewal period, with the option to cancel before that date.",
      ],
    },
    {
      title: "3. Orders",
      body: [
        "Ordering requires a user account. Before paying, a summary sets out the service, its price and its duration. Validating the order, after ticking the box accepting these terms, means accepting the price and undertaking to pay.",
        "The contract is formed when we send you the order confirmation by email.",
        "We may refuse an order in the event of an earlier payment dispute, suspected fraud, or a breach of the terms of use.",
      ],
    },
    {
      title: "4. Payment",
      body: [
        "Payment is made online by bank card through an authorised payment provider. Your card details are entered directly on that provider's secure interface and are neither processed nor stored by MARA LABS.",
        "Access opens once payment has actually been received. In the event of a payment incident or an unpaid subscription, access may be suspended after we inform you.",
      ],
    },
    {
      title: "5. Delivery",
      body: [
        "As the service is entirely digital, it is supplied immediately after payment is validated, by making the relevant features available in your account.",
        "The illustrated guide is made available for download in your account. Keeping a copy is your responsibility.",
      ],
    },
    {
      title: "6. Right of withdrawal",
      body: [
        "You have, in principle, fourteen days from the conclusion of the contract to withdraw, without reason or penalty, by writing to " +
          CONTACT +
          " or by using the model withdrawal form.",
        "Under Article L. 221-28 of the French Consumer Code, that right no longer applies if you expressly asked for the digital service to be performed immediately, acknowledged that you thereby lose your right of withdrawal, and the service has been fully performed before the end of the period. That request and that acknowledgement are presented to you explicitly when you order.",
        "Where withdrawal is validly exercised, we refund you within fourteen days of receiving it, using the same means of payment you used to order.",
      ],
    },
    {
      title: "7. Subscription term, renewal and cancellation",
      body: [
        "A subscription runs for the term announced when you order and renews automatically for the same term unless cancelled.",
        "You may cancel at any time from your account or by email. Cancellation takes effect at the end of the current period; access continues until then and no pro rata refund is due, unless the law provides otherwise.",
        "We inform you of each renewal date in accordance with Article L. 215-1 of the French Consumer Code.",
      ],
    },
    {
      title: "8. Legal guarantee of conformity",
      body: [
        "Digital content and services are guaranteed to conform to the contract under Articles L. 224-25-12 and following of the French Consumer Code.",
        "In the event of a lack of conformity, you may require it to be brought into conformity free of charge within a reasonable time and, failing that, obtain a price reduction or the termination of the contract. This legal guarantee applies regardless of any commercial guarantee.",
        "Articles L. 224-25-12 to L. 224-25-26 of the Consumer Code and Article 1641 of the Civil Code are reproduced on request sent to " +
          CONTACT +
          ".",
      ],
    },
    {
      title: "9. Limits of the service",
      body: [
        "The service is a decision aid. It guarantees neither the availability, nor the price, nor the quality of the travel services mentioned, which are provided by third parties.",
        "A content error produced by the system is handled under the legal guarantee of conformity, by correcting or regenerating the programme concerned.",
      ],
    },
    {
      title: "10. Complaints, mediation and governing law",
      body: [
        "Any complaint must be sent to " + CONTACT + ". We acknowledge receipt within five working days.",
        "If a dispute is not resolved, you may use, free of charge, the consumer mediator whose details will be provided on request at the same address, or the European online dispute resolution platform.",
        "These terms are governed by French law, without prejudice to more protective provisions of the country where you habitually reside in the European Union. The French version is authoritative.",
      ],
    },
    {
      title: "Model withdrawal form",
      body: [
        "To MARA LABS, Mon Petit Voyageur, 41 rue Jacquemars Giélée, 59800 Lille, France, " + CONTACT + ":",
        "I hereby give notice that I withdraw from my contract for the following digital service: [name of the service]. Ordered on [order date]. Consumer name: [name]. Account email address: [email]. Date: [date]. Signature if notified on paper.",
      ],
    },
  ],
};

export const legalDocsByLocale: Record<LegalLocale, LegalDoc[]> = {
  fr: [privacyFr, termsFr, salesFr],
  en: [privacyEn, termsEn, salesEn],
};

export function getLegalDocs(locale: string): LegalDoc[] {
  return locale === "en" ? legalDocsByLocale.en : legalDocsByLocale.fr;
}

// Source unique des documents juridiques du site.
// Le composant LegalPage les affiche ; toute modification se fait ici.
//
// Les mentions entre crochets [ ... ] doivent être complétées par l'éditeur
// avant la mise en ligne : forme juridique, immatriculation, adresse,
// hébergeur, et le cas échéant l'immatriculation Atout France.

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

const UPDATED = "6 septembre 2026";

const EDITOR = "Mon Petit Voyageur, service édité par la société Mara Labs, [forme juridique] au capital de [montant] €, dont le siège est situé [adresse du siège], immatriculée au RCS de [ville] sous le numéro [SIREN], numéro de TVA intracommunautaire [numéro], représentée par Marion Demalaine";

export const privacy: LegalDoc = {
  key: "privacy",
  label: "Politique de confidentialité",
  title: "Politique de confidentialité",
  updated: UPDATED,
  intro: [
    "Cette politique explique quelles données personnelles Mon Petit Voyageur collecte, pourquoi, combien de temps elles sont conservées, avec qui elles sont partagées et comment exercer vos droits.",
    "Elle s'applique au site monpetitvoyageur.com et à l'application associée. Le responsable de traitement est " + EDITOR + ". Pour toute question relative aux données personnelles : contact@monpetitvoyageur.fr.",
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
        "- Fournisseur d'intelligence artificielle (DeepSeek, ou OpenAI selon la configuration retenue) : le texte de votre demande de voyage et les contraintes associées lui sont transmis pour rédiger le programme. Ce traitement peut impliquer un transfert hors de l'Union européenne, notamment vers la Chine pour DeepSeek et les États-Unis pour OpenAI. N'incluez pas d'informations que vous ne souhaitez pas voir quitter l'Union européenne.",
        "- SerpApi (États-Unis) : recherche de vols, d'hébergements et de restaurants réels. Seuls la destination, les dates et les critères de recherche sont transmis, jamais votre identité.",
        "- Travelpayouts et Aviasales : calendriers de prix de billets d'avion, sur la seule base d'une destination et d'une période.",
        "- Services cartographiques et d'images (OpenStreetMap Nominatim, Wikipédia, Wikimedia Commons, Openverse, Mapbox, Pexels) : coordonnées de lieux et photographies, sur la base de noms de lieux uniquement.",
        "- Services d'information voyage (Open-Meteo pour la météo, Frankfurter pour les taux de change, Sherpa pour les formalités d'entrée, Google Maps Transit pour les transports) : destination et dates uniquement.",
        "- Railway, notre hébergeur : stockage de la base de données et exécution des serveurs.",
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
        "Pour les exercer, écrivez à contact@monpetitvoyageur.fr. Nous répondons dans un délai d'un mois. Nous pouvons vous demander un élément permettant de vérifier que la demande émane bien du titulaire du compte.",
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
        "Le service n'est pas destiné aux personnes de moins de 15 ans. Un compte ne peut être créé que par une personne majeure. Un voyage peut évidemment concerner des enfants, mais nous ne collectons alors aucune donnée nominative les concernant : seul leur nombre et leur tranche d'âge éventuelle servent à adapter le programme.",
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

export const terms: LegalDoc = {
  key: "terms",
  label: "Conditions d'utilisation",
  title: "Conditions générales d'utilisation",
  updated: UPDATED,
  intro: [
    "Les présentes conditions régissent l'accès au site monpetitvoyageur.com et son utilisation. En créant un compte ou en utilisant le service, vous les acceptez sans réserve.",
    "Éditeur : " + EDITOR + ". Directrice de la publication : Marion Demalaine. Contact : contact@monpetitvoyageur.fr. Hébergeur : [nom et adresse de l'hébergeur].",
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
        "Le site, sa charte graphique, ses textes, son code et ses bases de données sont protégés et demeurent notre propriété ou celle de nos concédants. Aucune reproduction ou réutilisation n'est autorisée sans accord écrit préalable, hors usage privé.",
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
        "Vous pouvez fermer votre compte à tout moment en écrivant à contact@monpetitvoyageur.fr. Vos voyages enregistrés sont alors supprimés dans les conditions décrites par la politique de confidentialité.",
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
        "Les présentes conditions sont soumises au droit français.",
        "En cas de différend, adressez-nous d'abord une réclamation à contact@monpetitvoyageur.fr. À défaut de solution sous trente jours, vous pouvez recourir gratuitement à un médiateur de la consommation : [nom et coordonnées du médiateur], ou utiliser la plateforme européenne de règlement en ligne des litiges.",
        "À défaut d'accord amiable, les tribunaux français sont compétents dans les conditions prévues par la loi.",
      ],
    },
  ],
};

export const sales: LegalDoc = {
  key: "sales",
  label: "Conditions générales de vente",
  title: "Conditions générales de vente",
  updated: UPDATED,
  intro: [
    "Les présentes conditions régissent la vente des prestations payantes proposées par Mon Petit Voyageur aux consommateurs. Elles complètent les conditions générales d'utilisation, qui restent applicables.",
    "Vendeur : " + EDITOR + ". Contact : contact@monpetitvoyageur.fr.",
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
        "Le paiement s'effectue en ligne, par carte bancaire, via un prestataire de paiement agréé. Vos données bancaires sont saisies directement sur l'interface sécurisée de ce prestataire et ne sont ni traitées ni conservées par Mon Petit Voyageur.",
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
        "Vous disposez en principe d'un délai de quatorze jours à compter de la conclusion du contrat pour vous rétracter, sans motif ni pénalité, en écrivant à contact@monpetitvoyageur.fr ou en utilisant le formulaire type de rétractation.",
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
        "Les articles L. 224-25-12 à L. 224-25-26 du code de la consommation et l'article 1641 du code civil sont reproduits sur simple demande adressée à contact@monpetitvoyageur.fr.",
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
        "Toute réclamation doit être adressée à contact@monpetitvoyageur.fr. Nous accusons réception sous cinq jours ouvrés.",
        "En cas de litige non résolu, vous pouvez recourir gratuitement au médiateur de la consommation : [nom et coordonnées du médiateur], ou à la plateforme européenne de règlement en ligne des litiges.",
        "Les présentes conditions sont soumises au droit français, sans préjudice des dispositions plus protectrices du pays de votre résidence habituelle dans l'Union européenne.",
      ],
    },
    {
      title: "Formulaire type de rétractation",
      body: [
        "À l'attention de Mon Petit Voyageur, contact@monpetitvoyageur.fr :",
        "Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de service numérique ci-dessous : [désignation de la prestation]. Commandée le [date de commande]. Nom du consommateur : [nom]. Adresse e-mail du compte : [e-mail]. Date : [date]. Signature en cas de notification sur papier.",
      ],
    },
  ],
};

export const legalDocs: LegalDoc[] = [privacy, terms, sales];

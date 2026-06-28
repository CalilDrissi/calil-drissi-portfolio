module.exports = [
  {
    title: 'Bonnes pratiques de workflow Git et de branches',
    slug: 'bonnes-pratiques-git',
    excerpt: 'Comment je garde l\'historique Git d\'une equipe propre, relisible et facile a annuler sans que le ceremonial gene le travail.',
    category: 'Bonnes Pratiques',
    tags: ['git', 'gestion-de-versions', 'workflow', 'collaboration'],
    pexels: 'version control workflow',
    content: `
<p>J'ai travaille dans des equipes qui traitaient Git comme un rituel sacre et dans d'autres qui le traitaient comme un tiroir fourre-tout. Aucun de ces extremes ne livre du bon logiciel. Apres des annees a nettoyer des historiques chaotiques et a demeler des catastrophes de fusion, j'ai adopte une serie d'habitudes qui gardent les choses calmes. Aucune n'est ingenieuse. C'est justement le but.</p>

<h2>Choisissez un modele de branches et cessez d'en debattre</h2>
<p>Le modele compte moins que l'accord. Pour la plupart des equipes produit, j'utilise le developpement sur tronc commun avec des branches de fonctionnalite a courte duree de vie. Vous partez de main, vous travaillez un jour ou deux, vous fusionnez, vous supprimez la branche. Plus une branche vit longtemps, plus elle derive, et plus la fusion finale devient penible. Les branches de version a longue duree ont leur place dans un logiciel qui sort a cadence fixe vers des clients qui ne peuvent pas se mettre a jour a la demande, mais pour une application web deployee plusieurs fois par jour, elles ne sont que du poids inutile.</p>
<p>Ce que j'evite activement, c'est le montage GitFlow elabore ou develop, release, hotfix et feature s'entrelacent. J'ai vu ce systeme derouter les nouveaux pendant des semaines. Si votre deploiement est continu, vos branches devraient l'etre aussi.</p>

<h2>Ecrivez des commits qui expliquent le pourquoi</h2>
<p>Un message de commit est une note pour celui qui lira l'historique a 2h du matin pendant un incident, et cette personne pourrait etre vous. Le diff montre deja ce qui a change. Le message doit capturer pourquoi. Je garde la ligne de sujet sous environ cinquante caracteres, a l'imperatif, et j'utilise le corps pour expliquer le raisonnement quand le changement n'est pas evident.</p>
<pre><code>fix: empeche le double paiement lors d'une nouvelle tentative

Le client de paiement reessayait sur un 504 alors que
le debit etait deja passe cote passerelle. On clef
desormais la requete avec un jeton d'idempotence pour
que la passerelle deduplique. Ferme #482.</code></pre>
<p>Les commits atomiques sont l'autre moitie de l'affaire. Un changement logique par commit. Quand un commit fait trois choses sans rapport, vous ne pouvez jamais en annuler une seule proprement, et le bisect devient inutile. Si vous ecrivez "et" dans une ligne de sujet, ce sont deux commits.</p>

<h2>Rebasez votre propre travail, fusionnez le travail partage</h2>
<p>C'est la regle qui evite le plus de douleur. Avant d'ouvrir une pull request, je rebase ma branche sur la derniere version de main pour que mes changements reposent sur la realite actuelle et que la relecture soit fluide. Mais des qu'une branche est partagee ou qu'une PR est ouverte et que d'autres l'ont regardee, j'arrete de rebaser et je fusionne, car reecrire un historique publie oblige tous les autres a recuperer leur etat local.</p>
<ul>
  <li>Rebasez pour ranger vos commits locaux avant qu'ils soient publics.</li>
  <li>Utilisez le rebase interactif pour ecraser les inevitables commits "correction de faute" et "vraie correction".</li>
  <li>Ne forcez jamais le push d'une branche sur laquelle d'autres construisent.</li>
  <li>Protegez main pour que personne ne puisse y pousser directement.</li>
</ul>

<h2>Gardez main toujours livrable</h2>
<p>La propriete la plus precieuse d'un depot, c'est que main fonctionne toujours. Si main est au vert, vous pouvez sortir une version a tout moment, et un deploiement casse se repare en annulant une seule fusion. J'impose cela avec des verifications obligatoires : les tests et le linting doivent passer avant meme que le bouton de fusion apparaisse. Cela rejoint directement ma facon de mener les relectures, que j'ai abordee dans <a href="/fr/blog/bonnes-pratiques-revue-de-code/">les bonnes pratiques de revue de code</a>. Un historique propre rend les relectures plus rapides, et de bonnes relectures gardent l'historique propre. Les deux se nourrissent mutuellement.</p>

<h2>Rendez l'annulation banale</h2>
<p>Quand quelque chose casse en production, l'action sure la plus rapide est en general d'annuler, pas de deboguer en direct. Ecraser chaque PR en un seul commit sur main rend cela trivial : une PR est un commit, et l'annuler retire toute la fonctionnalite proprement. J'aime les fusions ecrasees pour cette raison precise sur le code applicatif, meme si pour les bibliotheques ou l'historique de chaque commit a une vraie valeur, je conserve l'historique complet.</p>
<p>Etiquetez vos versions pour toujours pouvoir repondre a "qu'est-ce qui tournait mardi dernier". Une etiquette legere ne coute rien et transforme une question vague en reponse d'une ligne.</p>

<h2>Quelques habitudes qui paient discretement</h2>
<ul>
  <li>Validez un .gitignore sense des le premier jour pour que secrets et artefacts de build n'entrent jamais dans l'historique. Retirer un identifiant fuite de l'historique gache un apres-midi.</li>
  <li>Tirez avec rebase par defaut pour eviter le bruit des commits de fusion a chaque synchro.</li>
  <li>Gardez des PR petites. Une PR de 200 lignes recoit une vraie relecture. Une PR de 2000 lignes recoit un tampon.</li>
</ul>
<p>Git recompense la discipline plus que le savoir. Vous n'avez pas besoin de memoriser les commandes de plomberie. Vous avez besoin d'un petit ensemble d'accords que tout le monde suit vraiment. Le meme raisonnement revient quand je concois des stockages de donnees, ce que j'ai couvert dans <a href="/fr/blog/bonnes-pratiques-schema-base-de-donnees/">les bonnes pratiques de schema de base de donnees</a>, ou quelques conventions fermes tot epargnent un nettoyage enorme plus tard.</p>
`
  },
  {
    title: 'Bonnes pratiques de revue de code',
    slug: 'bonnes-pratiques-revue-de-code',
    excerpt: 'Les revues servent la comprehension partagee et la detection de vrais problemes, pas le controle a l\'entree ni la police du style. Voici comment je les mene.',
    category: 'Bonnes Pratiques',
    tags: ['revue-de-code', 'collaboration', 'qualite', 'processus'],
    pexels: 'code review programming',
    content: `
<p>La revue de code est l'habitude au plus fort levier qu'une equipe puisse avoir, et c'est aussi celle qu'on rate le plus souvent. J'ai recu des revues qui ressemblaient a un interrogatoire et des revues qui approuvaient 800 lignes avec un pouce leve en quatre secondes. Les deux sont des echecs. Une bonne revue attrape de vrais problemes, diffuse la connaissance et laisse l'auteur soutenu plutot que juge.</p>

<h2>Relisez ce que les humains font bien</h2>
<p>Ne gaspillez pas votre attention sur le formatage, l'ordre des imports ou la longueur d'une ligne. Un linter et un formateur automatique s'en chargent, et ils ne se fatiguent jamais. Si votre equipe se dispute sur le style dans les commentaires de PR, vous avez un manque d'outillage, pas un probleme de discipline. Configurez le formateur, validez la config, et passez a autre chose.</p>
<p>Ce qu'une machine ne peut pas verifier, c'est si le code est correct, s'il resout le vrai probleme, et si quelqu'un dans six mois le comprendra. C'est la que va mon attention :</p>
<ul>
  <li>Est-ce que ca fait ce que la description annonce ?</li>
  <li>Que se passe-t-il aux bords : entree vide, valeurs nulles, acces concurrent, un appel reseau qui pend ?</li>
  <li>Y a-t-il une approche plus simple cachee derriere celle-ci ?</li>
  <li>Le nommage aura-t-il du sens pour quelqu'un qui n'etait pas dans la piece ?</li>
</ul>

<h2>Gardez des changements assez petits pour etre vraiment relus</h2>
<p>La limite dure de la qualite de relecture, c'est la taille. La recherche et mon experience disent la meme chose : au-dela de quelques centaines de lignes, la detection de defauts s'effondre parce que les relecteurs survolent. Quand je recois une PR enorme, je demande a l'auteur de la decouper. Une serie de petites PR ciblees recoit un vrai examen sur chacune. C'est aussi pourquoi je rebase et ecrase avec soin avant d'ouvrir une PR, une habitude que j'ai decrite dans <a href="/fr/blog/bonnes-pratiques-git/">les bonnes pratiques Git</a>.</p>

<h2>Commentez comme un collegue, pas comme un compilateur</h2>
<p>Le ton fait l'essentiel du travail. Le meme point passe completement differemment selon la formulation. Je pose des questions au lieu de rendre des verdicts, et je clarifie quels commentaires sont bloquants et lesquels sont optionnels.</p>
<pre><code># Au lieu de :
C'est faux.

# Essayez :
Que se passe-t-il ici si items est vide ? Je crois
qu'on depasserait la fin. On pourrait proteger avec
une verification de longueur, ou ce cas est-il
impossible en amont ?

# Et etiquetez les details :
detail : on pourrait inliner, non bloquant</code></pre>
<p>Marquer les details comme non bloquants est une petite chose qui retire enormement de friction. L'auteur sait ce qu'il doit corriger pour fusionner par rapport a ce qui n'est que mon gout. Je prends aussi soin de dire quand quelque chose est vraiment bien. Une revue qui n'est que critique entraine les gens a redouter le processus.</p>

<h2>Relisez vite et finissez ce que vous commencez</h2>
<p>Une PR qui reste sans relecture deux jours bloque une personne et pourrit a mesure que main avance dessous. Je traite les demandes de relecture comme une priorite quasi en haut de ma file, idealement le jour meme. Le cout d'une PR a l'arret s'accumule : l'auteur change de contexte, puis doit tout recharger quand le retour arrive enfin.</p>
<p>Quand je relis, j'essaie de donner tous mes retours en une passe plutot que de distiller des commentaires sur trois tours. Rien n'est plus demoralisant que tout corriger, etre relu, et decouvrir cinq nouveaux commentaires qui etaient visibles depuis le debut.</p>

<h2>L'auteur a aussi des devoirs</h2>
<p>Les revues vont plus vite quand l'auteur les rend faciles. Avant de demander une relecture, j'ecris une description qui explique ce qui a change et pourquoi, je laisse des commentaires en ligne sur mon propre diff pour pointer ce qui n'est pas evident, et je m'assure que la CI est au vert. Une bonne description peut diviser par deux le temps de relecture, car le relecteur ne reconstitue pas l'intention a partir du diff.</p>
<ul>
  <li>Enoncez le probleme, pas seulement la solution.</li>
  <li>Signalez tout ce dont vous n'etes pas sur et sur quoi vous voulez un regard.</li>
  <li>Incluez des captures ou un exemple de sortie pour tout ce qui touche l'utilisateur.</li>
</ul>

<h2>Etre en desaccord, puis s'engager</h2>
<p>Parfois l'auteur et le relecteur voient simplement les choses autrement. Quand le desaccord porte sur le gout plutot que sur la justesse, je m'en remets a la decision de l'auteur apres avoir exprime mon avis une fois. Trainer une PR sur cinq tours pour une preference stylistique brule un capital de bonne volonte dont vous aurez besoin plus tard. Gardez les positions fermes pour ce qui compte vraiment : la justesse, la securite, et les contrats de donnees qui me tiennent tant a coeur dans <a href="/fr/blog/guide-conception-api-rest/">le guide de conception d'API REST</a>. Reussissez ceux-la et laissez filer les petites choses.</p>
`
  },
  {
    title: 'Guide de conception d\'API REST',
    slug: 'guide-conception-api-rest',
    excerpt: 'Des regles concretes pour concevoir des API HTTP previsibles, versionnables et agreables a consommer.',
    category: 'Bonnes Pratiques',
    tags: ['api', 'rest', 'http', 'backend'],
    pexels: 'api integration design',
    content: `
<p>Une API est une promesse. Des qu'un client en depend, chaque bizarrerie que vous avez livree devient permanente, parce que quelqu'un quelque part a ecrit du code contre cette bizarrerie. J'ai maintenu des API pendant des annees et celles qui ont bien vieilli partageaient le meme trait : elles etaient ennuyeuses et previsibles. Voici comment j'y arrive.</p>

<h2>Modelisez les ressources en noms, prenez les verbes a HTTP</h2>
<p>L'URL devrait nommer une chose. La methode dit ce que vous lui faites. Je vois sans cesse des points d'entree comme /getUser et /createOrderNow, et ils combattent tout l'interet de HTTP. Une conception propre utilise des noms au pluriel pour les collections et laisse la methode porter l'action.</p>
<pre><code>GET    /orders          liste les commandes
POST   /orders          cree une commande
GET    /orders/42       recupere une commande
PATCH  /orders/42       met a jour des champs
DELETE /orders/42       la supprime

GET    /orders/42/items ressource imbriquee</code></pre>
<p>PATCH pour les mises a jour partielles et PUT pour le remplacement complet est une distinction a garder. La plupart des vraies mises a jour touchent quelques champs, donc PATCH est ce que je prends, et PUT devient le cas rare ou le client possede vraiment toute la representation.</p>

<h2>Utilisez les codes de statut comme les clients l'attendent</h2>
<p>Renvoyez le code de statut qui correspond a la realite. Un 200 sur une requete echouee parce qu'on "a mis l'erreur dans le corps" casse tout client generique et tout outil de supervision qui lit la ligne de statut. L'ensemble que j'utilise couvre presque tout :</p>
<ul>
  <li>200 pour une lecture ou une mise a jour reussie, 201 quand vous avez cree quelque chose.</li>
  <li>400 pour une entree malformee, 422 quand l'entree est bien formee mais semantiquement invalide.</li>
  <li>401 quand vous ne savez pas qui ils sont, 403 quand vous le savez et qu'ils n'ont pas le droit.</li>
  <li>404 pour une ressource manquante, 409 pour un conflit comme un doublon.</li>
  <li>500 uniquement pour de vraies pannes serveur, jamais pour une erreur du client.</li>
</ul>

<h2>Rendez les erreurs lisibles par la machine</h2>
<p>Un corps d'erreur devrait aider le code appelant a reagir, pas juste afficher une chaine. Je renvoie un code machine stable a cote d'un message humain, pour que les clients puissent brancher sur le code sans analyser une prose que je pourrais reformuler plus tard.</p>
<pre><code>{
  "error": {
    "code": "insufficient_funds",
    "message": "La carte a ete refusee.",
    "field": "payment_method"
  }
}</code></pre>
<p>La coherence compte ici plus que l'ingeniosite. Chaque erreur de l'API devrait avoir la meme forme, pour qu'un client ecrive un seul gestionnaire d'erreur au lieu de dix. C'est le meme instinct que j'apporte aux logs, dont j'ai parle dans <a href="/fr/blog/bonnes-pratiques-observabilite/">les bonnes pratiques d'observabilite</a> : la structure vaut mieux que la prose quand autre chose doit la lire.</p>

<h2>Prevoyez le versionnage avant d'en avoir besoin</h2>
<p>Vous devrez faire un changement cassant tot ou tard. Decidez comment avant de livrer la v1. Je mets la version dans le chemin, /v1/orders, parce qu'elle est visible, cacheable et triviale a router. Le versionnage par en-tete est plus elegant sur le papier et plus penible en pratique quand quelqu'un debogue avec curl. Quel que soit votre choix, la regle est de ne jamais casser une version existante. Les ajouts comme de nouveaux champs optionnels vont bien. Retirer un champ ou changer son type est une nouvelle version.</p>

<h2>Paginez et filtrez des le premier jour</h2>
<p>Toute collection qui peut grandir grandira, et un GET qui renvoie dix mille lignes finira par expirer et emporter une base de donnees avec lui. J'ajoute la pagination a chaque point d'entree de liste des le depart, meme quand les donnees sont minuscules, parce que l'ajouter plus tard est un changement cassant. La pagination par curseur gere mieux les grands jeux de donnees mouvants que l'offset, qui derive quand des lignes sont inserees en cours de parcours.</p>
<ul>
  <li>Renvoyez un curseur stable et un signal clair de "il y en a plus".</li>
  <li>Autorisez le filtrage par parametres de requete, et documentez exactement quels champs sont filtrables.</li>
  <li>Plafonnez la taille de page cote serveur pour qu'un client ne puisse pas tout demander d'un coup.</li>
</ul>

<h2>Soyez strict sur ce que vous acceptez, genereux sur ce que vous renvoyez</h2>
<p>Validez l'entree durement a la frontiere et rejetez tout ce qui est malforme avec un 400 ou 422 clair. Plus vous attrapez les mauvaises donnees pres du bord, moins elles peuvent corrompre l'aval, ce qui ramene directement aux contraintes sur lesquelles je m'appuie dans <a href="/fr/blog/bonnes-pratiques-schema-base-de-donnees/">les bonnes pratiques de schema de base de donnees</a>. Cote sortie, gardez les reponses stables et previsibles pour que les clients puissent faire confiance a la forme. Une API stricte a la porte et coherente a la sortie est une API qu'on aime construire, et cette bonne volonte est ce qui fait adopter votre plateforme.</p>
`
  },
  {
    title: 'Bonnes pratiques de schema de base de donnees',
    slug: 'bonnes-pratiques-schema-base-de-donnees',
    excerpt: 'Les decisions de schema sont les plus difficiles a revenir dans tout systeme. Voici comment je concois des tables qui tiennent sous la croissance.',
    category: 'Bonnes Pratiques',
    tags: ['base-de-donnees', 'sql', 'schema', 'modelisation-de-donnees'],
    pexels: 'database server storage',
    content: `
<p>Le schema est la partie d'un systeme la plus difficile a changer une fois pleine de donnees. Vous pouvez reecrire un service en un week-end. Migrer une table d'un milliard de lignes sans interruption est un projet. Je passe donc du temps reel sur le schema en amont, car le cout d'une erreur ne fait que grandir. Voici les decisions que je ne regrette pas.</p>

<h2>Laissez la base imposer les regles</h2>
<p>Le code applicatif n'est pas l'endroit pour garantir l'integrite des donnees, car il y a toujours un autre chemin d'entree : un script de migration, une correction manuelle, un second service, un developpeur dans une console. La base est le seul point de passage par lequel tout transite, c'est donc la que les regles appartiennent. J'utilise NOT NULL agressivement, les cles etrangeres pour imposer les relations, les contraintes d'unicite pour empecher les doublons, et les contraintes de verification pour les plages de valeurs.</p>
<pre><code>CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id),
  status      text   NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','paid','shipped','cancelled')),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);</code></pre>
<p>Chaque contrainte ici est un bug qui ne pourra jamais atteindre la production. Un statut "shippd" est rejete au moment de l'ecriture au lieu de casser un rapport trois semaines plus tard.</p>

<h2>Normalisez d'abord, denormalisez sur preuve</h2>
<p>Je commence normalise : chaque fait vit a un seul endroit. Une donnee dupliquee est une verite dupliquee, et les copies divergent des que quelqu'un en met une a jour et oublie l'autre. La normalisation garde les ecritures simples et la justesse peu couteuse.</p>
<p>La denormalisation est une optimisation de performance, et comme toute optimisation je veux une mesure avant de la faire. Quand une requete precise est vraiment trop lente et que le profil pointe les jointures, alors je vais cacher une valeur calculee ou dupliquer une colonne, sachant que je prends en charge la synchronisation des copies. Le faire par anticipation, c'est ainsi qu'on obtient un schema plein de champs auxquels personne ne fait confiance.</p>

<h2>Choisissez cles et types deliberement</h2>
<p>Chaque table recoit une cle primaire synthetique, en general un bigint identite ou un UUID. J'evite les cles naturelles comme les adresses e-mail en cle primaire, car la seule chose que vous pouvez promettre d'une cle naturelle, c'est qu'elle changera, et changer une cle primaire referencee partout est un calvaire. Utilisez des types qui veulent dire quelque chose :</p>
<ul>
  <li>Stockez l'argent en centimes entiers, jamais en flottants. Le flottant et la monnaie sont de vieux ennemis.</li>
  <li>Utilisez toujours un horodatage avec fuseau pour le temps, et stockez en UTC.</li>
  <li>Prenez un enum natif ou une contrainte de verification au lieu de champs de statut en texte libre.</li>
  <li>Utilisez le vrai type JSON de la base pour des donnees vraiment non structurees, pas un bloc de texte.</li>
</ul>

<h2>Indexez pour vos lectures, mais connaissez le cout</h2>
<p>Un index rend les lectures rapides et les ecritures un peu plus lentes, et il prend de la place. J'indexe les cles etrangeres, les colonnes que je filtre regulierement, et les colonnes par lesquelles je trie. Je n'indexe pas tout, car un index inutilise n'est que du poids sur chaque insertion. La facon de savoir, c'est de regarder : la plupart des bases vous diront quels index restent inutilises, et ceux-la sont candidats au retrait.</p>
<p>Les index composites valent la peine d'etre compris, car l'ordre des colonnes compte. Un index sur (customer_id, created_at) aide une requete qui filtre par client et trie par date, mais ne fait rien pour une requete qui ne filtre que par date. Le meme etat d'esprit d'observabilite que j'ai decrit dans <a href="/fr/blog/bonnes-pratiques-observabilite/">les bonnes pratiques d'observabilite</a> s'applique ici : mesurez les vrais schemas de requete avant de deviner.</p>

<h2>Traitez les migrations comme du code</h2>
<p>Chaque changement de schema passe par un fichier de migration, verse dans la gestion de versions, relu comme tout autre changement. Aucune instruction ALTER manuelle lancee a la main en production, jamais, car l'environnement suivant ne l'aura pas et vous passerez une journee a chasser la difference. La meme discipline de relecture que dans <a href="/fr/blog/bonnes-pratiques-revue-de-code/">les bonnes pratiques de revue de code</a> s'applique, avec un soin supplementaire, puisqu'une mauvaise migration peut verrouiller une table ou perdre des donnees.</p>
<ul>
  <li>Faites des migrations vers l'avant et additives quand vous le pouvez. Ajoutez une colonne, remplissez-la, puis retirez l'ancienne plus tard dans une etape separee.</li>
  <li>Evitez les changements qui prennent un long verrou exclusif sur une grande table en service.</li>
  <li>Testez la migration sur une copie de donnees a la taille de la production avant de la lancer pour de vrai.</li>
</ul>
<p>Un schema que vous pouvez faire evoluer en securite vaut plus qu'un schema parfait que vous avez peur de toucher. Construisez pour le changement, car le changement est la seule certitude.</p>
`
  },
  {
    title: 'Bonnes pratiques de journalisation et d\'observabilite',
    slug: 'bonnes-pratiques-observabilite',
    excerpt: 'Quand la production casse a 3h du matin, vos logs et vos metriques sont la seule chose entre vous et les suppositions.',
    category: 'Bonnes Pratiques',
    tags: ['observabilite', 'journalisation', 'supervision', 'exploitation'],
    pexels: 'server monitoring dashboard',
    content: `
<p>Vous decouvrez la qualite de votre observabilite au pire moment possible : quand quelque chose est casse, que les clients le remarquent, et que vous ne savez pas pourquoi. Tout ce que je fais ici vise ce moment. Le but est de repondre a "que se passe-t-il et pourquoi" en minutes, pas en heures. Une bonne observabilite, c'est la difference entre un incident calme et un incident frenetique.</p>

<h2>Journalisez des donnees structurees, pas des phrases</h2>
<p>Les lignes de log lisibles par l'humain semblent sympathiques jusqu'a ce que vous deviez en chercher dix millions. Alors vous ecrivez des regex fragiles contre de la prose. Je journalise des enregistrements structures, cle-valeur ou JSON, pour que les logs soient interrogeables comme une base plutot que fouilles comme un journal intime.</p>
<pre><code>// Pas ca :
log.info("Utilisateur " + userId + " echec connexion depuis " + ip)

// Ca :
log.info("login_failed", {
  user_id: userId,
  ip: ip,
  reason: "bad_password",
  attempt: 3
})</code></pre>
<p>Maintenant "montre-moi toutes les connexions echouees de cet utilisateur dans la derniere heure" est un filtre, pas un projet d'archeologie. Choisissez des noms de champ coherents entre services pour que le meme concept ait la meme cle partout, et une requete ecrite une fois fonctionne sur tout le systeme.</p>

<h2>Utilisez les niveaux avec discipline</h2>
<p>Les niveaux de log n'aident que s'ils veulent dire quelque chose de coherent. Quand tout est journalise en INFO, le niveau n'est que du bruit. Ma regle empirique :</p>
<ul>
  <li>ERROR, c'est quelque chose de casse qu'un humain doit regarder. Si ca ne merite pas d'attention, ce n'est pas une erreur.</li>
  <li>WARN, c'est inattendu mais gere, le genre de chose qu'il vaut la peine de surveiller pour un motif.</li>
  <li>INFO, ce sont des evenements metier importants : une commande passee, un travail termine.</li>
  <li>DEBUG, c'est du detail pour le developpement local, en general coupe en production.</li>
</ul>
<p>Le test pour ERROR est simple : si une alerte se declenchait pour chacun, seriez-vous en colere ? Si oui, ce n'est pas vraiment une erreur, et vous venez de vous entrainer a ignorer le niveau cense vous reveiller.</p>

<h2>Faites circuler un identifiant de requete partout</h2>
<p>Dans tout systeme a plus d'un service, une seule action utilisateur devient une douzaine de lignes de log eparpillees sur plusieurs machines. Sans un fil qui les relie, vous devinez. Je genere un identifiant de correlation a la frontiere et le passe a chaque appel en aval et dans chaque ligne de log. Alors un seul identifiant reconstitue tout le chemin d'une requete, pour la meme raison qui me pousse a garder des formes d'erreur coherentes dans <a href="/fr/blog/guide-conception-api-rest/">le guide de conception d'API REST</a> : quand autre chose doit suivre la piste, la structure gagne.</p>

<h2>Mesurez les trois choses qui parlent de sante</h2>
<p>Les logs parlent d'evenements precis. Les metriques parlent du systeme dans son ensemble, et ce sont elles qui font tourner vos tableaux de bord et vos alertes. Pour tout service qui traite des requetes, je suis le debit, les erreurs et la duree : combien de requetes, combien ont echoue, et combien de temps elles ont pris. Regarder la distribution de latence plutot que la moyenne compte, car la moyenne cache la queue lente ou les vrais utilisateurs souffrent.</p>
<ul>
  <li>Suivez la latence au 95e et au 99e percentile, pas seulement la moyenne.</li>
  <li>Suivez le taux d'erreur en pourcentage pour qu'il ait du sens a tout niveau de trafic.</li>
  <li>Suivez la saturation, le taux de remplissage de vos ressources, pour voir les ennuis avant qu'ils deviennent une panne.</li>
</ul>

<h2>Alertez sur les symptomes, pas sur les causes</h2>
<p>Une alerte devrait signifier qu'un humain doit agir maintenant. Sinon, ce devrait etre un tableau de bord, pas une alerte. La facon la plus rapide de faire detester l'astreinte, ce sont des alertes qui se declenchent sans cesse et ne veulent rien dire, car les gens apprennent a les balayer puis ratent celle qui comptait. J'alerte sur les symptomes vus par l'utilisateur, comme un taux d'erreur qui franchit un seuil ou une latence qui explose son budget, plutot que sur des causes internes comme un CPU eleve, qui peut etre parfaitement normal.</p>
<p>Une derniere chose qui paie : ne journalisez jamais de secrets, mots de passe, jetons ou details de paiement complets. Il est facile de les laisser fuiter dans les logs par accident, et les logs s'etalent sur des systemes aux controles d'acces plus faibles que votre base. Le meme soin guide par les contraintes que j'ai decrit dans <a href="/fr/blog/bonnes-pratiques-schema-base-de-donnees/">les bonnes pratiques de schema de base de donnees</a> vaut ici aussi. Decidez ce qui est sensible, puis assurez-vous que ca n'atteigne jamais une ligne de log.</p>
`
  }
];

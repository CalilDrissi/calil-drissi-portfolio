module.exports = [
  {
    title: 'Conception de bases de données et normalisation (et quand dénormaliser)',
    slug: 'conception-bdd-normalisation',
    excerpt: 'La normalisation est mon choix par défaut, mais ce n\'est pas une religion. Voici comment je conçois mes schémas, pourquoi les formes normales comptent encore, et les cas précis où je les enfreins volontairement.',
    category: 'Bases de Données',
    tags: ['conception bdd', 'normalisation', 'sql', 'modélisation'],
    pexels: 'server database racks',
    content: `
<p>J'ai hérité d'assez de schémas cassés pour avoir des avis tranchés. Les pires incidents que j'ai dû gérer ne venaient presque jamais d'un index manquant ou d'un disque lent. Ils venaient d'un modèle de données qui mentait. Une colonne qui voulait dire trois choses différentes selon la ligne. Un champ "statut" qui servait en secret de dépotoir à texte libre. Une clé étrangère qui existait dans la tête de quelqu'un mais jamais dans la base. Une bonne conception est l'assurance la moins chère que vous achèterez jamais, et vous l'achetez avant d'écrire la moindre requête.</p>

<p>Cet article explique comment j'aborde réellement la normalisation, ce que les formes normales apportent en pratique, et la poignée de situations où je dénormalise délibérément. Si vous voulez le volet collecte des besoins, je l'ai traité à part dans mon guide sur la <a href="/fr/blog/methodologie-modelisation-donnees/">méthodologie de modélisation des données</a>. Ici, on parle du schéma lui-même.</p>

<h2>Contre quoi la normalisation vous protège vraiment</h2>

<p>On parle de la normalisation comme d'un exercice académique. Elle ne l'est pas. Chaque forme normale existe pour empêcher une classe précise de bugs qui finira par vous réveiller à 3h du matin. Retirez le jargon formel et l'objectif est simple. Stocker chaque fait une seule fois, à l'endroit où il appartient, pour qu'il soit impossible que deux copies du même fait se contredisent.</p>

<p>Quand la même donnée vit à deux endroits, ces deux endroits finiront par diverger. Pas peut-être. Ils divergeront. Quelqu'un met à jour l'e-mail du client dans une table et oublie l'autre. Un batch touche la moitié des lignes. Vous avez maintenant deux vérités et aucun moyen de savoir laquelle est correcte. La normalisation supprime la seconde copie pour que la contradiction devienne impossible plutôt que simplement improbable.</p>

<h2>Les formes normales, à ma façon</h2>

<p>Je ne récite pas les définitions formelles, mais je garde leur intention en tête quand j'esquisse des tables.</p>

<ul>
  <li><strong>La première forme normale</strong> signifie pas de groupes répétés ni de colonnes multivaluées. Si vous nommez des colonnes telephone1, telephone2, telephone3, une table séparée attend de naître. Une liste séparée par des virgules dans un varchar est le même crime déguisé.</li>
  <li><strong>La deuxième forme normale</strong> signifie que chaque colonne non-clé dépend de toute la clé primaire, pas seulement d'une partie. Cela ne mord qu'avec des clés composites, mais quand ça mord, ça laisse une marque.</li>
  <li><strong>La troisième forme normale</strong> signifie que les colonnes non-clés dépendent de la clé et de rien d'autre que la clé. Si une colonne dépend d'une autre colonne non-clé, elle a sa propre table. L'exemple classique est de stocker une ville et son code postal ensemble alors que l'un détermine l'autre.</li>
</ul>

<p>Au quotidien, si j'atteins la troisième forme normale je suis généralement en bonne posture. Boyce-Codd et les formes supérieures comptent pour des cas précis de clés qui se chevauchent, mais la troisième forme normale attrape la grande majorité des vraies erreurs de modélisation que je vois en revue de code.</p>

<h2>Un exemple concret</h2>

<p>Disons que nous stockons des commandes. La version naïve entasse tout dans une seule table large, en répétant le nom et l'e-mail du client sur chaque ligne de commande. Voici la version normalisée que je livrerais réellement.</p>

<pre><code>-- Les clients possèdent leurs propres faits, une seule fois
CREATE TABLE customers (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email       CITEXT NOT NULL UNIQUE,
    full_name   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Les commandes référencent le client, elles ne le copient pas
CREATE TABLE orders (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id  BIGINT NOT NULL REFERENCES customers(id),
    status       TEXT NOT NULL
                 CHECK (status IN ('pending','paid','shipped','cancelled')),
    placed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Les lignes ont leur propre granularité : une ligne par produit par commande
CREATE TABLE order_items (
    order_id     BIGINT NOT NULL REFERENCES orders(id),
    product_id   BIGINT NOT NULL REFERENCES products(id),
    quantity     INT NOT NULL CHECK (quantity > 0),
    unit_price   NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);</code></pre>

<p>Remarquez quelques choix qui ne relèvent pas strictement des formes normales mais qui accompagnent une bonne conception. La colonne status a une contrainte CHECK pour que la base elle-même impose les valeurs autorisées. Le unit_price vit sur la ligne, pas sur le produit, parce que le prix au moment de la vente est un fait différent du prix actuel. Cette distinction est exactement le genre de chose que la normalisation vous oblige à voir. Est-ce la valeur actuelle ou la valeur telle qu'elle était ? Ce ne sont pas le même fait et ils n'appartiennent pas à la même colonne.</p>

<h2>Les contraintes font partie de la conception, pas de la décoration</h2>

<p>Un schéma sans contraintes est une suggestion. Je pousse autant d'invariants que raisonnablement possible dans la base, parce que le code applicatif est le mauvais endroit pour garantir l'intégrité des données. Il y aura toujours un second écrivain un jour. Un script de migration, un outil d'admin, un collègue qui fouille dans une session psql. La base est la seule couche qu'ils partagent tous.</p>

<p>J'utilise donc NOT NULL agressivement, des clés étrangères sans m'excuser, des contraintes UNIQUE sur tout ce qui doit être unique, et des contraintes CHECK pour les plages de valeurs et les énumérations. Si vous ne retenez qu'une habitude de cet article, prenez celle-là. La plupart des "données mystérieusement corrompues" que j'ai déboguées auraient été impossibles avec une contrainte qui prend trente secondes à écrire. J'approfondis ce point dans mes notes sur les <a href="/fr/blog/bonnes-pratiques-schema-base-de-donnees/">bonnes pratiques de schéma</a>.</p>

<h2>Quand je dénormalise volontairement</h2>

<p>Maintenant l'hérésie. Je dénormalise régulièrement, et je ne culpabilise pas, parce que la dénormalisation faite avec intention est une optimisation, pas une erreur. L'astuce est que vous ne dénormalisez qu'après avoir compris le motif d'accès, jamais avant. Une dénormalisation prématurée n'est qu'un modèle de données avec des bugs en plus.</p>

<p>Voici les cas où j'y ai recours.</p>

<ul>
  <li><strong>Agrégats à forte lecture.</strong> Si un tableau de bord lit le total d'une commande mille fois pour chaque fois où la commande change, recalculer ce total à chaque lecture est du gaspillage. Je stockerai une colonne total mise en cache et je la maintiendrai à jour avec un trigger ou dans la même transaction que l'écriture.</li>
  <li><strong>Tables de reporting et d'analyse.</strong> La normalisation transactionnelle et les motifs de requêtes analytiques tirent dans des sens opposés. Une table large dénormalisée ou un schéma en étoile peut transformer une jointure brutale à huit tables en un seul parcours. Je les garde séparées de la source de vérité et je les reconstruis à partir d'elle.</li>
  <li><strong>Jointures coûteuses sur le chemin chaud.</strong> Parfois une jointure est réellement le goulot même après indexation. Copier une colonne souvent lue pour éviter une jointure peut en valoir la peine, tant que vous maîtrisez le chemin de mise à jour.</li>
</ul>

<p>La règle non négociable dans chacun de ces cas est que la version normalisée reste la source de vérité. La copie dénormalisée est dérivée, jetable et reconstructible. Dès l'instant où vous avez deux sources de vérité indépendantes, vous revenez au péché originel que la normalisation servait à empêcher.</p>

<h2>Comment je garde la dénormalisation sûre</h2>

<p>Si je stocke une valeur dérivée, je rends la dérivation explicite et automatique. Une colonne en cache est mise à jour dans la même transaction que sa source, ou par un trigger, jamais par un commentaire optimiste disant "penser à mettre à jour ceci". Une vue matérialisée a un calendrier de rafraîchissement documenté. Une table de reporting est reconstruite par un job que je peux lancer à la demande et vérifier contre la source.</p>

<p>J'écris aussi un contrôle, même lent et exécuté la nuit, qui compare la valeur dérivée à un calcul frais et hurle s'ils diffèrent. La dérive est le mode de défaillance de la dénormalisation, et la seule défense est de la détecter tôt. Une fois que je peux prouver que la copie correspond à la source, le gain de performance arrive avec la conscience tranquille. Quand les copies commencent à diverger, c'est presque toujours parce qu'un plan de requête a changé ou qu'un index a disparu, exactement le terrain que je couvre dans mon <a href="/fr/blog/indexation-bases-de-donnees-guide/">guide de l'indexation</a>.</p>

<h2>L'ordre dans lequel je procède</h2>

<p>Ma séquence par défaut n'a pas changé depuis des années. Normaliser d'abord, jusqu'à la troisième forme normale, avec de vraies contraintes. Rendre le modèle correct et le laisser correct. Puis mesurer. Ce n'est que lorsqu'un motif d'accès précis et mesuré l'exige que j'introduis une copie dénormalisée, et uniquement comme un artefact dérivé avec un chemin de mise à jour imposé. La correction d'abord, puis la vitesse, et jamais une vitesse achetée au prix d'un mensonge dans les données.</p>

<p>Cet ordre compte parce qu'il est bien plus facile de dénormaliser un modèle propre que de nettoyer un modèle vaseux dès la naissance. Commencez strict. Relâchez délibérément. Votre futur vous, réveillé à 3h du matin, vous remerciera.</p>
`
  },
  {
    title: 'Une méthodologie pratique de modélisation des données, des besoins au schéma',
    slug: 'methodologie-modelisation-donnees',
    excerpt: 'La plupart des problèmes de schéma sont en réalité des problèmes de besoins déguisés en schéma. Voici le processus étape par étape que j\'utilise pour passer d\'une demande floue à des tables auxquelles je fais confiance.',
    category: 'Bases de Données',
    tags: ['modélisation', 'méthodologie', 'conception bdd', 'besoins'],
    pexels: 'whiteboard planning diagram',
    content: `
<p>Presque tous les schémas vraiment pénibles avec lesquels j'ai dû vivre ont commencé de la même façon. Quelqu'un a ouvert un fichier de migration et s'est mis à taper CREATE TABLE avant que personne n'ait convenu de ce que les données étaient réellement. Les tables sont venues en premier et la compréhension ensuite, ce qui est exactement à l'envers. Un schéma est le dernier artefact de la modélisation, pas le premier. Au moment où j'écris du SQL, la réflexion difficile est déjà faite.</p>

<p>Voici la méthodologie que j'utilise pour passer d'une demande floue à un schéma que j'accepte de signer. Elle n'est pas lourde. Elle ne demande pas d'outillage spécial. Elle demande surtout de ralentir le temps d'un après-midi pour avancer vite les deux années suivantes. Pour les principes de conception qui gouvernent le schéma final, associez ceci à mon article sur la <a href="/fr/blog/conception-bdd-normalisation/">normalisation et quand dénormaliser</a>.</p>

<h2>Étape un, rassembler les noms et les règles</h2>

<p>Je commence par lire ou écouter comment les gens qui font réellement le travail le décrivent. Pas les ingénieurs. Les gens du métier. Je chasse deux choses. Les noms, qui deviennent des entités candidates, et les règles, qui deviennent des contraintes et des relations.</p>

<p>Quand un coordinateur logistique dit "une expédition peut avoir plusieurs colis mais chaque colis appartient à exactement une expédition", il vient de me tendre une relation un-à-plusieurs et une clé étrangère NOT NULL, gratuitement, en langage clair. Les experts métier font déjà la modélisation. Mon travail est de l'écrire fidèlement et de remarquer quand leurs phrases se contredisent.</p>

<p>Je tiens un glossaire au fur et à mesure. L'outil de modélisation le plus sous-estimé est une définition convenue de chaque terme. Quand deux personnes utilisent le mot "compte" pour dire deux choses différentes, vous ne le découvrirez qu'en production, à moins d'avoir forcé la définition tôt.</p>

<h2>Étape deux, trouver les entités et leur identité</h2>

<p>À partir des noms, je dégage les vraies entités. Le test que j'applique est l'identité. Cette chose a-t-elle une existence propre que je dois référencer dans le temps ? Un client en a une. Une commande en a une. Une ligne de commande en a une. La couleur "bleu" généralement non, c'est un attribut, jusqu'au jour où le métier a besoin d'un catalogue de couleurs avec ses propres règles, et là elle gagne son statut d'entité.</p>

<p>Pour chaque entité je pose immédiatement une question. Qu'est-ce qui rend une ligne unique ? Parfois il existe une clé naturelle, comme un code pays ISO. Plus souvent non, et j'ajoute une clé de substitution, une colonne d'identité générée sans signification métier. Je penche vers les clés de substitution pour la plupart des entités parce que les clés naturelles ont la fâcheuse habitude de changer, et une clé primaire qui change est une clé primaire qui gâche votre semaine.</p>

<h2>Étape trois, cartographier les relations</h2>

<p>Maintenant je connecte les entités, et je suis précis sur la cardinalité parce que c'est là que le schéma se décide.</p>

<ul>
  <li><strong>Un-à-plusieurs</strong> est le cas courant. Le côté "plusieurs" porte une clé étrangère pointant vers le côté "un". Une commande a plusieurs lignes, donc order_items porte le order_id.</li>
  <li><strong>Plusieurs-à-plusieurs</strong> devient toujours une table de jonction. Il n'y a pas d'autre façon honnête de le représenter. Étudiants et cours se rencontrent dans une table inscriptions qui porte les deux clés étrangères.</li>
  <li><strong>Un-à-un</strong> est rare et mérite la méfiance. Cela signifie souvent soit une entité que vous avez scindée sans raison, soit une extension optionnelle qui appartient vraiment à sa propre table. Je m'oblige à justifier chaque un-à-un.</li>
</ul>

<p>Pour chaque relation je fixe aussi les règles de participation. La clé étrangère est-elle obligatoire ou optionnelle ? Que doit-il se passer à la suppression ? Ce ne sont pas des détails après coup. Le comportement ON DELETE est une vraie décision métier déguisée en décision technique, et le métier devrait avoir voix au chapitre.</p>

<h2>Étape quatre, les attributs et la question de la granularité</h2>

<p>Avec les entités et les relations en place, j'attache les attributs, et pour chacun je demande ce qu'il est vraiment. Est-il atomique, ou cache-t-il plusieurs faits entassés ensemble ? Un champ "nom" que tout le monde veut chercher par prénom et nom de famille, c'est deux colonnes qui se font passer pour une. Une adresse en est presque toujours plusieurs.</p>

<p>La question la plus importante à ce stade est la granularité. Que représente une ligne de cette table, exactement, en une phrase ? Si je ne peux pas le dire proprement, la table est confuse et les requêtes le seront aussi. "Une ligne par commande" est une granularité claire. "Une ligne par commande, sauf parfois par expédition" est un futur rapport d'incident.</p>

<h2>Étape cinq, écrire le schéma et laisser la base aider</h2>

<p>Ce n'est que maintenant que j'écris du SQL, et à ce stade il s'écrit presque tout seul, parce que la réflexion est terminée. Voici le genre de chose qui découle des étapes ci-dessus pour un simple domaine d'inscription aux cours.</p>

<pre><code>-- Une ligne par étudiant
CREATE TABLE students (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email       CITEXT NOT NULL UNIQUE,
    full_name   TEXT NOT NULL,
    enrolled_on DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Une ligne par cours proposé
CREATE TABLE courses (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code      TEXT NOT NULL UNIQUE,     -- clé naturelle, stable par catalogue
    title     TEXT NOT NULL,
    capacity  INT NOT NULL CHECK (capacity > 0)
);

-- La table de jonction : une ligne par étudiant par cours
CREATE TABLE enrollments (
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id  BIGINT NOT NULL REFERENCES courses(id)  ON DELETE RESTRICT,
    grade      TEXT CHECK (grade IN ('A','B','C','D','F') OR grade IS NULL),
    PRIMARY KEY (student_id, course_id)
);</code></pre>

<p>Regardez combien du modèle est désormais imposé par la base plutôt que laissé à l'espoir. Le plusieurs-à-plusieurs devient une clé primaire composite, ce qui empêche aussi un étudiant de s'inscrire deux fois au même cours sans aucun code applicatif. Les deux choix ON DELETE différents encodent une vraie règle : supprimer un étudiant retire ses inscriptions, mais vous ne pouvez pas supprimer un cours qui a encore des étudiants.</p>

<h2>Étape six, valider contre les requêtes que vous exécuterez</h2>

<p>Un modèle ne vaut que par les questions auxquelles il sait répondre. Avant de le déclarer terminé, je prends les cinq ou dix requêtes que l'application exécutera le plus souvent et je les écris contre le schéma sur papier. Si une question courante exige une jointure tordue à cinq tables ou une sous-requête imbriquée trois niveaux de profondeur, le modèle se bat contre la charge et je reviens une étape en arrière.</p>

<p>C'est aussi là que les motifs d'accès commencent à éclairer l'indexation, même si je garde cela comme une préoccupation distincte. Rendez le modèle honnête d'abord, puis rendez-le rapide. Je détaille le volet performance dans mon <a href="/fr/blog/indexation-bases-de-donnees-guide/">guide de l'indexation des bases de données</a>.</p>

<h2>Étape sept, prévoir le changement</h2>

<p>Aucun modèle ne survit intact au contact d'une feuille de route, alors je conçois pour l'évolution dès le départ. J'évite les colonnes qui veulent dire des choses différentes selon les lignes. Je préfère ajouter une colonne nullable ou une nouvelle table plutôt que de surcharger une colonne existante. Je tiens une discipline de migration où chaque changement de schéma est un fichier versionné et révisable, jamais une édition manuelle d'une base en production.</p>

<p>L'état d'esprit qui m'a le mieux servi est celui-ci. Modéliser, c'est écrire ce qui est vrai du monde, avec assez de soin pour que la base puisse l'imposer. Le SQL n'est que la transcription. Faites la réflexion d'abord, écrivez le schéma en dernier, validez-le contre les vraies questions, et vous obtenez des tables ennuyeuses dans le meilleur sens du terme. Les schémas ennuyeux ne vous réveillent pas.</p>
`
  },
  {
    title: 'Indexation des bases de données et optimisation des requêtes, plongée en profondeur',
    slug: 'indexation-bases-de-donnees-guide',
    excerpt: 'Les index sont l\'outil le plus puissant pour la performance d\'une base, et aussi le plus facile à mal régler subtilement. Voici comment les index fonctionnent vraiment et comment je lis les plans de requête pour les exploiter.',
    category: 'Bases de Données',
    tags: ['indexation', 'optimisation requêtes', 'performance', 'sql'],
    pexels: 'data center servers',
    content: `
<p>Si vous me donnez une requête lente et une heure, le correctif est un index plus souvent que toute autre chose. Les index sont l'outil de performance le plus puissant d'une base relationnelle, et c'est aussi là que je vois l'intuition la plus confiante et la plus fausse. Les gens ajoutent un index sur chaque colonne "au cas où", ou ils ajoutent un index multi-colonnes dans le mauvais ordre et se demandent pourquoi le planificateur l'ignore. Voici mon modèle mental de fonctionnement des index et de la manière dont je décide lesquels construire.</p>

<p>Rien de tout cela ne compte si le schéma en dessous est un désastre, donc si ce n'est pas déjà fait, les fondations viennent d'une bonne <a href="/fr/blog/conception-bdd-normalisation/">conception et normalisation</a>. Supposons ici que le modèle est sain et que nous le rendons rapide.</p>

<h2>Ce qu'est réellement un index</h2>

<p>Un index est une structure de données séparée et triée qui permet à la base de trouver des lignes sans parcourir toute la table. Le choix par défaut dans la plupart des bases relationnelles est un arbre B, qui maintient les clés en ordre trié et prend en charge les recherches d'égalité et les parcours de plage en temps logarithmique. Cet ordre trié est tout l'intérêt, et il explique presque tout ce qu'un index peut et ne peut pas faire.</p>

<p>Parce que les clés sont triées, un arbre B est excellent pour trois choses. Trouver une valeur précise, trouver une plage de valeurs, et renvoyer des lignes déjà triées pour que la base puisse sauter une étape de tri séparée. Il est inutile pour l'inverse. Une requête qui demande tout sauf une valeur, ou qui enveloppe la colonne dans une fonction que l'index ne connaît pas, ne peut pas utiliser la structure triée et retombe sur un parcours complet.</p>

<h2>Le coût dont personne ne parle</h2>

<p>Chaque index que vous ajoutez rend les lectures plus rapides et les écritures plus lentes. Ce n'est pas un slogan, c'est mécanique. Quand vous insérez, mettez à jour ou supprimez une ligne, la base doit mettre à jour chaque index couvrant les colonnes touchées. Une table avec huit index paie huit petites opérations de maintenance à chaque écriture. Les index prennent aussi de l'espace disque et de la mémoire, et un index gonflé qui ne tient pas en cache cesse d'être l'accélération que vous vouliez.</p>

<p>Je n'indexe donc pas par défense. J'indexe en réponse à des preuves. Le bon nombre d'index est le plus petit ensemble qui rend vos vraies requêtes rapides, et trouver cet ensemble passe par la lecture des plans de requête plutôt que par la devinette.</p>

<h2>Lire le plan de requête</h2>

<p>La compétence la plus utile en performance de base de données est la lecture de la sortie EXPLAIN. Elle vous dit ce que le planificateur a l'intention de faire, et EXPLAIN ANALYZE vous dit ce qui s'est réellement passé avec des temps réels. Je le lance en permanence.</p>

<pre><code>-- Voir le plan et les vrais chiffres d'exécution
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, placed_at
FROM orders
WHERE customer_id = 42
  AND status = 'paid'
ORDER BY placed_at DESC
LIMIT 20;</code></pre>

<p>Ce que je regarde, dans l'ordre. Y a-t-il un parcours séquentiel sur une grande table où j'attendais un parcours d'index ? C'est l'alarme la plus bruyante. À quel point l'estimation de lignes du planificateur est-elle éloignée du nombre réel ? Un grand écart signifie des statistiques périmées et je lance ANALYZE sur la table. Y a-t-il un tri coûteux qu'un index pourrait satisfaire directement ? La même table est-elle parcourue plus d'une fois ?</p>

<h2>Index composites et ordre des colonnes</h2>

<p>Les index multi-colonnes sont là où le plus de points se gagnent et se perdent. La règle que j'ai mis trop de temps à intérioriser est que l'ordre des colonnes est primordial, et il découle de la structure triée. Un index sur (customer_id, status, placed_at) est trié d'abord par customer_id, puis par status, puis par placed_at. Cet ordre lui permet de servir une requête filtrant sur customer_id seul, ou customer_id et status, ou les trois. Il ne peut pas servir efficacement une requête qui filtre uniquement sur status, parce que status n'est pas la colonne de tête.</p>

<p>La ligne directrice que j'utilise est les colonnes d'égalité d'abord, puis la colonne de plage ou de tri en dernier. Pour la requête ci-dessus, un index sur (customer_id, status, placed_at) est proche de l'idéal. Les deux prédicats d'égalité restreignent la recherche, et parce que placed_at est la dernière colonne et déjà triée, la base peut satisfaire le ORDER BY et le LIMIT sans tri séparé. Un index, pas d'étape de tri, vingt lignes.</p>

<pre><code>-- Colonnes d'égalité d'abord, puis la colonne de tri
CREATE INDEX idx_orders_customer_status_time
    ON orders (customer_id, status, placed_at DESC);</code></pre>

<h2>Index couvrants et parcours index-only</h2>

<p>Il y a une astuce supplémentaire. Si un index contient toutes les colonnes dont une requête a besoin, la base peut répondre à la requête depuis le seul index et ne jamais toucher la table. C'est un parcours index-only, et il peut être bien plus rapide parce qu'il évite les lectures aléatoires de retour vers le tas. J'y arrive en incluant les colonnes supplémentaires que la requête renvoie.</p>

<pre><code>-- INCLUDE ajoute des colonnes de charge utile sans changer la clé de tri
CREATE INDEX idx_orders_cover
    ON orders (customer_id, status)
    INCLUDE (placed_at, id);</code></pre>

<p>Je ne fais pas cela partout, parce que des index plus larges coûtent plus cher à maintenir et à stocker. Mais pour une requête chaude et bien comprise qui tourne en permanence, la transformer en parcours index-only est l'un des meilleurs retours sur effort disponibles.</p>

<h2>Les index que le planificateur refusera discrètement</h2>

<p>Un nombre surprenant d'index restent inutilisés à cause de la façon dont la requête est écrite, pas de la façon dont l'index est construit. Les erreurs classiques que je cherche en premier.</p>

<ul>
  <li><strong>Fonctions sur la colonne indexée.</strong> WHERE lower(email) = 'x' ne peut pas utiliser un index simple sur email. Stockez la valeur normalisée, utilisez un type insensible à la casse, ou construisez un index d'expression sur lower(email).</li>
  <li><strong>Jokers en tête.</strong> LIKE 'foo%' peut utiliser un arbre B, mais LIKE '%foo' ne le peut pas, parce que l'ordre trié est inutile quand le début de la chaîne est inconnu.</li>
  <li><strong>Incompatibilités de type.</strong> Comparer une colonne texte à un nombre force une conversion qui peut désactiver l'index. Faites correspondre vos types.</li>
  <li><strong>Faible sélectivité.</strong> Un index sur une colonne à deux valeurs possibles aide rarement, parce que lire l'index plus le tas est souvent plus lent qu'un simple parcours. Le planificateur le sait et le saute, à juste titre.</li>
</ul>

<h2>Index partiels pour données asymétriques</h2>

<p>L'un de mes outils préférés pour les charges réelles est l'index partiel, qui ne couvre que les lignes correspondant à une condition. Si 95 pour cent de vos commandes sont terminées et que vous interrogez presque toujours la petite tranche encore en attente, n'indexer que les lignes en attente vous donne un index minuscule et rapide qui reste chaud en mémoire.</p>

<pre><code>-- Indexer seulement les lignes que nous cherchons réellement
CREATE INDEX idx_orders_pending
    ON orders (placed_at)
    WHERE status = 'pending';</code></pre>

<p>Cela garde l'index petit, ce qui le garde rapide et peu coûteux à maintenir. Pour les tables à forte asymétrie c'est souvent la différence entre un index qui tient en cache et un qui n'y tient pas.</p>

<h2>Comment je travaille réellement</h2>

<p>Ma boucle est ennuyeuse et elle marche. Trouver la requête lente à partir de vraies métriques, pas d'une intuition. Lancer EXPLAIN ANALYZE et le lire attentivement. Identifier si le problème est un index manquant, un mauvais ordre de colonnes, des statistiques périmées, ou une requête écrite d'une façon qui défait l'indexation. Faire un changement. Mesurer à nouveau. Répéter jusqu'à ce que le plan soit propre.</p>

<p>Je résiste à l'envie d'ajouter cinq index d'un coup, parce qu'alors je ne peux pas dire lequel a aidé et j'ai souscrit à un surcoût d'écriture dont je n'ai peut-être pas besoin. Un changement, une mesure. Et je révise l'ensemble des index périodiquement, parce que les charges dérivent et l'index essentiel d'hier peut devenir le poids mort d'aujourd'hui qui ne fait que ralentir les écritures. Le même soin qui va dans le schéma et le <a href="/fr/blog/methodologie-modelisation-donnees/">modèle de données</a> va dans le maintien d'index honnêtes. Mesurer, changer une chose, mesurer à nouveau. Cette discipline bat l'astuce à tous les coups.</p>
`
  }
];

module.exports = [
  {
    title: 'Les patterns de scalabilite backend qui tiennent vraiment sous la charge',
    slug: 'patterns-scalabilite-backend',
    excerpt: 'Cache, files de messages, repartition de charge et statelessness. Les patterns de scalabilite que je dégaine quand un backend commence à céder, et l ordre dans lequel je les applique.',
    category: 'Backend',
    tags: ['scalabilite', 'cache', 'repartition de charge', 'architecture'],
    pexels: 'server room network',
    content: `
<p>La plupart des backends ne s effondrent pas à cause d un seul gros problème. Ils s effondrent à cause d une douzaine de petites hypothèses qui tenaient très bien à mille requêtes par jour et qui cessent discrètement de tenir à un million. J ai passé une bonne partie de ma carrière à traquer ces hypothèses, souvent à trois heures du matin, et les patterns ci dessous sont ceux vers lesquels je reviens toujours. Aucun n est exotique. La compétence, c est de savoir lequel appliquer et quand s arrêter.</p>

<h2>Scaler verticalement avant de scaler horizontalement</h2>
<p>La première question que je pose quand un service souffre, c est de savoir si je peux simplement lui donner une machine plus grosse. La scalabilité verticale a mauvaise réputation parce qu elle a un plafond, mais ce plafond est bien plus haut qu on ne le croit. Une instance moderne avec 64 cœurs et 256 gigaoctets de mémoire encaisse une quantité énorme de trafic, et vous l obtenez sans toucher à votre code, à votre déploiement ni à votre modèle mental du système.</p>
<p>La scalabilité horizontale, c est quand vous ajoutez des machines et répartissez le travail entre elles. Elle va plus loin, mais elle vous impose des décisions. L état doit vivre quelque part de partagé. Les requêtes doivent être routées. Les pannes se multiplient parce que vous avez désormais dix choses qui peuvent casser au lieu d une. Ma règle est simple. Je scale verticalement jusqu à ce que ça devienne cher ou que j atteigne le plafond de l instance, et seulement alors je scale horizontalement. Déployer une flotte de minuscules nœuds dès le premier jour, c est la meilleure façon de déboguer des problèmes de systèmes distribués que vous n aviez pas encore besoin d avoir.</p>

<h2>La statelessness rend tout le reste possible</h2>
<p>Vous ne pouvez pas répartir le trafic sur plusieurs serveurs si l un d eux est secrètement spécial. Dès qu une requête ne fonctionne que parce qu elle est tombée sur la même machine que la requête précédente, la scalabilité horizontale est morte. C est pour ça que je traite la statelessness comme une fondation plutôt qu une optimisation.</p>
<p>En pratique, cela veut dire pas de données de session en mémoire locale, pas de fichiers uploadés posés sur le disque local, pas de compteurs en mémoire qui comptent. Poussez l état de session dans Redis ou dans un token signé. Poussez les fichiers dans du stockage objet. Poussez tout ce qui est durable dans une base de données. Quand chaque nœud applicatif est interchangeable, un répartiteur de charge peut envoyer une requête à n importe lequel, vous pouvez ajouter et retirer des nœuds librement, et un nœud planté ne vous coûte que les requêtes en cours qu il portait.</p>
<p>Si vous voulez le contexte plus large de la place de tout ça dans un système, j en ai parlé dans <a href="/fr/blog/architecture-fullstack-moderne/">l architecture fullstack moderne</a>, où la statelessness réapparaît comme une condition pour des déploiements propres.</p>

<h2>La répartition de charge et comment une requête trouve un foyer</h2>
<p>Une fois que vous avez plusieurs nœuds interchangeables, quelque chose doit décider où va chaque requête. Un répartiteur de charge se place devant et distribue le trafic. Le round robin est le point de départ évident et il convient pour des charges uniformes, mais il devient vite bête quand le coût des requêtes varie. Least connections est généralement un meilleur choix par défaut parce qu il envoie le nouveau travail au nœud le moins occupé à l instant présent.</p>
<p>Ce que les gens oublient, ce sont les health checks. Un répartiteur ne vaut que par sa capacité à repérer un nœud malade et à cesser de lui envoyer du trafic. Je configure toujours des health checks actifs avec un vrai endpoint qui touche les dépendances critiques, pas une route qui renvoie 200 quoi qu il arrive.</p>
<pre><code>upstream api_backend {
    least_conn;
    server 10.0.1.10:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl;
    location / {
        proxy_pass http://api_backend;
        proxy_next_upstream error timeout http_502 http_503;
    }
    location /healthz {
        access_log off;
        proxy_pass http://api_backend;
    }
}</code></pre>

<h2>Le cache, le levier au plus fort rendement</h2>
<p>Rien ne vous offre de la marge plus vite que de ne pas faire le travail deux fois. Le cache est l outil au plus fort rendement de toute cette liste, et il opère à plusieurs niveaux. Il y a le CDN en bordure pour les ressources statiques et les réponses cacheables. Il y a un cache applicatif comme Redis ou Memcached pour les résultats calculés et les lignes chaudes. Il y a le cache de requêtes de la base et le cache de pages du système d exploitation en dessous. Chaque niveau depuis lequel vous pouvez servir est un niveau de travail que les niveaux inférieurs ne voient jamais.</p>
<p>Le difficile n est jamais de lire depuis un cache. C est l invalidation. Un cache périmé est pire que pas de cache parce qu il ment avec aplomb. Je m appuie beaucoup sur l expiration par durée parce qu elle est prévisible, et je ne passe à l invalidation par événement que quand la péremption fait vraiment mal. Le cache-aside est mon pattern par défaut : on vérifie le cache, en cas de miss on va à la source, puis on réécrit le résultat avec un TTL.</p>
<pre><code>def get_user(user_id):
    key = "user:" + str(user_id)
    cached = redis.get(key)
    if cached is not None:
        return deserialize(cached)
    user = db.query("SELECT * FROM users WHERE id = %s", user_id)
    redis.setex(key, 300, serialize(user))
    return user</code></pre>
<p>Deux modes de défaillance méritent d être nommés. Une ruée sur le cache survient quand une clé populaire expire et que mille requêtes ratent en même temps et frappent la base ensemble. On la combat avec des TTL jitterés ou un court verrou pour qu une seule requête reconstruise la valeur. Le second, c est la croissance non bornée, que l on gère avec une politique d éviction comme LRU et un plafond mémoire.</p>

<h2>Les files de messages, ou comment arrêter le travail lent dans le chemin de la requête</h2>
<p>Une grande partie de ce qui rend les requêtes lentes n a pas besoin de se produire pendant que l utilisateur attend. Envoyer un email, redimensionner une image, générer un rapport, synchroniser avec un tiers. Si l appelant n a pas besoin du résultat tout de suite, sortez le du chemin de la requête et mettez le dans une file. Le tier web accepte le job, le confie à un broker comme RabbitMQ ou SQS, répond immédiatement, et un pool de workers avale le backlog à son propre rythme.</p>
<p>Cela fait deux choses. Ça rend votre latence prévisible parce que la requête n attend plus le travail lent en aval. Et ça absorbe les pics, parce qu une file est un tampon. Quand le trafic triple pendant une heure, la file grossit et les workers rattrapent ensuite au lieu que tout le système fonde. Ce qu il faut absolument réussir, c est l idempotence. Les files redélivrent. Un message finira par être traité plus d une fois, donc chaque worker doit pouvoir tourner deux fois sur la même entrée sans danger.</p>
<ul>
  <li>Rendez les handlers idempotents avec une clé de déduplication ou un upsert pour qu une redélivrance soit sans effet.</li>
  <li>Configurez une dead letter queue pour que les messages empoisonnés cessent de bloquer la file et atterrissent quelque part où vous pouvez les inspecter.</li>
  <li>Surveillez la profondeur de la file comme une métrique de premier plan. Une file qui grossit est le tout premier signe que les workers ne suivent plus.</li>
</ul>

<h2>Backpressure et dégradation gracieuse</h2>
<p>Scaler, ce n est pas seulement encaisser plus. C est échouer correctement quand on ne peut pas. Un système en vraie surcharge devrait délester volontairement plutôt que s effondrer. Je place des limites de débit aux bords, des timeouts sur chaque appel sortant, et des circuit breakers autour des dépendances instables pour qu un service aval lent n empile pas les threads et n emporte pas tout le processus avec lui.</p>
<p>La dégradation gracieuse, c est décider à l avance de ce qu on lâche en premier. Si le service de recommandation est en panne, montrez une liste générique au lieu d une page d erreur. Si le cache est froid, servez des données un peu périmées plutôt que rien. Les utilisateurs qui ont une expérience dégradée sont bien plus contents que ceux qui reçoivent une 500.</p>

<h2>Où se place la base de données</h2>
<p>Tout ce qui précède achète du temps, mais finit par buter sur la base de données, qui est presque toujours le vrai goulot. Le cache réduit les lectures, les files lissent les écritures, mais passé un certain point la couche de données elle même doit scaler. C est un sujet assez vaste pour que je lui aie consacré un article dédié sur <a href="/fr/blog/scaler-bases-de-donnees-replication-sharding/">scaler les bases de données avec la réplication et le sharding</a>, et si votre schéma vous résiste avant même d en arriver là, corrigez ça d abord avec <a href="/fr/blog/bonnes-pratiques-schema-base-de-donnees/">une conception de schéma solide</a>.</p>

<h2>L ordre dans lequel je les applique vraiment</h2>
<p>Si je devais compresser tout ça en une séquence, ce serait celle ci. Rendre le service stateless pour qu il puisse scaler tout court. Scaler verticalement jusqu à ce que ce ne soit plus rentable. Mettre un répartiteur de charge et plus de nœuds devant. Ajouter du cache aux niveaux qui font le plus mal. Déplacer le travail lent vers des files. Ajouter du backpressure pour que la surcharge dégrade au lieu de planter. Et ensuite, en général seulement, faire le travail plus dur de scaler la base de données. Mesurez à chaque étape, parce que le goulot est rarement là où votre intuition le situe, et ajouter de la capacité à la mauvaise couche ne fait que déplacer la file.</p>
`
  },
  {
    title: 'Scaler les bases de données : replicas de lecture, sharding et partitionnement',
    slug: 'scaler-bases-de-donnees-replication-sharding',
    excerpt: 'La base de données est l endroit où la plupart des backends butent vraiment. Voici comment je pense les replicas de lecture, le partitionnement et le sharding, et l ordre dans lequel je les dégaine.',
    category: 'Backend',
    tags: ['bases de donnees', 'replication', 'sharding', 'partitionnement'],
    pexels: 'data center storage',
    content: `
<p>Presque toutes les histoires de scaling que j ai vécues finissent à la base de données. Vous pouvez mettre du cache, des files, ajouter une centaine de nœuds applicatifs stateless, et tout ça aide jusqu au moment où une seule base de données primaire est la chose que tous ces nœuds attendent. À ce stade, vous devez scaler la couche de données elle même, et c est un autre genre de problème parce que les données ont du poids. Déplacer du calcul est facile. Déplacer et découper des données sans les perdre ni les corrompre, c est là que vit la vraie ingénierie.</p>
<p>J y pense comme à une échelle. Chaque barreau est plus puissant et plus douloureux que le précédent, et vous ne devriez monter que jusqu où vous en avez réellement besoin.</p>

<h2>D abord, épuiser les gains faciles</h2>
<p>Avant tout changement d architecture, je m assure que la base ne fait pas simplement du travail inutile. La cause la plus fréquente d une base qui semble trop petite, c est une base à qui il manque des index, qui fait des scans séquentiels sur de grandes tables, ou qui se fait marteler par des requêtes qui auraient dû être cachées. L épuisement du pool de connexions se déguise constamment en problème de scaling. Un schéma bien indexé sur une instance bien dimensionnée encaisse bien plus qu on ne le croit, et je couvre les fondations dans <a href="/fr/blog/bonnes-pratiques-schema-base-de-donnees/">les bonnes pratiques de schéma de base de données</a>. Ne shardez pas une base à qui il manque juste un index.</p>

<h2>Les replicas de lecture, le premier vrai levier</h2>
<p>La plupart des applications lisent bien plus qu elles n écrivent. Timelines, fiches produit, tableaux de bord, résultats de recherche, tout ça ce sont des lectures. Donc le premier mouvement structurel est presque toujours les replicas de lecture. Vous gardez une primaire qui accepte toutes les écritures, et vous diffusez ses changements vers une ou plusieurs copies replicas qui servent les lectures. Désormais votre capacité de lecture scale avec le nombre de replicas pendant que les écritures restent sur la primaire.</p>
<p>Le piège, c est le retard de réplication. Un replica est une copie toujours un peu en retard, généralement de quelques millisecondes mais parfois de quelques secondes sous charge. Cela crée une classe de bug subtile : un utilisateur écrit quelque chose, est redirigé, la lecture part vers un replica pas encore à jour, et sa propre modification semble avoir disparu. La solution, c est le routage read your writes. Après une écriture, envoyez les lectures de cet utilisateur vers la primaire pendant un court instant, ou pour tout ce où l utilisateur s attend à voir sa propre action immédiatement.</p>
<pre><code>def get_connection(query_type, just_wrote=False):
    if query_type == "write" or just_wrote:
        return primary_pool.get()
    return replica_pool.get()  # round robin sur les replicas

# Apres mise a jour d un profil, lire depuis la primaire brievement
update_profile(user_id, data)
profile = read_profile(user_id, just_wrote=True)</code></pre>
<p>Les replicas vous donnent aussi autre chose que de la capacité. Ils sont un secours à chaud. Si la primaire meurt, vous pouvez promouvoir un replica, ce qui fait des replicas un élément de votre disponibilité et pas seulement de votre performance.</p>

<h2>Le partitionnement, découper sensément une grosse table</h2>
<p>Les replicas multiplient votre capacité de lecture mais chaque replica détient encore tout le jeu de données, et les écritures vont toujours toutes à une primaire. Quand une seule table atteint des centaines de millions de lignes, la table elle même devient le problème. Les index s alourdissent, le vacuum et la maintenance ralentissent, et les requêtes qui touchent toute la table traînent. Le partitionnement découpe une table logique en plusieurs morceaux physiques tout en gardant une seule primaire.</p>
<p>Le type le plus utile est le partitionnement par plage de temps. La plupart des grandes tables sont en ajout massif et ordonnées dans le temps : événements, logs, commandes, messages. Si vous partitionnez par mois, une requête sur la semaine dernière ne touche qu une seule partition, et supprimer les vieilles données devient un détachement instantané d une partition entière au lieu d un delete massif.</p>
<pre><code>CREATE TABLE events (
    id        BIGSERIAL,
    user_id   BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload   JSONB
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_06 PARTITION OF events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE events_2026_07 PARTITION OF events
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');</code></pre>
<p>Ce qu il faut comprendre, c est que le partitionnement reste un seul serveur de base de données. Il aide pour la taille des tables, la maintenance, et les requêtes qui peuvent élaguer vers une seule partition. Il ne fait rien pour le débit d écriture de la machine dans son ensemble, parce que toutes les partitions vivent sur la même machine.</p>

<h2>Le sharding, le dernier barreau et le plus lourd</h2>
<p>Quand une seule primaire ne suit plus les écritures quelle que soit la taille de la machine, vous devez répartir les données sur plusieurs serveurs de base de données indépendants. C est le sharding. Chaque shard est sa propre base détenant un sous ensemble des données, et aucune machine ne les a toutes. C est le mouvement qui scale enfin les écritures horizontalement, et c est aussi celui qui vous coûte le plus.</p>
<p>Tout dépend de la clé de sharding, la colonne que vous utilisez pour décider sur quel shard vit une ligne. Choisissez bien et la plupart des requêtes touchent un seul shard. Choisissez mal et vous créez des shards chauds qui prennent tout le trafic pendant que d autres restent inactifs, ou vous forcez les requêtes à s éventer sur tous les shards et à rassembler les résultats, ce qui est lent et fragile.</p>
<ul>
  <li>Le sharding par hachage répartit les lignes uniformément en hachant la clé. Excellent pour une distribution uniforme, mauvais pour les requêtes par plage parce que les lignes liées se dispersent partout.</li>
  <li>Le sharding par plage garde les clés liées ensemble, ce qui est bon pour les scans par plage mais tend à créer des points chauds sur la plage la plus récente.</li>
  <li>Le sharding par annuaire garde une table de correspondance explicite entre clés et shards. Le plus flexible, il permet de rééquilibrer, mais l annuaire lui même devient quelque chose à scaler et à protéger.</li>
</ul>
<p>La clé de sharding doit correspondre à la façon dont vous interrogez réellement. Si vous gérez une application multi tenant, sharder par identifiant de tenant est généralement idéal parce que presque chaque requête est déjà cantonnée à un tenant, donc elle atterrit naturellement sur un seul shard. Si vous avez un jour besoin d une requête sans la clé de sharding, vous regardez un scatter gather sur tous les shards, et vous devez concevoir durement pour éviter ça sur les chemins chauds.</p>

<h2>Ce que vous abandonnez en shardant</h2>
<p>Je veux être franc sur les coûts, parce que le sharding se fait romancer. Les jointures inter shards cessent en pratique d exister. Vous dénormalisez ou vous joignez dans la couche applicative. Les transactions qui couvrent plusieurs shards exigent une machinerie de transactions distribuées lente et complexe, donc vous reconcevez pour garder chaque transaction dans un seul shard. Les identifiants globalement uniques ont besoin d un schéma qui ne dépend pas d une séquence unique, donc vous passez aux UUID ou à un générateur de type snowflake. Rééquilibrer quand un shard se remplit est un vrai projet, pas un changement de config. Et chacun de ces coûts est permanent. Une fois que vous shardez, vous vivez avec.</p>
<p>C est exactement pour ça que le sharding est le dernier barreau. Vous n y montez qu après avoir poussé les replicas, le partitionnement, le cache et les files aussi loin qu ils peuvent aller.</p>

<h2>Comment j enchaîne le tout</h2>
<p>Le chemin que je suis presque à chaque fois ressemble à ceci. Indexer et régler jusqu à épuiser les gains faciles. Ajouter des replicas de lecture et router les lectures hors de la primaire. Partitionner les tables géantes pour que la maintenance et l élagage restent sains. Utiliser le cache et les files, que je couvre dans <a href="/fr/blog/patterns-scalabilite-backend/">les patterns de scalabilite backend</a>, pour soulager à la fois les lectures et les écritures. Et seulement quand la primaire d écriture elle même est le plafond dur, je shard, et je traite le choix de la clé de sharding comme la décision la plus importante de tout l effort.</p>
<p>La leçon d ensemble, c est que scaler une base est une séquence de compromis, pas une mise à niveau unique. Chaque barreau achète de la capacité et facture de la complexité. Les ingénieurs qui se mettent en difficulté sont ceux qui sautent directement au pattern le plus puissant parce qu il sonne impressionnant, et qui passent ensuite deux ans à payer une complexité distribuée qu ils auraient pu différer longtemps avec deux replicas et un bon index.</p>
`
  }
];

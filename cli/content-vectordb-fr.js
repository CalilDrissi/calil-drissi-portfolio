module.exports = [
  {
    title: 'Les bases de donnees vectorielles expliquees : embeddings et recherche par similarite',
    slug: 'bases-de-donnees-vectorielles-expliquees',
    excerpt: 'Ce que fait reellement une base vectorielle, comment les embeddings transforment le texte en nombres, et pourquoi la recherche par similarite ne ressemble en rien aux clauses WHERE que vous connaissez.',
    category: 'Bases Vectorielles',
    tags: ['bases vectorielles', 'embeddings', 'recherche par similarite', 'apprentissage automatique'],
    pexels: 'artificial intelligence data',
    content: `<p>La premiere fois que j'ai mis en production une fonctionnalite reposant sur une base vectorielle, j'ai passe un apres-midi a ne rien comprendre a mes resultats. Je l'avais traitee comme un index de mots-cles. Ce n'en est pas un. Une base vectorielle stocke du sens, ou du moins une approximation numerique du sens, et elle repond a un type de question different de celui des bases que j'utilisais depuis des annees. Cet article est l'explication que j'aurais aime qu'on me donne avant de commencer.</p>

<h2>Ce qu'est reellement un embedding</h2>
<p>Un embedding est une liste de nombres a virgule flottante qui represente un contenu. Vous prenez du texte, une image ou un extrait audio, vous le passez dans un modele, et il en ressort un tableau de taille fixe. Un embedding de texte typique peut avoir 384, 768 ou 1536 dimensions. Chaque nombre pris isolement ne signifie rien d'interpretable. Ensemble, ils placent le contenu en un point precis d'un espace a haute dimension.</p>
<p>La propriete utile est que des contenus similaires se retrouvent a des positions proches. La phrase "mon ordinateur portable ne s'allume plus" et la phrase "mon pc est mort" produisent des vecteurs proches, alors qu'elles ne partagent presque aucun mot. Une recherche par mots-cles raterait completement ce lien. Un embedding le capte parce que le modele qui a produit les vecteurs a appris, a partir d'enormes quantites de texte, que ces phrases veulent dire a peu pres la meme chose.</p>
<p>C'est tout l'interet. On convertit la notion humaine floue de "ces deux choses parlent du meme sujet" en un probleme de geometrie. Une fois que c'est de la geometrie, un ordinateur le resout vite.</p>

<h2>Comment se mesure la similarite</h2>
<p>La proximite dans cet espace se mesure generalement avec la similarite cosinus ou, de facon equivalente pour des vecteurs normalises, le produit scalaire. La similarite cosinus regarde l'angle entre deux vecteurs et ignore leur longueur. Deux vecteurs pointant dans la meme direction ont un score proche de 1.0, des vecteurs a angle droit un score proche de 0, et des vecteurs opposes un score proche de -1.0. Certains systemes utilisent plutot la distance euclidienne, qui mesure la distance en ligne droite. Le choix depend de la facon dont le modele d'embedding a ete entraine, et se tromper degrade discretement vos resultats.</p>
<p>Voici la partie qui surprend ceux qui viennent des bases relationnelles. Il n'y a pas de correspondance exacte. Chaque requete renvoie une liste classee d'elements approximativement pertinents avec un score attache. C'est vous qui decidez ou couper la liste. Ce changement mental, de "la ligne qui correspond" vers "les lignes les plus similaires", est le plus gros ajustement.</p>

<h2>Generer des embeddings en pratique</h2>
<p>Vous entrainez rarement un modele d'embedding vous-meme. Vous en appelez un. Voici un petit exemple qui transforme quelques phrases en vecteurs et mesure leur proximite.</p>

<pre><code>from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("all-MiniLM-L6-v2")

phrases = [
    "mon ordinateur portable ne s'allume plus",
    "mon pc est mort",
    "a quelle heure ferme le magasin",
]

vecteurs = model.encode(phrases, normalize_embeddings=True)

def cosinus(a, b):
    return float(np.dot(a, b))

print("portable vs pc:", cosinus(vecteurs[0], vecteurs[1]))
print("portable vs magasin:", cosinus(vecteurs[0], vecteurs[2]))
</code></pre>

<p>Lancez ceci et la premiere paire obtient un score eleve tandis que la seconde obtient un score bas. Le modele n'a jamais vu ces phrases exactes pendant l'entrainement. Il a appris les relations a partir du contexte, et cette generalisation est ce qui fait fonctionner toute l'approche.</p>

<h2>Pourquoi il faut une base specialisee</h2>
<p>Vous pourriez stocker les vecteurs dans une colonne normale et comparer votre requete a chaque ligne. Cela s'appelle une recherche exacte ou par force brute, et cela fonctionne bien jusqu'a peut-etre cent mille vecteurs. Au-dela, ca s'effondre, car comparer une requete a dix millions de vecteurs a chaque appel est trop lent pour quoi que ce soit d'interactif.</p>
<p>Les bases vectorielles resolvent cela avec des index de plus proches voisins approximatifs. Le plus courant est HNSW, pour Hierarchical Navigable Small World. Il construit un graphe en couches ou chaque vecteur est relie a ses voisins, et une requete parcourt le graphe au lieu de tout balayer. Vous echangez un peu de precision contre un gain de vitesse enorme. D'autres types d'index comme IVF et la quantification de produit font d'autres compromis entre memoire, vitesse et rappel.</p>
<ul>
<li><strong>Le rappel</strong> est la fraction des vrais plus proches voisins que votre index renvoie reellement. Vous l'ajustez selon la latence que vous pouvez vous permettre.</li>
<li><strong>La latence</strong> est le temps que prend une requete. HNSW repond typiquement en quelques millisecondes meme sur des millions de vecteurs.</li>
<li><strong>La memoire</strong> compte car les graphes HNSW sont volumineux. La quantification reduit les vecteurs au prix d'un peu de precision.</li>
</ul>

<h2>Le filtrage par metadonnees, la ou ca devient concret</h2>
<p>La recherche par similarite pure suffit rarement a elle seule. Dans une vraie application, vous voulez "trouver les documents similaires a cette requete, mais uniquement dans l'espace de cet utilisateur, ecrits ces 90 derniers jours." Cela suppose de combiner recherche vectorielle et filtres classiques sur les metadonnees. La qualite avec laquelle une base gere cette combinaison, appelee recherche filtree ou hybride, est l'un des criteres qui me tiennent le plus a coeur quand j'evalue les options, et c'est un theme central de mes notes sur <a href="/fr/blog/choisir-une-base-vectorielle/">comment choisir une base vectorielle</a>.</p>
<p>Mal fait, le filtrage force le moteur soit a tout balayer, soit a renvoyer trop peu de resultats parce que le filtre a elimine la plupart des candidats trouves par l'index. Bien fait, le filtre est applique pendant le parcours du graphe, et vous gardez des resultats rapides et precis a l'interieur du sous-ensemble qui vous interesse.</p>

<h2>Un modele mental qui tient</h2>
<p>Je vois une base vectorielle comme un moteur de recherche du sens plutot que des mots. Un index de mots-cles repond a "quels documents contiennent ces termes." Un index vectoriel repond a "quels documents parlent de la meme chose que cette requete." Les deux sont complementaires, pas concurrents, et c'est pour cela que les systemes les plus solides que j'ai construits utilisent les deux a la fois et fusionnent les classements.</p>
<p>Les embeddings portent la semantique. L'index rend la recherche rapide a grande echelle. Les filtres de metadonnees gardent les resultats pertinents pour l'utilisateur reel. Une fois ces trois pieces assimilees, le reste du domaine a cesse de ressembler a de la magie pour devenir de l'ingenierie.</p>

<h2>Vers quoi cela mene</h2>
<p>Si les bases vectorielles ont explose en popularite, c'est qu'elles sont la couche de stockage sous la generation augmentee par recuperation. Quand vous voulez qu'un modele de langage reponde a des questions sur vos propres documents, vous encodez ces documents, vous stockez les vecteurs, et vous recuperez les pertinents au moment de la requete. Je deroule ce schema complet dans <a href="/fr/blog/rag-avec-bases-vectorielles/">construire des systemes RAG avec des bases vectorielles</a>, et il s'appuie directement sur tout ce qui precede. Pour la vue d'ensemble de la mise en production de ces systemes, mon article sur <a href="/fr/blog/ingenierie-ia-pratique/">l'ingenierie IA pratique</a> couvre les decisions qui l'entourent.</p>
<p>Commencez par generer quelques embeddings et afficher les scores de similarite vous-meme. Voir des phrases liees obtenir un score eleve et des phrases sans rapport un score bas fait plus pour l'intuition que n'importe quel schema. Tout le reste n'est que detail par-dessus cette seule idee.</p>`
  },
  {
    title: 'Choisir une base vectorielle : pgvector, Pinecone, Qdrant, Weaviate, Milvus',
    slug: 'choisir-une-base-vectorielle',
    excerpt: 'Une comparaison concrete des bases vectorielles que j\'ai reellement exploitees en production, quand chacune merite sa place, et pourquoi la bonne reponse est souvent moins excitante qu\'on ne le croit.',
    category: 'Bases Vectorielles',
    tags: ['bases vectorielles', 'pgvector', 'pinecone', 'architecture de donnees'],
    pexels: 'database server technology',
    content: `<p>Toutes les deux ou trois semaines, quelqu'un me demande quelle base vectorielle il devrait utiliser, et il veut un seul nom. Je n'en donne jamais un seul, car la reponse honnete depend de ce que vous exploitez deja, du nombre de vecteurs et de la charge operationnelle que vous etes pret a assumer. J'ai mis en production des systemes sur plusieurs d'entre elles, et voici comment je decide vraiment. Si les termes embeddings et plus proches voisins approximatifs vous sont nouveaux, commencez d'abord par mon explication sur <a href="/fr/blog/bases-de-donnees-vectorielles-expliquees/">les bases vectorielles et la recherche par similarite</a>.</p>

<h2>Commencez par la reponse ennuyeuse : pgvector</h2>
<p>Si vous exploitez deja Postgres, essayez pgvector avant tout le reste. C'est une extension qui ajoute un type de colonne vecteur et les types d'index dont vous avez besoin, et elle vous laisse garder vos embeddings dans la meme base que le reste de vos donnees. Ce dernier point compte plus qu'on ne l'avoue. Filtrer une recherche vectorielle par identifiant d'utilisateur, par locataire ou par plage de dates est trivial quand les vecteurs vivent a cote de ces colonnes, car c'est juste une clause WHERE que le planificateur comprend deja.</p>

<pre><code>CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id bigserial PRIMARY KEY,
    espace_id bigint NOT NULL,
    corps text NOT NULL,
    embedding vector(768)
);

CREATE INDEX ON documents
    USING hnsw (embedding vector_cosine_ops);

SELECT id, corps
FROM documents
WHERE espace_id = 42
ORDER BY embedding <=> '[0.12, -0.03, ...]'
LIMIT 5;
</code></pre>

<p>Cet <em>operateur de distance</em> calcule la distance cosinus, et l'index HNSW la garde rapide. Pour la plupart des produits allant jusqu'a quelques millions de vecteurs, c'est tout ce qu'il vous faut, et vous evitez d'exploiter un second systeme. J'ai laisse avec plaisir des applications sur pgvector bien au-dela du point ou l'on supposait qu'elles l'auraient depasse.</p>

<h2>Quand vous depassez Postgres</h2>
<p>pgvector a des limites. Les constructions d'index deviennent lourdes quand le nombre de vecteurs grimpe vers les dizaines de millions, la pression memoire entre en concurrence avec votre charge transactionnelle, et vous n'avez pas les reglages specialises qu'offre un moteur dedie. Quand cela commence a faire mal, il est temps de regarder une base concue pour ca. Les candidats vers lesquels je me tourne sont Qdrant, Weaviate, Milvus et Pinecone.</p>

<h2>Qdrant</h2>
<p>Qdrant est ma recommandation par defaut pour un moteur dedie quand une equipe veut s'auto-heberger. Il est ecrit en Rust, les performances sont excellentes, et sa recherche filtree est vraiment bonne plutot que rajoutee a la va-vite. Le filtrage sur la charge utile s'integre a l'index vectoriel, donc vous ne payez pas la penalite decrite plus haut ou un filtre demolit le rappel. L'API est propre, la documentation honnete, et l'exploiter dans Docker ou Kubernetes est simple. Pour la plupart des equipes qui quittent pgvector, c'est la que je les oriente.</p>

<h2>Weaviate</h2>
<p>Weaviate assume d'etre plus qu'un simple stockage de vecteurs. Il a des modules integres pour generer des embeddings, faire de la recherche hybride d'office, et meme orchestrer des etapes generatives. Si vous voulez que la base prenne en charge une plus grande partie du pipeline et que vous aimez une API a saveur GraphQL, c'est un bon choix. Je trouve ces fonctions supplementaires utiles quand une equipe est petite et veut moins de pieces mobiles, et moins utiles quand une equipe a deja son propre code d'embedding et de recuperation et veut juste un stockage rapide.</p>

<h2>Milvus</h2>
<p>Milvus, c'est la grosse machinerie. Il est concu pour la tres grande echelle, avec une architecture distribuee qui separe stockage et calcul, et il prend en charge un large eventail de types d'index. Si vous gerez des centaines de millions ou des milliards de vecteurs, Milvus est concu exactement pour ca, et il monte en charge horizontalement comme les autres n'y arrivent pas aussi proprement. Le cout est la complexite operationnelle. C'est plus a exploiter, plus a comprendre, et excessif pour une charge qui tient confortablement sur un seul noeud. Sortez-le quand l'echelle l'exige vraiment, pas avant.</p>

<h2>Pinecone</h2>
<p>Pinecone est l'option geree et serverless. Vous n'exploitez rien, vous appelez une API, et elle gere la montee en charge et l'exploitation. Pour les equipes qui ne veulent pas posseder d'infrastructure, cela vaut de l'argent, et l'experience developpeur est fluide. Les compromis sont les habituels d'un service gere : le cout a l'echelle, moins de controle, et une dependance a un fournisseur pour une partie centrale de votre systeme. J'y recours quand une equipe avance vite et que le travail d'infrastructure n'est pas la ou elle veut depenser son attention limitee.</p>

<h2>Comment je choisis vraiment</h2>
<ul>
<li><strong>Deja sur Postgres, sous quelques millions de vecteurs :</strong> pgvector. N'ajoutez pas un systeme dont vous n'avez pas besoin.</li>
<li><strong>Auto-hebergement, envie d'un moteur dedie rapide avec un filtrage solide :</strong> Qdrant.</li>
<li><strong>Envie que la base gere les embeddings et la recherche hybride :</strong> Weaviate.</li>
<li><strong>Des centaines de millions de vecteurs et une equipe pour l'exploiter :</strong> Milvus.</li>
<li><strong>Aucune envie d'exploiter de l'infrastructure :</strong> Pinecone.</li>
</ul>

<h2>Les facteurs qui comptent plus que le logo</h2>
<p>Le nom de marque sur la base est la decision la moins interessante. Ce qui determine vraiment si vous serez content six mois plus tard est une liste plus courte. La performance de la recherche filtree, car les vraies requetes combinent presque toujours similarite et contraintes de metadonnees. La douleur du reindexage quand vous changez de modele d'embedding, ce qui arrivera. L'evolution du cout avec le nombre de vecteurs et le volume de requetes. Et la charge operationnelle a laquelle vous souscrivez par rapport a l'equipe dont vous disposez.</p>
<p>J'ai vu bien plus de projets souffrir d'un index mal regle ou d'une mauvaise strategie de decoupage que d'un mauvais choix de fournisseur. La base est un composant. Le systeme autour, surtout la qualite de la recuperation, est la ou se jouent vraiment les gains et les pertes, ce qui est le sujet de <a href="/fr/blog/rag-avec-bases-vectorielles/">construire des systemes RAG avec des bases vectorielles</a>.</p>

<h2>Mon choix par defaut honnete</h2>
<p>Commencez par pgvector. Prouvez que le produit fonctionne. Mesurez vos vrais schemas de requete et votre vrai nombre de vecteurs. Ne passez a un moteur dedie que lorsque vous avez la preuve que Postgres est le goulot d'etranglement, et a ce moment-la vous en saurez assez sur votre charge pour choisir le bon avec confiance. Prendre le systeme distribue sophistique des le premier jour est une facon classique de passer des semaines sur l'exploitation pour un probleme que vous n'avez pas encore.</p>`
  },
  {
    title: 'Construire des systemes RAG avec des bases vectorielles',
    slug: 'rag-avec-bases-vectorielles',
    excerpt: 'Un parcours concret de la generation augmentee par recuperation : decoupage, embedding, recuperation, et les details ingrats qui decident si votre systeme RAG est utile ou inutile.',
    category: 'Bases Vectorielles',
    tags: ['rag', 'bases vectorielles', 'llm', 'recuperation'],
    pexels: 'neural network technology',
    content: `<p>La generation augmentee par recuperation a l'air compliquee et est en realite simple dans les grandes lignes. Vous donnez a un modele de langage acces a vos documents en recuperant les plus pertinents et en les collant dans le prompt. Le modele repond a partir de ce contexte au lieu de s'appuyer uniquement sur ce qu'il a memorise a l'entrainement. Le schema tient en une phrase. Si les systemes RAG echouent, ce n'est jamais a cause du schema. C'est a cause des details, et cet article parle des details, car j'ai vu les memes erreurs couler les memes projets plus d'une fois.</p>
<p>Ceci suppose que vous comprenez deja les embeddings et la recherche par similarite. Sinon, lisez d'abord <a href="/fr/blog/bases-de-donnees-vectorielles-expliquees/">les bases vectorielles expliquees</a>, car toute l'etape de recuperation depend de ces idees.</p>

<h2>Le pipeline en un coup d'oeil</h2>
<p>Un systeme RAG a deux phases. Il y a une phase d'ingestion hors ligne ou vous traitez vos documents et les stockez, et une phase de requete en ligne ou vous repondez a la question d'un utilisateur. L'ingestion ressemble a ceci : prendre vos documents, les decouper en morceaux, generer un embedding pour chaque morceau, et stocker les vecteurs avec leur texte et leurs metadonnees dans une base vectorielle. La requete ressemble a ceci : encoder la question de l'utilisateur, recuperer les morceaux les plus similaires, les assembler en un prompt, et l'envoyer au modele.</p>

<h2>Le decoupage, la ou la plupart des projets derapent</h2>
<p>Le decoupage est l'acte de diviser les documents en morceaux assez petits pour etre recuperes et encodes. C'est aussi l'etape a laquelle on reflechit le moins, avant de se demander pourquoi les reponses sont mauvaises. Si vos morceaux sont trop gros, chaque embedding devient une moyenne floue de plusieurs sujets et la recherche par similarite perd en precision. Si vos morceaux sont trop petits, vous recuperez des fragments qui manquent du contexte necessaire pour repondre a quoi que ce soit.</p>
<p>Ce qui marche pour moi, c'est de decouper le long de la structure naturelle du document. Couper aux titres et aux paragraphes plutot qu'aveuglement tous les 500 caracteres, car un morceau qui respecte une frontiere de section porte une idee coherente. Je fais aussi se chevaucher legerement les morceaux pour qu'une phrase pres d'une frontiere ne soit pas orpheline de son contexte. Quelques centaines de tokens par morceau avec un petit chevauchement est un point de depart raisonnable, mais la bonne reponse depend de votre contenu, et vous devriez regarder de vrais morceaux pour les verifier.</p>

<h2>L'ingestion en code</h2>
<p>Voici la forme d'une etape d'ingestion avec pgvector. Je la garde deliberement petite pour que la structure soit visible.</p>

<pre><code>import psycopg2
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-mpnet-base-v2")
conn = psycopg2.connect("dbname=app")

def ingerer(doc_id, morceaux):
    vecteurs = model.encode(morceaux, normalize_embeddings=True)
    with conn.cursor() as cur:
        for texte, vec in zip(morceaux, vecteurs):
            cur.execute(
                "INSERT INTO morceaux (doc_id, corps, embedding) "
                "VALUES (%s, %s, %s)",
                (doc_id, texte, vec.tolist()),
            )
    conn.commit()
</code></pre>

<p>Rien d'exotique ici. Le travail interessant a eu lieu avant l'execution de cette fonction, dans la facon dont les morceaux ont ete produits, et il a lieu apres, dans la facon dont vous recuperez.</p>

<h2>La recuperation et le prompt</h2>
<p>Au moment de la requete, vous encodez la question avec le meme modele que celui utilise a l'ingestion. Utiliser un modele different est un bug subtil et douloureux, car les deux espaces vectoriels ne s'alignent pas et vos scores de similarite deviennent insignifiants. Ensuite vous recuperez les meilleurs candidats et construisez le prompt.</p>

<pre><code>def repondre(question, k=5):
    qvec = model.encode([question], normalize_embeddings=True)[0]
    with conn.cursor() as cur:
        cur.execute(
            "SELECT corps FROM morceaux "
            "ORDER BY embedding <=> %s::vector LIMIT %s",
            (qvec.tolist(), k),
        )
        contexte = "\\n\\n".join(row[0] for row in cur.fetchall())
    prompt = (
        "Reponds en utilisant uniquement le contexte ci-dessous. "
        "Si la reponse ne s'y trouve pas, dis que tu ne sais pas.\\n\\n"
        "Contexte:\\n" + contexte + "\\n\\nQuestion: " + question
    )
    return appeler_modele(prompt)
</code></pre>

<p>Cette instruction de dire "je ne sais pas" quand la reponse n'est pas dans le contexte n'est pas optionnelle. Sans elle, le modele comblera volontiers les vides avec une fabrication plausible, et une reponse fausse mais assuree est pire que pas de reponse du tout.</p>

<h2>La qualite de la recuperation decide de tout</h2>
<p>Le modele ne peut etre que aussi bon que ce que vous lui donnez. Si la recuperation fait remonter les mauvais morceaux, aucune habilete de prompt ne sauve la reponse. C'est pour cela que je passe l'essentiel de mon effort RAG sur la recuperation plutot que sur la formulation du prompt. Quelques techniques qui valent leur cout :</p>
<ul>
<li><strong>La recherche hybride.</strong> Combinez la similarite vectorielle avec la recherche par mots-cles. La recherche semantique rate les identifiants exacts, les codes d'erreur et les noms de produits, et la recherche par mots-cles les attrape. Fusionner les deux classements bat l'un ou l'autre seul dans presque tous les systemes que j'ai mesures.</li>
<li><strong>Le reranking.</strong> Recuperez un ensemble genereux de candidats, puis lancez un reranker a encodeur croise pour les reordonner par pertinence avant de construire le prompt. Le reranker est plus lent par element mais bien plus precis que la distance vectorielle brute, et l'appliquer a un petit ensemble de candidats est peu couteux.</li>
<li><strong>Le filtrage par metadonnees.</strong> Restreignez la recuperation aux documents que l'utilisateur a le droit de voir et qui sont assez recents pour compter. C'est a la fois une question de pertinence et de securite.</li>
</ul>

<h2>Les problemes ingrats</h2>
<p>Les vrais systemes RAG vivent ou meurent sur les parties que personne ne montre en demo. Garder l'index synchronise quand les documents changent, pour ne pas recuperer de contenu supprime ou perime. Gerer le controle d'acces pour qu'un utilisateur ne recupere jamais un morceau d'un document qu'il ne peut pas voir, ce qui est une vraie fuite de donnees si vous vous trompez. Evaluer la qualite avec un vrai jeu de test de questions et de reponses attendues plutot qu'au feeling, car sans mesure vous ne pouvez pas savoir si un changement a aide. Et gerer la taille du prompt pour ne pas exploser la fenetre de contexte ni payer des tokens inutiles.</p>
<p>La dimension securite merite plus d'attention qu'on ne lui en accorde, surtout des que ces systemes commencent a agir au nom d'un utilisateur. J'ai creuse cela dans mon article sur <a href="/fr/blog/ia-agentique-cybersecurite/">l'IA agentique et la cybersecurite</a>, et les echecs de controle d'acces qui y figurent se transposent directement a la recuperation RAG.</p>

<h2>Commencez simple, puis mesurez</h2>
<p>Mon conseil est de construire d'abord la version la plus simple. Decoupage naif, pgvector, recuperation des cinq meilleurs, un prompt clair. Faites-le repondre aux questions de bout en bout. Ensuite construisez un jeu d'evaluation et ameliorez une chose a la fois, en mesurant chaque changement. Ajoutez la recherche hybride et verifiez les chiffres. Ajoutez le reranking et verifiez de nouveau. Reglez le decoupage et verifiez encore. Les equipes qui reussissent avec le RAG ne sont pas celles qui ont la stack la plus sophistiquee. Ce sont celles qui mesurent la qualite de la recuperation et s'acharnent dessus. Pour le contexte d'ingenierie plus large autour de la mise en production de ces systemes, voyez mes notes sur <a href="/fr/blog/ingenierie-ia-pratique/">l'ingenierie IA pratique</a>, et quand vous etes pret a choisir un stockage, <a href="/fr/blog/choisir-une-base-vectorielle/">choisir une base vectorielle</a> couvre les options.</p>`
  }
];

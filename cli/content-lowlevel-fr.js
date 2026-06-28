module.exports = [
  {
    title: 'Pile contre tas : comment la mémoire fonctionne vraiment',
    slug: 'pile-vs-tas-memoire',
    excerpt: 'La pile et le tas ne sont pas magiques. Ce sont deux régions du même espace d\'adressage, avec des règles très différentes. Voici ce qui se passe réellement sous vos variables.',
    category: 'Programmation Bas Niveau',
    tags: ['mémoire', 'pile', 'tas', 'c'],
    pexels: 'computer memory chips',
    content: `<p>Les gens parlent de "la pile" et du "tas" comme si c'étaient des objets physiques qu'on pourrait montrer du doigt. Ce n'en sont pas. Ce sont deux régions du même espace d'adressage virtuel, gérées de façons complètement différentes. J'ai écrit du C pendant des années avant d'intérioriser vraiment la différence, et une fois que ce fut fait, beaucoup de bugs déroutants ont soudain pris du sens.</p>

<h2>La pile est une région, pas une structure de données</h2>
<p>Quand votre programme démarre, le système d'exploitation donne à chaque thread un bloc de mémoire contiguë appelé la pile. Elle croît dans une direction, généralement vers le bas, vers les adresses basses sur x86 et ARM. Chaque fois que vous appelez une fonction, le processeur empile une trame : l'adresse de retour, les registres sauvegardés et la place pour les variables locales. Quand la fonction retourne, cette trame disparaît instantanément. Aucune comptabilité, aucune recherche, juste un ajustement de registre.</p>
<p>C'est pourquoi l'allocation sur la pile est rapide. Il y a un registre, le pointeur de pile, et "allouer" 64 octets revient à lui soustraire 64. Libérer revient à les rajouter. Le coût est quasi nul.</p>
<p>Le piège, c'est la durée de vie. Une variable de pile vit exactement le temps de l'appel de fonction qui l'a créée. Retournez un pointeur vers une locale et vous pointez vers une mémoire que le prochain appel va écraser.</p>

<pre><code>// Ceci est un bug. Le tampon meurt quand la fonction retourne.
char *make_greeting(void) {
    char buffer[32];
    snprintf(buffer, sizeof buffer, "bonjour");
    return buffer;   // pointeur pendouillant
}</code></pre>

<h2>Le tas, pour ce qui survit à une trame</h2>
<p>Le tas est le reste de votre espace d'adressage utilisable, et il est géré par un allocateur (malloc et compagnie) plutôt que par le processeur. Quand vous demandez de la mémoire, vous obtenez un bloc qui reste valide jusqu'à ce que vous le libériez explicitement. Cette souplesse est tout l'intérêt, et c'est aussi là que le travail se cache. L'allocateur doit suivre quels blocs sont libres, en trouver un assez grand et le rendre. J'ai écrit un article entier sur <a href="/fr/blog/ecrire-un-allocateur-memoire/">écrire un allocateur mémoire simple</a> parce que cette mécanique vaut la peine d'être comprise directement.</p>

<pre><code>char *make_greeting(void) {
    char *buffer = malloc(32);   // vit sur le tas
    if (!buffer) return NULL;
    snprintf(buffer, 32, "bonjour");
    return buffer;   // valide, mais l'appelant en est désormais propriétaire
}</code></pre>

<h2>Les compromis que vous ressentez vraiment</h2>
<ul>
<li>Vitesse : l'allocation sur la pile est un simple décalage de pointeur. Sur le tas, elle parcourt des structures et peut appeler le noyau. L'écart est grand.</li>
<li>Durée de vie : la mémoire de pile est liée à la portée. La mémoire du tas vit jusqu'à ce que vous la libériez, ce qui veut dire qu'il faut y penser.</li>
<li>Taille : les piles sont petites, souvent de 1 à 8 Mo. Mettez un tableau de 10 Mo sur la pile et vous obtenez un débordement de pile. Les grosses données vont sur le tas.</li>
<li>Localité : la mémoire de pile est chaude. Elle vient d'être touchée, donc elle est presque toujours en cache. La mémoire du tas peut être éparpillée, ce qui compte plus qu'on ne le pense.</li>
</ul>

<h2>Pourquoi ceci touche à la performance</h2>
<p>Le point sur la localité est celui qui mord dans les vrais systèmes. Un pointeur vers le tas est une valeur, et suivre ce pointeur en est une aussi. L'endroit physique où il atterrit décide si votre processeur cale. Je creuse cela dans <a href="/fr/blog/conception-orientee-donnees-et-cache/">conception orientée données et caches du processeur</a>, mais en résumé, éparpiller vos données sur des allocations de tas peut être plus lent que l'algorithme ne le laisse croire, uniquement à cause des défauts de cache.</p>

<h2>Un modèle mental qui tient</h2>
<p>Voici comment je le vois maintenant. La pile est un brouillon que le processeur gère pour vous, parfait pour des valeurs courtes et de taille connue. Le tas est un entrepôt que vous gérez vous-même, pour tout ce dont la taille ou la durée de vie ne peut être fixée à la compilation. La plupart des bugs en C viennent de la confusion entre les deux : retourner des pointeurs de pile, libérer deux fois la mémoire du tas, ou oublier de la libérer.</p>
<p>Si des langages comme Rust paraissent sûrs, c'est qu'ils encodent ces règles dans le système de types pour que le compilateur attrape les erreurs. Pour voir comment cela fonctionne sans ramasse-miettes, lisez <a href="/fr/blog/rust-ownership-securite-memoire/">sûreté mémoire avec l'ownership et l'emprunt de Rust</a>. Mais on ne peut vraiment apprécier ce contre quoi Rust vous protège qu'après avoir senti soi-même les angles tranchants de la pile et du tas.</p>`
  },
  {
    title: 'Comment fonctionnent vraiment les pointeurs',
    slug: 'comment-fonctionnent-les-pointeurs',
    excerpt: 'Un pointeur n\'est qu\'un nombre qui se trouve être une adresse. Dès qu\'on cesse de le voir comme une syntaxe effrayante pour le voir comme un entier typé, tout s\'éclaircit.',
    category: 'Programmation Bas Niveau',
    tags: ['pointeurs', 'mémoire', 'c', 'adresses'],
    pexels: 'circuit board macro',
    content: `<p>Les pointeurs m'ont fait peur pendant un temps embarrassant. La syntaxe n'aidait pas : des astérisques avec deux sens différents, des esperluettes, des flèches. Mais le concept est simple une fois la syntaxe écartée. Un pointeur est une variable dont la valeur est une adresse mémoire. C'est tout. C'est un nombre qui indique où vit quelque chose.</p>

<h2>La mémoire est un seul gigantesque tableau</h2>
<p>Imaginez l'espace d'adressage de votre processus comme un énorme tableau d'octets, indexé de zéro jusqu'à un nombre colossal. Chaque variable que vous déclarez vit à un certain indice de ce tableau. Un pointeur stocke simplement l'un de ces indices. Quand vous "déréférencez" un pointeur, vous dites "va à cet indice et lis ce qui s'y trouve".</p>

<pre><code>int x = 42;
int *p = &x;      // p contient l'adresse de x
printf("%d\\n", *p);   // déréférencement : affiche 42
*p = 7;           // écriture à travers le pointeur
printf("%d\\n", x);    // affiche 7</code></pre>

<p>L'esperluette signifie "adresse de" et l'astérisque dans une expression signifie "la chose à cette adresse". Le même astérisque dans une déclaration signifie "cette variable est un pointeur". Deux rôles pour un seul symbole, ce qui est la principale raison pour laquelle les pointeurs semblent déroutants au début.</p>

<h2>Le type compte plus que vous ne le pensez</h2>
<p>Un pointeur n'est pas qu'une adresse, c'est une adresse plus un type. Le type indique au compilateur deux choses : combien d'octets lire au déréférencement, et de combien sauter lors d'une arithmétique. Un pointeur sur int et un pointeur sur char peuvent contenir exactement la même adresse numérique et se comporter tout à fait différemment.</p>

<pre><code>int arr[4] = {10, 20, 30, 40};
int *p = arr;     // pointe sur arr[0]
p++;              // pointe maintenant sur arr[1], déplacé de 4 octets, pas de 1
printf("%d\\n", *p);   // affiche 20</code></pre>

<p>Voilà l'idée clé de l'arithmétique des pointeurs. Ajouter un à un pointeur sur int le déplace de sizeof(int) octets, pas d'un octet. Le compilateur met à l'échelle pour vous selon le type. C'est aussi pourquoi tableaux et pointeurs semblent si interchangeables en C : indexer arr[i] est défini comme prendre l'adresse de arr, ajouter i fois la taille d'un élément, puis déréférencer.</p>

<h2>Où pointent les pointeurs</h2>
<p>Un pointeur peut contenir l'adresse d'une variable de pile, d'une allocation sur le tas, d'une fonction, ou de rien du tout. Le "où" compte parce qu'il décide si le déréférencement est sûr. Si les durées de vie pile contre tas restent floues pour vous, c'est la base ici, et je l'ai couverte dans <a href="/fr/blog/pile-vs-tas-memoire/">pile contre tas : comment la mémoire fonctionne vraiment</a>. Un pointeur vers une variable de pile devient pendouillant dès que la trame retourne. Un pointeur vers de la mémoire du tas libérée est un use-after-free qui n'attend que de planter.</p>
<ul>
<li>Pointeur NULL : contient l'adresse zéro, un "ne pointe vers rien" délibéré. Le déréférencer plante, ce qui est en fait le résultat le plus aimable.</li>
<li>Pointeur pendouillant : contient une adresse autrefois valide. Le déréférencer est un comportement indéfini et peut corrompre des données silencieusement.</li>
<li>Pointeur sauvage : jamais initialisé, contient n'importe quoi. Le pire, car il peut pointer partout.</li>
</ul>

<h2>Pointeurs sur pointeurs</h2>
<p>Dès qu'un pointeur n'est qu'une variable, un pointeur sur pointeur cesse d'être mystérieux. C'est l'adresse d'une variable qui contient elle-même une adresse. Il en faut un chaque fois qu'une fonction doit changer où un pointeur pointe, pas seulement ce vers quoi il pointe.</p>

<pre><code>void allocate(int **out) {
    *out = malloc(sizeof(int));   // écrit une nouvelle adresse dans le pointeur de l'appelant
    **out = 99;                   // écrit une valeur dans cette mémoire
}

int *p = NULL;
allocate(&p);     // passe l'adresse de p pour que la fonction puisse le modifier
printf("%d\\n", *p);   // affiche 99</code></pre>

<h2>Pourquoi ça vaut l'effort</h2>
<p>Les pointeurs sont le mécanisme derrière presque tout ce qui est intéressant en code système : structures chaînées, mémoire dynamique, passage de gros objets sans copie, dialogue avec le matériel à des adresses fixes. Ils sont aussi la source de la plupart des plantages en C. L'allocateur que je décris dans <a href="/fr/blog/ecrire-un-allocateur-memoire/">écrire un allocateur mémoire simple</a> n'est rien d'autre qu'une manipulation soigneuse de pointeurs sur un bloc brut d'octets. Dès qu'on voit un pointeur comme un entier typé dans le grand tableau d'octets, la peur s'en va et la puissance apparaît.</p>`
  },
  {
    title: 'Écrire un allocateur mémoire simple',
    slug: 'ecrire-un-allocateur-memoire',
    excerpt: 'malloc n\'est pas magique, c\'est un problème de structure de données. Construire un petit allocateur de zéro m\'a appris plus sur la mémoire que n\'importe quel livre.',
    category: 'Programmation Bas Niveau',
    tags: ['malloc', 'mémoire', 'c', 'allocateur'],
    pexels: 'computer processor chip',
    content: `<p>La première fois que j'ai écrit mon propre malloc, le concept de mémoire dynamique a cessé de ressembler à une boîte noire. Un allocateur n'est qu'un programme qui gère un gros bloc de mémoire et en distribue des morceaux à la demande. Les parties difficiles sont la comptabilité et la fragmentation, rien de mystique. Voici une version minimale.</p>

<h2>D'où vient la mémoire</h2>
<p>Votre allocateur a besoin de mémoire brute à découper. Sur Unix, vous l'obtenez du noyau avec sbrk, qui déplace le sommet du tas, ou avec mmap pour de plus grandes régions. sbrk est le plus simple à raisonner : appelez-le avec un nombre positif et le tas grandit, en retournant un pointeur vers le nouvel espace.</p>

<pre><code>void *region = sbrk(4096);   // demande une page au noyau
if (region == (void *) -1) {
    // plus de mémoire
}</code></pre>

<p>Tout le jeu consiste maintenant à prendre cette région et à la distribuer, en se souvenant des parties utilisées et des parties libres.</p>

<h2>Les en-têtes de bloc : l'astuce centrale</h2>
<p>L'idée fondamentale est de stocker des métadonnées juste avant chaque bloc distribué. Quand l'appelant demande N octets, vous réservez en réalité N octets plus la taille d'un petit en-tête. Vous retournez un pointeur situé après l'en-tête, donc l'appelant ne le voit jamais. Quand il appelle free avec ce pointeur, vous reculez pour retrouver l'en-tête.</p>

<pre><code>typedef struct block {
    size_t size;          // taille utile en octets
    int free;             // 1 si disponible, 0 si utilisé
    struct block *next;   // bloc suivant dans la liste
} block_t;

#define HEADER_SIZE sizeof(block_t)</code></pre>

<p>Je tiens une liste chaînée de ces en-têtes. Pour allouer, je parcours la liste à la recherche d'un bloc libre assez grand. C'est la stratégie first-fit : prendre le premier bloc qui convient. Le best-fit (le plus petit bloc qui rentre) gaspille moins d'espace mais est plus lent à chercher. Les deux conviennent pour apprendre.</p>

<h2>Le chemin d'allocation</h2>
<pre><code>static block_t *head = NULL;

void *my_malloc(size_t size) {
    block_t *cur = head;
    while (cur) {
        if (cur->free && cur->size >= size) {
            cur->free = 0;
            return (void *)(cur + 1);   // mémoire juste après l'en-tête
        }
        cur = cur->next;
    }
    // rien de libre, agrandir le tas
    block_t *blk = sbrk(HEADER_SIZE + size);
    if (blk == (void *) -1) return NULL;
    blk->size = size;
    blk->free = 0;
    blk->next = head;
    head = blk;
    return (void *)(blk + 1);
}</code></pre>

<p>L'expression cur + 1 est de l'arithmétique de pointeurs sur un pointeur block_t, donc elle saute exactement après l'en-tête. Si cette ligne semble étrange, mon article sur <a href="/fr/blog/comment-fonctionnent-les-pointeurs/">comment fonctionnent vraiment les pointeurs</a> explique pourquoi ajouter un déplace d'une structure entière, pas d'un octet.</p>

<h2>Libérer et le problème de la fragmentation</h2>
<p>Libérer est presque trop facile : trouver l'en-tête et basculer le drapeau free. La mémoire n'est pas rendue au noyau, elle est simplement marquée réutilisable par la prochaine allocation.</p>

<pre><code>void my_free(void *ptr) {
    if (!ptr) return;
    block_t *blk = (block_t *)ptr - 1;   // recule jusqu'à l'en-tête
    blk->free = 1;
}</code></pre>

<p>Cette version naïve a un vrai défaut : la fragmentation. Libérez un bloc de 100 octets et un autre de 100 octets côte à côte, puis demandez 150 octets, et mon allocateur échoue alors même que 200 octets contigus sont libres. La correction est le coalescing : à la libération, vérifier si les blocs voisins sont aussi libres et les fusionner en un bloc plus grand. Les vrais allocateurs scindent aussi les blocs surdimensionnés pour qu'une demande de 16 octets ne consomme pas un morceau de 4 Ko.</p>

<h2>L'alignement, le détail qui mord plus tard</h2>
<p>Il y a un problème de correction que ma version jouet escamote : l'alignement. Le processeur attend qu'une valeur de huit octets se trouve à une adresse divisible par huit, et sur certaines architectures un accès mal aligné provoque une faute pure et simple. Un vrai allocateur arrondit chaque demande vers le haut pour que la zone utile commence toujours sur une frontière correctement alignée, généralement 16 octets sur un système 64 bits. Ma version marche par hasard parce que l'en-tête est déjà un multiple de l'alignement, mais dès que vous commencez à scinder des blocs, il faut arrondir les tailles, sinon vous rendez des adresses qui plantent sur certaines lectures. C'est le genre de bug qui se cache des mois puis ne surgit que sur une seule plateforme.</p>

<h2>Pourquoi ça vaut la peine de le construire</h2>
<ul>
<li>Vous cessez de craindre malloc et le voyez comme un composant réglable.</li>
<li>Vous comprenez pourquoi les schémas d'allocation comptent pour la performance, ce qui rejoint directement <a href="/fr/blog/conception-orientee-donnees-et-cache/">conception orientée données et caches du processeur</a>.</li>
<li>Vous voyez exactement pourquoi le double-free et le use-after-free corrompent la mémoire : ils gribouillent sur ces en-têtes.</li>
</ul>
<p>Les allocateurs de production comme jemalloc et tcmalloc ajoutent des classes de taille, des caches par thread et des structures astucieuses, mais le squelette est celui que je viens de décrire. Connaître le squelette, c'est la différence entre utiliser la mémoire et la comprendre.</p>`
  },
  {
    title: 'Conception orientée données et caches du processeur',
    slug: 'conception-orientee-donnees-et-cache',
    excerpt: 'Votre processeur meurt de faim pendant qu\'il attend la mémoire. Disposer les données comme le matériel veut les lire est souvent un gain plus grand qu\'un meilleur algorithme.',
    category: 'Programmation Bas Niveau',
    tags: ['cache', 'performance', 'orienté-données', 'mémoire'],
    pexels: 'cpu processor closeup',
    content: `<p>La plus grande leçon de performance que j'aie apprise, c'est que les processeurs modernes ne sont pas lents à calculer, ils sont lents à attendre la mémoire. Un défaut de cache vers la mémoire principale peut coûter quelques centaines de cycles. Pendant ce temps, le processeur aurait pu faire des centaines d'additions. Une fois cet écart intériorisé, on commence à concevoir les programmes autour de la façon dont les données circulent, pas seulement des opérations qu'on exécute dessus. C'est le cœur de la conception orientée données.</p>

<h2>La hiérarchie mémoire est la vraie machine</h2>
<p>Entre le processeur et la mémoire principale s'intercalent plusieurs niveaux de cache : L1 est minuscule et presque aussi rapide que les registres, L2 est plus grand et plus lent, L3 plus grand et plus lent encore. Quand le processeur a besoin d'un octet, il n'en cherche pas un seul. Il récupère une ligne de cache entière, typiquement 64 octets, et la range en cache. Si votre accès suivant est dans cette ligne, il est quasi gratuit. S'il est ailleurs au loin, vous payez la pénalité complète du défaut.</p>
<p>Cela veut dire que la disposition de vos données en mémoire contrôle directement votre performance. Deux programmes faisant l'arithmétique identique peuvent différer d'un ordre de grandeur uniquement à cause des schémas d'accès.</p>

<h2>Tableau de structures contre structure de tableaux</h2>
<p>L'exemple classique est la façon de stocker une collection d'enregistrements. La disposition intuitive, orientée objet, est un tableau de structures :</p>

<pre><code>struct Particle {
    float x, y, z;     // position
    float vx, vy, vz;  // vitesse
    float mass;
    char name[32];
};
struct Particle particles[100000];

// mise à jour des positions
for (int i = 0; i < 100000; i++) {
    particles[i].x += particles[i].vx;
}</code></pre>

<p>Cette boucle ne touche que x et vx, mais chaque ligne de cache chargée est pleine de mass, name et des autres champs dont vous n'avez pas besoin. Vous traînez des données froides à travers le cache pour rien. La disposition orientée données scinde les champs en tableaux parallèles, une structure de tableaux :</p>

<pre><code>struct Particles {
    float x[100000], y[100000], z[100000];
    float vx[100000], vy[100000], vz[100000];
    float mass[100000];
};

for (int i = 0; i < 100000; i++) {
    p.x[i] += p.vx[i];
}</code></pre>

<p>Maintenant le tableau x et le tableau vx sont chacun densément empaquetés. Chaque octet tiré en cache est un octet utilisé. Sur du vrai matériel, ce genre de changement donne couramment des accélérations de 3x à 10x sur les boucles chaudes, sans aucun changement d'algorithme.</p>

<h2>Pourquoi la poursuite de pointeurs fait mal</h2>
<p>Les listes chaînées et les arbres à nœuds sont l'opposé d'amicaux pour le cache. Chaque nœud est une allocation de tas séparée qui peut vivre n'importe où, donc parcourir la liste saute partout en mémoire et rate le cache à presque chaque étape. Si vous comprenez <a href="/fr/blog/pile-vs-tas-memoire/">pile contre tas</a> et comment les allocations de tas s'éparpillent, cela découle naturellement. Un tableau plat parcouru linéairement est nettement plus rapide qu'une liste chaînée du même nombre d'éléments, même si les deux sont en O(n), car le préchargeur matériel peut prédire et précharger un accès séquentiel.</p>

<ul>
<li>Préférez les tableaux contigus aux structures à nœuds quand vous itérez souvent.</li>
<li>Regroupez les champs auxquels vous accédez ensemble, et séparez ceux que vous n'utilisez pas.</li>
<li>Traitez les données dans l'ordre où elles sont en mémoire dès que possible.</li>
<li>Gardez les données chaudes petites pour qu'il en tienne plus en cache à la fois.</li>
</ul>

<h2>C'est la même idée qu'un bon allocateur</h2>
<p>Voilà pourquoi la stratégie d'allocation compte autant. Si vous allouez dix mille objets un par un, ils finissent éparpillés. Si vous les allouez en un seul bloc, ils sont voisins et itèrent vite. L'allocateur sur mesure de <a href="/fr/blog/ecrire-un-allocateur-memoire/">écrire un allocateur mémoire simple</a> vous donne exactement ce contrôle : vous décidez la disposition au lieu de la laisser au hasard.</p>

<h2>Quand y recourir</h2>
<p>Je ne restructure pas tout autour du cache. Pour du code qui tourne une fois ou rarement, la clarté l'emporte. Mais pour les boucles chaudes, les noyaux internes qui tournent des millions de fois, la disposition des données est généralement la première chose que je règle et souvent le meilleur retour. Profilez d'abord, trouvez où sont les défauts de cache, puis disposez les données comme le matériel veut les lire. La machine est ravie d'être rapide si vous cessez de la faire attendre.</p>`
  },
  {
    title: 'Sûreté mémoire avec l\'ownership et l\'emprunt de Rust',
    slug: 'rust-ownership-securite-memoire',
    excerpt: 'Rust offre le contrôle du C sans les pièges, et il le fait à la compilation, sans ramasse-miettes. L\'astuce tient dans un jeu de règles : l\'ownership et l\'emprunt.',
    category: 'Programmation Bas Niveau',
    tags: ['rust', 'sûreté-mémoire', 'ownership', 'emprunt'],
    pexels: 'rust metal texture',
    content: `<p>Après des années à courir après des pointeurs pendouillants et des double-frees en C, Rust m'a donné l'impression que quelqu'un avait enfin écrit les règles que je gardais en tête et les avait fait appliquer par le compilateur. Rust offre un contrôle manuel de la mémoire sans ramasse-miettes, et pourtant il empêche statiquement toute la classe de bugs mémoire qui ronge le C. Le mécanisme est l'ownership et l'emprunt, et c'est plus simple que sa réputation ne le laisse croire.</p>

<h2>Les trois règles de l'ownership</h2>
<p>Tout en Rust part de trois règles que le compilateur applique :</p>
<ul>
<li>Chaque valeur a exactement un propriétaire, une seule variable responsable d'elle.</li>
<li>Il ne peut y avoir qu'un propriétaire à la fois.</li>
<li>Quand le propriétaire sort de portée, la valeur est détruite et sa mémoire libérée.</li>
</ul>
<p>Cette dernière règle est le génie discret. Il n'y a aucun free à appeler ni ramasse-miettes à exécuter. Le compilateur sait exactement où finit la portée de chaque valeur et insère le nettoyage pour vous. C'est la même durée de vie liée à la portée que celle de la pile, décrite dans <a href="/fr/blog/pile-vs-tas-memoire/">pile contre tas : comment la mémoire fonctionne vraiment</a>, sauf que Rust l'étend aussi aux données du tas.</p>

<h2>Des déplacements, pas des copies</h2>
<p>Parce qu'il n'y a qu'un propriétaire, affecter une valeur de tas à une autre variable déplace l'ownership au lieu de copier les données. L'ancienne variable devient invalide, et le compilateur rejettera toute utilisation de celle-ci.</p>

<pre><code>let s1 = String::from("bonjour");
let s2 = s1;            // l'ownership passe de s1 à s2
// println!("{}", s1);  // erreur de compilation : s1 a été déplacée
println!("{}", s2);     // correct, s2 possède les données maintenant</code></pre>

<p>Cette seule règle élimine le double-free à la compilation. En C, deux pointeurs vers le même bloc de tas pensent chacun devoir le libérer. En Rust, une seule variable possède les données, donc elles sont libérées exactement une fois. Toute la catégorie de bug disparaît avant même que le programme tourne.</p>

<h2>Emprunter au lieu de déplacer</h2>
<p>Déplacer partout serait pénible, donc Rust vous laisse emprunter une valeur en prenant une référence. Une référence est un pointeur qui ne possède pas ce vers quoi il pointe. Le vérificateur d'emprunt applique un jeu de règles supplémentaire pour garder les références sûres :</p>
<ul>
<li>Vous pouvez avoir autant de références immuables que vous voulez en même temps.</li>
<li>Ou exactement une référence mutable.</li>
<li>Mais jamais les deux à la fois.</li>
</ul>

<pre><code>fn main() {
    let mut data = vec![1, 2, 3];
    let r1 = &data;        // emprunt immuable
    let r2 = &data;        // un autre, correct
    println!("{} {}", r1[0], r2[0]);

    let m = &mut data;     // emprunt mutable, autorisé maintenant que r1/r2 sont finis
    m.push(4);
}</code></pre>

<p>Cette règle "un écrivain ou plusieurs lecteurs" est ce qui empêche les courses de données et le use-after-free. Vous ne pouvez pas tenir une référence dans un vecteur pendant qu'un autre bout de code le réorganise, car cela exigerait un emprunt mutable et un emprunt immuable simultanés. Le compilateur refuse de le construire.</p>

<h2>Les durées de vie rendent le pendouillant impossible</h2>
<p>Le vérificateur d'emprunt suit aussi combien de temps vit chaque référence et garantit qu'une référence ne survit jamais aux données qu'elle pointe. Le classique pointeur pendouillant du C, retourner une référence vers une locale, ne compile tout simplement pas.</p>

<pre><code>fn dangle() -> &String {
    let s = String::from("oups");
    &s    // erreur : s est détruite ici, la référence pendouillerait
}</code></pre>

<p>Si vous avez lu <a href="/fr/blog/comment-fonctionnent-les-pointeurs/">comment fonctionnent vraiment les pointeurs</a>, vous savez que c'est exactement le bug qui produit la corruption silencieuse en C. Rust le transforme en erreur de compilation avec un message clair.</p>

<h2>Ce qu'on abandonne et ce qu'on gagne</h2>
<p>Le coût est réel : le vérificateur d'emprunt rejette des programmes qui seraient en fait corrects, et vous passez du temps à restructurer le code pour le satisfaire. Cette courbe d'apprentissage est la fameuse phase de "lutte contre le borrow checker". Ce que vous gagnez en retour, c'est une performance et un contrôle de niveau C sans aucune insécurité mémoire, vérifiés avant que le programme tourne. Après avoir vécu dans les deux mondes, je pense que le compromis vaut la peine pour tout ce où la correction compte. Rust n'a pas inventé ces règles. Il a juste fait du compilateur celui qui s'en souvient, pour que je n'aie pas à le faire.</p>`
  }
];

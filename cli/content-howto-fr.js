module.exports = [
  {
    title: 'Comment déployer un site statique sur Cloudflare Pages',
    slug: 'deployer-site-statique-cloudflare-pages',
    excerpt: 'Un guide pratique pour mettre un site statique en ligne sur Cloudflare Pages, de la connexion du dépôt jusqu\'au domaine personnalisé et aux build hooks.',
    category: 'Tutoriels',
    tags: ['cloudflare', 'site-statique', 'deploiement', 'devops'],
    pexels: 'cloud server deployment',
    content: `<p>J'ai mis beaucoup de sites en ligne sur Cloudflare Pages, y compris celui que vous lisez en ce moment. La raison pour laquelle j'y reviens toujours est ennuyeuse dans le bon sens : c'est rapide, l'offre gratuite est généreuse, et une fois configuré je n'y pense plus. Voici ma méthode.</p>

<h2>Connectez d'abord le dépôt</h2>
<p>Pages fonctionne le mieux quand il construit à partir d'un dépôt Git. Connectez-vous au tableau de bord Cloudflare, ouvrez Workers and Pages, puis choisissez "Create application" et "Pages". Autorisez GitHub ou GitLab, sélectionnez votre dépôt, et vous arrivez sur l'écran de configuration du build. C'est l'étape que les gens ratent, alors prenez votre temps ici.</p>
<p>Il vous faut trois choses : le préréglage du framework (ou "None" pour un build maison), la commande de build, et le répertoire de sortie. Pour mon propre générateur, la commande est <code>node build.js</code> et le répertoire de sortie est <code>dist</code>. Si vous utilisez un outil connu, les préréglages les remplissent pour vous. Si votre "build" se résume à copier des fichiers, mettez une commande inoffensive comme <code>echo done</code> et pointez la sortie vers votre dossier.</p>

<h2>Alignez la version de Node sur la vôtre</h2>
<p>Un nombre surprenant de premiers déploiements échouent à cause d'un décalage de version Node. Pages utilise une version récente par défaut, mais votre code suppose peut-être autre chose. Je la fixe explicitement avec une variable d'environnement pour éviter les surprises :</p>
<pre><code>NODE_VERSION = 20.11.0</code></pre>
<p>Ajoutez cela dans Settings, Environment variables, pour la Production et les Preview. Pendant que vous y êtes, ajoutez les autres secrets dont votre build a besoin, comme les jetons d'API pour récupérer du contenu. Tout ce qui est sensible va ici, jamais dans le dépôt.</p>

<h2>Lancez le premier build</h2>
<p>Cliquez sur "Save and Deploy" et regardez le journal défiler. Le premier build est le plus honnête. S'il manque une dépendance ou si votre répertoire de sortie est faux, vous le verrez immédiatement. Un build propre se termine par l'envoi de vos fichiers vers le réseau de périphérie de Cloudflare, et vous obtenez une URL en <code>*.pages.dev</code> pour tester. Ouvrez-la, naviguez, et vérifiez que les ressources se chargent vraiment. Les chemins relatifs cassés sont le problème le plus courant, souvent à cause d'un site qui se croyait dans un sous-chemin.</p>

<h2>Ajoutez votre domaine personnalisé</h2>
<p>Une fois la preview correcte, attachez un vrai domaine. Allez dans l'onglet Custom domains du projet et ajoutez votre nom d'hôte. Si le domaine est déjà sur Cloudflare, l'enregistrement DNS est créé pour vous en un clic. S'il est ailleurs, vous obtiendrez un CNAME à ajouter chez votre registraire. La propagation prend généralement des minutes, pas des heures. Cloudflare provisionne le certificat TLS automatiquement, donc le HTTPS fonctionne sans toucher à certbot.</p>

<h2>Configurez redirections et en-têtes</h2>
<p>Les sites statiques ont quand même besoin de règles. Pages lit deux fichiers spéciaux dans votre répertoire de sortie. Un fichier <code>_redirects</code> gère les réécritures d'URL et les anciens liens, et un fichier <code>_headers</code> permet de définir les en-têtes de cache et de sécurité. Voici un petit exemple qui verrouille l'affichage en iframe et met les ressources en cache agressif :</p>
<pre><code>/*
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable</code></pre>
<p>Placez-les dans le dossier que vous publiez, pas à la racine du projet, sauf si votre build les recopie. Un cache agressif sur des noms de fichiers hachés est l'un des gains de performance les moins chers que vous obtiendrez.</p>

<h2>Automatisez les redéploiements</h2>
<p>Chaque push sur votre branche de production déclenche un nouveau build, et les pull requests reçoivent automatiquement leurs propres URL de preview. Cela couvre déjà la plupart des flux. Mais si votre contenu vit hors du dépôt, dans un CMS par exemple, vous voudrez un build hook. Créez-en un dans Settings, Builds and deployments, et vous obtenez une URL à laquelle envoyer un POST depuis n'importe où pour lancer un déploiement. Je relie le mien à un webhook pour que les rédacteurs ne touchent jamais à Git.</p>
<p>Si vous voulez plus de contrôle sur le pipeline de build, vous pouvez ignorer le build du tableau de bord et le lancer vous-même. J'aborde cette approche dans <a href="/fr/blog/configurer-cicd-github-actions/">la configuration du CI/CD avec GitHub Actions</a>, qui permet de déployer avec le CLI Wrangler une fois vos propres étapes de test et de lint passées.</p>

<h2>Ce que je vérifie avant de dire que c'est fini</h2>
<p>Avant de faire confiance à un déploiement, je passe une courte liste. Le domaine personnalisé répond-il en HTTPS sans avertissement de contenu mixte ? Les redirections se déclenchent-elles vraiment ? Les grandes images sont-elles raisonnables, ou est-ce que j'envoie des photos de 4 Mo ? Ce dernier point compte plus qu'on ne le croit, et j'ai détaillé toute mon approche dans <a href="/fr/blog/optimiser-images-pour-le-web/">l'optimisation des images pour le web</a>.</p>
<p>C'est vraiment tout. Cloudflare Pages récompense une configuration simple, et le réseau de périphérie fait que vos visiteurs à Sydney ont un chargement aussi vif que ceux d'à côté. Une fois le pipeline en place, déployer devient un non-événement, ce qui est exactement le but.</p>`
  },
  {
    title: 'Comment mettre en place du CI/CD avec GitHub Actions',
    slug: 'configurer-cicd-github-actions',
    excerpt: 'Un guide sans détour pour construire un pipeline CI/CD avec GitHub Actions qui teste, construit et déploie sans devenir un fardeau de maintenance.',
    category: 'Tutoriels',
    tags: ['github-actions', 'cicd', 'automatisation', 'devops'],
    pexels: 'code laptop screen',
    content: `<p>GitHub Actions a mauvaise réputation parce que les gens copient un énorme fichier YAML trouvé sur un blog, ça marche à moitié, et ils n'y retouchent plus jusqu'à ce que ça casse. Je veux vous montrer la version petite et compréhensible que j'utilise vraiment sur de vrais projets.</p>

<h2>Où vivent les workflows</h2>
<p>Chaque workflow est un fichier YAML dans <code>.github/workflows</code>. Le nom du répertoire n'est pas optionnel. Chaque fichier décrit un ou plusieurs jobs, et chaque job tourne sur une machine virtuelle neuve. Le modèle mental qui m'a le plus aidé : un job est un ordinateur portable propre qui démarre, fait exactement ce que vous lui dites, puis s'évapore. Rien ne persiste entre les jobs sauf si vous le sauvegardez explicitement.</p>

<h2>Un pipeline minimal mais réel</h2>
<p>Voici un workflow qui tourne à chaque push et chaque pull request. Il installe les dépendances, lance la suite de tests et construit le site. Remarquez comme le déclencheur, le runner et les étapes se traduisent en français simple :</p>
<pre><code>name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build</code></pre>
<p>Deux choses ici valent leur place. La ligne <code>cache: npm</code> restaure le cache des dépendances, ce qui fait passer l'installation d'une minute à quelques secondes. Et <code>npm ci</code> au lieu de <code>npm install</code> respecte exactement votre lockfile, ce qui garantit que la CI installe les mêmes versions à chaque fois. La reproductibilité est tout l'enjeu.</p>

<h2>Faites tourner les jobs en parallèle quand c'est possible</h2>
<p>Si vos étapes de lint, de test et de vérification de types ne dépendent pas les unes des autres, ne les enchaînez pas. Séparez-les en jobs distincts et elles tourneront en même temps sur des machines différentes. Votre boucle de retour raccourcit, et le coût est le même puisque vous payez les minutes de calcul de toute façon. Je n'impose une séquence avec <code>needs</code> que lorsqu'un job ultérieur a vraiment besoin qu'un précédent se termine, comme le déploiement qui attend les tests.</p>

<h2>Ajouter le déploiement sans danger</h2>
<p>C'est là que je vois le plus d'erreurs. Le déploiement ne doit tourner que sur la branche main, jamais sur les pull requests, et il doit dépendre de la réussite des tests. La forme ressemble à ceci :</p>
<pre><code>  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - name: Publish
        run: npx wrangler pages deploy dist --project-name my-site</code></pre>
<p>Wrangler a besoin d'un jeton d'API Cloudflare pour publier. Stockez-le comme secret de dépôt chiffré dans Settings, Secrets and variables, et exposez-le à l'étape via le bloc d'environnement du job. Ne collez jamais un jeton dans le YAML lui-même, car le fichier reste dans votre historique pour toujours. Si vous déployez spécifiquement sur Cloudflare, la partie configuration manuelle est traitée dans <a href="/fr/blog/deployer-site-statique-cloudflare-pages/">le déploiement d'un site statique sur Cloudflare Pages</a>.</p>

<h2>Les secrets, comme il faut</h2>
<p>Les secrets de dépôt sont chiffrés et seulement déchiffrés à l'exécution dans le job. Ils sont masqués dans les journaux, donc si un jeton s'affiche par accident, GitHub le caviarde. Référencez-les via le contexte des secrets dans le mappage d'environnement de votre workflow plutôt que de les afficher. La règle d'or : si cela permet à quelqu'un de déployer ou de dépenser de l'argent, c'est un secret, et il vit dans le coffre de GitHub, pas dans votre code.</p>

<h2>Du cache au-delà des dépendances</h2>
<p>Vous pouvez mettre en cache plus que node_modules. Les artefacts de build, les binaires compilés, les ressources téléchargées, tout ce qui est coûteux à recréer est candidat. L'étape <code>actions/cache</code> prend une clé, généralement un hachage d'un lockfile ou d'un répertoire source, et restaure le cache correspondant s'il existe. Trouvez la bonne clé et vos étapes lentes deviennent instantanées. Trompez-vous et vous publiez des artefacts périmés, alors incluez toujours le hachage du fichier pertinent dans la clé.</p>

<h2>Restez ennuyeux</h2>
<p>Mon conseil le plus fort est de résister à l'envie d'être malin. Un workflow que n'importe qui dans l'équipe peut lire en trente secondes vaut mieux qu'un workflow brillant que vous seul comprenez. Ajoutez des étapes quand vous avez une raison concrète, supprimez-les dès qu'elles ne servent plus, et figez les versions de vos actions pour qu'une mise à jour surprise ne casse jamais un déploiement du vendredi. Si votre pipeline publie aussi du contenu qui doit être consultable, vous pouvez y intégrer cette étape, ce qui se marie bien avec <a href="/fr/blog/ajouter-recherche-site-statique/">l'ajout d'une recherche plein texte à un site statique</a>. Bien fait, le CI/CD s'efface en arrière-plan et garde simplement votre branche main déployable.</p>`
  },
  {
    title: 'Comment ajouter une recherche plein texte à un site statique',
    slug: 'ajouter-recherche-site-statique',
    excerpt: 'Les sites statiques n\'ont pas de backend, mais ils peuvent quand même avoir une recherche rapide et tolérante côté client. Voici comment je construis l\'index au build.',
    category: 'Tutoriels',
    tags: ['recherche', 'site-statique', 'javascript', 'frontend'],
    pexels: 'magnifying glass search',
    content: `<p>La première objection que j'entends, c'est qu'un site statique ne peut pas avoir de recherche puisqu'il n'y a pas de serveur à interroger. C'est faux. Vous pouvez construire un index de recherche au moment de la génération du site et le publier comme un simple fichier, puis le parcourir entièrement dans le navigateur. Pour quelques milliers de documents au plus, c'est assez rapide pour que les utilisateurs croient à un backend.</p>

<h2>Pourquoi la recherche côté client fonctionne</h2>
<p>L'astuce est de déplacer le travail au moment du build. Pendant que mon générateur parcourt déjà chaque page pour produire le HTML, il est trivial d'y collecter aussi le titre, l'URL et le texte de chacune dans une liste. Cette liste devient un fichier JSON. Le navigateur le télécharge une fois, construit un index en mémoire, et chaque frappe ensuite est instantanée car rien ne quitte l'appareil. Pas de base de données, pas d'API, aucun coût par requête.</p>

<h2>Construisez l'index au moment de la génération</h2>
<p>Pendant le build, je retire les balises HTML de chaque page et j'ajoute un petit enregistrement à un tableau. Gardez le texte du corps réduit ; vous n'avez pas besoin de chaque mot, et un index plus léger se télécharge plus vite. Voici l'essentiel :</p>
<pre><code>const index = pages.map(page => ({
  title: page.title,
  url: page.url,
  excerpt: page.excerpt,
  body: page.text.slice(0, 2000)
}));

fs.writeFileSync('dist/search-index.json', JSON.stringify(index));</code></pre>
<p>Écrire ce fichier n'est qu'une étape de plus dans le même pipeline qui produit vos pages, donc cela s'insère naturellement dans un build que vous lancez peut-être déjà via <a href="/fr/blog/configurer-cicd-github-actions/">le CI/CD avec GitHub Actions</a>. L'index est publié à côté de votre HTML sur le même réseau de périphérie.</p>

<h2>Choisissez une bibliothèque, ou écrivez la version bête</h2>
<p>Pour les petits sites, vous pouvez vraiment écrire votre propre comparateur en une douzaine de lignes. Mettez tout en minuscules, découpez la requête en mots, et notez les documents selon le nombre de mots qu'ils contiennent. Ça marche. Mais dès que vous voulez la tolérance aux fautes, la correspondance par préfixe ou un classement par pertinence, prenez une bibliothèque. J'aime Fuse.js pour la correspondance approximative et MiniSearch quand je veux un vrai score plein texte. Les deux sont minuscules et tournent dans le navigateur sans étape de build.</p>
<pre><code>import MiniSearch from 'minisearch';

const res = await fetch('/search-index.json');
const docs = await res.json();

const mini = new MiniSearch({
  fields: ['title', 'body'],
  storeFields: ['title', 'url', 'excerpt']
});
mini.addAll(docs);

const results = mini.search('cloudflare deploy', { fuzzy: 0.2 });</code></pre>

<h2>Reliez-le au champ de saisie</h2>
<p>Branchez un écouteur sur votre champ de recherche, mais ne lancez pas une recherche à chaque frappe. Temporisez de 150 millisecondes environ, sinon une personne qui tape vite déclenche une douzaine de recherches pour un seul mot. À chaque événement temporisé, lancez la requête, prenez les meilleurs résultats, et affichez-les comme une liste de liens. Montrez le titre et l'extrait pour que les gens sachent quel résultat ils veulent avant de cliquer.</p>
<ul>
  <li>Temporisez la saisie pour chercher sur une pause, pas à chaque lettre.</li>
  <li>Limitez aux huit ou dix premiers résultats ; personne ne fait défiler un menu de recherche.</li>
  <li>Surlignez le terme correspondant dans le résultat pour que la pertinence saute aux yeux.</li>
  <li>Gérez explicitement l'état vide et l'état sans résultat.</li>
</ul>

<h2>Chargez l'index paresseusement</h2>
<p>Ne téléchargez pas l'index de recherche au chargement de la page. La plupart des visiteurs ne cherchent jamais, donc payer ce coût d'avance est du gaspillage. Je récupère le JSON la première fois que quelqu'un place le curseur dans le champ de recherche, je le mets en cache dans une variable, et je le réutilise. La première recherche a un minuscule délai pendant l'arrivée du fichier, toutes les suivantes sont instantanées, et ceux qui ne cherchent jamais ne paient pas un octet. Cela garde votre chargement initial léger, ce qui compte pour les mêmes raisons qui m'obsèdent dans <a href="/fr/blog/optimiser-images-pour-le-web/">l'optimisation des images pour le web</a>.</p>

<h2>Quand s'arrêter et passer à un service</h2>
<p>La recherche côté client a un plafond. Au-delà d'environ dix mille documents, l'index devient assez gros pour que le télécharger et l'analyser fasse mal, surtout sur téléphone. À cette échelle, je passe à un service de recherche hébergé qui expose une API. Mais honnêtement, la plupart des blogs et des sites de doc n'approchent jamais cette limite. Construisez l'index, publiez le JSON, cherchez dans le navigateur, et vous obtenez une fonctionnalité qui semble coûteuse pour presque rien et zéro serveur à maintenir.</p>`
  },
  {
    title: 'Comment optimiser les images pour le web',
    slug: 'optimiser-images-pour-le-web',
    excerpt: 'Les images sont souvent l\'élément le plus lourd d\'une page. Voici le flux pratique que j\'utilise pour réduire leur poids de 70 pour cent sans perte de qualité visible.',
    category: 'Tutoriels',
    tags: ['performance', 'images', 'frontend', 'web-vitals'],
    pexels: 'photography editing screen',
    content: `<p>Si une page semble lente, les images sont la première chose que je vérifie, et c'est presque toujours le coupable. Le texte et le code sont minuscules. Une seule photo de bannière non compressée peut peser plus que tout votre bundle JavaScript. La bonne nouvelle, c'est que l'optimisation d'images est surtout mécanique, et vous pouvez tout automatiser.</p>

<h2>Choisissez le bon format</h2>
<p>Le choix du format est la décision la plus rentable que vous prenez. Le JPEG convient aux photographies mais il est vieux et peu efficace. Le PNG est pour les images qui ont besoin de transparence ou de bords nets, comme les logos et les captures d'écran, et il est catastrophique pour les photos. La réponse moderne pour presque tout est le WebP, qui donne des photos de qualité JPEG à une fraction de la taille, et l'AVIF quand vous voulez pousser la compression encore plus loin. Je sers de l'AVIF avec un repli WebP et un repli JPEG en dessous.</p>
<ul>
  <li>Photographies : AVIF ou WebP, jamais du JPEG brut si vous pouvez l'éviter.</li>
  <li>Logos et icônes : SVG si possible, il s'agrandit à l'infini et ne pèse rien.</li>
  <li>Captures avec du texte : PNG ou WebP sans perte pour que le texte reste net.</li>
</ul>

<h2>Redimensionnez avant de compresser</h2>
<p>C'est l'erreur que je vois sans cesse. Les gens prennent une photo d'appareil de 4000 pixels de large, la compressent, et l'affichent dans une colonne de 600 pixels. Le navigateur télécharge tous ces pixels gaspillés et les jette. Redimensionnez d'abord l'image à la plus grande taille à laquelle elle sera réellement affichée, puis compressez. Le seul redimensionnement réduit souvent la taille du fichier de 80 pour cent avant même de toucher aux réglages de qualité.</p>

<h2>Automatisez avec sharp</h2>
<p>Je n'édite pas les images à la main dans une application. Je les passe par un script utilisant la bibliothèque sharp, qui est rapide et produit un excellent résultat. Un court pipeline redimensionne et convertit tout un dossier :</p>
<pre><code>const sharp = require('sharp');

sharp('input.jpg')
  .resize({ width: 1200, withoutEnlargement: true })
  .webp({ quality: 75 })
  .toFile('output.webp')
  .then(() => console.log('done'));</code></pre>
<p>La qualité 75 en WebP est mon réglage par défaut. La différence entre 75 et 90 est invisible à l'écran mais double la taille du fichier. Glissez-le dans votre build et chaque image reçoit le même traitement automatiquement, ce qui s'intègre bien à un pipeline lancé via <a href="/fr/blog/configurer-cicd-github-actions/">le CI/CD avec GitHub Actions</a>.</p>

<h2>Servez des tailles adaptatives</h2>
<p>Un téléphone et un ordinateur de bureau ne devraient pas télécharger la même image. Générez quelques largeurs et laissez le navigateur choisir avec srcset. Le balisage indique au navigateur quelles tailles existent et la largeur d'affichage de l'image, et il prend la plus petite qui reste nette :</p>
<pre><code>&lt;img
  src="photo-800.webp"
  srcset="photo-400.webp 400w, photo-800.webp 800w, photo-1200.webp 1200w"
  sizes="(max-width: 600px) 100vw, 600px"
  alt="Une légende descriptive"
&gt;</code></pre>

<h2>Chargez en paresseux tout ce qui est sous la ligne de flottaison</h2>
<p>Ajoutez <code>loading="lazy"</code> aux images qui ne sont pas visibles au premier rendu de la page. Le navigateur diffère alors leur chargement jusqu'à ce que l'utilisateur s'en approche en faisant défiler. C'est un changement d'un seul attribut au gros retour, car il empêche les images hors écran de se disputer la bande passante avec le contenu que les gens voient vraiment. Laissez-le toutefois sur votre image de bannière, car vous voulez qu'elle se charge immédiatement.</p>

<h2>Définissez toujours largeur et hauteur</h2>
<p>Définissez des attributs de largeur et de hauteur explicites, ou un ratio d'aspect en CSS, sur chaque image. Sans eux, le navigateur ne sait pas combien d'espace réserver, donc la page sautille pendant le chargement des images. Ce saut est le décalage de mise en page, et c'est l'une des métriques sur lesquelles Google vous note. Cela donne aussi une impression de site cassé aux utilisateurs. Réserver l'espace ne coûte rien et corrige le problème complètement.</p>

<h2>Le gain</h2>
<p>Mettez tout cela ensemble et une page typique chargée d'images passe de plusieurs mégaoctets à quelques centaines de kilooctets sans perte de qualité visible. Cela se voit directement dans vos temps de chargement et vos Core Web Vitals. Des images plus légères donnent un site plus vif partout, y compris au moment où vous le publiez via <a href="/fr/blog/deployer-site-statique-cloudflare-pages/">Cloudflare Pages</a> et que vos visiteurs le chargent depuis la périphérie. Optimisez une fois dans le build, et vous n'avez plus jamais à y penser image par image.</p>`
  },
  {
    title: 'Comment construire une API REST avec limitation de débit',
    slug: 'construire-api-rest-limitee',
    excerpt: 'Un guide pour construire une API REST qui se défend avec la limitation de débit : les algorithmes qui comptent, les bonnes réponses HTTP, et où stocker les compteurs.',
    category: 'Tutoriels',
    tags: ['api', 'rate-limiting', 'backend', 'securite'],
    pexels: 'network server room',
    content: `<p>Toute API exposée au public finira par se faire marteler, que ce soit par un client buggé qui boucle sur une erreur, un scraper, ou quelqu'un qui en abuse franchement. La limitation de débit est la façon de protéger votre service et de le garder équitable pour tout le monde. J'en ai ajouté à beaucoup d'API, et les concepts sont plus simples que le jargon le laisse croire.</p>

<h2>Choisissez un algorithme</h2>
<p>Il existe quelques approches classiques qui arbitrent entre précision et coût. La fenêtre fixe compte les requêtes par tranche de temps, disons 100 par minute, et se réinitialise à la frontière. C'est très simple mais cela autorise des rafales aux bords, puisqu'un client peut tirer 100 requêtes à la fin d'une minute et 100 au début de la suivante. La fenêtre glissante lisse cela en pondérant la fenêtre précédente. Le seau à jetons remplit des jetons à un rythme constant et laisse les clients les dépenser en rafales jusqu'à un plafond, ce qui colle le mieux au trafic réel.</p>
<ul>
  <li>Fenêtre fixe : la plus facile à construire, autorise des rafales aux bords.</li>
  <li>Fenêtre glissante : plus précise, un peu plus de comptabilité.</li>
  <li>Seau à jetons : gère les rafales avec souplesse, mon choix habituel.</li>
</ul>

<h2>Un seau à jetons simple</h2>
<p>L'idée est que chaque client a un seau de jetons. Chaque requête coûte un jeton, et les jetons se rechargent avec le temps. Si le seau est vide, la requête est rejetée. Voici la logique de base, en ignorant le stockage un instant :</p>
<pre><code>function allow(bucket, now, rate, capacity) {
  const elapsed = (now - bucket.last) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * rate);
  bucket.last = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}</code></pre>
<p>Cette fonction recharge selon le temps écoulé, plafonne le seau pour que les jetons ne s'accumulent pas indéfiniment, et dépense un jeton par requête autorisée. C'est peut-être quinze lignes et cela couvre la grande majorité des besoins réels.</p>

<h2>Identifiez correctement le client</h2>
<p>La limitation de débit ne vaut que ce que vaut votre idée de ce qu'est un client. Pour le trafic authentifié, indexez la limite sur la clé d'API ou l'identifiant utilisateur, ce qui est fiable. Pour le trafic anonyme, vous vous rabattez sur l'adresse IP, qui est imparfaite car des utilisateurs derrière le même réseau partagent une IP et les proxys peuvent l'usurper. Si vous êtes derrière un proxy ou un CDN, lisez l'en-tête transmis, mais ne lui faites confiance que lorsque la requête est vraiment passée par votre infrastructure. Mal choisir la clé revient soit à punir des utilisateurs innocents, soit à ne pas arrêter les abuseurs.</p>

<h2>Répondez de la bonne façon</h2>
<p>Quand vous rejetez une requête, faites-le avec le bon statut HTTP et des en-têtes utiles pour que les clients bien élevés s'adaptent. Le statut est 429 Too Many Requests. Incluez toujours un en-tête Retry-After indiquant au client combien de temps attendre, et les en-têtes standard de limitation pour qu'il s'auto-régule avant de heurter le mur :</p>
<pre><code>HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 30
Content-Type: application/json

{ "error": "limite de debit depassee, reessayez dans 30 secondes" }</code></pre>
<p>Un bon client lit ces en-têtes et lève le pied poliment. Un mauvais les ignore, mais au moins vous lui avez laissé sa chance, et vous avez une trace propre de la raison de votre refus.</p>

<h2>Où stocker les compteurs</h2>
<p>Un compteur en mémoire fonctionne pour un seul serveur et s'effondre dès que vous passez à deux, car chaque instance a sa propre vue. Pour quoi que ce soit de distribué, il vous faut un état partagé. Redis est le choix classique ; il est rapide et possède des opérations d'incrément atomiques qui rendent cela facile. À la périphérie, un magasin clé-valeur comme le KV de Cloudflare ou les Durable Objects fait le même travail près de l'utilisateur. Quoi que vous choisissiez, la mise à jour du compteur doit être atomique, sinon deux requêtes simultanées peuvent lire le même compte et passer toutes les deux.</p>

<h2>Combinez-la avec d'autres défenses</h2>
<p>La limitation de débit est une couche, pas tout le mur. Associez-la à l'authentification, à la validation des entrées et à des délais d'attente raisonnables. Placez-la le plus tôt possible dans le cycle de vie de la requête, idéalement avant tout travail coûteux, pour qu'un flot de requêtes bloquées ne vous coûte presque rien. Si vous déployez ce genre de service vous-même, la même plateforme de périphérie que je décris dans <a href="/fr/blog/deployer-site-statique-cloudflare-pages/">le déploiement sur Cloudflare Pages</a> peut faire tourner l'API et son magasin de limitation ensemble, et vous pouvez la publier en confiance via <a href="/fr/blog/configurer-cicd-github-actions/">un pipeline GitHub Actions</a>. Construisez le limiteur une fois, gardez-le ennuyeux, et il fait tranquillement son travail sous charge.</p>`
  }
];

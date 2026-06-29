module.exports = [
  {
    title: 'Débuter avec le moteur de jeu Godot 4',
    slug: 'debuter-avec-godot',
    excerpt: 'Un premier regard concret sur Godot 4 par quelqu\'un qui a sorti un jeu avec. Scènes, nœuds, GDScript et les choix de workflow qui comptent vraiment.',
    category: 'Développement de Jeux',
    tags: ['Godot', 'GDScript', 'Moteur de Jeu', 'Dév Indé'],
    pexels: 'video game controller',
    content: `<p>J'ai pris Godot en main pour une petite game jam il y a deux ans et je ne suis jamais revenu à autre chose pour le 2D. J'avais utilisé Unity avant, et le contraste a été immédiat. Godot s'ouvre en moins de trois secondes, l'éditeur lui même est un seul téléchargement autonome d'une centaine de mégaoctets, et le tout est open source sous licence MIT. Cette dernière partie m'était indifférente jusqu'au jour où Unity a annoncé des frais sur le runtime et j'ai compris à quel point posséder ses outils compte. Cet article est l'orientation que j'aurais aimé qu'on me donne le premier jour.</p>

<h2>Ce qu'est réellement Godot</h2>
<p>Godot est un moteur gratuit et open source pour les jeux 2D et 3D. Il tourne sur Windows, macOS et Linux, et il exporte vers toutes les plateformes de bureau ainsi que le web, Android et iOS. Aucun compte à créer, aucun serveur de licence, aucun écran de démarrage sur votre jeu fini. Vous téléchargez l'éditeur, vous le décompressez, et vous le lancez. Je garde trois versions différentes sur disque parce que changer revient simplement à lancer un autre exécutable.</p>
<p>La version qui a tout changé est Godot 4. Elle a apporté un moteur de rendu réécrit basé sur Vulkan, une vraie illumination globale pour la 3D, et une couche de script bien plus rapide. Si vous démarrez aujourd'hui, démarrez sur Godot 4. La plupart des tutoriels plus anciens visent Godot 3, et les différences d'API vous feront constamment trébucher.</p>

<h2>Nœuds et scènes, tout le modèle mental</h2>
<p>Tout dans Godot est un nœud. Un sprite est un nœud. Un lecteur audio est un nœud. Une forme de collision est un nœud. Vous organisez les nœuds en arborescence, et une arborescence sauvegardée s'appelle une scène. C'est vraiment toute l'architecture, et une fois que ça fait tilt vous arrêtez de vous battre contre le moteur.</p>
<p>La partie qui m'a pris une semaine à intégrer, c'est que les scènes s'imbriquent. Une pièce de monnaie est une scène avec un sprite, une zone de collision et un son. Votre niveau est une scène qui contient des dizaines de scènes de pièces comme enfants. Votre jeu entier est une scène qui échange les niveaux. Il n'y a pas de concept séparé de prefab comme dans d'autres moteurs, parce que chaque scène est déjà réutilisable par conception.</p>
<p>Voici comment je réfléchis au nœud à choisir :</p>
<ul>
<li><strong>Node2D</strong> est la base pour tout ce qui a une position, une rotation et une échelle dans l'espace 2D.</li>
<li><strong>CharacterBody2D</strong> est ce qu'il vous faut pour un joueur ou un ennemi qui se déplace et entre en collision mais que vous contrôlez directement en code.</li>
<li><strong>Area2D</strong> détecte les chevauchements sans rien pousser, parfait pour les objets à ramasser, les déclencheurs et les zones de dégâts.</li>
<li><strong>Sprite2D</strong> et <strong>AnimatedSprite2D</strong> dessinent vos visuels.</li>
<li><strong>CanvasLayer</strong> contient votre interface pour qu'elle reste fixe pendant que la caméra bouge.</li>
</ul>

<h2>GDScript n'est pas Python, mais ça y ressemble</h2>
<p>Godot est livré avec son propre langage de script appelé GDScript. Il ressemble beaucoup à Python, avec des blocs basés sur l'indentation et un typage dynamique, mais il est intégré au moteur donc il connaît nativement les nœuds et l'arborescence de scène. Vous pouvez aussi utiliser C# si nécessaire, et il existe une voie C++ via GDExtension pour le code critique en performance, mais j'ai sorti de vrais jeux entièrement en GDScript sans jamais buter sur un mur.</p>
<p>Chaque script étend un type de nœud. Les deux fonctions que vous écrirez sans cesse sont _ready, qui s'exécute une fois quand le nœud entre dans l'arbre, et _process, qui s'exécute à chaque image. Voici un petit script qui fait tourner un sprite et affiche un message :</p>
<pre><code>extends Sprite2D

# Vitesse de rotation, en radians par seconde
var spin_speed := 2.0

func _ready() -&gt; void:
    print("Le sprite est prêt")

func _process(delta: float) -&gt; void:
    # delta est le temps écoulé depuis la dernière image, donc le
    # mouvement reste constant quelle que soit la fréquence d'images
    rotation += spin_speed * delta
</code></pre>
<p>Remarquez les indices de type optionnels avec les deux points et le deux points égal pour les types inférés. Je recommande fortement de typer vos variables. L'éditeur vous offre une meilleure autocomplétion, et le compilateur attrape des erreurs que vous trouveriez sinon à l'exécution.</p>

<h2>Le système de signaux, ou comment les nœuds se parlent</h2>
<p>Godot s'appuie beaucoup sur un motif de publication et abonnement appelé signaux. Un bouton émet un signal pressed. Une Area2D émet un signal body_entered quand quelque chose la chevauche. Vous connectez ces signaux à des fonctions, soit en glissant dans l'éditeur, soit en code. Cela garde vos nœuds découplés, parce qu'une pièce n'a pas besoin de connaître le joueur, elle annonce simplement qu'elle a été touchée.</p>
<p>Vous pouvez connecter un signal en code comme ceci :</p>
<pre><code>extends Area2D

func _ready() -&gt; void:
    body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -&gt; void:
    print("Quelque chose est entré : ", body.name)
    queue_free()
</code></pre>
<p>L'appel à queue_free retire le nœud en toute sécurité à la fin de l'image. Familiarisez vous tôt avec les signaux. Lutter contre eux en interrogeant l'état à chaque image est l'erreur de débutant la plus courante que je vois.</p>

<h2>La disposition de l'éditeur où vous allez vivre</h2>
<p>L'éditeur a un dock Scène à gauche qui montre votre arborescence de nœuds, un dock FileSystem en dessous pour vos fichiers de projet, un Inspecteur à droite pour ajuster les propriétés, et la fenêtre de visualisation au milieu. Le panneau du bas abrite la console de sortie, le débogueur et l'éditeur d'animation. Je garde le débogueur ouvert en permanence parce que les traces de pile sont bonnes et que l'arbre de scène distant permet d'inspecter un jeu en cours d'exécution en direct.</p>
<p>Une habitude qui a payé : organisez votre projet en dossiers dès le départ. J'utilise un dossier scenes, un dossier scripts, un dossier assets pour les visuels et l'audio, et un dossier autoload pour les singletons globaux. Godot n'impose aucune structure, donc la discipline vous revient.</p>

<h2>Les autoloads pour l'état global</h2>
<p>Quand vous avez besoin de quelque chose d'accessible partout, comme un gestionnaire de score ou un bus audio, vous enregistrez une scène ou un script comme autoload dans les paramètres du projet. Il devient un singleton qui se charge avant tout le reste et persiste à travers les changements de scène. C'est ainsi que je gère l'inventaire du joueur, les réglages et les données de sauvegarde. N'en abusez pas, mais pour les préoccupations vraiment globales c'est l'outil le plus propre que Godot offre.</p>

<h2>Exporter votre jeu</h2>
<p>Quand vous êtes prêt à partager, vous installez les modèles d'export une fois puis vous choisissez un préréglage pour chaque plateforme. L'export web est mon préféré pour les jams parce que vous téléversez un dossier et n'importe qui peut jouer dans un navigateur instantanément, sans téléchargement. Les exports de bureau produisent un seul exécutable. Tout le processus prend quelques minutes une fois configuré.</p>

<h2>Où aller ensuite</h2>
<p>Le moyen le plus rapide d'apprendre Godot est de construire quelque chose de minuscule et de le terminer. Ne commencez pas par votre RPG de rêve. Faites un jeu où une chose bouge et une chose se produit quand vous en touchez une autre. Une fois les bases du moteur acquises, l'étape naturelle suivante est de les assembler en quelque chose de jouable. J'ai écrit un guide complet exactement là dessus dans <a href="/fr/blog/tutoriel-jeu-2d-godot/">créer un jeu 2D dans Godot avec GDScript</a>, où nous branchons un personnage qui se déplace, des collisions et un score à partir de zéro.</p>
<p>Godot récompense ceux qui livrent. Le moteur s'écarte de votre chemin, la communauté est généreuse, et la documentation est vraiment excellente. Téléchargez le, ouvrez un projet vierge, et ajoutez votre premier nœud dès aujourd'hui.</p>`
  },
  {
    title: 'Créer un jeu 2D dans Godot avec GDScript',
    slug: 'tutoriel-jeu-2d-godot',
    excerpt: 'Construction pratique d\'un mini jeu 2D complet dans Godot 4 : déplacement du joueur, collisions, objets à ramasser, un score et un écran de fin, le tout en GDScript.',
    category: 'Développement de Jeux',
    tags: ['Godot', 'GDScript', 'Jeux 2D', 'Tutoriel'],
    pexels: 'retro game pixel',
    content: `<p>La meilleure façon d'apprendre un moteur est de terminer un petit jeu, pas de lire indéfiniment. Donc dans cet article nous construisons un jeu 2D complet, certes minuscule, dans Godot 4. Un joueur se déplace, ramasse des pièces pour augmenter un score, et meurt si un ennemi le touche. À la fin vous aurez touché à tous les systèmes nécessaires pour la plupart des projets 2D. Si vous n'avez jamais ouvert Godot, lisez d'abord mon guide <a href="/fr/blog/debuter-avec-godot/">débuter avec le moteur de jeu Godot 4</a>, car je suppose ici que vous savez ce qu'est un nœud et une scène.</p>

<h2>Mise en place du projet et de la scène du joueur</h2>
<p>Créez un nouveau projet avec le moteur de rendu Forward Plus. La première scène que nous construisons est le joueur. Ajoutez un CharacterBody2D comme racine, puis donnez lui trois enfants : un Sprite2D pour le visuel, une CollisionShape2D pour le corps physique, et une Camera2D pour que la vue suive le joueur. Réglez la forme de collision sur une capsule ou un rectangle qui correspond grossièrement à votre sprite. Sauvegardez la scène sous player.tscn.</p>
<p>CharacterBody2D est la bonne base ici parce qu'il nous donne une vélocité intégrée et une méthode move_and_slide qui gère la réponse aux collisions sans qu'on fasse le calcul vectoriel à la main.</p>

<h2>Déplacer le joueur</h2>
<p>Avant d'écrire le code de déplacement, définissez quelques actions d'entrée. Ouvrez les Paramètres du projet, allez dans l'onglet Contrôles, et ajoutez quatre actions nommées move_up, move_down, move_left et move_right. Liez chacune aux touches fléchées et aux touches WASD. Associer les entrées à des actions nommées plutôt que de coder les touches en dur signifie que vous pourrez prendre en charge les manettes et la reconfiguration plus tard sans rien réécrire.</p>
<p>Attachez maintenant un script à la racine du joueur. Voici la logique de déplacement :</p>
<pre><code>extends CharacterBody2D

# Pixels par seconde
@export var speed: float = 220.0

func _physics_process(delta: float) -&gt; void:
    # Construit un vecteur de direction à partir des quatre actions.
    # get_axis renvoie une valeur de -1 à 1 pour chaque paire.
    var direction := Vector2.ZERO
    direction.x = Input.get_axis("move_left", "move_right")
    direction.y = Input.get_axis("move_up", "move_down")

    # Normalise pour que le déplacement diagonal ne soit pas plus rapide
    if direction.length() &gt; 1.0:
        direction = direction.normalized()

    velocity = direction * speed
    move_and_slide()
</code></pre>
<p>Quelques points à souligner. Nous utilisons _physics_process plutôt que _process parce que tout ce qui déplace un corps physique doit tourner sur le pas de temps fixe de la physique. L'annotation @export rend speed modifiable dans l'Inspecteur, donc je peux l'ajuster sans toucher au code. Et normaliser la direction supprime le bug classique où se déplacer en diagonale est environ quarante pour cent plus rapide que tout droit.</p>

<h2>Fabriquer une pièce à ramasser</h2>
<p>Créez une deuxième scène avec une Area2D comme racine. Area2D détecte les chevauchements sans bloquer physiquement quoi que ce soit, ce qui est exactement ce dont un objet à ramasser a besoin. Donnez lui un Sprite2D et une CollisionShape2D. Sauvegardez sous coin.tscn et attachez ce script :</p>
<pre><code>extends Area2D

# Émis quand le joueur attrape cette pièce
signal collected

func _ready() -&gt; void:
    body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -&gt; void:
    if body.is_in_group("player"):
        collected.emit()
        queue_free()
</code></pre>
<p>Nous déclarons notre propre signal appelé collected et nous l'émettons quand un joueur entre. La pièce ne sait pas ce qu'est un score, et elle ne devrait pas. Elle annonce simplement qu'elle a été ramassée et se retire. Pour que la vérification de groupe fonctionne, sélectionnez le nœud joueur, ouvrez le dock Nœud à côté de l'Inspecteur, passez à Groupes, et ajoutez le à un groupe nommé player.</p>

<h2>Suivre le score avec un global</h2>
<p>Le score doit survivre à toute scène individuelle, donc enregistrez le comme autoload. Créez un script appelé game_state.gd :</p>
<pre><code>extends Node

var score: int = 0

signal score_changed(new_score: int)

func add_points(amount: int) -&gt; void:
    score += amount
    score_changed.emit(score)

func reset() -&gt; void:
    score = 0
    score_changed.emit(score)
</code></pre>
<p>Enregistrez le dans les Paramètres du projet sous l'onglet Globaux avec le nom GameState. Maintenant n'importe quel script du jeu peut appeler GameState.add_points et écouter le signal score_changed pour mettre à jour l'affichage. C'est la façon la plus propre de partager un état dans Godot sans emmêler vos scènes.</p>

<h2>Brancher le niveau et l'interface</h2>
<p>Construisez une scène de niveau. Déposez y une instance du joueur, dispersez plusieurs instances de pièces autour, et ajoutez un CanvasLayer avec un Label à l'intérieur pour le score. Le CanvasLayer garde le label fixé à l'écran même quand la caméra suit le joueur. Attachez un petit script au label :</p>
<pre><code>extends Label

func _ready() -&gt; void:
    GameState.score_changed.connect(_on_score_changed)
    _on_score_changed(GameState.score)

func _on_score_changed(new_score: int) -&gt; void:
    text = "Score : " + str(new_score)
</code></pre>
<p>Pour que chaque pièce ajoute réellement au score, connectez son signal collected à un gestionnaire dans le script du niveau qui appelle GameState.add_points(10). Vous pouvez le faire dans l'éditeur en sélectionnant une pièce et en utilisant le dock Nœud, ou en code en bouclant sur les pièces dans _ready. Je préfère le code quand il y a beaucoup d'instances, car connecter cinquante pièces à la main dans l'éditeur est fastidieux et source d'erreurs.</p>

<h2>Ajouter un ennemi et une fin de partie</h2>
<p>Un ennemi peut être aussi simple qu'une autre Area2D qui va et vient. Quand elle chevauche le joueur, la partie se termine. Voici un patrouilleur minimal :</p>
<pre><code>extends Area2D

@export var move_speed: float = 90.0
var _direction: int = 1

func _ready() -&gt; void:
    body_entered.connect(_on_body_entered)

func _physics_process(delta: float) -&gt; void:
    position.x += move_speed * _direction * delta
    # Inverse la direction aux bords de la patrouille
    if position.x &gt; 600 or position.x &lt; 200:
        _direction *= -1

func _on_body_entered(body: Node2D) -&gt; void:
    if body.is_in_group("player"):
        get_tree().change_scene_to_file("res://scenes/game_over.tscn")
</code></pre>
<p>L'appel change_scene_to_file démonte la scène actuelle et en charge une nouvelle. Construisez une scène de fin simple avec un Label et un bouton qui réinitialise le score et recharge le niveau. Pensez à appeler GameState.reset sur ce bouton pour que la prochaine partie démarre propre.</p>

<h2>Du polissage qui pèse plus lourd que prévu</h2>
<p>Un jeu qui fonctionne et un jeu qui fait du bien sont deux choses différentes. Les gains les moins chers que je connaisse :</p>
<ul>
<li>Ajoutez un son court au ramassage d'une pièce. Même un simple bip rend la collecte réelle.</li>
<li>Donnez à la caméra une petite valeur de lissage pour qu'elle glisse vers le joueur au lieu de claquer dessus.</li>
<li>Jouez un rapide tween d'échelle sur la pièce avant qu'elle disparaisse pour qu'elle éclate plutôt qu'elle s'évanouisse.</li>
<li>Ajoutez un léger tremblement d'écran quand le joueur meurt. Vingt minutes de travail, énorme qualité perçue.</li>
</ul>
<p>Les tweens dans Godot 4 se créent avec create_tween et sont parfaits pour ce genre de jus sans écrire d'animation image par image.</p>

<h2>Jusqu'où ça monte</h2>
<p>Vous avez maintenant la boucle complète : entrée, déplacement, collision, objets à ramasser, état global, un ennemi et des transitions de scène. Presque tout jeu 2D est une version plus élaborée de ces mêmes pièces. Un jeu de plateforme ajoute la gravité et le saut au script de déplacement. Un shooter fait apparaître des scènes de projectiles sur un minuteur. Un jeu de puzzle remplace la physique par une grille. L'architecture que vous venez de construire se transpose directement.</p>
<p>Terminez ce jeu, puis cassez le exprès. Ajoutez un deuxième type d'ennemi, un meilleur score qui persiste sur le disque, un écran titre. Livrer petit et itérer, voilà comment on apprend réellement le moteur, bien plus que n'importe quel tutoriel y compris celui ci.</p>`
  }
];

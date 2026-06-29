module.exports = [
  {
    title: 'Débuter en développement VR',
    slug: 'debuter-developpement-vr',
    excerpt: 'Le parcours d\'un développeur dans la stack VR : choisir un casque, trancher entre Unity et Unreal, et écrire sa première scène OpenXR sans se perdre dans les SDK propriétaires.',
    category: 'VR & XR',
    tags: ['vr', 'openxr', 'unity', 'unreal'],
    pexels: 'virtual reality headset',
    content: `<p>La première fois que j'ai déployé un build VR sur un casque, je n'avais aucune idée de la quantité de travail qui se passe en dehors du casque. On passe peut-être un cinquième de son temps dans les lunettes et le reste à se battre avec les mappings d'entrée, l'échelle de rendu et les conflits de versions de SDK. Voici donc le guide que j'aurais aimé qu'on me donne : comment les pièces s'assemblent, quoi installer, et comment faire tourner un cube qu'on peut attraper sur du vrai matériel avant la fin de l'après-midi.</p>

<h2>Ce dont vous avez réellement besoin</h2>
<p>Il vous faut trois choses. Un casque, un moteur, et un runtime qui fait la traduction entre les deux. C'est cette dernière partie que les débutants sautent avant de se demander pourquoi rien ne fonctionne. Le runtime est la couche qui possède l'affichage, le tracking et les contrôleurs, et votre moteur lui parle à travers une API.</p>
<p>Côté matériel, presque n'importe quel casque autonome moderne fera l'affaire. Un Meta Quest 2 ou 3 est le point d'entrée le moins cher et sert à la fois de casque relié au PC et de cible Android autonome. Si vous avez un PC de jeu, un Valve Index ou n'importe quel casque Windows Mixed Reality fonctionne aussi. Achetez d'occasion si vous le pouvez. Le matériel évolue vite et vous n'avez pas besoin de la dernière dalle pour apprendre.</p>

<h2>OpenXR est ce qu'il faut apprendre, pas un SDK propriétaire</h2>
<p>Pendant des années, chaque fabricant de casque livrait son propre SDK, et porter une application d'un appareil à un autre signifiait réécrire son code d'entrée et de rendu. OpenXR a réglé ça. C'est un standard ouvert de Khronos, le même groupe derrière Vulkan, et il vous donne une seule API qui cible le Quest, SteamVR, Windows Mixed Reality et la plupart des appareils à venir.</p>
<p>Mon conseil ferme : développez sur OpenXR dès le premier jour. Unity et Unreal le supportent tous deux comme un plugin de première classe. Vous irez parfois chercher une extension propriétaire pour le suivi des mains ou le passthrough, mais la boucle de base des poses, des frames et des entrées reste portable. J'ai déplacé des projets du Quest vers le PCVR presque sans changer une ligne grâce à ça, et la seule fois où j'ai bâti sur un SDK propriétaire, je l'ai payé plus tard.</p>

<h2>Unity ou Unreal</h2>
<p>C'est la question que tout le monde pose et la réponse honnête est que les deux conviennent. Voici comment je tranche.</p>
<ul>
<li>Choisissez Unity si vous voulez une itération plus rapide, un modèle de script plus doux en C#, et le plus large vivier de tutoriels et d'assets VR. Le XR Interaction Toolkit vous donne la préhension, la téléportation et l'interaction avec les interfaces sans rien coder. La plupart des projets VR indé et entreprise sortent sur Unity.</li>
<li>Choisissez Unreal s'il vous faut un rendu visuel de premier ordre, que vous êtes à l'aise avec le C++ ou les Blueprints, et que votre cible est un PC puissant ou un casque autonome haut de gamme. Le rendu d'Unreal est superbe mais vous lutterez davantage pour tenir le framerate sur du matériel mobile comme le Quest.</li>
</ul>
<p>Je prends Unity pour la plupart de mes prototypes parce que je peux changer une valeur, lancer le mode play, et tester dans le casque en quelques secondes. Pour une pièce PCVR cinématique et lourde visuellement, j'envisagerais Unreal. Aucun des deux choix n'est mauvais, alors ne passez pas une semaine à hésiter.</p>

<h2>Configurer un projet Unity pour la VR</h2>
<p>Voici le chemin qui fonctionne de manière fiable à l'heure où j'écris. Créez un nouveau projet avec le template 3D core. Ouvrez le gestionnaire de paquets et installez le package XR Plugin Management, puis le OpenXR Plugin, puis le XR Interaction Toolkit. Dans les paramètres du projet sous XR Plugin Management, activez OpenXR pour votre plateforme cible et ajoutez un profil d'interaction qui correspond à vos contrôleurs, comme le profil Oculus Touch ou le profil des contrôleurs Index.</p>
<p>Pour une cible Quest, passez la plateforme de build sur Android et réglez la compression de texture sur ASTC. Pour le PCVR vous restez sur la plateforme Windows. C'est franchement l'essentiel de la configuration. Les profils d'interaction sont la partie que les gens oublient, et sans eux vos contrôleurs ne rapportent aucune entrée du tout.</p>

<h2>Votre premier objet attrapable</h2>
<p>Le XR Interaction Toolkit fait le gros du travail, mais ça aide de voir à quoi ressemble une petite interaction personnalisée en code. Voici un script simple qui ramène un objet à sa position de départ quand on le lâche, pratique pour les outils que vous ne voulez pas voir disparaître dans le vide.</p>
<pre><code>using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;

[RequireComponent(typeof(XRGrabInteractable))]
public class ReturnToHolster : MonoBehaviour
{
    Vector3 startPos;
    Quaternion startRot;
    XRGrabInteractable grab;

    void Awake()
    {
        startPos = transform.position;
        startRot = transform.rotation;
        grab = GetComponent&lt;XRGrabInteractable&gt;();
        grab.selectExited.AddListener(OnReleased);
    }

    void OnReleased(SelectExitEventArgs args)
    {
        // Retour a la base apres un court delai pour garder le lance physique
        Invoke(nameof(ResetTransform), 1.5f);
    }

    void ResetTransform()
    {
        var rb = GetComponent&lt;Rigidbody&gt;();
        if (rb != null) { rb.velocity = Vector3.zero; rb.angularVelocity = Vector3.zero; }
        transform.SetPositionAndRotation(startPos, startRot);
    }
}</code></pre>
<p>Posez ça sur un mesh avec un collider et un Rigidbody, ajoutez un rig XR Origin à la scène, et vous avez quelque chose que vous pouvez attraper et lancer. Voir ses propres mains déplacer un vrai objet dans l'espace 3D est le moment où la VR fait tilt pour la plupart des gens, alors arrivez-y le plus vite possible.</p>

<h2>La boucle de rendu n'est pas comme sur écran plat</h2>
<p>La VR rend la scène deux fois, une par œil, à chaque frame, et elle doit tenir un budget de temps strict. Sur un Quest vous visez 72 ou 90 images par seconde, et rater cette cible n'est pas seulement laid, ça donne la nausée. Ça change la façon de penser la performance. Les draw calls, l'overdraw et la complexité des shaders comptent bien plus que sur un moniteur où une frame perdue est une gêne mineure.</p>
<p>Deux techniques vous sauvent ici. Le fixed foveated rendering baisse la résolution sur les bords de la lentille où l'œil ne voit de toute façon pas les détails. Le single-pass instanced rendering soumet la géométrie une seule fois pour les deux yeux au lieu de deux. Activez les deux tôt. J'ai sauvé des projets qui saccadaient à 50 images juste en activant ça et en coupant quelques lumières temps réel.</p>

<h2>Tester sur le matériel tôt et souvent</h2>
<p>L'aperçu de l'éditeur vous ment. L'échelle se ressent différemment dans un vrai casque, un mouvement fluide sur un aperçu plat peut être nauséeux dans les lunettes, et un texte lisible sur votre moniteur devient illisible à travers les lentilles. Buildez sur l'appareil constamment. Avec un Quest vous pouvez utiliser le hub développeur Oculus ou simplement sideloader en USB, et en PCVR vous pouvez jouer directement dans un casque relié depuis l'éditeur.</p>
<p>Le confort est une discipline à part entière, et c'est là que la plupart des premiers projets VR échouent. J'en ai fait un article séparé parce que ça mérite de la place. Si vous avez dépassé l'étape de la configuration, lisez <a href="/fr/blog/principes-ux-vr/">les principes d'UX en VR</a> avant de concevoir le moindre système de déplacement, parce que vos choix de locomotion et d'interaction décideront si les gens supportent ce que vous avez construit.</p>

<h2>Un premier projet réaliste</h2>
<p>N'essayez pas encore de faire un jeu. Faites une pièce. Posez quelques objets attrapables sur une table, ajoutez un bouton au mur qui allume une lumière, et faites un système de téléportation simple pour vous déplacer. Cette petite scène met en jeu le rendu, les entrées, l'interaction et la locomotion, qui sont les quatre piliers de toute application VR. Une fois que cette pièce se sent bien dans le casque, vous en comprenez assez pour commencer quelque chose de vrai.</p>
<p>Le développement VR récompense la patience et punit les raccourcis, mais la récompense n'a rien à voir avec le travail sur écran plat. La première fois qu'un testeur tend la main pour toucher quelque chose qui n'existe pas et sursaute, vous comprendrez pourquoi les gens continuent de créer pour ce médium. Commencez petit, testez sur du vrai matériel, et respectez le confort du joueur dès le début.</p>`
  },
  {
    title: 'Les principes d\'UX en VR',
    slug: 'principes-ux-vr',
    excerpt: 'Locomotion, mal des transports et conception de l\'interaction en VR. Des règles durement acquises pour bâtir des expériences que les gens peuvent réellement utiliser sans retirer le casque au bout de cinq minutes.',
    category: 'VR & XR',
    tags: ['vr', 'ux', 'confort', 'locomotion'],
    pexels: 'person using vr',
    content: `<p>J'ai rendu des gens malades avec mon propre logiciel. Pas exprès, mais le premier système de locomotion que j'ai construit avait une courbe d'accélération douce qui me convenait parfaitement et qui a rendu un tiers de mes testeurs verts en deux minutes. Cette expérience m'a appris plus sur le design VR que n'importe quel tutoriel. Le casque est sanglé sur le visage de quelqu'un et branché sur son système d'équilibre, donc une erreur d'UX ici n'est pas un clic raté, c'est une personne qui arrache l'appareil et ne revient jamais.</p>

<h2>Pourquoi le mal des transports VR survient</h2>
<p>Le mal du simulateur vient d'un décalage entre ce que vos yeux rapportent et ce que votre oreille interne ressent. Quand vous poussez le joystick pour avancer, vos yeux voient du mouvement mais votre corps sait qu'il est immobile. Votre cerveau interprète ce conflit comme il interprète un poison, ce qui explique la nausée. Tout le design de confort consiste à réduire cet écart ou à le masquer.</p>
<p>La sensibilité varie énormément d'une personne à l'autre. Certains joueurs peuvent courir et faire des pas latéraux en fluide pendant des heures, d'autres sont mal à l'aise après un simple virage lent. Vous ne pouvez pas concevoir pour la minorité au ventre solide. Vous concevez pour la majorité sensible et vous laissez les coriaces opter pour des options plus intenses.</p>

<h2>Locomotion : choisir le bon outil</h2>
<p>La façon de déplacer les joueurs est la plus grande décision de confort que vous prendrez. Il n'y a pas d'option parfaite, seulement des compromis.</p>
<ul>
<li>La téléportation est la plus sûre. Le joueur pointe, cligne vers un nouvel endroit, et il n'y a aucun mouvement continu pour contrarier l'oreille interne. Ça casse un peu l'immersion et c'est maladroit en combat, mais presque personne n'est malade avec ça. Faites-en votre option par défaut.</li>
<li>La locomotion fluide, la marche au joystick qui semble naturelle aux joueurs, est la plus immersive et la plus nauséeuse. Si vous la proposez, rendez-la optionnelle et jamais le seul choix.</li>
<li>Le déplacement par dash ou par petits sauts fait la moyenne avec un cligne rapide sur une courte distance.</li>
<li>Le déplacement physique à l'échelle de la pièce, où le joueur marche vraiment, est le plus confortable de tous parce qu'il n'y a aucun décalage. Concevez vos espaces pour tenir dans une vraie zone de jeu quand vous le pouvez.</li>
</ul>
<p>L'astuce que la plupart des jeux sortis utilisent est de proposer tout ça et de laisser les joueurs choisir dans un menu de confort qu'ils voient avant tout le reste. Respectez le fait que tout le monde n'a pas votre tolérance.</p>

<h2>La rotation est plus sournoise que le déplacement</h2>
<p>La rotation provoque plus de nausées que la translation chez beaucoup de gens, et c'est facile à négliger. La rotation fluide au joystick, où le monde tourne continuellement autour d'un joueur immobile, est brutale pour les utilisateurs sensibles. Le correctif standard est le snap turning, où la vue saute d'un angle fixe comme 30 ou 45 degrés à chaque coup de joystick. La coupe instantanée ne donne à l'oreille interne rien de continu à contester.</p>
<p>Proposez les deux et laissez les joueurs régler l'angle du snap. Je règle désormais chaque projet sur le snap turning par défaut et je traite la rotation fluide comme l'option avancée, l'inverse de ce qui semble intuitif quand on le construit.</p>

<h2>Réduire le conflit visuel</h2>
<p>Quand vous avez bel et bien un mouvement continu, vous pouvez l'adoucir. Une vignette qui rétrécit le champ de vision pendant le déplacement est l'outil le plus efficace que je connaisse. En noircissant la périphérie pendant que le joueur bouge, vous supprimez le flux optique sur les bords que le cerveau lit le plus fortement comme du mouvement. On croirait que ça donne une sensation de restriction mais la plupart des gens ne le remarquent jamais consciemment, et ça élargit nettement le nombre de gens qui peuvent jouer confortablement.</p>
<p>Voici l'idée en pseudo-code. L'intensité de la vignette varie avec la vitesse du joueur.</p>
<pre><code>onUpdate(player):
    speed = magnitude(player.velocity)
    target = clamp(remap(speed, 0, maxSpeed, 0, maxVignette), 0, maxVignette)
    // tendre vers la cible pour que les bords s'estompent en douceur
    vignette.intensity = lerp(vignette.intensity, target, deltaTime * 8)
    apply(vignette)</code></pre>
<p>D'autres petites choses aident. Gardez un horizon stable, évitez de bouger la caméra d'une manière que le joueur n'a pas initiée, n'appliquez jamais de head-bob, et ne retirez jamais le contrôle de la caméra pendant le jeu. Tout mouvement que le joueur n'a pas causé lui-même est un déclencheur de nausée de premier ordre.</p>

<h2>L'interaction à l'échelle humaine</h2>
<p>Une fois que les gens peuvent se déplacer confortablement, ils doivent faire des choses, et l'interaction VR a ses propres règles. La plus grande est que l'échelle et la portée sont physiques. Si un bouton est trop haut, un joueur petit ne peut littéralement pas l'atteindre. Si vos menus flottent à deux mètres, personne ne peut les toucher. Concevez pour un joueur assis et un joueur debout, et testez avec des gens de tailles différentes.</p>
<ul>
<li>Rendez les objets interactifs visiblement attrapables. Mettez-les en surbrillance au survol, donnez-leur un léger halo ou contour, et accrochez la pose de la main à quelque chose qui ressemble à une vraie prise.</li>
<li>Donnez du retour à travers plus d'un sens. Une vibration du contrôleur, plus un son de clic, plus un changement visuel, rend un appui réel parce que le joueur ne reçoit aucune résistance physique du vide.</li>
<li>Posez les interfaces sur des surfaces que le joueur peut atteindre, ou attachez-les au poignet comme une montre, ou courbez-les légèrement pour que les bords ne soient pas plus loin que le centre.</li>
<li>Acceptez qu'il n'y a aucun retour haptique. Sans résistance, les gens passent la main à travers une table virtuelle. Concevez autour de ça au lieu de le combattre.</li>
</ul>

<h2>Le confort est un réglage, pas un défaut qu'on devine</h2>
<p>Le fil rouge de tout ça, c'est le choix. Vous ne connaissez pas la tolérance de votre joueur, sa taille, son espace de jeu, ni s'il est assis ou debout. Alors vous demandez, ou vous fournissez des options et des valeurs par défaut sensées. Un bon menu de confort VR couvre le type de locomotion, le style et l'angle de rotation, la force de la vignette et un calibrage de la hauteur. Affichez-le au premier lancement, pas enterré sous trois menus.</p>
<p>Si vous montez encore votre chaîne d'outils et n'avez pas choisi de moteur, je couvre ces bases dans <a href="/fr/blog/debuter-developpement-vr/">débuter en développement VR</a>. La configuration technique et le design de confort se nourrissent l'un l'autre, parce que le moteur que vous choisissez détermine quels outils de confort viennent gratuitement.</p>

<h2>Tester sur des gens qui ne sont pas vous</h2>
<p>Vous développerez une tolérance au fil du travail. Après une semaine à tester votre propre locomotion, vous ne ressentirez plus rien, ce qui fait de vous le pire juge possible de son confort. Faites venir régulièrement de nouveaux testeurs, surtout des gens qui n'ont jamais utilisé la VR. Observez leur corps. Les gens se penchent, ils tendent les bras, ils se cramponnent, et ils deviennent silencieux juste avant de se sentir mal. Ces signaux vous en disent plus que n'importe quel questionnaire.</p>
<p>Une bonne UX en VR est surtout faite de retenue. Déplacez les gens en douceur, donnez-leur le contrôle, rendez l'interaction évidente, et offrez toujours une issue. Faites ça et vous bâtirez des expériences où les gens restent une heure au lieu de fuir en cinq minutes.</p>`
  }
];

module.exports = [
  {
    title: 'Debuter avec Flutter pour Android et iOS',
    slug: 'debuter-avec-flutter',
    excerpt: 'Comment je mets en place un projet Flutter qui tourne sur Android et iOS depuis une seule base de code, avec les choix d outils qui m ont fait gagner du temps.',
    category: 'Flutter',
    tags: ['flutter', 'dart', 'mobile', 'multiplateforme'],
    pexels: 'mobile app development',
    content: `<p>Je suis venu a Flutter apres des annees a maintenir des bases de code Android et iOS separees qui divergeaient peu importe la discipline de l equipe. Un seul framework, un seul langage, deux stores. Cette promesse paraissait trop belle, alors j ai livre une vraie application avec avant de decider. Ca a tenu. Voici comment je lance un projet et ce que j aurais aime savoir des le premier jour.</p>

<h2>Installer la chaine d outils</h2>
<p>L installation est plus lourde qu on ne l avoue. Il faut le SDK Flutter, mais aussi une installation complete d Android Studio pour le SDK Android et un emulateur, et sur un Mac il faut Xcode plus les outils en ligne de commande pour iOS. Si vous sautez l un d eux, vous n avez que la moitie de la plateforme. Apres l installation, lancez la commande doctor et corrigez chaque avertissement avant d ecrire une ligne de code.</p>
<pre><code>flutter doctor -v
flutter create my_app
cd my_app
flutter run -d all</code></pre>
<p>La commande doctor est la chose la plus utile du SDK. Elle verifie vos licences Android, votre configuration Xcode, votre version de CocoaPods, et si un appareil est connecte. Je la lance des que quelque chose se comporte bizarrement, car neuf fois sur dix le probleme est environnemental plutot que dans mon code.</p>

<h2>Comprendre l arbre de widgets</h2>
<p>Tout dans Flutter est un widget. Le padding est un widget. L alignement est un widget. Cela parait absurde la premiere semaine puis ca s eclaire. Au lieu de regler des proprietes sur une vue, vous enveloppez des widgets dans d autres widgets, et l imbrication decrit votre mise en page. Le framework reconstruit des parties de l arbre quand l etat change, et c est rapide car il compare a l arbre precedent plutot que de toucher directement aux vues natives.</p>
<pre><code>import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('Hello')),
        body: const Center(child: Text('Tourne sur les deux plateformes')),
      ),
    );
  }
}</code></pre>
<p>StatelessWidget sert aux elements qui ne changent jamais apres leur construction. Des que vous avez besoin d un compteur, d un interrupteur ou d une valeur qui se met a jour, vous passez a StatefulWidget ou a une vraie solution d etat. J en parle en detail dans mon article sur la <a href="/fr/blog/gestion-d-etat-flutter/">gestion d etat Flutter</a>, car choisir la bonne approche tot evite un refactor penible plus tard.</p>

<h2>Le hot reload change la facon de travailler</h2>
<p>Le hot reload est la fonctionnalite qui m a convaincu. Vous sauvegardez un fichier et l application en cours se met a jour en moins d une seconde tout en gardant son etat. Ajuster une couleur, modifier un padding, corriger un bug de mise en page devient une boucle serree sans reconstruction. Il y a une difference entre le hot reload, qui preserve l etat, et le hot restart, qui jette l etat et relance depuis zero. Quand l interface parait fausse apres un reload, un hot restart la remet souvent en ordre.</p>
<ul>
<li>Hot reload: garde l etat, injecte le code modifie, quasi instantane</li>
<li>Hot restart: reinitialise l etat, plus lent, necessaire apres un changement de code de haut niveau</li>
<li>Reconstruction complete: necessaire apres un changement de config native ou l ajout de plugins</li>
</ul>

<h2>Gerer les deux plateformes honnetement</h2>
<p>Une seule base de code ne veut pas dire que vous pouvez ignorer les plateformes. Les utilisateurs iOS attendent un glissement de retour et une certaine sensation au defilement. Les utilisateurs Android attendent les ondulations material et un bouton retour materiel. Flutter vous donne les deux langages de design, Material et Cupertino, et vous pouvez brancher selon la plateforme quand c est utile. Je garde ce branchement petit et centralise pour qu il ne s eparpille pas dans toute l application.</p>
<pre><code>import 'dart:io' show Platform;
import 'package:flutter/material.dart';

Widget adaptiveSpinner() {
  if (Platform.isIOS) {
    return const CupertinoActivityIndicator();
  }
  return const CircularProgressIndicator();
}</code></pre>

<h2>La structure de projet que j adopte</h2>
<p>Le modele par defaut met tout dans un seul fichier. C est bien pour une demo et terrible pour une application a maintenir. Je decoupe le code en dossiers par fonctionnalite plutot que par type, ainsi une fonctionnalite possede ses ecrans, ses modeles et sa logique au meme endroit. Cela paie le jour ou vous supprimez une fonctionnalite et voulez qu elle disparaisse proprement.</p>
<p>Une fois la structure en place, les sujets suivants sont la facon dont l application parle aux API natives et comment elle reste fluide sous charge. Je creuse les ponts natifs dans <a href="/fr/blog/flutter-canaux-de-plateforme/">les canaux de plateforme Flutter</a>, et le maintien de temps de trame bas dans <a href="/fr/blog/optimisation-des-performances-flutter/">l optimisation des performances Flutter</a>. Posez d abord de bonnes fondations, puis ajoutez ces sujets par dessus.</p>

<h2>Quoi construire en premier</h2>
<p>Ne commencez pas par l application de vos reves. Construisez quelque chose de petit qui touche un appel reseau, une liste, un ecran de detail et un stockage local. Cela couvre la plupart de ce dont une vraie application a besoin et expose les asperites de votre configuration tant que les enjeux sont faibles. Quand vous l aurez fait deux fois, le framework cesse de vous combattre et commence a disparaitre en arriere plan, exactement la ou un bon outil doit etre.</p>`
  },
  {
    title: 'Gestion d etat Flutter avec Provider, Riverpod et Bloc',
    slug: 'gestion-d-etat-flutter',
    excerpt: 'Le point de vue d un developpeur en activite sur Provider, Riverpod et Bloc, avec les compromis qui comptent vraiment quand une application grandit.',
    category: 'Flutter',
    tags: ['flutter', 'gestion-d-etat', 'riverpod', 'bloc'],
    pexels: 'app architecture screen',
    content: `<p>La gestion d etat est l endroit ou les projets Flutter restent sains ou pourrissent. Le framework fournit setState, qui convient pour un seul widget, mais des que l etat doit etre partage entre ecrans il faut mieux. J ai livre des applications avec Provider, Riverpod et Bloc, et chacun gagne sa place dans des situations differentes. Voici comment je choisis.</p>

<h2>Pourquoi setState ne suffit plus</h2>
<p>setState reconstruit le widget dans lequel il vit. Cela marche jusqu a ce que deux ecrans aient besoin des memes donnees, ou qu un enfant profond ait besoin d une valeur tenue pres de la racine. Vous finissez par passer des callbacks et des valeurs vers le bas a travers les constructeurs, couche apres couche, et le terme pour cette misere est le prop drilling. Chaque bibliotheque d etat existe pour resoudre ce meme probleme: amener les donnees la ou elles sont necessaires sans les enfiler a travers tout le reste.</p>

<h2>Provider, le depart en douceur</h2>
<p>Provider est longtemps la recommandation officielle et reste un choix par defaut raisonnable. Il s appuie sur les inherited widgets et offre une facon propre d exposer une valeur a l arbre en dessous. Un ChangeNotifier tient votre etat et appelle notifyListeners quand quelque chose change, et les widgets qui ecoutent se reconstruisent. C est simple a raisonner et facile a enseigner a un nouveau membre.</p>
<pre><code>import 'package:flutter/material.dart';

class CartModel extends ChangeNotifier {
  final List&lt;String&gt; _items = [];
  List&lt;String&gt; get items => _items;

  void add(String item) {
    _items.add(item);
    notifyListeners();
  }
}</code></pre>
<p>La faiblesse de Provider apparait a grande echelle. Il est lie a l arbre de widgets, donc tester la logique isolement demande des efforts, et il est facile de reconstruire plus de l arbre que prevu. Pour les petites et moyennes applications je n ai aucune plainte.</p>

<h2>Riverpod, ce que je choisis maintenant</h2>
<p>Riverpod vient du meme auteur que Provider et corrige la plupart de ses douleurs. L etat vit en dehors de l arbre de widgets, donc vous pouvez le lire sans BuildContext, le tester sans monter de widgets, et attraper les erreurs a la compilation plutot qu a l execution. Les providers sont declares comme variables de haut niveau et vous les observez la ou vous en avez besoin.</p>
<pre><code>import 'package:flutter_riverpod/flutter_riverpod.dart';

final counterProvider = StateProvider&lt;int&gt;((ref) => 0);

class CounterText extends ConsumerWidget {
  const CounterText({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(counterProvider);
    return Text('Compteur a ' + count.toString());
  }
}</code></pre>
<p>Ce que j aime le plus, c est sa gestion de l async. Un FutureProvider vous donne les etats de chargement, d erreur et de donnees sans ecrire le boilerplate vous meme, ce qui se relie bien au travail reseau que je decris dans <a href="/fr/blog/debuter-avec-flutter/">debuter avec Flutter</a>. Pour la plupart des nouveaux projets c est mon choix par defaut.</p>

<h2>Bloc, quand la discipline compte</h2>
<p>Bloc est plus lourd et plus dogmatique. Vous modelisez votre application comme des evenements qui entrent et des etats qui sortent, et la separation stricte rend les grandes equipes previsibles. Chaque changement d etat est un evenement explicite avec un gestionnaire clair, ce qui rend l application facile a tracer et a tester. Le cout est la ceremonie. Les fonctionnalites simples demandent beaucoup de code.</p>
<ul>
<li>Provider: peu de ceremonie, lie a l arbre, ideal pour les petites applications</li>
<li>Riverpod: testable, sur a la compilation, fort support async, mon defaut</li>
<li>Bloc: verbeux mais previsible, brille sur les grandes equipes et les flux complexes</li>
</ul>

<h2>Comment je decide vraiment</h2>
<p>J adapte l outil a l equipe et a l application. Un projet solo ou un prototype recoit Provider ou Riverpod parce que je veux avancer vite. Une grande application avec de nombreux contributeurs et des regles metier complexes recoit Bloc parce que la structure se rentabilise en moins de surprises. La mauvaise decision est de choisir l outil le plus lourd pour le plus petit travail parce qu un article de blog vous a dit que c etait la meilleure pratique.</p>

<h2>Gardez l etat hors de la methode build</h2>
<p>Quoi que vous choisissiez, une regle tient pour toutes. Ne creez jamais et ne modifiez jamais l etat dans une methode build, car build peut s executer plusieurs fois par seconde et vous creerez des dechets ou declencherez des boucles. Gardez l etat au bon endroit, ecoutez le, et laissez le framework reconstruire. Bien faire cela garde aussi votre application fluide, ce qui rejoint <a href="/fr/blog/optimisation-des-performances-flutter/">l optimisation des performances Flutter</a>. Reglez bien l etat et la plupart des autres problemes deviennent plus petits.</p>`
  },
  {
    title: 'Canaux de plateforme Flutter: appeler du code natif Android et iOS',
    slug: 'flutter-canaux-de-plateforme',
    excerpt: 'Quand Flutter ne peut pas atteindre une API native seul, les canaux de plateforme comblent le fosse. Voici comment je relie Dart a Kotlin et Swift en securite.',
    category: 'Flutter',
    tags: ['flutter', 'canaux-de-plateforme', 'kotlin', 'swift'],
    pexels: 'smartphone native code',
    content: `<p>Flutter couvre un terrain enorme, mais on finit par toucher quelque chose qu il n expose pas. Un capteur precis, un SDK fournisseur, un comportement de plateforme sans plugin. Quand cela arrive, on se tourne vers les canaux de plateforme, qui permettent a votre code Dart d appeler du Kotlin natif sur Android et du Swift sur iOS. Je les ai utilises pour tout, du materiel Bluetooth a un SDK de paiement, et ils sont moins effrayants qu ils n en ont l air.</p>

<h2>Comment fonctionne un canal</h2>
<p>Un canal de plateforme est un tuyau nomme entre Dart et le cote natif. Vous lui donnez un nom de chaine, vous envoyez un appel de methode avec des arguments optionnels, et le cote natif repond avec un resultat ou une erreur. Les messages sont serialises avec un codec standard qui gere les types courants comme les chaines, nombres, listes et maps. Vous ne pouvez pas passer d objets directement, alors vous concevez un petit contrat plat et vous vous y tenez.</p>
<pre><code>import 'package:flutter/services.dart';

class Battery {
  static const _channel = MethodChannel('app/battery');

  Future&lt;int&gt; level() async {
    final result = await _channel.invokeMethod('getLevel');
    return result as int;
  }
}</code></pre>
<p>Le nom du canal doit correspondre exactement des deux cotes. Une faute de frappe vous donne une erreur d implementation manquante a l execution et aucun compilateur ne vous avertira, alors je garde le nom du canal dans une seule constante et je le reference partout.</p>

<h2>Le cote Android en Kotlin</h2>
<p>Sur Android vous enregistrez un gestionnaire dans votre activite principale. Il recoit le nom de methode comme chaine, choisit selon ce nom, et repond via le callback de resultat. Tout ce que vous faites ici tourne sur le thread de plateforme, donc le travail lourd doit en sortir ou vous saccaderez l interface, un sujet que je couvre dans <a href="/fr/blog/optimisation-des-performances-flutter/">l optimisation des performances Flutter</a>.</p>
<pre><code>class MainActivity : FlutterActivity() {
  override fun configureFlutterEngine(engine: FlutterEngine) {
    super.configureFlutterEngine(engine)
    MethodChannel(engine.dartExecutor.binaryMessenger, "app/battery")
      .setMethodCallHandler { call, result ->
        if (call.method == "getLevel") {
          result.success(readBatteryLevel())
        } else {
          result.notImplemented()
        }
      }
  }
}</code></pre>

<h2>Le cote iOS en Swift</h2>
<p>La configuration iOS reflete celle d Android. Vous enregistrez le meme nom de canal dans le delegate de l application et vous gerez l appel. La forme est identique meme si le langage differe, ce qui est une des choses que j apprecie dans la conception. Une fois le motif appris sur une plateforme, l autre parait familiere.</p>
<pre><code>let channel = FlutterMethodChannel(
  name: "app/battery",
  binaryMessenger: controller.binaryMessenger)

channel.setMethodCallHandler { call, result in
  if call.method == "getLevel" {
    result(self.readBatteryLevel())
  } else {
    result(FlutterMethodNotImplemented)
  }
}</code></pre>

<h2>Gerer les erreurs et les threads</h2>
<p>Les appels natifs echouent. Le materiel est absent, une permission est refusee, le SDK leve une exception. Renvoyez ces echecs comme erreurs plutot que de les avaler, et attrapez les cote Dart pour que l interface reagisse. J enveloppe chaque appel de canal dans un bloc try et je presente un message clair a l utilisateur au lieu d une exception de plateforme brute.</p>
<ul>
<li>Gardez le nom du canal dans une seule constante partagee</li>
<li>Renvoyez les erreurs explicitement pour que Dart les gere proprement</li>
<li>Sortez le travail natif lourd du thread de plateforme</li>
<li>Faites correspondre les types d arguments a ce que le codec standard supporte</li>
</ul>

<h2>Quand ecrire un plugin a la place</h2>
<p>Si le code natif est quelque chose que d autres applications pourraient utiliser, empaquetez le comme plugin plutot que de l enterrer dans une seule application. Un plugin enveloppe les memes mecaniques de canal mais vous donne une API Dart propre et une structure reutilisable. Avant d ecrire l un ou l autre, cherchez dans le registre de packages, car la chose dont vous avez besoin existe souvent deja et est mieux testee qu une tentative fraiche. Les canaux de plateforme sont puissants, mais le meilleur code natif est celui que vous n avez pas eu a ecrire. Pour les bases de mise en place avant d arriver ici, voir <a href="/fr/blog/debuter-avec-flutter/">debuter avec Flutter</a>.</p>`
  },
  {
    title: 'Optimisation des performances Flutter',
    slug: 'optimisation-des-performances-flutter',
    excerpt: 'Des moyens pratiques pour garder les applications Flutter a soixante images par seconde, des widgets const a la construction de listes jusqu au profilage qui chasse la saccade.',
    category: 'Flutter',
    tags: ['flutter', 'performances', 'profilage', 'optimisation'],
    pexels: 'fast performance speed',
    content: `<p>Une application Flutter qui perd des images parait bon marche peu importe sa beaute. Le framework est rapide par defaut, mais il est facile d annuler cela avec quelques habitudes negligentes. J ai passe assez de temps dans le profileur pour savoir ou le temps part, et la plupart des gains viennent d une courte liste de corrections plutot que d astuces malines. Voici ce que je verifie d abord.</p>

<h2>Mesurer avant de changer quoi que ce soit</h2>
<p>N optimisez jamais sur une intuition. Lancez l application en mode profile, pas en mode debug, car les builds de debug sont volontairement lents et vous mentiront. La vue de performance de DevTools vous montre la chronologie des images, et tout ce qui pousse une image au dela de seize millisecondes est votre probleme. Trouvez la vraie image lente avant de toucher au code, sinon vous passerez un apres midi a accelerer quelque chose que personne n a remarque.</p>
<pre><code>flutter run --profile
# puis ouvrez DevTools et enregistrez la chronologie de performance</code></pre>

<h2>Utilisez const partout ou vous le pouvez</h2>
<p>Un widget const est construit une fois et reutilise, donc le framework saute sa reconstruction. C est le gain de performance le moins cher de Flutter et la plupart des applications le laissent de cote. Si un widget et ses entrees ne changent jamais, marquez le const. L analyseur peut meme signaler les endroits pour vous si vous activez le bon lint.</p>
<pre><code>// reconstruit a chaque fois que le parent se reconstruit
Padding(padding: EdgeInsets.all(8), child: Text('Salut'))

// construit une fois et mis en cache
const Padding(padding: EdgeInsets.all(8), child: Text('Salut'))</code></pre>
<p>Cela compte surtout dans les widgets qui se reconstruisent souvent, ce qui boucle vers le choix de la bonne approche dans la <a href="/fr/blog/gestion-d-etat-flutter/">gestion d etat Flutter</a>. Une portee de reconstruction serree plus des widgets const garde petit le travail que le framework fait a chaque image.</p>

<h2>Construisez les longues listes paresseusement</h2>
<p>L erreur la plus courante que je vois est de construire une longue liste avec une Column dans une vue defilante. Cela construit chaque element d avance, meme les milliers hors ecran. ListView.builder ne construit que ce qui est visible plus un petit tampon, donc la memoire et le temps de construction restent plats peu importe la longueur de la liste. Pour toute liste qui peut grandir, utilisez le builder.</p>
<pre><code>ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) {
    return ListTile(title: Text(items[index]));
  },
)</code></pre>

<h2>Gardez le travail hors du thread principal</h2>
<p>L interface tourne sur un seul thread, et tout ce que vous y faites de lourd vole du temps au rendu. Analyser un gros payload JSON, redimensionner une image ou lancer un calcul lent gelera l interface. Deplacez ce travail vers un isolate en arriere plan avec l aide compute pour que le thread d interface reste libre de dessiner les images.</p>
<pre><code>import 'package:flutter/foundation.dart';

Future&lt;List&lt;Item&gt;&gt; parseItems(String json) {
  return compute(decodeItems, json);
}</code></pre>
<ul>
<li>Profilez en mode profile, jamais en mode debug</li>
<li>Marquez const les widgets qui ne changent pas</li>
<li>Utilisez les constructeurs builder pour les listes longues ou croissantes</li>
<li>Poussez l analyse et les maths lourds vers un isolate</li>
<li>Mettez en cache et dimensionnez les images au lieu de charger la pleine resolution</li>
</ul>

<h2>Les images sont souvent le cout cache</h2>
<p>Les images mangent la memoire plus vite que tout le reste. Une photo chargee en pleine resolution dans une petite vignette gaspille la plupart de cette memoire. Reglez une largeur de cache qui correspond a la taille d affichage pour que le framework decode un bitmap plus petit. Pour les images reseau, utilisez un package de cache pour les recuperer une fois plutot qu a chaque defilement.</p>

<h2>Surveillez vos shaders au premier lancement</h2>
<p>La premiere fois qu une animation tourne, Flutter peut compiler des shaders, ce qui cause une saccade ponctuelle que les utilisateurs remarquent sur une installation fraiche. Vous pouvez prechauffer les shaders pendant un ecran de demarrage pour que la saccade arrive avant que l utilisateur regarde. C est un petit detail, mais les premieres impressions collent. Les chemins de code natif peuvent aussi affecter le demarrage, c est pourquoi je garde le travail de plateforme leger comme decrit dans <a href="/fr/blog/flutter-canaux-de-plateforme/">les canaux de plateforme Flutter</a>. La performance est rarement une grosse correction. C est une douzaine de petites, chacune mesuree, chacune gardee.</p>`
  },
  {
    title: 'Publier une application Flutter sur l App Store et le Play Store',
    slug: 'publier-une-app-flutter-sur-les-stores',
    excerpt: 'La checklist de publication que je suis pour faire passer une application Flutter par la revue Apple et la mettre sur Google Play sans panique de derniere minute.',
    category: 'Flutter',
    tags: ['flutter', 'app-store', 'play-store', 'publication'],
    pexels: 'app store publishing',
    content: `<p>Ecrire l application est la moitie du travail. La mettre dans les deux stores est l autre moitie, et c est celle qui surprend. Apple et Google ont chacun leur propre signature, leurs propres metadonnees et leurs propres humeurs de revue. J ai publie sur les deux plus de fois que je ne peux compter, et la difference entre une publication fluide et une stressante est la preparation. Voici le chemin que je suis.</p>

<h2>Reglez les bases avant de builder</h2>
<p>Avant de generer le moindre binaire de release, reglez bien les champs ennuyeux. Un identifiant d application unique que vous ne changerez jamais, un numero de version et de build sense, le nom de l application, et les versions d OS minimales supportees. Changer l identifiant d application apres le lancement equivaut a une nouvelle application, alors decidez le avec soin. Ils vivent dans la config Gradle sur Android et le projet Xcode sur iOS.</p>
<pre><code># pubspec.yaml controle la version et le numero de build
version: 1.0.0+1
# 1.0.0 est la version vue par les utilisateurs, +1 est le numero de build</code></pre>

<h2>Signature Android et app bundle</h2>
<p>Google Play veut un app bundle plutot qu un APK maintenant, et il le veut signe avec une cle d upload que vous creez une fois et gardez precieusement. Perdez cette cle et vous etes parti pour un processus de recuperation penible. Je stocke le keystore en dehors du depot et je le reference via un fichier de proprietes jamais commit. Builder le bundle de release est une seule commande une fois la signature branchee.</p>
<pre><code>flutter build appbundle --release
# produit build/app/outputs/bundle/release/app-release.aab</code></pre>
<p>Uploadez ce fichier vers la Play Console, remplissez la fiche du store, configurez le questionnaire de classification de contenu, et choisissez une piste de release. Je pousse toujours vers les tests internes d abord pour pouvoir installer l artefact exact que les utilisateurs auront avant qu il devienne public.</p>

<h2>Signature iOS et archivage</h2>
<p>La signature Apple est plus impliquee. Il vous faut un compte Apple Developer, des certificats, un identifiant d application et des profils de provisionnement. Xcode peut gerer la plupart de cela automatiquement si vous vous connectez, ce que je recommande plutot que de lutter avec les profils a la main. Vous buildez la release iOS via Flutter puis archivez et uploadez via Xcode ou l outil transporter.</p>
<pre><code>flutter build ipa --release
# puis ouvrez Xcode, archivez et uploadez vers App Store Connect</code></pre>
<ul>
<li>Enregistrez l identifiant d application dans le portail developpeur</li>
<li>Laissez Xcode gerer les certificats et profils quand c est possible</li>
<li>Uploadez vers TestFlight avant de soumettre pour revue</li>
<li>Preparez des captures d ecran pour chaque taille d appareil requise</li>
</ul>

<h2>Les fiches de store prennent plus de temps qu on ne le croit</h2>
<p>Les deux stores ont besoin de captures d ecran a des tailles precises, d une icone, d une description, de mots cles, d une URL de politique de confidentialite et d une declaration de collecte de donnees. Apple est stricte sur le questionnaire de confidentialite et rejettera les reponses vagues. Reservez du vrai temps pour cela, car une fiche a moitie faite bloque toute la publication. Je garde une checklist pour que rien ne soit oublie a la derniere minute.</p>

<h2>Survivre a la revue</h2>
<p>La revue Apple peut rejeter pour des raisons qui paraissent arbitraires jusqu a ce que vous lisiez les directives de pres. Les plus courantes sont l absence d identifiants de compte de demonstration, des liens casses, des plantages sur leur appareil de test, et un usage flou des permissions. Donnez leur un identifiant fonctionnel si votre application en a besoin, testez sur un vrai appareil, et expliquez pourquoi vous demandez chaque permission. La revue Google est generalement plus rapide et plus automatisee mais se soucie toujours des permissions et du respect des politiques.</p>

<h2>Planifiez aussi les mises a jour</h2>
<p>Livrer la version un est le debut. Incrementez le numero de build a chaque upload, gardez un changelog, et utilisez les deploiements progressifs sur Android pour qu une mauvaise release atteigne d abord une petite tranche d utilisateurs. Les habitudes de performance de <a href="/fr/blog/optimisation-des-performances-flutter/">l optimisation des performances Flutter</a> comptent ici car les metriques de plantage et de saccade affectent votre classement dans le store. Et si votre application s appuie sur des fonctionnalites natives, testez les avec soin sur les versions d OS comme je le decris dans <a href="/fr/blog/flutter-canaux-de-plateforme/">les canaux de plateforme Flutter</a>. Une publication calme est une publication preparee. Faites le travail ennuyeux tot et le jour du lancement cesse d etre effrayant.</p>`
  }
];

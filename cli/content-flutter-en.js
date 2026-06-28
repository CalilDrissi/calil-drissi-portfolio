module.exports = [
  {
    title: 'Getting started with Flutter for Android and iOS',
    slug: 'getting-started-with-flutter',
    excerpt: 'How I set up a Flutter project that runs on both Android and iOS from one codebase, plus the toolchain decisions that saved me time.',
    category: 'Flutter',
    tags: ['flutter', 'dart', 'mobile', 'cross-platform'],
    pexels: 'mobile app development',
    content: `<p>I came to Flutter after years of maintaining separate Android and iOS codebases that drifted apart no matter how disciplined the team was. One framework, one language, two stores. That promise sounded too good, so I shipped a real app with it before deciding. It held up. Here is how I get a project running and what I wish someone had told me on day one.</p>

<h2>Installing the toolchain</h2>
<p>The install is heavier than people admit. You need the Flutter SDK, but you also need a full Android Studio install for the Android SDK and an emulator, and on a Mac you need Xcode plus the command line tools for iOS. Skip any of those and you only get half the platform. After installing, run the doctor command and fix every warning before writing a line of code.</p>
<pre><code>flutter doctor -v
flutter create my_app
cd my_app
flutter run -d all</code></pre>
<p>The doctor command is the most useful thing in the SDK. It checks your Android licenses, your Xcode setup, your CocoaPods version, and whether a device is connected. I run it whenever something behaves strangely, because nine times out of ten the problem is environmental rather than in my code.</p>

<h2>Understanding the widget tree</h2>
<p>Everything in Flutter is a widget. Padding is a widget. Alignment is a widget. This feels absurd for the first week and then it clicks. Instead of setting properties on a view, you wrap widgets in other widgets, and the nesting describes your layout. The framework rebuilds parts of the tree when state changes, and it is fast because it diffs against the previous tree rather than touching the native views directly.</p>
<pre><code>import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('Hello')),
        body: const Center(child: Text('Running on both platforms')),
      ),
    );
  }
}</code></pre>
<p>StatelessWidget is for things that never change after they are built. The moment you need a counter, a toggle, or any value that updates, you reach for StatefulWidget or a proper state solution. I cover that in detail in my post on <a href="/blog/flutter-state-management/">Flutter state management</a>, because picking the right approach early saves a painful refactor later.</p>

<h2>Hot reload changes how you work</h2>
<p>Hot reload is the feature that sold me. You save a file and the running app updates in under a second while keeping its current state. Tweaking a color, adjusting padding, fixing a layout bug becomes a tight loop with no rebuild. There is a difference between hot reload, which preserves state, and hot restart, which throws state away and reruns from scratch. When the UI looks wrong after a reload, a hot restart usually clears it.</p>
<ul>
<li>Hot reload: keeps app state, injects changed code, near instant</li>
<li>Hot restart: resets state, slower, needed after changing top level code</li>
<li>Full rebuild: needed after changing native config or adding plugins</li>
</ul>

<h2>Handling both platforms honestly</h2>
<p>One codebase does not mean you can ignore the platforms. iOS users expect a back swipe and a certain feel for scrolling. Android users expect material ripples and a hardware back button. Flutter gives you both design languages, Material and Cupertino, and you can branch on the platform when it matters. I keep this branching small and centralised so it does not spread through the whole app.</p>
<pre><code>import 'dart:io' show Platform;
import 'package:flutter/material.dart';

Widget adaptiveSpinner() {
  if (Platform.isIOS) {
    return const CupertinoActivityIndicator();
  }
  return const CircularProgressIndicator();
}</code></pre>

<h2>Project structure I settle on</h2>
<p>The default template dumps everything in one file. That is fine for a demo and terrible for an app you maintain. I split code into folders by feature rather than by type, so a feature owns its screens, its models, and its logic in one place. This pays off the day you delete a feature and want it gone cleanly.</p>
<p>Once you have the structure, the next things to worry about are how the app talks to native APIs and how it stays smooth under load. I dig into native bridges in <a href="/blog/flutter-platform-channels/">Flutter platform channels</a>, and into keeping frame times low in <a href="/blog/flutter-performance-optimization/">Flutter performance optimization</a>. Get the foundation right first, then layer those concerns on top.</p>

<h2>What to build first</h2>
<p>Do not start with your dream app. Build something small that touches a network call, a list, a detail screen, and local storage. That covers most of what a real app needs and exposes the rough edges of your setup while the stakes are low. By the time you have done that twice, the framework stops fighting you and starts disappearing into the background, which is exactly where a good tool belongs.</p>`
  },
  {
    title: 'Flutter state management with Provider, Riverpod, and Bloc',
    slug: 'flutter-state-management',
    excerpt: 'A working developer view of Provider, Riverpod, and Bloc, with the trade-offs that actually matter when an app grows.',
    category: 'Flutter',
    tags: ['flutter', 'state-management', 'riverpod', 'bloc'],
    pexels: 'app architecture screen',
    content: `<p>State management is where Flutter projects either stay sane or rot. The framework ships with setState, which is fine for a single widget, but as soon as state needs to be shared across screens you need something better. I have shipped apps on Provider, Riverpod, and Bloc, and each one earns its place in different situations. Here is how I choose.</p>

<h2>Why setState stops being enough</h2>
<p>setState rebuilds the widget it lives in. That works until two screens need the same data, or until a deep child needs a value held near the root. You end up passing callbacks and values down through constructors, layer after layer, and the term for that misery is prop drilling. Every state library exists to solve this same problem of getting data to where it is needed without threading it through everything in between.</p>

<h2>Provider, the gentle start</h2>
<p>Provider is the official recommendation for a long time and still a reasonable default. It sits on top of inherited widgets and gives you a clean way to expose a value to the tree below it. A ChangeNotifier holds your state and calls notifyListeners when something changes, and widgets that listen rebuild. It is simple to reason about and easy to teach a new team member.</p>
<pre><code>import 'package:flutter/material.dart';

class CartModel extends ChangeNotifier {
  final List&lt;String&gt; _items = [];
  List&lt;String&gt; get items => _items;

  void add(String item) {
    _items.add(item);
    notifyListeners();
  }
}</code></pre>
<p>The weakness of Provider shows up at scale. It is tied to the widget tree, so testing logic in isolation takes effort, and it is easy to rebuild more of the tree than you intended. For small and medium apps I have no complaints.</p>

<h2>Riverpod, what I reach for now</h2>
<p>Riverpod is from the same author as Provider and fixes most of its pain. State lives outside the widget tree, so you can read it without a BuildContext, test it without pumping widgets, and catch mistakes at compile time instead of runtime. Providers are declared as top level variables and you watch them where you need them.</p>
<pre><code>import 'package:flutter_riverpod/flutter_riverpod.dart';

final counterProvider = StateProvider&lt;int&gt;((ref) => 0);

class CounterText extends ConsumerWidget {
  const CounterText({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(counterProvider);
    return Text('Count is ' + count.toString());
  }
}</code></pre>
<p>What I like most is how it handles async. A FutureProvider gives you loading, error, and data states without writing the boilerplate yourself, which connects nicely to the network work I describe in <a href="/blog/getting-started-with-flutter/">getting started with Flutter</a>. For most new projects this is my default choice.</p>

<h2>Bloc, when discipline matters</h2>
<p>Bloc is heavier and more opinionated. You model your app as events going in and states coming out, and the strict separation makes large teams predictable. Every change to state is an explicit event with a clear handler, which makes the app easy to trace and to test. The cost is ceremony. Simple features need a lot of code.</p>
<ul>
<li>Provider: low ceremony, tied to the tree, great for smaller apps</li>
<li>Riverpod: testable, compile safe, strong async support, my default</li>
<li>Bloc: verbose but predictable, shines on large teams and complex flows</li>
</ul>

<h2>How I actually decide</h2>
<p>I match the tool to the team and the app. A solo project or a prototype gets Provider or Riverpod because I want to move fast. A large app with many contributors and complex business rules gets Bloc because the structure pays for itself in fewer surprises. The wrong move is picking the heaviest tool for the smallest job because a blog post told you it was best practice.</p>

<h2>Keep state out of the build method</h2>
<p>Whatever you choose, one rule holds across all of them. Never create or mutate state inside a build method, because build can run many times per second and you will create garbage or trigger loops. Keep state in the right place, listen to it, and let the framework rebuild. Doing this well also keeps your app smooth, which ties into <a href="/blog/flutter-performance-optimization/">Flutter performance optimization</a>. Get state right and most other problems become smaller.</p>`
  },
  {
    title: 'Flutter platform channels: calling native Android and iOS code',
    slug: 'flutter-platform-channels',
    excerpt: 'When Flutter cannot reach a native API on its own, platform channels bridge the gap. Here is how I wire Dart to Kotlin and Swift safely.',
    category: 'Flutter',
    tags: ['flutter', 'platform-channels', 'kotlin', 'swift'],
    pexels: 'smartphone native code',
    content: `<p>Flutter covers an enormous amount of ground, but eventually you hit something it does not expose. A specific sensor, a vendor SDK, a piece of platform behaviour with no plugin. When that happens you reach for platform channels, which let your Dart code call native Kotlin on Android and Swift on iOS. I have used them for everything from Bluetooth hardware to a payment SDK, and they are less scary than they look.</p>

<h2>How a channel works</h2>
<p>A platform channel is a named pipe between Dart and the native side. You give it a string name, you send a method call with optional arguments, and the native side responds with a result or an error. Messages are serialised with a standard codec that handles common types like strings, numbers, lists, and maps. You do not get to pass objects directly, so you design a small flat contract and stick to it.</p>
<pre><code>import 'package:flutter/services.dart';

class Battery {
  static const _channel = MethodChannel('app/battery');

  Future&lt;int&gt; level() async {
    final result = await _channel.invokeMethod('getLevel');
    return result as int;
  }
}</code></pre>
<p>The channel name has to match exactly on both sides. A typo gives you a missing implementation error at runtime and no compiler will warn you, so I keep the channel name in one constant and reference it everywhere.</p>

<h2>The Android side in Kotlin</h2>
<p>On Android you register a handler in your main activity. It receives the method name as a string, switches on it, and replies through the result callback. Anything you do here runs on the platform thread, so heavy work needs to move off it or you will jank the UI, a topic I cover in <a href="/blog/flutter-performance-optimization/">Flutter performance optimization</a>.</p>
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

<h2>The iOS side in Swift</h2>
<p>The iOS setup mirrors the Android one. You register the same channel name inside the app delegate and handle the call. The shape is identical even though the language differs, which is one of the things I appreciate about the design. Once you learn the pattern on one platform the other feels familiar.</p>
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

<h2>Handling errors and threads</h2>
<p>Native calls fail. The hardware is missing, a permission is denied, the SDK throws. Send those failures back as errors rather than swallowing them, and catch them on the Dart side so the UI can react. I wrap every channel call in a try block and surface a clear message to the user instead of a raw platform exception.</p>
<ul>
<li>Keep the channel name in a single shared constant</li>
<li>Return errors explicitly so Dart can handle them gracefully</li>
<li>Move heavy native work off the platform thread</li>
<li>Match argument types to what the standard codec supports</li>
</ul>

<h2>When to write a plugin instead</h2>
<p>If the native code is something other apps could use, package it as a plugin rather than burying it in one app. A plugin wraps the same channel mechanics but gives you a clean Dart API and a reusable structure. Before you write either, search the package registry, because the thing you need often already exists and is better tested than a fresh attempt. Platform channels are powerful, but the best native code is the code you did not have to write. For the basics of project setup before you get here, see <a href="/blog/getting-started-with-flutter/">getting started with Flutter</a>.</p>`
  },
  {
    title: 'Flutter performance optimization',
    slug: 'flutter-performance-optimization',
    excerpt: 'Practical ways I keep Flutter apps at sixty frames per second, from const widgets to list building to profiling the jank away.',
    category: 'Flutter',
    tags: ['flutter', 'performance', 'profiling', 'optimization'],
    pexels: 'fast performance speed',
    content: `<p>A Flutter app that drops frames feels cheap no matter how nice it looks. The framework is fast by default, but it is easy to undo that with a few careless habits. I have spent enough time in the profiler to know where the time goes, and most of the wins come from a short list of fixes rather than clever tricks. Here is what I check first.</p>

<h2>Measure before you change anything</h2>
<p>Never optimise on a hunch. Run the app in profile mode, not debug mode, because debug builds are deliberately slow and will lie to you. The DevTools performance view shows you the frame timeline, and anything that pushes a frame past sixteen milliseconds is your problem. Find the actual slow frame before touching code, or you will spend an afternoon speeding up something nobody noticed.</p>
<pre><code>flutter run --profile
# then open DevTools and record the performance timeline</code></pre>

<h2>Use const wherever you can</h2>
<p>A const widget is built once and reused, so the framework skips rebuilding it. This is the cheapest performance win in Flutter and most apps leave it on the table. If a widget and its inputs never change, mark it const. The analyzer can even flag the spots for you if you turn on the right lint.</p>
<pre><code>// rebuilt every time the parent rebuilds
Padding(padding: EdgeInsets.all(8), child: Text('Hi'))

// built once and cached
const Padding(padding: EdgeInsets.all(8), child: Text('Hi'))</code></pre>
<p>This matters most inside widgets that rebuild often, which loops back to choosing the right approach in <a href="/blog/flutter-state-management/">Flutter state management</a>. A tight rebuild scope plus const widgets keeps the work the framework does each frame small.</p>

<h2>Build long lists lazily</h2>
<p>The single most common mistake I see is building a long list with a Column inside a scroll view. That constructs every item up front, even the thousands off screen. ListView.builder only builds what is visible plus a small buffer, so memory and build time stay flat no matter how long the list is. For any list that can grow, use the builder.</p>
<pre><code>ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) {
    return ListTile(title: Text(items[index]));
  },
)</code></pre>

<h2>Keep work off the main thread</h2>
<p>The UI runs on one thread, and anything heavy you do there steals time from rendering. Parsing a large JSON payload, resizing an image, or running a slow computation will freeze the interface. Move that work to a background isolate with the compute helper so the UI thread stays free to draw frames.</p>
<pre><code>import 'package:flutter/foundation.dart';

Future&lt;List&lt;Item&gt;&gt; parseItems(String json) {
  return compute(decodeItems, json);
}</code></pre>
<ul>
<li>Profile in profile mode, never debug mode</li>
<li>Mark unchanging widgets const</li>
<li>Use builder constructors for long or growing lists</li>
<li>Push parsing and heavy math to an isolate</li>
<li>Cache and size images instead of loading full resolution</li>
</ul>

<h2>Images are usually the hidden cost</h2>
<p>Images eat memory faster than anything else. A photo loaded at full resolution into a small thumbnail wastes most of that memory. Set a cache width that matches the display size so the framework decodes a smaller bitmap. For network images, use a caching package so you fetch each one once rather than on every scroll.</p>

<h2>Watch your shaders on first run</h2>
<p>The first time an animation runs, Flutter may compile shaders, which causes a one off stutter that users notice on a fresh install. You can warm up shaders during a splash screen so the jank happens before the user is watching. This is a small detail, but first impressions stick. Native code paths can also affect startup, which is why I keep platform work lean as described in <a href="/blog/flutter-platform-channels/">Flutter platform channels</a>. Performance is rarely one big fix. It is a dozen small ones, each measured, each kept.</p>`
  },
  {
    title: 'Publishing a Flutter app to the App Store and Play Store',
    slug: 'publish-flutter-app-to-stores',
    excerpt: 'The release checklist I follow to get a Flutter app through Apple review and onto Google Play without last minute panic.',
    category: 'Flutter',
    tags: ['flutter', 'app-store', 'play-store', 'release'],
    pexels: 'app store publishing',
    content: `<p>Writing the app is half the job. Getting it into both stores is the other half, and it is the half that surprises people. Apple and Google each have their own signing, their own metadata, and their own review moods. I have shipped through both more times than I can count, and the difference between a smooth release and a stressful one is preparation. Here is the path I follow.</p>

<h2>Set the basics before you build</h2>
<p>Before you generate a single release binary, get the boring fields right. A unique application id that you will never change, a sensible version and build number, the app name, and the minimum supported OS versions. Changing the application id after launch is effectively a new app, so decide it carefully. These live in the Gradle config on Android and the Xcode project on iOS.</p>
<pre><code># pubspec.yaml controls the version and build number
version: 1.0.0+1
# 1.0.0 is the version users see, +1 is the build number</code></pre>

<h2>Android signing and the app bundle</h2>
<p>Google Play wants an app bundle rather than an APK now, and it wants it signed with an upload key you create once and guard carefully. Lose that key and you are in for a painful recovery process. I store the keystore outside the repository and reference it through a properties file that is never committed. Building the release bundle is a single command once signing is wired up.</p>
<pre><code>flutter build appbundle --release
# produces build/app/outputs/bundle/release/app-release.aab</code></pre>
<p>Upload that file to the Play Console, fill in the store listing, set up the content rating questionnaire, and choose a release track. I always push to internal testing first so I can install the exact artifact users will get before it goes public.</p>

<h2>iOS signing and archiving</h2>
<p>Apple signing is more involved. You need an Apple Developer account, certificates, an app id, and provisioning profiles. Xcode can manage most of this automatically if you sign in, which I recommend over wrangling profiles by hand. You build the iOS release through Flutter and then archive and upload through Xcode or the transporter tool.</p>
<pre><code>flutter build ipa --release
# then open Xcode, archive, and upload to App Store Connect</code></pre>
<ul>
<li>Register the app id in the developer portal</li>
<li>Let Xcode manage certificates and profiles where possible</li>
<li>Upload to TestFlight before submitting for review</li>
<li>Prepare screenshots for every required device size</li>
</ul>

<h2>Store listings take longer than you think</h2>
<p>Both stores need screenshots at specific sizes, an icon, a description, keywords, a privacy policy URL, and a data collection disclosure. Apple is strict about the privacy questionnaire and will reject vague answers. Set aside real time for this, because a half done listing blocks the whole release. I keep a checklist so nothing gets missed at the last minute.</p>

<h2>Surviving review</h2>
<p>Apple review can reject for reasons that feel arbitrary until you read the guidelines closely. The common ones are missing demo account credentials, broken links, crashes on their test device, and unclear use of permissions. Give them a working login if your app needs one, test on a real device, and explain why you ask for each permission. Google review is usually faster and more automated but still cares about permissions and policy compliance.</p>

<h2>Plan the updates too</h2>
<p>Shipping version one is the start. Bump the build number every upload, keep a changelog, and use staged rollouts on Android so a bad release reaches a small slice of users first. The performance habits from <a href="/blog/flutter-performance-optimization/">Flutter performance optimization</a> matter here because crash and jank metrics affect your store ranking. And if your app leans on native features, test those carefully across OS versions as I describe in <a href="/blog/flutter-platform-channels/">Flutter platform channels</a>. A calm release is a prepared release. Do the boring work early and launch day stops being scary.</p>`
  }
];

module.exports = [
  {
    title: 'Getting started with the Godot 4 game engine',
    slug: 'getting-started-with-godot',
    excerpt: 'A practical first look at Godot 4 from someone who shipped a game with it. Scenes, nodes, GDScript, and the workflow decisions that actually matter.',
    category: 'Game Development',
    tags: ['Godot', 'GDScript', 'Game Engine', 'Indie Dev'],
    pexels: 'video game controller',
    content: `<p>I picked up Godot for a small game jam two years ago and never went back to anything else for 2D work. I had used Unity before, and the contrast was immediate. Godot opens in under three seconds, the editor itself is one self contained download of about a hundred megabytes, and the whole thing is open source under the MIT license. That last part stopped mattering to me until the day Unity announced runtime fees and I realized how much it matters to own your tools. This post is the orientation I wish someone had handed me on day one.</p>

<h2>What Godot actually is</h2>
<p>Godot is a free, open source engine for 2D and 3D games. It runs on Windows, macOS, and Linux, and it exports to all the desktop platforms plus web, Android, and iOS. There is no account to create, no license server, no splash screen on your finished game. You download the editor, unzip it, and run it. I keep three different versions on disk because switching is just a different executable.</p>
<p>The version that changed everything was Godot 4. It brought a rewritten rendering backend built on Vulkan, real global illumination for 3D, and a much faster scripting layer. If you are starting today, start on Godot 4. Most tutorials older than that target Godot 3, and the API differences will trip you up constantly.</p>

<h2>Nodes and scenes are the whole mental model</h2>
<p>Everything in Godot is a node. A sprite is a node. A sound player is a node. A collision shape is a node. You arrange nodes into a tree, and a saved tree is called a scene. That is genuinely the entire architecture, and once it clicks you stop fighting the engine.</p>
<p>The part that took me a week to internalize is that scenes nest. A coin is a scene with a sprite, a collision area, and a sound. Your level is a scene that contains dozens of coin scenes as children. Your whole game is a scene that swaps levels in and out. There is no separate concept of a prefab like in other engines, because every scene is already reusable by design.</p>
<p>Here is how I think about which node to reach for:</p>
<ul>
<li><strong>Node2D</strong> is the base for anything with a position, rotation, and scale in 2D space.</li>
<li><strong>CharacterBody2D</strong> is what you want for a player or enemy that moves and collides but that you control directly in code.</li>
<li><strong>Area2D</strong> detects overlaps without pushing things around, perfect for pickups, triggers, and hurtboxes.</li>
<li><strong>Sprite2D</strong> and <strong>AnimatedSprite2D</strong> draw your art.</li>
<li><strong>CanvasLayer</strong> holds your UI so it stays fixed while the camera moves.</li>
</ul>

<h2>GDScript is not Python, but it rhymes</h2>
<p>Godot ships with its own scripting language called GDScript. It looks a lot like Python, with indentation based blocks and dynamic typing, but it is built into the engine so it knows about nodes and the scene tree natively. You can also use C# if you need it, and there is a C++ path through GDExtension for performance critical code, but I have shipped real games entirely in GDScript and never hit a wall.</p>
<p>Every script extends a node type. The two functions you will write constantly are _ready, which runs once when the node enters the tree, and _process, which runs every frame. Here is a tiny script that spins a sprite and prints a greeting:</p>
<pre><code>extends Sprite2D

# How fast we rotate, in radians per second
var spin_speed := 2.0

func _ready() -&gt; void:
    print("Sprite is ready")

func _process(delta: float) -&gt; void:
    # delta is the time since the last frame, so motion stays
    # consistent no matter the framerate
    rotation += spin_speed * delta
</code></pre>
<p>Notice the optional type hints with the colon and the walrus style colon equals for inferred types. I strongly recommend typing your variables. The editor gives you better autocomplete, and the compiler catches mistakes you would otherwise find at runtime.</p>

<h2>The signal system, or how nodes talk</h2>
<p>Godot leans hard on a publish and subscribe pattern called signals. A button emits a pressed signal. An Area2D emits a body_entered signal when something overlaps it. You connect those signals to functions, either by dragging in the editor or in code. This keeps your nodes decoupled, because a coin does not need to know anything about the player, it just announces that it was touched.</p>
<p>You can connect a signal from code like this:</p>
<pre><code>extends Area2D

func _ready() -&gt; void:
    body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -&gt; void:
    print("Something entered: ", body.name)
    queue_free()
</code></pre>
<p>The queue_free call removes the node safely at the end of the frame. Get comfortable with signals early. Fighting against them by polling state every frame is the most common beginner mistake I see.</p>

<h2>The editor layout you will live in</h2>
<p>The editor has a Scene dock on the left that shows your node tree, a FileSystem dock below it for your project files, an Inspector on the right for tweaking properties, and the viewport in the middle. The bottom panel is where the output console, the debugger, and the animation editor live. I dock the debugger open at all times because the stack traces are good and the remote scene tree lets you inspect a running game live.</p>
<p>One habit that paid off: keep your project organized into folders from the start. I use a scenes folder, a scripts folder, an assets folder for art and audio, and an autoload folder for global singletons. Godot does not impose a structure, so the discipline is on you.</p>

<h2>Autoloads for global state</h2>
<p>When you need something accessible from everywhere, like a score manager or an audio bus, you register a scene or script as an autoload in the project settings. It becomes a singleton that loads before everything else and persists across scene changes. This is how I handle the player inventory, settings, and save data. Do not overuse it, but for genuinely global concerns it is the cleanest tool Godot gives you.</p>

<h2>Exporting your game</h2>
<p>When you are ready to share, you install export templates once and then pick a preset for each platform. Web export is my favorite for jams because you upload a folder and anyone can play in a browser instantly, no download required. Desktop exports produce a single executable. The whole process takes a couple of minutes once it is set up.</p>

<h2>Where to go next</h2>
<p>The fastest way to learn Godot is to build something tiny and finish it. Do not start with your dream RPG. Make a game where one thing moves and one thing happens when you touch another thing. Once you have the engine basics down, the natural next step is putting them together into something playable. I wrote a full walkthrough of exactly that in <a href="/blog/godot-2d-game-tutorial/">building a 2D game in Godot with GDScript</a>, where we wire up a moving character, collisions, and a score from scratch.</p>
<p>Godot rewards people who ship. The engine gets out of your way, the community is generous, and the documentation is genuinely excellent. Download it, open a blank project, and add your first node today.</p>`
  },
  {
    title: 'Building a 2D game in Godot with GDScript',
    slug: 'godot-2d-game-tutorial',
    excerpt: 'A hands-on build of a complete 2D mini game in Godot 4: player movement, collisions, collectibles, a score, and a game over screen, all in GDScript.',
    category: 'Game Development',
    tags: ['Godot', 'GDScript', '2D Games', 'Tutorial'],
    pexels: 'retro game pixel',
    content: `<p>The best way to learn an engine is to finish a small game, not to read forever. So in this post we build a complete, if tiny, 2D game in Godot 4. A player moves around, collects coins to raise a score, and dies if an enemy touches them. By the end you will have touched every system you need for most 2D projects. If you have never opened Godot before, read my <a href="/blog/getting-started-with-godot/">getting started with the Godot 4 game engine</a> guide first, because I assume you know what a node and a scene are here.</p>

<h2>Setting up the project and the player scene</h2>
<p>Create a new project with the Forward Plus renderer. The first scene we build is the player. Add a CharacterBody2D as the root, then give it three children: a Sprite2D for the art, a CollisionShape2D for the physics body, and a Camera2D so the view follows the player. Set the collision shape to a capsule or a rectangle that roughly matches your sprite. Save the scene as player.tscn.</p>
<p>CharacterBody2D is the right base here because it gives us a built in velocity and a move_and_slide method that handles collision response without us doing the vector math by hand.</p>

<h2>Moving the player</h2>
<p>Before we write movement code, define some input actions. Open Project Settings, go to the Input Map tab, and add four actions named move_up, move_down, move_left, and move_right. Bind each to the arrow keys and the WASD keys. Mapping inputs to named actions instead of hardcoding keys means you can support gamepads and remapping later without rewriting anything.</p>
<p>Now attach a script to the player root. Here is the movement logic:</p>
<pre><code>extends CharacterBody2D

# Pixels per second
@export var speed: float = 220.0

func _physics_process(delta: float) -&gt; void:
    # Build a direction vector from the four input actions.
    # get_axis returns a value from -1 to 1 for each pair.
    var direction := Vector2.ZERO
    direction.x = Input.get_axis("move_left", "move_right")
    direction.y = Input.get_axis("move_up", "move_down")

    # Normalize so diagonal movement is not faster
    if direction.length() &gt; 1.0:
        direction = direction.normalized()

    velocity = direction * speed
    move_and_slide()
</code></pre>
<p>A few things worth calling out. We use _physics_process instead of _process because anything that moves a physics body should run on the fixed physics timestep. The @export annotation makes speed editable in the Inspector, so I can tune it without touching code. And normalizing the direction stops the classic bug where moving diagonally is about forty percent faster than moving straight.</p>

<h2>Making a collectible coin</h2>
<p>Create a second scene with an Area2D as the root. Area2D detects overlaps without physically blocking anything, which is exactly what a pickup needs. Give it a Sprite2D and a CollisionShape2D. Save it as coin.tscn and attach this script:</p>
<pre><code>extends Area2D

# Fired when the player grabs this coin
signal collected

func _ready() -&gt; void:
    body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -&gt; void:
    if body.is_in_group("player"):
        collected.emit()
        queue_free()
</code></pre>
<p>We declare our own signal called collected and emit it when a player walks in. The coin does not know what a score is, and it should not. It simply announces that it was picked up and removes itself. To make the group check work, select the player node, open the Node dock next to the Inspector, switch to Groups, and add it to a group named player.</p>

<h2>Tracking the score with a global</h2>
<p>The score needs to outlive any single scene, so register it as an autoload. Create a script called game_state.gd:</p>
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
<p>Register it in Project Settings under the Globals tab with the name GameState. Now any script in the game can call GameState.add_points and listen for the score_changed signal to update the display. This is the cleanest way to share state in Godot without tangling your scenes together.</p>

<h2>Wiring up the level and the UI</h2>
<p>Build a level scene. Drop in an instance of the player, scatter several coin instances around, and add a CanvasLayer with a Label inside it for the score. The CanvasLayer keeps the label pinned to the screen even as the camera follows the player. Attach a small script to the label:</p>
<pre><code>extends Label

func _ready() -&gt; void:
    GameState.score_changed.connect(_on_score_changed)
    _on_score_changed(GameState.score)

func _on_score_changed(new_score: int) -&gt; void:
    text = "Score: " + str(new_score)
</code></pre>
<p>For each coin to actually add to the score, connect its collected signal to a handler in the level script that calls GameState.add_points(10). You can do this in the editor by selecting a coin and using the Node dock, or in code by looping over the coins in _ready. I prefer code when there are many instances, because connecting fifty coins by hand in the editor is tedious and error prone.</p>

<h2>Adding an enemy and a game over</h2>
<p>An enemy can be as simple as another Area2D that moves back and forth. When it overlaps the player, the game ends. Here is a bare bones patroller:</p>
<pre><code>extends Area2D

@export var move_speed: float = 90.0
var _direction: int = 1

func _ready() -&gt; void:
    body_entered.connect(_on_body_entered)

func _physics_process(delta: float) -&gt; void:
    position.x += move_speed * _direction * delta
    # Flip direction at the patrol edges
    if position.x &gt; 600 or position.x &lt; 200:
        _direction *= -1

func _on_body_entered(body: Node2D) -&gt; void:
    if body.is_in_group("player"):
        get_tree().change_scene_to_file("res://scenes/game_over.tscn")
</code></pre>
<p>The change_scene_to_file call tears down the current scene and loads a new one. Build a simple game over scene with a Label and a button that resets the score and loads the level again. Remember to call GameState.reset on that button so the next run starts clean.</p>

<h2>Polish that punches above its weight</h2>
<p>A working game and a game that feels good are different things. The cheapest wins I know of:</p>
<ul>
<li>Add a short sound on coin pickup. Even a single beep makes collecting feel real.</li>
<li>Give the camera a small smoothing value so it eases toward the player instead of snapping.</li>
<li>Play a quick scale tween on the coin before it disappears so it pops rather than vanishes.</li>
<li>Add a subtle screen shake when the player dies. Twenty minutes of work, huge perceived quality.</li>
</ul>
<p>Tweens in Godot 4 are created with create_tween and are great for this kind of juice without writing per frame animation code.</p>

<h2>Where this scales to</h2>
<p>You now have the full loop: input, movement, collision, collectibles, global state, an enemy, and scene transitions. Almost every 2D game is a more elaborate version of these same pieces. A platformer adds gravity and jumping to the movement script. A shooter spawns bullet scenes on a timer. A puzzle game swaps the physics for a grid. The architecture you just built carries over directly.</p>
<p>Finish this game, then break it on purpose. Add a second enemy type, a high score that persists to disk, a title screen. Shipping small and iterating is how you actually learn the engine, far more than any tutorial including this one.</p>`
  }
];

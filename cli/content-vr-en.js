module.exports = [
  {
    title: 'Getting started with VR development',
    slug: 'getting-started-vr-development',
    excerpt: 'A working developer\'s walkthrough of the VR stack: choosing a headset, picking between Unity and Unreal, and writing your first OpenXR scene without getting lost in vendor SDKs.',
    category: 'VR & XR',
    tags: ['vr', 'openxr', 'unity', 'unreal'],
    pexels: 'virtual reality headset',
    content: `<p>The first time I shipped a VR build to a headset I had no idea how much of the work happens outside the headset. You spend maybe a fifth of your time in goggles and the rest fighting with input mappings, render scale, and SDK version mismatches. So this is the guide I wish someone had handed me: how the pieces fit together, what to install, and how to get a cube you can grab running on real hardware before the afternoon is over.</p>

<h2>What you actually need to start</h2>
<p>You need three things. A headset, an engine, and a runtime that translates between the two. That last part is the one beginners skip and then wonder why nothing works. The runtime is the layer that owns the display, the tracking, and the controllers, and your engine talks to it through an API.</p>
<p>For hardware, almost any modern standalone headset will do. A Meta Quest 2 or 3 is the cheapest entry point and doubles as both a PC-tethered device and a standalone Android target. If you have a gaming PC, a Valve Index or any Windows Mixed Reality headset works too. Buy used if you can. The hardware moves fast and you do not need the newest panel to learn.</p>

<h2>OpenXR is the thing to learn, not a vendor SDK</h2>
<p>For years every headset maker shipped its own SDK, and porting an app from one device to another meant rewriting your input and rendering code. OpenXR fixed that. It is an open standard from Khronos, the same group behind Vulkan, and it gives you one API that targets Quest, SteamVR, Windows Mixed Reality, and most things to come.</p>
<p>My strong advice: build against OpenXR from day one. Both Unity and Unreal support it as a first-class plugin. You will still occasionally reach for a vendor extension to get hand tracking or passthrough, but the core loop of poses, frames, and input stays portable. I have moved projects from Quest to PCVR with almost no code changes because of this, and the one time I built against a proprietary SDK I paid for it later.</p>

<h2>Unity or Unreal</h2>
<p>This is the question everyone asks and the honest answer is that both are fine. Here is how I decide.</p>
<ul>
<li>Pick Unity if you want faster iteration, a gentler scripting model in C#, and the widest pool of VR tutorials and assets. The XR Interaction Toolkit gives you grabbing, teleporting, and UI interaction out of the box. Most indie and enterprise VR ships on Unity.</li>
<li>Pick Unreal if you need top-tier visuals, you are comfortable with C++ or Blueprints, and your target is a powerful PC or a high-end standalone. Unreal's rendering is gorgeous but you will fight harder to hit frame rate on mobile-class hardware like the Quest.</li>
</ul>
<p>I reach for Unity for most prototypes because I can change a value, hit play, and be testing in the headset seconds later. For a cinematic, visually heavy PCVR piece I would consider Unreal. Neither choice is wrong, so do not spend a week agonizing over it.</p>

<h2>Setting up a Unity project for VR</h2>
<p>Here is the path that works reliably as of this writing. Create a new project using the 3D core template. Open the package manager and install the XR Plugin Management package, then the OpenXR Plugin, then the XR Interaction Toolkit. In Project Settings under XR Plugin Management, enable OpenXR for your target platform and add an interaction profile that matches your controllers, like the Oculus Touch profile or the Index controller profile.</p>
<p>For a Quest target, switch the build platform to Android and set the texture compression to ASTC. For PCVR you stay on the Windows platform. That is genuinely most of the setup. The interaction profiles are the part people forget, and without them your controllers report no input at all.</p>

<h2>Your first grabbable object</h2>
<p>The XR Interaction Toolkit does the heavy lifting, but it helps to see what a small custom interaction looks like in code. Here is a simple script that snaps an object back to its start position when you let go of it, which is handy for tools you do not want players losing in the void.</p>
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
        // Snap home after a short delay so the toss still feels physical
        Invoke(nameof(ResetTransform), 1.5f);
    }

    void ResetTransform()
    {
        var rb = GetComponent&lt;Rigidbody&gt;();
        if (rb != null) { rb.velocity = Vector3.zero; rb.angularVelocity = Vector3.zero; }
        transform.SetPositionAndRotation(startPos, startRot);
    }
}</code></pre>
<p>Drop this on a mesh with a collider and a Rigidbody, add an XR Origin rig to the scene, and you have something you can pick up and throw. Seeing your own hands move a real object in 3D space is the moment VR clicks for most people, so get to it as fast as you can.</p>

<h2>The render loop is not like flatscreen</h2>
<p>VR renders the scene twice, once per eye, every frame, and it has to hit a hard frame budget. On a Quest you are aiming for 72 or 90 frames per second, and missing it does not just look bad, it makes people queasy. That changes how you think about performance. Draw calls, overdraw, and shader complexity matter far more than on a monitor where a dropped frame is a minor annoyance.</p>
<p>Two techniques save you here. Fixed foveated rendering lowers resolution at the edges of the lens where your eye cannot see detail anyway. Single-pass instanced rendering submits geometry once for both eyes instead of twice. Turn both on early. I have rescued projects that were stuttering at 50 frames just by enabling these and cutting a few real-time lights.</p>

<h2>Testing on hardware early and often</h2>
<p>The editor preview lies to you. Scale feels different in a real headset, motion that looks smooth on a flat preview can be nauseating in goggles, and text that is readable on your monitor turns to mush through the lenses. Build to the device constantly. With a Quest you can use the Oculus developer hub or just sideload over USB, and on PCVR you can play directly into a tethered headset from the editor.</p>
<p>Comfort is its own discipline, and it is where most first VR projects fall apart. I wrote a whole separate piece on it because it deserves the room. If you are past the setup stage, read <a href="/blog/vr-ux-design-principles/">VR UX design principles</a> before you design a single movement system, because the choices you make about locomotion and interaction will decide whether people can stand to use what you built.</p>

<h2>A realistic first project</h2>
<p>Do not try to build a game yet. Build a room. Put a few grabbable objects on a table, add a button on the wall that turns a light on, and make a simple teleport system so you can move around. That tiny scene exercises rendering, input, interaction, and locomotion, which are the four pillars of every VR app. Once that room feels good in the headset you understand enough to start something real.</p>
<p>VR development rewards patience and punishes shortcuts, but the payoff is unlike anything in flatscreen work. The first time a tester reaches out to touch something that is not there and flinches, you will get why people keep building for this medium. Start small, test on real hardware, and respect the player's comfort from the beginning.</p>`
  },
  {
    title: 'VR UX design principles',
    slug: 'vr-ux-design-principles',
    excerpt: 'Locomotion, motion sickness, and interaction design in VR. Hard-won rules for building experiences people can actually use without taking the headset off five minutes in.',
    category: 'VR & XR',
    tags: ['vr', 'ux', 'comfort', 'locomotion'],
    pexels: 'person using vr',
    content: `<p>I have made people sick with my own software. Not on purpose, but the first locomotion system I built had a smooth acceleration curve that felt great to me and turned a third of my testers green within two minutes. That experience taught me more about VR design than any tutorial. The headset is strapped to someone's face and wired into their balance system, so a UX mistake here is not a missed click, it is a person ripping the device off and never coming back.</p>

<h2>Why VR motion sickness happens</h2>
<p>Simulator sickness comes from a mismatch between what your eyes report and what your inner ear feels. When you push the thumbstick to move forward, your eyes see motion but your body knows it is sitting still. Your brain interprets that conflict the same way it interprets poison, which is why nausea is the result. Everything in comfort design is about narrowing that gap or hiding it.</p>
<p>The sensitivity varies wildly between people. Some players can run and strafe smoothly for hours, others get uncomfortable from a slow turn. You cannot design for the iron-stomached minority. You design for the susceptible majority and let the tough crowd opt into more intense options.</p>

<h2>Locomotion: pick the right tool</h2>
<p>How you move players around is the single biggest comfort decision you will make. There is no perfect option, only tradeoffs.</p>
<ul>
<li>Teleportation is the safest. The player points, blinks to a new spot, and there is no continuous motion to fight the inner ear. It breaks immersion a little and it is awkward for combat, but almost nobody gets sick from it. Make it your default.</li>
<li>Smooth locomotion, the thumbstick walking that feels natural to gamers, is the most immersive and the most nauseating. If you offer it, make it optional and never the only choice.</li>
<li>Dash or short-hop movement splits the difference with a fast blink over a short distance.</li>
<li>Room-scale physical movement, where the player actually walks, is the most comfortable of all because there is no mismatch at all. Design your spaces to fit a real play area when you can.</li>
</ul>
<p>The trick most shipped games use is to offer all of these and let players choose in a comfort menu they see before anything else. Respect that not everyone has your tolerance.</p>

<h2>Turning is sneakier than moving</h2>
<p>Rotation causes more sickness than translation for a lot of people, and it is easy to overlook. Smooth turning with the thumbstick, where the world rotates continuously around a stationary player, is brutal on sensitive users. The standard fix is snap turning, where the view jumps by a fixed angle like 30 or 45 degrees with each flick of the stick. The instant cut gives the inner ear nothing continuous to disagree with.</p>
<p>Offer both and let players set the snap angle. I default every project to snap turning now and treat smooth turning as the advanced option, the reverse of what feels intuitive when you are building it.</p>

<h2>Reduce the visual conflict</h2>
<p>When you do have continuous motion, you can soften it. A vignette that narrows the field of view during movement is the most effective tool I know. By blacking out the periphery while the player moves, you remove the optical flow at the edges that the brain reads most strongly as motion. It sounds like it would feel restrictive but most people never consciously notice it, and it dramatically expands who can play comfortably.</p>
<p>Here is the idea in pseudo-code. The vignette intensity scales with how fast the player is moving.</p>
<pre><code>onUpdate(player):
    speed = magnitude(player.velocity)
    target = clamp(remap(speed, 0, maxSpeed, 0, maxVignette), 0, maxVignette)
    // ease toward the target so the edges fade in smoothly
    vignette.intensity = lerp(vignette.intensity, target, deltaTime * 8)
    apply(vignette)</code></pre>
<p>Other small things help. Keep a stable horizon, avoid moving the camera in ways the player did not initiate, never apply head-bob, and never take camera control away during gameplay. Any motion the player did not cause themselves is a prime sickness trigger.</p>

<h2>Interaction at human scale</h2>
<p>Once people can move comfortably, they need to do things, and VR interaction has its own rules. The biggest one is that scale and reach are physical. If a button is too high, a short player literally cannot press it. If your menus float two meters away, nobody can touch them. Design for a seated player and a standing player, and test with people of different heights.</p>
<ul>
<li>Make interactive objects obviously grabbable. Highlight them on hover, give them a slight glow or outline, and snap the hand pose to something that looks like a real grip.</li>
<li>Give feedback through more than one sense. A controller rumble plus a click sound plus a visual change makes a press feel real because the player gets no physical resistance from thin air.</li>
<li>Put UI on surfaces the player can reach, or attach it to the wrist like a watch, or curve it slightly so the edges are not farther away than the center.</li>
<li>Respect that there is no haptic floor. Without resistance, people push their hand straight through a virtual table. Design around that instead of fighting it.</li>
</ul>

<h2>Comfort is a setting, not a default you guess</h2>
<p>The thread running through all of this is choice. You do not know your player's tolerance, their height, their play space, or whether they are sitting or standing. So you ask, or you provide options and sensible defaults. A good VR comfort menu covers locomotion type, turn style and angle, vignette strength, and a height calibration. Surface it on first launch, not buried three menus deep.</p>
<p>If you are still setting up your toolchain and have not picked an engine yet, I cover that groundwork in <a href="/blog/getting-started-vr-development/">getting started with VR development</a>. The technical setup and the comfort design feed into each other, because the engine you choose shapes which comfort tools come for free.</p>

<h2>Test on people who are not you</h2>
<p>You will build up tolerance as you develop. After a week of testing your own locomotion you will feel nothing, which makes you the worst possible judge of whether it is comfortable. Bring in fresh testers regularly, especially people who have never used VR. Watch their bodies. People lean, they reach, they brace, and they go quiet right before they feel sick. Those signals tell you more than any survey.</p>
<p>Good VR UX is mostly restraint. Move people gently, give them control, make interaction obvious, and always provide an out. Do that and you build experiences people stay inside for an hour instead of fleeing in five minutes.</p>`
  }
];

# The "Not A Fart" Dust Animation Guide
*(For Trackpad Warriors & MS Paint Connoisseurs)*

If your dust cloud looks like it's propelling your character forward (i.e., a rocket fart), it’s usually because of **vector logic** and **shape**. Here is how to fix it for that premium, crunchy pixel feel.

## 1. The Physics of "The Kick"
When you walk, your foot hits the ground and drags slightly backwards.
- **The Force**: The dust shouldn't shoot *straight back* (propulsion). It should kick **up and slightly back**, then lose momentum immediately.
- **The Anchor**: The dust cloud essentially stays where it was born. The player moves away; the dust stays, expands, and dies.

## 2. Breaking the "Bubble" (The Fart Factor)
The #1 reason it looks like a fart is because it stays as one cohesive, round blob that just shrinks.
- **Don't**: Draw a circle that gets smaller (Bubble).
- **Do**: Draw a clump that **shatters**.

### The 6-Frame Arc (300ms is fast!)
Since you are using 6 frames, here is the breakdown:
1.  **Frame 1 (Impact)**: Small, messy squiggle right at the "heel" position. Pure white/tan.
2.  **Frame 2 (Explosion)**: The biggest frame. It rises up and expands outward.
3.  **Frame 3 (The Break)**: **CRITICAL STEP**. Cut the blob in half or into 3 pieces using the Eraser.
4.  **Frame 4 (Drift)**: The pieces move slightly apart and get smaller. Maybe move 1 pixel up.
5.  **Frame 5 (Dissipation)**: Checkerboard pattern (dithering) to fake transparency.
6.  **Frame 6 (Gone)**: Just a few single pixels (dust motes) floating.

## 3. MS Paint + Trackpad Techniques
Drawing with a finger on a trackpad is actually *better* for organic shapes because it's naturally jittery.

- **The Seizure Method**: To get that natural "cloud" edge, don't try to draw a circle. Just vibrate your finger on the trackpad while moving it in a loop. The jagged edges capture light better.
- **The "Cookie Cutter"**: Draw a big blob, then select the `Eraser` tool. violently slice chunks out of it to create negative space.
- **Dithering (The Stoner Gradient)**: You can't do opacity in Paint easily. To make it fade, delete every other pixel (checkerboard).

## 4. Directional cheat
Right now, your code rotates the sprite.
- **The Problem**: If you draw the dust "trailing" to the right (for a left-moving character), and then rotate it 180 degrees, it might look weird.
- **The Fix**: Draw the dust strictly **VERTICAL** or as a **PILE**. Let the code handle the rotation.
    - If it's a "pile" that expands upwards, rotating it 90 degrees might look like it's defying gravity.
    - **Pro Move**: Draw the dust so it looks like it's exploding *out* from a center point in a cone, rather than drifting. That way rotation works for any direction.

## 5. Summary Checklist
- [ ] Does it break into pieces? (Yes = Dust, No = Fart)
- [ ] Does it rise up? (Yes = Dust, No = Fart)
- [ ] Is it jagged/messy? (Yes = Dust, Round = Bubble)

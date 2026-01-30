import { TILE_SIZE, ASSETS } from '../constants.js';
import { TUTORIAL_STEPS } from '../data/tutorial_steps.js';
import { ACTIONS } from '../systems/Settings.js';

export class TutorialOverlay {
    constructor() {
        this.activeBubbles = new Map();
        this.completedSteps = new Set();
        this.lastFrameTime = Date.now();
        this.lastRoomId = null;
    }

    render(renderer, gameState) {
        if (!gameState.grid) return;
        if (gameState.gameState === 'BUILD_MODE') return;

        const now = Date.now();
        let dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        // Cap dt to prevent massive jumps
        if (dt > 0.1) dt = 0.1;

        // Check room change (for explicit clear)
        const roomChanged = this.lastRoomId && this.lastRoomId !== gameState.currentRoomId;
        this.lastRoomId = gameState.currentRoomId;
        if (roomChanged) {
            // Optional: Fully clear active bubbles on room change if desired, 
            // but the disappearance logic below handles it gracefully usually.
            // If instant despawn on room change is required:
            // this.activeBubbles.clear(); 
        }

        // 1. Identify valid targets for this frame
        const currentFrameData = new Map(); // Key -> Data

        // Iterate through all defined tutorial steps
        for (const step of TUTORIAL_STEPS) {
            if (this.completedSteps.has(step.id)) continue;
            // Check specific completion condition
            if (step.completionPredicate && step.completionPredicate(gameState)) {
                this.completedSteps.add(step.id);
                continue;
            }

            // Find Targets
            const targets = this.findTargetsByType(renderer, gameState, step.targetType);

            for (const target of targets) {
                // Check Condition
                let shouldShow = true;
                if (step.predicate) {
                    shouldShow = step.predicate(gameState, target.entity);
                }

                if (shouldShow) {
                    // KEY CHANGE: Use specific composite keys that persist even if X/Y changes
                    // If target is Player/Item, use "player" suffix
                    // If target is Tile, use coordinates (tiles don't move)
                    let keySuffix = `${target.x}-${target.y}`;

                    // Detect if target is player-related
                    if (target.type === 'player' || (gameState.player && gameState.player.heldItem && target.entity && (target.entity.object === gameState.player.heldItem))) {
                        keySuffix = 'player';
                    }

                    const key = `${step.id}-${keySuffix}`;

                    // Handle Dynamic Text
                    let rawText = step.text;
                    if (typeof rawText === 'function') {
                        rawText = rawText(gameState);
                    }

                    // Format text
                    const formattedText = this.formatText(rawText, gameState.settings);

                    currentFrameData.set(key, {
                        targetX: target.x,
                        targetY: target.y,
                        text: formattedText
                    });
                }
            }
        }

        const activeKeys = new Set(currentFrameData.keys());

        // 2. Update States & Physics
        // Handle New Bubbles
        for (const [key, data] of currentFrameData.entries()) {
            if (!this.activeBubbles.has(key)) {
                // Initialize physics state
                // Start slightly off or exactly at target? 
                // Let's start AT target for pop-in effect.
                const screenX = (data.targetX * TILE_SIZE) + renderer.offsetX - 32;
                const screenY = (data.targetY * TILE_SIZE) + renderer.offsetY - 128 + 10;

                this.activeBubbles.set(key, {
                    ...data,
                    x: screenX, // Physics Body X
                    y: screenY, // Physics Body Y
                    vx: 0,
                    vy: 0,
                    scale: 0,
                    state: 'appearing'
                });
            } else {
                // Update Target positions for existing bubbles (e.g. player moved)
                const bubble = this.activeBubbles.get(key);
                bubble.targetX = data.targetX;
                bubble.targetY = data.targetY;
                bubble.text = data.text; // Text might update (keys)
                if (bubble.state === 'disappearing') {
                    bubble.state = 'appearing';
                }
            }
        }

        // Handle Removed Bubbles
        for (const [key, bubble] of this.activeBubbles.entries()) {
            if (!activeKeys.has(key) && bubble.state !== 'disappearing') {
                if (roomChanged) {
                    this.activeBubbles.delete(key);
                } else {
                    bubble.state = 'disappearing';
                }
            }
        }

        // 3. Physics & Animation
        const ANIMATION_SPEED = 5.0; // Pop in speed

        // Physics Constants
        const SPRING_STRENGTH = 25.0; // Pull force
        const DAMPING = 0.75; // Friction (0-1)
        const FLOAT_HEIGHT = 105; // Distance above target
        const MAX_LEASH = 20; // Max distance body can be from "Ideal" X before drag
        // Note: Leash is relative to IDEAL position or TARGET position?
        // Let's leash it to the TARGET anchor point to ensure it never drifts too far away

        for (const [key, bubble] of this.activeBubbles.entries()) {
            // Screen Space Target Calculation
            // We calculate where the Anchor is NOW
            const anchorScreenX = (bubble.targetX * TILE_SIZE) + renderer.offsetX; // Center of Tile horizontally? 
            // Wait, standard tile draw is Top-Left. 
            // Center of tile X = +32.
            // But our bubble graphic is 128 wide. Center is +64.
            // So to center bubble on tile: tileX + 32 - 64 = tileX - 32.
            const targetScreenX = (bubble.targetX * TILE_SIZE) + renderer.offsetX - 32;
            const targetScreenY = (bubble.targetY * TILE_SIZE) + renderer.offsetY;

            // Ideal Body Position (where the spring pulls to)
            const idealX = targetScreenX;
            const idealY = targetScreenY - FLOAT_HEIGHT; // Float above

            // 3a. Apply Spring Force
            const diffX = idealX - bubble.x;
            const diffY = idealY - bubble.y;

            bubble.vx += diffX * SPRING_STRENGTH * dt;
            bubble.vy += diffY * SPRING_STRENGTH * dt;

            // --- COLLISION LOGIC ---
            const BUBBLE_RADIUS = 45; // Allow some overlap (texture width ~100px)
            const PUSH_STRENGTH = 150.0;

            for (const [otherKey, otherBubble] of this.activeBubbles.entries()) {
                if (key === otherKey) continue;

                const dx = (bubble.x) - (otherBubble.x); // Center-to-center effectively same as TL-to-TL for equal sized boxes
                const dy = (bubble.y) - (otherBubble.y);
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Target distance: 2 * Radius gives touching. 
                // We want them to "rest right against each other", maybe slightly less than full width?
                const minDist = BUBBLE_RADIUS * 2;

                if (dist < minDist && dist > 0.001) {
                    const overlap = minDist - dist;
                    // Normalized vector away from other bubble
                    const nx = dx / dist;
                    const ny = dy / dist;

                    // Apply push force
                    bubble.vx += nx * PUSH_STRENGTH * overlap * dt;
                    bubble.vy += ny * PUSH_STRENGTH * overlap * dt;
                }
            }

            // 3b. Apply Damping
            bubble.vx *= DAMPING;
            bubble.vy *= DAMPING;

            // 3c. Update Position
            bubble.x += bubble.vx * dt * 10; // multiplier to adjust for dt scale if needed, or just tune spring
            bubble.y += bubble.vy * dt * 10;

            // 3d. Leash Constraint (The "Teleport" fix)
            // Distance from Anchor (Target) specifically for the "String" limit
            // We want the bubble BODY to be within Radius R of the ideal Point? 
            // Or within Radius R of the actual Anchor point? 
            // User said: "point glued to their target but to travel along the bubble's bottom edge"
            // And "teleport with the player"

            // Simple constraint: If distance from IDEAL > MAX, snap.
            // This handles the teleport. If player moves 1000px, Ideal moves 1000px. dist is huge. Snap.
            const distFromIdeal = Math.sqrt(Math.pow(bubble.x - idealX, 2) + Math.pow(bubble.y - idealY, 2));
            if (distFromIdeal > MAX_LEASH) {
                // Drag it in
                const angle = Math.atan2(bubble.y - idealY, bubble.x - idealX);
                bubble.x = idealX + Math.cos(angle) * MAX_LEASH;
                bubble.y = idealY + Math.sin(angle) * MAX_LEASH;
                // Kill velocity to stop it slinging back too hard
                bubble.vx *= 0.1;
                bubble.vy *= 0.1;
            }

            // Update Scale (Pop in/out)
            if (bubble.state === 'appearing') {
                bubble.scale += dt * ANIMATION_SPEED;
                if (bubble.scale >= 1.0) {
                    bubble.scale = 1.0;
                    bubble.state = 'visible';
                }
            } else if (bubble.state === 'disappearing') {
                bubble.scale -= dt * ANIMATION_SPEED;
                if (bubble.scale <= 0.0) {
                    this.activeBubbles.delete(key);
                    continue;
                }
            }

            // 4. Render
            this.drawCompleteBubble(renderer, bubble, targetScreenX, targetScreenY);
        }
    }

    drawCompleteBubble(renderer, bubble, anchorX, anchorY) {
        const { x, y, scale, text } = bubble;
        const BASE_SCALE = 0.8;
        const finalScale = scale * BASE_SCALE;

        // 1. Draw Body (Physics Object) - DRAW FIRST so Tail is on top
        renderer.ctx.save();
        renderer.ctx.globalAlpha = 0.9;

        // Calculate Center of Body bounding box for scaling pivot
        // x,y is the Top-Left of the 128x128 box (based on physics setup)
        const bodyCenterX = x + 64;
        const bodyCenterY = y + 64;

        renderer.ctx.translate(bodyCenterX, bodyCenterY);
        renderer.ctx.scale(finalScale, finalScale);
        // Draw centered at (0,0) -> i.e. draw at (-64, -64)
        renderer.drawAnimatedSprite('tutorial_bubble_top', 0, 0, 0, -64, -64);

        // 2. Draw Text (Inside Body)
        // We draw text relative to the body's coordinate system we just set up
        renderer.ctx.fillStyle = '#FFFFFF';
        renderer.ctx.strokeStyle = '#000000';
        renderer.ctx.lineWidth = 8;
        renderer.ctx.font = '900 16px "Inter", sans-serif';
        // Ensure explicit alignment
        renderer.ctx.textAlign = 'left';
        renderer.ctx.textBaseline = 'middle';
        renderer.ctx.lineJoin = 'round';
        renderer.ctx.miterLimit = 2;

        const paragraphs = text.split('\n');
        const lines = [];
        const maxChars = 10;

        for (const paragraph of paragraphs) {
            lines.push(...this.parseAndWrapLine(paragraph, maxChars));
        }

        const lineHeight = 30;
        const startY = -((lines.length - 1) * lineHeight) / 2 - 5;

        lines.forEach((lineTokens, lineIndex) => {
            const lineY = startY + (lineIndex * lineHeight);

            // Measure Width to center the line manually
            let totalWidth = 0;
            const tokenDims = lineTokens.map(token => {
                if (token.type === 'text') return renderer.ctx.measureText(token.value).width;
                if (token.type === 'image') return 30; // Icon size
                return 0;
            });
            totalWidth = tokenDims.reduce((a, b) => a + b, 0);

            // Start drawing at negative half width to center on (0,0)
            let currentX = -totalWidth / 2;

            lineTokens.forEach((token, tIndex) => {
                const w = tokenDims[tIndex];
                if (token.type === 'text') {
                    // Draw Text
                    renderer.ctx.strokeText(token.value, currentX, lineY);
                    renderer.ctx.fillText(token.value, currentX, lineY);
                } else if (token.type === 'image') {
                    // Draw Icon
                    const img = renderer.assetLoader.get(token.value);
                    if (img) {
                        renderer.ctx.drawImage(img, currentX, lineY - 15, 30, 30);
                    }
                }
                currentX += w;
            });
        });

        renderer.ctx.restore();

        // 3. Draw Tail (Anchor) - DRAW SECOND (On Top)
        renderer.ctx.save();
        renderer.ctx.globalAlpha = 1.0;

        // Tail Position:
        // anchorX is (TileX * 64) + OffsetX - 32. 
        // This makes the 128px wide bubble centered on the tile.
        // Center of the "Anchor Box" is anchorX + 64.
        const tailCenterX = anchorX + 64;

        // anchorY is (TileY * 64) + OffsetY. This is the TOP of the tile.
        // We want the tip of the tail to touch the tile top (or slightly overlapping).
        // Let's assume we want the tip at (tailCenterX, anchorY + 10).
        const tailTipY = anchorY + 10;

        renderer.ctx.translate(tailCenterX, tailTipY);
        renderer.ctx.scale(finalScale, finalScale);

        // Skew Tail to connect to Body if it has drifted
        // Body Center X = x + 64 (already calculated as bodyCenterX above)
        // Anchor Center X = tailCenterX
        const offsetScreenX = bodyCenterX - tailCenterX;

        // Convert to local scaled space
        const localOffsetX = offsetScreenX / finalScale;

        // Skew formula: x' = x + y * skewX
        // Top of tail is y = -128. We want x' = localOffsetX at y = -128.
        // localOffsetX = -128 * skewX => skewX = localOffsetX / -128
        const skewX = localOffsetX / -128;

        renderer.ctx.transform(1, 0, skewX, 1, 0, 0);

        // Sprite Drawing:
        // The tail sprite is 128x128. Assuming the "Tip" is at the bottom-center (64, 128).
        // To place the tip at (0,0) (our pivot), we need to draw the image at (-64, -128).
        renderer.drawAnimatedSprite('tutorial_bubble_bottom', 0, 0, 0, -64, -128);

        renderer.ctx.restore();
    }

    formatText(text, settings) {
        if (!text || !settings) return text;

        // Custom composite keys
        if (text.includes('[movement_keys]')) {
            const up = this.prettifyKey(settings.getBinding(ACTIONS.MOVE_UP));
            const left = this.prettifyKey(settings.getBinding(ACTIONS.MOVE_LEFT));
            const down = this.prettifyKey(settings.getBinding(ACTIONS.MOVE_DOWN));
            const right = this.prettifyKey(settings.getBinding(ACTIONS.MOVE_RIGHT));
            const keys = `${up}/${left}/${down}/${right}`;
            text = text.replace('[movement_keys]', keys);
        }

        // Replace placeholders like [INTERACT] with actual keys
        return text.replace(/\[(.*?)\]/g, (match, actionKey) => {
            // Check if input is a valid ACTION name (e.g. "INTERACT")
            const actionId = ACTIONS[actionKey];
            if (actionId) {
                const rawKey = settings.getBinding(actionId);
                return this.prettifyKey(rawKey);
            }
            // Fallback: maybe they passed the raw ID?
            const rawKeyDirect = settings.getBinding(actionKey);
            if (rawKeyDirect) {
                return this.prettifyKey(rawKeyDirect);
            }
            return match; // Return original if not found
        });
    }

    prettifyKey(keyCode) {
        if (!keyCode) return '???';
        if (keyCode.startsWith('Key')) return keyCode.replace('Key', '');
        if (keyCode === 'Space') return 'SPACE';
        if (keyCode.startsWith('Digit')) return keyCode.replace('Digit', '');
        return keyCode.toUpperCase();
    }

    findTargetsByType(renderer, gameState, typeId) {
        const results = [];
        // 1. Grid Search
        if (gameState.grid) {
            for (let y = 0; y < gameState.grid.height; y++) {
                for (let x = 0; x < gameState.grid.width; x++) {
                    const cell = gameState.grid.getCell(x, y);

                    // Check if the cell type matches OR if the object on the cell matches
                    let match = false;
                    if (cell.type.id === typeId) {
                        match = true;
                    } else if (cell.object && cell.object.definitionId === typeId) {
                        match = true;
                    }

                    if (match) {
                        // Pass specific properties if needed, or just the whole cell/entity
                        // We treat the cell as the entity for static tiles, or cell.object for dynamic ones?
                        // Let's pass the cell object wrapper for maximum context.
                        results.push({ x, y, entity: cell, type: 'tile' });
                    }
                }
            }
        }

        // 2. Player Held Item Search
        // Allow targeting items held by the player so the bubble "follows" them
        if (gameState.player && gameState.player.heldItem) {
            if (gameState.player.heldItem.definitionId === typeId) {
                results.push({
                    x: gameState.player.x,
                    y: gameState.player.y,
                    // Mock a cell-like entity wrapper so predicates using entity.object still work
                    entity: { object: gameState.player.heldItem },
                    type: 'player'
                });
            }
        }

        return results;
    }



    parseAndWrapLine(text, maxChars) {
        // Split by spaces to find words
        const rawWords = text.split(' ');
        const tokens = [];

        // 1. Tokenize words
        for (let i = 0; i < rawWords.length; i++) {
            const word = rawWords[i];
            // Check for [image.png]
            // We use a regex that catches [anything.png]
            // We also handle punctuation attached to it, e.g. [bun.png]!
            const parts = word.split(/(\[[^\]]*?\.png\])/g);

            for (const part of parts) {
                if (!part) continue;
                if (part.startsWith('[') && part.endsWith('.png]')) {
                    const filename = part.slice(1, -1);
                    tokens.push({ type: 'image', value: filename, charWidth: 2 });
                } else {
                    tokens.push({ type: 'text', value: part, charWidth: part.length });
                }
            }
            // Add space after word if not last
            if (i < rawWords.length - 1) {
                tokens.push({ type: 'text', value: ' ', charWidth: 1 });
            }
        }

        // 2. Wrap
        const lines = [];
        let currentLine = [];
        let currentLineLen = 0;

        for (const token of tokens) {
            // Simple char-based wrapping
            if (currentLineLen + token.charWidth <= maxChars) {
                currentLine.push(token);
                currentLineLen += token.charWidth;
            } else {
                // If line has content, push it.
                // Exception: if a single token is huge, we must put it on a line (or split it, but we won't split words/images)
                if (currentLine.length > 0) {
                    // Remove trailing space from currentLine if present? 
                    // It's fine, html canvas ignores it usually or it's invisible.
                    lines.push(currentLine);
                    currentLine = [];
                    currentLineLen = 0;
                }

                // If token itself is a space and we are at start of new line, skip it
                if (token.value === ' ' && currentLine.length === 0) {
                    continue;
                }

                currentLine.push(token);
                currentLineLen += token.charWidth;
            }
        }
        if (currentLine.length > 0) lines.push(currentLine);

        return lines;
    }
}

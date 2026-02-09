import { ASSETS, TILE_SIZE } from '../constants.js';
import { getBoilingSpriteFrame } from './effects/BoilingSprite.js';

export function drawStabilityMeter(renderer, gameState) {
    if (!gameState.isDayActive) return;

    const img = renderer.assetLoader.get(ASSETS.UI.STABILITY_METER);
    if (!img) return;

    // Logic
    const stabilityPct = Math.max(0, gameState.stability / gameState.maxStability);

    // Intensity: 0 (Static) when full, 1 (Fast Boil) when empty.
    let intensity = 1.0 - stabilityPct;
    if (stabilityPct >= 0.99) intensity = 0; // Force static if full

    // Calculate generic boiling frame
    // Fix: Use 'vertical' orientation because the sheet is stacked (1x3).
    const frameData = getBoilingSpriteFrame(img, intensity, {
        orientation: 'vertical',
        frameCount: 3,
        maxFps: 15
    });

    const frameWidth = frameData.width;
    const frameHeight = frameData.height;

    // Position: Centered relative to grid
    const gridPixelWidth = gameState.grid.width * TILE_SIZE * renderer.zoomLevel;
    const x = renderer.offsetX + (gridPixelWidth / 2) - (frameWidth / 2); // Center on grid
    const y = renderer.offsetY - frameHeight - 10; // 10px padding above grid

    // Draw
    renderer.ctx.save();
    renderer.ctx.imageSmoothingEnabled = false;

    // 1. Draw Fill Bar Logic (Behind the sprite frame)
    // Assuming generic padding for a meter frame.
    const paddingX = 4; // Adjust based on visual
    const paddingY = 4;
    const barMaxWidth = Math.max(0, frameWidth - (paddingX * 2));
    const barMaxHeight = Math.max(0, frameHeight - (paddingY * 2));

    // Background (Black)
    renderer.ctx.fillStyle = '#000000';
    renderer.ctx.fillRect(x + paddingX, y + paddingY, barMaxWidth, barMaxHeight);

    // Foreground (Color based on pct)
    renderer.ctx.fillStyle = stabilityPct > 0.5 ? '#00ff00' : (stabilityPct > 0.25 ? '#ffff00' : '#ff0000');
    // Draw fill based on percentage
    renderer.ctx.fillRect(x + paddingX, y + paddingY, barMaxWidth * stabilityPct, barMaxHeight);

    // 2. Draw Boiling Sprite Frame (Foreground)
    renderer.ctx.drawImage(
        img,
        frameData.sx, frameData.sy, frameData.width, frameData.height,
        x, y, frameWidth, frameHeight
    );

    renderer.ctx.restore();
}

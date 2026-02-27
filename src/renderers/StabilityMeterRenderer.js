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

    // Dimensions
    const frameWidth = frameData.width * renderer.zoomLevel;
    const frameHeight = frameData.height * renderer.zoomLevel;

    // Meter is rotated -90 degrees, so:
    // Screen width = asset height
    // Screen height = asset width
    const meterScreenWidth = frameHeight;
    const meterScreenHeight = frameWidth;

    // Position: Beside game tiles, on the right
    const gridPixelWidth = gameState.grid.width * TILE_SIZE * renderer.zoomLevel;
    const gridPixelHeight = gameState.grid.height * TILE_SIZE * renderer.zoomLevel;

    // Padding from grid edge
    const paddingFromGrid = 48 * renderer.zoomLevel;
    const x = renderer.offsetX + gridPixelWidth + paddingFromGrid;
    const y = renderer.offsetY + (gridPixelHeight / 2) - (meterScreenHeight / 2); // Center vertically on grid

    // Draw
    renderer.ctx.save();
    renderer.ctx.imageSmoothingEnabled = false;

    // 1. Position and Rotate
    // We want the bar to be vertical. Original asset is horizontal.
    // Translate to center of where we want the meter to be.
    renderer.ctx.translate(x + meterScreenWidth / 2, y + meterScreenHeight / 2);
    renderer.ctx.rotate(-Math.PI / 2); // Rotate -90 degrees to make it vertical

    // Drawing coordinates (centered in native space)
    const drawX = -frameWidth / 2;
    const drawY = -frameHeight / 2;

    const paddingX = 4 * renderer.zoomLevel;
    const paddingY = 4 * renderer.zoomLevel;
    const barMaxWidth = Math.max(0, frameWidth - (paddingX * 2));
    const barMaxHeight = Math.max(0, frameHeight - (paddingY * 2));

    // Background (Black)
    renderer.ctx.fillStyle = '#1a1a1a';
    renderer.ctx.fillRect(drawX + paddingX, drawY + paddingY, barMaxWidth, barMaxHeight);

    // Foreground (Color based on pct)
    // Green (Safe) -> Yellow (Warning) -> Red (Danger)
    renderer.ctx.fillStyle = stabilityPct > 0.5 ? '#2ecc71' : (stabilityPct > 0.25 ? '#f1c40f' : '#e74c3c');

    // Draw fill based on percentage (Horizontal in native space = Vertical in screen space)
    // Fills from "left" in native space which is "bottom" in rotated space.
    renderer.ctx.fillRect(drawX + paddingX, drawY + paddingY, barMaxWidth * stabilityPct, barMaxHeight);

    // 2. Draw Boiling Sprite Frame (Foreground / Border)
    renderer.ctx.drawImage(
        img,
        frameData.sx, frameData.sy, frameData.width, frameData.height,
        drawX, drawY, frameWidth, frameHeight
    );

    renderer.ctx.restore();
}


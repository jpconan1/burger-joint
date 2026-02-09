
/**
 * BoilingSprite.js
 * 
 * A utility to handle "boiling" line animations for sprites.
 * This effect simulates hand-drawn jitter by cycling through frames based on an "intensity" value.
 * 
 * Usage:
 * 1. Import `getBoilingSpriteFrame` or `drawBoilingSprite`.
 * 2. Pass the sprite sheet image and an intensity (0.0 to 1.0).
 * 3. Use the returned frame data to draw, or let the helper draw for you.
 * 
 * Future Agents:
 * - If you need a sprite to "boil" (animate nervously), use this.
 * - Supports Vertical (stacked) and Horizontal (strip) sprite sheets.
 * - "Intensity" controls the frame rate (0 = static, 1 = maxFps).
 */

/**
 * Calculates the current frame and source rectangle for a boiling sprite.
 * 
 * @param {HTMLImageElement} image - The sprite sheet source.
 * @param {number} intensity - 0.0 (static) to 1.0 (max boiling speed).
 * @param {object} options - Configuration options.
 * @param {string} [options.orientation='vertical'] - 'vertical' (stacked frames) or 'horizontal' (strip).
 * @param {number} [options.frameCount=3] - Number of frames in the sheet.
 * @param {number} [options.maxFps=30] - The animation speed at intensity=1.0.
 * @returns {object} { sx, sy, width, height, frameIndex } - Source rectangle and frame info for drawImage.
 */
export function getBoilingSpriteFrame(image, intensity, options = {}) {
    const {
        orientation = 'vertical',
        frameCount = 3,
        maxFps = 30
    } = options;

    // Validate image
    if (!image || !image.width || !image.height) {
        return { sx: 0, sy: 0, width: 0, height: 0, frameIndex: 0 };
    }

    // Determine Logic
    let frameIndex = 0;

    // If intensity is very low (e.g. < 1%), keep static frame 0.
    if (intensity > 0.01) {
        // Quantize intensity to prevent jittery frame jumping when intensity drifts slightly.
        // Locking to 5% steps keeps the speed constant for intervals.
        const quantizedIntensity = Math.ceil(intensity * 20) / 20;

        // Calculate FPS based on quantized intensity
        // We ensure a minimum FPS of 2 if active, or it looks like a glitch.
        const fps = Math.max(2, quantizedIntensity * maxFps);
        const frameDuration = 1000 / fps;

        // simple time-based frame selection
        frameIndex = Math.floor(Date.now() / frameDuration) % frameCount;
    }

    // Determine Dimensions
    let width, height;
    let sx, sy;

    if (orientation === 'vertical') {
        width = image.width;
        height = image.height / frameCount;
        sx = 0;
        sy = frameIndex * height;
    } else {
        width = image.width / frameCount;
        height = image.height;
        sx = frameIndex * width;
        sy = 0;
    }

    return { sx, sy, width, height, frameIndex };
}

/**
 * Draw a boiling sprite directly to the context. 
 * Useful if you don't need to draw generic things behind/in-between.
 */
export function drawBoilingSprite(ctx, image, x, y, intensity, options = {}) {
    const frame = getBoilingSpriteFrame(image, intensity, options);
    if (frame.width > 0 && frame.height > 0) {
        ctx.drawImage(
            image,
            frame.sx, frame.sy, frame.width, frame.height,
            x, y, frame.width, frame.height
        );
    }
    return frame;
}

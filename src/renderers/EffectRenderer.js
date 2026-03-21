import { ASSETS, TILE_SIZE } from '../constants.js';

export function drawEffects(renderer, gameState) {
    if (!gameState.effects) return;

    gameState.effects.forEach(effect => {
        if (effect.type === 'dust') {
            const img = renderer.assetLoader.get(ASSETS.EFFECTS.DUST_SHEET);
            if (!img) return;

            const elapsed = Date.now() - effect.startTime;
            const totalFrames = 5;
            const frameDuration = effect.duration / totalFrames;
            const currentFrame = Math.floor(elapsed / frameDuration);

            if (currentFrame >= totalFrames) return;

            const frameWidth = img.width / totalFrames;
            const frameHeight = img.height;
            const sx = currentFrame * frameWidth;
            const sy = 0;

            const x = effect.x * TILE_SIZE;
            const y = effect.y * TILE_SIZE;

            renderer.ctx.save();
            renderer.ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
            if (effect.rotation) renderer.ctx.rotate(effect.rotation);
            renderer.ctx.drawImage(img, sx, sy, frameWidth, frameHeight, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
            renderer.ctx.restore();

        } else if (effect.type === 'fire') {
            const img = renderer.assetLoader.get(ASSETS.EFFECTS.FIRE_SHEET);
            if (!img) return;

            const elapsed = Date.now() - effect.startTime;
            const totalFrames = 7;
            const frameDuration = effect.duration / totalFrames;
            const currentFrame = Math.floor(elapsed / frameDuration);

            if (currentFrame >= totalFrames) return;

            const frameWidth = img.width / totalFrames;
            const frameHeight = img.height;
            const sx = currentFrame * frameWidth;
            const sy = 0;

            const x = effect.x * TILE_SIZE;
            const y = effect.y * TILE_SIZE;

            renderer.ctx.save();
            const yOffset = -32;
            renderer.ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2 + yOffset);
            if (effect.rotation) renderer.ctx.rotate(effect.rotation);
            const scale = effect.scale || 1.0;
            const drawWidth = TILE_SIZE * scale;
            const drawHeight = TILE_SIZE * scale;
            renderer.ctx.drawImage(img, sx, sy, frameWidth, frameHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            renderer.ctx.restore();
        }
    });
}

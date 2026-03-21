export class SpriteRenderer {
    constructor(stage) {
        this.stage = stage;
        this.assets = {};
        this.isLoaded = false;
    }

    async loadAssets(assetMap) {
        const promises = Object.entries(assetMap).map(([key, src]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.assets[key] = img;
                    resolve();
                };
                img.src = src;
            });
        });

        await Promise.all(promises);
        this.isLoaded = true;
    }

    /**
     * Draw a sprite from a sheets or a single image.
     * @param {string} key - Asset key
     * @param {number} x - World X
     * @param {number} y - World Y
     * @param {Object} options - { frameX, frameY, frameWidth, frameHeight, scale, rotation, alpha, flipX }
     */
    draw(key, x, y, options = {}) {
        if (!this.isLoaded) return;
        const img = this.assets[key];
        if (!img) return;

        const stageCtx = this.stage.ctx;
        const fw = options.frameWidth || img.width;
        const fh = options.frameHeight || img.height;
        const fx = (options.frameX || 0) * fw;
        const fy = (options.frameY || 0) * fh;
        
        const scale = options.scale || 1;
        const dw = fw * scale;
        const dh = fh * scale;
        
        stageCtx.save();
        stageCtx.globalAlpha = options.alpha !== undefined ? options.alpha : 1;
        
        // Translate to center of sprite for rotation/flipping
        stageCtx.translate(x + dw / 2, y + dh / 2);
        
        if (options.rotation) {
            stageCtx.rotate(options.rotation);
        }
        
        if (options.flipX) {
            stageCtx.scale(-1, 1);
        }

        stageCtx.drawImage(
            img,
            fx, fy, fw, fh, // source
            -dw / 2, -dh / 2, dw, dh // destination
        );
        
        stageCtx.restore();
    }
}

export const spriteRenderer = null; // Will be initialized by Game

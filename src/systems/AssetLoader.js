import { TILE_SIZE } from '../constants.js';
import { assetUrl } from '../utils/assets.js';

const ASSET_ALIASES = {
    'counter-tile.png': 'floor-tile.png',
    'service_counter.png': 'service_counter/service_counter_centre.png',
    'shutter_tile-closed.png': 'shutter_tile-open.png',
    'drink_cup.png': 'side_cup.png',
    'empty-box.png': 'box-open.png',
    'whole_wheat_bun_bottom.png': 'whole_wheat_bun.png',
    'whole_wheat_bun_top.png': 'whole_wheat_bun.png',
    'bag-old.png': 'bag-empty.png',
    'bun-old.png': 'bun.png',
    'burger-old.png': 'burger.png',
    'fries-old.png': 'fries.png',
    'patty-old.png': 'patty-raw.png',
    'soda-old.png': 'soda.png',
    'tomato-old.png': 'tomato.png',
    'tomato-wilt1.png': 'tomato.png',
    'tomato-wilt2.png': 'tomato.png',
    'lettuce-head-old.png': 'lettuce-head.png',
    'lettuce-head-wilt1.png': 'lettuce-head.png',
    'lettuce-head-wilt2.png': 'lettuce-head.png',
    'soda_fountain-empty.png': 'counter-tile.png',
    'soda_fountain-full.png': 'counter-tile.png',
    'soda_fountain-warning.png': 'counter-tile.png',
    'soda_fountain-filling.png': 'counter-tile.png',
};

export class AssetLoader {
    constructor() {
        this.assets = new Map();
        this.failedAssets = new Set();
        this.pendingAssets = new Set();
    }

    async loadAll(assetMap) {
        const promises = [];

        const traverse = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'string') {
                    const filename = obj[key];
                    if (filename.match(/\.(png|jpg|jpeg)$/i)) {
                        promises.push(this.loadImage(filename));
                    } else if (filename.match(/\.(wav|mp3|ogg)$/i)) {
                        promises.push(this.loadAudio(filename));
                    }
                } else if (typeof obj[key] === 'object') {
                    traverse(obj[key]);
                }
            }
        };

        traverse(assetMap);

        await Promise.all(promises);
        return this.assets;
    }

    resolveFilename(filename) {
        let resolved = filename;
        const seen = new Set();

        while (ASSET_ALIASES[resolved] && !seen.has(resolved)) {
            seen.add(resolved);
            resolved = ASSET_ALIASES[resolved];
        }

        return resolved;
    }

    createPlaceholderImage(label = 'missing') {
        const canvas = document.createElement('canvas');
        canvas.width = TILE_SIZE;
        canvas.height = TILE_SIZE;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#2b2020';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#8b2f2f';
        ctx.fillRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
        ctx.strokeStyle = '#f4e6d0';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(10, 10);
        ctx.lineTo(TILE_SIZE - 10, TILE_SIZE - 10);
        ctx.moveTo(TILE_SIZE - 10, 10);
        ctx.lineTo(10, TILE_SIZE - 10);
        ctx.stroke();

        ctx.fillStyle = '#f4e6d0';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label.slice(0, 8), TILE_SIZE / 2, TILE_SIZE - 8);

        return canvas;
    }

    loadImage(filename) {
        return new Promise((resolve, reject) => {
            const resolvedFilename = this.resolveFilename(filename);
            const img = new Image();
            img.src = assetUrl(`assets/${resolvedFilename}`);
            img.onload = () => {
                if ((img.width > TILE_SIZE || img.height > TILE_SIZE) && !resolvedFilename.includes('/')) {
                    const canvas = document.createElement('canvas');
                    canvas.width = TILE_SIZE;
                    canvas.height = TILE_SIZE;
                    const ctx = canvas.getContext('2d');

                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    ctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE);

                    this.assets.set(filename, canvas);
                    resolve(canvas);
                } else {
                    this.assets.set(filename, img);
                    resolve(img);
                }
            };
            img.onerror = () => {
                console.warn(`Missing image asset: ${filename}`);
                const placeholder = this.createPlaceholderImage(filename.split('/').pop() || 'missing');
                this.assets.set(filename, placeholder);
                this.failedAssets.add(filename);
                resolve(placeholder);
            };
        });
    }

    loadAudio(filename) {
        return fetch(assetUrl(`assets/${filename}`))
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.arrayBuffer();
            })
            .then(buffer => {
                this.assets.set(filename, buffer);
                return buffer;
            })
            .catch(e => {
                console.error(`Failed to load audio: ${filename}`, e);
                throw e;
            });
    }

    get(filename) {
        const asset = this.assets.get(filename);
        if (asset) return asset;

        // Lazy Load Fallback
        // If we haven't tried to load this yet (and it's not explicitly failed/missing)
        if (!this.failedAssets.has(filename) && !this.pendingAssets.has(filename)) {
            console.log(`Lazy loading asset: ${filename}...`);
            this.pendingAssets.add(filename);

            // Determine type based on extension
            if (filename.match(/\.(png|jpg|jpeg)$/i)) {
                this.loadImage(filename).then(() => {
                    this.pendingAssets.delete(filename);
                    console.log(`Lazy loaded: ${filename}`);
                }).catch(() => {
                    this.pendingAssets.delete(filename);
                    this.failedAssets.add(filename);
                });
            } else if (filename.match(/\.(wav|mp3|ogg)$/i)) {
                this.loadAudio(filename).then(() => {
                    this.pendingAssets.delete(filename);
                    console.log(`Lazy loaded audio: ${filename}`);
                }).catch(() => {
                    this.pendingAssets.delete(filename);
                    this.failedAssets.add(filename);
                });
            } else {
                this.failedAssets.add(filename);
            }
        }

        return null; // Return null while loading (will pop-in next frame)
    }
}

export class AssetLoader {
    constructor() {
        this.assets = new Map();
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

    loadImage(filename) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = `/assets/${filename}`;
            img.onload = () => {
                this.assets.set(filename, img);
                resolve(img);
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${filename}`);
                // Resolve anyway to prevent blocking other assets, but with null?
                // Or reject. Let's reject to surface errors.
                reject(new Error(`Failed to load asset: ${filename}`));
            };
        });
    }

    loadAudio(filename) {
        return fetch(`/assets/${filename}`)
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
        if (!this.failedAssets) this.failedAssets = new Set();
        if (!this.pendingAssets) this.pendingAssets = new Set();

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

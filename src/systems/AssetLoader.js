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
        if (!asset) {
            console.warn(`Asset not found: ${filename}`);
            return null;
        }
        return asset;
    }
}

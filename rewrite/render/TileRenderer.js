import { State } from '../core/State.js';

export class TileRenderer {

    constructor(stage) {
        this.stage = stage;
        this.assets = {};
        this.isLoaded = false;
        
        // Define common tile type to texture mappings
        this.typeToTexture = {
            'FLOOR': 'floor-tile.png',
            'WALL': 'wall-tile.png',
            'COUNTER': 'counter-tile.png',
            'SERVICE': 'service_counter.png',
            'GARBAGE': 'garbage-tile.png',
            'CUTTING_BOARD': 'cutting_board.png',
            'FRYER': 'fryer.png',
            'SHUTTER_DOOR': 'shutter_tile-open.png',
            'CHUTE': 'chute/chute_back.png',
            'DISHWASHER': 'ui/dishwasher-closed.png',
            'GRILL': 'stovetop-off.png'
        };
    }

    async loadAssets() {
        // Collect all unique textures from DEFAULT_LEVEL and the defaults
        const textures = new Set(Object.values(this.typeToTexture));
        
        // Add textures from State.grid if they exist (though they might not be loaded yet)
        if (State.grid && State.grid.length > 0) {
            State.grid.forEach(row => {
                row.forEach(cell => {
                    if (cell && cell.state && cell.state.texture) {
                        textures.add(cell.state.texture);
                    }
                });
            });
        }

        const promises = Array.from(textures).map((src) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.assets[src] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load asset: /assets/${src}`);
                    resolve(); // Resolve anyway to not block
                };
                img.src = `/assets/${src}`;
            });
        });

        // Add player separately as it's not a tile string in this list usually
        const extraAssets = {
            'player': '/assets/player-neutral.png'
        };
        const extraPromises = Object.entries(extraAssets).map(([key, src]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.assets[key] = img;
                    resolve();
                };
                img.src = src;
            });
        });

        await Promise.all([...promises, ...extraPromises]);
        this.isLoaded = true;
    }

    drawFloor() {
        if (!this.isLoaded) return;
        const img = this.assets['floor-tile.png'];
        if (!img) return;

        const rows = Math.ceil(this.stage.height / this.stage.tileSize);
        const cols = Math.ceil(this.stage.width / this.stage.tileSize);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                this.stage.ctx.drawImage(
                    img,
                    c * this.stage.tileSize,
                    r * this.stage.tileSize,
                    this.stage.tileSize,
                    this.stage.tileSize
                );
            }
        }
    }

    drawGrid() {
        if (!this.isLoaded) return;
        const grid = State.grid;
        
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const cell = grid[y][x];
                if (!cell) continue;

                let textureKey = cell.state?.texture || this.typeToTexture[cell.typeId];
                if (!textureKey && cell.typeId === 'FLOOR') continue; // Already drawn by drawFloor or not needed

                const img = this.assets[textureKey];
                if (img) {
                    this.stage.ctx.drawImage(
                        img,
                        x * this.stage.tileSize,
                        y * this.stage.tileSize,
                        this.stage.tileSize,
                        this.stage.tileSize
                    );
                }
            }
        }
    }

    drawEntity(key, x, y, options = {}) {
        if (!this.isLoaded) return;
        const img = this.assets[key];
        if (!img) return;

        const size = options.size || this.stage.tileSize;
        const rotation = options.rotation || 0;
        const tilt = options.tilt || 0;

        this.stage.ctx.save();
        this.stage.ctx.translate(x + size / 2, y + size / 2);
        this.stage.ctx.rotate(rotation + tilt);
        this.stage.ctx.drawImage(img, -size / 2, -size / 2, size, size);
        this.stage.ctx.restore();
    }
}

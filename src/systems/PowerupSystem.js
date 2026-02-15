import { ItemInstance } from '../entities/Item.js';
import { DEFINITIONS } from '../data/definitions.js';
import { ASSETS } from '../constants.js';

export class PowerupSystem {
    constructor(game) {
        this.game = game;

        this.powerupConfigs = [
            { id: 'keroscene', interval: 60000, timer: 0 },
            { id: 'magic_bag', interval: 90000, timer: 0 },
            { id: 'freeze_clock', interval: 150000, timer: 0 }
        ];
    }

    update(dt) {
        this.powerupConfigs.forEach(config => {
            if (this.isPowerupPresent(config.id)) {
                config.timer = 0; // Reset and wait while present
            } else {
                config.timer += dt;
                if (config.timer >= config.interval) {
                    this.spawnPowerup(config);
                }
            }
        });
    }

    isPowerupPresent(id) {
        const grid = this.game.grid;
        if (!grid) return false;

        const checkItem = (item) => {
            if (!item) return false;
            if (item.definitionId === id) return true;

            // Check contents (bags)
            if (item.state && item.state.contents && Array.isArray(item.state.contents)) {
                for (const subItem of item.state.contents) {
                    if (checkItem(subItem)) return true;
                }
            }

            // Check toppings (burgers)
            if (item.state && item.state.toppings && Array.isArray(item.state.toppings)) {
                for (const topping of item.state.toppings) {
                    if (typeof topping === 'object' && checkItem(topping)) return true;
                }
            }

            return false;
        };

        // Check Grid
        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                const cell = grid.getCell(x, y);
                if (cell.object && checkItem(cell.object)) return true;
            }
        }

        // Check Player
        if (this.game.player && this.game.player.heldItem && checkItem(this.game.player.heldItem)) {
            return true;
        }

        return false;
    }

    spawnPowerup(config) {
        const grid = this.game.grid;
        if (!grid) return;

        // Find all counters
        const potentialCells = [];
        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                const cell = grid.getCell(x, y);
                if (cell && cell.type && cell.type.id === 'COUNTER' && !cell.object) {
                    potentialCells.push(cell);
                }
            }
        }

        if (potentialCells.length > 0) {
            const randomCell = potentialCells[Math.floor(Math.random() * potentialCells.length)];
            const powerup = new ItemInstance(config.id);
            randomCell.object = powerup;
            config.timer = 0; // Reset timer after successful spawn
            this.game.addFloatingText("Powerup Spawned!", randomCell.x, randomCell.y, '#ff00ff');
            console.log(`Spawned ${config.id} at ${randomCell.x},${randomCell.y}`);
        }
    }

    checkInteraction(item, cell) {
        const config = this.powerupConfigs.find(c => c.id === item.definitionId);
        if (config) {
            const shouldRemove = this.activatePowerup(config.id, item);
            if (shouldRemove && cell) {
                cell.object = null;
                console.log(`Powerup ${config.id} removed from cell via PowerupSystem`);
            }
            return true; // Interaction handled
        }
        return false;
    }

    activatePowerup(id, item) {
        if (id === 'keroscene') {
            this._activateKeroscene();
            return true;
        } else if (id === 'freeze_clock') {
            return this._activateFreezeClock(item);
        } else if (id === 'magic_bag') {
            return this._activateMagicBag(item);
        }
        return true;
    }

    _activateKeroscene() {
        console.log("Activating Keroscene Powerup!");
        // Finish every cooking bar
        const grid = this.game.grid;
        let count = 0;
        const effectLocations = [];

        // Iterate all cells
        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                const cell = grid.getCell(x, y);
                // Check items on counters/appliances
                if (cell.object) {
                    if (this._finishCooking(cell.object)) {
                        count++;
                        effectLocations.push({ x, y });
                    }
                }
            }
        }

        // Also finish cooking for held items
        if (this.game.player && this.game.player.heldItem) {
            if (this._finishCooking(this.game.player.heldItem)) {
                count++;
                effectLocations.push({ x: this.game.player.x, y: this.game.player.y });
            }
        }

        if (count > 0) {
            this.game.addFloatingText("INSTA-COOK!", this.game.player.x, this.game.player.y, '#00ffff');
            this.game.audioSystem.playSFX(ASSETS.AUDIO.PRINTER); // Placeholder sound

            // Spawn fire effects on affected items
            effectLocations.forEach(loc => {
                this.game.addEffect({
                    type: 'fire',
                    x: Math.floor(loc.x),
                    y: Math.floor(loc.y),
                    rotation: Math.random() * Math.PI * 2,
                    startTime: Date.now(),
                    duration: 250
                });
            });
        } else {
            this.game.addFloatingText("Powerup Used", this.game.player.x, this.game.player.y, '#aaaaaa');
        }
    }

    _activateFreezeClock(item) {
        if (!item.state.isActivated) {
            console.log("Freezing Time (Manual Mode)!");
            this.game.addFloatingText("TIME FROZEN!", this.game.player.x, this.game.player.y, '#00ffff');
            this.game.timeFreezeTimer = 1; // Any value > 0
            this.game.timeFreezeManual = true;
            item.state.isActivated = true;
            return false; // Don't remove yet
        } else {
            console.log("Resuming Time!");
            this.game.addFloatingText("TIME RESUMED", this.game.player.x, this.game.player.y, '#ffff00');
            this.game.timeFreezeTimer = 0;
            this.game.timeFreezeManual = false;
            return true; // Remove now
        }
    }

    _finishCooking(item) {
        let modified = false;
        // Check if item has cooking state
        if (item.state && item.state.cookingProgress !== undefined) {
            const def = DEFINITIONS[item.definitionId];
            if (!def) return false;

            const currentStage = item.state.cook_level || 'raw';
            if (def.cooking && def.cooking.stages && def.cooking.stages[currentStage]) {
                const stageDef = def.cooking.stages[currentStage];
                if (stageDef.duration) {
                    // Set progress to duration to force completion next frame
                    item.state.cookingProgress = stageDef.duration + 1;
                    modified = true;
                }
            }
        }
        return modified;
    }

    _activateMagicBag(item) {
        if (this.game.player.heldItem) {
            this.game.addFloatingText("Hands Full!", this.game.player.x, this.game.player.y, '#ff0000');
            return false; // Don't remove from counter
        }
        this.game.player.heldItem = item;
        this.game.addFloatingText("MAGIC BAG!", this.game.player.x, this.game.player.y, '#ff00ff');
        return true; // Remove from counter
    }
}


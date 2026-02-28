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
        this.tutorialPowerupSpawned = false;

        // Freeze-clock tracking
        this.freezeClockItem = null;       // reference to the active freeze_clock item
        this.autoResumeTimer = 0;          // counts up while time is frozen
        this.AUTO_RESUME_DURATION = 45000; // 45 seconds
    }

    update(dt) {
        const timeFrozen = this.game.timeFreezeManual;

        // Auto-resume after 45 seconds of frozen time
        if (timeFrozen) {
            this.autoResumeTimer += dt;
            if (this.autoResumeTimer >= this.AUTO_RESUME_DURATION) {
                this.resumeTime();
                return;
            }
        }

        this.powerupConfigs.forEach(config => {
            // Pause powerup spawn timers while time is frozen
            if (timeFrozen) return;

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
            if (config.id === 'keroscene') this.tutorialPowerupSpawned = true;
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

    /** Publicly callable — ends the freeze from any trigger (ticket complete, timeout, re-interaction). */
    resumeTime() {
        if (!this.game.timeFreezeManual) return; // Nothing to resume
        console.log('Resuming Time (auto/external)!');
        this.game.addFloatingText('TIME RESUMED', this.game.player.x, this.game.player.y, '#ffff00');
        this.game.timeFreezeTimer = 0;
        this.game.timeFreezeManual = false;
        this.autoResumeTimer = 0;
        this.freezeClockItem = null;

        // Remove the freeze_clock item from the grid (it was left in place while active)
        const grid = this.game.grid;
        if (grid) {
            for (let y = 0; y < grid.height; y++) {
                for (let x = 0; x < grid.width; x++) {
                    const cell = grid.getCell(x, y);
                    if (cell.object &&
                        cell.object.definitionId === 'freeze_clock' &&
                        cell.object.state.isActivated) {
                        cell.object = null;
                        console.log(`freeze_clock removed from grid at ${x},${y}`);
                        return;
                    }
                }
            }
        }
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

                // Check Fryer Tile (fill bar completely)
                if (cell.type.id === 'FRYER' && cell.state && cell.state.status === 'down') {
                    const max = cell.state.cookingSpeed || 2000;
                    cell.state.timer = max; // Force "done" threshold on next frame
                    cell.state.status = 'done';
                    count++;
                    effectLocations.push({ x, y });
                }

                // Check Dishwasher Tile
                if (cell.type.id === 'DISHWASHER' && cell.state && cell.state.status === 'washing') {
                    cell.state.timer = 0;
                    count++;
                    effectLocations.push({ x, y });
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
            console.log('Freezing Time (Manual Mode)!');
            this.game.addFloatingText('TIME FROZEN!', this.game.player.x, this.game.player.y, '#00ffff');
            this.game.timeFreezeTimer = 1; // Any value > 0
            this.game.timeFreezeManual = true;
            item.state.isActivated = true;
            this.freezeClockItem = item;
            this.autoResumeTimer = 0;
            return false; // Don't remove yet
        } else {
            // Player re-interacted — resume immediately
            this.resumeTime();
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
                if (stageDef.next) {
                    // Directly advance cook_level so it works even while time is frozen.
                    // (Only bumping cookingProgress would get ignored by the grill/fryer loops
                    // which are gated by timeFreezeTimer <= 0.)
                    item.state.cook_level = stageDef.next;
                    item.state.cookingProgress = 0;
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


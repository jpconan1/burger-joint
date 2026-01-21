
import { ASSETS, TILE_TYPES } from '../constants.js';
import { ACTIONS } from './Settings.js';

export class ConstructionSystem {
    constructor(game) {
        this.game = game;

        // Placement State
        this.state = {
            active: false,
            item: null, // item definition from shopItems
            x: 0,
            y: 0,
            heldItem: null,
            isPurchase: false,
            menu: null // { active: true, options: [], selectedIndex: 0 }
        };
    }

    startPlacement(item) {
        // Alias for entering build mode with an item (Buying appliance)
        const newItem = {
            id: item.id,
            tileType: item.tileType,
            savedState: null
        };
        this.enterBuildMode(newItem, true);
    }

    enterBuildMode(initialHeldItem = null, fromPurchase = false) {
        console.log(`Entering Build Mode`);

        // Save previous context
        this.previousGameState = this.game.gameState;
        this.previousRoomId = this.game.currentRoomId;

        this.game.currentRoomId = 'main'; // Ensure we are in kitchen
        this.game.grid = this.game.rooms['main'];

        // Start cursor at player position or center
        let startX = this.game.player.x;
        let startY = this.game.player.y;

        // Safety clamp
        if (startX < 0) startX = 0;
        if (startX >= this.game.grid.width) startX = this.game.grid.width - 1;
        if (startY < 0) startY = 0;
        if (startY >= this.game.grid.height) startY = this.game.grid.height - 1;

        this.state = {
            active: true,
            x: startX,
            y: startY,
            heldItem: initialHeldItem, // If holding an appliance to place
            isPurchase: fromPurchase,
            menu: null // { active: true, options: [], selectedIndex: 0 }
        };
        this.game.gameState = 'BUILD_MODE';
    }

    exitBuildMode() {
        // IF holding item, return it to storage!
        if (this.state.heldItem) {
            this.game.storage[this.state.heldItem.id] = (this.game.storage[this.state.heldItem.id] || 0) + 1;
            this.state.heldItem = null;
            console.log("Held item returned to storage on exit.");
        }

        this.state.active = false;

        // Restore State
        if (this.previousGameState) {
            this.game.gameState = this.previousGameState;
        } else {
            this.game.gameState = 'RENO_SHOP'; // Default fallback
        }

        // Restore Room (if valid)
        if (this.previousRoomId && this.game.rooms[this.previousRoomId]) {
            this.game.currentRoomId = this.previousRoomId;
            this.game.grid = this.game.rooms[this.previousRoomId];
        } else {
            // Default fallback logic mainly for legacy Reno Shop flow
            this.game.currentRoomId = 'office';
            this.game.grid = this.game.rooms['office'];
        }

        this.game.saveLevel();
    }

    handleInput(event) {
        if (!this.state.active || this.game.inputLocked) return;

        const state = this.state;

        // 1. Handle Menu Input if Active
        if (state.menu && state.menu.active) {
            this.handleMenuInput(event);
            return;
        }

        // 2. Cursor Movement
        let dx = 0;
        let dy = 0;

        if (event.code === 'ArrowUp' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_UP)) dy = -1;
        if (event.code === 'ArrowDown' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_DOWN)) dy = 1;
        if (event.code === 'ArrowLeft' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_LEFT)) dx = -1;
        if (event.code === 'ArrowRight' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_RIGHT)) dx = 1;

        if (dx !== 0 || dy !== 0) {
            const newX = state.x + dx;
            const newY = state.y + dy;

            if (newX >= 0 && newX < this.game.grid.width && newY >= 0 && newY < this.game.grid.height) {
                state.x = newX;
                state.y = newY;
            }
        }

        // 3. Pick Up / Place (Space)
        const isPickUp = event.code === this.game.settings.getBinding(ACTIONS.PICK_UP) || event.code === 'Space';
        // Allow Interact key for placement only if in purchase mode
        const isInteract = event.code === this.game.settings.getBinding(ACTIONS.INTERACT) || event.code === 'Enter';

        const isPlacementAction = isPickUp || (state.isPurchase && isInteract);

        if (isPlacementAction) {
            if (state.heldItem) {
                // TRY TO PLACE
                const targetCell = this.game.grid.getCell(state.x, state.y);
                const targetType = targetCell.type.id;

                // Non-responsive items check
                const nonResponsive = ['WALL', 'TICKET_WHEEL', 'SERVICE', 'PRINTER', 'COMPUTER', 'RENO', 'GARBAGE', 'SHUTTER_DOOR', 'OFFICE_DOOR', 'EXIT_DOOR'];
                if (nonResponsive.includes(targetType) || targetCell.type.isDoor || targetCell.type.isExit) {
                    console.log("Cannot place here (blocked)");
                    // Optional: play error sound
                    return;
                }

                // If placing on something that isn't FLOOR, we swap (store old one)
                if (targetType !== 'FLOOR') {
                    // Find definition for current tile to store it
                    const existingShopItem = this.game.shopItems.find(i => i.tileType === targetType);
                    if (existingShopItem) {
                        this.game.storage[existingShopItem.id] = (this.game.storage[existingShopItem.id] || 0) + 1;
                        this.game.addFloatingText(`Stored ${existingShopItem.id}`, state.x, state.y, '#ffff00');
                    }
                }

                // Place it!
                this.game.grid.setTileType(state.x, state.y, TILE_TYPES[state.heldItem.tileType]);

                // Restore rotation/state if preserved
                if (state.heldItem.savedState) {
                    // Merge saved state
                    const newCell = this.game.grid.getCell(state.x, state.y);
                    if (newCell.state) {
                        Object.assign(newCell.state, state.heldItem.savedState);
                    }
                }

                state.heldItem = null;
                this.game.updateCapabilities(); // Live update
                // this.game.audioSystem.playSFX(ASSETS.AUDIO.PRINTER); // Clunk sound

                // If Purchase Mode, pause then exit
                if (state.isPurchase) {
                    this.game.inputLocked = true;
                    setTimeout(() => {
                        this.game.inputLocked = false;
                        this.exitBuildMode();
                    }, 300);
                    return;
                }

            } else {
                // TRY TO PICK UP
                if ((state.isPurchase && isInteract)) return;

                const targetCell = this.game.grid.getCell(state.x, state.y);
                const isAppliance = targetCell.type.id !== 'FLOOR' && targetCell.type.id !== 'WALL' && !targetCell.type.isDoor && !targetCell.type.isExit;

                if (isAppliance) {
                    // Pick it up!
                    const tileTypeId = targetCell.type.id;
                    const savedState = targetCell.state ? JSON.parse(JSON.stringify(targetCell.state)) : null; // Deep copy state

                    const shopItem = this.game.shopItems.find(i => i.tileType === tileTypeId);

                    if (shopItem) {
                        state.heldItem = {
                            id: shopItem.id,
                            tileType: tileTypeId,
                            savedState: savedState
                        };

                        this.game.grid.setTileType(state.x, state.y, TILE_TYPES.FLOOR);
                        this.game.updateCapabilities();
                        // this.game.audioSystem.playSFX(ASSETS.AUDIO.PRINTER); // Swoosh sound
                    }
                }
            }
        }

        // Special: Expand Kitchen at Top Right Corner
        if (state.x === this.game.grid.width - 1 && state.y === 0) {
            const isInteract = event.code === this.game.settings.getBinding(ACTIONS.INTERACT) || event.code === 'Enter';
            if (isInteract) {
                // Trigger Expansion Logic (Reuse from 'X' key logic)
                const expandItem = this.game.shopItems.find(i => i.id === 'expansion');
                if (expandItem) {
                    if (this.game.money >= expandItem.price) {
                        this.game.money -= expandItem.price;
                        this.game.expandKitchen();
                        expandItem.price *= 2; // Increase price
                    } else {
                        this.game.addFloatingText("Need $" + expandItem.price, state.x, state.y, '#ff0000');
                    }
                }
                return;
            }
        }

        // 4. Context Menu (Interact/E)
        if (!isPlacementAction && (event.code === this.game.settings.getBinding(ACTIONS.INTERACT) || event.code === 'Enter')) {
            const targetCell = this.game.grid.getCell(state.x, state.y);
            const isAppliance = targetCell.type.id !== 'FLOOR' && targetCell.type.id !== 'WALL' && !targetCell.type.isDoor;

            const options = [];

            if (isAppliance) {
                // Option 1: Rotate
                options.push({ label: 'Rotate', action: 'rotate' });
                // Option 2: Store
                options.push({ label: 'Store', action: 'store' });
            } else if (targetCell.type.id === 'FLOOR' && !state.heldItem) {
                // Open Storage List
                // List all owned items with count > 0
                Object.keys(this.game.storage).forEach(itemId => {
                    if (this.game.storage[itemId] > 0) {
                        const def = this.game.shopItems.find(i => i.id === itemId);
                        if (def) {
                            options.push({ label: `Retrieve ${def.id} (${this.game.storage[itemId]})`, action: 'retrieve', itemId: itemId });
                        }
                    }
                });

                // Add Buy Options
                const appliances = this.game.shopItems.filter(i => i.type === 'appliance' && i.unlocked);
                appliances.forEach(app => {
                    options.push({
                        label: `Buy ${app.id.replace('_', ' ').toUpperCase()} ($${app.price})`,
                        action: 'buy',
                        itemId: app.id,
                        price: app.price,
                        tileType: app.tileType
                    });
                });
            }

            if (options.length > 0) {
                state.menu = {
                    active: true,
                    options: options,
                    selectedIndex: 0,
                    x: state.x,
                    y: state.y
                };
            }
        }



        if (event.code === 'Escape') {
            this.exitBuildMode();
        }
    }

    handleMenuInput(event) {
        const menu = this.state.menu;

        if (event.code === 'ArrowUp' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_UP)) {
            menu.selectedIndex--;
            if (menu.selectedIndex < 0) menu.selectedIndex = menu.options.length - 1;
        }
        if (event.code === 'ArrowDown' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_DOWN)) {
            menu.selectedIndex++;
            if (menu.selectedIndex >= menu.options.length) menu.selectedIndex = 0;
        }

        if (event.code === 'Enter' || event.code === this.game.settings.getBinding(ACTIONS.INTERACT) || event.code === 'Space') {
            const selected = menu.options[menu.selectedIndex];
            this.executeMenuAction(selected);
            this.state.menu = null; // Close menu
        }

        if (event.code === 'Escape') {
            this.state.menu = null; // Close menu
        }
    }

    executeMenuAction(option) {
        const state = this.state;
        const cell = this.game.grid.getCell(state.x, state.y);

        if (option.action === 'rotate') {
            if (cell.state) {
                // Cycle Facing: 0 -> 1 -> 2 -> 3
                cell.state.facing = ((cell.state.facing || 0) + 1) % 4;
                console.log("Rotated to " + cell.state.facing);
            }
        } else if (option.action === 'store') {
            // Identify Item
            const tileTypeId = cell.type.id;
            const shopItem = this.game.shopItems.find(i => i.tileType === tileTypeId);
            if (shopItem) {
                // Add to storage
                this.game.storage[shopItem.id] = (this.game.storage[shopItem.id] || 0) + 1;
                // Remove from grid
                this.game.grid.setTileType(state.x, state.y, TILE_TYPES.FLOOR);
                this.game.updateCapabilities();
                console.log(`Stored ${shopItem.id}. Count: ${this.game.storage[shopItem.id]}`);
            }
        } else if (option.action === 'retrieve') {
            // Retrieve from storage
            const itemId = option.itemId;
            if (this.game.storage[itemId] > 0) {
                this.game.storage[itemId]--;

                const shopItem = this.game.shopItems.find(i => i.id === itemId);

                // Immediate Placement
                if (shopItem.tileType && TILE_TYPES[shopItem.tileType]) {
                    this.game.grid.setTileType(state.x, state.y, TILE_TYPES[shopItem.tileType]);

                    // Default State
                    const newCell = this.game.grid.getCell(state.x, state.y);
                    if (newCell.state) {
                        newCell.state.facing = 0;
                    }

                    this.game.updateCapabilities();
                    // this.game.audioSystem.playSFX(ASSETS.AUDIO.PRINTER);
                    console.log(`Placed ${itemId} from storage.`);
                } else {
                    console.error("Unknown tile type for retrieved item");
                }
            }
        } else if (option.action === 'buy') {
            if (this.game.money >= option.price) {
                // Buy Logic
                this.game.money -= option.price;

                const newItem = {
                    id: option.itemId,
                    tileType: option.tileType,
                    savedState: null
                };

                // Check First Time Bonus
                const isFirstTime = !this.game.shopSystem.hasAppliance(option.itemId, option.tileType);

                if (isFirstTime) {
                    if (option.itemId === 'fryer') {
                        this.game.pendingOrders.push({ id: 'side_cup_box', qty: 1 });
                        this.game.addFloatingText("Bonus: Side Cups!", state.x, state.y, '#00ff00');
                    } else if (option.itemId === 'soda_fountain') {
                        this.game.pendingOrders.push({ id: 'drink_cup_box', qty: 1 });
                        this.game.addFloatingText("Bonus: Drink Cups!", state.x, state.y, '#00ff00');
                    }
                }

                this.state.heldItem = newItem;
                this.state.isPurchase = false; // Stay in build mode
                this.game.updateCapabilities();
                console.log(`Bought ${option.itemId}`);

            } else {
                this.game.addFloatingText("Not enough money", state.x, state.y, '#ff0000');
            }
        }
    }
}


import { DEFINITIONS } from '../data/definitions.js';
import { ACTIONS } from './Settings.js';
import { SCORING_CONFIG } from '../data/scoringConfig.js';
import { TILE_TYPES } from '../constants.js';
import { ItemInstance } from '../entities/Item.js';

export class ShopSystem {
    constructor(game) {
        this.game = game;
        this.selectedRenoIndex = 0;
        this.selectedComputerItemId = null;
    }

    handleComputerInput(event) {
        // Navigation through ONLY Supply items (Boxes)
        // We filter shopItems dynamically or cache it? Filter is cheap for small lists.
        const computerItems = this.game.shopItems.filter(i => i.type === 'supply');

        // Grid Navigation: 4 columns
        const cols = 4;

        // Find current selection
        let selectedIndex = computerItems.findIndex(i => i.id === (this.selectedComputerItemId || computerItems[0].id));
        if (selectedIndex === -1) selectedIndex = 0;

        if (event.code === 'ArrowRight' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_RIGHT)) {
            if (selectedIndex % cols === (cols - 1)) {
                return 'START_DAY';
            }
            selectedIndex++;
        }
        if (event.code === 'ArrowLeft' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_LEFT)) selectedIndex--;
        if (event.code === 'ArrowDown' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_DOWN)) selectedIndex += cols;
        if (event.code === 'ArrowUp' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_UP)) selectedIndex -= cols;

        // Clamp
        if (selectedIndex < 0) selectedIndex = 0;
        if (selectedIndex >= computerItems.length) selectedIndex = computerItems.length - 1;

        this.selectedComputerItemId = computerItems[selectedIndex].id;

        if (event.code === 'Enter' || event.code === this.game.settings.getBinding(ACTIONS.INTERACT)) {
            if (event.repeat) return;
            const item = computerItems[selectedIndex];

            // 1. Determine Price & Mode
            const isRush = this.game.isRushMode;
            // Rush Markup: +100% (2x)
            const price = isRush ? item.price * 2 : item.price;



            if (!item.unlocked) {
                this.game.addFloatingText("Item is Locked!", this.game.player.x, this.game.player.y, '#ff0000');
                return;
            }

            // 2. Handle Purchase Logic
            if (isRush) {
                // RUSH MODE: Immediate Delivery
                // Find space and spawn
                let targetCell = null;
                const rooms = ['store_room', 'office'];

                for (const roomId of rooms) {
                    const room = this.game.rooms[roomId];
                    if (!room) continue;
                    for (let y = 0; y < room.height; y++) {
                        for (let x = 0; x < room.width; x++) {
                            const cell = room.getCell(x, y);
                            // Find empty spot (Relaxed: Delivery Tile OR Floor)
                            if (!cell.object && (cell.type.id === 'DELIVERY_TILE' || cell.type.id === 'FLOOR')) {
                                targetCell = cell;
                                break;
                            }
                        }
                        if (targetCell) break;
                    }
                    if (targetCell) break;
                }

                if (targetCell) {
                    this.game.money -= price;
                    const instance = new ItemInstance(item.id);
                    if (item.id === 'insert') instance.state.count = 3;
                    targetCell.object = instance;

                    this.game.updateCapabilities();
                    this.game.addFloatingText(`Rush Ordered ${item.id} (-$${price})`, this.game.player.x, this.game.player.y, '#ff4444');
                } else {
                    console.log("No space to place item!");
                    this.game.addFloatingText("No Space!", this.game.player.x, this.game.player.y, '#ff0000');
                }

            } else {
                // MORNING ORDER: Delayed Delivery
                // Deduct money now
                this.game.money -= price;

                // Add to Pending Queue
                if (!this.game.pendingOrders) this.game.pendingOrders = [];

                // Check if we can merge validly? Or just push object
                const existing = this.game.pendingOrders.find(o => o.id === item.id);
                if (existing) {
                    existing.qty = (existing.qty || 1) + 1;
                } else {
                    this.game.pendingOrders.push({ id: item.id, qty: 1 });
                }

                this.game.addFloatingText(`Ordered for Morning (-$${price})`, this.game.player.x, this.game.player.y, '#00ff00');
            }
        }

        if (event.code === 'Escape') {
            if (this.game.isDayActive) {
                this.game.gameState = 'PLAYING';
            } else {
                this.game.gameState = 'POST_DAY';
            }
        }
    }

    getInventoryCount(itemId) {
        // itemId e.g. 'patty_box'
        const def = DEFINITIONS[itemId];
        // If it's a box, we want to know what it produces?
        // Or if the item IS the box (e.g. wrapper_box), we count wrapper_box + wrapper?
        // DEFINITIONS[itemId].produces -> 'beef_patty'

        // Count Loose Items + Items in Boxes
        let count = 0;
        const targetId = def ? def.produces : null; // e.g. beef_patty

        // Scan Rooms
        Object.values(this.game.rooms).forEach(room => {
            if (!room) return;
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);
                    const obj = cell.object;
                    if (obj) {
                        // 1. Box itself (e.g. patty_box)
                        if (obj.definitionId === itemId && obj.state && obj.state.count !== undefined) {
                            count += obj.state.count;
                        }
                        // 2. Loose Product (e.g. beef_patty)
                        else if (targetId && obj.definitionId === targetId) {
                            count += 1;
                        }
                    }
                }
            }
        });

        // Add Cart content (Full Boxes)
        const inCart = this.game.cart[itemId] || 0;
        const perBox = def ? (def.maxCount || 1) : 1;
        count += inCart * perBox;

        // Add Pending Orders (Morning Delivery)
        if (this.game.pendingOrders) {
            const pending = this.game.pendingOrders.find(o => o.id === itemId);
            if (pending) {
                count += pending.qty * perBox;
            }
        }

        return count;
    }

    hasAppliance(itemId, tileTypeId) {
        // 1. Check Storage
        if (this.game.storage[itemId] > 0) return true;

        // 2. Check World (Rooms)
        for (const room of Object.values(this.game.rooms)) {
            if (!room) continue;
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);
                    if (cell.type && cell.type.id === tileTypeId) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    handleRenoInput(event) {
        // Filter for Appliances and Actions
        const renoItems = this.game.shopItems.filter(i => i.type === 'appliance' || i.type === 'action');

        if (renoItems.length === 0) return;

        if (this.selectedRenoIndex === undefined || this.selectedRenoIndex === null) {
            this.selectedRenoIndex = 0;
        }

        const count = renoItems.length;
        const idx = this.selectedRenoIndex;
        let dx = 0;
        let dy = 0;

        if (event.code === 'ArrowLeft' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_LEFT)) dx = -1;
        if (event.code === 'ArrowRight' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_RIGHT)) dx = 1;
        if (event.code === 'ArrowUp' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_UP)) dy = -1;
        if (event.code === 'ArrowDown' || event.code === this.game.settings.getBinding(ACTIONS.MOVE_DOWN)) dy = 1;

        if (idx < 2) {
            // Top Row (0: Build Mode, 1: Expand)
            if (dx === 1 && idx === 0) this.selectedRenoIndex = 1;
            if (dx === -1 && idx === 1) this.selectedRenoIndex = 0;
            if (dy === 1) {
                // Down to grid
                if (idx === 0) this.selectedRenoIndex = 2; // Left (Build Mode) -> First Item (Col 0)
                if (idx === 1) this.selectedRenoIndex = Math.min(4, count - 1); // Right (Expand) -> Third Item (Col 2)
            }
        } else {
            // Grid Logic (Base index 2)
            const gridIdx = idx - 2;
            const cols = 3;
            const gridCol = gridIdx % cols;

            if (dx === 1 && gridCol < cols - 1 && idx < count - 1) this.selectedRenoIndex++;
            if (dx === -1 && gridCol > 0) this.selectedRenoIndex--;

            if (dy === 1) {
                const next = idx + cols;
                if (next < count) this.selectedRenoIndex = next;
            }
            if (dy === -1) {
                const prev = idx - cols;
                if (prev >= 2) {
                    this.selectedRenoIndex = prev;
                } else {
                    // Up to Top Row
                    // If col 0,1 -> Build Mode (0)
                    // If col 2 -> Expand (1)
                    if (gridCol < 2) this.selectedRenoIndex = 0;
                    else this.selectedRenoIndex = 1;
                }
            }
        }

        const currentItem = renoItems[this.selectedRenoIndex];

        // Interaction (Buy / Place)
        if (event.code === 'Enter' || event.code === this.game.settings.getBinding(ACTIONS.INTERACT) || event.code === 'Space') {
            if (event.repeat) return;

            if (currentItem.unlocked) {
                if (currentItem.type === 'action') {
                    if (currentItem.id === 'expansion') {
                        if (this.game.money >= currentItem.price) {
                            this.game.money -= currentItem.price;
                            this.game.expandKitchen();
                            currentItem.price *= 2; // Increase price
                            // if (this.game.audioSystem) this.game.audioSystem.playSound(ASSETS.AUDIO.PRINTER);
                        } else {
                            this.game.addFloatingText("Not enough money", this.game.player.x, this.game.player.y, '#ff0000');
                        }
                    } else if (currentItem.id === 'build_mode') {
                        this.game.constructionSystem.enterBuildMode();
                    }
                } else if (currentItem.type === 'appliance') {
                    // Buy Logic: Enter Build Mode with item
                    if (this.game.money >= currentItem.price) {
                        // Check for First-Time Purchase Bonus
                        const isFirstTime = !this.hasAppliance(currentItem.id, currentItem.tileType);

                        this.game.money -= currentItem.price;

                        const newItem = {
                            id: currentItem.id,
                            tileType: currentItem.tileType,
                            savedState: null
                        };

                        this.game.constructionSystem.startPlacement(newItem);
                        // this.game.audioSystem.playSFX(ASSETS.AUDIO.PRINTER);

                        // Grant Free Gift if First Time
                        if (isFirstTime) {
                            let giftId = null;
                            if (currentItem.id === 'fryer') {
                                giftId = 'side_cup_box';
                            } else if (currentItem.id === 'soda_fountain') {
                                giftId = 'drink_cup_box';
                            }

                            if (giftId) {
                                if (!this.game.pendingOrders) this.game.pendingOrders = [];
                                const existing = this.game.pendingOrders.find(o => o.id === giftId);
                                if (existing) {
                                    existing.qty = (existing.qty || 1) + 1;
                                } else {
                                    this.game.pendingOrders.push({ id: giftId, qty: 1 });
                                }
                                setTimeout(() => {
                                    this.game.addFloatingText("Free starter supplies added!", this.game.player.x, this.game.player.y - 20, '#00ff00');
                                }, 500);
                            }
                        }

                    } else {
                        this.game.addFloatingText("Not enough money", this.game.player.x, this.game.player.y, '#ff0000');
                    }
                }
            }
        }

        if (event.code === 'Escape') {
            this.game.gameState = 'PLAYING';
        }
    }

    sortShopItems() {
        this.game.shopItems.sort((a, b) => {
            const getRank = (item) => {
                // Actions (Build Mode, Expand) first
                if (item.type === 'action') return 0;
                // Appliances next
                if (item.type === 'appliance') return 1;
                // Unlocked supplies
                if (item.unlocked) {
                    if (item.id === 'bun_box') return 2.1;
                    if (item.id === 'patty_box') return 2.2;
                    return 2.5;
                }
                // Locked supplies
                return 3;
            };
            return getRank(a) - getRank(b);
        });
    }

    checkUnlocks() {
        const activeTileTypes = new Set();
        Object.values(this.game.rooms).forEach(room => {
            if (!room) return;
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);
                    if (cell.type && cell.type.id) {
                        activeTileTypes.add(cell.type.id);
                    }
                }
            }
        });

        // Loop through all shop items and check unlock conditions
        this.game.shopItems.forEach(item => {
            // Skip essential items that are always unlocked
            const def = DEFINITIONS[item.id];
            if (!def) return;

            // Check if there is an explicit unlock condition
            if (def.unlockCondition && !item.isEssential) {
                // Prevent re-locking if it's a Reward Item that has been unlocked
                if (item.isReward && item.unlocked) return;

                let unlocked = false;

                if (def.unlockCondition.type === 'appliance') {
                    // Map appliance item ID to tile type if needed, or assume target is tile ID
                    const applianceId = def.unlockCondition.target;
                    const applianceDef = DEFINITIONS[applianceId];
                    if (applianceDef && applianceDef.tileType) {
                        if (activeTileTypes.has(applianceDef.tileType)) {
                            unlocked = true;
                        }
                    } else if (applianceId === 'cutting_board' && activeTileTypes.has('CUTTING_BOARD')) unlocked = true;
                    else if (applianceId === 'fryer' && activeTileTypes.has('FRYER')) unlocked = true;
                    else if (applianceId === 'soda_fountain' && activeTileTypes.has('SODA_FOUNTAIN')) unlocked = true;
                    else if (applianceId === 'dispenser' && activeTileTypes.has('DISPENSER')) unlocked = true;
                    else if (applianceId === 'grill' && activeTileTypes.has('GRILL')) unlocked = true;
                } else if (def.unlockCondition.type === 'star') {
                    if (def.unlockCondition.target === 3 && this.game.earnedServiceStar) {
                        unlocked = true;
                    }
                } else if (def.unlockCondition.type === 'endgame') {
                    // Endgame requires Fryer AND Soda Fountain
                    if (activeTileTypes.has('FRYER') && activeTileTypes.has('SODA_FOUNTAIN')) {
                        unlocked = true;
                    }
                }

                item.unlocked = unlocked;
            }
        });

        this.sortShopItems();
    }
}

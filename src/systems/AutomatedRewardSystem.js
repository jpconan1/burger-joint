import { DEFINITIONS } from '../data/definitions.js';
import { TILE_TYPES } from '../constants.js';
import { ItemInstance } from '../entities/Item.js';

export class AutomatedRewardSystem {
    constructor(game) {
        this.game = game;

        // Tier definitions based on user request
        // Items must map to valid shop item IDs (e.g. boxes/bags that unlock the content)
        this.tiers = {
            1: [
                'bacon_box',
                'cheddar_box',
                'tomato_box',
                'burger_sauce_bag'
            ],
            2: [
                'lettuce_box',
                'pickle_box',
                'onion_box',
                // 'fried_onion', // Covered by onion_box
                'mayo_bag',
                // 'onion_ring_box', // ID not found in items.json
                'ketchup_bag'
            ],
            3: [
                'chicken_patty_box',
                'whole_wheat_bun_box',
                'swiss_box',
                'bbq_bag',
                'sweet_potato_fry_box',
                'grape_box',
                'orange_box'
            ],
            4: [
                'hetap_box',
                'dr_matt_box',
                'gingie_box'
            ]
        };
    }

    processShiftChange(shiftCount) {
        console.log(`[RewardSystem] Processing Shift Change. Count: ${shiftCount}`);

        // 1. Build Pool of Candidate Items
        const candidates = [];

        // Progression: Tier 1 at Shift 1, Tier 2 at Shift 2, etc. (One tier per shift)
        const maxTier = shiftCount;

        for (let t = 1; t <= maxTier; t++) {
            const tierItems = this.tiers[t];
            if (tierItems) {
                tierItems.forEach(itemId => {
                    const shopItem = this.game.shopItems.find(i => i.id === itemId);
                    if (shopItem && !shopItem.unlocked) {
                        candidates.push(itemId);
                    }
                });
            }
        }

        if (candidates.length === 0) {
            console.log("[RewardSystem] No new rewards available to unlock.");
            return;
        }

        // 2. Determine quantity
        const count = 3;

        // 3. Pick up to 3 Random Rewards
        const shuffled = candidates.sort(() => 0.5 - Math.random());
        const selectedIds = shuffled.slice(0, Math.min(count, candidates.length));
        console.log(`[RewardSystem] Selected Rewards: ${selectedIds.join(', ')}`);

        // 4. Trigger Alert System
        this.game.alertSystem.trigger('unlock_alert', () => {
            console.log("[RewardSystem] Unlock Alert finished.");
        }, {
            rewards: selectedIds.map(id => DEFINITIONS[id])
        });
    }

    grantReward(itemId, silent = false) {
        const itemDef = DEFINITIONS[itemId];
        if (!itemDef) {
            console.error(`[RewardSystem] Invalid definition for ${itemId}`);
            return;
        }

        const shopItem = this.game.shopItems.find(i => i.id === itemId);


        // --- Logic Selection ---
        // "Sauce boxes and syrup boxes are deprecated. The reward is the whole machine."
        // We detect if this item is a sauce/drink provider and SWAP the reward to the machine.

        let itemInstance = null;
        let machineType = null; // 'DISPENSER' or 'SODA_FOUNTAIN'
        let configId = null; // The sauce/syrup ID

        // Helper: Check recursively if item leads to sauce/syrup
        const detectType = (def) => {
            if (def.category === 'sauce_refill' || def.type === 'SauceContainer') return 'sauce';
            if (def.category === 'syrup' || (def.orderConfig && def.orderConfig.type === 'drink')) return 'drink';

            if (def.produces) {
                const p = DEFINITIONS[def.produces];
                if (p) {
                    if (p.category === 'sauce_refill' || p.type === 'SauceContainer' || p.category === 'topping') {
                        if (def.type === 'SauceContainer' || p.type === 'SauceContainer') return 'sauce';
                    }
                    if (p.category === 'syrup') return 'drink';
                }
            }
            return null;
        };

        const type = detectType(itemDef);

        if (type === 'sauce') {
            machineType = 'DISPENSER';
            configId = itemDef.id.replace('_bag', ''); // best guess
            if (itemDef.produces) configId = itemDef.produces;

            // Override for known IDs
            if (itemId === 'burger_sauce_bag') configId = 'burger_sauce';
            if (itemId === 'mayo_bag') configId = 'mayo';
            if (itemId === 'ketchup_bag') configId = 'ketchup';
            if (itemId === 'bbq_bag') configId = 'bbq';

        } else if (type === 'drink') {
            machineType = 'SODA_FOUNTAIN';
            if (itemDef.produces) {
                const syrupDef = DEFINITIONS[itemDef.produces];
                if (syrupDef) {
                    configId = syrupDef.id; // e.g. hetap_syrup
                }
            }
            if (!configId) configId = itemDef.id; // Fallback
        }

        if (machineType) {
            console.log(`[RewardSystem] Converting ${itemId} to ${machineType} (Config: ${configId})`);

            // Create Appliance Item
            const applianceId = (machineType === 'DISPENSER') ? 'dispenser' : 'soda_fountain';
            itemInstance = new ItemInstance(applianceId);

            // Configure State (Infinite)
            itemInstance.state.charges = 9999;
            itemInstance.state.isInfinite = true;

            if (machineType === 'DISPENSER') {
                itemInstance.state.status = 'loaded';
                itemInstance.state.sauceId = configId;
                itemInstance.state.bagId = itemId;
            } else {
                itemInstance.state.status = 'full';
                itemInstance.state.syrupId = configId;
                // We might need resultId
                const syrupDef = DEFINITIONS[configId];
                if (syrupDef && syrupDef.result) {
                    itemInstance.state.resultId = syrupDef.result;
                } else {
                    itemInstance.state.resultId = configId.replace('_syrup', '');
                }
            }

            // Unlock the Appliance in Shop
            const appShopItem = this.game.shopItems.find(i => i.tileType === machineType);
            if (appShopItem) appShopItem.unlocked = true;

            // Do NOT unlock the supply bag/box (deprecated)

        } else {
            // Standard Item (Box, etc.)
            itemInstance = new ItemInstance(itemId);

            // Unlock in Shop Logic
            if (shopItem) {
                shopItem.unlocked = true;
            }
        }

        // --- Helper Logic (Cups/Inserts) ---
        // REMOVED: Player has unlimited cups/sides. Inserts handled separately.

        // Spawn Main Reward
        this.spawnRewardItem(itemInstance);

        // --- Update Menu & UI ---
        this.game.updateCapabilities();
        const menuSystem = this.game.menuSystem;
        if (menuSystem) {
            menuSystem.updateAvailableItems();
        }

        if (!silent) {
            this.game.alertSystem.trigger('unlock_alert', () => { }, { itemName: itemDef.name || itemId });
        }
        this.game.addFloatingText(`Unlocked: ${itemDef.name || itemId}!`, this.game.player.x, this.game.player.y, '#ffd700');
    }

    spawnRewardItem(itemInstance) {
        // Rooms to check in order of priority
        const roomPriority = ['store_room', 'office', 'main'];
        let targetCell = null;

        // 1. Try to find an empty DELIVERY_TILE in any room
        for (const roomId of roomPriority) {
            const room = this.game.rooms[roomId];
            if (!room) continue;

            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);
                    if (cell && cell.type.id === 'DELIVERY_TILE' && !cell.object) {
                        targetCell = cell;
                        break;
                    }
                }
                if (targetCell) break;
            }
            if (targetCell) break;
        }

        // 2. Fallback to any empty FLOOR in the store room or main room
        if (!targetCell) {
            const fallbackRooms = ['store_room', 'main'];
            for (const roomId of fallbackRooms) {
                const room = this.game.rooms[roomId];
                if (!room) continue;

                for (let y = 0; y < room.height; y++) {
                    for (let x = 0; x < room.width; x++) {
                        const cell = room.getCell(x, y);
                        // Floor tiles are also used as fallback if delivery tiles are full
                        if (cell && (cell.type.id === 'FLOOR' || cell.type.id === 'DELIVERY_TILE') && !cell.object) {
                            targetCell = cell;
                            break;
                        }
                    }
                    if (targetCell) break;
                }
                if (targetCell) break;
            }
        }

        if (targetCell) {
            targetCell.object = itemInstance;
            console.log(`[RewardSystem] Spawned ${itemInstance.definitionId} at ${targetCell.x},${targetCell.y}`);
        } else {
            console.log(`[RewardSystem] No space in Store Room for ${itemInstance.definitionId}!`);
            this.game.addFloatingText("Store Room Full!", this.game.player.x, this.game.player.y, '#ff0000');
        }
    }
}

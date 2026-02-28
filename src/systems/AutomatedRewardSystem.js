import { DEFINITIONS } from '../data/definitions.js';
import { TILE_TYPES } from '../constants.js';
import { ItemInstance } from '../entities/Item.js';

export class AutomatedRewardSystem {
    constructor(game) {
        this.game = game;

        // Tier definitions based on user request
        // Items must map to valid shop item IDs (e.g. boxes/bags that unlock the content)
        // NOTE: whole_wheat_bun_box, chicken_patty_box, and all drinks are DISABLED from unlocking.
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
                'mayo_bag',
                'ketchup_bag'
            ],
            3: [
                'swiss_box',
                'bbq_bag',
                'sweet_potato_fry_box'
            ]
        };
    }

    processShiftChange(shiftCount) {
        console.log(`[RewardSystem] Processing Shift Change. Count: ${shiftCount}`);

        // 1. Build Pool of Candidate Items from available tiers
        const candidates = [];
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

        // 2. Auto-pick ONE random reward from the pool
        const shuffled = candidates.sort(() => 0.5 - Math.random());
        const selectedId = shuffled[0];
        console.log(`[RewardSystem] Auto-unlocking: ${selectedId}`);

        // 3. Grant the reward immediately (silent = true to suppress the per-item alert)
        this.grantReward(selectedId, true);

        // 4. Determine the display name for the alert
        const itemDef = DEFINITIONS[selectedId];
        const displayName = itemDef ? (itemDef.name || selectedId) : selectedId;

        // 5. Muffle music, show unlock alert, then unmute + new song on dismiss
        this.game.audioSystem.setMuffled(true);
        this.game.alertSystem.trigger('unlock_alert', () => {
            console.log("[RewardSystem] Unlock Alert finished.");
            this.game.audioSystem.setMuffled(false);
            this.game.playRandomSong();
            if (!this.game.unlockMiniGameShown) {
                this.game.unlockMiniGameShown = true;
                this.game.saveLevel();
                setTimeout(() => {
                    this.game.alertSystem.trigger('tickets_reminder');
                }, 500);
            }
        }, {
            itemName: displayName
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
            const appShopItem = this.game.shopItems.find(i => (i.tileType === machineType || i.id === applianceId));
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
        console.log(`[RewardSystem] Dropping ${itemInstance.definitionId} into chute.`);
        this.game.dropInChute(itemInstance);
    }
}

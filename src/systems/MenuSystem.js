import { DEFINITIONS } from '../data/definitions.js';
import itemsData from '../data/items.json' with { type: 'json' };
import { ItemInstance } from '../entities/Item.js';

export class MenuSystem {
    constructor(game) {
        this.game = game;
        this.menuSlots = Array(64).fill(null);

        // Initialize Default Menu (Plain Burger)
        this.menuSlots[0] = {
            type: 'Composite',
            definitionId: 'burger',
            name: 'Plain',
            state: {
                bun: new ItemInstance('plain_bun'),
                toppings: [(() => {
                    const p = new ItemInstance('beef_patty');
                    p.state.cook_level = 'cooked';
                    return p;
                })()]
            }
        };

        this.sides = []; // Currently selected sides on the menu
        this.drinks = []; // Currently selected drinks on the menu
        this.data = itemsData;

        // Raw categorization for reference
        this.rawBuns = [];
        this.rawToppings = [];
        this.rawSides = [];
        this.rawDrinks = [];

        this.processItems(itemsData);
    }

    processItems(data) {
        if (!data || !data.groups) return;

        const processSingleItem = (item) => {
            if (!item || !item.id) return;

            if (item.category === 'bun') {
                this.rawBuns.push(item);
            } else if (item.category === 'patty' || item.isTopping || item.category === 'topping') {
                this.rawToppings.push(item);
            } else if (item.orderConfig && item.orderConfig.type === 'side') {
                this.rawSides.push(item);
            } else if (item.orderConfig && item.orderConfig.type === 'drink') {
                this.rawDrinks.push(item);
            }
        };

        data.groups.forEach(group => {
            if (group.item) processSingleItem(group.item);
            if (group.slice) processSingleItem(group.slice);
            if (group.items && Array.isArray(group.items)) {
                group.items.forEach(subItem => processSingleItem(subItem));
            }
        });
    }

    /**
     * Updates availability of sides/drinks based on unlocks.
     * Burgers are managed by UnlockMiniGame.
     */
    updateAvailableItems() {
        if (!this.game || !this.game.shopItems) return;

        const checkUnlocked = (itemId) => {
            const shopItem = this.game.shopItems.find(i => i.id === itemId);
            if (shopItem) return shopItem.unlocked;

            let currentId = itemId;
            let depth = 0;
            while (depth < 5) {
                const parentId = this.game.itemDependencyMap[currentId];
                if (!parentId) break;
                const pShopItem = this.game.shopItems.find(i => i.id === parentId);
                if (pShopItem) return pShopItem.unlocked;
                currentId = parentId;
                depth++;
            }
            return true;
        };

        // Auto-add Fries and Cola to menu if available
        const friesAvailable = this.rawSides.some(s => s.id === 'fries' && checkUnlocked('fries'));
        if (friesAvailable && !this.sides.some(s => s.definitionId === 'fries')) {
            this.sides.push({ definitionId: 'fries' });
        }

        const colaAvailable = this.rawDrinks.some(d => d.id === 'cola' && checkUnlocked('cola'));
        if (colaAvailable && !this.drinks.some(d => d.definitionId === 'cola')) {
            this.drinks.push({ definitionId: 'cola' });
        }
    }

    /**
     * Get the current menu configuration for the day.
     * This is the source of truth for ticket generation.
     */
    getMenu() {
        const activeSlots = this.menuSlots.filter(s => s !== null);
        if (activeSlots.length === 0) return null;

        const burgers = activeSlots.map(slot => {
            const list = slot.state.toppings || [];
            const toppingsConfig = {};
            list.forEach(t => {
                const id = typeof t === 'string' ? t : (t.definitionId || (t.definition && t.definition.id));
                if (id) {
                    toppingsConfig[id] = 'standard';
                }
            });

            return {
                bun: slot.state.bun ? slot.state.bun.definitionId : 'plain_bun',
                toppings: toppingsConfig,
                name: slot.name
            };
        });

        return {
            burgers: burgers,
            sides: this.sides.map(s => s.definitionId),
            drinks: this.drinks.map(d => d.definitionId)
        };
    }

    calculateComplexity() {
        let score = 0;
        const uniqueBuns = new Set();

        // Count active burgers
        const activeBurgers = this.menuSlots.filter(s => s !== null);

        activeBurgers.forEach(slot => {
            if (slot.state.bun) uniqueBuns.add(slot.state.bun.definitionId);

            if (slot.state.toppings) {
                slot.state.toppings.forEach(t => {
                    const def = DEFINITIONS[t.definitionId];
                    if (def) {
                        if (['bacon', 'fried_onion'].includes(t.definitionId)) {
                            score += 2;
                        } else if (def.isSlice) {
                            score += 1.5;
                        } else if (def.orderConfig && def.orderConfig.capability === 'ADD_COLD_SAUCE') {
                            score += 1;
                        } else {
                            score += 1.5;
                        }
                    } else {
                        score += 1.5; // Default fallback
                    }
                });
            }
        });

        score += uniqueBuns.size;
        score += this.sides.length * 2;
        score += this.drinks.length * 1.5;

        return score;
    }
}

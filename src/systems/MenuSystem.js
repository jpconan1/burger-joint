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
            return false;
        };

        // Auto-add unlocked sides to menu
        this.rawSides.forEach(s => {
            if (checkUnlocked(s.id) && !this.sides.some(side => side.definitionId === s.id)) {
                this.sides.push({ definitionId: s.id });
                console.log(`[MenuSystem] Auto-added side to menu: ${s.id}`);
            }
        });

        // Auto-add unlocked drinks to menu
        this.rawDrinks.forEach(d => {
            if (checkUnlocked(d.id) && !this.drinks.some(drink => drink.definitionId === d.id)) {
                this.drinks.push({ definitionId: d.id });
                console.log(`[MenuSystem] Auto-added drink to menu: ${d.id}`);
            }
        });

        // Auto-add unlocked sauces to burgers if missing
        const sauces = ['mayo', 'ketchup', 'bbq', 'burger_sauce'];
        sauces.forEach(sauceId => {
            if (checkUnlocked(sauceId)) {
                const onAnyBurger = this.menuSlots.some(slot =>
                    slot && slot.state.toppings && slot.state.toppings.some(t => {
                        const tid = typeof t === 'string' ? t : (t.definitionId || (t.definition && t.definition.id));
                        return tid === sauceId;
                    })
                );

                if (!onAnyBurger) {
                    this.addToppingToMenu(sauceId);
                }
            }
        });
    }

    /**
     * Resolves a box/bag item ID to the topping ID that would appear on a burger.
     */
    resolveToppingId(itemId) {
        const def = DEFINITIONS[itemId];
        if (!def) return null;

        // Already a topping
        if (def.category === 'topping' || def.isTopping) return def.id;

        // If it's a box/bag, find what it produces
        let producesId = def.produces;
        if (def.fryContent && !producesId) producesId = def.fryContent;

        if (producesId) {
            const prod = DEFINITIONS[producesId];
            if (prod) {
                if (prod.category === 'topping' || prod.isTopping) return prod.id;

                // Common mapping for produce
                const mappings = {
                    'tomato': 'tomato_slice',
                    'lettuce_head': 'lettuce_leaf',
                    'onion': 'onion_slice',
                    'cheddar_block': 'cheddar_cheese',
                    'swiss_block': 'swiss_cheese',
                    'pickle': 'pickle_slice'
                };
                if (mappings[prod.id]) return mappings[prod.id];

                // If the product is sliceable, check its slice result
                if (prod.slicing && prod.slicing.result) {
                    const slice = DEFINITIONS[prod.slicing.result];
                    if (slice && (slice.category === 'topping' || slice.isTopping)) return slice.id;
                }
            }
        }

        return null;
    }

    /**
     * Adds the unlocked topping to the best available burger menu slot
     */
    addToppingToMenu(itemId) {
        const toppingId = this.resolveToppingId(itemId) || itemId;
        const toppingDef = DEFINITIONS[toppingId];
        if (!toppingDef || !(toppingDef.category === 'topping' || toppingDef.isTopping)) {
            console.log(`[MenuSystem] Skipping menu slot add for non-topping: ${toppingId}`);
            return;
        }

        const activeSlots = this.menuSlots.filter(s => s !== null);
        if (activeSlots.length === 0) return;

        // Find the slot that doesn't already have this topping and has the fewest toppings
        const eligibleSlots = activeSlots.filter(slot => {
            const toppings = slot.state.toppings || [];
            return !toppings.some(t => {
                const tid = typeof t === 'string' ? t : (t.definitionId || (t.definition && t.definition.id));
                return tid === toppingId;
            });
        });

        if (eligibleSlots.length === 0) return;

        // Pick the slot with the fewest existing toppings
        eligibleSlots.sort((a, b) => (a.state.toppings?.length || 0) - (b.state.toppings?.length || 0));
        const targetSlot = eligibleSlots[0];

        const newTopping = new ItemInstance(toppingId);
        targetSlot.state.toppings = targetSlot.state.toppings || [];
        targetSlot.state.toppings.push(newTopping);
        console.log(`[MenuSystem] Added topping '${toppingId}' to burger slot '${targetSlot.name}'`);
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

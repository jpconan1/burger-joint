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
            name: 'Beef',
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

    resetMenu() {
        this.menuSlots = Array(64).fill(null);
        this.sides = [];
        this.drinks = [];
    }

    getStarterBurgerOptions() {
        return this.rawToppings
            .filter(item => item.category === 'patty')
            .map(item => ({
                id: item.id,
                name: this.getBurgerNameForPatty(item.id),
                icon: this.getCookedTexture(item)
            }));
    }

    getStarterSideOptions() {
        return this.rawSides.map(item => ({
            id: item.id,
            name: item.name || this.formatName(item.id),
            icon: item.texture
        }));
    }

    setStarterMenu(burgerPattyId, sideId) {
        this.resetMenu();

        const patty = new ItemInstance(burgerPattyId);
        patty.state.cook_level = 'cooked';

        this.menuSlots[0] = {
            type: 'Composite',
            definitionId: 'burger',
            name: this.getBurgerNameForPatty(burgerPattyId),
            state: {
                bun: new ItemInstance('plain_bun'),
                toppings: [patty]
            }
        };

        if (sideId) {
            this.sides.push({ definitionId: sideId });
        }
    }

    getBurgerNameForPatty(pattyId) {
        const base = pattyId.replace(/_?patty$/, '');
        return this.formatName(base);
    }

    formatName(id) {
        return id
            .split('_')
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    getCookedTexture(item) {
        const cookedRule = item.textures?.rules?.find(rule => rule.stateKey === 'cook_level' && rule.value === 'cooked');
        return cookedRule?.texture || item.texture || item.partTexture || null;
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
     * Updates sides/drinks/sauces on the menu based on what's available in the kitchen.
     * Driven by game.allowedOrderItems, which is built by scanning the grid.
     */
    updateAvailableItems() {
        if (!this.game) return;
        const allowed = this.game.allowedOrderItems;
        const caps = this.getCaps();

        this.rawSides.forEach(s => {
            if (
                allowed.has(s.id) &&
                !this.sides.some(side => side.definitionId === s.id) &&
                this.sides.length < caps.sides
            ) {
                this.sides.push({ definitionId: s.id });
                console.log(`[MenuSystem] Auto-added side: ${s.id}`);
            }
        });

        this.rawDrinks.forEach(d => {
            if (allowed.has(d.id) && !this.drinks.some(drink => drink.definitionId === d.id)) {
                this.drinks.push({ definitionId: d.id });
                console.log(`[MenuSystem] Auto-added drink: ${d.id}`);
            }
        });

    }

    getCaps() {
        return this.game?.menuCaps || { burgers: 2, sides: 2, toppingsPerBurger: 4 };
    }

    getActiveBurgerSlots() {
        return this.menuSlots.filter(slot => slot !== null);
    }

    getBurgerToppingCount(slot) {
        if (!slot?.state?.toppings) return 0;
        return slot.state.toppings.filter(t => {
            const id = typeof t === 'string' ? t : (t.definitionId || (t.definition && t.definition.id));
            const def = id ? DEFINITIONS[id] : null;
            return def && def.category !== 'patty';
        }).length;
    }

    burgerHasTopping(slot, toppingId) {
        const toppings = slot?.state?.toppings || [];
        return toppings.some(t => {
            const tid = typeof t === 'string' ? t : (t.definitionId || (t.definition && t.definition.id));
            return tid === toppingId;
        });
    }

    burgerCanTakeTopping(slot, toppingId) {
        if (!slot) return false;
        if (this.burgerHasTopping(slot, toppingId)) return false;
        return this.getBurgerToppingCount(slot) < this.getCaps().toppingsPerBurger;
    }

    canAddBurger() {
        return this.getActiveBurgerSlots().length < this.getCaps().burgers;
    }

    canAddSide(sideId) {
        if (this.sides.some(side => side.definitionId === sideId)) return false;
        return this.sides.length < this.getCaps().sides;
    }

    addSideToMenu(sideId) {
        if (!this.canAddSide(sideId)) return false;
        this.sides.push({ definitionId: sideId });
        console.log(`[MenuSystem] Added side '${sideId}' to menu`);
        return true;
    }

    isMenuAtCap() {
        const activeSlots = this.getActiveBurgerSlots();
        const caps = this.getCaps();
        if (activeSlots.length < caps.burgers) return false;
        if (this.sides.length < caps.sides) return false;
        return activeSlots.every(slot => this.getBurgerToppingCount(slot) >= caps.toppingsPerBurger);
    }

    addChickenBurger() {
        if (!this.canAddBurger()) return false;
        const targetIndex = this.menuSlots.findIndex(slot => slot === null);
        if (targetIndex === -1) return false;

        this.menuSlots[targetIndex] = {
            type: 'Composite',
            definitionId: 'burger',
            name: 'Chicken',
            state: {
                bun: new ItemInstance('plain_bun'),
                toppings: [(() => {
                    const p = new ItemInstance('chicken_patty');
                    p.state.cook_level = 'cooked';
                    return p;
                })()]
            }
        };
        console.log(`[MenuSystem] Added Chicken Burger to slot ${targetIndex}`);
        return true;
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
    addToppingToMenu(itemId, slotIndex = null) {
        const toppingId = this.resolveToppingId(itemId) || itemId;
        const toppingDef = DEFINITIONS[toppingId];
        if (!toppingDef || !(toppingDef.category === 'topping' || toppingDef.isTopping)) {
            console.log(`[MenuSystem] Skipping menu slot add for non-topping: ${toppingId}`);
            return false;
        }

        const activeSlots = slotIndex !== null ? [this.menuSlots[slotIndex]].filter(s => s !== null) : this.getActiveBurgerSlots();
        if (activeSlots.length === 0) return false;

        let added = false;
        activeSlots.forEach(slot => {
            if (this.burgerCanTakeTopping(slot, toppingId)) {
                const newTopping = new ItemInstance(toppingId);
                slot.state.toppings = slot.state.toppings || [];
                slot.state.toppings.push(newTopping);
                console.log(`[MenuSystem] Added topping '${toppingId}' to burger slot '${slot.name}'`);
                added = true;
            }
        });
        return added;
    }

    /**
     * Get the current menu configuration for the day.
     * This is the source of truth for ticket generation.
     */
    getMenu() {
        const activeSlots = this.getActiveBurgerSlots();
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

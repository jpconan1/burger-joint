import { generateMealConfig } from '../data/orderTemplates.js';
import { SCORING_CONFIG } from '../data/scoringConfig.js';
import { CAPABILITY, DEFINITIONS } from '../data/definitions.js';

const INGREDIENT_COSTS = {
    // Patties
    beef_patty: 4.17,
    chicken_patty: 2.00,

    // Buns
    plain_bun: 0.94,
    whole_wheat_bun: 1.25,

    // Cheese
    cheddar_slice: 0.56,
    swiss_slice: 0.56,
    cheddar_cheese: 0.56,
    swiss_cheese: 0.56,

    // Produce
    lettuce_leaf: 0.52,
    tomato_slice: 0.80,
    onion_slice: 0.80,
    pickle_slice: 0.50,
    fried_onion: 0.80,

    // Meat
    bacon: 2.92,

    // Sauces (per squirt estimate)
    mayo: 0.25,
    ketchup: 0.25,
    bbq: 0.25,
    burger_sauce: 0.25,

    // Sides/Drinks (Base Cost)
    fries: 1.41,
    sweet_potato_fries: 1.41,
    onion_rings: 1.10,
    soda: 0.50,
    drink: 0.50
};

export class OrderSystem {
    constructor() {
        // Difficulty settings or state can go here
    }

    generateTutorialTicket(step) {
        let ticket = new Ticket(step);
        let group;

        switch (step) {
            case 1:
            case 2:
                // Order 1 & 2: Dine-in, 1 plain burger
                group = new OrderGroup('plate');
                group.addBurger({ base: 'Burger', bun: 'plain_bun', modifications: ['beef_patty'] });
                break;
            case 3:
                // Order 3: Take-out, 1 plain burger (+ bag & wrapper box drop)
                group = new OrderGroup('bag');
                group.addBurger({ base: 'Burger', bun: 'plain_bun', modifications: ['beef_patty'] });
                ticket.chuteDrop = ['bag_box', 'wrapper_box'];
                break;
            case 4:
                // Order 4: Dine-in, 1 burger + 1 fries (+ fry box drop)
                group = new OrderGroup('plate');
                group.addBurger({ base: 'Burger', bun: 'plain_bun', modifications: ['beef_patty'] });
                group.addItem('fries');
                ticket.chuteDrop = ['fry_box'];
                break;
            case 5:
                // Order 5: Take-out, 1 burger + 1 fries (+ side cup box drop)
                group = new OrderGroup('bag');
                group.addBurger({ base: 'Burger', bun: 'plain_bun', modifications: ['beef_patty'] });
                group.addItem('fries');
                ticket.chuteDrop = ['side_cup_box'];
                break;
            default:
                return null;
        }

        group.payout = this.calculateGroupPayout(group);
        ticket.addGroup(group);
        ticket.calculateParTime();
        return ticket;
    }

    generateCustomerProfile(menuConfig, unlockedIds = []) {
        const order = {
            burger: null,
            items: []
        };

        if (!menuConfig || !menuConfig.burgers || menuConfig.burgers.length === 0) {
            console.error("Invalid Menu Config!");
            order.burger = { base: 'Burger', bun: 'plain_bun', modifications: ['beef_patty'] };
            return order;
        }

        // 1. Pick a Burger from Menu
        const burgerDef = { ...menuConfig.burgers[Math.floor(Math.random() * menuConfig.burgers.length)] };
        
        // 2. Build Toppings (Standard Only - User: "every burger gets that topping from here out")
        let mods = [];
        if (burgerDef.toppings) {
            // All toppings on the menu are now required
            mods = Object.keys(burgerDef.toppings);
        }

        // 3. Handle Alternate Patties (50% chance for "Newest" Patty)
        const allPatties = unlockedIds.filter(id => id.includes('patty') && !id.includes('box'));
        const altPatties = allPatties.filter(id => id !== 'beef_patty');
        
        if (altPatties.length > 0 && Math.random() < 0.5) {
            const newestPatty = altPatties[altPatties.length - 1];
            // Swap beef for the newest patty
            if (mods.includes('beef_patty') || mods.length === 0) {
                mods = mods.filter(m => m !== 'beef_patty');
                if (!mods.includes(newestPatty)) mods.push(newestPatty);
                
                // Update display name if it's a generic burger
                if (burgerDef.name === 'Plain' || burgerDef.name === 'Burger' || !burgerDef.name) {
                    let pName = newestPatty.replace('_patty', '');
                    burgerDef.name = pName.charAt(0).toUpperCase() + pName.slice(1);
                }
            }
        } else {
            // Ensure at least beef is there if no other mods have it
            if (!mods.some(m => m.includes('patty'))) {
                mods.push('beef_patty');
            }
        }

        order.burger = {
            base: burgerDef.name || 'Burger',
            bun: burgerDef.bun || 'plain_bun',
            modifications: mods
        };

        // 4. Sides (50% chance for a side)
        if (menuConfig.sides && menuConfig.sides.length > 0) {
            if (Math.random() < 0.50) {
                const newestSide = menuConfig.sides[menuConfig.sides.length - 1];
                let choice;
                if (Math.random() < 0.5) {
                    choice = newestSide;
                } else {
                    choice = menuConfig.sides[Math.floor(Math.random() * menuConfig.sides.length)];
                }
                order.items.push(choice);
            }
        }

        // 5. Drinks (33% chance)
        if (menuConfig.drinks && menuConfig.drinks.length > 0) {
            if (Math.random() < 0.33) {
                const choice = menuConfig.drinks[Math.floor(Math.random() * menuConfig.drinks.length)];
                order.items.push(choice);
            }
        }

        return order;
    }

    createTicketFromCustomers(customerGroup, id, isDineIn = null) {
        const ticket = new Ticket(id);

        // Use provided type or decide (66% Dine-In vs 33% Takeout)
        const finalizeDineIn = isDineIn !== null ? isDineIn : Math.random() < 0.66;

        if (finalizeDineIn) {
            // Dine-In: One plate per customer. 
            // Rule: Dine-in tickets are always for exactly one customer.
            const singleCust = customerGroup[0];
            if (singleCust) {
                const group = new OrderGroup('plate');
                if (singleCust.burger) {
                    group.addBurger(singleCust.burger);
                }
                // Add Sides (Plates only hold Burger + Side)
                singleCust.items.forEach(itm => {
                    const def = DEFINITIONS[itm];
                    const isSide = def && (def.orderConfig?.type === 'side' || def.category === 'side' || def.category === 'side_prep');
                    if (isSide) {
                        group.addItem(itm);
                    }
                });

                group.payout = this.calculateGroupPayout(group);
                ticket.addGroup(group);
            }
        } else {
            // Takeout: One Bag for the whole group
            const group = new OrderGroup('bag');
            customerGroup.forEach(cust => {
                // Add Burger
                if (cust.burger) {
                    group.addBurger(cust.burger);
                }
                // Add Items (Remove drinks for take-out orders)
                cust.items.forEach(itm => {
                    const def = DEFINITIONS[itm];
                    const isDrink = def && (def.orderConfig?.type === 'drink' || def.category === 'syrup');
                    if (!isDrink) {
                        group.addItem(itm);
                    }
                });
            });
            group.payout = this.calculateGroupPayout(group);
            ticket.addGroup(group);
        }

        return ticket;
    }

    calculateGroupPayout(group) {
        let total = 0;

        // Burgers
        group.burgers.forEach(burger => {
            total += this.calculateBurgerPrice(burger);
        });

        // Items
        group.items.forEach(itemId => {
            total += this.calculateItemPrice(itemId);
        });

        return Math.ceil(total);
    }

    calculateBurgerPrice(burger) {
        let cost = 0;
        let complexity = 1; // Base

        // Bun
        cost += INGREDIENT_COSTS[burger.bun] || 1.0;

        // Toppings
        if (burger.modifications) {
            burger.modifications.forEach(mod => {
                cost += INGREDIENT_COSTS[mod] || 0.5;

                // Complexity Scoring
                if (['bacon', 'fried_onion', 'chicken_patty'].includes(mod)) {
                    complexity += 2;
                } else if (['mayo', 'ketchup', 'bbq', 'burger_sauce'].includes(mod)) {
                    complexity += 1; // Sauce is simple
                } else {
                    complexity += 1.5; // Sliced/Prep items
                }
            });
        }

        // Pricing Formula: Base + (Cost * 2) + (Complexity * 5)
        // Base Price for a served burger
        const basePrice = 15;

        return basePrice + (cost * 2) + (complexity * 5);
    }

    calculateItemPrice(itemId) {
        const cost = INGREDIENT_COSTS[itemId] || 1.0;
        // 3x Markup for sides/drinks
        return Math.ceil(cost * 3);
    }
}

export class Ticket {
    constructor(id) {
        this.id = id;
        this.groups = []; // Formerly bags
        this.parTime = 0;
        this.elapsedTime = 0;
        this.chuteDrop = []; // Optional list of item IDs to drop when ticket prints
    }

    calculateParTime() {
        let totalTime = 0;
        const TIMES = SCORING_CONFIG.PAR_TIMES;

        this.groups.forEach(group => {
            // Burgers
            group.burgers.forEach(burger => {
                totalTime += TIMES.burger;
                if (burger.modifications) {
                    burger.modifications.forEach(mod => {
                        let def = DEFINITIONS[mod];
                        // Fallback: If item is raw produce (e.g. 'tomato'), check its slice/process result
                        if (def && !def.orderConfig && !def.isSlice) {
                            if (def.slicing && def.slicing.result) def = DEFINITIONS[def.slicing.result];
                            else if (def.process && def.process.result) def = DEFINITIONS[def.process.result];
                        }

                        if (def) {
                            if (def.isSlice || (def.orderConfig && def.orderConfig.capability === CAPABILITY.CUT_TOPPINGS)) {
                                totalTime += TIMES.sliced_topping;
                            } else if (def.orderConfig && def.orderConfig.capability === CAPABILITY.ADD_COLD_SAUCE) {
                                totalTime += TIMES.sauce;
                            }
                        }
                    });
                }
            });
            // Generic Items (Fries, Soda, etc.)
            group.items.forEach(itemId => {
                const def = DEFINITIONS[itemId];
                if (def && def.orderConfig) {
                    if (def.orderConfig.type === 'side') {
                        totalTime += TIMES.side;
                    } else if (def.orderConfig.type === 'drink') {
                        totalTime += TIMES.drink;
                    } else {
                        totalTime += 20;
                    }
                }
            });
        });

        this.parTime = totalTime;
        // console.log(`Ticket #${this.id} Par Time: ${this.parTime}s`);
    }

    addGroup(group) {
        this.groups.push(group);
    }

    // Convert to format expected by Renderer
    toDisplayFormat() {
        const lines = [];
        this.groups.forEach((group, index) => {
            // Assuming 1 group per ticket now, but looping safely
            const prefix = '';

            // Render Burgers
            group.burgers.forEach((burger, bIdx) => {
                const displayName = (burger.base && burger.base !== 'Burger') ? `${burger.base} Burger` : `Burger ${bIdx + 1}`;
                lines.push(`${prefix}${displayName}`);
                burger.modifications.forEach(mod => {
                    let modName = mod.replace(/_slice|_leaf|_cheese/g, '');
                    modName = modName.charAt(0).toUpperCase() + modName.slice(1).replace(/_/g, ' ');
                    if (mod === 'mayo') modName = 'Mayo';
                    if (mod === 'ketchup') modName = 'Ketchup';
                    if (mod === 'bbq') modName = 'BBQ';
                    if (mod === 'burger_sauce') modName = 'Secret Sauce';
                    lines.push(`${prefix}  + ${modName}`);
                });
            });

            // Generic Items
            group.items.forEach(itemId => {
                let displayName = itemId.replace(/_/g, ' ');
                displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
                
                // Clean up specific IDs for the ticket
                if (itemId === 'sweet_potato_fries') displayName = "Sweet Fries";
                if (itemId === 'onion_rings') displayName = "Onion Rings";
                if (itemId === 'fries') displayName = "Potato Fries";
                
                lines.push(`${prefix}${displayName}`);
            });
        });

        lines.push(`-- Time: +${this.parTime}s --`);

        return {
            id: this.id,
            items: lines,
            arrivalTime: this.arrivalTime // Pass this so Renderer/Game can see it if needed
        };
    }

    /**
     * Returns an array of icon objects for rendering on the hanging ticket.
     * Each object contains { type: 'patty'|'topping'|'side'|'drink', texture: string, scale?: number }
     */
    getDisplayIcons() {
        const icons = [];
        const firstGroup = this.groups[0];
        if (!firstGroup) return icons;

        // 1. Patty & Toppings (from first burger)
        const burger = firstGroup.burgers[0];
        if (burger) {
            // Patty
            let pattyTexture = 'patty-cooked.png';
            if (burger.modifications && burger.modifications.includes('chicken_patty')) {
                pattyTexture = 'chicken_patty-cooked.png';
            }
            icons.push({ type: 'patty', texture: pattyTexture });

            // Toppings
            if (burger.modifications) {
                const SLICE_TEXTURE_MAPPING = {
                    'bacon': 'bacon-cooked.png',
                    'cheddar_cheese': 'cheddar_slice.png',
                    'swiss_cheese': 'swiss_slice.png',
                    'onion_slice': 'onion-slice.png',
                    'pickle_slice': 'pickle-slice.png',
                    'tomato_slice': 'tomato-slice.png',
                    'lettuce_leaf': 'lettuce-leaf.png',
                    'mayo': 'mayo-part.png',
                    'bbq': 'bbq-part.png',
                    'burger_sauce': 'burger_sauce-part.png',
                    'ketchup': 'ketchup-part.png'
                };

                burger.modifications.forEach(modId => {
                    if (modId.includes('patty')) return;
                    const def = DEFINITIONS[modId];
                    if (def) {
                        const tex = SLICE_TEXTURE_MAPPING[modId] || def.texture;
                        if (tex) icons.push({ type: 'topping', texture: tex });
                    }
                });
            }
        }

        // 2. Sides
        firstGroup.items.forEach(itemId => {
            const def = DEFINITIONS[itemId];
            if (!def) return;
            const isSide = def.category === 'side' || (def.orderConfig && def.orderConfig.type === 'side');
            if (isSide) {
                let tex = def.texture;
                if (itemId === 'fries') tex = 'fries-done.png';
                if (itemId === 'sweet_potato_fries') tex = 'sweet_potato_fries-done.png';
                icons.push({ type: 'side', texture: tex });
            }
        });

        // 3. Drinks (Optional)
        firstGroup.items.forEach(itemId => {
            const def = DEFINITIONS[itemId];
            if (!def) return;
            const isDrink = def.category === 'drink' || (def.orderConfig && def.orderConfig.type === 'drink');
            if (isDrink) {
                icons.push({ type: 'drink', texture: def.texture });
            }
        });

        return icons;
    }

    isComplete() {
        return this.groups.every(g => g.completed);
    }

    // Returns true if the submitted container matches a pending group requirement
    verifyContainerItem(submittedItem) {
        // MAGIC BAG WILDCARD logic (still legacy support for the name)
        if (submittedItem.definitionId === 'magic_bag') {
            const matchIndex = this.groups.findIndex(g => !g.completed);
            if (matchIndex !== -1) {
                const group = this.groups[matchIndex];
                group.completed = true;
                return {
                    matched: true,
                    payout: group.payout || 50
                };
            }
        }

        // Iterate through incomplete groups to find a match
        const matchIndex = this.groups.findIndex(g => !g.completed && g.matches(submittedItem));

        if (matchIndex !== -1) {
            const group = this.groups[matchIndex];
            group.completed = true;
            return {
                matched: true,
                payout: group.payout || 50 // Default payout if missing
            };
        }

        return { matched: false, payout: 0 };
    }

    /**
     * Performs a deep comparison and returns details about requirements vs contents.
     * Used by the renderer to show exactly what is missing or wrong.
     */
    getValidationDetails(submittedItem) {
        const details = {
            containerMatch: submittedItem.definitionId === this.groups[0]?.containerType,
            burgers: [], // { req: config, matched: bool, content: item }
            items: [],   // { req: id, matched: bool, content: item }
            extras: [],  // items that didn't match anything
            isComplete: false
        };

        const group = this.groups[0];
        if (!group) return details;

        if (submittedItem.definitionId === 'magic_bag') details.containerMatch = true;

        const contents = [...(submittedItem.state.contents || [])];
        
        // Match Items
        group.items.forEach(reqId => {
            const matchIndex = contents.findIndex(i => group.fulfills(i, reqId));
            if (matchIndex !== -1) {
                details.items.push({ req: reqId, matched: true, content: contents[matchIndex] });
                contents.splice(matchIndex, 1);
            } else {
                details.items.push({ req: reqId, matched: false });
            }
        });

        // Match Burgers
        group.burgers.forEach(reqBurger => {
            const matchIndex = contents.findIndex(i => group.matchBurger(reqBurger, i));
            if (matchIndex !== -1) {
                details.burgers.push({ req: reqBurger, matched: true, content: contents[matchIndex] });
                contents.splice(matchIndex, 1);
            } else {
                details.burgers.push({ req: reqBurger, matched: false });
            }
        });

        details.extras = contents;
        details.isComplete = details.containerMatch && 
                            details.items.every(i => i.matched) && 
                            details.burgers.every(b => b.matched) &&
                            details.extras.length === 0;

        return details;
    }
}

export class OrderGroup {
    constructor(containerType = 'bag') {
        this.containerType = containerType; // 'bag' or 'plate'
        this.burgers = []; // List of burger configs
        this.items = []; // List of item IDs required (fries, soda)
        this.completed = false;
        this.payout = 0;
    }

    addBurger(burgerConfig) {
        this.burgers.push(burgerConfig);
    }

    setBurger(burgerConfig) {
        // Legacy support shim if needed, or just redirect
        this.addBurger(burgerConfig);
    }

    addItem(itemId) {
        this.items.push(itemId);
    }

    fulfills(item, rId) {
        const dId = item.definitionId;
        const dDef = item.definition || DEFINITIONS[dId] || {};

        // 1. Exact Match
        if (dId === rId) return true;

        // 2. Cooked Prep Item Match
        if (dDef.category === 'side_prep' && item.state.cook_level === 'cooked') {
            if (dDef.result === rId) return true;
            // Loose aliases
            if (rId === 'fries' && (dId === 'raw_fries' || dId === 'fries')) return true;
            if (rId === 'sweet_potato_fries' && (dId === 'raw_sweet_potato_fries' || dId === 'sweet_potato_fries')) return true;
            if (rId === 'onion_rings' && (dId === 'onion_slice' || dId === 'onion_rings')) return true;
        }

        // 3. Specific Aliases (Bags/Cups)
        if (rId === 'fries' && dId === 'fry_bag') return true;
        if (rId === 'sweet_potato_fries' && dId === 'sweet_potato_fry_bag') return true;
        if (rId === 'soda' && (dId === 'drink_cup' || dId === 'soda' || dId === 'cola')) return true;

        // 4. Nested Content check
        if (item.state.contents && item.state.contents.some(c => this.fulfills(c, rId))) {
            return true;
        }

        return false;
    }

    matchBurger(reqBurger, item) {
        if (!item.definitionId.includes('burger')) return false;

        // A. Check Bun Type
        const itemBun = (item.state.bun && item.state.bun.definitionId) || 'plain_bun';
        const reqBun = reqBurger.bun || 'plain_bun';
        if (itemBun !== reqBun) return false;

        // B. Compare contents (Toppings + Patty)
        const requestedMods = reqBurger.modifications || [];
        const burgerToppings = item.state.toppings || [];
        const actualToppings = burgerToppings.map(t => {
            if (typeof t === 'string') return t === 'mayo' ? 'mayo' : t;
            return t.definitionId;
        });

        // Check for missing required mods
        const missingMod = requestedMods.find(req => {
            if (actualToppings.includes(req)) return false;
            const def = DEFINITIONS[req];
            if (def && def.slicing && def.slicing.result) {
                if (actualToppings.includes(def.slicing.result)) return false;
            }
            return true;
        });
        if (missingMod) return false;

        // Check for unauthorized extra toppings
        const validToppings = new Set(requestedMods);
        requestedMods.forEach(req => {
            const def = DEFINITIONS[req];
            if (def && def.slicing && def.slicing.result) validToppings.add(def.slicing.result);
        });

        const extraTop = actualToppings.find(act => {
            if (validToppings.has(act)) return false;
            const def = DEFINITIONS[act];
            if (!def) return true;
            if (def.category === 'topping' || def.isTopping) return false;
            return true;
        });

        return !extraTop;
    }

    matches(itemInstance) {
        // 0. Verify Container Type
        if (itemInstance.definitionId !== this.containerType) {
            if (this.containerType === 'bag' && itemInstance.definitionId === 'magic_bag') {
                // Allow
            } else {
                return false;
            }
        }

        // 1. Analyze Contents of the submitted container
        const contents = [...(itemInstance.state.contents || [])]; // Shallow copy for consumption

        // 2. Check Generic Requirements (Sides, Drinks)
        for (const reqId of this.items) {
            const matchIndex = contents.findIndex(i => this.fulfills(i, reqId));
            if (matchIndex === -1) return false;
            contents.splice(matchIndex, 1);
        }

        // 3. Check Burger Requirements
        const requiredBurgers = [...this.burgers];

        for (const reqBurger of requiredBurgers) {
            const burgerIndex = contents.findIndex(item => this.matchBurger(reqBurger, item));
            if (burgerIndex === -1) return false;
            contents.splice(burgerIndex, 1);
        }

        // 4. Strict check for extra items?
        if (contents.length > 0) return false;
        return true;
    }
}

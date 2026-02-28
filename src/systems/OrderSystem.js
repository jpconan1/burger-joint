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

    generateCustomerProfile(menuConfig) {
        const order = {
            burger: null,
            items: []
        };

        if (!menuConfig || !menuConfig.burgers || menuConfig.burgers.length === 0) {
            console.error("Invalid Menu Config!");
            // Fallback
            order.burger = { base: 'Burger', bun: 'plain_bun', modifications: ['beef_patty'] };
            return order;
        }

        // 1. Pick a Burger from Menu
        const burgerDef = menuConfig.burgers[Math.floor(Math.random() * menuConfig.burgers.length)];

        // 2. Build Mods (Standard vs Optional)
        const mods = [];
        if (burgerDef.toppings) {
            Object.keys(burgerDef.toppings).forEach(toppingId => {
                const type = burgerDef.toppings[toppingId];

                if (type === 'standard') {
                    // Always KEEP standard toppings (exactly from menu)
                    mods.push(toppingId);
                } else if (type === 'optional') {
                    // 50% chance to include optional toppings
                    if (Math.random() < 0.5) {
                        mods.push(toppingId);
                    }
                }
            });
        }



        order.burger = {
            base: burgerDef.name || 'Burger',
            bun: burgerDef.bun || 'plain_bun',
            modifications: mods
        };

        // 3. Sides
        if (menuConfig.sides && menuConfig.sides.length > 0) {
            if (Math.random() < 0.50) {
                const choice = menuConfig.sides[Math.floor(Math.random() * menuConfig.sides.length)];
                order.items.push(choice);
            }
        }

        // 4. Drinks
        if (menuConfig.drinks && menuConfig.drinks.length > 0) {
            if (Math.random() < 0.66) {
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
                    lines.push(`${prefix}  + ${mod}`);
                });
            });

            // Generic Items
            group.items.forEach(itemId => {
                const displayName = itemId.charAt(0).toUpperCase() + itemId.slice(1);
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

    matches(itemInstance) {
        // 0. Verify Container Type
        if (itemInstance.definitionId !== this.containerType) {
            // Legacy support: 'bag' matches 'magic_bag' too if we want, 
            // but for now let's be strict or allow it if it's a bag.
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
            // Find match
            const matchIndex = contents.findIndex(i => {
                const defId = i.definitionId;
                const def = i.definition || {};

                // 1. Exact Match
                if (defId === reqId) return true;

                // 2. Side Aliases (Fries/Soda)
                if (reqId === 'fries') {
                    if (defId === 'fry_bag' || defId === 'fries') return true;
                    // Check if it's a side cup containing fries
                    if (defId === 'side_cup' && i.state.contents && i.state.contents.some(c => c.definitionId === 'fries')) return true;
                }
                if (reqId === 'soda' && (defId === 'drink_cup' || defId === 'soda' || defId === 'cola')) return true;

                // 3. "Naked" Cooked Sides (e.g. raw_fries that is cooked)
                if (def.category === 'side_prep' && i.state.cook_level === 'cooked') {
                    // Check if this cooked prep item results in the required side
                    if (def.result === reqId) return true;
                    // Fallback for direct reqId match to result (some definitions might be loose)
                    if (reqId === 'fries' && defId === 'raw_fries') return true;
                    if (reqId === 'sweet_potato_fries' && defId === 'raw_sweet_potato_fries') return true;
                }

                return false;
            });

            if (matchIndex === -1) return false;

            // Consume the item match
            contents.splice(matchIndex, 1);
        }

        // 3. Check Burger Requirements
        // We have a list of required burgers. We need to find a match for EACH one in the contents.
        const requiredBurgers = [...this.burgers];

        for (const reqBurger of requiredBurgers) {
            const requestedMods = reqBurger.modifications || [];
            const burgerIndex = contents.findIndex(item => {
                if (!item.definitionId.includes('burger')) return false;

                // A. Check Bun Type
                const itemBun = (item.state.bun && item.state.bun.definitionId) || 'plain_bun';
                const reqBun = reqBurger.bun || 'plain_bun';
                if (itemBun !== reqBun) return false;

                // B. (Removed Patty Type Check - it is now in toppings)

                // C. Compare contents (Toppings + Patty)
                // Use the burger's own state toppings
                const burgerToppings = item.state.toppings || [];

                const actualToppings = burgerToppings.map(t => {
                    if (typeof t === 'string') {
                        if (t === 'mayo') return 'mayo';
                        return t;
                    }
                    return t.definitionId;
                });

                // Check for missing required mods
                const missingMod = requestedMods.find(req => {
                    // Check direct match
                    if (actualToppings.includes(req)) return false;

                    // Check if req defines a slice result that matches
                    const def = DEFINITIONS[req];
                    if (def && def.slicing && def.slicing.result) {
                        if (actualToppings.includes(def.slicing.result)) return false;
                    }

                    return true; // Missing
                });
                if (missingMod) return false;

                // Check for unauthorized extra toppings
                // Expand valid toppings to include slices
                const validToppings = new Set(requestedMods);
                requestedMods.forEach(req => {
                    const def = DEFINITIONS[req];
                    if (def && def.slicing && def.slicing.result) {
                        validToppings.add(def.slicing.result);
                    }
                });
                // Also Base Ingredients are valid? (Bun/Patty are separate)
                // What about 'tomato_slice' vs 'tomato'? handled above.

                // Strict check for unauthorized extra toppings
                // RELAXED: Allow extra toppings for now to prevent player frustration with optional items (e.g. Mayo)

                const extraTop = actualToppings.find(act => !validToppings.has(act));
                if (extraTop) {
                    // console.log(`Rejecting due to extra topping: ${extraTop}`);
                    return false;
                }



                return true;
            });

            if (burgerIndex === -1) return false;

            // Consume matched burger
            contents.splice(burgerIndex, 1);
        }

        // 4. Strict check for extra items?
        if (contents.length > 0) {
            return false;
        }
        return true;
    }
}

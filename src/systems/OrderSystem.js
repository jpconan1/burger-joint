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

    generateDailyOrders(dayNumber, menuConfig) {
        const orders = [];

        // 1. Calculate Day Parameters & Customer Count
        // Stars Logic: 0 stars (day 1), then scales.
        const stars = Math.min(5, Math.floor((dayNumber - 1) / 3));
        const baseMin = 4;
        const baseMax = 6;
        const customerCount = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin + (stars * 2);

        console.log(`Generating Day ${dayNumber} (Stars: ${stars}): ${customerCount} Customers.`);

        // 2. Generate Base Customers
        const customers = [];
        for (let i = 0; i < customerCount; i++) {
            // First customer always orders 2 plain burgers for tutorial consistency if Day 1
            if (dayNumber === 1 && i === 0) {
                customers.push({
                    burger: { base: 'Burger', bun: 'plain_bun', modifications: ['beef_patty'] }, // Will be duplicated or pushed twice logically? 
                    // No, customer profile is one person's order. We want a GROUP order.
                    // The loop below groups them.
                    items: []
                });
                // Push a second identical customer to ensure they get grouped (due to high merge chance or forced grouping?)
                // Actually, let's just make the FIRST PROFILE match the desired complexity, or force the group logic.
                // Better: Force the first TICKET (later in step 3) to strictly be what we want.
                // let's just push randoms here and overwrite later.
                // customers.push(this.generateCustomerProfile(menuConfig));
            }
            customers.push(this.generateCustomerProfile(menuConfig));
        }

        // 3. Grouping (The Merge)
        const tickets = [];
        let i = 0;
        while (i < customers.length) {
            const ticketCustomers = [customers[i]];
            i++;
            // 33% chance to merge next customer if exists
            // "one in three chance to be combined with another customer OR group"
            // We treat the current accumulation as the group.
            while (i < customers.length && Math.random() < 0.33) {
                ticketCustomers.push(customers[i]);
                i++;
            }
            // Create a Ticket with a SINGLE Bag containing all these orders
            tickets.push(this.createTicketFromCustomers(ticketCustomers, tickets.length + 1));
        }

        // Force First Ticket on Day 1 to be 2 Basic Burgers
        if (dayNumber === 1 && tickets.length > 0) {
            const tutTicket = new Ticket(1);
            const tutBag = new Bag();
            tutBag.addBurger({ base: 'Burger', bun: 'plain_bun', modifications: ['beef_patty'] });
            // tutBag.addBurger({ base: 'Burger', bun: 'plain_bun', modifications: ['beef_patty'] });
            tutBag.addItem('fries');
            tutBag.addItem('cola');
            tutBag.payout = this.calculateBagPayout(tutBag);
            tutTicket.addBag(tutBag);

            tickets[0] = tutTicket;
        }

        // 4. Shuffle Ticket Queue
        for (let j = tickets.length - 1; j > 0; j--) {
            // Day 1: Don't shuffle the first ticket (index 0) so our tutorial order stays first
            if (dayNumber === 1 && j === 0) continue;

            const k = Math.floor(Math.random() * (j + 1));
            // Day 1: Lock index 0
            if (dayNumber === 1 && k === 0) continue;

            [tickets[j], tickets[k]] = [tickets[k], tickets[j]]; // Swap
        }

        // Re-assign IDs after shuffle for clean UI ordering? 
        // Or keep internal IDs random? Let's re-assign for neatness if IDs are just labels.
        tickets.forEach((t, idx) => t.id = idx + 1);

        // 5. Calculate Par Times and Day Arc
        let totalParTime = 0;
        tickets.forEach(ticket => {
            ticket.calculateParTime();
            totalParTime += ticket.parTime;
        });

        const prepTime = 30; // 30s prep
        const dayLength = totalParTime; // The "Day Arc"

        console.log(`Day Arc: ${dayLength}s, Total Tickets: ${tickets.length}`);

        // 6. Sequential Arrival with Buffer
        // "Orders come in too fast. After every ticket prints, check it's par time.
        // Wait an additional 50% of the tickets par time before printing the next ticket."
        let currentArrivalTime = prepTime;

        tickets.forEach((ticket) => {
            ticket.arrivalTime = currentArrivalTime;
            // Spacing = Par Time + 50% Buffer
            currentArrivalTime += (ticket.parTime * 1.5);
        });

        return tickets;
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

    createTicketFromCustomers(customerGroup, id) {
        const ticket = new Ticket(id);
        const bag = new Bag(); // One Bag Rule

        customerGroup.forEach(cust => {
            // Add Burger
            if (cust.burger) {
                bag.addBurger(cust.burger);
            }
            // Add Items
            cust.items.forEach(itm => bag.addItem(itm));
        });

        // Calculate Dynamic Payout
        bag.payout = this.calculateBagPayout(bag);

        ticket.addBag(bag);
        return ticket;
    }

    calculateBagPayout(bag) {
        let total = 0;

        // Burgers
        bag.burgers.forEach(burger => {
            total += this.calculateBurgerPrice(burger);
        });

        // Items
        bag.items.forEach(itemId => {
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
        this.bags = [];
        this.parTime = 0;
        this.elapsedTime = 0;
    }

    calculateParTime() {
        let totalTime = 0;
        const TIMES = SCORING_CONFIG.PAR_TIMES;

        this.bags.forEach(bag => {
            // Burgers
            bag.burgers.forEach(burger => {
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
            bag.items.forEach(itemId => {
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

    addBag(bag) {
        this.bags.push(bag);
    }

    // Convert to format expected by Renderer
    toDisplayFormat() {
        const lines = [];
        this.bags.forEach((bag, index) => {
            // Assuming 1 bag per ticket now, but looping safely
            // const prefix = bag.completed ? '[DONE] ' : ''; 
            // Actually, we usually display the Ticket contents.
            const prefix = '';

            // Render Burgers
            bag.burgers.forEach((burger, bIdx) => {
                const displayName = (burger.base && burger.base !== 'Burger') ? `${burger.base} Burger` : `Burger ${bIdx + 1}`;
                lines.push(`${prefix}${displayName}`);
                burger.modifications.forEach(mod => {
                    lines.push(`${prefix}  + ${mod}`);
                });
            });

            // Generic Items
            bag.items.forEach(itemId => {
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
        return this.bags.every(b => b.completed);
    }

    // Returns true if the submitted bag matches a pending bag requirement
    verifyBag(submittedBagItem) {
        // Iterate through incomplete bags to find a match
        const matchIndex = this.bags.findIndex(bag => !bag.completed && bag.matches(submittedBagItem));

        if (matchIndex !== -1) {
            const bag = this.bags[matchIndex];
            bag.completed = true;
            return {
                matched: true,
                payout: bag.payout || 50 // Default payout if missing
            };
        }

        return { matched: false, payout: 0 };
    }
}

export class Bag {
    constructor() {
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
        // 1. Analyze Contents of the submitted bag
        const contents = [...(itemInstance.state.contents || [])]; // Shallow copy for consumption

        // 2. Check Generic Requirements (Sides, Drinks)
        for (const reqId of this.items) {
            // Find match
            const matchIndex = contents.findIndex(i => {
                const defId = i.definitionId;
                // Aliases for legacy items
                if (reqId === 'fries' && (defId === 'fries' || defId === 'fry_bag')) return true;
                if (reqId === 'soda' && (defId === 'soda' || defId === 'drink_cup')) return true;
                // Default exact match
                return defId === reqId;
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

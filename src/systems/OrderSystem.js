import { ORDER_TEMPLATES } from '../data/orderTemplates.js';
import { SCORING_CONFIG } from '../data/scoringConfig.js';

export class OrderSystem {
    constructor() {
        // Difficulty settings or state can go here
    }

    generateDailyOrders(dayNumber, playerCapabilities = []) {
        const orders = [];

        // 1. Calculate Day Parameters
        // Max Difficulty increases with days.
        const maxDifficulty = Math.min(5, Math.ceil(dayNumber / 3) + 1);

        // Ticket Count: Random number between 3 and 6
        const ticketCount = Math.floor(Math.random() * 4) + 3; // 3 to 6

        // Combo Chance increases with days
        const comboChance = Math.min(0.8, (dayNumber - 1) * 0.1);

        console.log(`Generating ${ticketCount} Tickets for Day ${dayNumber}. MaxDiff: ${maxDifficulty}`);

        // 2. Filter Valid Templates
        let validTemplates = ORDER_TEMPLATES.filter(template => {
            // A. Check Capability Requirement (Strict Subset)
            const hasCaps = template.requiresCapabilities.every(cap => playerCapabilities.includes(cap));

            // B. Check Difficulty Constraint
            const diffValid = template.difficulty <= maxDifficulty;

            return hasCaps && diffValid;
        });

        if (validTemplates.length === 0) {
            console.warn("No valid order templates found! Relaxing difficulty constraint as fallback.");
            // Soft failure: Ignore difficulty, check capabilities only
            validTemplates = ORDER_TEMPLATES.filter(template =>
                template.requiresCapabilities.every(cap => playerCapabilities.includes(cap))
            );

            if (validTemplates.length === 0) {
                console.error("CRITICAL: Player has NO valid capabilities to fulfill ANY orders.");
                return orders;
            }
        }

        // 3. Split into Singles vs Combos (Multi-item)
        const singleItemTemplates = validTemplates.filter(t => t.components.length === 1);
        const comboTemplates = validTemplates.filter(t => t.components.length > 1);

        // 4. Generate Tickets
        for (let i = 0; i < ticketCount; i++) {
            const ticket = new Ticket(i + 1); // ID starts at 1
            let selectedTemplate = null;

            // Roll for Random Template
            if (Math.random() < comboChance && comboTemplates.length > 0) {
                selectedTemplate = comboTemplates[Math.floor(Math.random() * comboTemplates.length)];
            } else {
                if (singleItemTemplates.length > 0) {
                    selectedTemplate = singleItemTemplates[Math.floor(Math.random() * singleItemTemplates.length)];
                } else if (comboTemplates.length > 0) {
                    selectedTemplate = comboTemplates[Math.floor(Math.random() * comboTemplates.length)];
                }
            }

            if (!selectedTemplate) {
                selectedTemplate = validTemplates[Math.floor(Math.random() * validTemplates.length)];
            }

            // Create ONE bag (order) per ticket for now, as per standard ticket flow
            // If we want "large orders" we could add multiple bags to a ticket, 
            // but usually 1 ticket = 1 unified order in this style.
            const bag = this.createBagFromTemplate(selectedTemplate);
            ticket.addBag(bag);

            // Calculate Par Time for this individual ticket
            ticket.calculateParTime();

            orders.push(ticket);
        }

        return orders;
    }

    createBagFromTemplate(template) {
        const bag = new Bag();

        template.components.forEach(comp => {
            if (comp.type === 'burger') {
                bag.setBurger({
                    base: 'Burger',
                    modifications: [...comp.mods] // Clone array
                });
            } else if (comp.type === 'fries') {
                bag.setFries(true);
            } else if (comp.type === 'soda') {
                bag.setSoda(true);
            }
        });

        // Store template ID for reference/scoring if needed
        bag.templateId = template.id;
        bag.payout = template.payout;

        return bag;
    }

    // Removed generateBag and generateBurger (procedural logic replaced by templates)
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
            // Burger
            if (bag.burger) {
                totalTime += TIMES.burger;
                if (bag.burger.modifications) {
                    bag.burger.modifications.forEach(mod => {
                        if (mod === 'tomato') totalTime += TIMES.topping_tomato;
                        if (mod === 'mayo') totalTime += TIMES.sauce;
                    });
                }
            }
            // Fries
            if (bag.fries) {
                totalTime += TIMES.fries;
            }
            // Soda
            if (bag.soda) {
                totalTime += TIMES.soda;
            }
        });

        this.parTime = totalTime;
        console.log(`Ticket #${this.id} Par Time: ${this.parTime}s`);
    }

    addBag(bag) {
        this.bags.push(bag);
    }

    // Convert to format expected by Renderer
    toDisplayFormat() {
        const lines = [];
        this.bags.forEach((bag, index) => {
            const prefix = bag.completed ? '[DONE] ' : '';
            lines.push(`${prefix}BAG ${index + 1}`);

            if (bag.burger) {
                lines.push(`${prefix}Burger`);
                bag.burger.modifications.forEach(mod => {
                    lines.push(`${prefix}  - add ${mod}`);
                });
            }

            if (bag.fries) {
                lines.push(`${prefix}Fries`);
            }

            if (bag.soda) {
                lines.push(`${prefix}Soda`);
            }

            // Add empty line between bags if not the last one
            if (index < this.bags.length - 1) {
                lines.push('');
            }
        });

        return {
            id: this.id,
            items: lines
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
        this.burger = null;
        this.fries = false;
        this.soda = false;
        this.completed = false;
        this.payout = 0;
    }

    setBurger(burgerConfig) {
        this.burger = burgerConfig;
    }

    setFries(hasFries) {
        this.fries = hasFries;
    }

    setSoda(hasSoda) {
        this.soda = hasSoda;
    }

    matches(itemInstance) {
        // 1. Analyze Contents of the submitted bag
        const contents = itemInstance.state.contents || [];

        // Find Burger
        const burgerItem = contents.find(i => i.definitionId.includes('burger'));
        // Find Fries
        const friesItem = contents.find(i => i.definitionId === 'fries' || i.definitionId === 'fry_bag');
        // Find Soda
        const sodaItem = contents.find(i => i.definitionId === 'soda' || i.definitionId === 'drink_cup'); // Assuming soda maps to soda or drink_cup with soda?

        // 2. Check Requirement: Fries
        if (this.fries) {
            if (!friesItem) return false;
        } else {
            // Strict? If we didn't ask for fries but got them, is it wrong? 
            // Usually yes for specific orders.
            if (friesItem) return false;
        }

        // 3. Check Requirement: Soda
        if (this.soda) {
            if (!sodaItem) return false;
            // TODO: Check if soda is full?
        } else {
            if (sodaItem) return false;
        }

        // 4. Check Requirement: Burger
        if (this.burger) {
            if (!burgerItem) return false;

            // Check Modifications
            const mods = this.burger.modifications;
            const hasMayo = mods.includes('mayo');
            const hasTomato = mods.includes('tomato');

            // Construct expected ID based on logic
            // plain_burger
            // burger_tomato
            // burger_mayo
            // burger_tomato_mayo

            let expectedId = 'plain_burger';
            if (hasTomato && hasMayo) expectedId = 'burger_tomato_mayo';
            else if (hasTomato) expectedId = 'burger_tomato';
            else if (hasMayo) expectedId = 'burger_mayo';

            // Allow 'burger' to match 'plain_burger'
            const actualId = burgerItem.definitionId === 'burger' ? 'plain_burger' : burgerItem.definitionId;

            if (actualId !== expectedId) return false;

        } else {
            if (burgerItem) return false;
        }

        return true;
    }
}

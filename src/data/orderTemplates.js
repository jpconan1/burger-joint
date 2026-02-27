import { CAPABILITY, DEFINITIONS } from './definitions.js';

export function getMenuForCapabilities(capabilities, allowedItems = null) {
    const { toppings, sides, drinks } = getOrderableItems();

    const menu = [];
    const isItemAllowed = (item) => {
        if (!capabilities.includes(item.capability)) return false;
        if (allowedItems && !allowedItems.includes(item.id)) return false;
        return true;
    };

    // Always Basic Burger
    if (capabilities.includes(CAPABILITY.BASIC_BURGER)) {
        menu.push("Burger");
    }

    // Toppings
    toppings.forEach(t => {
        if (isItemAllowed(t)) {
            const name = t.id.charAt(0).toUpperCase() + t.id.slice(1);
            menu.push(`+ ${name}`);
        }
    });

    // Sides
    sides.forEach(s => {
        if (isItemAllowed(s)) {
            const name = s.id.charAt(0).toUpperCase() + s.id.slice(1);
            menu.push(`Side: ${name}`);
        }
    });

    // Drinks - DISABLED
    /*
    drinks.forEach(d => {
        if (isItemAllowed(d)) {
            const name = d.id.charAt(0).toUpperCase() + d.id.slice(1);
            menu.push(`Drink: ${name}`);
        }
    });
    */

    return menu;
}

// Cache orderable items from definitions
const getOrderableItems = () => {
    const toppings = [];
    const sides = [];
    const drinks = [];

    Object.keys(DEFINITIONS).forEach(id => {
        const def = DEFINITIONS[id];
        if (def.orderConfig) {
            const item = { id: id, ...def.orderConfig };
            if (item.type === 'topping') toppings.push(item);
            else if (item.type === 'side') sides.push(item);
            else if (item.type === 'drink') drinks.push(item);
        }
    });
    return { toppings, sides, drinks };
};

/**
 * Generates a random meal configuration based on capabilities.
 * Rules:
 * - Always 1 burger (with random possible mods)
 * - 50% chance for Side (if capable)
 * - 75% chance for Drink (if capable)
 */
export function generateMealConfig(capabilities, allowedItems = null) {
    const { toppings, sides, drinks } = getOrderableItems();

    const isItemAllowed = (item) => {
        if (!capabilities.includes(item.capability)) return false;
        if (allowedItems && !allowedItems.includes(item.id)) return false;
        return true;
    };

    // 1. Generate Burger
    const burgerMods = [];
    toppings.forEach(mod => {
        if (isItemAllowed(mod)) {
            // 50% chance to include this mod if we can
            if (Math.random() < 0.5) {
                burgerMods.push(mod.id);
            }
        }
    });

    const components = [
        { type: 'burger', mods: burgerMods }
    ];
    let payout = 12.00 + burgerMods.reduce((sum, modId) => {
        const mod = toppings.find(m => m.id === modId);
        return sum + (mod ? mod.value : 0);
    }, 0);

    // 2. Side (50% chance)
    const validSides = sides.filter(s => isItemAllowed(s));
    if (Math.random() < 0.5 && validSides.length > 0) {
        // Pick one random side
        const side = validSides[Math.floor(Math.random() * validSides.length)];
        components.push({ type: side.id });
        payout += side.value;
    }

    // 3. Drink (75% chance) - DISABLED
    const validDrinks = drinks.filter(d => isItemAllowed(d));
    /*
    if (Math.random() < 0.75 && validDrinks.length > 0) {
        const drink = validDrinks[Math.floor(Math.random() * validDrinks.length)];
        components.push({ type: drink.id });
        payout += drink.value;
    }
    */

    return {
        components,
        payout,
        difficulty: 1 + burgerMods.length + (components.length - 1)
    };
}

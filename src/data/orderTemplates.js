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

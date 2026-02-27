/**
 * CHUTE_TRIGGERS
 * 
 * This file defines the behavior of the delivery chute.
 * You can add new triggers here to make items fall during specific game events.
 * 
 * Format:
 * {
 *   id: 'trigger_name',
 *   condition: (game, data) => boolean, // Optional: fine-tuned check
 *   getItems: (game, data) => [{ id: 'item_id', qty: 1 }] // What should fall
 * }
 */

export const CHUTE_TRIGGERS = [
    {
        id: 'START_DAY',
        description: 'Drops all items ordered during the night',
        getItems: (game) => {
            if (!game.pendingOrders) return [];
            // Map pending orders to chute delivery format
            const items = game.pendingOrders.map(order => ({
                id: order.id,
                qty: order.qty || 1
            }));
            // Clear pending orders after processing
            game.pendingOrders = [];
            return items;
        }
    },
    {
        id: 'REWARD_CLAIMED',
        description: 'Drops a reward box immediately when claimed in Post-Day',
        getItems: (game, data) => {
            // data is expected to be { itemDef }
            if (!data || !data.itemDef) return [];
            return [{ id: data.itemDef.id, qty: 1 }];
        }
    },
    {
        id: 'EMERGENCY_SUPPLY',
        description: 'Cheat/Debug trigger or low-stock safety',
        condition: (game) => game.money > 100 && game.dayNumber === 1,
        getItems: () => [{ id: 'bun_box', qty: 1 }]
    }
];

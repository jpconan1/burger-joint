import { ItemInstance } from '../../entities/Item.js';
import { _tryCombine, _addIngredientToBurger, _canContainerHoldItem } from './CombineUtils.js';
import { DEFINITIONS } from '../../data/definitions.js';

// --- SAUCE BOTTLE ---
export const sauce_bottle_interact = (player, target) => {
    if (!player.heldItem) return false;

    const sauceId = target.definition?.produces;
    if (!sauceId) return false;

    const held = player.heldItem;
    const isBurger = held.category === 'burger' || held.definitionId.includes('burger');
    const isBun = held.category === 'bun';
    if (!isBurger && !isBun) return false;

    let newBurger;
    if (isBun) {
        newBurger = new ItemInstance('plain_burger');
        newBurger.state.bun = held;
        newBurger.state.toppings = [];
    } else {
        newBurger = held.clone();
    }

    const sauceItem = new ItemInstance(sauceId);
    _addIngredientToBurger(newBurger, sauceItem);
    player.heldItem = newBurger;
    return true;
};

// --- ITEM: LETTUCE HEAD ---
export const lettuce_interact = (player, head, cell) => {
    if (!head || head.definitionId !== 'lettuce_head') return false;

    const charges = head.state.charges !== undefined ? head.state.charges : 8;
    if (charges <= 0) return false;

    const held = player.heldItem;
    const isBurger = held && (held.category === 'burger' || held.category === 'bun' || held.definitionId.includes('burger'));

    if (isBurger) {
        const leaf = new ItemInstance('lettuce_leaf');
        const result = _tryCombine(held, leaf);
        if (result) {
            player.heldItem = result;
            head.state.charges = charges - 1;
            if (head.state.charges <= 0) cell.object = null;
            return true;
        }
    }

    // Stackable container (insert): deal one leaf into it
    const isInsert = held && held.definition?.useStackRender && !['plate', 'dirty_plate'].includes(held.definitionId);
    if (isInsert) {
        const leaf = new ItemInstance('lettuce_leaf');
        if (_canContainerHoldItem(held, leaf)) {
            if (!held.state.contents) held.state.contents = [];
            held.state.contents.push(leaf);
            head.state.charges = charges - 1;
            if (head.state.charges <= 0) cell.object = null;
            return true;
        }
    }

    if (!held) {
        const leaf = new ItemInstance('lettuce_leaf');
        player.heldItem = leaf;

        head.state.charges = charges - 1;
        if (head.state.charges <= 0) {
            cell.object = null;
        }
        return true;
    }

    return false;
};

// --- BURGER ---
export const burger_interact = (player, cell) => {
    const burger = cell.object;
    if (!burger) return false;
    const held = player.heldItem;

    // 1. Plating: holding plate(s) + target burger
    if (held && held.definitionId === 'plate') {
        if (_canContainerHoldItem(held, burger)) {
            if ((held.state.count || 1) > 1) {
                const plate = new ItemInstance('plate');
                plate.state.contents = [burger];
                cell.object = plate;
                held.state.count--;
                return true;
            } else {
                if (!held.state.contents) held.state.contents = [];
                held.state.contents.push(burger);
                cell.object = null;
                return true;
            }
        }
    }

    // 2. Unwrap if wrapped
    if (burger.state.isWrapped) {
        if (!held) {
            burger.state.isWrapped = false;
            player.heldItem = new ItemInstance('wrapper');
            return true;
        }
        return false;
    }

    // 3. Remove most recent non-sauce topping (Empty hands). Sauces are permanent.
    if (!held) {
        const toppings = burger.state.toppings || [];
        for (let i = toppings.length - 1; i >= 0; i--) {
            const t = toppings[i];
            const def = t.definition || DEFINITIONS[t.definitionId];
            if (def && def.category !== 'sauce') {
                player.heldItem = toppings.splice(i, 1)[0];
                return true;
            }
        }
    }

    return false;
};

// --- SIDE RESULT ITEMS (fries, sweet_potato_fries, etc.) ---
// Interact with empty hands: extract the cooked side_prep and leave an empty side_cup.
// Pickup key still picks up the whole item unchanged.
export const side_result_interact = (player, cell) => {
    if (player.heldItem) return false;
    const item = cell.object;
    if (!item || item.definition?.category !== 'side') return false;

    const sourceDef = Object.values(DEFINITIONS).find(
        d => d.category === 'side_prep' && d.result === item.definitionId
    );
    if (!sourceDef) return false;

    const cooked = new ItemInstance(sourceDef.id);
    cooked.state.cook_level = 'cooked';
    cell.object = new ItemInstance('side_cup');
    player.heldItem = cooked;
    return true;
};

const DIRTY_BOARD_IDS = new Set(['board_tomatoed', 'board_pickled']);

// --- DISH RACK ---
export const dish_rack_interact = (player, rack, cell) => {
    const held = player.heldItem;
    const contents = rack.state.contents || [];
    const boards = rack.state.boards || [];

    // Pick up a clean board when not holding anything
    if (!held) {
        const cleanEntry = boards.find(b => b.item.definitionId === 'board');
        if (cleanEntry) {
            player.heldItem = cleanEntry.item;
            rack.state.boards = boards.filter(b => b !== cleanEntry);
            return true;
        }
    }

    if (contents.length === 0) return false;

    const rackType = contents[0].definitionId;
    if (rackType !== 'plate') return false;

    if (held && held.definitionId === 'plate') {
        const plate = contents.pop();
        held.state.count = (held.state.count || 1) + 1;
        rack.state.contents = contents;
        return true;
    }

    if (!held) {
        const plate = contents.pop();
        player.heldItem = plate;
        rack.state.contents = contents;
        return true;
    }

    return false;
};

export const dish_rack_pickup = (player, rack, cell) => {
    const held = player.heldItem;
    const contents = rack.state.contents || [];

    if (held) {
        // Place a dirty board into the rack — it takes up a full row
        if (DIRTY_BOARD_IDS.has(held.definitionId)) {
            const boards = rack.state.boards || [];
            const row0HasBoard = boards.some(b => b.row === 0);
            const row1HasBoard = boards.some(b => b.row === 1);
            const row0HasPlates = contents.slice(0, 3).length > 0;
            const row1HasPlates = contents.slice(3, 6).length > 0;

            let targetRow = -1;
            if (!row0HasBoard && !row0HasPlates) targetRow = 0;
            else if (!row1HasBoard && !row1HasPlates) targetRow = 1;

            if (targetRow >= 0) {
                if (!rack.state.boards) rack.state.boards = [];
                rack.state.boards.push({ row: targetRow, item: held });
                player.heldItem = null;
            }
            return true;
        }

        if (held.definitionId === 'dirty_plate') {
            const boards = rack.state.boards || [];
            const row0HasBoard = boards.some(b => b.row === 0);
            const row1HasBoard = boards.some(b => b.row === 1);
            // Plates go into slots 0-2 (row 0) or 3-5 (row 1), skipping rows occupied by boards
            const availableSlots = [
                ...(row0HasBoard ? [] : [0, 1, 2]),
                ...(row1HasBoard ? [] : [3, 4, 5]),
            ];
            const usedSlots = contents.length;
            if (usedSlots >= availableSlots.length) return true;

            if (contents.length > 0 && contents[0].definitionId !== 'dirty_plate') {
                return true;
            }

            if (held.state.count && held.state.count > 1) {
                const singlePlate = new ItemInstance('dirty_plate');
                contents.push(singlePlate);
                held.state.count--;
            } else {
                contents.push(held);
                player.heldItem = null;
            }

            rack.state.contents = contents;
            return true;
        }
        return true;
    }

    player.heldItem = rack;
    cell.object = null;
    return true;
};

import { ItemInstance } from '../../entities/Item.js';
import { ItemType, DEFINITIONS } from '../../data/definitions.js';
import {
    _tryCombine,
    _isStackableContainer,
    _getPossibleDispensedItem,
    _canContainerHoldItem,
    _canContainerDispenseTo,
    _applyIngredientToHeld,
} from './CombineUtils.js';

// --- GENERIC CONTAINER: DEAL (Dispense from held container) ---
export const handle_container_deal = (player, cell) => {
    const held = player.heldItem;
    if (!held) return false;

    // 1. Box Logic: Delay instantiation
    if (held.type === ItemType.Box) {
        if (held.state.count > 0 && held.definition.produces) {
            const prodId = held.definition.produces;

            if (!cell.object) {
                if (cell.type.holdsItems) {
                    cell.object = new ItemInstance(prodId);
                    held.state.isOpen = true;
                    return true;
                }
            } else {
                const realItem = new ItemInstance(prodId);
                const result = _tryCombine(realItem, cell.object);
                if (result) {
                    cell.object = result;
                    held.state.isOpen = true;
                    return true;
                }
            }
        }
        return false;
    }

    let itemToDispense = null;
    let consumeAction = null;

    // 2. Stacked Container (Single OR Stacked, with items)
    if (held.definition && held.definition.useStackRender) {
        // Plates never deal their contents here — stacked_container_interact owns that path.
        // Without this guard, a plate+burger targeting a plate stack would jam the burger in.
        if ((held.definitionId === 'plate' || held.definitionId === 'dirty_plate') &&
            (held.state.contents || []).length > 0) {
            return false;
        }

        // Priority 1: Dispense ingredient from inside the container
        if (held.state.contents?.length > 0) {
            itemToDispense = held.state.contents[held.state.contents.length - 1];
            consumeAction = () => {
                held.state.contents.pop();
            };
        }
        // Priority 2: Dispense the container itself if holding a stack or empty
        else if ((held.state.count || 1) >= 1) {
            itemToDispense = new ItemInstance(held.definitionId);
            consumeAction = () => {
                if ((held.state.count || 1) > 1) {
                    held.state.count--;
                } else {
                    player.heldItem = null;
                }
            };
        }
    }
    // 3. Bag
    else if (held.definitionId === 'bag' || held.definitionId === 'magic_bag') {
        if (held.state.contents?.length > 0) {
            itemToDispense = held.state.contents[held.state.contents.length - 1];
            consumeAction = () => {
                held.state.contents.pop();
            };
        }
    }
    // 4. Lettuce Head (Dispense Leaf)
    else if (held.definitionId === 'lettuce_head') {
        const charges = held.state.charges !== undefined ? held.state.charges : 8;
        if (charges > 0) {
            itemToDispense = new ItemInstance('lettuce_leaf');
            consumeAction = () => {
                held.state.charges = charges - 1;
                if (held.state.charges <= 0) {
                    player.heldItem = null;
                }
            };
        }
    }
    if (!itemToDispense) return false;

    // Apply to Cell
    if (!cell.object) {
        // Special Case: FRYER
        if (cell.type.id === 'FRYER') {
            const def = itemToDispense.definition || DEFINITIONS[itemToDispense.definitionId];
            if (def && def.cooking) {
                const stage = (itemToDispense.state && itemToDispense.state.cook_level) || 'raw';
                const stageDef = def.cooking.stages[stage];
                if (stageDef && stageDef.cookMethod === 'fry') {
                    cell.object = itemToDispense;
                    cell.state.status = 'down';
                    cell.state.timer = 0;
                    consumeAction();
                    return true;
                }
            }
            return false;
        }

        if (cell.type.holdsItems) {
            cell.object = itemToDispense;
            consumeAction();
            return true;
        }
    } else {
        const result = _tryCombine(itemToDispense, cell.object);
        if (result) {
            cell.object = result;
            consumeAction();
            return true;
        }
    }

    return false;
};

// --- GENERIC CONTAINER: COLLECT (Suck Up) ---
export const handle_container_collect = (player, cell) => {
    const held = player.heldItem;
    if (!held) return false;

    const target = cell.object;
    if (!target) return false;

    // 1. BAG: Suck up items (Orders)
    if (held.definitionId === 'bag' || held.definitionId === 'magic_bag') {
        if (target.type === ItemType.Box) return false;

        const def = target.definition;
        let tag = null;
        if (def.category === 'burger' || target.definitionId.includes('burger')) {
            if (target.state.isWrapped) tag = 'burger';
        } else {
            const type = (def.orderConfig && def.orderConfig.type) || def.category;
            if (type === 'side' || type === 'drink') tag = type;
        }

        if (tag) {
            if (!held.state.contents) held.state.contents = [];
            if (held.state.contents.length < 50) {
                held.state.contents.push(target);
                cell.object = null;
                return true;
            }
        }
    }

    // 2. STACKED CONTAINER: Suck up ingredients
    if (held.definition.useStackRender) {
        if ((held.state.count || 1) > 1) return false;

        let itemToTake = null;
        let updateSource = null;

        if (held.definitionId === 'plate') {
            const def = target.definition || {};
            const isUnwrappedBurger = (def.category === 'burger' || target.definitionId.includes('burger')) && !target.state.isWrapped;
            const isCookedSide = (def.category === 'side' || (def.category === 'side_prep' && target.state.cook_level === 'cooked'));

            if (isUnwrappedBurger || isCookedSide) {
                if (!held.state.contents) held.state.contents = [];
                const hasBurger = held.state.contents.some(c => (c.definition.category === 'burger' || c.definitionId.includes('burger')));
                const hasSide = held.state.contents.some(c => c.definition.category === 'side' || c.definition.category === 'side_prep');

                if ((isUnwrappedBurger && !hasBurger) || (isCookedSide && !hasSide)) {
                    held.state.contents.push(target);
                    cell.object = null;
                    return true;
                }
            }
            return false;
        }

        if (held.definitionId === 'dirty_plate') return false;

        if (target instanceof ItemInstance || target.type === undefined) {
            const def = target.definition || {};
            const isCookedBacon = target.definitionId === 'bacon' && target.state.cook_level === 'cooked';
            const isSide = def.category === 'side' || def.category === 'side_prep';
            if (def.isSlice || def.category === 'topping' || def.category === 'patty' || isCookedBacon || isSide) {
                itemToTake = target;
                updateSource = () => { cell.object = null; };
            }
        } else if (target.type === ItemType.Box) {
            if (target.state.count > 0) {
                const prodId = target.definition.produces;
                const tempItem = new ItemInstance(prodId);
                const def = tempItem.definition;
                const isCookedBacon = tempItem.definitionId === 'bacon' && tempItem.state.cook_level === 'cooked';
                const isSide = def.category === 'side' || def.category === 'side_prep';

                if (def.isSlice || def.category === 'topping' || def.category === 'patty' || isCookedBacon || isSide) {
                    itemToTake = tempItem;
                    updateSource = () => {
                        target.state.isOpen = true;
                    };
                }
            }
        }

        if (itemToTake) {
            if (!held.state.contents) held.state.contents = [];
            if (held.state.contents.length >= 50) return false;
            if (held.state.contents.length > 0 && held.state.contents[0].definitionId !== itemToTake.definitionId) return false;

            updateSource();
            held.state.contents.push(itemToTake);
            return true;
        }
    }

    // 3. BURGER/BUN/WRAPPER: Suck up ingredients/content
    const isHeldBase = held.category === 'burger' || held.category === 'bun' || held.definitionId.includes('burger');
    const isHeldWrapper = held.definitionId === 'wrapper';

    if (isHeldBase || isHeldWrapper) {
        // Don't consume burger into a plate stack — stacked_container_interact
        // handles it correctly by taking one plate from the stack.
        if (target.definitionId === 'plate' && (target.state?.count || 1) > 1) return false;

        const result = _tryCombine(held, target);
        if (result) {
            player.heldItem = result;
            cell.object = null;
            return true;
        }
    }

    return false;
};

// --- PICK UP INTO HELD STACKED CONTAINER (Insert/Plate) ---
export const handle_stacked_container_pickup = (player, cell) => {
    const container = player.heldItem;
    if (!_isStackableContainer(container)) return false;

    const target = cell.object;
    if (!target) return false;

    if ((container.state.count || 1) > 1) {
        const potentialItem = _getPossibleDispensedItem(target, false);
        if (potentialItem && _canContainerHoldItem(container, potentialItem)) {
            const newContainer = new ItemInstance(container.definitionId);
            const realItem = _getPossibleDispensedItem(target, true);
            newContainer.state.contents = [realItem];
            cell.object = newContainer;
            container.state.count--;
            if (target.type === ItemType.Box) target.state.isOpen = true;
            return true;
        }
        return false;
    }

    const potentialItem = _getPossibleDispensedItem(target, false);
    if (potentialItem && _canContainerHoldItem(container, potentialItem)) {
        const itemToTake = _getPossibleDispensedItem(target, true);
        if (!container.state.contents) container.state.contents = [];
        container.state.contents.push(itemToTake);
        if (target.type === ItemType.Box) {
            target.state.isOpen = true;
        } else {
            cell.object = null;
        }
        return true;
    }

    return false;
};

// --- ITEM: STACKED CONTAINER (Insert, Plate, etc.) ---
export const stacked_container_interact = (player, target, cell) => {
    const contents = target.state.contents || [];
    const count = target.state.count || 1;
    const held = player.heldItem;

    // 0. Rule: Holding topping/patty + single plate with burger → apply topping to burger inside
    if (held && !held.definition?.useStackRender && target.definitionId === 'plate' && count === 1) {
        const burgerIdx = contents.findIndex(c => c.category === 'burger' || c.definitionId.includes('burger'));
        if (burgerIdx >= 0 && !contents[burgerIdx].state.isWrapped) {
            const newBurger = _tryCombine(held, contents[burgerIdx]);
            if (newBurger) {
                contents[burgerIdx] = newBurger;
                target.state.contents = contents;
                player.heldItem = null;
                return true;
            }
        }
    }

    // 1. Rule: Targeted stack on counter + held item
    if (held) {
        if (count > 1 && _canContainerHoldItem(target, held)) {
            const newContainer = new ItemInstance(target.definitionId);
            target.state.count--;
            if (target.state.count <= 0) cell.object = null;
            newContainer.state.contents = [held];
            player.heldItem = newContainer;
            return true;
        }
        if (count === 1 && _canContainerHoldItem(target, held)) {
            if (!target.state.contents) target.state.contents = [];
            target.state.contents.push(held);
            player.heldItem = null;
            return true;
        }

        // 1b. Rule: Both are containers - transfer contents
        if (count === 1 && held.definition && held.definition.useStackRender) {
            // Plate + plate: bidirectional transfer.
            // Priority 1 — collect from counter into held plate (so you can combine two plated items).
            // Priority 2 — deposit from held plate onto counter plate (when counter is empty or P1 failed).
            // Always absorb the interact so we never fall through to pickup.
            if (held.definitionId === 'plate' && target.definitionId === 'plate') {
                const targetContents = target.state.contents || [];
                const heldContents = held.state.contents || [];

                if (targetContents.length > 0) {
                    const item = targetContents[targetContents.length - 1];
                    if (_canContainerHoldItem(held, item)) {
                        if (!held.state.contents) held.state.contents = [];
                        held.state.contents.push(targetContents.pop());
                        return true;
                    }
                }

                if (heldContents.length > 0) {
                    const item = heldContents[heldContents.length - 1];
                    if (_canContainerHoldItem(target, item)) {
                        if (!target.state.contents) target.state.contents = [];
                        target.state.contents.push(heldContents.pop());
                        return true;
                    }
                }

                return true; // absorb — no valid transfer but don't fall through to pickup
            }

            // Non-plate containers: transfer held contents → target
            const heldContents = held.state.contents || [];
            if (heldContents.length > 0) {
                const lastItem = heldContents[heldContents.length - 1];
                if (_canContainerHoldItem(target, lastItem)) {
                    if (!target.state.contents) target.state.contents = [];
                    target.state.contents.push(heldContents.pop());
                    return true;
                }
            }
        }
    }

    // 2. Rule: Targeted container with contents
    if (contents.length > 0) {
        if (_canContainerDispenseTo(target, held)) {
            const slice = contents.pop();
            player.heldItem = _applyIngredientToHeld(held, slice);
            return true;
        }
        if (!held) {
            player.heldItem = contents.pop();
            return true;
        }
    }

    // 3. Rule: Targeted empty stack/container + empty hands
    if (!held) {
        if (count > 1) {
            const one = new ItemInstance(target.definitionId);
            target.state.count--;
            if (target.state.count <= 0) cell.object = null;
            player.heldItem = one;
            return true;
        } else {
            player.heldItem = target;
            cell.object = null;
            return true;
        }
    }

    return false;
};

export const stacked_container_pickup = (player, target, cell) => {
    const held = player.heldItem;
    const container = target;

    if (held) {
        const count = container.state.count || 1;

        // Rule 0: Holding topping/patty + single plate with burger → apply topping to burger inside
        if (!held.definition?.useStackRender && container.definitionId === 'plate' && count === 1) {
            const contents = container.state.contents || [];
            const burgerIdx = contents.findIndex(c => c.category === 'burger' || c.definitionId.includes('burger'));
            if (burgerIdx >= 0 && !contents[burgerIdx].state.isWrapped) {
                const newBurger = _tryCombine(held, contents[burgerIdx]);
                if (newBurger) {
                    contents[burgerIdx] = newBurger;
                    container.state.contents = contents;
                    player.heldItem = null;
                    return true;
                }
            }
        }

        if (count > 1) {
            if (_canContainerHoldItem(container, held)) {
                const newContainer = new ItemInstance(container.definitionId);
                container.state.count--;
                if (container.state.count <= 0) cell.object = null;
                newContainer.state.contents = [held];
                player.heldItem = newContainer;
                return true;
            }
            return false;
        }

        if (_canContainerHoldItem(container, held)) {
            if (!container.state.contents) container.state.contents = [];
            container.state.contents.push(held);
            player.heldItem = null;
            return true;
        }

        const contents = container.state.contents || [];
        if (contents.length > 0) {
            if (_canContainerDispenseTo(container, held)) {
                const slice = contents.pop();
                player.heldItem = _applyIngredientToHeld(held, slice);
                return true;
            }
        }

        // Generic Stacking: combine identical empty stacks
        if (held.definitionId === container.definitionId) {
            const heldContents = held.state.contents || [];
            const targetContents = container.state.contents || [];
            if (heldContents.length === 0 && targetContents.length === 0) {
                container.state.count = (container.state.count || 1) + (held.state.count || 1);
                player.heldItem = null;
                return true;
            }
        }
        return false;
    } else {
        player.heldItem = container;
        cell.object = null;
        return true;
    }
};

// --- ITEM: BAG ---
export const bag_interact = (player, bag, cell) => {
    if (!bag || bag.definitionId !== 'bag') return false;

    if (player.heldItem) return false;

    const contents = bag.state.contents;
    if (contents && contents.length > 0) {
        const item = contents.pop();
        player.heldItem = item;
        return true;
    }

    return false;
};

// --- BOX ---
export const box_interact = (player, cell) => {
    const box = cell.object;
    if (!box || box.type !== ItemType.Box) return false;

    if (player.heldItem) return false;

    box.state.isOpen = true;

    if (box.state.count > 0) {
        const prodId = box.definition.produces;
        if (prodId) {
            const newItem = new ItemInstance(prodId);
            player.heldItem = newItem;
            return true;
        }
    }

    return true;
};

export const handle_box_put_back = (box, item) => {
    const boxDef = box.definition;
    const targetId = boxDef.produces;

    if (item.definitionId !== targetId) return false;

    const freshItem = new ItemInstance(targetId);

    if (freshItem.state.cook_level !== item.state.cook_level) return false;

    if (freshItem.state.charges !== undefined) {
        if (item.state.charges !== freshItem.state.charges) return false;
    }

    if (item.state.contents && item.state.contents.length > 0) return false;

    if (box.state.count !== undefined) box.state.count++;
    box.state.isOpen = true;
    return true;
};

export const handle_box_combine = (player, box) => {
    if (box.state.count <= 0) return false;
    const productId = box.definition.produces;
    if (!productId) return false;

    const tempItem = new ItemInstance(productId);
    const result = _tryCombine(player.heldItem, tempItem);
    if (result) {
        box.state.isOpen = true;
        player.heldItem = result;
        return true;
    }
    return false;
};

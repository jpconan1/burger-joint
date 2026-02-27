import { ItemInstance } from '../entities/Item.js';
import { ItemType, DEFINITIONS } from '../data/definitions.js';
import { TILE_TYPES, ASSETS } from '../constants.js';

export const InteractionHandlers = {

    // --- GENERIC CONTAINER ---
    handle_container_deal: (player, cell) => {
        const held = player.heldItem;
        if (!held) return false;

        let itemToDispense = null;
        let consumeAction = null;

        // 1. Box
        if (held.type === ItemType.Box) {
            if (held.state.count > 0 && held.definition.produces) {
                itemToDispense = new ItemInstance(held.definition.produces);
                consumeAction = () => {
                    // held.state.count--; // UNLIMITED BOXES
                    held.state.isOpen = true;
                };
            }
        }
        // 2. Stacked Container (Single OR Stacked, with items)
        else if (held.definition.useStackRender) {
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
                        player.heldItem = null; // Used up
                    }
                };
            }
        }

        if (!itemToDispense) return false;

        // Apply to Cell
        if (!cell.object) {
            // Special Case: FRYER
            // Fryers need specific state initialization (status='down', timer=0)
            if (cell.type.id === 'FRYER') {
                // Check if item is fryable
                const def = itemToDispense.definition;
                if (def.cooking) {
                    const stage = itemToDispense.state.cook_level || 'raw';
                    const stageDef = def.cooking.stages[stage];
                    if (stageDef && stageDef.cookMethod === 'fry') {
                        cell.object = itemToDispense;
                        cell.state.status = 'down';
                        cell.state.timer = 0;
                        consumeAction();
                        return true;
                    }
                }
                // Handle Fry Bag content (e.g. from Box of Fries -> raw_fries -> Fryer)
                // Note: Box of Fries makes 'raw_fries', which is fryable.
                return false;
            }

            if (cell.type.holdsItems) {
                cell.object = itemToDispense;
                consumeAction();
                return true;
            }
        } else {
            // Combine with existing item
            const result = InteractionHandlers._tryCombine(itemToDispense, cell.object);
            if (result) {
                cell.object = result;
                consumeAction();
                return true;
            }
        }

        return false;
    },

    // --- GENERIC CONTAINER: COLLECT (Suck Up) ---
    // Actions where the Held Item "absorbs" the Target Item
    handle_container_collect: (player, cell) => {
        const held = player.heldItem;
        if (!held) return false;

        const target = cell.object;
        if (!target) return false;

        // 1. BAG: Suck up items (Orders)
        if (held.definitionId === 'bag' || held.definitionId === 'magic_bag') {
            // Skip if target is a box (don't suck up boxes?)
            if (target.type === ItemType.Box) return false;

            // Validation similar to _tryCombine
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
                    cell.object = null; // Remove from world
                    return true;
                }
            }
        }

        // 2. STACKED CONTAINER: Suck up ingredients
        if (held.definition.useStackRender) {
            // Block if stack of inserts
            if ((held.state.count || 1) > 1) return false;

            // Re-using logic from stacked_container_pickup
            let itemToTake = null;
            let updateSource = null;

            // Plate Logic: Specific items only (One Burger, One Side max)
            if (held.definitionId === 'plate') {
                const def = target.definition || {};
                const isUnwrappedBurger = (def.category === 'burger' || target.definitionId.includes('burger')) && !target.state.isWrapped;
                const isCookedSide = (def.category === 'side' || (def.category === 'side_prep' && target.state.cook_level === 'cooked'));

                if (isUnwrappedBurger || isCookedSide) {
                    if (!held.state.contents) held.state.contents = [];
                    // Check if already has one of this type
                    const hasBurger = held.state.contents.some(c => (c.definition.category === 'burger' || c.definitionId.includes('burger')));
                    const hasSide = held.state.contents.some(c => c.definition.category === 'side' || c.definition.category === 'side_prep');

                    if ((isUnwrappedBurger && !hasBurger) || (isCookedSide && !hasSide)) {
                        held.state.contents.push(target);
                        cell.object = null;
                        return true;
                    }
                }
                return false; // Plate doesn't accept other things or already full
            }

            // Simple Item (Standard Insert logic)
            if (held.definitionId === 'dirty_plate') return false;

            if (target instanceof ItemInstance || target.type === undefined) {
                const def = target.definition || {};
                const isCookedBacon = target.definitionId === 'bacon' && target.state.cook_level === 'cooked';
                if (def.isSlice || def.category === 'topping' || def.category === 'patty' || isCookedBacon) {
                    itemToTake = target;
                    updateSource = () => { cell.object = null; };
                }
            } else if (target.type === ItemType.Box) {
                if (target.state.count > 0) {
                    const prodId = target.definition.produces;
                    const tempItem = new ItemInstance(prodId);
                    const def = tempItem.definition;
                    const isCookedBacon = tempItem.definitionId === 'bacon' && tempItem.state.cook_level === 'cooked';

                    if (def.isSlice || def.category === 'topping' || def.category === 'patty' || isCookedBacon) {
                        itemToTake = tempItem;
                        updateSource = () => {
                            // target.state.count--; // UNLIMITED BOXES
                            target.state.isOpen = true; // Visual feedback
                        };
                    }
                }
            }

            if (itemToTake) {
                if (!held.state.contents) held.state.contents = [];
                if (held.state.contents.length >= 50) return false;
                // Check mixing
                if (held.state.contents.length > 0 && held.state.contents[0].definitionId !== itemToTake.definitionId) return false;

                updateSource();
                held.state.contents.push(itemToTake);
                return true;
            }
        }

        // 3. BURGER/BUN/WRAPPER: Suck up ingredients/content
        // "Suck up" makes sense if we are holding the "Container/Base"
        const isHeldBase = held.category === 'burger' || held.category === 'bun' || held.definitionId.includes('burger');
        const isHeldWrapper = held.definitionId === 'wrapper';

        if (isHeldBase || isHeldWrapper) {
            // Attempt combine
            const result = InteractionHandlers._tryCombine(held, target);
            if (result) {
                player.heldItem = result; // Result stays in hand
                cell.object = null; // Target removed from table
                return true;
            }
        }

        return false;
    },

    // --- GRILL ---
    grill_interact: (player, cell, grid, game) => {


        // Restore Behavior: Combine on Grill
        if (player.heldItem && cell.object) {
            // First try container logic (e.g. dealing from box)
            if (InteractionHandlers.handle_container_deal(player, cell)) return true;

            // Then try single item combine
            const result = InteractionHandlers._tryCombine(player.heldItem, cell.object);
            if (result) {
                cell.object = result; // Result stays on grill
                player.heldItem = null; // Consume held item
                return true;
            }
        }

        return InteractionHandlers.grill_pickup(player, cell, grid, game);
    },

    grill_pickup: (player, cell, grid, game) => {

        if (player.heldItem) {
            // Box Logic: Place item from box onto grill
            if (player.heldItem.type === ItemType.Box) {
                const box = player.heldItem;
                const producesId = box.definition.produces;

                // Box Visually Open
                box.state.isOpen = true;

                if (!cell.object && box.state.count > 0 && producesId) {
                    const tempItem = new ItemInstance(producesId);
                    const def = tempItem.definition;
                    const isPatty = def.category === 'patty';
                    const isCookable = def.cooking && (!def.cooking.stages?.raw?.cookMethod || def.cooking.stages.raw.cookMethod !== 'fry');

                    if (isPatty || isCookable) {
                        cell.object = tempItem;
                        // box.state.count--; // UNLIMITED BOXES
                        return true;
                    }
                }
                // If box logic applied (it was a box), we prevent standard place logic which would try to place 'the box' on the grill
                // But wait, if we can't place the PATTY (e.g. grill full), do we want to place the BOX on the grill? 
                // Probably not. Grills don't usually hold boxes.
                // The standard logic checks 'isPatty || isCookable' for the held item before placing. 
                // Since the box is not a patty, standard logic would fail to place it anyway. 
                // So we can just fall through or return false.
                // However, falling through might try to combine the BOX with the grill contents?
                // Standard logic:
                // if (cell.object) Combine...
                // if (!cell.object) Place (if patty)...
                // So if we are here (Held Item == Box), and we didn't return true:
                // If cell.object: Standard combine check (Box + Item on grill). Likely fails and returns true (blocking).
                // If !cell.object: Standard place check (Box is patty?). Fails.
                // So falling through is safe.
            }

            // Occupied: Combine (Result to Hand)
            if (cell.object) {
                const result = InteractionHandlers._tryCombine(player.heldItem, cell.object);
                if (result) {
                    player.heldItem = result;
                    cell.object = null;
                    return true;
                }
                return true; // Block interaction if not combinable
            }

            // Empty: Place (Only Patties/Cookables)
            const def = player.heldItem.definition;
            const isPatty = def.category === 'patty';
            const isCookable = def.cooking && (!def.cooking.stages?.raw?.cookMethod || def.cooking.stages.raw.cookMethod !== 'fry');

            if (isPatty || isCookable) {
                cell.object = player.heldItem;
                player.heldItem = null;
                return true;
            }
            if (InteractionHandlers.handle_container_deal(player, cell)) return true;
            return true; // Block placement of other items
        }

        // Empty Hands: Pick Up
        if (cell.object) {
            const item = cell.object;
            // Reset cooking progress if picked up while raw (cooking)
            if (item.state && item.state.cook_level === 'raw') {
                item.state.cookingProgress = 0;
            }
            player.heldItem = item;
            cell.object = null;
            return true;
        }

        return false;
    },

    // --- FRYER ---
    fryer_interact: (player, cell, grid, game) => {

        const target = cell.object;
        if (!target) return false;

        // Re-use pickup logic for cooked items
        if (target.state.cook_level === 'cooked') {
            return InteractionHandlers.fryer_pickup_cooked(player, cell);
        }
        return false;
    },

    fryer_pickup: (player, cell, grid, game) => {

        if (cell.object) {
            return InteractionHandlers.fryer_pickup_cooked(player, cell);
        } else {
            return InteractionHandlers.fryer_load(player, cell);
        }
    },

    fryer_pickup_cooked: (player, cell) => {
        const friedItem = cell.object;
        if (!friedItem) return false;

        // ONION RINGS
        if (friedItem.definitionId === 'onion_slice' && friedItem.state.cook_level === 'cooked') {
            if (player.heldItem && player.heldItem.definitionId === 'side_cup') {
                player.heldItem = new ItemInstance('onion_rings');
                cell.object = null;
                cell.state.status = 'empty';
                return true;
            }
            if (!player.heldItem) {
                player.heldItem = new ItemInstance('fried_onion');
                cell.object = null;
                cell.state.status = 'empty';
                return true;
            }
            const burger = player.heldItem;
            if (burger && (burger.category === 'burger' || burger.definitionId.includes('burger'))) {
                const friedOnion = new ItemInstance('fried_onion');
                const newBurger = new ItemInstance(burger.definitionId);
                newBurger.state = JSON.parse(JSON.stringify(burger.state));
                InteractionHandlers._addIngredientToBurger(newBurger, friedOnion);
                player.heldItem = newBurger;
                cell.object = null;
                cell.state.status = 'empty';
                return true;
            }
        }

        // FRIES
        if (friedItem.definition.category === 'side_prep' && friedItem.state.cook_level === 'cooked') {
            if (player.heldItem && player.heldItem.definitionId === 'side_cup') {
                const resultId = friedItem.definition.result;
                if (resultId) {
                    player.heldItem = new ItemInstance(resultId);
                    cell.object = null;
                    cell.state.status = 'empty';
                    return true;
                }
            }
            if (!player.heldItem) {
                player.heldItem = friedItem;
                cell.object = null;
                cell.state.status = 'empty';
                return true;
            }
            return true; // Block pickup if hands full
        }

        // Generic Pickup falls through if hands empty? 
        // Returning FALSE allows standard pickup to work.
        return false;
    },

    fryer_load: (player, cell) => {
        if (!player.heldItem) return false;

        // Fry Bag
        if (player.heldItem.definition && player.heldItem.definition.fryContent) {
            let bag = player.heldItem;
            if (bag.state.charges === undefined) {
                const openId = bag.definitionId + '_open';
                bag = new ItemInstance(openId);
                player.heldItem = bag;
            }
            const rawContentId = bag.definition.fryContent;
            const rawItem = new ItemInstance(rawContentId);
            rawItem.state.cook_level = 'raw';
            rawItem.state.cookingProgress = 0;
            cell.object = rawItem;
            bag.state.charges = (bag.state.charges || 0) - 1;
            if (bag.state.charges <= 0) player.heldItem = new ItemInstance('fry_bag_empty');

            cell.state.status = 'down';
            cell.state.timer = 0;
            return true;
        }

        // Single Fryable
        if (player.heldItem.definition.cooking) {
            const stage = player.heldItem.state.cook_level || 'raw';
            const stageDef = player.heldItem.definition.cooking.stages[stage];
            if (stageDef && stageDef.cookMethod === 'fry') {
                cell.object = player.heldItem;
                player.heldItem = null;
                cell.state.status = 'down';
                cell.state.timer = 0;
                return true;
            }
        }
        return false;
    },

    // --- CUTTING BOARD ---
    cutting_board_interact: (player, cell) => {
        if (InteractionHandlers._transferBoardToStackedContainer(player, cell)) return true;

        const cbState = cell.state || {};
        const heldItem = cbState.heldItem;

        // 1. Try dealing FROM container TO board (if board empty)
        if (!heldItem && player.heldItem) {
            const held = player.heldItem;
            let itemToDispense = null;
            let consumeAction = null;

            // Box
            if (held.type === ItemType.Box) {
                if (held.state.count > 0 && held.definition.produces) {
                    itemToDispense = new ItemInstance(held.definition.produces);
                    consumeAction = () => {
                        // held.state.count--; // UNLIMITED BOXES
                        held.state.isOpen = true; // Visual feedback
                    };
                }
            }
            // Stacked Container
            else if (held.definition.useStackRender) {
                if (held.state.contents?.length > 0) {
                    itemToDispense = held.state.contents[held.state.contents.length - 1]; // Peek
                    consumeAction = () => {
                        held.state.contents.pop();
                    };
                }
            }
            // Bag
            else if (held.definitionId === 'bag' || held.definitionId === 'magic_bag') {
                if (held.state.contents?.length > 0) {
                    itemToDispense = held.state.contents[held.state.contents.length - 1]; // Peek
                    consumeAction = () => {
                        held.state.contents.pop();
                    };
                }
            }

            // Validate and Apply
            if (itemToDispense && itemToDispense.definition.slicing) {
                cbState.heldItem = itemToDispense;
                consumeAction();
                return true;
            }
        }

        // 2. Existing Slicing Logic
        if (heldItem) {
            const itemDef = DEFINITIONS[heldItem.definitionId];
            if (itemDef && itemDef.slicing) {
                if (itemDef.slicing.mode === 'dispense') {
                    if (!player.heldItem) {
                        const slice = new ItemInstance(itemDef.slicing.result);
                        player.heldItem = slice;
                        if (heldItem.state.charges === undefined) {
                            const initial = itemDef.initialState ? itemDef.initialState.charges : 18;
                            heldItem.state.charges = initial;
                        }
                        heldItem.state.charges -= 1;
                        if (heldItem.state.charges <= 0) cbState.heldItem = null;
                        return true;
                    }
                }
                if (itemDef.slicing.result) {
                    if (heldItem.definitionId !== itemDef.slicing.result) { // Transform
                        const newItem = new ItemInstance(itemDef.slicing.result);
                        if (itemDef.sliceCount) {
                            newItem.state.count = itemDef.sliceCount;
                        }
                        cbState.heldItem = newItem;
                        return true;
                    }
                }
            }
        }
        return false;
    },

    cutting_board_pickup: (player, cell) => {
        if (InteractionHandlers._transferBoardToStackedContainer(player, cell)) return true;

        const cbState = cell.state || {};
        if (player.heldItem) {
            // Place
            if (!cbState.heldItem) {
                if (player.heldItem.definition.slicing) {
                    cell.state.heldItem = player.heldItem; // Direct assignment ok as we nullify held
                    player.heldItem = null;
                    return true;
                }
            } else {
                // Combine
                const boardItem = cbState.heldItem;
                if (boardItem.category === 'topping' || boardItem.definition.isTopping) {
                    if (player.heldItem.category === 'burger') {
                        const result = InteractionHandlers._tryCombine(player.heldItem, boardItem);
                        if (result) {
                            player.heldItem = result; // Result is held

                            // Handle Stack Decrease
                            if (boardItem.state.count && boardItem.state.count > 1) {
                                boardItem.state.count--;
                            } else {
                                cell.state.heldItem = null; // Board cleared
                            }
                            return true;
                        }
                    }
                }
            }
        } else {
            // Pick Up
            if (cbState.heldItem) {
                if (cbState.heldItem.state.count && cbState.heldItem.state.count > 1) {
                    const oneItem = new ItemInstance(cbState.heldItem.definitionId);
                    player.heldItem = oneItem;
                    cbState.heldItem.state.count--;
                    return true;
                }
                player.heldItem = cbState.heldItem;
                cell.state.heldItem = null;
                return true;
            }
        }
        return false;
    },

    // --- DISPENSER ---
    dispenser_pickup: (player, target) => {
        return InteractionHandlers._tryApplySauce(player, target);
    },

    // Dispenser Interaction (Eject/Unload)
    // Note: Player.js had 'DISPENSER INTERACTION (Eject Sauce Bag)' AND 'Applying Sauce' in interact.
    dispenser_interact: (player, target) => {
        return InteractionHandlers._tryApplySauce(player, target);
    },

    // --- SODA ---
    soda_fountain_pickup: (player, target, context, game) => {
        const sfState = target.state || {};
        // Load
        if (player.heldItem && player.heldItem.definition.category === 'syrup') {
            if (sfState.isInfinite) return false;

            if (!sfState.status || sfState.status === 'empty') {
                target.state = {
                    status: 'full',
                    charges: player.heldItem.state.charges !== undefined ? player.heldItem.state.charges : 20,
                    syrupId: player.heldItem.definitionId,
                    resultId: player.heldItem.definition.result || 'soda'
                };
                player.heldItem = null;
                return true;
            }
        }

        // Start Fill
        if (player.heldItem && player.heldItem.definitionId === 'drink_cup') {
            if (sfState.status === 'full' || sfState.status === 'warning') {
                sfState.status = 'filling';
                sfState.timer = 0;
                sfState.fillDuration = 3000;
                player.heldItem = null;
                return true;
            }
        }
        // Pick Result
        if (sfState.status === 'done') {
            const isBag = player.heldItem && (player.heldItem.definitionId === 'bag' || player.heldItem.definitionId === 'magic_bag');
            const canPickUp = !player.heldItem || (isBag && (player.heldItem.state.contents || []).length < 50);

            if (canPickUp) {
                const resultId = sfState.resultId || 'soda';
                const newItem = new ItemInstance(resultId);

                // Soda fountains should never run out of charges
                sfState.status = 'full';

                if (isBag) {
                    if (!player.heldItem.state.contents) player.heldItem.state.contents = [];
                    player.heldItem.state.contents.push(newItem);
                } else {
                    player.heldItem = newItem;
                }
                return true;
            }
        }
        return false;
    },

    soda_fountain_interact: (player, target, context, game) => {
        return false;
    },

    // --- GARBAGE ---
    garbage_action: (player, cell) => {
        // 1. Throw Away
        if (player.heldItem) {
            if (player.heldItem.definition.useStackRender) {
                player.heldItem.state.contents = [];
                return true;
            }

            // Store in Trash
            if (!cell.state) cell.state = {};
            cell.state.trashedItem = player.heldItem;
            cell.state.trashedItemRotation = Math.random() * Math.PI * 2;

            player.heldItem = null;
            return true;
        }

        // 2. Retrieve
        if (!player.heldItem) {
            if (cell.state && cell.state.trashedItem) {
                player.heldItem = cell.state.trashedItem;
                cell.state.trashedItem = null;
                return true;
            }
        }

        return false;
    },

    // --- ITEM: STACKED CONTAINER (Insert, Plate, etc.) ---
    stacked_container_interact: (player, target, cell) => {
        const contents = target.state.contents || [];
        const count = target.state.count || 1;
        const held = player.heldItem;

        // 1. Stuff in them
        if (contents.length > 0) {
            // Dispense to Burger/Bun (Existing Feature for Inserts)
            const isBurger = held && (held.category === 'burger' || held.definitionId.includes('burger'));
            const isBun = held && (held.category === 'bun');

            // EXCLUDE PLATES: Plates are for serving, not for dispensing toppings (which pops from contents)
            if ((isBurger || isBun) && !['plate', 'dirty_plate'].includes(target.definitionId)) {
                const slice = contents.pop();
                let targetBurger = held;
                if (isBun) {
                    targetBurger = new ItemInstance('plain_burger');
                    targetBurger.state.bun = held;
                    targetBurger.state.toppings = [];
                } else {
                    const newBurger = new ItemInstance(held.definitionId);
                    newBurger.state = JSON.parse(JSON.stringify(held.state));
                    targetBurger = newBurger;
                }
                InteractionHandlers._addIngredientToBurger(targetBurger, slice);
                player.heldItem = targetBurger;
                return true;
            }

            // Take one thing out (To Hand)
            if (!held) {
                const item = contents.pop();
                player.heldItem = item;
                return true;
            }
        }

        // 2. Stacked (Empty)
        if (count > 1) {
            // Pick up one from stack
            if (!held) {
                const oneContainer = new ItemInstance(target.definitionId);
                target.state.count--;
                if (target.state.count <= 0) cell.object = null;
                player.heldItem = oneContainer;
                return true;
            }
        }

        // 3. Single Empty Container
        else {
            if (!held) {
                player.heldItem = target;
                cell.object = null;
                return true;
            }
        }

        return false;
    },

    stacked_container_pickup: (player, target, cell) => {
        const held = player.heldItem;
        const container = target;

        if (held) {
            const count = container.state.count || 1;
            if (count > 1) return false; // Can't place into stack

            const contents = container.state.contents || [];

            // Dispense topping to Burger/Bun (Existing Feature for Inserts)
            const isBurger = held.category === 'burger' || held.definitionId.includes('burger');
            const isBun = held.category === 'bun';

            // EXCLUDE PLATES: Plates should NOT dispense their contents onto a burger in-hand (pops from contents)
            if (contents.length > 0 && (isBurger || isBun) && !['plate', 'dirty_plate'].includes(container.definitionId)) {
                const slice = contents.pop();
                let targetBurger = held;
                if (isBun) {
                    targetBurger = new ItemInstance('plain_burger');
                    targetBurger.state.bun = held;
                    targetBurger.state.toppings = [];
                } else {
                    const newBurger = new ItemInstance(held.definitionId);
                    newBurger.state = JSON.parse(JSON.stringify(held.state));
                    targetBurger = newBurger;
                }
                InteractionHandlers._addIngredientToBurger(targetBurger, slice);
                player.heldItem = targetBurger;
                return true;
            }

            // Normal Place logic
            const def = held.definition || {};
            const itemToPlace = held;
            const isCookedBacon = itemToPlace.definitionId === 'bacon' && itemToPlace.state.cook_level === 'cooked';

            // Plate Logic: Specific items only (One Burger, One Side max)
            if (container.definitionId === 'plate') {
                const isUnwrappedBurger = (def.category === 'burger' || itemToPlace.definitionId?.includes('burger')) && !itemToPlace.state.isWrapped;
                const isCookedSide = (def.category === 'side' || (def.category === 'side_prep' && itemToPlace.state.cook_level === 'cooked'));

                if (isUnwrappedBurger || isCookedSide) {
                    if (!container.state.contents) container.state.contents = [];
                    const hasBurger = container.state.contents.some(c => (c.definition.category === 'burger' || c.definitionId?.includes('burger')));
                    const hasSide = container.state.contents.some(c => c.definition.category === 'side' || c.definition.category === 'side_prep');

                    if (isUnwrappedBurger && !hasBurger) {
                        container.state.contents.push(itemToPlace);
                        player.heldItem = null;
                        return true;
                    }

                    if (isCookedSide && !hasSide) {
                        container.state.contents.push(itemToPlace);
                        player.heldItem = null;
                        return true;
                    }
                    console.log(`Plate slot occupied: burger=${hasBurger}, side=${hasSide}`);
                }
                return true; // Block other items or already full
            }

            // Standard Insert Logic
            if (container.definitionId === 'dirty_plate') return false;
            if (def.isSlice || def.category === 'topping' || def.category === 'patty' || isCookedBacon) {
                if (!container.state.contents) container.state.contents = [];
                if (container.state.contents.length >= 50) return true;

                // Check mixing
                if (!['plate', 'dirty_plate'].includes(container.definitionId) && container.state.contents.length > 0 && container.state.contents[0].definitionId !== itemToPlace.definitionId) {
                    return true;
                }

                container.state.contents.push(itemToPlace);
                player.heldItem = null;
                return true;
            }

            // Stack Containers
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
            // Empty hands: Pick up entire container/stack
            player.heldItem = container;
            cell.object = null;
            return true;
        }
    },

    // --- ITEM: BAG ---
    bag_interact: (player, bag, cell) => {
        if (!bag || bag.definitionId !== 'bag') return false;

        // Interact to Take Out (LIFO)
        if (player.heldItem) return false;

        const contents = bag.state.contents;
        if (contents && contents.length > 0) {
            const item = contents.pop();
            player.heldItem = item;
            return true;
        }

        return false;
    },

    // --- ITEM: LETTUCE HEAD ---
    lettuce_interact: (player, head, cell) => {
        if (!head || head.definitionId !== 'lettuce_head') return false;

        // Player must be empty-handed to pluck leaf
        if (player.heldItem) return false;

        const charges = head.state.charges !== undefined ? head.state.charges : 8;
        if (charges > 0) {
            const leaf = new ItemInstance('lettuce_leaf');
            player.heldItem = leaf;

            head.state.charges = charges - 1;
            if (head.state.charges <= 0) {
                cell.object = null; // Head finished
            }
            return true;
        }

        return false;
    },


    // --- HELPERS & COMPLEX LOGIC ---

    _addIngredientToBurger: (burgerItem, feedItem) => {
        if (!burgerItem.state.toppings) burgerItem.state.toppings = [];
        burgerItem.state.toppings.push(feedItem);
    },

    _transferBoardToStackedContainer: (player, cell) => {
        const held = player.heldItem;
        const cbState = cell.state || {};
        const boardItem = cbState.heldItem;

        // Plates don't take items from cutting boards (they take finished items)
        if (held && held.definition.useStackRender && !['plate', 'dirty_plate'].includes(held.definitionId) && boardItem) {
            const containerContents = held.state.contents || [];
            // Check compatibility: Empty or same type
            if (containerContents.length === 0 || containerContents[0].definitionId === boardItem.definitionId) {
                const count = boardItem.state.count || 1;

                // Limit to 50
                if (containerContents.length + count <= 50) {
                    for (let i = 0; i < count; i++) {
                        const singleSlice = new ItemInstance(boardItem.definitionId);
                        if (!held.state.contents) held.state.contents = [];
                        held.state.contents.push(singleSlice);
                    }
                    cbState.heldItem = null;
                    return true;
                }
            }
        }
        return false;
    },

    _tryApplySauce: (player, target) => {
        const isDispenserItem = target.definitionId === 'dispenser';
        if (!isDispenserItem) return false;

        const dispState = target.state || {};
        const isLoaded = dispState.status === 'loaded' || dispState.status === 'has_mayo';
        if (!isLoaded || !player.heldItem) return false;

        const sauceId = dispState.sauceId || 'mayo';
        let newBurger = null;
        const held = player.heldItem;
        const isBurger = held.category === 'burger' || held.definitionId.includes('burger');
        const isBun = held.category === 'bun';

        if (isBurger || isBun) {
            if (isBun) {
                newBurger = new ItemInstance('plain_burger');
                newBurger.state.bun = held;
                newBurger.state.toppings = [];
            } else {
                newBurger = new ItemInstance(held.definitionId);
                newBurger.state = JSON.parse(JSON.stringify(held.state));
            }
            const sauceItem = new ItemInstance(sauceId);
            InteractionHandlers._addIngredientToBurger(newBurger, sauceItem);
        }

        if (newBurger) {
            player.heldItem = newBurger;

            if (!dispState.isInfinite) {
                dispState.charges = (dispState.charges || 0) - 1;
                if (dispState.charges <= 0) {
                    dispState.status = 'empty';
                    dispState.charges = 0;
                    dispState.sauceId = null;
                    dispState.bagId = null;
                }
            }
            return true;
        }
        return false;
    },

    _tryCombine: (held, target) => {
        const isBurger = (i) => i.category === 'burger';
        const isWrapper = (i) => i.definitionId === 'wrapper';

        // 1. Wrapping
        if (isBurger(held) && isWrapper(target)) {
            held.state.isWrapped = true;
            return held;
        }
        if (isWrapper(held) && isBurger(target)) {
            target.state.isWrapped = true;
            return target;
        }

        // 2. Burger Assembly
        const isBun = (i) => i.category === 'bun';
        const isCookedPatty = (i) => i.category === 'patty' && i.state.cook_level === 'cooked';
        const isTopping = (i) => i.category === 'topping' || i.category === 'sauce' || (i.definitionId === 'bacon' && i.state.cook_level === 'cooked') || i.definition.isTopping;

        let burgerBase = null, itemToAdd = null, bunBase = null;

        if (isBurger(held) && (isTopping(target) || isCookedPatty(target))) {
            burgerBase = held; itemToAdd = target;
        } else if ((isTopping(held) || isCookedPatty(held)) && isBurger(target)) {
            itemToAdd = held; burgerBase = target;
        }

        if (burgerBase && itemToAdd) {
            const newBurger = new ItemInstance(burgerBase.definitionId);
            newBurger.state = JSON.parse(JSON.stringify(burgerBase.state));
            InteractionHandlers._addIngredientToBurger(newBurger, itemToAdd);
            return newBurger;
        }

        if (isBun(held) && (isCookedPatty(target) || isTopping(target))) {
            bunBase = held; itemToAdd = target;
        } else if ((isCookedPatty(held) || isTopping(held)) && isBun(target)) {
            bunBase = target; itemToAdd = held;
        }

        if (bunBase && itemToAdd) {
            const burger = new ItemInstance('plain_burger');
            burger.state.bun = bunBase;
            burger.state.toppings = [];
            InteractionHandlers._addIngredientToBurger(burger, itemToAdd);
            return burger;
        }

        // 3. Side Cup + Cooked Fries/Sides
        const isCup = (i) => i.definitionId === 'side_cup';
        const isCookedSideReady = (i) => i.state && i.state.cook_level === 'cooked' && i.definition.result;

        let cup = null, cookedSide = null;
        if (isCup(held) && isCookedSideReady(target)) { cup = held; cookedSide = target; }
        else if (isCookedSideReady(held) && isCup(target)) { cookedSide = held; cup = target; }

        if (cup && cookedSide) {
            return new ItemInstance(cookedSide.definition.result);
        }

        // 4. Stacked Container Stacking
        if (held.definition.useStackRender && target.definition.useStackRender && held.definitionId === target.definitionId) {
            const heldContents = held.state.contents || [];
            const targetContents = target.state.contents || [];
            if (heldContents.length === 0 && targetContents.length === 0) {
                const targetCount = target.state.count || 1;
                const heldCount = held.state.count || 1;
                target.state.count = targetCount + heldCount;
                return target;
            }
        }

        // 3. Bag Packing
        const isBag = (i) => i.definitionId === 'bag' || i.definitionId === 'magic_bag';

        let bagBox = null, itemToPack = null;
        if (isBag(held)) { bagBox = held; itemToPack = target; }
        else if (isBag(target)) { bagBox = target; itemToPack = held; }

        if (bagBox && itemToPack) {
            // Validate Packability
            const def = itemToPack.definition;
            let tag = null;
            if (def.category === 'burger' || itemToPack.definitionId.includes('burger')) {
                if (itemToPack.state.isWrapped) tag = 'burger';
            } else {
                const type = (def.orderConfig && def.orderConfig.type) || def.category;
                if (type === 'side' || type === 'drink') tag = type;
            }

            if (tag) {
                const contents = bagBox.state.contents || [];
                if (contents.length < 50) {
                    bagBox.state.contents = [...contents, itemToPack];
                    return bagBox;
                }
            }
        }
        return null;
    },

    // --- BOX ---
    box_interact: (player, cell) => {
        const box = cell.object;
        if (!box || box.type !== ItemType.Box) return false;

        // Interaction: Take Item (Empty Hands)
        if (player.heldItem) return false;

        // Always open when interacting
        box.state.isOpen = true;

        if (box.state.count > 0) {
            const prodId = box.definition.produces;
            if (prodId) {
                const newItem = new ItemInstance(prodId);
                player.heldItem = newItem;
                // box.state.count--; // UNLIMITED BOXES
                return true;
            }
        }

        // If empty, just opening is the interaction
        return true;
    },

    handle_box_put_back: (box, item) => {
        const boxDef = box.definition;
        const targetId = boxDef.produces;

        if (item.definitionId !== targetId) return false;

        // Strict State Matching (Fresh vs Used)
        const freshItem = new ItemInstance(targetId);

        // 1. Cook Level (e.g. no cooked patties in raw box)
        if (freshItem.state.cook_level !== item.state.cook_level) return false;

        // 2. Charges (e.g. no half-used lettuce heads)
        // Check if charge exists on fresh item (some items don't have charges)
        if (freshItem.state.charges !== undefined) {
            if (item.state.charges !== freshItem.state.charges) return false;
        }

        // 3. Contents (e.g. no bags with stuff in them)
        if (item.state.contents && item.state.contents.length > 0) return false;

        // If it matches, we accept it back (Infinite Sink)
        // box.state.count++; // Increment count if we want to track stock (though it's unlimited source)
        // Setting count to maxCount or just ignoring it since it's unlimited.
        // Existing logic increments, so let's keep it to be safe, but remove max limit check.
        if (box.state.count !== undefined) box.state.count++;

        box.state.isOpen = true; // Visual feedback
        return true;
    },

    handle_box_combine: (player, box) => {
        if (box.state.count <= 0) return false;
        const productId = box.definition.produces;
        if (!productId) return false;

        const tempItem = new ItemInstance(productId);
        const result = InteractionHandlers._tryCombine(player.heldItem, tempItem);
        if (result) {
            // box.state.count--; // UNLIMITED BOXES
            box.state.isOpen = true;
            player.heldItem = result;
            return true;
        }
        return false;
    },

    handle_stacked_container_pickup: (player, cell) => {
        // Logic for picking up INTO a stacked container
        const container = player.heldItem;
        if (!container || !container.definition.useStackRender) return false;

        // Prevent putting items into a stack of containers
        if ((container.state.count || 1) > 1) return false;

        const target = cell.object;
        if (!target) return false;

        let itemToTake = null;
        let updateSource = null;

        // Simple Item
        if (target instanceof ItemInstance || target.type === undefined) {
            // Plate Logic
            // Plate Logic: Specific items only (One Burger, One Side max)
            if (container.definitionId === 'plate') {
                const def = target.definition || {};
                const isUnwrappedBurger = (def.category === 'burger' || target.definitionId.includes('burger')) && !target.state.isWrapped;
                const isCookedSide = (def.category === 'side' || (def.category === 'side_prep' && target.state.cook_level === 'cooked'));

                if (isUnwrappedBurger || isCookedSide) {
                    if (!container.state.contents) container.state.contents = [];
                    const hasBurger = container.state.contents.some(c => (c.definition.category === 'burger' || c.definitionId.includes('burger')));
                    const hasSide = container.state.contents.some(c => c.definition.category === 'side' || c.definition.category === 'side_prep');

                    if ((isUnwrappedBurger && !hasBurger) || (isCookedSide && !hasSide)) {
                        itemToTake = target;
                        updateSource = () => { cell.object = null; };
                    }
                }
            } else if (container.definitionId !== 'dirty_plate') {
                // Check suitability (Standard Insert)
                const def = target.definition || {};
                const isCookedBacon = target.definitionId === 'bacon' && target.state.cook_level === 'cooked';
                if (def.isSlice || def.category === 'topping' || def.category === 'patty' || isCookedBacon) {
                    itemToTake = target;
                    updateSource = () => { cell.object = null; };
                }
            }
        } else if (target.type === ItemType.Box) {
            if (target.state.count > 0) {
                const prodId = target.definition.produces;
                const tempItem = new ItemInstance(prodId);
                const def = tempItem.definition;
                const isCookedBacon = tempItem.definitionId === 'bacon' && tempItem.state.cook_level === 'cooked';

                if (def.isSlice || def.category === 'topping' || def.category === 'patty' || isCookedBacon) {
                    itemToTake = tempItem;
                    updateSource = () => {
                        target.state.isOpen = true;
                    };
                }
            }
        }

        if (itemToTake) {
            if (!container.state.contents) container.state.contents = [];
            if (container.state.contents.length >= 50) return true;
            // Check mixing - must be same type (EXCEPT for plates)
            if (!['plate', 'dirty_plate'].includes(container.definitionId) && container.state.contents.length > 0 && container.state.contents[0].definitionId !== itemToTake.definitionId) return true;

            updateSource();
            container.state.contents.push(itemToTake);
            return true;
        }
        return false;
    },

    // --- BURGER ---
    burger_interact: (player, cell) => {
        const burger = cell.object;
        if (!burger) return false;

        // Unwrap if wrapped
        if (burger.state.isWrapped) {
            // Require empty hands to unwrap
            if (!player.heldItem) {
                burger.state.isWrapped = false;
                player.heldItem = new ItemInstance('wrapper');
                return true;
            }
            return false;
        }

        // Remove most recent topping
        if (!player.heldItem) {
            if (burger.state.toppings && burger.state.toppings.length > 0) {
                const removedItem = burger.state.toppings.pop();
                player.heldItem = removedItem;
                return true;
            }
        }

        return false;
    },

    // Appliance Move
    place_appliance: (player, grid) => {
        if (!player.heldAppliance) return false;

        const targetX = player.x + player.facing.x;
        const targetY = player.y + player.facing.y;
        const cell = grid.getCell(targetX, targetY);

        if (!cell) return false;

        // Check for Counter Placement (Object)
        const isCounterAppliance = (player.heldAppliance.id === 'soda_fountain' || player.heldAppliance.id === 'dispenser');
        const isPlacementOnCounter = (cell.type.id === 'COUNTER');

        if (isCounterAppliance && isPlacementOnCounter && !cell.object) {
            // Place as OBJECT
            console.log(`Placing ${player.heldAppliance.tileType} on Counter as object`);

            // 1. Create Object (ItemInstance)
            let newItem = new ItemInstance(player.heldAppliance.id);

            // 2. Restore State
            if (player.heldAppliance.savedState) {
                newItem.state = JSON.parse(JSON.stringify(player.heldAppliance.savedState));
            }

            // 3. Place
            cell.object = newItem;

            player.heldAppliance = null;
            return true;
        }

        // Standard Floor Placement
        if (cell.type.id !== 'FLOOR' || cell.object) return false;

        grid.setTileType(targetX, targetY, TILE_TYPES[player.heldAppliance.tileType]);

        // Restore State
        const newCell = grid.getCell(targetX, targetY);

        if (player.heldAppliance.savedState && newCell.state) Object.assign(newCell.state, player.heldAppliance.savedState);
        if (player.heldAppliance.attachedObject) newCell.object = player.heldAppliance.attachedObject;

        player.heldAppliance = null;
        return true;
    },

    dishwasher_interact: (player, cell) => {
        if (!cell.state) cell.state = {};

        // Only works if not currently washing
        if (cell.state.status === 'washing') return true;

        if (cell.state.isOpen) {
            // Check hand first
            let rack = player.heldItem;
            let rackInHand = true;

            // If hand is empty, check if one is sitting on it
            if ((!rack || rack.definitionId !== 'dish_rack') && cell.object && cell.object.definitionId === 'dish_rack') {
                rack = cell.object;
                rackInHand = false;
            }

            if (rack && rack.definitionId === 'dish_rack') {
                const contents = rack.state.contents || [];
                // Check for dirty plates
                const hasDirty = contents.some(p => p.definitionId === 'dirty_plate');

                if (hasDirty) {
                    const dirtyCount = contents.filter(p => p.definitionId === 'dirty_plate').length;

                    if (dirtyCount > 0) {
                        cell.state.status = 'washing';
                        cell.state.timer = 60000; // 1 minute
                        cell.state.dishCount = dirtyCount;
                        cell.state.isOpen = false;

                        if (rackInHand) player.heldItem = null;
                        else cell.object = null;

                        console.log(`Dishwasher started with ${dirtyCount} dirty plates.`);
                        return true;
                    }
                }
            }
        }
        return true; // Consume interaction but do nothing if conditions not met
    },

    dishwasher_pickup: (player, cell) => {
        // Prevent pickup while washing
        if (cell.state && cell.state.status === 'washing') return true;

        const held = player.heldItem;
        if (held && held.definitionId === 'dish_rack') {
            // Try to start wash via the interact logic
            if (InteractionHandlers.dishwasher_interact(player, cell)) return true;
        }

        // Standard appliance pickup/place logic
        if (player.heldItem || player.heldAppliance) {
            return false;
        }
        return false;
    },

    dish_rack_interact: (player, rack, cell) => {
        const held = player.heldItem;
        const contents = rack.state.contents || [];
        if (contents.length === 0) return false;

        // Requirement: "only take clean plates off racks"
        const rackType = contents[0].definitionId;
        if (rackType !== 'plate') return false;

        // Requirement: "if the player presses interact_key... instead of putting the plate back... 
        // add another clean plate to the players hands in a stack"
        if (held && held.definitionId === 'plate') {
            const plate = contents.pop();
            held.state.count = (held.state.count || 1) + 1;
            rack.state.contents = contents;
            return true;
        }

        // If hands empty, take one clean plate
        if (!held) {
            const plate = contents.pop();
            player.heldItem = plate;
            rack.state.contents = contents;
            return true;
        }

        return false;
    },

    dish_rack_pickup: (player, rack, cell) => {
        const held = player.heldItem;
        const contents = rack.state.contents || [];

        if (held) {
            // Requirement: "only put dirty plates on racks"
            if (held.definitionId === 'dirty_plate') {
                if (contents.length >= 6) return true; // Full

                // Block mixing: Cannot put dirty plates in a clean rack
                if (contents.length > 0 && contents[0].definitionId !== 'dirty_plate') {
                    console.log("Cannot put dirty plates in a clean rack");
                    return true;
                }

                // Deal one plate into the rack
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
            return true; // Block other items (including clean plates)
        }

        // 2. Empty hands: Pick up the whole rack
        player.heldItem = rack;
        cell.object = null;
        return true;
    }
};

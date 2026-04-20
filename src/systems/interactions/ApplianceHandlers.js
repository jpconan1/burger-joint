import { ItemInstance } from '../../entities/Item.js';
import { ItemType, DEFINITIONS } from '../../data/definitions.js';
import { TILE_TYPES } from '../../constants.js';
import { _tryCombine, _addIngredientToBurger } from './CombineUtils.js';
import { handle_container_deal, handle_container_collect } from './ContainerHandlers.js';

// Private: cutting board utility
const _transferBoardToStackedContainer = (player, cell) => {
    const held = player.heldItem;
    const cbState = cell.state || {};
    const boardItem = cbState.heldItem;

    if (held && held.definition.useStackRender && !['plate', 'dirty_plate'].includes(held.definitionId) && boardItem) {
        const containerContents = held.state.contents || [];
        if (containerContents.length === 0 || containerContents[0].definitionId === boardItem.definitionId) {
            const count = boardItem.state.count || 1;

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
};

// --- GRILL ---
export const grill_interact = (player, cell, grid, game) => {
    if (player.heldItem && cell.object) {
        if (handle_container_deal(player, cell)) return true;

        if (cell.object.state?.cook_level === 'cooked') {
            if (handle_container_collect(player, cell)) return true;
        }

        const result = _tryCombine(player.heldItem, cell.object);
        if (result) {
            cell.object = result;
            player.heldItem = null;
            return true;
        }
    }

    return grill_pickup(player, cell, grid, game);
};

export const grill_pickup = (player, cell, grid, game) => {
    if (player.heldItem) {
        if (player.heldItem.type === ItemType.Box) {
            const box = player.heldItem;
            const producesId = box.definition.produces;

            box.state.isOpen = true;

            if (!cell.object && box.state.count > 0 && producesId) {
                const tempItem = new ItemInstance(producesId);
                const def = tempItem.definition;
                const isPatty = def.category === 'patty';
                const isCookable = def.cooking && (!def.cooking.stages?.raw?.cookMethod || def.cooking.stages.raw.cookMethod !== 'fry');

                if (isPatty || isCookable) {
                    cell.object = tempItem;
                    return true;
                }
            }
        }

        if (cell.object) {
            if (cell.object.state?.cook_level === 'cooked') {
                if (handle_container_collect(player, cell)) return true;
            }

            const result = _tryCombine(player.heldItem, cell.object);
            if (result) {
                player.heldItem = result;
                cell.object = null;
                return true;
            }
            return true;
        }

        const def = player.heldItem.definition;
        const isPatty = def.category === 'patty';
        const isCookable = def.cooking && (!def.cooking.stages?.raw?.cookMethod || def.cooking.stages.raw.cookMethod !== 'fry');

        if (isPatty || isCookable) {
            cell.object = player.heldItem;
            player.heldItem = null;
            return true;
        }
        if (handle_container_deal(player, cell)) return true;
        return true;
    }

    if (cell.object) {
        const item = cell.object;
        if (item.state && item.state.cook_level === 'raw') {
            item.state.cookingProgress = 0;
        }
        player.heldItem = item;
        cell.object = null;
        return true;
    }

    return false;
};

// --- FRYER ---
export const fryer_interact = (player, cell, grid, game) => {
    const target = cell.object;
    if (!target) return false;

    if (target.state.cook_level === 'cooked') {
        return fryer_pickup_cooked(player, cell);
    }
    return false;
};

export const fryer_pickup = (player, cell, grid, game) => {
    if (cell.object) {
        return fryer_pickup_cooked(player, cell);
    } else {
        return fryer_load(player, cell);
    }
};

export const fryer_pickup_cooked = (player, cell) => {
    const friedItem = cell.object;
    if (!friedItem) return false;

    if (handle_container_collect(player, cell)) {
        cell.state.status = 'empty';
        return true;
    }

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
            const newBurger = burger.clone();
            _addIngredientToBurger(newBurger, friedOnion);
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
        return true;
    }

    if (player.heldItem) {
        const result = _tryCombine(player.heldItem, friedItem);
        if (result) {
            player.heldItem = result;
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

    return false;
};

export const fryer_load = (player, cell) => {
    if (!player.heldItem) return false;

    if (player.heldItem.type === ItemType.Box) {
        const box = player.heldItem;
        const producesId = box.definition.produces;
        if (producesId && box.state.count > 0) {
            const tempItem = new ItemInstance(producesId);
            const def = tempItem.definition;
            if (def.cooking && def.cooking.stages?.raw?.cookMethod === 'fry') {
                cell.object = tempItem;
                box.state.isOpen = true;
                cell.state.status = 'down';
                cell.state.timer = 0;
                return true;
            }
        }
    }

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
};

// --- CUTTING BOARD ---
export const cutting_board_interact = (player, cell) => {
    if (_transferBoardToStackedContainer(player, cell)) return true;

    const cbState = cell.state || {};
    const heldItem = cbState.heldItem;

    if (!heldItem && player.heldItem) {
        const held = player.heldItem;
        let itemToDispense = null;
        let consumeAction = null;

        if (held.type === ItemType.Box) {
            if (held.state.count > 0 && held.definition.produces) {
                itemToDispense = new ItemInstance(held.definition.produces);
                consumeAction = () => {
                    held.state.isOpen = true;
                };
            }
        } else if (held.definition.useStackRender) {
            if (held.state.contents?.length > 0) {
                itemToDispense = held.state.contents[held.state.contents.length - 1];
                consumeAction = () => {
                    held.state.contents.pop();
                };
            }
        } else if (held.definitionId === 'bag' || held.definitionId === 'magic_bag') {
            if (held.state.contents?.length > 0) {
                itemToDispense = held.state.contents[held.state.contents.length - 1];
                consumeAction = () => {
                    held.state.contents.pop();
                };
            }
        }

        if (itemToDispense && itemToDispense.definition.slicing) {
            cbState.heldItem = itemToDispense;
            consumeAction();
            return true;
        }
    }

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
                if (heldItem.definitionId !== itemDef.slicing.result) {
                    const newItem = new ItemInstance(itemDef.slicing.result);
                    if (itemDef.sliceCount) {
                        newItem.state.count = itemDef.sliceCount;
                    } else if (itemDef.slicing.chargesBased) {
                        newItem.state.count = heldItem.state.charges || 1;
                    }
                    cbState.heldItem = newItem;
                    return true;
                }
            }
        }
    }
    return false;
};

export const cutting_board_pickup = (player, cell) => {
    if (_transferBoardToStackedContainer(player, cell)) return true;

    const cbState = cell.state || {};
    if (player.heldItem) {
        if (!cbState.heldItem) {
            if (player.heldItem.definition.slicing) {
                cell.state.heldItem = player.heldItem;
                player.heldItem = null;
                return true;
            }
        } else {
            const boardItem = cbState.heldItem;
            if (boardItem.category === 'topping' || boardItem.definition.isTopping) {
                if (player.heldItem.category === 'burger') {
                    const result = _tryCombine(player.heldItem, boardItem);
                    if (result) {
                        player.heldItem = result;

                        if (boardItem.state.count && boardItem.state.count > 1) {
                            boardItem.state.count--;
                        } else {
                            cell.state.heldItem = null;
                        }
                        return true;
                    }
                }
            }
        }
    } else {
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
};

// --- BOARD RACK ---
const _board_rack_action = (player, rackObject) => {
    if (!rackObject.state) rackObject.state = {};
    const boardCount = rackObject.state.boardCount ?? 2;

    if (!player.heldItem) {
        if (boardCount > 0) {
            player.heldItem = new ItemInstance('board');
            rackObject.state.boardCount = boardCount - 1;
        }
        return true;
    }

    // Put a clean board back
    if (player.heldItem.definitionId === 'board' && !player.heldItem.state?.heldItem) {
        if (boardCount < 2) {
            rackObject.state.boardCount = boardCount + 1;
            player.heldItem = null;
        }
        return true;
    }

    return true;
};

export const board_rack_interact = (player, rackObject, cell, game) => _board_rack_action(player, rackObject);
export const board_rack_pickup  = (player, rackObject, cell, game) => _board_rack_action(player, rackObject);

// Right-tile proxy: player is targeting the counter to the right of the anchor
export const board_rack_right_tile = (player, cell, grid, game) => {
    if (!cell.object) {
        const targetX = player.x + player.facing.x;
        const targetY = player.y + player.facing.y;
        const leftCell = grid.getCell(targetX - 1, targetY);
        if (leftCell?.object?.definitionId === 'board_rack_double') {
            return _board_rack_action(player, leftCell.object);
        }
    }
    return false;
};

// --- PORTABLE BOARD ITEM ---
const DIRTY_BOARDS = { board_tomatoed: 'tomato', board_pickled: 'pickle' };
const ITEM_DIRTIES_BOARD = { tomato: 'board_tomatoed', pickle: 'board_pickled' };

const _boardAllowsItem = (boardObject, itemId) => {
    const required = DIRTY_BOARDS[boardObject.definitionId];
    if (!required) return true; // clean board accepts anything sliceable
    return itemId === required;
};

const _dirtyBoard = (boardObject, slicedId) => {
    const dirtyId = ITEM_DIRTIES_BOARD[slicedId];
    if (dirtyId && boardObject.definitionId === 'board') {
        boardObject.definitionId = dirtyId;
    }
};


const _transferFromBoardItemState = (player, boardObject) => {
    const held = player.heldItem;
    const boardItem = boardObject.state?.heldItem;

    if (held && held.definition.useStackRender && !['plate', 'dirty_plate'].includes(held.definitionId) && boardItem) {
        const containerContents = held.state.contents || [];
        if (containerContents.length === 0 || containerContents[0].definitionId === boardItem.definitionId) {
            const count = boardItem.state.count || 1;
            if (containerContents.length + count <= 50) {
                for (let i = 0; i < count; i++) {
                    const singleSlice = new ItemInstance(boardItem.definitionId);
                    if (!held.state.contents) held.state.contents = [];
                    held.state.contents.push(singleSlice);
                }
                boardObject.state.heldItem = null;
                return true;
            }
        }
    }
    return false;
};

export const board_item_interact = (player, boardObject, cell, game) => {
    if (_transferFromBoardItemState(player, boardObject)) return true;

    const boardState = boardObject.state || (boardObject.state = {});
    const heldItem = boardState.heldItem;

    if (!heldItem && player.heldItem) {
        const held = player.heldItem;

        // Direct placement: holding a sliceable item
        if (held.definition.slicing) {
            if (!_boardAllowsItem(boardObject, held.definitionId)) return true;
            boardState.heldItem = held;
            player.heldItem = null;
            return true;
        }

        // Dispense from box or stacked container
        let itemToDispense = null;
        let consumeAction = null;

        if (held.type === ItemType.Box) {
            if (held.state.count > 0 && held.definition.produces) {
                itemToDispense = new ItemInstance(held.definition.produces);
                consumeAction = () => { held.state.isOpen = true; };
            }
        } else if (held.definition.useStackRender) {
            if (held.state.contents?.length > 0) {
                itemToDispense = held.state.contents[held.state.contents.length - 1];
                consumeAction = () => { held.state.contents.pop(); };
            }
        } else if (held.definitionId === 'bag' || held.definitionId === 'magic_bag') {
            if (held.state.contents?.length > 0) {
                itemToDispense = held.state.contents[held.state.contents.length - 1];
                consumeAction = () => { held.state.contents.pop(); };
            }
        }

        if (itemToDispense && itemToDispense.definition.slicing) {
            if (!_boardAllowsItem(boardObject, itemToDispense.definitionId)) return true;
            boardState.heldItem = itemToDispense;
            consumeAction();
            return true;
        }
    }

    if (heldItem) {
        const itemDef = DEFINITIONS[heldItem.definitionId];

        // Burger + topping combine
        if ((heldItem.category === 'topping' || heldItem.definition?.isTopping) && player.heldItem?.category === 'burger') {
            const result = _tryCombine(player.heldItem, heldItem);
            if (result) {
                player.heldItem = result;
                if (heldItem.state.count && heldItem.state.count > 1) {
                    heldItem.state.count--;
                } else {
                    boardState.heldItem = null;
                }
                return true;
            }
        }

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
                    if (heldItem.state.charges <= 0) boardState.heldItem = null;
                    return true;
                }
            }
            if (itemDef.slicing.result) {
                if (heldItem.definitionId !== itemDef.slicing.result) {
                    const slicedId = heldItem.definitionId;
                    const newItem = new ItemInstance(itemDef.slicing.result);
                    if (itemDef.sliceCount) newItem.state.count = itemDef.sliceCount;
                    boardState.heldItem = newItem;
                    _dirtyBoard(boardObject, slicedId);
                    return true;
                }
            }
            // Pick up a single slice (or all if count === 1)
            if (!player.heldItem) {
                if (heldItem.state.count && heldItem.state.count > 1) {
                    player.heldItem = new ItemInstance(heldItem.definitionId);
                    heldItem.state.count--;
                } else {
                    player.heldItem = heldItem;
                    boardState.heldItem = null;
                }
                return true;
            }
        }

        // Board has already-sliced items (isSlice: true, no slicing property) — take one slice
        if (itemDef && itemDef.isSlice && !player.heldItem) {
            if (heldItem.state.count && heldItem.state.count > 1) {
                player.heldItem = new ItemInstance(heldItem.definitionId);
                heldItem.state.count--;
            } else {
                player.heldItem = heldItem;
                boardState.heldItem = null;
            }
            return true;
        }
    }
    return false;
};

export const board_item_pickup = (player, boardObject, cell, game) => {
    // Scoop slices into a held stacked container (mirrors interact behaviour)
    if (_transferFromBoardItemState(player, boardObject)) return true;

    // Place a directly-held sliceable item onto the board
    const boardState = boardObject.state || (boardObject.state = {});
    if (player.heldItem && !boardState.heldItem && player.heldItem.definition?.slicing) {
        if (!_boardAllowsItem(boardObject, player.heldItem.definitionId)) return true;
        boardState.heldItem = player.heldItem;
        player.heldItem = null;
        return true;
    }

    // Fall through — standard transfer picks up the whole board (with its contents)
    return false;
};

// --- DISHWASHER ---
export const dishwasher_interact = (player, cell) => {
    if (!cell.state) cell.state = {};

    if (cell.state.status === 'washing') return true;

    if (cell.state.isOpen) {
        let rack = player.heldItem;
        let rackInHand = true;

        if ((!rack || rack.definitionId !== 'dish_rack') && cell.object && cell.object.definitionId === 'dish_rack') {
            rack = cell.object;
            rackInHand = false;
        }

        if (rack && rack.definitionId === 'dish_rack') {
            const contents = rack.state.contents || [];
            const boards = rack.state.boards || [];
            const dirtyBoards = boards.filter(b => b.item.definitionId === 'board_tomatoed' || b.item.definitionId === 'board_pickled');
            const dirtyPlateCount = contents.filter(p => p.definitionId === 'dirty_plate').length;
            const hasDirty = dirtyPlateCount > 0 || dirtyBoards.length > 0;

            if (hasDirty) {
                cell.state.status = 'washing';
                cell.state.timer = 60000;
                cell.state.dishCount = dirtyPlateCount;
                cell.state.boardRows = dirtyBoards.map(b => b.row);
                cell.state.isOpen = false;

                if (rackInHand) player.heldItem = null;
                else cell.object = null;

                return true;
            }
        }
    }
    return true;
};

export const dishwasher_pickup = (player, cell) => {
    if (cell.state && cell.state.status === 'washing') return true;

    const held = player.heldItem;
    if (held && held.definitionId === 'dish_rack') {
        if (dishwasher_interact(player, cell)) return true;
    }

    if (player.heldItem || player.heldAppliance) {
        return false;
    }
    return false;
};

// --- SODA FOUNTAIN ---
export const soda_fountain_pickup = (player, target, context, game) => {
    const sfState = target.state || {};

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

    if (player.heldItem && player.heldItem.definitionId === 'drink_cup') {
        if (sfState.status === 'full' || sfState.status === 'warning') {
            sfState.status = 'filling';
            sfState.timer = 0;
            sfState.fillDuration = 3000;
            player.heldItem = null;
            return true;
        }
    }

    if (sfState.status === 'done') {
        const isBag = player.heldItem && (player.heldItem.definitionId === 'bag' || player.heldItem.definitionId === 'magic_bag');
        const canPickUp = !player.heldItem || (isBag && (player.heldItem.state.contents || []).length < 50);

        if (canPickUp) {
            const resultId = sfState.resultId || 'soda';
            const newItem = new ItemInstance(resultId);

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
};

export const soda_fountain_interact = (player, target, context, game) => {
    return false;
};

// --- SERVICE COUNTER ---
export const service_counter_interact = (player, cell, grid, game) => {
    return handle_container_deal(player, cell);
};

export const service_counter_pickup = (player, cell, grid, game) => {
    const held = player.heldItem;
    if (!held) return false;

    if (held.definitionId === 'plate' && (held.state.count || 1) > 1) {
        service_counter_interact(player, cell, grid, game);
        return true;
    }

    if (held.definitionId === 'plate' && cell.object && cell.object.definitionId === 'plate') {
        return true;
    }

    return false;
};

// --- GARBAGE ---
export const garbage_action = (player, cell) => {
    if (player.heldItem) {
        if (player.heldItem.definition.useStackRender) {
            player.heldItem.state.contents = [];
            return true;
        }

        if (!cell.state) cell.state = {};
        cell.state.trashedItem = player.heldItem;
        cell.state.trashedItemRotation = Math.random() * Math.PI * 2;

        player.heldItem = null;
        return true;
    }

    if (!player.heldItem) {
        if (cell.state && cell.state.trashedItem) {
            player.heldItem = cell.state.trashedItem;
            cell.state.trashedItem = null;
            return true;
        }
    }

    return false;
};

// --- APPLIANCE MOVE ---
export const place_appliance = (player, grid) => {
    if (!player.heldAppliance) return false;

    const targetX = player.x + player.facing.x;
    const targetY = player.y + player.facing.y;
    const cell = grid.getCell(targetX, targetY);

    if (!cell) return false;

    const isCounterAppliance = (player.heldAppliance.id === 'soda_fountain');
    const isPlacementOnCounter = (cell.type.id === 'COUNTER');

    if (isCounterAppliance && isPlacementOnCounter && !cell.object) {
        console.log(`Placing ${player.heldAppliance.tileType} on Counter as object`);

        let newItem = new ItemInstance(player.heldAppliance.id);

        if (player.heldAppliance.savedState) {
            newItem.state = JSON.parse(JSON.stringify(player.heldAppliance.savedState));
        }

        cell.object = newItem;
        player.heldAppliance = null;
        return true;
    }

    if (cell.type.id !== 'FLOOR' || cell.object) return false;

    grid.setTileType(targetX, targetY, TILE_TYPES[player.heldAppliance.tileType]);

    const newCell = grid.getCell(targetX, targetY);

    if (player.heldAppliance.savedState && newCell.state) Object.assign(newCell.state, player.heldAppliance.savedState);
    if (player.heldAppliance.attachedObject) newCell.object = player.heldAppliance.attachedObject;

    player.heldAppliance = null;
    return true;
};

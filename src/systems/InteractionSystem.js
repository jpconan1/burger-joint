import {
    handle_container_deal,
    handle_container_collect,
    handle_stacked_container_pickup,
    box_interact,
    handle_box_put_back,
    handle_box_combine,
} from './interactions/ContainerHandlers.js';
import { _tryCombine, _addIngredientToBurger } from './interactions/CombineUtils.js';
import { place_appliance } from './interactions/ApplianceHandlers.js';
import { burger_interact, side_result_interact } from './interactions/ItemHandlers.js';
import { ItemInstance } from '../entities/Item.js';
import { INTERACTION_MAPPING } from '../data/interactions.js';
import { ItemType } from '../data/definitions.js';
import { TILE_TYPES } from '../constants.js';

export class InteractionSystem {

    static handleInteract(player, grid, game) {
        const cell = player.getTargetCell(grid);
        if (!cell) return false;

        // Powerup Interaction Hook
        if (cell.object && game.powerupSystem && game.powerupSystem.checkInteraction(cell.object, cell)) {
            return true;
        }

        // 1. Context Specific (Tile)
        if (this._dispatch('interact', cell.type.id, player, cell, grid, 'TILES', game)) return true;

        // 1.5. Generic Container Deal (Box/Insert/Bag -> Counter/Item)
        // Check for Suck Up (Interact Key) - Bag Only
        if (handle_container_collect(player, cell)) return true;

        if (handle_container_deal(player, cell)) return true;

        // 2. Item Specific (Target Object)
        if (cell.object) {
            // Special Box Handling
            if (cell.object.type === ItemType.Box) {
                if (box_interact(player, cell)) return true;
            }

            if (this._dispatch('interact', cell.object.definitionId, player, cell.object, cell, 'ITEMS', game)) return true;

            // 3. Generic Burger Handling (Unwrap or Modify)
            if (cell.object.category === 'burger') {
                if (burger_interact(player, cell)) return true;
            }

            // 4. Generic: Extract cooked side from side-result items (fries, sweet_potato_fries, etc.)
            if (side_result_interact(player, cell)) return true;
        }

        // 5. Fallback to Pickup
        return this.handlePickUp(player, grid, game);
    }

    static handlePickUp(player, grid, game) {
        const cell = player.getTargetCell(grid);
        if (!cell) return false;

        // Powerup Pickup Hook
        if (cell.object && game.powerupSystem && game.powerupSystem.checkInteraction(cell.object, cell)) {
            return true;
        }

        // 0. Place Appliance (Priority)
        if (player.heldAppliance) {
            if (place_appliance(player, grid)) return true;
            return true;
        }

        // 1. Context Specific (Tile)
        if (this._dispatch('pickup', cell.type.id, player, cell, grid, 'TILES', game)) return true;

        // 2. Item Specific (Target Object)
        if (cell.object) {
            if (this._dispatch('pickup', cell.object.definitionId, player, cell.object, cell, 'ITEMS', game)) return true;
        }

        // 2.5. Special: Pick Up into Held Stacked Container (Insert/Plate)
        if (handle_stacked_container_pickup(player, cell)) return true;

        // 3. Standard Put Down / Pick Up Logic (Default)
        if (this._standardTransfer(player, cell, grid, game)) return true;

        // 4. Fallback: Smart Interaction -> If holding a container and couldn't place it, try dealing from it
        if (handle_container_deal(player, cell)) return true;

        return false;
    }

    static _dispatch(actionType, id, player, target, context, category, game) {
        const config = INTERACTION_MAPPING[category][id];
        if (config?.[actionType]) {
            return config[actionType](player, target, context, game) || false;
        }
        return false;
    }

    static _standardTransfer(player, cell, grid, game) {
        // Place Held Item
        if (player.heldItem) {

            // Bag-to-Bag Interaction
            if (cell.object && player.heldItem.definitionId === 'bag' && cell.object.definitionId === 'bag') {
                const heldBag = player.heldItem;
                const targetBag = cell.object;

                if (!heldBag.state.contents) heldBag.state.contents = [];
                if (!targetBag.state.contents) targetBag.state.contents = [];

                if (heldBag.state.contents.length > 0) {
                    targetBag.state.contents.push(...heldBag.state.contents);
                    heldBag.state.contents = [];
                } else if (targetBag.state.contents.length > 0) {
                    heldBag.state.contents.push(...targetBag.state.contents);
                    targetBag.state.contents = [];
                }

                return true;
            }

            // Box Logic: Put Back
            if (cell.object && cell.object.type === ItemType.Box) {
                if (handle_box_put_back(cell.object, player.heldItem)) {
                    player.heldItem = null;
                    return true;
                }
                if (handle_box_combine(player, cell.object)) {
                    return true;
                }
            }

            // Special: Place Appliance Item onto Floor
            if (cell.type.id === 'FLOOR' && !cell.object) {
                const def = player.heldItem.definition;
                const isApplianceItem = (def.type === 'appliance' || ['soda_fountain', 'fryer', 'grill', 'counter'].includes(def.id));

                if (isApplianceItem) {
                    const tileTypeStr = def.id.toUpperCase();
                    const tileType = TILE_TYPES[tileTypeStr];

                    if (tileType && grid) {
                        const targetX = player.x + player.facing.x;
                        const targetY = player.y + player.facing.y;
                        grid.setTileType(targetX, targetY, tileType);

                        const newCell = grid.getCell(targetX, targetY);
                        if (player.heldItem.state && newCell.state) {
                            Object.assign(newCell.state, player.heldItem.state);
                        }

                        player.heldItem = null;
                        game.updateCapabilities();
                        return true;
                    }
                }
            }

            // Standard Place
            if (!cell.object && cell.type.holdsItems) {
                cell.object = player.heldItem;
                player.heldItem = null;
                return true;
            }

            // Sauce Bottle in Hand: apply to burger/bun on counter
            if (player.heldItem.definition?.category === 'sauce_bottle' && cell.object) {
                const sauceId = player.heldItem.definition.produces;
                const target = cell.object;
                const isBurger = target.category === 'burger' || target.definitionId.includes('burger');
                const isBun = target.category === 'bun';
                if (sauceId && (isBurger || isBun)) {
                    let newBurger;
                    if (isBun) {
                        newBurger = new ItemInstance('plain_burger');
                        newBurger.state.bun = target;
                        newBurger.state.toppings = [];
                    } else {
                        newBurger = target.clone();
                    }
                    _addIngredientToBurger(newBurger, new ItemInstance(sauceId));
                    cell.object = newBurger;
                    return true;
                }
            }

            // Combine with item on table
            if (cell.object) {
                const result = _tryCombine(player.heldItem, cell.object);
                if (result) {
                    cell.object = result;
                    player.heldItem = null;
                    return true;
                }
            }
        }
        // Pick Up Item
        else if (cell.object) {
            // Box Logic: Open Box
            if (cell.object.type === ItemType.Box) {
                cell.object.state.isOpen = false;
            }

            const item = cell.object;
            if (item.state && item.state.cook_level === 'raw') {
                item.state.cookingProgress = 0;
            }

            player.heldItem = item;
            cell.object = null;
            return true;
        }

        return false;
    }
}

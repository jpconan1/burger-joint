import { InteractionHandlers } from './InteractionHandlers.js';
import { INTERACTION_MAPPING } from '../data/interactions.js';
import { ItemType } from '../data/definitions.js';

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
        if (InteractionHandlers.handle_container_collect(player, cell)) return true;

        if (InteractionHandlers.handle_container_deal(player, cell)) return true;

        // 2. Item Specific (Target Object)
        if (cell.object) {
            // Special Box Handling
            if (cell.object.type === ItemType.Box) {
                if (InteractionHandlers.box_interact(player, cell)) return true;
            }

            if (this._dispatch('interact', cell.object.definitionId, player, cell.object, cell, 'ITEMS', game)) return true;

            // 3. Generic Burger Handling (Unwrap or Modify)
            if (cell.object.category === 'burger') {
                if (InteractionHandlers.burger_interact(player, cell)) return true;
            }
        }

        // 3. Fallback to Pickup
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
            if (InteractionHandlers.place_appliance(player, grid)) return true;
            // If failed to place, do we consume input? Yes usually.
            return true;
        }

        // 1. Context Specific (Tile)
        if (this._dispatch('pickup', cell.type.id, player, cell, grid, 'TILES', game)) return true;

        // 2. Item Specific (Target Object)
        if (cell.object) {
            if (this._dispatch('pickup', cell.object.definitionId, player, cell.object, cell, 'ITEMS', game)) return true;
        }

        // 2.5. Special: Pick Up into Held Stacked Container (Insert/Plate)
        if (InteractionHandlers.handle_stacked_container_pickup(player, cell)) return true;

        // 3. Standard Put Down / Pick Up Logic (Default)
        if (this._standardTransfer(player, cell)) return true;

        // 4. Fallback: Smart Interaction -> If holding a container and couldn't place it, try dealing from it
        if (InteractionHandlers.handle_container_deal(player, cell)) return true;

        return false;
    }

    static _dispatch(actionType, id, player, target, context, category, game) {
        const config = INTERACTION_MAPPING[category][id];
        if (config && config[actionType]) {
            const handlerName = config[actionType];
            const handler = InteractionHandlers[handlerName];
            if (handler) {
                const result = handler(player, target, context, game);
                if (result) return true;
            }
        }
        return false;
    }

    static _standardTransfer(player, cell) {


        // Place Held Item
        if (player.heldItem) {

            // Bag-to-Bag Interaction
            if (cell.object && player.heldItem.definitionId === 'bag' && cell.object.definitionId === 'bag') {
                const heldBag = player.heldItem;
                const targetBag = cell.object;

                // Ensure contents arrays exist
                if (!heldBag.state.contents) heldBag.state.contents = [];
                if (!targetBag.state.contents) targetBag.state.contents = [];

                if (heldBag.state.contents.length > 0) {
                    // Transfer held -> target
                    targetBag.state.contents.push(...heldBag.state.contents);
                    heldBag.state.contents = [];
                } else if (targetBag.state.contents.length > 0) {
                    // Transfer target -> held
                    heldBag.state.contents.push(...targetBag.state.contents);
                    targetBag.state.contents = [];
                }

                return true;
            }

            // Box Logic: Put Back
            if (cell.object && cell.object.type === ItemType.Box) {
                if (InteractionHandlers.handle_box_put_back(cell.object, player.heldItem)) {
                    player.heldItem = null;
                    return true;
                }
                // Box Logic: Combine (Hold item and combine with box contents)
                if (InteractionHandlers.handle_box_combine(player, cell.object)) {
                    return true;
                }
            }

            // Special: Place Appliance Item onto Floor
            if (player.heldItem && cell.type.id === 'FLOOR' && !cell.object) {
                // Check if held item is an appliance (via definition type or specific whitelist)
                const def = player.heldItem.definition;
                const isApplianceItem = (def.type === 'appliance' || ['soda_fountain', 'fryer', 'grill', 'counter'].includes(def.id));

                if (isApplianceItem) {
                    // Convert Item -> Tile
                    const tileTypeStr = def.id.toUpperCase(); // Assumes naming convention
                    const tileType = TILE_TYPES[tileTypeStr];

                    if (tileType) {
                        grid.setTileType(cell.x, cell.y, tileType); // Not available in cell context?
                        // Wait, cell object doesn't have x/y usually. We need target from player.
                        const targetX = player.x + player.facing.x;
                        const targetY = player.y + player.facing.y;
                        grid.setTileType(targetX, targetY, tileType);

                        // Restore State
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

            // Combine with item on table
            if (cell.object) {
                const result = InteractionHandlers._tryCombine(player.heldItem, cell.object);
                if (result) {
                    cell.object = result;
                    player.heldItem = null; // Result is on table
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
            // Reset cooking progress if picked up while raw (cooking)
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

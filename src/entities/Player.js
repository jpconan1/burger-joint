import { ASSETS, TILE_TYPES } from '../constants.js';
import { ItemInstance } from './Item.js';
import { DEFINITIONS, ItemType } from '../data/definitions.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.texture = ASSETS.PLAYER.NEUTRAL;
        this.isHappy = false;

        // Tool State - Simplified to just Hands
        this.toolTexture = ASSETS.TOOLS.HANDS;

        // Held Item State
        this.heldItem = null; // Can be ItemInstance or legacy object (during migration)

        // Direction State
        this.facing = { x: 0, y: 1 }; // Default down

        // Appliance Holding State
        this.heldAppliance = null;
    }

    move(dx, dy, grid) {
        // Feature: Turn before Move when holding appliance
        if (this.heldAppliance) {
            if (this.facing.x !== dx || this.facing.y !== dy) {
                this.facing = { x: dx, y: dy };
                return true; // We "moved" (turned)
            }
        }

        // Always update facing direction on input
        this.facing = { x: dx, y: dy };

        const newX = this.x + dx;
        const newY = this.y + dy;

        if (grid.isWalkable(newX, newY)) {
            this.x = newX;
            this.y = newY;
            return true;
        }
        return false;
    }

    getTargetCell(grid) {
        const targetX = this.x + this.facing.x;
        const targetY = this.y + this.facing.y;
        return grid.getCell(targetX, targetY);
    }

    // Put Down / Combine / Pick Up
    // Q (or Space) KEY: Pick Up / Put Down / Combine
    // Space KEY: Pick Up / Put Down / Combine
    actionPickUp(grid, game) {
        // Delegate to Interaction System
        return InteractionSystem.handlePickUp(this, grid, game);
    }

    // Enter KEY: Interact (Change State)
    actionInteract(grid, game) {
        // Delegate to Interaction System
        console.log("Player interacting via System");
        return InteractionSystem.handleInteract(this, grid, game);
    }


    actionPickUpAppliance(grid, game) {
        // Can only pick up if we are NOT holding an item (except maybe if we assimilate it?)
        if (this.heldItem) {
            console.log("Hands full! Cannot pick up appliance.");
            return;
        }

        if (this.heldAppliance) {
            console.log("Already holding an appliance.");
            return;
        }

        const targetX = this.x + this.facing.x;
        const targetY = this.y + this.facing.y;
        const cell = grid.getCell(targetX, targetY);

        if (!cell) return;

        // Restriction: Cannot pick up appliance if there is an item on top
        if (cell.object) {
            game.addFloatingText("Remove item first!", targetX, targetY, '#ff0000');
            console.log("Cannot pick up appliance. Item on top.");
            return;
        }

        // Logic adapted from ConstructionSystem.js (Lines 189-217)
        const isAppliance = cell.type.id !== 'FLOOR' && cell.type.id !== 'WALL' && !cell.type.isDoor && !cell.type.isExit;

        if (isAppliance) {
            const tileTypeId = cell.type.id;
            const savedState = cell.state ? JSON.parse(JSON.stringify(cell.state)) : null;

            // Find definition
            const shopItem = game.shopItems.find(i => i.tileType === tileTypeId);

            if (shopItem) {
                this.heldAppliance = {
                    id: shopItem.id,
                    tileType: tileTypeId,
                    savedState: savedState,
                    attachedObject: cell.object // Save item on top
                };

                // Log what we are picking up
                console.log("Picking up " + tileTypeId);

                // Clear from Grid
                grid.setTileType(targetX, targetY, TILE_TYPES.FLOOR);

                // IMPORTANT: Clear the object from the grid so it moves with the cursor
                if (cell.object) {
                    cell.object = null;
                }

                game.updateCapabilities();
                console.log("Picked up appliance: " + shopItem.id);
                game.addFloatingText("Picked Up!", this.x, this.y, '#ffffff');
            }
        }
    }

    // New: Action to Place Appliance
    actionPlaceAppliance(grid) {
        if (!this.heldAppliance) return;

        const targetX = this.x + this.facing.x;
        const targetY = this.y + this.facing.y;
        const cell = grid.getCell(targetX, targetY);

        if (!cell) return;

        console.log("Trying to place on " + cell.type.id);

        // Validation (Target must be FLOOR)
        if (cell.type.id !== 'FLOOR') {
            console.log("Cannot place here. Blocked by " + cell.type.id);
            return;
        }

        // Cannot place on top of items (unless we implement swapping logic later, simpler to block)
        if (cell.object) {
            console.log("Cannot place here. Blocked by object.");
            return;
        }

        // Place it!
        // We need TILE_TYPES reference. Imported at top.
        const typeDef = TILE_TYPES[this.heldAppliance.tileType];
        if (typeDef) {
            grid.setTileType(targetX, targetY, typeDef);

            // Restore State
            const newCell = grid.getCell(targetX, targetY);
            if (this.heldAppliance.savedState && newCell.state) {
                Object.assign(newCell.state, this.heldAppliance.savedState);
            }

            // Restore attached object
            if (this.heldAppliance.attachedObject) {
                newCell.object = this.heldAppliance.attachedObject;
            }

            this.heldAppliance = null;
            console.log("Placed appliance.");
        }
    }
}

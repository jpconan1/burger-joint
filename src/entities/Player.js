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

        // Visual position for interpolation/animation
        this.visualX = x;
        this.visualY = y;
        this.targetX = x;
        this.targetY = y;

        // Juice
        this.tilt = 0;
        this.walkBob = 0;
    }

    update(dt) {
        if (!dt) return;

        // Constant speed movement in tiles per second
        const moveSpeed = 15; // tiles per second
        const step = (moveSpeed * dt) / 1000;

        // Move visualX towards x
        if (Math.abs(this.x - this.visualX) > step) {
            this.visualX += Math.sign(this.x - this.visualX) * step;
        } else {
            this.visualX = this.x;
        }

        // Move visualY towards y
        if (Math.abs(this.y - this.visualY) > step) {
            this.visualY += Math.sign(this.y - this.visualY) * step;
        } else {
            this.visualY = this.y;
        }

        // Juice: Tilt and Bob while moving
        const isMoving = this.visualX !== this.x || this.visualY !== this.y;
        if (isMoving) {
            this.tilt = Math.sin(Date.now() / 50) * 0.15;
            this.walkBob = Math.sin(Date.now() / 40) * 4;
        } else {
            this.tilt *= 0.7; // Fast decay
            this.walkBob *= 0.7;
            if (Math.abs(this.tilt) < 0.01) this.tilt = 0;
            if (Math.abs(this.walkBob) < 0.1) this.walkBob = 0;
        }
    }

    snap() {
        this.visualX = this.x;
        this.visualY = this.y;
        this.tilt = 0;
        this.walkBob = 0;
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

        // 1. Check for Appliance Tile
        const isAppliance = cell.type.id !== 'FLOOR' && cell.type.id !== 'WALL' && !cell.type.isDoor && !cell.type.isExit;

        if (isAppliance) {
            const tileTypeId = cell.type.id;
            const savedState = cell.state ? JSON.parse(JSON.stringify(cell.state)) : null;

            this.heldAppliance = {
                id: tileTypeId,
                tileType: tileTypeId,
                savedState: savedState,
                attachedObject: cell.object
            };

            grid.setTileType(targetX, targetY, TILE_TYPES.FLOOR);
            if (cell.object) cell.object = null;

            game.updateCapabilities();
            console.log("Picked up appliance: " + tileTypeId);
            game.addFloatingText("Picked Up!", this.x, this.y, '#ffffff');
            return;
        }

        // 2. Object on a counter with no tile appliance underneath
        if (cell.object) {
            game.addFloatingText("Remove item first!", targetX, targetY, '#ff0000');
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

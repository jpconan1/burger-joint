import { InteractionSystem } from './InteractionSystem.js';
import { Grid } from './Grid.js';
import { ItemInstance } from '../entities/Item.js';
import { TILE_TYPES } from '../constants.js';

const POWERUPS = new Set(['keroscene', 'freeze_clock', 'magic_bag', 'bomb']);

function cloneItem(item) {
    if (!item) return null;
    const copy = Object.create(ItemInstance.prototype);
    copy.definitionId = item.definitionId;
    copy.state = cloneValue(item.state);
    copy.timestamp = item.timestamp;
    return copy;
}

function cloneValue(value) {
    if (value instanceof ItemInstance) return cloneItem(value);
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
    }
    return value;
}

function snapshotPlayer(player) {
    return JSON.stringify({
        heldItem: player.heldItem?.serialize() || null,
        heldAppliance: player.heldAppliance
    });
}

function snapshotCell(cell) {
    return JSON.stringify([cell.type.id, cell.state, cell.object?.serialize() || null]);
}

// Run the real action rules on disposable copies. A handler returning true can merely
// absorb an input, so compare state instead of trusting its return value.
function actionWouldChange(player, grid, action) {
    const copies = new Map();
    const originals = new Map();
    const previewGrid = {
        width: grid.width,
        height: grid.height,
        getCell(x, y) {
            const original = grid.getCell(x, y);
            if (!original) return null;
            const key = `${x},${y}`;
            if (!copies.has(key)) {
                const copy = {
                    type: original.type,
                    state: cloneValue(original.state || {}),
                    object: cloneItem(original.object)
                };
                copies.set(key, copy);
                originals.set(key, snapshotCell(copy));
            }
            return copies.get(key);
        },
        setTileType(x, y, type) {
            Grid.prototype.setTileType.call(this, x, y, type);
        }
    };
    const previewPlayer = {
        x: player.x,
        y: player.y,
        facing: player.facing,
        heldItem: cloneItem(player.heldItem),
        heldAppliance: player.heldAppliance ? cloneValue(player.heldAppliance) : null,
        getTargetCell(targetGrid) {
            return targetGrid.getCell(this.x + this.facing.x, this.y + this.facing.y);
        }
    };
    const previewGame = { tutorialFlags: {}, powerupSystem: null, updateCapabilities() {} };
    previewGrid.getCell(player.x + player.facing.x, player.y + player.facing.y);
    const before = snapshotPlayer(previewPlayer);
    const randomSeed = ItemInstance.randomProvider.seed;
    try {
        if (action === 'pickup') InteractionSystem.handlePickUp(previewPlayer, previewGrid, previewGame);
        else InteractionSystem.handleInteract(previewPlayer, previewGrid, previewGame);
        return snapshotPlayer(previewPlayer) !== before ||
            [...copies].some(([key, cell]) => snapshotCell(cell) !== originals.get(key));
    } catch (error) {
        // A preview must never interrupt play if an unusual item lacks preview data.
        return false;
    } finally {
        ItemInstance.randomProvider.seed = randomSeed;
    }
}

export function canTargetCell(player, grid, game) {
    const cell = player.getTargetCell(grid);
    if (!cell) return false;

    if (cell.type.id === 'MENU') return !!game.isEndgameUnlocked;
    if (cell.type.id === 'SERVICE_WINDOW') return !!game.isPrepTime;

    const powerup = cell.object?.definitionId;
    if (POWERUPS.has(powerup)) return powerup !== 'magic_bag' || !player.heldItem;

    if (cell.type.id === 'GARBAGE') {
        if (player.heldItem) {
            return !player.heldItem.definition.useStackRender || (player.heldItem.state.contents || []).length > 0;
        }
        return !!cell.state?.trashedItem;
    }

    if (player.heldAppliance) {
        const canPlace = !cell.object && (
            (cell.type.id === 'COUNTER' && player.heldAppliance.id === 'soda_fountain') ||
            (cell.type.id === 'FLOOR' && !!TILE_TYPES[player.heldAppliance.tileType])
        );
        if (canPlace) return true;
        return actionWouldChange(player, grid, 'interact');
    }

    return actionWouldChange(player, grid, 'pickup') || actionWouldChange(player, grid, 'interact');
}

/**
 * TUTORIAL STEPS CONFIGURATION
 * 
 * Define your interactive tutorial bubbles here.
 * See src/data/TUTORIAL_README.md for full documentation.
 * 
 * Properties:
 * - id: Unique string ID
 * - text: Message to display. Supports dynamic keys using [ACTION], e.g. "Press [INTERACT]"
 * - targetType: TILE_TYPE id to attach to (e.g. 'SODA_FOUNTAIN')
 * - predicate: (gameState, entity) => boolean. Return true to show bubble.
 */

const isPattyBoxPresent = (gameState) => {
    // Check held item (Safety check for player existence)
    if (gameState.player && gameState.player.heldItem && gameState.player.heldItem.definitionId === 'patty_box') return true;

    // Check grid for dropped box
    if (gameState.grid) {
        for (let y = 0; y < gameState.grid.height; y++) {
            for (let x = 0; x < gameState.grid.width; x++) {
                const cell = gameState.grid.getCell(x, y);
                if (cell.object && cell.object.definitionId === 'patty_box') return true;
            }
        }
    }
    return false;
};

const isPattyCooking = (gameState) => {
    const mainRoom = gameState.rooms['main'];
    if (!mainRoom) return false;

    for (let y = 0; y < mainRoom.height; y++) {
        for (let x = 0; x < mainRoom.width; x++) {
            const cell = mainRoom.getCell(x, y);
            if (cell.type.id === 'GRILL' && cell.object && cell.object.definitionId === 'beef_patty') {
                return true;
            }
        }
    }
    return false;
};

const isPattyOrBurger = (gameState) => {
    const mainRoom = gameState.rooms['main'];
    if (!mainRoom) return false;

    const checkObject = (obj) => {
        if (!obj) return false;
        if (obj.definitionId.includes('burger')) return true;
        // Check for patty in any state (raw, cooking, cooked)
        if (obj.definitionId === 'beef_patty') return true;
        return false;
    };

    // Check held item
    if (gameState.player && gameState.player.heldItem) {
        if (checkObject(gameState.player.heldItem)) return true;
    }

    // Check grid
    for (let y = 0; y < mainRoom.height; y++) {
        for (let x = 0; x < mainRoom.width; x++) {
            const cell = mainRoom.getCell(x, y);
            if (cell.object && checkObject(cell.object)) return true;
        }
    }
    return false;
};

const areAllEssentialsInKitchen = (gameState) => {
    const mainRoom = gameState.rooms['main'];
    if (!mainRoom) return false;

    const essentials = new Set(['patty_box', 'bun_box', 'wrapper_box', 'bag_box']);
    const found = new Set();

    // Check grid
    for (let y = 0; y < mainRoom.height; y++) {
        for (let x = 0; x < mainRoom.width; x++) {
            const cell = mainRoom.getCell(x, y);
            if (cell.object && essentials.has(cell.object.definitionId)) {
                found.add(cell.object.definitionId);
            }
        }
    }

    // Check player held item if in main room
    if (gameState.currentRoomId === 'main' && gameState.player && gameState.player.heldItem) {
        if (essentials.has(gameState.player.heldItem.definitionId)) {
            found.add(gameState.player.heldItem.definitionId);
        }
    }

    return found.size === essentials.size;
};

const isBurgerWithState = (gameState, isWrapped) => {
    const mainRoom = gameState.rooms['main'];
    if (!mainRoom) return false;

    const checkObject = (obj) => {
        if (!obj) return false;
        if (obj.definitionId.includes('burger') && !!obj.state.isWrapped === isWrapped) return true;
        return false;
    };

    // Check held item
    if (gameState.player && gameState.player.heldItem) {
        if (checkObject(gameState.player.heldItem)) return true;
    }

    // Check grid
    for (let y = 0; y < mainRoom.height; y++) {
        for (let x = 0; x < mainRoom.width; x++) {
            const cell = mainRoom.getCell(x, y);
            if (cell.object && checkObject(cell.object)) return true;
        }
    }
    return false;
};

const isBurgerInBag = (gameState) => {
    const mainRoom = gameState.rooms['main'];
    if (!mainRoom) return false;

    const checkBag = (item) => {
        if (!item) return false;
        // Check if item is a bag
        if (item.definitionId !== 'bag') return false;

        // Check contents
        if (item.state && item.state.contents) {
            return item.state.contents.some(content => content.definitionId.includes('burger'));
        }
        return false;
    };

    // Check held item
    if (gameState.player && checkBag(gameState.player.heldItem)) return true;

    // Check grid
    for (let y = 0; y < mainRoom.height; y++) {
        for (let x = 0; x < mainRoom.width; x++) {
            const cell = mainRoom.getCell(x, y);
            if (cell.object && checkBag(cell.object)) return true;
        }
    }
    return false;
};

const isBurgerOnPlate = (gameState) => {
    const mainRoom = gameState.rooms['main'];
    if (!mainRoom) return false;

    const checkPlate = (item) => {
        if (!item || item.definitionId !== 'plate') return false;

        // Check contents
        if (item.state && item.state.contents) {
            return item.state.contents.some(content => content.definitionId.includes('burger'));
        }
        return false;
    };

    // Check held item
    if (gameState.player && checkPlate(gameState.player.heldItem)) return true;

    // Check grid
    for (let y = 0; y < mainRoom.height; y++) {
        for (let x = 0; x < mainRoom.width; x++) {
            const cell = mainRoom.getCell(x, y);
            if (cell.object && checkPlate(cell.object)) return true;
        }
    }
    return false;
};

const isHoldingPlate = (gameState) => {
    return gameState.player && gameState.player.heldItem && gameState.player.heldItem.definitionId === 'plate';
};

const isPlateOnServiceCounter = (gameState) => {
    const mainRoom = gameState.rooms['main'];
    if (!mainRoom) return false;

    for (let y = 0; y < mainRoom.height; y++) {
        for (let x = 0; x < mainRoom.width; x++) {
            const cell = mainRoom.getCell(x, y);
            if (cell.type.id === 'SERVICE' && cell.object && cell.object.definitionId === 'plate') {
                return true;
            }
        }
    }
    return false;
};

const isTicket3Active = (gameState) => {
    if (!gameState.activeTickets) return false;
    return gameState.activeTickets.some(t => t.id === 3);
};

const isItemInChute = (gameState, itemId) => {
    // 1. Landing spot (0, 7)
    const mainRoom = gameState.rooms['main'];
    if (mainRoom) {
        const cell = mainRoom.getCell(0, 7);
        if (cell.object && cell.object.definitionId === itemId) return true;
    }
    // 2. Falling
    if (gameState.fallingBoxes && gameState.fallingBoxes.some(fb => fb.item?.definitionId === itemId)) return true;
    return false;
};

const getBagBurgerCount = (item) => {
    if (!item || item.definitionId !== 'bag' || !item.state || !item.state.contents) return 0;
    return item.state.contents.filter(c => c.definitionId.includes('burger')).length;
};

const isFryBagPresent = (gameState) => {
    const mainRoom = gameState.rooms['main'];
    if (!mainRoom) return false;

    const isBag = (obj) => obj && (obj.definitionId === 'fry_bag' || obj.definitionId === 'fry_bag_open');

    // Check held
    if (gameState.player && isBag(gameState.player.heldItem)) return true;

    // Check grid
    for (let y = 0; y < mainRoom.height; y++) {
        for (let x = 0; x < mainRoom.width; x++) {
            const cell = mainRoom.getCell(x, y);
            if (isBag(cell.object)) return true;
        }
    }
    return false;
};

const isFriesCooking = (gameState) => {
    const mainRoom = gameState.rooms['main'];
    if (!mainRoom) return false;

    // Check grid for fryer containing raw_fries in 'down' state
    for (let y = 0; y < mainRoom.height; y++) {
        for (let x = 0; x < mainRoom.width; x++) {
            const cell = mainRoom.getCell(x, y);
            if (cell.type.id === 'FRYER' && cell.object && cell.object.definitionId === 'raw_fries') {
                return true;
            }
        }
    }
    return false;
};

const isTicket4Active = (gameState) => {
    if (!gameState.activeTickets) return false;
    return gameState.activeTickets.some(t => t.id === 4);
};

export const TUTORIAL_STEPS = [
    {
        id: 'pickup_patty',
        text: "Pick up!\n[PICK_UP]",
        targetType: 'patty_box',
        completionPredicate: (gameState) => {
            // Complete if player picks up the box
            return gameState.player.heldItem && gameState.player.heldItem.definitionId === 'patty_box';
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            return true;
        }
    },
    {
        id: 'pickup_bags',
        text: "Get the take out bags!",
        targetType: 'bag_box',
        completionPredicate: (gameState) => {
            return gameState.player.heldItem && gameState.player.heldItem.definitionId === 'bag_box';
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            return isTicket3Active(gameState);
        }
    },
    {
        id: 'pickup_wrappers',
        text: "Wrap takeout burgers!",
        targetType: 'wrapper_box',
        completionPredicate: (gameState) => {
            return gameState.player.heldItem && gameState.player.heldItem.definitionId === 'wrapper_box';
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            // Only show after bag box is moved from chute
            return isTicket3Active(gameState) && !isItemInChute(gameState, 'bag_box');
        }
    },
    {
        id: 'deal_patty',
        text: "Deal!\n[INTERACT]",
        targetType: 'GRILL',
        completionPredicate: (gameState) => isPattyCooking(gameState),
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            if (gameState.currentRoomId !== 'main') return false;

            // Only show if holding a patty box
            if (!gameState.player.heldItem || gameState.player.heldItem.definitionId !== 'patty_box') return false;

            // Find all grills to identify the middle one
            const grills = [];
            const mainRoom = gameState.rooms['main'];
            if (mainRoom) {
                for (let y = 0; y < mainRoom.height; y++) {
                    for (let x = 0; x < mainRoom.width; x++) {
                        const cell = mainRoom.getCell(x, y);
                        if (cell.type.id === 'GRILL') {
                            grills.push({ x, y, cell });
                        }
                    }
                }
            }

            if (grills.length === 0) return false;
            grills.sort((a, b) => a.x - b.x);
            const middleIndex = Math.floor((grills.length - 1) / 2);
            return entity === grills[middleIndex].cell;
        }
    },
    {
        id: 'get_plate',
        text: "Get a plate!",
        targetType: 'plate',
        completionPredicate: (gameState) => isHoldingPlate(gameState) || isPlateOnServiceCounter(gameState),
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            // Show after patty starts cooking if no plate yet
            return isPattyCooking(gameState) && !isHoldingPlate(gameState) && !isPlateOnServiceCounter(gameState);
        }
    },
    {
        id: 'plate_here',
        text: "Plate here!",
        targetType: 'SERVICE',
        completionPredicate: (gameState) => isPlateOnServiceCounter(gameState),
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            if (!isHoldingPlate(gameState)) return false;

            // Target first service counter (4, 0)
            const mainRoom = gameState.rooms['main'];
            if (mainRoom) {
                const targetCell = mainRoom.getCell(4, 0);
                return entity === targetCell;
            }
            return false;
        }
    },
    {
        id: 'get_buns',
        text: "Get your buns!",
        targetType: 'bun_box',
        completionPredicate: (gameState) => {
            return gameState.player.heldItem && gameState.player.heldItem.definitionId === 'bun_box';
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            return isPlateOnServiceCounter(gameState);
        }
    },
    {
        id: 'combine_bun_patty',
        text: "Combine with [bun.png]!",
        targetType: 'beef_patty',
        completionPredicate: (gameState) => {
            // Complete if player has a burger (bun + meat)
            // simplified check: holding item is burger OR there's a burger on grid
            if (gameState.player.heldItem && gameState.player.heldItem.definitionId.includes('burger')) return true;
            return false;
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;

            // Show on the patty itself (whether on stove or held)
            // entity.object is the patty item
            if (entity.object && entity.object.definitionId === 'beef_patty' && entity.object.state.cook_level === 'cooked') {
                return true;
            }
            return false;
        }
    },
    {
        id: 'plate_burger',
        text: "Plate the burger!",
        targetType: 'plate',
        completionPredicate: (gameState) => isBurgerOnPlate(gameState),
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;

            // Only show if player is holding an unwrapped burger
            const held = gameState.player?.heldItem;
            if (!held || !held.definitionId.includes('burger') || held.state.isWrapped) return false;

            // Target the plate on service counter (4, 0)
            const mainRoom = gameState.rooms['main'];
            if (mainRoom && entity === mainRoom.getCell(4, 0)) {
                return entity.object && entity.object.definitionId === 'plate';
            }
            return false;
        }
    },
    {
        id: 'get_fry_bag',
        text: "Get [fry_bag.png]!",
        targetType: 'fry_box',
        completionPredicate: (gameState) => isFryBagPresent(gameState),
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            return isTicket4Active(gameState) && !isFryBagPresent(gameState);
        }
    },
    {
        id: 'fries_in_fryer',
        text: "Put in [fryer.png]!",
        targetType: (gameState) => {
            // Priority: target held fry bag if player has one
            if (gameState.player?.heldItem && (gameState.player.heldItem.definitionId === 'fry_bag' || gameState.player.heldItem.definitionId === 'fry_bag_open')) {
                return 'player'; // This might need a trick in TutorialOverlay but findTargetsByType supports 'player' search by definitionId
            }
            return 'fry_bag'; // Default search by definitionId
        },
        completionPredicate: (gameState) => isFriesCooking(gameState),
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            if (isFriesCooking(gameState)) return false;

            // Target the fry bag (held or on grid)
            const obj = entity.object || (entity === gameState.player ? gameState.player.heldItem : null);
            return obj && (obj.definitionId === 'fry_bag' || obj.definitionId === 'fry_bag_open');
        }
    },

    {
        id: 'pack_burger',
        text: "Put in [bag.png]!",
        targetType: 'plain_burger',
        completionPredicate: (gameState) => isBurgerInBag(gameState),
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            // Target wrapped burgers only
            if (entity.object && entity.object.definitionId.includes('burger') && entity.object.state.isWrapped) return true;
            return false;
        }
    },
    {
        id: 'serve_at_counter',
        text: "Put the\nbag here!",
        targetType: 'SERVICE',
        completionPredicate: (gameState) => {
            // Check if there is a bag on the service counter
            if (gameState.grid) {
                for (let y = 0; y < gameState.grid.height; y++) {
                    for (let x = 0; x < gameState.grid.width; x++) {
                        const cell = gameState.grid.getCell(x, y);
                        // Check for service counter with bag
                        if (cell.type.id === 'SERVICE' && cell.object && cell.object.definitionId === 'bag') {
                            return true;
                        }
                    }
                }
            }
            return false;
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            // Show only if PLAYER is holding a bag with a burger
            const held = gameState.player ? gameState.player.heldItem : null;
            if (held && held.definitionId === 'bag' && held.state.contents && held.state.contents.some(c => c.definitionId.includes('burger'))) {
                return true;
            }
            return false;
        }
    }

];


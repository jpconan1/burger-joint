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
            if (cell.type.id === 'STOVE' && cell.object && cell.object.definitionId === 'beef_patty') {
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

const getBagBurgerCount = (item) => {
    if (!item || item.definitionId !== 'bag' || !item.state || !item.state.contents) return 0;
    return item.state.contents.filter(c => c.definitionId.includes('burger')).length;
};

export const TUTORIAL_STEPS = [
    {
        id: 'start_game',
        text: "GO!\n[movement_keys]",
        targetType: 'SHUTTER_DOOR',
        completionPredicate: (gameState) => isPattyBoxPresent(gameState),
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            // Only show in main room
            if (gameState.currentRoomId !== 'main') return false;
            return true;
        }
    },
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
        id: 'place_patty_box',
        text: "Put down!\n[PICK_UP]",
        targetType: 'COUNTER',
        completionPredicate: (gameState) => {
            if (!gameState.grid) return false;
            // Complete if patty box is found on ANY counter tile
            for (let y = 0; y < gameState.grid.height; y++) {
                for (let x = 0; x < gameState.grid.width; x++) {
                    const cell = gameState.grid.getCell(x, y);
                    if (cell.type.id === 'COUNTER' && cell.object && cell.object.definitionId === 'patty_box') {
                        return true;
                    }
                }
            }
            return false;
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            if (gameState.currentRoomId !== 'main') return false;

            // Target the specific counter next to soda fountain (2,3)
            if (!gameState.grid) return false;
            if (gameState.grid.getCell(2, 3) !== entity) return false;

            // Show if holding the patty box
            return gameState.player.heldItem && gameState.player.heldItem.definitionId === 'patty_box';
        }
    },
    {
        id: 'open_patty_box',
        text: "Open!\n[INTERACT]",
        targetType: 'patty_box',
        completionPredicate: (gameState) => {
            // Complete if any patty box is open
            if (gameState.grid) {
                for (let y = 0; y < gameState.grid.height; y++) {
                    for (let x = 0; x < gameState.grid.width; x++) {
                        const cell = gameState.grid.getCell(x, y);
                        if (cell.object && cell.object.definitionId === 'patty_box' && cell.object.state.isOpen) return true;
                    }
                }
            }
            return false;
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            if (gameState.currentRoomId !== 'main') return false;

            // Don't show if held (wait for it to be placed)
            if (gameState.player.heldItem === entity.object) return false;

            // Only show if closed
            return entity.object && !entity.object.state.isOpen;
        }
    },
    {
        id: 'take_patty',
        text: "Take!\n[PICK_UP]",
        targetType: 'patty_box',
        completionPredicate: (gameState) => {
            // Complete if player is holding a beef patty
            return gameState.player.heldItem && gameState.player.heldItem.definitionId === 'beef_patty';
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            // Only show on open boxes
            return entity.object && entity.object.state.isOpen;
        }
    },
    {
        id: 'cook_patty',
        text: "Cook!\n[PICK_UP]",
        targetType: 'STOVE',
        completionPredicate: (gameState) => {
            if (!gameState.grid) return false;
            // Complete if there is a COOKED patty on any stove tile
            for (let y = 0; y < gameState.grid.height; y++) {
                for (let x = 0; x < gameState.grid.width; x++) {
                    const cell = gameState.grid.getCell(x, y);
                    if (cell.type.id === 'STOVE' && cell.object &&
                        cell.object.definitionId === 'beef_patty' &&
                        cell.object.state.cook_level === 'cooked') {
                        return true;
                    }
                }
            }
            return false;
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            // Only show if holding a patty
            return gameState.player.heldItem && gameState.player.heldItem.definitionId === 'beef_patty';
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
        id: 'wrap_burger',
        text: "Combine with [wrapper.png]!",
        targetType: 'plain_burger',
        completionPredicate: (gameState) => isBurgerWithState(gameState, true),
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            // Target specific entity: check if THIS entity is unwrapped burger
            if (entity.object && entity.object.definitionId.includes('burger') && !entity.object.state.isWrapped) return true;
            return false;
        }
    },
    {
        id: 'wrapper_here',
        text: "Here!",
        targetType: 'wrapper_box',
        completionPredicate: (gameState) => {
            // Check if wrapper box is open
            if (gameState.grid) {
                for (let y = 0; y < gameState.grid.height; y++) {
                    for (let x = 0; x < gameState.grid.width; x++) {
                        const cell = gameState.grid.getCell(x, y);
                        if (cell.object && cell.object.definitionId === 'wrapper_box' && cell.object.state.isOpen) return true;
                    }
                }
            }
            return false;
        },
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            // Only show if we need to wrap a burger (Unwrapped burger exists)
            if (!isBurgerWithState(gameState, false)) return false;

            // Only show on closed wrapper box
            if (entity.object && !entity.object.state.isOpen) return true;
            return false;
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
    },
    {
        id: 'add_second_burger',
        text: "One more [burger-wrapped.png]!",
        targetType: 'bag',
        completionPredicate: (gameState) => gameState.dailyBagsSold > 0,
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            // Target bag with exactly 1 burger
            if (entity.object && getBagBurgerCount(entity.object) === 1) return true;
            return false;
        }
    },
    {
        id: 'retrieve_essentials',
        text: "Get the rest!",
        targetType: 'SHUTTER_DOOR',
        completionPredicate: (gameState) => areAllEssentialsInKitchen(gameState),
        predicate: (gameState, entity) => {
            if (gameState.dayNumber !== 1) return false;
            if (gameState.currentRoomId !== 'main') return false;

            // Show if any patty exists (raw/cooked) OR burger, AND we don't have everything yet
            return isPattyOrBurger(gameState) && !areAllEssentialsInKitchen(gameState);
        }
    },
    {
        id: 'check_orders_wheel',
        targetType: 'TICKET_WHEEL',
        text: (gameState) => {
            if (gameState.ticketWheelAnimStartTime && (Date.now() - gameState.ticketWheelAnimStartTime < 1000)) {
                return "Swapped ticket!\n[VIEW_ORDERS]";
            }
            return "Check!\n[VIEW_ORDERS]";
        },
        completionPredicate: (gameState) => gameState.isViewingOrders,
        predicate: (gameState) => {
            if (gameState.dayNumber !== 1) return false;
            if (gameState.currentRoomId !== 'main') return false;

            // Only show after the 'one more burger' step is complete (first sale made)
            return gameState.dailyBagsSold > 0;
        }
    }
];


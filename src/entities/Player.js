import { ASSETS, TILE_TYPES } from '../constants.js';
import { ItemInstance } from './Item.js';
import { DEFINITIONS, ItemType } from '../data/definitions.js';

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
    }

    move(dx, dy, grid) {
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

    // SPACE KEY: Pick Up / Put Down / Combine
    actionPickUp(grid) {
        const cell = this.getTargetCell(grid);
        if (!cell) return;

        // CUTTING BOARD LOGIC (Specific State Machine)
        if (cell.type.id === 'CUTTING_BOARD') {
            const cbState = cell.state || {}; // Ensure state object exists

            if (this.heldItem) {
                // Try to place Tomato
                if (this.heldItem.definitionId === 'tomato') {
                    if (!cbState.status || cbState.status === 'empty') {
                        cell.state = { status: 'has_tomato' };
                        this.heldItem = null;
                        console.log('Placed tomato on cutting board');
                        return;
                    }
                }
            } else {
                // Try to pick up Slice
                if (cbState.status === 'has_slice') {
                    // Create Slice Item
                    const slice = new ItemInstance('tomato_slice');
                    this.heldItem = slice;
                    // Cutting board doesn't get dirty anymore, just empty
                    cell.state = { status: 'empty' };
                    console.log('Picked up tomato slice');
                    return;
                }
            }
        }

        // DISPENSER LOGIC (Pick Up / Loading / Apply Mayo)
        if (cell.type.id === 'DISPENSER') {
            // New: Allow applying mayo with Pick Up key as well
            if (this._tryApplyMayo(cell)) return;

            if (this.heldItem && this.heldItem.definitionId === 'mayo_bag') {
                const dispState = cell.state || {};
                if (!dispState.status || dispState.status === 'empty') {
                    cell.state = {
                        status: 'has_mayo',
                        charges: 15
                    };
                    this.heldItem = null;
                    console.log('Loaded mayo bag into dispenser. Charges: 15');
                    return;
                }
            }
        }

        // FRYER LOGIC (Loading)
        if (cell.type.id === 'FRYER') {
            // Load Fryer with Open Fry Bag
            if (this.heldItem && this.heldItem.definitionId === 'fry_bag_open') {
                const fryerState = cell.state || {};

                // Only load if empty
                if (!fryerState.status || fryerState.status === 'empty') {
                    // Preserve existing state (cookingSpeed)
                    cell.state.status = 'loaded';
                    // Consume Charge
                    this.heldItem.state.charges = (this.heldItem.state.charges || 0) - 1;
                    console.log(`Loaded fryer. Charges remaining: ${this.heldItem.state.charges}`);

                    if (this.heldItem.state.charges <= 0) {
                        this.heldItem = null;
                        console.log('Fry bag empty, discarded.');
                    }
                    return;
                }
            }

            // Pick up 'done' fries with Side Cup
            if (cell.state && cell.state.status === 'done') {
                if (this.heldItem && this.heldItem.definitionId === 'side_cup') {
                    // Success: Convert Side Cup to Fries
                    // Create new item 'fries' (or just change definition of held item if simple)
                    // Better to create new instance to ensure clean state
                    const fries = new ItemInstance('fries');
                    this.heldItem = fries;

                    // Reset Fryer
                    cell.state.status = 'empty';
                    console.log('Fries served!');
                    return;
                }

                console.log('Fries are done! Use a Side Cup to pick them up.');
                return;
            }
        }

        // SODA FOUNTAIN LOGIC
        if (cell.type.id === 'SODA_FOUNTAIN') {
            const sfState = cell.state || {};

            // 1. Loading Syrup (Refill)
            if (this.heldItem && this.heldItem.definitionId === 'soda_syrup') {
                if (!sfState.status || sfState.status === 'empty') {
                    cell.state = {
                        status: 'full',
                        charges: 20
                    };
                    this.heldItem = null;
                    console.log('Soda fountain refilled. 20 charges.');
                    return;
                }
            }

            // 2. Filling Cup (Start)
            // "pick_up_key while holding the drink_cup on a soda_fountain with charges starts filling"
            // Condition: Holding Drink Cup AND Fountain has charges (full or warning)
            if (this.heldItem && this.heldItem.definitionId === 'drink_cup') {
                if (sfState.status === 'full' || sfState.status === 'warning') {
                    // Start Filling
                    sfState.status = 'filling';
                    sfState.timer = 0; // Reset timer for filling process
                    sfState.fillDuration = 3000; // 3 seconds
                    sfState.tempHeldCup = this.heldItem; // Store cup to return later (conceptually)

                    this.heldItem = null; // Take cup from player
                    console.log('Started filling soda...');
                    return;
                }
            }

            // 3. Pick Up Final Soda
            // Condition: Fountain is 'done' AND Player Hands Empty
            // "pick_up_key to get the final item, soda.png"
            if (sfState.status === 'done' && !this.heldItem) {
                // Determine next state based on charges
                // "soda_fountain loses one charge" - Charges were likely decremented at start or end? 
                // Prompt: "the soda_fountain loses one charge AND updates to the correct asset"
                // Let's decrement NOW.

                sfState.charges = (sfState.charges || 0) - 1;
                console.log(`Soda retrieved. Charges remaining: ${sfState.charges}`);

                // Give Soda to Player
                this.heldItem = new ItemInstance('soda');

                // Update State
                if (sfState.charges <= 0) {
                    sfState.status = 'empty';
                } else if (sfState.charges <= 3) {
                    sfState.status = 'warning';
                } else {
                    sfState.status = 'full';
                }

                // Done state is transient, holding the cup. Resetting logic handled above.
                return;
            }
        }

        if (this.heldItem) {
            // Case 1: Holding Item -> Try to Place or Combine
            if (!cell.object) {
                // Garbage Logic
                if (cell.type.id === 'GARBAGE') {
                    console.log(`Trashed item: ${this.heldItem.definitionId}`);
                    this.heldItem = null;
                    return;
                }

                // Place on empty cell (if it holds items)
                if (cell.type.holdsItems) {
                    // STOVE RESTRICTION: Only place cookable items
                    if (cell.type.id === 'STOVE') {
                        if (this.heldItem.definition && this.heldItem.definition.cooking) {
                            cell.object = this.heldItem;
                            this.heldItem = null;
                        } else {
                            console.log("Only cookable items can be placed on the stovetop.");
                        }
                        return;
                    }

                    cell.object = this.heldItem;
                    this.heldItem = null;
                }
            } else {
                // Try putting back into box first
                if (cell.object.type === ItemType.Box) {
                    if (this._handleBoxPutBack(cell.object, this.heldItem)) {
                        this.heldItem = null;
                        return;
                    }

                    // Try combining held item with item INSIDE box (Pick Up + Combine shortcut)
                    if (this._handleBoxCombine(cell.object, this.heldItem)) {
                        return;
                    }
                }

                // Combine Logic
                const result = this._tryCombine(this.heldItem, cell.object);
                if (result) {
                    cell.object = result;
                    this.heldItem = null;
                } else {
                    console.log('Combine unimplemented/invalid - holding onto item.');
                }
            }
        } else {
            // Case 2: Empty Hands -> Try to Pick Up
            if (!cell.object) return;

            const target = cell.object;

            // Handle ItemInstance logic
            if (target instanceof ItemInstance || target.type) {
                // Determine Logic based on Item Type
                const type = target.type;

                if (type === ItemType.Box) {
                    this._handleBoxPickup(cell, target);
                } else {
                    // Regular Pickup (Ingredients, Containers, Composites)

                    // Success
                    this.heldItem = target;
                    cell.object = null;
                }
            } else {
                this.heldItem = target;
                cell.object = null;
            }
        }
    }

    // E KEY: Interact (Change State)
    actionInteract(grid) {
        const cell = this.getTargetCell(grid);
        if (!cell) return;

        const target = cell.object;

        // CUTTING BOARD INTERACTION
        if (cell.type.id === 'CUTTING_BOARD') {
            const cbState = cell.state || {}; // Ensure state

            if (cbState.status === 'has_tomato') {
                cell.state.status = 'has_slice';
                console.log('Cut tomato into slice');
                return;
            }
            return;
        }

        // FRYER LOGIC (Cooking)
        if (cell.type.id === 'FRYER') {
            const fryerState = cell.state || {};
            // Interact Key drops the fries
            if (fryerState.status === 'loaded') {
                fryerState.status = 'down';
                fryerState.timer = 0; // Initialize timer
                console.log('Fries dropped!');
                return;
            }
            return;
        }

        // DISPENSER INTERACTION (Applying Mayo)
        if (this._tryApplyMayo(cell)) return;




        // 1. Item Interaction (Priority)
        if (target && target instanceof ItemInstance) {
            // Bag Unpacking Logic
            if (target.definitionId === 'bag') {
                if (!this.heldItem) {
                    const contents = target.state.contents || [];
                    if (contents.length > 0) {
                        const removedItem = contents.pop();
                        this.heldItem = removedItem;
                        console.log(`Unpacked ${removedItem.definitionId} from bag.`);
                        return;
                    }
                }
            }

            // Unwrapping Logic
            if (target.type === ItemType.Composite && target.state.isWrapped) {
                target.state.isWrapped = false;
                console.log('Burger unwrapped.');
                return;
            }

            // Fry Bag Opening Logic (On Counter/Held by Counter logic if placed)
            if (target.definitionId === 'fry_bag') {
                // Start opening
                console.log('Opening fry bag...');
                // Directly swap to open bag
                const openBag = new ItemInstance('fry_bag_open');
                cell.object = openBag;
                console.log('Fry bag opened!');
                return;
            }

            if (target.type === ItemType.Box) {
                // Box Interaction Logic

                // Interact Key on Empty Box -> No Function (as per user request)
                if (target.state.count <= 0) {
                    console.log('Box is empty. Use Pick Up key to move it.');
                    return;
                }

                // Normal Box: Open/Close
                target.state.isOpen = !target.state.isOpen;
                console.log('Box state:', target.state.isOpen ? 'OPEN' : 'CLOSED');
                return;
            }
        }

        // 2. Tile Interaction
        if (cell.type.id === 'STOVE') {
            if (cell.state) {
                cell.state.isOn = !cell.state.isOn;
                console.log(`Stovetop ${cell.state.isOn ? 'ON' : 'OFF'}`);
            }
        }
    }

    _tryApplyMayo(cell) {
        if (cell.type.id !== 'DISPENSER') return false;

        const dispState = cell.state || {};
        if (dispState.status !== 'has_mayo' || !this.heldItem) return false;

        let newBurger = null;

        if (this.heldItem.definitionId === 'plain_burger') {
            newBurger = new ItemInstance('burger_mayo');
            // Preserve state if needed (bun/patty/toppings)
            newBurger.state.bun = this.heldItem.state.bun;
            newBurger.state.patty = this.heldItem.state.patty;
            newBurger.state.toppings = this.heldItem.state.toppings;
            console.log('Added mayo to burger');
        } else if (this.heldItem.definitionId === 'burger_tomato') {
            newBurger = new ItemInstance('burger_tomato_mayo');
            // Preserve state
            newBurger.state.bun = this.heldItem.state.bun;
            newBurger.state.patty = this.heldItem.state.patty;
            newBurger.state.toppings = this.heldItem.state.toppings;
            console.log('Added mayo to burger with tomato');
        }

        if (newBurger) {
            this.heldItem = newBurger;

            // Deplete Dispenser
            dispState.charges = (dispState.charges || 0) - 1;
            console.log(`Dispenser charges: ${dispState.charges}`);

            if (dispState.charges <= 0) {
                dispState.status = 'empty';
                dispState.charges = 0;
                console.log('Dispenser is now empty!');
            }
            return true;
        }
        return false;
    }

    _handleBoxPickup(cell, boxItem) {
        const state = boxItem.state;
        const def = boxItem.definition;

        // If box is OPEN and HAS ITEMS, we take an item OUT of it.
        if (state.isOpen && state.count > 0) {
            // Produce item
            const productDefId = def.produces;
            const newItem = new ItemInstance(productDefId);

            this.heldItem = newItem;
            state.count--;
            console.log(`Produced ${productDefId}. Remaining: ${state.count}`);

            if (state.count <= 0) {
                console.log('Box is now EMPTY');
                // Optional: Auto-close or visual change? 
                // User said "box-empty should just be a normal item".
                // We leave it as is, next interaction (pickup) will pick up the box itself.
            }
        } else {
            // If box is CLOSED or EMPTY, we pick up the BOX ITSELF.
            this.heldItem = boxItem;
            cell.object = null;
        }
    }

    _handleBoxPutBack(box, item) {
        // Enforce Box Open
        if (!box.state.isOpen) {
            console.log("Box is closed. Cannot put items in.");
            return false;
        }

        const boxDef = box.definition;

        // 1. Check if Item matches Box 'produces'
        if (item.definitionId !== boxDef.produces) {
            console.log(`Wrong item. This box is for ${boxDef.produces}, but you are holding ${item.definitionId}.`);
            return false;
        }

        // 2. Check for Specific Flags (Cooked/Modified)
        if (item.definitionId === 'beef_patty') {
            if (item.state.cook_level !== 'raw') {
                console.log("Cannot put cooked patties back in the box! Only raw patties allowed.");
                return false;
            }
        }

        // 3. Check Capacity
        if (box.state.count >= boxDef.maxCount) {
            console.log("Box is full!");
            return false;
        }

        // 4. Success -> Put Back
        box.state.count++;
        console.log(`Put back ${item.definitionId}. Count: ${box.state.count}/${boxDef.maxCount}`);
        return true;
    }

    _handleBoxCombine(box, heldItem) {
        if (!box.state.isOpen || box.state.count <= 0) return false;

        const productId = box.definition.produces;
        if (!productId) return false;

        // Create a temporary item to test combination
        const tempItem = new ItemInstance(productId);

        // Attempt combination (non-destructive if fails, destructive/mutative if succeeds)
        const result = this._tryCombine(heldItem, tempItem);

        if (result) {
            console.log(`Combined held item with ${productId} from box.`);

            // Commit transaction
            box.state.count--;
            this.heldItem = result;

            if (box.state.count <= 0) {
                console.log('Box is empty after combine.');
            }
            return true;
        }
        return false;
    }

    setHappy(happy) {
        this.isHappy = happy;
        this.texture = happy ? ASSETS.PLAYER.HAPPY : ASSETS.PLAYER.NEUTRAL;
    }

    // Tool equip removed


    _tryCombine(held, target) {
        // 1. Burger + Wrapper = Wrapped Burger
        // Helper to identify burger vs wrapper
        const isBurger = (item) => item.type === ItemType.Composite; // generic for any burger
        const isWrapper = (item) => item.definitionId === 'wrapper';

        if (isBurger(held) && isWrapper(target)) {
            // Held Burger -> Target Wrapper
            held.state.isWrapped = true;
            console.log('Wrapped Burger (Held applied to Target Wrapper)');
            return held; // The burger persists, wrapper is effectively consumed
        }

        if (isWrapper(held) && isBurger(target)) {
            // Held Wrapper -> Target Burger
            target.state.isWrapped = true;
            console.log('Wrapped Burger (Held Wrapper applied to Target Burger)');
            return target; // The burger persists (on table/target)
        }

        // 2. Burger Assembly: Bun + Cooked Patty = Plain Burger
        const isBun = (item) => item.definitionId === 'plain_bun';
        const isCookedPatty = (item) => item.definitionId === 'beef_patty' && item.state.cook_level === 'cooked';

        let bun = null;
        let patty = null;

        if (isBun(held) && isCookedPatty(target)) {
            bun = held;
            patty = target;
        } else if (isCookedPatty(held) && isBun(target)) {
            patty = held;
            bun = target;
        }

        if (bun && patty) {
            console.log('Combining Bun and Cooked Patty into Plain Burger');

            // Create Burger
            const burger = new ItemInstance('plain_burger');

            // Initialize Burger State
            // Assuming ItemInstance initializes Composite state correctly (bun: null, patty: null)
            // We set them here.
            burger.state.bun = bun;
            burger.state.patty = patty;

            return burger;
        }

        // 3. Burger (Plain or Mayo) + Tomato Slice
        const isCompatibleBurger = (item) => item.definitionId === 'plain_burger' || item.definitionId === 'burger_mayo';
        const isTomatoSlice = (item) => item.definitionId === 'tomato_slice';

        let burgerToBase = null;
        let slice = null;

        if (isCompatibleBurger(held) && isTomatoSlice(target)) {
            burgerToBase = held;
            slice = target;
        } else if (isTomatoSlice(held) && isCompatibleBurger(target)) {
            slice = held;
            burgerToBase = target;
        }

        if (burgerToBase && slice) {
            let newDefId = 'burger_tomato';
            if (burgerToBase.definitionId === 'burger_mayo') {
                newDefId = 'burger_tomato_mayo';
            }

            console.log(`Combining ${burgerToBase.definitionId} and Tomato Slice into ${newDefId}`);
            const newBurger = new ItemInstance(newDefId);
            // Transfer state
            newBurger.state.bun = burgerToBase.state.bun;
            newBurger.state.patty = burgerToBase.state.patty;
            const existingToppings = burgerToBase.state.toppings || [];
            newBurger.state.toppings = [...existingToppings, slice];

            return newBurger;
        }


        // 4. Bag Packing Logic
        const isBag = (item) => item.definitionId === 'bag';

        // Helper to check if item is packable and get its tag
        const getPackableTag = (item) => {
            // Wrapped Burger
            if (item.type === ItemType.Composite && item.state.isWrapped) return 'burger';
            if (item.definitionId.includes('burger') && item.state.isWrapped) return 'burger'; // Extra safety

            // Fries
            if (item.definitionId === 'fries') return 'fries';

            // Soda
            if (item.definitionId === 'soda') return 'soda';

            return null;
        };

        let bagBox = null;
        let itemToPack = null;

        if (isBag(held)) {
            bagBox = held;
            itemToPack = target;
        } else if (isBag(target)) {
            bagBox = target;
            itemToPack = held;
        }

        if (bagBox && itemToPack) {
            const tag = getPackableTag(itemToPack);
            if (!tag) {
                console.log('Cannot put this item in the bag (Must be Wrapped Burger, Fries, or Soda).');
                return null; // Not valid to pack
            }

            const currentContents = bagBox.state.contents || [];

            // Check if already contains this type
            const existingTags = currentContents.map(getPackableTag);
            if (existingTags.includes(tag)) {
                console.log(`Bag already contains ${tag}!`);
                return null;
            }

            // Pack it
            // We need to clone or move the item. Since we return the "resulting object" for the cell,
            // we have to handle who is who.
            // If Held is Bag, we return Bag (updated).
            // If Held is Item, we return Bag (updated) [swapping logic in actionPickUp might need care].

            // Actually, _tryCombine logic in actionPickUp:
            // cell.object = result;
            // heldItem = null;

            // This assumes we return the object that stays on the cell.
            // Case A: Held=Bag, Target=Item. Result=Bag? No, user wants to HOLD the bag.
            // If I return the Bag, it gets placed on the cell?

            // Let's re-read actionPickUp combine logic:
            /*
            const result = this._tryCombine(this.heldItem, cell.object);
            if (result) {
                cell.object = result;
                this.heldItem = null;
            }
            */
            // Case A: Held=Bag, Target=Item (on table).
            // Result becomes cell.object. Player loses held item (Bag).
            // So Bag goes onto table. This is valid "Put Bag on Item to pack it" behavior.

            // Case B: Held=Item, Target=Bag (on table).
            // Result becomes cell.object. Player loses held item.
            // Bag stays on table (updated). Valid.

            // So in both cases, the returned object should be the BAG.

            console.log(`Packing ${tag} into bag.`);
            bagBox.state.contents = [...currentContents, itemToPack];
            return bagBox;
        }

        return null;
    }
}

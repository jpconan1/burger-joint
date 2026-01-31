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
    actionPickUp(grid) {
        const cell = this.getTargetCell(grid);
        if (!cell) return;

        // APPLIANCE PLACEMENT (Tap/Press to Put Down)
        if (this.heldAppliance) {
            this.actionPlaceAppliance(grid);
            return;
        }

        // APPLIANCE PLACEMENT (Tap/Press to Put Down)
        if (this.heldAppliance) {
            this.actionPlaceAppliance(grid);
            return;
        }

        // DIRECT SAUCE APPLICATION (Pick Up Key)
        // If holding sauce bag and targeting burger -> Apply
        if (cell.object && this.heldItem) {
            if (this._tryApplySauceFromBag(cell.object)) return;
        }

        // CUTTING BOARD LOGIC (Generic)
        if (cell.type.id === 'CUTTING_BOARD') {
            const cbState = cell.state || {};

            if (this.heldItem) {
                // 1. Try to PLACE item on board
                // Condition: Board is empty
                if (!cbState.heldItem) {
                    // Check if item is valid? (Has slicing definition OR is a valid result we are putting back?)
                    // For now, allow placing "slicable" items.
                    if (this.heldItem.definition.slicing) {
                        // Place it
                        cell.state = { heldItem: this.heldItem };
                        this.heldItem = null;
                        console.log('Placed item on cutting board');
                        return;
                    }
                } else {
                    // 2. Board has Item -> Try to Combine (Burger + Slice)
                    // If the item on board is a "topping" (result of slice), and we hold a burger...
                    const boardItem = cbState.heldItem;
                    if (boardItem.category === 'topping' || boardItem.definition.isTopping) {
                        // Check if we hold a burger (using our new category logic!)
                        if (this.heldItem.category === 'burger') {
                            // Use the generic combine logic we wrote earlier!
                            // We can just call _tryCombine logic here or reuse it?
                            // _tryCombine mutates/returns.

                            const result = this._tryCombine(this.heldItem, boardItem);
                            if (result) {
                                this.heldItem = result;
                                cell.state = { heldItem: null }; // Clear board
                                console.log('Combined burger with item from board.');
                                return;
                            }
                        }
                    }
                }
            } else {
                // 3. Pick Up Item from Board
                if (cbState.heldItem) {
                    this.heldItem = cbState.heldItem;
                    cell.state = { heldItem: null };
                    console.log('Picked up item from cutting board');
                    return;
                }
            }
        }

        // DISPENSER LOGIC (Pick Up / Loading / Apply Sauce)
        if (cell.type.id === 'DISPENSER') {
            // New: Allow applying sauce with Pick Up key as well
            if (this._tryApplySauce(cell)) return;

            // Load Dispenser Logic
            if (this.heldItem) {
                const def = this.heldItem.definition;
                // Check if it is a sauce bag
                if (def.category === 'sauce_refill' || def.type === 'SauceContainer') {
                    const dispState = cell.state || {};
                    // Only load if empty
                    if (!dispState.status || dispState.status === 'empty') {
                        // Ensure it has a sauceId mapping
                        if (def.sauceId) {
                            cell.state = {
                                status: 'loaded',
                                sauceId: def.sauceId,
                                bagId: this.heldItem.definitionId,
                                charges: this.heldItem.state.charges !== undefined ? this.heldItem.state.charges : 15
                            };
                            this.heldItem = null;
                            console.log(`Loaded ${def.id} into dispenser. Sauce: ${def.sauceId}`);
                            return;
                        } else {
                            console.log("This bag does not have a defined sauce type!");
                        }
                    } else {
                        console.log("Dispenser is not empty.");
                    }
                }
            }
        }

        // FRYER LOGIC (Loading & Pickup)
        if (cell.type.id === 'FRYER') {
            const fryerState = cell.state || {}; // Keep for ref if needed, but we rely on objects

            // 1. Pick Up Cooked Items
            if (cell.object) {
                // FRIES/SIDE LOGIC (Check for prepared sides like fries/sweet potato fries)
                const friedItem = cell.object;

                // ONION LOGIC
                if (friedItem.definitionId === 'onion_slice' && friedItem.state.cook_level === 'cooked') {
                    // Option A: Side Cup -> Onion Rings
                    if (this.heldItem && this.heldItem.definitionId === 'side_cup') {
                        this.heldItem = new ItemInstance('onion_rings');
                        cell.object = null;
                        cell.state.status = 'empty';
                        console.log('Picked up Onion Rings!');
                        return;
                    }

                    // Option B: Empty Hands -> Fried Onion Topping
                    if (!this.heldItem) {
                        this.heldItem = new ItemInstance('fried_onion');
                        cell.object = null;
                        cell.state.status = 'empty';
                        console.log('Picked up Fried Onion Topping!');
                        return;
                    }

                    // Option C: Holding Burger -> Add Fried Onion
                    if (this.heldItem && (this.heldItem.category === 'burger' || this.heldItem.definitionId.includes('burger'))) {
                        const friedOnion = new ItemInstance('fried_onion');

                        // Clone Burger
                        const newBurger = new ItemInstance(this.heldItem.definitionId);
                        newBurger.state = JSON.parse(JSON.stringify(this.heldItem.state));
                        if (!newBurger.state.toppings) newBurger.state.toppings = [];

                        newBurger.state.toppings.push(friedOnion);

                        this.heldItem = newBurger;
                        cell.object = null;
                        cell.state.status = 'empty';
                        console.log('Added Fried Onion to Burger!');
                        return;
                    }
                }

                // EXISTING FRIES LOGIC
                if (friedItem.definition.category === 'side_prep' && friedItem.state.cook_level === 'cooked') {
                    if (this.heldItem && this.heldItem.definitionId === 'side_cup') {
                        const resultId = friedItem.definition.result;
                        if (resultId) {
                            this.heldItem = new ItemInstance(resultId); // Transform to finished item (e.g. fries)
                            cell.object = null;
                            cell.state.status = 'empty';
                            console.log('Side served!');
                            return;
                        }
                    }
                    console.log('Side is ready! Use a Side Cup to pick it up.');
                    return;
                }
                // Generic Pickup is handled by fallthrough if hands empty
            } else {
                // 2. Load Fryer (if empty)

                // A. Fry Bag (Generic - Auto-Open & Load)
                if (this.heldItem && this.heldItem.definition && this.heldItem.definition.fryContent) {
                    let bag = this.heldItem;

                    // Auto-Open if needed (if it doesn't have charges yet, it's the closed bag)
                    if (bag.state.charges === undefined) {
                        const openId = bag.definitionId + '_open';
                        // Assume open definition exists and follows convention
                        bag = new ItemInstance(openId);
                        this.heldItem = bag;
                        console.log(`Auto-opened ${openId}`);
                    }

                    // Create Raw Item
                    const rawContentId = bag.definition.fryContent;
                    const rawItem = new ItemInstance(rawContentId);

                    // Ensure state initialized
                    rawItem.state.cook_level = 'raw';
                    rawItem.state.cookingProgress = 0;

                    cell.object = rawItem;

                    // Consume Charge
                    bag.state.charges = (bag.state.charges || 0) - 1;
                    console.log(`Loaded fryer with ${rawContentId}. Charges: ${bag.state.charges}`);

                    if (bag.state.charges <= 0) {
                        this.heldItem = new ItemInstance('fry_bag_empty');
                        console.log('Fry bag empty.');
                    }

                    // Start Fryer
                    cell.state.status = 'down';
                    cell.state.timer = 0;
                    return;
                }

                // B. Generic Fryable (e.g. Chicken Patty)
                if (this.heldItem && this.heldItem.definition.cooking) {
                    const stage = this.heldItem.state.cook_level || 'raw';
                    const stageDef = this.heldItem.definition.cooking.stages[stage];
                    if (stageDef && stageDef.cookMethod === 'fry') {
                        cell.object = this.heldItem;
                        this.heldItem = null;

                        // Start Fryer
                        cell.state.status = 'down';
                        cell.state.timer = 0;
                        console.log('Placed item in fryer.');
                        return;
                    }
                }
            }
        }

        // SODA FOUNTAIN LOGIC
        if (cell.type.id === 'SODA_FOUNTAIN') {
            const sfState = cell.state || {};

            // 1. Loading Syrup (Refill)
            // Use generic 'syrup' category to support multiple flavors
            if (this.heldItem && this.heldItem.definition.category === 'syrup') {
                if (!sfState.status || sfState.status === 'empty') {
                    cell.state = {
                        status: 'full',
                        charges: this.heldItem.state.charges !== undefined ? this.heldItem.state.charges : 20,
                        syrupId: this.heldItem.definitionId,
                        // Determine the result item from the syrup definition
                        resultId: this.heldItem.definition.result || 'soda'
                    };
                    this.heldItem = null;
                    console.log(`Soda fountain refilled with ${cell.state.syrupId}. Result: ${cell.state.resultId}`);
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
            // Condition: Fountain is 'done'
            // "pick_up_key to get the final item, soda.png"
            if (sfState.status === 'done') {
                // Check if we can pick it up (Empty hands OR Holding valid Bag)
                const isBag = this.heldItem && this.heldItem.definitionId === 'bag';
                const canPickUp = !this.heldItem || (isBag && (this.heldItem.state.contents || []).length < 50);

                if (canPickUp) {
                    sfState.charges = (sfState.charges || 0) - 1;
                    console.log(`Soda retrieved. Charges remaining: ${sfState.charges}`);

                    const resultId = sfState.resultId || 'soda';
                    const newItem = new ItemInstance(resultId);

                    // Update State
                    if (sfState.charges <= 0) {
                        sfState.status = 'empty';
                    } else if (sfState.charges <= 3) {
                        sfState.status = 'warning';
                    } else {
                        sfState.status = 'full';
                    }

                    if (isBag) {
                        if (!this.heldItem.state.contents) this.heldItem.state.contents = [];
                        this.heldItem.state.contents.push(newItem);
                        console.log(`Packed ${resultId} into bag.`);
                    } else {
                        this.heldItem = newItem;
                    }
                    return;
                } else if (isBag) {
                    console.log("Bag is full!");
                }
            }
        }

        if (this.heldItem) {
            // Case 1: Holding Item -> Try to Place or Combine
            if (!cell.object) {
                // Garbage Logic
                if (cell.type.id === 'GARBAGE') {
                    // Feature: Empty Insert without trashing it
                    if (this.heldItem.definitionId === 'insert') {
                        this.heldItem.state.contents = [];
                        console.log("Emptied insert into trash");
                        return;
                    }

                    console.log(`Trashed item: ${this.heldItem.definitionId}`);
                    this.heldItem = null;
                    return;
                }

                // Place on empty cell (if it holds items)
                // Exclude CUTTING_BOARD to enforce specific slicing logic above
                if (cell.type.holdsItems && cell.type.id !== 'CUTTING_BOARD') {
                    // FRYER RESTRICTION: Only place fryable items
                    if (cell.type.id === 'FRYER') {
                        const def = this.heldItem.definition;
                        const isFryBag = def.fryContent;

                        const stage = this.heldItem.state.cook_level || 'raw';
                        const cookingStages = def.cooking ? def.cooking.stages : null;
                        const isFryable = cookingStages && cookingStages[stage] && cookingStages[stage].cookMethod === 'fry';

                        if (!isFryBag && !isFryable) {
                            console.log("Only fryable items can be placed in the fryer!");
                            return;
                        }

                        cell.object = this.heldItem;
                        this.heldItem = null;
                        return;
                    }

                    // STOVE RESTRICTION: Only place cookable items
                    if (cell.type.id === 'STOVE') {
                        if (this.heldItem.definition && this.heldItem.definition.cooking) {
                            const stage = this.heldItem.state.cook_level || 'raw';
                            const stageDef = this.heldItem.definition.cooking.stages[stage];

                            if (stageDef && stageDef.cookMethod === 'fry') {
                                console.log("This needs to be cooked in a fryer!");
                                return;
                            }

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
                // Feature: Pick Up into Held Insert
                if (this.heldItem.definitionId === 'insert') {
                    if (this._handleInsertPickup(cell, cell.object)) return;
                }

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

                // INSERT LOGIC (Fill / Dispense)
                if (cell.object.definitionId === 'insert') {
                    const insert = cell.object;
                    // 1. Fill Logic
                    // If held item is a SLICE (isTopping/isSlice) or PATTY
                    if (this.heldItem.definition && (this.heldItem.definition.isSlice || this.heldItem.definition.category === 'topping' || this.heldItem.definition.category === 'patty' || (this.heldItem.definitionId === 'bacon' && this.heldItem.state.cook_level === 'cooked'))) {
                        // Check Stack Constraints
                        if ((insert.state.count || 1) > 1) {
                            console.log("Cannot put slices into a stacked insert.");
                            return;
                        }

                        // Check Capacity
                        const contents = insert.state.contents || [];
                        if (contents.length >= 50) {
                            console.log("Insert is full (50/50).");
                            return;
                        }

                        // Check Type
                        if (contents.length > 0) {
                            if (contents[0].definitionId !== this.heldItem.definitionId) {
                                console.log(`Insert already holds ${contents[0].definitionId}, cannot mix with ${this.heldItem.definitionId}.`);
                                return;
                            }
                        }

                        // Add to Insert
                        if (!insert.state.contents) insert.state.contents = [];
                        insert.state.contents.push(this.heldItem);
                        this.heldItem = null;
                        console.log(`Placed slice in insert. Count: ${insert.state.contents.length}`);
                        return;
                    }

                    // 2. Dispense Logic (To Burger or Bun)
                    const isBurger = this.heldItem.category === 'burger' || this.heldItem.definitionId.includes('burger');
                    const isBun = this.heldItem.category === 'bun';

                    if (isBurger || isBun) {
                        const contents = insert.state.contents || [];
                        if (contents.length > 0) {
                            const slice = contents.pop();

                            let targetBurger = this.heldItem;

                            // Convert Bun to Burger if needed
                            if (isBun) {
                                targetBurger = new ItemInstance('plain_burger');
                                targetBurger.state.bun = this.heldItem;
                                targetBurger.state.toppings = [];
                            } else {
                                // Clone existing burger to ensure state mutation safety (though not strictly necessary if we mutate held)
                                // Only clone if we want to follow immutable patterns, but here we can mutate heldItem directly or replace it.
                                // The existing code replaced it:
                                const newBurger = new ItemInstance(this.heldItem.definitionId);
                                newBurger.state = JSON.parse(JSON.stringify(this.heldItem.state));
                                targetBurger = newBurger;
                            }

                            this._addIngredientToBurger(targetBurger, slice);

                            this.heldItem = targetBurger;
                            console.log(`Added ${slice.definitionId} from insert to burger.`);
                            return;
                        }
                    }
                }

                // INSERT LOGIC (Stacking)
                if (this.heldItem.definitionId === 'insert' && cell.object.definitionId === 'insert') {
                    // Rule 6: Stacked inserts can't hold anything.
                    const heldHasContent = this.heldItem.state.contents && this.heldItem.state.contents.length > 0;
                    const targetHasContent = cell.object.state.contents && cell.object.state.contents.length > 0;

                    if (heldHasContent || targetHasContent) {
                        console.log("Cannot stack inserts that contain slices!");
                        return;
                    }

                    // "if the player is holding an empty insert and places it on another empty insert, it makes a stack of two."
                    const heldCount = this.heldItem.state.count || 1;
                    const targetCount = cell.object.state.count || 1;

                    const newTotal = heldCount + targetCount;
                    if (newTotal <= 12) {
                        cell.object.state.count = newTotal;
                        this.heldItem = null;
                        console.log(`Stacked inserts. Total: ${newTotal}`);
                        return;
                    } else {
                        console.log("Insert stack full (Max 12)!");
                    }
                    // Fallthrough if specific stack fails? No, specific interaction attempted.
                }

                const result = this._tryCombine(this.heldItem, cell.object);
                if (result) {
                    // EXCEPTION: Stovetop Combine (Jump to Hands)
                    if (cell.type.id === 'STOVE') {
                        this.heldItem = result;
                        cell.object = null;
                        console.log('Stovetop combine: Item jumped to hands.');
                    } else {
                        // Standard behavior: Result on surface
                        cell.object = result;
                        this.heldItem = null;
                    }
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
                const type = target.type;

                // INSERT LOGIC (Single Pick Up)
                if (target.definitionId === 'insert') {
                    // 1. Take Item from Insert (if contents exist)
                    const contents = target.state.contents || [];
                    if (contents.length > 0) {
                        const slice = contents.pop();
                        this.heldItem = slice;
                        console.log(`Took ${slice.definitionId} from insert.`);
                        return;
                    }

                    // 2. Take One Empty Insert from Stack
                    // "pick_up_key whiile facing a stack on a counter takes one insert"
                    const stackCount = target.state.count || 1;
                    if (stackCount > 1) {
                        // Decrement Stack
                        target.state.count--;
                        // Give Player One
                        const oneInsert = new ItemInstance('insert');
                        oneInsert.state.count = 1;
                        this.heldItem = oneInsert;
                        console.log(`Took 1 insert. Stack remaining: ${target.state.count}`);
                        return;
                    }
                    // If count is 1 and empty, just pick it up normally (fall through)
                    this.heldItem = target;
                    cell.object = null;
                    return;
                }

                if (type === ItemType.Box) {
                    this._handleBoxPickup(cell, target);
                } else {
                    // Regular Pickup (Ingredients, Containers, Composites)
                    this.heldItem = target;
                    cell.object = null;
                }
            } else {
                this.heldItem = target;
                cell.object = null;
                if (cell.type.id === 'FRYER') cell.state.status = 'empty';
            }
        }
    }

    // E KEY: Interact (Change State)
    actionInteract(grid) {
        const cell = this.getTargetCell(grid);
        if (!cell) return;

        const target = cell.object;

        // FRYER INTERACTION (Pickup / Load)
        if (cell.type.id === 'FRYER') {
            if (target) {
                // Check if it's cooked
                const isCooked = target.state.cook_level === 'cooked';
                if (isCooked) {
                    // ONION LOGIC (Copy of Pick Up Logic)
                    if (target.definitionId === 'onion_slice') {
                        // Option A: Side Cup -> Onion Rings
                        if (this.heldItem && this.heldItem.definitionId === 'side_cup') {
                            this.heldItem = new ItemInstance('onion_rings');
                            cell.object = null;
                            cell.state.status = 'empty';
                            console.log('Picked up Onion Rings (Interact)!');
                            return;
                        }

                        // Option B: Empty Hands -> Fried Onion Topping
                        if (!this.heldItem) {
                            this.heldItem = new ItemInstance('fried_onion');
                            cell.object = null;
                            cell.state.status = 'empty';
                            console.log('Picked up Fried Onion Topping (Interact)!');
                            return;
                        }

                        // Option C: Holding Burger -> Add Fried Onion
                        if (this.heldItem && (this.heldItem.category === 'burger' || this.heldItem.definitionId.includes('burger'))) {
                            const friedOnion = new ItemInstance('fried_onion');

                            const newBurger = new ItemInstance(this.heldItem.definitionId);
                            newBurger.state = JSON.parse(JSON.stringify(this.heldItem.state));
                            if (!newBurger.state.toppings) newBurger.state.toppings = [];
                            newBurger.state.toppings.push(friedOnion);

                            this.heldItem = newBurger;
                            cell.object = null;
                            cell.state.status = 'empty';
                            console.log('Added Fried Onion to Burger (Interact)!');
                            return;
                        }
                    }
                    // EXISTING FRIES LOGIC (Interact)
                    if (target.definition.category === 'side_prep') {
                        if (this.heldItem && this.heldItem.definitionId === 'side_cup') {
                            const resultId = target.definition.result;
                            if (resultId) {
                                this.heldItem = new ItemInstance(resultId);
                                cell.object = null;
                                cell.state.status = 'empty';
                                console.log('Side served (Interact)!');
                                return;
                            }
                        }
                    }
                }
            }
        }

        // INSERT LOGIC (Placement with Interact Key on generic counters)
        // Also Handle Dispensing if holding a Burger/Bun (INTERACT KEY DISPENSE)
        if (target && target.definitionId === 'insert') {
            const isBurger = this.heldItem && (this.heldItem.category === 'burger' || this.heldItem.definitionId.includes('burger'));
            const isBun = this.heldItem && (this.heldItem.category === 'bun');

            if (isBurger || isBun) {
                const contents = target.state.contents || [];
                if (contents.length > 0) {
                    const slice = contents.pop();

                    let targetBurger = this.heldItem;

                    // Convert Bun to Burger
                    if (isBun) {
                        targetBurger = new ItemInstance('plain_burger'); // Default composite ID
                        targetBurger.state.bun = this.heldItem;
                        targetBurger.state.toppings = [];
                    } else {
                        // Clone for safety
                        const newBurger = new ItemInstance(this.heldItem.definitionId);
                        newBurger.state = JSON.parse(JSON.stringify(this.heldItem.state));
                        targetBurger = newBurger;
                    }

                    this._addIngredientToBurger(targetBurger, slice);

                    this.heldItem = targetBurger;
                    console.log(`Added ${slice.definitionId} from insert to burger (Interact).`);
                    return;
                }
            }
        }

        if (this.heldItem && this.heldItem.definitionId === 'insert') {
            // Feature: Empty Insert into Trash (Interact Key)
            if (cell.type.id === 'GARBAGE') {
                this.heldItem.state.contents = [];
                console.log("Emptied insert into trash (Interact)");
                return;
            }

            // Feature: Pick Up into Insert (Interact Key)
            if (target && this._handleInsertPickup(cell, target)) return;

            // Check for placement on empty counter (that is NOT a cutting board, as that is handled below, and NOT fryer)
            if (!target && cell.type.holdsItems && cell.type.id !== 'GARBAGE' && cell.type.id !== 'CUTTING_BOARD' && cell.type.id !== 'FRYER') {
                cell.object = this.heldItem;
                this.heldItem = null;
                console.log('Placed insert stack (Interact Key).');
                return;
            }
        }

        // CUTTING_BOARD INTERACTION
        if (cell.type.id === 'CUTTING_BOARD') {
            const cbState = cell.state || {};

            // Check if we have an item to slice
            if (cbState.heldItem) {
                // Should we check if it is already sliced?
                const itemDef = DEFINITIONS[cbState.heldItem.definitionId];
                if (itemDef && itemDef.slicing) {
                    // MODE: DISPENSE (e.g. Cheese Block -> Slice)
                    if (itemDef.slicing.mode === 'dispense') {
                        if (!this.heldItem) {
                            // Create Slice
                            const slice = new ItemInstance(itemDef.slicing.result);
                            this.heldItem = slice;

                            // Update Charges
                            // Initialize charges if needed (safe fallback)
                            if (cbState.heldItem.state.charges === undefined) {
                                const initial = itemDef.initialState ? itemDef.initialState.charges : 18;
                                cbState.heldItem.state.charges = initial;
                            }

                            cbState.heldItem.state.charges -= 1;
                            console.log(`Dispensed slice. Charges: ${cbState.heldItem.state.charges}`);

                            if (cbState.heldItem.state.charges <= 0) {
                                cbState.heldItem = null;
                            }
                        } else {
                            console.log("Hands full!");
                        }
                        return;
                    }


                    // MODE: TRANSFORM (Standard Slicing)
                    // Check if already result? No, if it's sitting there it's the input.
                    // Or we store the specific state.

                    // Perform Slice
                    if (itemDef.slicing.result) {
                        console.log(`Slicing ${cbState.heldItem.definitionId}...`);
                        // Transform the held item on the board
                        // For simplicity, we create a new instance of the result
                        if (cbState.heldItem.definitionId !== itemDef.slicing.result) {
                            const newItem = new ItemInstance(itemDef.slicing.result);
                            cbState.heldItem = newItem;
                            console.log(`Sliced into ${newItem.definitionId}`);
                        }
                    }
                }
            }
            return;
        }



        // SODA FOUNTAIN INTERACTION (Eject Syrup)
        if (cell.type.id === 'SODA_FOUNTAIN') {
            const sfState = cell.state || {};
            // Check if there is syrup loaded
            if (sfState.syrupId) {
                if (!this.heldItem) {
                    // Create instances of the syrup (bag)
                    const syrup = new ItemInstance(sfState.syrupId);
                    // Restore charges
                    syrup.state.charges = sfState.charges !== undefined ? sfState.charges : 20;

                    this.heldItem = syrup;

                    // Reset fountain to empty
                    cell.state = { status: 'empty' };
                    console.log(`Ejected syrup: ${syrup.definitionId} with charges ${syrup.state.charges}`);
                } else {
                    console.log("Hands full! Cannot eject syrup.");
                }
                return;
            }
        }

        // DISPENSER INTERACTION (Eject Sauce Bag)
        if (cell.type.id === 'DISPENSER') {
            const dispState = cell.state || {};
            // Check if loaded (support legacy 'has_mayo')
            const isLoaded = dispState.status === 'loaded' || dispState.status === 'has_mayo';

            if (isLoaded) {
                if (!this.heldItem) {
                    let bagId = dispState.bagId;

                    // Fallback logic for legacy saves or missing bagId
                    if (!bagId) {
                        if (dispState.sauceId) bagId = dispState.sauceId + '_bag';
                        else if (dispState.status === 'has_mayo') bagId = 'mayo_bag';
                    }

                    if (bagId && DEFINITIONS[bagId]) {
                        const bag = new ItemInstance(bagId);
                        // Restore charges (Default to 15 if missing)
                        bag.state.charges = dispState.charges !== undefined ? dispState.charges : 15;

                        this.heldItem = bag;

                        // Reset Dispenser
                        cell.state = { status: 'empty' };
                        console.log(`Ejected sauce bag: ${bagId} with charges ${bag.state.charges}`);
                        return;
                    } else {
                        console.warn(`Cannot eject: Could not determine bag definitions for sauceId: ${dispState.sauceId}`);
                    }
                } else {
                    console.log("Hands full! Cannot eject sauce bag.");
                    // Fallthrough to _tryApplySauce in case we are holding a burger
                }
            }
        }

        // DISPENSER INTERACTION (Applying Sauce)
        if (this._tryApplySauce(cell)) return;




        // 1. Item Interaction (Priority)
        if (target && target instanceof ItemInstance) {

            // SAUCE BAG APPLICATION (Interact Key)
            if (this.heldItem && this._tryApplySauceFromBag(target)) return;

            // Generic Processing (Lettuce, etc)
            if (this._handleGenericProcessing(cell, target)) return;

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

        // INSERT LOGIC (Interact Key -> Pick Up Whole Stack)
        // "interact_key picks up the stack and lets the player move them all at once."
        if (target && target.definitionId === 'insert') {
            if (!this.heldItem) {
                this.heldItem = target;
                cell.object = null;
                console.log(`Picked up insert stack (Count: ${target.state.count || 1})`);
                return;
            } else {
                // If holding something, maybe interact does something else?
                // For now, only pick up if hands empty.
            }
        }

        // 2. Tile Interaction
        if (cell.type.id === 'STOVE') {
            // Stove is permanently on.
        }
    }

    _handleGenericProcessing(cell, target) {
        if (!target.definition || !target.definition.process) return false;

        const process = target.definition.process;

        // Check Tool Requirement (optional logic, for now assume 'HANDS' implies interact key)
        if (process.tool === 'HANDS') {
            // Chop/Process
            if (this.heldItem) {
                console.log("Cannot process while holding something!");
                return true; // Interaction consumed but failed
            }

            if (process.result) {
                // Create Result
                const product = new ItemInstance(process.result);
                this.heldItem = product;

                // Consumable Logic
                if (process.charges) {
                    target.state.charges = (target.state.charges || 0) - process.charges;
                    console.log(`Processed ${target.definitionId}. Charges: ${target.state.charges}`);

                    if (target.state.charges <= 0) {
                        cell.object = null; // Depleted
                        console.log(`${target.definitionId} finished.`);
                    }
                }
                return true;
            }
        }
        return false;
    }

    _tryApplySauce(cell) {
        if (cell.type.id !== 'DISPENSER') return false;

        const dispState = cell.state || {};
        const isLoaded = dispState.status === 'loaded' || dispState.status === 'has_mayo'; // Support legacy 'has_mayo'
        if (!isLoaded || !this.heldItem) return false;

        // Determine sauce ID (fallback for legacy)
        const sauceId = dispState.sauceId || 'mayo';

        let newBurger = null;

        const isBurger = this.heldItem.category === 'burger' || this.heldItem.definitionId.includes('burger');
        // Support applying sauce to a plain Bun -> Converts to Burger
        const isBun = this.heldItem.category === 'bun';

        if (isBurger || isBun) {
            if (isBun) {
                // Convert Bun to Burger
                newBurger = new ItemInstance('plain_burger');
                newBurger.state.bun = this.heldItem; // Use the held bun (preserves state like age)
                newBurger.state.toppings = [];
            } else {
                // Already a Burger - Clone it
                newBurger = new ItemInstance(this.heldItem.definitionId);
                newBurger.state = JSON.parse(JSON.stringify(this.heldItem.state));
            }

            // Append Sauce to toppings
            if (!newBurger.state.toppings) newBurger.state.toppings = [];

            // Create Sauce Item
            const sauceItem = new ItemInstance(sauceId);
            newBurger.state.toppings.push(sauceItem);

            console.log(`Added ${sauceId} to burger`);
        }

        if (newBurger) {
            this.heldItem = newBurger;

            // Deplete Dispenser
            dispState.charges = (dispState.charges || 0) - 1;
            console.log(`Dispenser charges: ${dispState.charges}`);

            if (dispState.charges <= 0) {
                dispState.status = 'empty';
                dispState.charges = 0;
                dispState.sauceId = null;
                dispState.bagId = null;
                console.log('Dispenser is now empty!');
            }
            return true;
        }
        return false;
    }

    _handleBoxPickup(cell, boxItem) {
        const state = boxItem.state;
        const def = boxItem.definition;

        // If box is OPEN and HAS ITEMS...
        if (state.isOpen && state.count > 0) {
            // Check for Spoilage First
            // Get content definition
            const productDefId = def.produces;
            if (productDefId) {
                const productDef = DEFINITIONS[productDefId];
                if (productDef && productDef.aging && state.age >= productDef.aging.spoilAge) {
                    // Content is spoiled!
                    // User Rule: "if stuff spoils in a box, you cant take things out."
                    // Instead, we force the player to pick up the whole box (to trash it).
                    this.heldItem = boxItem;
                    cell.object = null;
                    console.log("Box contents spoiled. Picked up the whole box.");
                    return;
                }
            }

            // Produce item
            const newItem = new ItemInstance(productDefId);

            // Transfer age
            if (state.age) {
                newItem.state.age = state.age;
            }

            // Check for Spoilage transformation immediately (Should be covered above, but safe fallback for non-blocked items)
            if (newItem.definition.aging && newItem.state.age >= newItem.definition.aging.spoilAge) {
                const spoiledId = newItem.definition.aging.spoiledItem;
                if (spoiledId) {
                    newItem = new ItemInstance(spoiledId);
                }
            }

            this.heldItem = newItem;
            state.count--;
            console.log(`Produced ${productDefId}. Remaining: ${state.count}`);

            if (state.count <= 0) {
                console.log('Box is now EMPTY');
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
        const targetId = boxDef.produces;
        const targetDef = DEFINITIONS[targetId];

        // Aging Logic Check
        let isMatchingSpoiled = false;

        if (targetDef && targetDef.aging) {
            const boxStage = this._getWiltStage(targetDef, box.state.age);

            if (boxStage === 'SPOILED') {
                // Case 1: Box is spoiled. allow putting matching spoiled items in.
                if (item.definitionId === targetDef.aging.spoiledItem) {
                    isMatchingSpoiled = true;
                } else {
                    console.log("Box is spoiled! Can only add matching trash.");
                    return false;
                }
            } else {
                // Case 2: Box is not spoiled. Check wilt stage match.
                // Revert to strict ID Check first
                if (item.definitionId !== targetId) {
                    console.log(`Wrong item. This box is for ${targetId}.`);
                    return false;
                }

                const itemStage = this._getWiltStage(targetDef, item.state.age);
                if (boxStage !== itemStage) {
                    console.log(`Cannot mix items of different freshness! Box Stage: ${boxStage}, Item Stage: ${itemStage}`);
                    return false;
                }
            }
        } else {
            // Standard ID Check (No aging logic)
            if (item.definitionId !== targetId) {
                console.log(`Wrong item. This box is for ${targetId}, but you are holding ${item.definitionId}.`);
                return false;
            }
        }

        // 2. Check for Specific Flags (Cooked/Modified) - Only if not trashing into spoiled box
        if (!isMatchingSpoiled) {
            if (item.definitionId === 'beef_patty') {
                if (item.state.cook_level !== 'raw') {
                    console.log("Cannot put cooked patties back in the box! Only raw patties allowed.");
                    return false;
                }
            }

            if (item.definitionId === 'bag') {
                if (item.state.contents && item.state.contents.length > 0) {
                    console.log("Cannot put non-empty bags back in the box!");
                    return false;
                }
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

    _getWiltStage(def, age) {
        if (!def || !def.aging) return 0;
        const ageVal = age || 0;
        if (ageVal >= def.aging.spoilAge) return 'SPOILED';

        // Find active stage
        let currentStage = 0;
        if (def.aging.stages) {
            // stages is object { "2": "...", "4": "..." }
            // We want the highest key <= ageVal
            Object.keys(def.aging.stages).forEach(threshold => {
                const t = parseInt(threshold);
                if (ageVal >= t) currentStage = t;
            });
        }
        return currentStage;
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
        const isBurger = (item) => item.category === 'burger';
        // Wrapper is specific container for now, explicitly check ID or define category 'wrapper'
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

        // 2. Generic Burger Assembly & Modification
        const isBun = (item) => item.category === 'bun';
        const isCookedPatty = (item) => item.category === 'patty' && item.state.cook_level === 'cooked';
        const isTopping = (item) => item.category === 'topping' || item.category === 'sauce' || (item.definitionId === 'bacon' && item.state.cook_level === 'cooked');

        // Helper to normalize Burger + Item interaction
        let burgerBase = null;
        let itemToAdd = null;
        let bunBase = null;

        // SCENARIO A: Add to Existing Burger
        if (isBurger(held) && (isTopping(target) || isCookedPatty(target))) {
            burgerBase = held;
            itemToAdd = target;
        } else if ((isTopping(held) || isCookedPatty(held)) && isBurger(target)) {
            itemToAdd = held;
            burgerBase = target;
        }

        if (burgerBase && itemToAdd) {
            console.log(`Adding ${itemToAdd.definitionId} to Burger`);

            const newBurger = new ItemInstance(burgerBase.definitionId);
            newBurger.state = JSON.parse(JSON.stringify(burgerBase.state));

            this._addIngredientToBurger(newBurger, itemToAdd);
            return newBurger;
        }

        // SCENARIO B: Start New Burger (Bun + Item)
        // Item can be Patty OR Topping
        if (isBun(held) && (isCookedPatty(target) || isTopping(target))) {
            bunBase = held;
            itemToAdd = target;
        } else if ((isCookedPatty(held) || isTopping(held)) && isBun(target)) {
            bunBase = target;
            itemToAdd = held;
        }

        if (bunBase && itemToAdd) {
            console.log(`Starting Burger: Bun + ${itemToAdd.definitionId}`);

            const burger = new ItemInstance('plain_burger');
            burger.state.bun = bunBase;
            burger.state.toppings = [];

            this._addIngredientToBurger(burger, itemToAdd);
            return burger;
        }


        // 4. Bag Packing Logic
        const isBag = (item) => item.definitionId === 'bag';

        // Helper to check if item is packable and get its tag
        const getPackableTag = (item) => {
            const def = item.definition;
            if (!def) return null;

            // 1. Burger (Must be Wrapped)
            const isBurger = (
                def.category === 'burger' ||
                item.definitionId.includes('burger') ||
                (item.type === ItemType.Composite && item.state.isWrapped)
            );

            if (isBurger) {
                // Only packable if wrapped
                if (item.state.isWrapped) return 'burger';
                return null;
            }

            // 2. Generic Side / Drink
            // Check 'orderConfig.type' (Customer Intent) or 'category' (Item Intent)
            const type = (def.orderConfig && def.orderConfig.type) || def.category;

            if (type === 'side') return 'side';
            if (type === 'drink') return 'drink';

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

            // Capacity Check
            if (currentContents.length >= 50) {
                console.log("Bag is full!");
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

    // Helper to apply sauce from a held bag to a target burger
    _tryApplySauceFromBag(targetItem) {
        // 1. Validate Held Item is a Sauce Bag
        if (!this.heldItem || this.heldItem.definition.category !== 'sauce_refill') return false;

        // 2. Validate Target is a Burger or Bun
        const isBurger = targetItem.category === 'burger' || targetItem.definitionId.includes('burger');
        const isBun = targetItem.category === 'bun';

        if (!isBurger && !isBun) return false;

        // 3. Check Charges
        const charges = this.heldItem.state.charges !== undefined ? this.heldItem.state.charges : 15;
        // Check if empty (charges <= 0)
        if (charges <= 0) {
            console.log("Sauce bag is empty!");
            return false;
        }

        // 4. Identify Sauce
        // Assumption: Bag ID is "{sauce}_bag" e.g. "mayo_bag"
        const bagId = this.heldItem.definitionId;
        const sauceId = bagId.replace('_bag', '');

        // Verify valid sauce ID (optional, but good practice)
        // Note: 'burger_mayo' logic in older code was messy, stick to explicit items 'mayo', 'bbq', etc.
        // We trust the ID extraction.

        console.log(`Applying ${sauceId} from bag to burger...`);

        // 5. Apply Sauce (Modify Target State in place)
        // Since targetItem is the object on the counter (cell.object), modifying it matches expectation.

        // Conversion Logic: Bun -> Burger
        if (isBun) {
            console.log("Converting Bun to Burger for sauce application...");
            const oldBunState = targetItem.state;

            // Mutate Target into Burger
            targetItem.definitionId = 'plain_burger';

            // Re-init State
            // Note: ItemInstance doesn't handle re-init of existing object automatically, so we do it manually.
            // We need a bun object in the burger state.
            const bunInstance = new ItemInstance('plain_bun');
            bunInstance.state = { ...oldBunState }; // Preserve aging/state

            targetItem.state = {
                bun: bunInstance,
                toppings: []
            };
        }

        // Ensure toppings array exists
        if (!targetItem.state.toppings) targetItem.state.toppings = [];

        // Add Sauce Item
        const sauceItem = new ItemInstance(sauceId);
        targetItem.state.toppings.push(sauceItem);

        // 6. Deduct Charge from Held Bag
        this.heldItem.state.charges = charges - 1;
        console.log(`Applied sauce. Bag charges remaining: ${this.heldItem.state.charges}`);

        return true;
    }

    _addIngredientToBurger(burgerItem, feedItem) {
        // Flattened Stacking Logic: Everything goes into toppings.
        if (!burgerItem.state.toppings) burgerItem.state.toppings = [];
        burgerItem.state.toppings.push(feedItem);
    }

    _isInsertable(item) {
        if (!item) return false;
        const def = item.definition || {};
        const isCookedBacon = item.definitionId === 'bacon' && item.state.cook_level === 'cooked';
        return def.isSlice || def.category === 'topping' || def.category === 'patty' || isCookedBacon;
    }

    _handleInsertPickup(cell, target) {
        const insert = this.heldItem;
        let itemToTake = null;
        let updateSource = null;

        // 1. Simple Item
        if (target instanceof ItemInstance || target.type === undefined) {
            if (this._isInsertable(target)) {
                itemToTake = target;
                updateSource = () => { cell.object = null; };
            }
        }
        // 2. Box (If contains insertable)
        else if (target.type === ItemType.Box) {
            if (target.state.isOpen && target.state.count > 0) {
                const prodId = target.definition.produces;
                // Create temp Item to check definition/insertability
                const tempItem = new ItemInstance(prodId);
                if (this._isInsertable(tempItem)) {
                    itemToTake = tempItem;
                    updateSource = () => {
                        target.state.count--;
                        if (target.state.age) itemToTake.state.age = target.state.age;
                    };
                }
            }
        }

        if (itemToTake) {
            const contents = insert.state.contents || [];
            if (contents.length >= 50) {
                console.log("Insert is full!");
                return true; // Handled
            }

            if (contents.length > 0) {
                if (contents[0].definitionId !== itemToTake.definitionId) {
                    console.log(`Cannot mix ${itemToTake.definitionId} with ${contents[0].definitionId} in insert.`);
                    return true; // Handled
                }
            }

            // Execute
            updateSource();
            if (!insert.state.contents) insert.state.contents = [];
            insert.state.contents.push(itemToTake);
            console.log(`Picked up ${itemToTake.definitionId} into insert.`);
            return true;
        }
        return false;
    }

    // New: Action to Pick Up Appliance (Triggered by 500ms Hold)
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

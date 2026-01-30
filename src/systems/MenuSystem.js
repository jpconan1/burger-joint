import { ASSETS } from '../constants.js';
import { ACTIONS } from './Settings.js';
import itemsData from '../data/items.json' with { type: 'json' };
import { MenuRenderer } from '../renderers/MenuRenderer.js';

export class MenuSystem {
    constructor(game) {
        this.game = game;
        this.selectedButtonIndex = 0; // 0 to 3
        this.menuSlots = [null, null, null, null];

        // Initialize Default Menu (Plain Burger)
        this.menuSlots[0] = {
            type: 'Composite',
            definitionId: 'burger',
            name: 'Plain',
            state: {
                bun: { definitionId: 'plain_bun' },
                toppings: [{ definitionId: 'beef_patty', state: { cook_level: 'cooked' } }]
            }
        };

        // Load and Categorize Items
        this.buns = [];
        this.patties = [];
        this.toppings = [];

        this.sauces = [];
        this.availableSides = [];
        this.availableDrinks = [];

        this.sides = []; // Currently selected sides on the menu
        this.drinks = []; // Currently selected drinks on the menu

        this.data = itemsData; // Store references
        this.processItems(itemsData); // Initial blind process (will be filtered later if game is ready)

        // If game is ready, update availability immediately? 
        // Game constructor calls this, so game properties might not be fully set yet (e.g. shopItems).
        // We will call updateAvailableItems explicitly from Game setup.

        this.expandedSlotIndex = null; // Index of the slot that has the sub-menu open
        this.subButtonIndex = 0; // 0 (bun) or 1 (patty)

        // Selection Mode State
        this.selectionMode = null; // null, 'bun', 'patty'
        this.selectionIndex = 0; // Index in the specific item array being browsed

        this.namingMode = false;
        this.tempName = '';

        this.scrollRow = 0;

        // Initialize Renderer
        this.menuRenderer = new MenuRenderer(game);
    }


    /**
     * Get the current menu configuration for the day.
     * Currently returns null to allow OrderSystem to use default logic.
     */
    processItems(data) {
        if (!data || !data.groups) return;

        // Store raw categorization for reference, but don't populate 'available' lists until verified
        this.rawBuns = [];
        this.rawPatties = [];
        this.rawToppings = [];
        this.rawSides = [];
        this.rawDrinks = [];

        const processSingleItem = (item) => {
            if (!item || !item.id) return;

            // Buns
            if (item.category === 'bun') {
                this.rawBuns.push(item);
                // this.buns.push(item); // Logic moved to updateAvailableItems
            }
            // Patties - Treat as toppings now
            else if (item.category === 'patty') {
                this.rawToppings.push(item);
            }
            // Toppings & Sauces
            else if (item.isTopping || item.category === 'topping') {
                this.rawToppings.push(item);
            }
            // Sides
            else if (item.orderConfig && item.orderConfig.type === 'side') {
                this.rawSides.push(item);
            }
            // Drinks
            else if (item.orderConfig && item.orderConfig.type === 'drink') {
                this.rawDrinks.push(item);
            }
        };

        data.groups.forEach(group => {
            if (group.item) processSingleItem(group.item);
            if (group.slice) processSingleItem(group.slice);
            if (group.items && Array.isArray(group.items)) {
                group.items.forEach(subItem => processSingleItem(subItem));
            }
        });
    }

    updateAvailableItems() {
        if (!this.game || !this.game.shopItems) return;

        this.toppings = [];
        this.availableSides = [];
        this.availableDrinks = [];
        this.buns = [];
        this.patties = [];
        this.sauces = []; // Helper for sorting

        const checkUnlocked = (itemId) => {
            // Trace dependency up to a Shop Item
            // 1. Direct Shop Item?
            const shopItem = this.game.shopItems.find(i => i.id === itemId);
            if (shopItem) return shopItem.unlocked;

            // 2. Dependency Trace
            let currentId = itemId;
            let depth = 0;
            while (depth < 5) { // Safety break
                const parentId = this.game.itemDependencyMap[currentId];
                if (!parentId) break; // Reached top without finding shop item?

                // Check if Parent is a Shop Item
                const pShopItem = this.game.shopItems.find(i => i.id === parentId);
                if (pShopItem) {
                    return pShopItem.unlocked;
                }

                currentId = parentId;
                depth++;
            }

            // If we couldn't find a source, assume unlocked? Or Locked? 
            // Most things come from boxes. If no box found, it might be a base item (but usually base items are in shop).
            // Default to TRUE if no supply chain found (safeguard), 
            // BUT for our specific "Toppings locked" goal, we want to err on side of caution?
            // Actually, if it's not in the shop, it's not purchasable, so effectively "unlocked"/available implies we have it?
            // Let's assume unlocked if no parent found (e.g. maybe logicless item), 
            // UNLESS it's clearly a known topping.
            return true;
        };

        // Filter Toppings
        this.rawToppings.forEach(t => {
            if (checkUnlocked(t.id)) {
                if (t.orderConfig && t.orderConfig.capability === 'ADD_COLD_SAUCE') {
                    this.sauces.push(t);
                } else {
                    this.toppings.push(t);
                }
            }
        });

        // Merge sauces at end
        this.toppings = [...this.toppings, ...this.sauces];

        // Filter Sides
        this.rawSides.forEach(s => {
            if (checkUnlocked(s.id)) {
                this.availableSides.push(s);
            }
        });

        // Filter Drinks
        this.rawDrinks.forEach(d => {
            if (checkUnlocked(d.id)) {
                this.availableDrinks.push(d);
            }
        });

        // Filter Buns
        this.rawBuns.forEach(b => {
            if (checkUnlocked(b.id)) {
                this.buns.push(b);
            }
        });

        // Ensure defaults if lists are empty
        if (this.buns.length === 0 && this.rawBuns.length > 0) {
            // Fallback: Add plain bun if nothing else
            const plain = this.rawBuns.find(b => b.id === 'plain_bun');
            if (plain) this.buns.push(plain);
        }

        console.log(`[MenuSystem] Updated Available Items. Toppings: ${this.toppings.length}, Sides: ${this.availableSides.length}, Drinks: ${this.availableDrinks.length}`);
    }

    getRandomItem(array) {
        if (!array || !array.length) return null;
        return array[Math.floor(Math.random() * array.length)];
    }

    getMenu() {
        // Filter out empty slots
        const activeSlots = this.menuSlots.filter(s => s !== null);

        // If no burgers defined, return null to let OrderSystem fallback (though we init with Plain now)
        if (activeSlots.length === 0) return null;

        const burgers = activeSlots.map(slot => {
            // Map toppings to OrderSystem format
            const list = slot.state.toppings || [];
            const toppingsConfig = {};
            list.forEach(t => {
                // key: definitionId, value: 'standard' or 'optional'
                toppingsConfig[t.definitionId] = t.optional ? 'optional' : 'standard';
            });

            return {
                bun: slot.state.bun ? slot.state.bun.definitionId : 'plain_bun',
                toppings: toppingsConfig,
                name: slot.name // Pass the custom name
            };
        });

        return {
            burgers: burgers,
            sides: this.sides.map(s => s.definitionId),
            drinks: this.drinks.map(d => d.definitionId)
        };
    }

    handleInput(event, settings) {
        try {
            const code = event.code;
            const key = event.key;
            const interactKey = settings ? settings.getBinding(ACTIONS.INTERACT) : 'KeyE';
            const pickUpKey = settings ? settings.getBinding(ACTIONS.PICK_UP) : 'Space';

            if (this.namingMode) {
                // --- NAMING MODE ---
                if (code === 'Enter') {
                    // Confirm Name
                    if (this.menuSlots[this.expandedSlotIndex]) {
                        this.menuSlots[this.expandedSlotIndex].name = this.tempName;
                    }
                    this.namingMode = false;
                } else if (code === 'Backspace') {
                    this.tempName = this.tempName.slice(0, -1);
                } else if (code === 'Escape') {
                    this.namingMode = false;
                    this.menuSlots[this.expandedSlotIndex] = null;
                    this.expandedSlotIndex = null;
                } else if (key && key.length === 1) {
                    if (/^[a-zA-Z0-9 ]$/.test(key)) {
                        if (this.tempName.length < 12) { // Max length
                            this.tempName += key;
                        }
                    }
                }
                return true; // Consume input in naming mode
            }




            if (this.selectionMode) {
                // --- SELECTION TYPE MODE (Scrolling options) ---
                let list;
                if (this.selectionMode === 'bun') list = this.buns;
                else if (this.selectionMode === 'patty') list = this.patties;
                else if (this.selectionMode === 'topping') list = this.toppings;
                else if (this.selectionMode === 'side') list = this.availableSides;
                else if (this.selectionMode === 'drink') list = this.availableDrinks;

                if (!list) list = [];

                const slot = this.menuSlots[this.expandedSlotIndex];

                // Helper: Check if an item index is valid (not used by other slots)
                const isOptionValid = (index) => {
                    if (index < 0 || index >= list.length) return false;
                    const item = list[index];
                    if (!item) return false;

                    // Topping Selection (subButtonIndex >= 1)
                    if (this.selectionMode === 'topping' && slot) {
                        // Current slot logic: 0=Bun, 1=Topping0, 2=Topping1...
                        const currentSlotIndex = this.subButtonIndex - 1;

                        // Prevent duplicates (User Request: "ui shouldnt even allow double toppings")
                        const isDuplicate = slot.state.toppings.some((t, i) => i !== currentSlotIndex && t.definitionId === item.id);
                        if (isDuplicate) return false;

                        return true;
                    } else if (this.selectionMode === 'side') {
                        return !this.sides.some((s, i) => i !== this.subButtonIndex && s.definitionId === item.id);
                    } else if (this.selectionMode === 'drink') {
                        return !this.drinks.some((d, i) => i !== this.subButtonIndex && d.definitionId === item.id);
                    }
                    return true;
                };

                if (list.length > 0) {
                    if (code === 'KeyA' || code === 'ArrowLeft') {
                        let nextIndex = (this.selectionIndex - 1 + list.length) % list.length;

                        // Check validity for toppings, sides, and drinks
                        if (this.selectionMode === 'topping' || this.selectionMode === 'side' || this.selectionMode === 'drink') {
                            let scanned = 0;
                            const limit = list.length + 5;
                            while (!isOptionValid(nextIndex) && scanned < limit) {
                                nextIndex = (nextIndex - 1 + list.length) % list.length;
                                scanned++;
                            }
                        }

                        this.selectionIndex = nextIndex;
                        this.updatePreview(list[this.selectionIndex]);

                    } else if (code === 'KeyD' || code === 'ArrowRight') {
                        let nextIndex = (this.selectionIndex + 1) % list.length;

                        // Check validity for toppings, sides, and drinks
                        if (this.selectionMode === 'topping' || this.selectionMode === 'side' || this.selectionMode === 'drink') {
                            let scanned = 0;
                            const limit = list.length + 5;
                            while (!isOptionValid(nextIndex) && scanned < limit) {
                                nextIndex = (nextIndex + 1) % list.length;
                                scanned++;
                            }
                        }

                        this.selectionIndex = nextIndex;
                        console.log(`[MenuSystem] Selection Change: ${this.selectionMode}, Index: ${this.selectionIndex}/${list.length}, Item: ${list[this.selectionIndex].id}`);
                        this.updatePreview(list[this.selectionIndex]);
                    } else if (code === interactKey || code === pickUpKey) {
                        // Confirm Selection
                        // The preview is already updated, just exit mode

                        // User Request: Jump cursor to "Add Topping" (next slot) after confirming a new topping
                        // User Request: Jump cursor to "Add Topping" (next slot) after confirming a new topping
                        if (this.selectionMode === 'topping') {
                            const slot = this.menuSlots[this.expandedSlotIndex];
                            // Toppings start at index 1 (0=Bun)
                            const tIndex = this.subButtonIndex - 1;
                            if (slot && slot.state.toppings && tIndex === slot.state.toppings.length - 1) {
                                // Advance cursor to "Add" button
                                this.subButtonIndex++;

                                // Update Scroll if needed
                                const VISIBLE_ROWS = 3;
                                const newRow = 1 + Math.floor((this.subButtonIndex - 1) / 2);
                                if (newRow >= this.scrollRow + VISIBLE_ROWS) {
                                    this.scrollRow = newRow - VISIBLE_ROWS + 1;
                                }
                            }
                        } else if (this.selectionMode === 'side' || this.selectionMode === 'drink') {
                            const list = (this.selectionMode === 'side') ? this.sides : this.drinks;
                            // subButtonIndex corresponds directly to the item index in the list
                            if (this.subButtonIndex === list.length - 1) {
                                // Advance cursor to "Add" button
                                this.subButtonIndex++;

                                // Update Scroll if needed
                                const VISIBLE_ROWS = 3;
                                const newRow = Math.floor(this.subButtonIndex / 2);
                                if (newRow >= this.scrollRow + VISIBLE_ROWS) {
                                    this.scrollRow = newRow - VISIBLE_ROWS + 1;
                                }
                            }
                        }

                        this.selectionMode = null;
                    } else if (code === 'Escape') {
                        // Cancel Selection (revert? for now just exit)
                        this.selectionMode = null;
                    }
                } else {
                    // Empty list safeguard - allow exit
                    if (code === 'Escape' || code === interactKey) {
                        this.selectionMode = null;
                    }
                }
                return true;


            } else if (this.expandedSlotIndex === null || this.expandedSlotIndex === undefined) {
                // --- MAIN MENU NAVIGATION ---
                const isPostDay = (this.game.gameState === 'MENU_CUSTOM');

                if (code === 'KeyA' || code === 'ArrowLeft') {
                    if (this.selectedButtonIndex === 4) {
                        // Sides -> nothing (or loop?)
                    } else if (this.selectedButtonIndex === 5) {
                        this.selectedButtonIndex = 4;
                    } else {
                        this.selectedButtonIndex = Math.max(0, this.selectedButtonIndex - 1);
                    }
                } else if (code === 'KeyD' || code === 'ArrowRight') {
                    if (this.selectedButtonIndex === 4) {
                        this.selectedButtonIndex = 5;
                    } else if (this.selectedButtonIndex === 5) {
                        // Drinks -> nothing
                    } else {
                        if (this.selectedButtonIndex === 3 && isPostDay) {
                            return 'NEXT';
                        }
                        this.selectedButtonIndex = Math.min(3, this.selectedButtonIndex + 1);
                    }
                } else if (code === 'KeyS' || code === 'ArrowDown') {
                    // Move to Row 1 (Sides/Drinks)
                    if (this.selectedButtonIndex < 4) {
                        if (this.selectedButtonIndex <= 1) {
                            this.selectedButtonIndex = 4; // Left half -> Sides
                        } else {
                            this.selectedButtonIndex = 5; // Right half -> Drinks
                        }
                    } else if (this.selectedButtonIndex === 5 && isPostDay) {
                        // Drinks -> Next
                        return 'NEXT';
                    }
                } else if (code === 'KeyW' || code === 'ArrowUp') {
                    // Move to Row 0 (Burgers)
                    if (this.selectedButtonIndex === 4) {
                        this.selectedButtonIndex = 0;
                    } else if (this.selectedButtonIndex === 5) {
                        this.selectedButtonIndex = 2; // Below slot 2/3
                    }
                } else if (code === interactKey) {
                    // Open Sub-menu / Naming
                    this.expandedSlotIndex = this.selectedButtonIndex;
                    this.subButtonIndex = 0;
                    this.scrollRow = 0;

                    // Initialize slot if empty to default burger so we have something to edit
                    // BUT only for indices 0-3 (Burgers)
                    if (this.expandedSlotIndex < 4) {
                        if (!this.menuSlots[this.expandedSlotIndex]) {
                            const defaultBun = this.buns.length > 0 ? this.buns[0] : { id: 'plain_bun' };
                            const defaultPatty = this.patties.length > 0 ? this.patties[0] : { id: 'beef_patty' };

                            this.menuSlots[this.expandedSlotIndex] = {
                                type: 'Composite',
                                definitionId: 'burger',
                                name: '', // Initialize name
                                state: {
                                    bun: { definitionId: defaultBun.id },
                                    toppings: [{ definitionId: 'beef_patty', state: { cook_level: 'cooked' } }]
                                }
                            };

                            // Enter Naming Mode only on new creation
                            this.namingMode = true;
                            this.tempName = '';
                        }
                    } else {
                        // Sides (4) or Drinks (5)
                        // No specific initialization needed, they use this.sides / this.drinks
                        // Just open sub-menu
                    }
                } else if ((code === 'Delete' || code === 'Backspace' || code === pickUpKey) && this.selectedButtonIndex < 4) {
                    // Delete Burger
                    if (this.menuSlots[this.selectedButtonIndex]) {
                        const burgerCount = this.menuSlots.slice(0, 4).filter(s => s !== null).length;
                        if (burgerCount > 1) {
                            this.menuSlots[this.selectedButtonIndex] = null;
                        }
                    }
                }
            } else {
                // --- SUB-MENU NAVIGATION ---
                const slotIndex = this.expandedSlotIndex;
                let isBurger = slotIndex < 4;

                let list = [];
                let currentItems = [];
                if (isBurger) {
                    const slot = this.menuSlots[slotIndex];
                    list = slot ? slot.state.toppings : [];
                } else if (slotIndex === 4) {
                    list = this.sides;
                } else if (slotIndex === 5) {
                    list = this.drinks;
                }

                // Calculate max index
                // Burger: Bun(0), Toppings(1..), Add
                // Aux: Items(0..), Add
                const baseOffset = isBurger ? 1 : 0;
                const maxIndex = baseOffset + list.length;

                if (code === 'KeyA' || code === 'ArrowLeft') {
                    if (this.subButtonIndex % 2 === 1) {
                        this.subButtonIndex -= 1;
                    }
                } else if (code === 'KeyD' || code === 'ArrowRight') {
                    if (this.subButtonIndex % 2 === 0 && this.subButtonIndex + 1 <= maxIndex) {
                        this.subButtonIndex += 1;
                    }
                } else if (code === 'KeyW' || code === 'ArrowUp') {
                    if (this.subButtonIndex < 2) {
                        // Return to main menu (cancel)
                        this.expandedSlotIndex = null;
                        this.selectionMode = null;
                    } else {
                        this.subButtonIndex -= 2;
                    }
                } else if (code === 'KeyS' || code === 'ArrowDown') {
                    if (this.subButtonIndex + 2 <= maxIndex) {
                        this.subButtonIndex += 2;
                    }
                }

                // --- UPDATE SCROLL POSITION ---
                const VISIBLE_ROWS = 3; // Must match CSS/Layout assumptions
                // Map index to visually consistent rows
                // Burger: 0,1->Row0. 2,3->Row1.
                // Aux: 0,1->Row0.
                const offsetIndex = this.subButtonIndex - (isBurger ? 2 : 0);
                const currentRow = (isBurger && this.subButtonIndex < 2) ? 0 : 1 + Math.floor(Math.max(0, offsetIndex) / 2);

                let calculatedRow = 0;
                if (isBurger) {
                    calculatedRow = (this.subButtonIndex < 1) ? 0 : Math.floor((this.subButtonIndex + 1) / 2); // 0->0, 1(Top0)->1, 2(Top1)->1
                } else {
                    calculatedRow = Math.floor(this.subButtonIndex / 2);
                }

                if (calculatedRow < this.scrollRow) {
                    this.scrollRow = calculatedRow;
                } else if (calculatedRow >= this.scrollRow + VISIBLE_ROWS) {
                    this.scrollRow = calculatedRow - VISIBLE_ROWS + 1;
                }
                // ------------------------------

                // ------------------------------

                const isInteract = (code === interactKey);
                const isPickUp = (code === pickUpKey);

                if (isInteract || isPickUp) {
                    if (isBurger) {
                        // BURGER INTERACTIONS
                        if (this.subButtonIndex === 0) {
                            this.selectionMode = 'bun';
                            this.selectionIndex = 0;
                        } else if (this.subButtonIndex === maxIndex) {
                            // Add Topping
                            const slot = this.menuSlots[slotIndex];
                            if (slot && this.toppings.length > 0) {
                                // Find first available topping that isn't already on the burger
                                const currentToppingIds = slot.state.toppings.map(t => t.definitionId);
                                const availableTopping = this.toppings.find(t => !currentToppingIds.includes(t.id));

                                if (availableTopping) {
                                    slot.state.toppings.push({ definitionId: availableTopping.id });
                                    this.selectionMode = 'topping';
                                    this.selectionIndex = this.toppings.indexOf(availableTopping); // Sync selection index

                                    // Ensure scroll follows
                                    const newRow = Math.floor((this.subButtonIndex + 1) / 2);
                                    if (newRow >= this.scrollRow + VISIBLE_ROWS) {
                                        this.scrollRow = newRow - VISIBLE_ROWS + 1;
                                    }
                                } else {
                                    // Feedback? No more toppings available to add
                                    // console.log("No unique toppings left to add");
                                }
                            }
                            // Topping Interaction (Remove / Toggle Optional)
                        } else if (this.subButtonIndex >= 1) {
                            const slot = this.menuSlots[slotIndex];
                            if (slot) {
                                const tIndex = this.subButtonIndex - 1;
                                if (tIndex >= 0 && tIndex < slot.state.toppings.length) {
                                    const topping = slot.state.toppings[tIndex];

                                    if (isPickUp) {
                                        if (!topping.optional) {
                                            // Normal -> Optional
                                            topping.optional = true;
                                        } else {
                                            // Optional -> Removed
                                            // FIX: Prevent removing the last topping (No Bun-Only Burgers)
                                            if (slot.state.toppings.length > 1) {
                                                slot.state.toppings.splice(tIndex, 1);
                                                if (this.subButtonIndex >= 1 + slot.state.toppings.length) {
                                                    this.subButtonIndex = Math.max(1, 1 + slot.state.toppings.length - 1);
                                                }
                                            } else {
                                                // Feedback: Cannot remove last topping
                                                // this.game.audioSystem.playSFX('error'); 
                                            }
                                        }
                                    } else if (isInteract) {
                                        this.selectionMode = 'topping';
                                        // Find index in main list
                                        const def = this.toppings.find(t => t.id === topping.definitionId);
                                        if (def) this.selectionIndex = this.toppings.indexOf(def);
                                        else this.selectionIndex = 0;
                                    }
                                }
                            }
                        }
                    } else {
                        // SIDE / DRINK INTERACTIONS
                        if (this.subButtonIndex === maxIndex) {
                            // Add Side/Drink
                            const collection = (slotIndex === 4) ? this.sides : this.drinks;
                            const options = (slotIndex === 4) ? this.availableSides : this.availableDrinks;

                            if (options.length > 0) {
                                // Find first available option
                                let defaultItem = null;
                                const currentDefinitions = collection.map(c => c.definitionId);
                                for (const opt of options) {
                                    if (!currentDefinitions.includes(opt.id)) {
                                        defaultItem = opt;
                                        break;
                                    }
                                }

                                if (defaultItem) {
                                    collection.push({ definitionId: defaultItem.id });

                                    this.selectionMode = (slotIndex === 4) ? 'side' : 'drink';
                                    this.selectionIndex = options.indexOf(defaultItem);

                                    // Scroll
                                    const newRow = Math.floor(this.subButtonIndex / 2);
                                    if (newRow >= this.scrollRow + VISIBLE_ROWS) {
                                        this.scrollRow = newRow - VISIBLE_ROWS + 1;
                                    }
                                }
                            }
                        } else {
                            // Clicked on existing Item -> Remove
                            const collection = (slotIndex === 4) ? this.sides : this.drinks;
                            if (this.subButtonIndex >= 0 && this.subButtonIndex < collection.length) {
                                collection.splice(this.subButtonIndex, 1);
                                // Adjust cursor
                                if (this.subButtonIndex >= collection.length) {
                                    this.subButtonIndex = Math.min(this.subButtonIndex, collection.length);
                                }
                            }
                        }
                    }

                } else if (code === 'Escape') {
                    this.expandedSlotIndex = null;
                }
                return true;
            }

            return false; // Not handled (let Game handle it, e.g. closing menu)
        } catch (e) {
            console.error("MenuSystem handleInput error:", e);
            return false;
        }
    }

    updatePreview(item) {
        if (!item) return;

        if (this.selectionMode === 'bun') {
            const slot = this.menuSlots[this.expandedSlotIndex];
            if (slot) slot.state.bun.definitionId = item.id;
        } else if (this.selectionMode === 'topping') {
            const slot = this.menuSlots[this.expandedSlotIndex];
            if (slot) {
                const tIndex = this.subButtonIndex - 1;
                if (slot.state.toppings[tIndex]) {
                    slot.state.toppings[tIndex].definitionId = item.id;
                }
            }
        } else if (this.selectionMode === 'side') {
            if (this.sides[this.subButtonIndex]) {
                this.sides[this.subButtonIndex].definitionId = item.id;
            }
        } else if (this.selectionMode === 'drink') {
            if (this.drinks[this.subButtonIndex]) {
                this.drinks[this.subButtonIndex].definitionId = item.id;
            }
        }
    }

    calculateComplexity() {
        let score = 0;
        const uniqueBuns = new Set();
        const uniquePatties = new Set();

        // Burgers (Slots 0-3)
        for (let i = 0; i < 4; i++) {
            const slot = this.menuSlots[i];
            if (slot && slot.state) {
                if (slot.state.bun) uniqueBuns.add(slot.state.bun.definitionId);

                if (slot.state.toppings) {
                    slot.state.toppings.forEach(t => {
                        const item = this.toppings.find(top => top.id === t.definitionId);
                        if (item) {
                            if (['bacon', 'fried_onion'].includes(item.id)) {
                                score += 2;
                            } else if (item.isSlice) {
                                score += 1.5;
                            } else if (item.orderConfig && item.orderConfig.capability === 'ADD_COLD_SAUCE') {
                                score += 1;
                            } else {
                                // Default fallback, assume simple topping
                                score += 1.5;
                            }
                        }
                    });
                }
            }
        }

        score += uniqueBuns.size;
        score += uniquePatties.size;
        score += this.sides.length * 2;
        score += this.drinks.length * 1.5;

        return score;
    }

    /**
     * Replaces Canvas-based rendering with HTML Overlays
     */
    render(renderer) {
        this.menuRenderer.render(this, renderer);
    }

    close() {
        if (this.menuRenderer && this.menuRenderer.overlay) {
            this.menuRenderer.overlay.style.display = 'none';
        }
    }

}

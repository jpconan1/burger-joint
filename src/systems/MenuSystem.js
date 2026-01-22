import { ASSETS } from '../constants.js';
import { ACTIONS } from './Settings.js';
import itemsData from '../data/items.json';

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
                patty: { definitionId: 'beef_patty', state: { cook_level: 'cooked' } },
                toppings: []
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
            // Patties
            else if (item.category === 'patty') {
                this.rawPatties.push(item);
                // this.patties.push(item); // Logic moved to updateAvailableItems
            }
            // Toppings & Sauces
            else if (item.isTopping) {
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

        // Filter Patties
        this.rawPatties.forEach(p => {
            if (checkUnlocked(p.id)) {
                this.patties.push(p);
            }
        });

        // Ensure defaults if lists are empty (prevent soft-lock if base items are somehow locked?)
        if (this.buns.length === 0 && this.rawBuns.length > 0) {
            // Fallback: Add plain bun if nothing else
            const plain = this.rawBuns.find(b => b.id === 'plain_bun');
            if (plain) this.buns.push(plain);
        }
        if (this.patties.length === 0 && this.rawPatties.length > 0) {
            // Fallback: Add beef patty if nothing else
            const beef = this.rawPatties.find(p => p.id === 'beef_patty');
            if (beef) this.patties.push(beef);
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
            const toppingsConfig = {};
            if (slot.state.toppings) {
                slot.state.toppings.forEach(t => {
                    // key: definitionId, value: 'standard' or 'optional'
                    toppingsConfig[t.definitionId] = t.optional ? 'optional' : 'standard';
                });
            }

            return {
                bun: slot.state.bun ? slot.state.bun.definitionId : 'plain_bun',
                patty: slot.state.patty ? slot.state.patty.definitionId : 'beef_patty',
                toppings: toppingsConfig,
                name: slot.name // Pass the custom name
            };
        });

        // Current OrderSystem logic also supports 'sides' and 'drinks' in the menu config.
        // For now, we only control burgers. OrderSystem will handle sides/drinks if we pass them, 
        // or we can let OrderSystem default them if missing?
        // Looking at OrderSystem.js:81, it receives `menuConfig`.
        // If we only return { burgers: [...] }, OrderSystem.js:125 checks if (menuConfig.sides ...).
        // If we don't return sides, customers won't order sides unless we populate them here or 
        // if OrderSystem falls back. OrderSystem DOES NOT fall back for sides if menuConfig exists but sides is missing.
        // It simply skips sides (lines 125-130).
        // Since the prompt asks for the menu to be the "single source of truth", strictly speaking 
        // we should probably include sides/drinks if we want them ordered.
        // However, the prompt focuses heavily on "what burgers they can order".
        // Let's include default sides/drinks so the game isn't boring (only burgers).

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
                    // Cancel Naming and Creation? Or just keep empty name?
                    // Let's cancel the whole slot creation for safety or just exit naming
                    this.namingMode = false;
                    // Optionally clear the slot if they cancel naming? 
                    // "When the user presses 'add burger' ... put up text input"
                    // If they Esc, maybe we go back to main menu
                    this.menuSlots[this.expandedSlotIndex] = null;
                    this.expandedSlotIndex = null;
                } else if (key && key.length === 1) {
                    // Simple alphanumeric check
                    // Allow letters, numbers, spaces
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

                    if (this.selectionMode === 'topping' && slot) {
                        const currentSlotIndex = this.subButtonIndex - 2;
                        return !slot.state.toppings.some((t, i) => i !== currentSlotIndex && t.definitionId === item.id);
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
                                    patty: { definitionId: defaultPatty.id, state: { cook_level: 'cooked' } },
                                    toppings: [] // Start with no toppings
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
                // Burger: Bun(0), Patty(1), Toppings(2..), Add
                // Aux: Items(0..), Add
                const baseOffset = isBurger ? 2 : 0;
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
                const VISIBLE_ROWS = 3;
                // Map index to visually consistent rows
                // Burger: 0,1->Row0. 2,3->Row1.
                // Aux: 0,1->Row0.
                const offsetIndex = this.subButtonIndex - (isBurger ? 2 : 0);
                const currentRow = (isBurger && this.subButtonIndex < 2) ? 0 : 1 + Math.floor(Math.max(0, offsetIndex) / 2);
                if (!isBurger) {
                    // Aux rows start at 0
                    // 0,1 -> Row 0
                    // 2,3 -> Row 1
                    // The logic above: 1 + floor(...) -> starts at 1?
                    // If baseOffset is 0 (Aux). Index 0. 
                    // offsetIndex = 0.
                    // currentRow = 1 + floor(0) = 1.
                    // Should be 0.
                }

                let calculatedRow = 0;
                if (isBurger) {
                    calculatedRow = (this.subButtonIndex < 2) ? 0 : 1 + Math.floor((this.subButtonIndex - 2) / 2);
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
                        } else if (this.subButtonIndex === 1) {
                            this.selectionMode = 'patty';
                            this.selectionIndex = 0;
                        } else if (this.subButtonIndex === maxIndex) {
                            // Add Topping
                            const slot = this.menuSlots[slotIndex];
                            if (slot && this.toppings.length > 0) {
                                // Check available toppings logic...
                                const usedIds = new Set(slot.state.toppings.map(t => t.definitionId));
                                const availableTopping = this.toppings.find(t => !usedIds.has(t.id));

                                if (availableTopping) {
                                    slot.state.toppings.push({ definitionId: availableTopping.id });
                                    this.selectionMode = 'topping';
                                    this.selectionIndex = this.toppings.indexOf(availableTopping);

                                    // Ensure scroll follows
                                    const newRow = 1 + Math.floor((this.subButtonIndex - 2) / 2);
                                    if (newRow >= this.scrollRow + VISIBLE_ROWS) {
                                        this.scrollRow = newRow - VISIBLE_ROWS + 1;
                                    }
                                }
                            }
                            // Topping Interaction (Remove / Toggle Optional)
                        } else if (this.subButtonIndex >= 2) {
                            const slot = this.menuSlots[slotIndex];
                            if (slot) {
                                const tIndex = this.subButtonIndex - 2;
                                if (tIndex >= 0 && tIndex < slot.state.toppings.length) {
                                    const topping = slot.state.toppings[tIndex];

                                    if (isPickUp) {
                                        if (!topping.optional) {
                                            // Normal -> Optional
                                            topping.optional = true;
                                        } else {
                                            // Optional -> Removed (Current Behavior)
                                            slot.state.toppings.splice(tIndex, 1);
                                            if (this.subButtonIndex >= 2 + slot.state.toppings.length) {
                                                this.subButtonIndex = Math.max(2, 2 + slot.state.toppings.length - 1);
                                            }
                                        }
                                    } else if (isInteract) {
                                        // Keeping Interact as strictly Remove for now to avoid confusion, 
                                        // or do we want Interact to open selection? 
                                        // Current behavior (pre-edit) was removal on Interact too.
                                        // Let's modify: Interact opens selection to CHANGE topping?
                                        // Prompt didn't ask for this, but simplistic removal on Interact is annoying.
                                        // For now, let's keep Interact doing the same as PickUp (Remove) for consistency with old behavior,
                                        // OR make PickUp special as requested.
                                        // If I leave Interact as "Remove", it skips the Optional phase.
                                        // Let's make Interact also cycle, or plain remove?
                                        // "pressing pick_up_key on an optional topping removes..."
                                        // I'll leave Interact as strict remove, or maybe disable it? 
                                        // Safest is to let Interact also cycle if we want consistency, but prompt specifically named pick_up_key.
                                        // I will assume Interact also cycles to avoid confused UX.
                                        if (!topping.optional) {
                                            topping.optional = true;
                                        } else {
                                            slot.state.toppings.splice(tIndex, 1);
                                            if (this.subButtonIndex >= 2 + slot.state.toppings.length) {
                                                this.subButtonIndex = Math.max(2, 2 + slot.state.toppings.length - 1);
                                            }
                                        }
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

                            // Find first available option not already in list? 
                            // Actually sides/drinks CAN be duplicates generally, but maybe restricted here?
                            // User said "scroll thru and select".
                            // If I add one, I start selecting.
                            // Default to first available option.
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
                                    // Point to Add Button (current maxIndex became maxIndex-1)
                                    // Actually maxIndex changes dynamically. 
                                    // if we were at last item (index N-1), now N-1 is gone.
                                    // cursor should settle on new N-1 (last item) or N (Add Button).
                                    // If we remove item at 0, items shift. Cursor stays 0.
                                    // If we remove item at end, cursor becomes out of bounds > new length.
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
        } else if (this.selectionMode === 'patty') {
            const slot = this.menuSlots[this.expandedSlotIndex];
            if (slot) slot.state.patty.definitionId = item.id;
        } else if (this.selectionMode === 'topping') {
            const slot = this.menuSlots[this.expandedSlotIndex];
            if (slot) {
                const tIndex = this.subButtonIndex - 2;
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
                if (slot.state.patty) uniquePatties.add(slot.state.patty.definitionId);

                if (slot.state.toppings) {
                    slot.state.toppings.forEach(t => {
                        const item = this.toppings.find(top => top.id === t.definitionId);
                        if (item) {
                            if (itemsData.groups.find(g => g.item && g.item.id === item.id && g.item.cooking) || ['bacon', 'fried_onion'].includes(item.id)) {
                                // Strictly check known cooked toppings or items with cooking stages that are toppings
                                // Actually better to stick to the specific list and properties
                                if (['bacon', 'fried_onion'].includes(item.id)) {
                                    score += 2;
                                } else if (item.isSlice) {
                                    score += 1.5;
                                } else if (item.orderConfig && item.orderConfig.capability === 'ADD_COLD_SAUCE') {
                                    score += 1;
                                } else {
                                    // Fallback for sliced/chopped items that might be missing isSlice
                                    score += 1.5;
                                }
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

    renderComplexity(renderer, layout) {
        const ctx = renderer.ctx;
        const { x, bg, y } = layout;

        const score = this.calculateComplexity();

        ctx.font = "900 24px Inter, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        // Outline
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 4;
        ctx.strokeText(`Complexity: ${score}`, x + bg.width - 30, y + 40);
        ctx.fillText(`Complexity: ${score}`, x + bg.width - 30, y + 40);
    }

    /**
     * Render the Custom Menu UI.
     * Displays a centered window with background, logo, and 4 buttons.
     * @param {Renderer} renderer 
     */
    render(renderer) {
        try {
            const layout = this.renderBackground(renderer);
            if (!layout) return;

            this.renderComplexity(renderer, layout);

            this.renderAuxButtons(renderer, layout);

            for (let i = 0; i < 4; i++) {
                this.renderMenuSlot(renderer, i, layout);
            }


            this.renderNamingOverlay(renderer);

            // Draw Next Arrow if in Post Day flow
            if (this.game.gameState === 'MENU_CUSTOM') {
                this.renderNextArrow(renderer, layout);
            }


        } catch (e) {
            console.error("MenuSystem render error:", e);
        }
    }

    renderNextArrow(renderer, layout) {
        const ctx = renderer.ctx;
        const { x, bg, y } = layout;
        const arrowX = x + bg.width + 40;
        const arrowY = y + bg.height / 2;

        const arrowImg = this.game.assetLoader.get(ASSETS.UI.GREEN_ARROW);
        const size = 64;

        if (arrowImg) {
            ctx.drawImage(arrowImg, arrowX - size / 2, arrowY - size / 2, size, size);
        }

        // Draw hint
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("NEXT >", arrowX, arrowY + size / 2 + 20);
    }

    renderBackground(renderer) {
        const ctx = renderer.ctx;
        const canvas = renderer.canvas;

        // Draw Dark Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const bg = renderer.assetLoader.get(ASSETS.UI.MENU_BG);
        const logo = renderer.assetLoader.get(ASSETS.UI.MENU_LOGO);

        if (!bg) {
            // Fallback Loading Screen
            ctx.fillStyle = '#333';
            ctx.fillRect(canvas.width / 4, canvas.height / 4, canvas.width / 2, canvas.height / 2);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText("Menu Loading...", canvas.width / 2, canvas.height / 2);
            return null;
        }

        // Calculate Window Position (Centered)
        const x = (canvas.width - bg.width) / 2;
        const y = (canvas.height - bg.height) / 2;

        // Draw Background
        ctx.drawImage(bg, x, y);

        // Draw Logo
        let logoY = y + 30;
        let logoHeight = 0;
        if (logo) {
            const targetWidth = logo.width * 0.5;
            const targetHeight = logo.height * 0.5;
            const logoX = x + (bg.width - targetWidth) / 2;
            ctx.drawImage(logo, logoX, logoY, targetWidth, targetHeight);
            logoHeight = targetHeight;
        } else {
            logoHeight = 50;
        }

        const buttonY = logoY + logoHeight + 20;
        const colWidth = bg.width / 6;

        return { x, y, bg, colWidth, buttonY };
    }

    renderMenuSlot(renderer, index, layout) {
        const { x, colWidth, buttonY } = layout;
        const startCol = 1;
        const colIndex = startCol + index;
        const colX = x + (colIndex * colWidth);
        const ctx = renderer.ctx;

        const button = renderer.assetLoader.get(ASSETS.UI.ADD_BURGER_BUTTON);
        const btnWidth = button ? button.width : 64;
        const btnHeight = button ? button.height : 64;
        const btnX = colX + (colWidth - btnWidth) / 2;

        const slotItem = this.menuSlots[index];

        // 1. Draw Main Slot Content
        if (slotItem) {
            this.renderSlotItemContent(renderer, slotItem, colX, buttonY, colWidth);
        } else {
            // Draw Add Button
            if (button) {
                ctx.drawImage(button, btnX, buttonY);
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.strokeRect(btnX, buttonY, btnWidth, btnHeight);
            }
        }

        // 2. Render Sub-Menu (if expanded)
        if (this.expandedSlotIndex === index && !this.namingMode && slotItem && slotItem.state) {
            this.renderSubMenu(renderer, index, colX, buttonY, colWidth, layout);
        }

        // 3. Render Selector (if selected & not expanded)
        if (index === this.selectedButtonIndex && this.expandedSlotIndex !== index) {
            const selector = renderer.assetLoader.get(ASSETS.UI.SELECTOR);
            const checkBtn = renderer.assetLoader.get(ASSETS.UI.CHECKERBOARD_BUTTON);

            // Determine dimensions based on what's actually drawn
            const isFilled = !!slotItem;
            const targetBtn = isFilled && checkBtn ? checkBtn : button; // might be null

            const displayW = targetBtn ? targetBtn.width : 64;
            const displayH = targetBtn ? targetBtn.height : 64;

            // If filled, we center on column. If empty (Add Button), we center on column.
            const targetX = colX + (colWidth - displayW) / 2;
            const targetY = buttonY;

            if (selector) {
                const sX = targetX + (displayW - selector.width) / 2;
                const sY = targetY + (displayH - selector.height) / 2;
                ctx.drawImage(selector, sX, sY);
            } else {
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 4;
                const padding = 4;
                ctx.strokeRect(targetX - padding, targetY - padding, displayW + padding * 2, displayH + padding * 2);
            }
        }
    }

    renderSlotItemContent(renderer, slotItem, colX, buttonY, colWidth) {
        const ctx = renderer.ctx;
        const checkBtn = renderer.assetLoader.get(ASSETS.UI.CHECKERBOARD_BUTTON);

        if (checkBtn) {
            const checkX = colX + (colWidth - checkBtn.width) / 2;
            ctx.drawImage(checkBtn, checkX, buttonY);

            // Draw Burger
            const burgerWidth = 96;
            const burgerX = checkX + (checkBtn.width - burgerWidth) / 2;
            const burgerY = buttonY - 36;

            renderer.drawBurgerPixels(slotItem, burgerX, burgerY, 1.5);

            // Draw Name
            const nameToDisplay = slotItem.name || '';
            if (nameToDisplay) {
                ctx.font = "900 18px Inter, sans-serif";
                ctx.textAlign = "center";
                ctx.lineWidth = 12;
                ctx.lineJoin = "round";

                const textX = burgerX + (burgerWidth / 2);
                const textY = buttonY + checkBtn.height - 5;

                ctx.strokeStyle = "black";
                ctx.strokeText(nameToDisplay, textX, textY);
                ctx.fillStyle = "white";
                ctx.fillText(nameToDisplay, textX, textY);
            }
        }
    }

    renderSubMenu(renderer, slotIndex, colX, buttonY, colWidth, layout) {
        const ctx = renderer.ctx;
        const { bg, y } = layout;

        const bgButton = renderer.assetLoader.get(ASSETS.UI.BUTTON_BACKGROUND);
        const arrowsButton = renderer.assetLoader.get(ASSETS.UI.BUTTON_ARROWS);
        const mainButton = renderer.assetLoader.get(ASSETS.UI.ADD_BURGER_BUTTON);
        const ticketBg = renderer.assetLoader.get(ASSETS.UI.TICKET_BG);
        const mainBtnHeight = mainButton ? mainButton.height : 64;

        if (!bgButton) return;

        const subButtonY = buttonY + mainBtnHeight + 10;
        const rowHeight = bgButton.height + 10;

        // Calculate positions
        const btn1X = colX + (colWidth * 0.25) - (bgButton.width / 2);
        const btn2X = colX + (colWidth * 0.75) - (bgButton.width / 2);

        // Layout
        const paddingBottom = 20;
        const availableHeight = (y + bg.height) - subButtonY - paddingBottom;
        const contentHeight = availableHeight;
        const VISIBLE_ROWS = Math.floor(contentHeight / rowHeight);

        // Determine Items
        const isBurger = slotIndex < 4;
        let items = [];
        if (isBurger) {
            items = this.menuSlots[slotIndex].state.toppings;
        } else if (slotIndex === 4) items = this.sides;
        else if (slotIndex === 5) items = this.drinks;

        const totalSlots = items.length + 1; // +1 for Add Button

        // Rows Calculation
        let totalRows = 0;
        if (isBurger) {
            const lastItemIndex = totalSlots + 2 - 1; // +2 for Bun/Patty
            const maxRowIndex = (lastItemIndex < 2) ? 0 : 1 + Math.floor((lastItemIndex - 2) / 2);
            totalRows = maxRowIndex + 1;
        } else {
            // Just items: 0,1 -> Row 0; 2,3 -> Row 1
            totalRows = Math.ceil(totalSlots / 2);
        }

        // Draw Background
        const clipPadding = 10;
        if (ticketBg) {
            ctx.drawImage(ticketBg, colX - clipPadding, subButtonY - clipPadding, colWidth + clipPadding * 2, contentHeight + clipPadding * 2);
        }

        // Clip Region
        ctx.save();
        ctx.beginPath();
        ctx.rect(colX - clipPadding, subButtonY - clipPadding, colWidth + clipPadding * 2, contentHeight + clipPadding * 2);
        ctx.clip();

        const drawOffsetY = this.scrollRow * rowHeight;

        if (isBurger) {
            // -- Draw Bun & Patty (Row 0) --
            const row0Y = subButtonY - drawOffsetY;
            this.renderSubItem(renderer, btn1X, row0Y, bgButton, arrowsButton, 'bun', 0, this.menuSlots[slotIndex].state.bun);
            this.renderSubItem(renderer, btn2X, row0Y, bgButton, arrowsButton, 'patty', 1, this.menuSlots[slotIndex].state.patty);

            // -- Draw Toppings (Row 1+) --
            for (let tIndex = 0; tIndex < totalSlots; tIndex++) {
                const globalIndex = 2 + tIndex;
                const row = 1 + Math.floor(tIndex / 2);
                const col = tIndex % 2;
                const topY = subButtonY + (row * rowHeight) - drawOffsetY;
                const topX = (col === 0) ? btn1X : btn2X;

                if (topY + rowHeight < subButtonY || topY > subButtonY + contentHeight) continue;

                if (tIndex < items.length) {
                    this.renderSubItem(renderer, topX, topY, bgButton, arrowsButton, 'topping', globalIndex, items[tIndex]);
                } else {
                    this.renderAddToppingButton(renderer, topX, topY, bgButton, globalIndex);
                }
            }
        } else {
            // -- Draw Aux Items (Sides/Drinks) --
            for (let i = 0; i < totalSlots; i++) {
                const row = Math.floor(i / 2);
                const col = i % 2;
                const topY = subButtonY + (row * rowHeight) - drawOffsetY;
                const topX = (col === 0) ? btn1X : btn2X;

                // Simple Visibility Check
                if (topY + rowHeight < subButtonY || topY > subButtonY + contentHeight) continue;

                const mode = (slotIndex === 4) ? 'side' : 'drink';

                if (i < items.length) {
                    this.renderSubItem(renderer, topX, topY, bgButton, arrowsButton, mode, i, items[i]);
                } else {
                    this.renderAddToppingButton(renderer, topX, topY, bgButton, i);
                }
            }
        }

        ctx.restore();

        // Scrollbar
        if (totalRows > VISIBLE_ROWS) {
            this.renderScrollbar(ctx, colX, colWidth, subButtonY, contentHeight, totalRows, VISIBLE_ROWS);
        }
    }

    renderSubItem(renderer, x, y, bgButton, arrowsButton, mode, index, itemState) {
        const ctx = renderer.ctx;

        // Background
        let currentBg = bgButton;
        if (itemState && itemState.optional) {
            const optBg = renderer.assetLoader.get(ASSETS.UI.BUTTON_BACKGROUND_OPTIONAL);
            if (optBg) currentBg = optBg;
        }
        ctx.drawImage(currentBg, x, y);

        // Arrows (if active selection)
        if (this.selectionMode === mode && this.subButtonIndex === index) {
            if (arrowsButton) {
                const aX = x + (bgButton.width - arrowsButton.width) / 2;
                const aY = y + (bgButton.height - arrowsButton.height) / 2;
                ctx.drawImage(arrowsButton, aX, aY);
            }
        }

        // Item Icon (if available)
        if (itemState) {
            let list = [];
            if (mode === 'bun') list = this.buns;
            else if (mode === 'patty') list = this.patties;
            else if (mode === 'topping') list = this.toppings;
            else if (mode === 'side') list = this.availableSides;
            else if (mode === 'drink') list = this.availableDrinks;

            const def = list.find(t => t.id === itemState.definitionId) || (list.length > 0 ? list[0] : null);

            if (mode === 'side' && this.selectionMode === 'side' && this.subButtonIndex === index) {
                console.log(`[Render] Side Item: request=${itemState.definitionId}, found=${def ? def.id : 'null'}, listLen=${list.length}`);
            }

            // Special case for cooked patties
            let tex = def ? def.texture : null;
            if (mode === 'drink' && def && def.sign) {
                tex = def.sign;
            }
            if (mode === 'patty' && def && def.textures && def.textures.rules) {
                const cookedRule = def.textures.rules.find(r => r.value === 'cooked');
                if (cookedRule) tex = cookedRule.texture;
            }

            if (tex) {
                const img = renderer.assetLoader.get(tex);
                if (img) {
                    const iW = img.width || 64;
                    const iH = img.height || 64;
                    const ix = x + (bgButton.width - iW) / 2;
                    const iy = y + (bgButton.height - iH) / 2;
                    ctx.drawImage(img, ix, iy, iW, iH);
                }
            }
        }

        // Selector (if highlighted but not in active selection mode)
        if (!this.selectionMode && this.subButtonIndex === index) {
            const selector = renderer.assetLoader.get(ASSETS.UI.SELECTOR);
            if (selector) {
                const sX = x + (bgButton.width - selector.width) / 2;
                const sY = y + (bgButton.height - selector.height) / 2;
                ctx.drawImage(selector, sX, sY);
            } else {
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 4;
                ctx.strokeRect(x - 4, y - 4, bgButton.width + 8, bgButton.height + 8);
            }
        }
    }

    renderAuxButtons(renderer, layout) {
        const { x, colWidth, buttonY } = layout;
        const ctx = renderer.ctx;

        const mainBtn = renderer.assetLoader.get(ASSETS.UI.ADD_BURGER_BUTTON);
        const btnHeight = mainBtn ? mainBtn.height : 64;

        // Position Row 2 below Row 1
        const row2Y = buttonY + btnHeight + 20;

        // Center Side Button between Slot 0 & 1 (Cols 1 & 2)
        // Col 1 Start: 1 * CW. Col 2 End: 3 * CW. Center: 2 * CW.
        const sideX = x + (2.0 * colWidth) - (btnHeight / 2);

        // Center Drink Button between Slot 2 & 3 (Cols 3 & 4)
        // Col 3 Start: 3 * CW. Col 4 End: 5 * CW. Center: 4 * CW.
        const drinkX = x + (4.0 * colWidth) - (btnHeight / 2);

        this.renderAuxSlot(renderer, 4, sideX, row2Y, ASSETS.UI.ADD_SIDE_BUTTON, layout);
        this.renderAuxSlot(renderer, 5, drinkX, row2Y, ASSETS.UI.ADD_DRINK_BUTTON, layout);
    }

    renderAuxSlot(renderer, index, btnX, btnY, assetKey, layout) {
        const ctx = renderer.ctx;
        const button = renderer.assetLoader.get(assetKey);
        const { colWidth, x } = layout;

        // Draw Button or Fallback
        if (button) {
            ctx.drawImage(button, btnX, btnY);
        } else {
            // Fallback
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(btnX, btnY, 64, 64);
            ctx.fillStyle = 'white';
            ctx.font = "12px Inter, sans-serif";
            ctx.textAlign = 'center';
            ctx.fillText(index === 4 ? "SIDE" : "DRNK", btnX + 32, btnY + 35);
        }

        // Render Selector
        if (index === this.selectedButtonIndex && this.expandedSlotIndex !== index) {
            const selector = renderer.assetLoader.get(ASSETS.UI.SELECTOR);
            const btnW = button ? button.width : 64;
            const btnH = button ? button.height : 64;

            if (selector) {
                const sX = btnX + (btnW - selector.width) / 2;
                const sY = btnY + (btnH - selector.height) / 2;
                ctx.drawImage(selector, sX, sY);
            } else {
                // Fallback
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 4;
                ctx.strokeRect(btnX - 4, btnY - 4, btnW + 8, btnH + 8);
            }
        }

        // Render Sub-Menu if expanded
        if (this.expandedSlotIndex === index) {
            // Center submenu on button
            const btnW = button ? button.width : 64;
            const virtualColX = btnX + (btnW / 2) - (colWidth / 2);

            this.renderSubMenu(renderer, index, virtualColX, btnY, colWidth, layout);
        }
    }

    renderAddToppingButton(renderer, x, y, bgButton, globalIndex) {
        const ctx = renderer.ctx;
        ctx.drawImage(bgButton, x, y);

        const plusBtn = renderer.assetLoader.get(ASSETS.UI.PLUS_BUTTON);
        if (plusBtn) {
            const pX = x + (bgButton.width - plusBtn.width) / 2;
            const pY = y + (bgButton.height - plusBtn.height) / 2;
            ctx.drawImage(plusBtn, pX, pY);
        }

        // Selector
        if (!this.selectionMode && this.subButtonIndex === globalIndex) {
            const selector = renderer.assetLoader.get(ASSETS.UI.SELECTOR);
            if (selector) {
                const sX = x + (bgButton.width - selector.width) / 2;
                const sY = y + (bgButton.height - selector.height) / 2;
                ctx.drawImage(selector, sX, sY);
            } else {
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 4;
                ctx.strokeRect(x - 4, y - 4, bgButton.width + 8, bgButton.height + 8);
            }
        }
    }

    renderScrollbar(ctx, colX, colWidth, subButtonY, contentHeight, totalRows, visibleRows) {
        const scrollbarX = colX + colWidth - 12;
        const scrollbarY = subButtonY;
        const scrollbarWidth = 6;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(scrollbarX, scrollbarY, scrollbarWidth, contentHeight);

        const maxScroll = totalRows - visibleRows;
        const viewRatio = visibleRows / totalRows;
        const handleH = Math.max(20, contentHeight * viewRatio);
        const trackSpace = contentHeight - handleH;

        const scrollRatio = maxScroll > 0 ? this.scrollRow / maxScroll : 0;
        const handleY = scrollbarY + (scrollRatio * trackSpace);

        ctx.fillStyle = '#eee';
        ctx.fillRect(scrollbarX, handleY, scrollbarWidth, handleH);
    }

    renderNamingOverlay(renderer) {
        if (!this.namingMode) return;

        const ctx = renderer.ctx;
        const canvas = renderer.canvas;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const textField = renderer.assetLoader.get(ASSETS.UI.TEXT_FIELD);
        if (textField) {
            const tfX = (canvas.width - textField.width) / 2;
            const tfY = (canvas.height - textField.height) / 2;
            ctx.drawImage(textField, tfX, tfY);

            ctx.font = "900 32px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.lineWidth = 12;
            ctx.lineJoin = "round";

            const textX = canvas.width / 2;
            const textY = tfY + (textField.height / 2) + 10;

            ctx.strokeStyle = "black";
            ctx.strokeText(this.tempName, textX, textY);
            ctx.fillStyle = "white";
            ctx.fillText(this.tempName, textX, textY);

            // Cursor
            const metrics = ctx.measureText(this.tempName);
            const cursorX = textX + (metrics.width / 2) + 5;
            ctx.fillRect(cursorX, textY - 30, 4, 36);
        }
    }
}

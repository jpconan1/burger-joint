import { ASSETS } from '../constants.js';
import { DEFINITIONS } from '../data/definitions.js';

export class PostDaySystem {
    constructor(game) {
        this.game = game;
        this.state = 'REPORT'; // REPORT, REWARDS, ITEM_SELECTION, MENU_EDIT, SUPPLY_ORDER
        this.selectedRewardIndex = 0; // 0: Topping, 1: Side, 2: Drink
        this.selectedOptionIndex = 0; // 0, 1, 2 for the specific items
        this.rewardOptions = []; // Array of 3 items
        this.rewardGranted = false;
        this.rewardsPicked = 0;

        this.rewardsPicked = 0;

        // Build Mode Logic
        this.waitingForBuild = false;
        this.pendingCategory = -1;

        // Navigation State for Wrapper
        this.arrowSelected = false;
    }

    isRewardLocked(index) {
        const isEndgame = this.game.isEndgameUnlocked;

        if (index === 1) { // Side
            const hasFryer = this.game.hasAppliance('FRYER');
            if (!hasFryer && !isEndgame) return true;
        }

        if (index === 2) { // Drink
            const hasFountain = this.game.hasAppliance('SODA_FOUNTAIN');
            if (!hasFountain && !isEndgame) return true;
        }

        return false;
    }

    start() {
        this.state = 'REPORT';
        this.selectedRewardIndex = 0;
        this.selectedOptionIndex = 0;
        this.rewardOptions = [];
        this.rewardGranted = false;
        this.rewardsPicked = 0;
        this.arrowSelected = false;
        this.waitingForBuild = false;
        this.pendingCategory = -1;
    }

    handleInput(event, settings) {
        // Simple Interaction Key
        const interactKey = settings ? settings.getBinding('INTERACT') : 'KeyE';

        // Prepare inputs object
        const inputs = {
            event,
            settings,
            interactKey,
            isInteract: event.code === interactKey || event.code === 'Enter' || event.code === 'Space',
            isRight: event.code === 'ArrowRight' || (settings && event.code === settings.getBinding('MOVE_RIGHT')),
            isLeft: event.code === 'ArrowLeft' || (settings && event.code === settings.getBinding('MOVE_LEFT')),
            isUp: event.code === 'ArrowUp' || (settings && event.code === settings.getBinding('MOVE_UP')),
            isDown: event.code === 'ArrowDown' || (settings && event.code === settings.getBinding('MOVE_DOWN'))
        };

        // Resume from build mode logic (Global check)
        if (this.waitingForBuild && inputs.isInteract) {
            this.waitingForBuild = false;
            const cat = this.pendingCategory;
            this.pendingCategory = -1;

            this.generateRewardOptions(cat);
            this.state = 'ITEM_SELECTION';
            this.rewardsPicked = 0;
            this.selectedOptionIndex = 1;
            return 'CONTINUE';
        }

        switch (this.state) {
            case 'REPORT': return this.handleReportInput(inputs);
            case 'REWARDS': return this.handleRewardsInput(inputs);
            case 'ITEM_SELECTION': return this.handleItemSelectionInput(inputs);
            case 'MENU_EDIT': return this.handleMenuEditInput(inputs);
            case 'SUPPLY_ORDER': return this.handleSupplyOrderInput(inputs);
            default: return 'CONTINUE';
        }
    }

    handleReportInput({ isInteract }) {
        if (isInteract) {
            this.state = 'REWARDS';
            return 'CONTINUE';
        }
        return 'CONTINUE';
    }

    handleRewardsInput({ isInteract, isUp, isDown }) {
        const hasFryer = this.game.hasAppliance('FRYER') || (this.game.storage['fryer'] && this.game.storage['fryer'] > 0);
        const hasFountain = this.game.hasAppliance('SODA_FOUNTAIN') || (this.game.storage['soda_fountain'] && this.game.storage['soda_fountain'] > 0);

        // Determine valid indices
        const validIndices = [0];
        if (!hasFryer) validIndices.push(1);
        if (!hasFountain) validIndices.push(2);

        // Helper to find current index in valid list
        let currentPos = validIndices.indexOf(this.selectedRewardIndex);
        if (currentPos === -1) {
            this.selectedRewardIndex = validIndices[0];
            currentPos = 0;
        }

        if (isUp) {
            currentPos--;
            if (currentPos < 0) currentPos = validIndices.length - 1;
            this.selectedRewardIndex = validIndices[currentPos];
        } else if (isDown) {
            currentPos++;
            if (currentPos >= validIndices.length) currentPos = 0;
            this.selectedRewardIndex = validIndices[currentPos];
        } else if (isInteract) {
            const index = this.selectedRewardIndex;

            if (index === 0) {
                // Main Reward Pool (Toppings + Unlocked Sides/Drinks)
                this.generateRewardOptions(0);
                this.state = 'ITEM_SELECTION';
                this.rewardsPicked = 0;
                this.selectedOptionIndex = 1;
                return 'CONTINUE';
            } else if (index === 1) { // Unlock Sides
                // BUY FRYER
                const cost = 100;
                if (this.game.money >= cost) {
                    this.game.money -= cost;
                    this.waitingForBuild = true;
                    this.pendingCategory = 1; // Still generate side options for this first time

                    // Enter Build Mode with Fryer
                    const fryerDef = this.game.shopItems.find(i => i.id === 'fryer');
                    if (fryerDef) {
                        this.game.constructionSystem.startPlacement(fryerDef);
                    }
                } else {
                    this.game.addFloatingText("Need $100!", this.game.player.x, this.game.player.y, '#ff0000');
                }
                return 'CONTINUE';
            } else if (index === 2) { // Unlock Drinks
                // BUY FOUNTAIN
                const cost = 200;
                if (this.game.money >= cost) {
                    this.game.money -= cost;
                    this.waitingForBuild = true;
                    this.pendingCategory = 2; // Still generate drink options for this first time

                    // Enter Build Mode with Fountain
                    const itemDef = this.game.shopItems.find(i => i.id === 'soda_fountain');
                    if (itemDef) {
                        this.game.constructionSystem.startPlacement(itemDef);
                    }
                } else {
                    this.game.addFloatingText("Need $200!", this.game.player.x, this.game.player.y, '#ff0000');
                }
                return 'CONTINUE';
            }
        }
        return 'CONTINUE';
    }

    handleItemSelectionInput({ event, isInteract, isLeft, isRight }) {
        if (isLeft) {
            this.selectedOptionIndex--;
            if (this.selectedOptionIndex < 0) this.selectedOptionIndex = this.rewardOptions.length - 1;
        } else if (isRight) {
            this.selectedOptionIndex++;
            if (this.selectedOptionIndex >= this.rewardOptions.length) this.selectedOptionIndex = 0;
        } else if (event.code === 'Escape') {
            // Back to Category Selection
            this.state = 'REWARDS';
            return 'CONTINUE';
        } else if (isInteract) {
            const selectedItem = this.rewardOptions[this.selectedOptionIndex];
            if (selectedItem) {
                // Determine Cost
                const cost = this.getRewardCost(selectedItem);

                // Check if we can afford the slot cost
                if ((this.rewardsPicked + cost) <= 2) {
                    this.grantRewardItem(selectedItem);
                    this.rewardsPicked += cost;

                    // Remove from options to prevent double picking
                    this.rewardOptions.splice(this.selectedOptionIndex, 1);

                    // Clamping selection
                    if (this.selectedOptionIndex >= this.rewardOptions.length) {
                        this.selectedOptionIndex = Math.max(0, this.rewardOptions.length - 1);
                    }

                    // Check for Completion or Soft-lock
                    // 1. Fulfilled quota
                    let isDone = (this.rewardsPicked >= 2);

                    // 2. Soft-lock check: If we have slots left (e.g. 1), but NO available items cost <= slots left.
                    if (!isDone && this.rewardOptions.length > 0) {
                        const slotsLeft = 2 - this.rewardsPicked;
                        const canAffordAny = this.rewardOptions.some(opt => this.getRewardCost(opt) <= slotsLeft);
                        if (!canAffordAny) {
                            isDone = true;
                            // Maybe show a quick message? "No more valid picks"
                        }
                    } else if (!isDone && this.rewardOptions.length === 0) {
                        isDone = true;
                    }

                    if (isDone) {
                        // Transition to Menu Edit
                        this.state = 'MENU_EDIT';
                        this.arrowSelected = false;
                        this.game.menuSystem.expandedSlotIndex = null;
                        this.game.menuSystem.selectionMode = null;

                        // If we finished early due to lack of options, maybe inform user?
                        if (this.rewardsPicked < 2) {
                            this.game.addFloatingText("Selections Complete", this.game.player.x, this.game.player.y, '#fff');
                        }
                    }

                } else {
                    // Feedback: Not enough slots
                    this.game.addFloatingText("Takes 2 Slots!", this.game.player.x, this.game.player.y, '#e74c3c');
                }

                return 'CONTINUE';
            }
        }
        return 'CONTINUE';
    }

    handleMenuEditInput({ event, settings, isInteract, isLeft, isRight }) {
        // Wrapper Logic for Custom Menu
        if (this.arrowSelected) {
            if (isLeft) {
                this.arrowSelected = false;
            } else if (isInteract) {
                // Start Supply Order
                this.state = 'SUPPLY_ORDER';
                this.arrowSelected = false;
                // Reset shop selection?
                this.game.shopSystem.selectedComputerItemId = null;
            }
        } else {
            // Check if allow transition to arrow
            // If MenuSystem is at right edge and user presses Right
            const ms = this.game.menuSystem;
            const canGoRight = (ms.selectedButtonIndex === 3 || ms.selectedButtonIndex === 5); // 3 (Top right burger), 5 (Drinks)
            // Also ensure we aren't in a sub-menu or naming mode
            const inRootMenu = (ms.expandedSlotIndex === null && !ms.namingMode);

            if (inRootMenu && canGoRight && isRight) {
                this.arrowSelected = true;
            } else {
                // Pass to MenuSystem
                this.game.menuSystem.handleInput(event, settings);
            }
        }
        return 'CONTINUE';
    }

    handleSupplyOrderInput({ event, isInteract, isLeft, isRight }) {
        // Wrapper Logic for Shop System
        if (this.arrowSelected) {
            if (isLeft) {
                this.arrowSelected = false;
            } else if (isInteract) {
                this.arrowSelected = false;
                // Start Day!
                this.game.startDay();
                return 'DONE';
            }
        } else {
            // Check if assume Right Edge of Grid
            // Shop grid is 4 columns.
            const ss = this.game.shopSystem;
            const items = this.game.shopItems.filter(i => i.type === 'supply');
            const selId = ss.selectedComputerItemId || items[0].id;
            const idx = items.findIndex(i => i.id === selId);
            const col = idx % 4;

            if (col === 3 && isRight) {
                this.arrowSelected = true;
            } else {
                this.game.shopSystem.handleComputerInput(event);
            }
        }
        return 'CONTINUE';
    }

    generateRewardOptions(categoryIndex) {
        // categoryIndex: 0=Reward Pool (Toppings + Unlocked Types), 1=Side (Buy), 2=Drink (Buy)
        this.currentRewardCategory = categoryIndex;
        this.rewardOptions = [];

        const validCandidates = [];

        // Helpers for classification
        const isSideSource = (def) => {
            // Explicit ID checks
            if (def.id === 'fry_box' || def.id === 'sweet_potato_fry_box' || def.id === 'onion_box') return true;

            // Check produces
            if (def.produces) {
                const product = DEFINITIONS[def.produces];
                if (product) {
                    if (product.category === 'side' || (product.orderConfig && product.orderConfig.type === 'side')) return true;
                    // Variant Complex check
                    if (product.fryContent) {
                        // It produces something that goes in fryer (e.g. raw fries)
                        return true;
                    }

                    // Check if product slices into something fryable
                    if (product.slicing && product.slicing.result) {
                        const slicedDef = DEFINITIONS[product.slicing.result];
                        if (slicedDef && slicedDef.cooking && slicedDef.cooking.stages) {
                            const isFryable = Object.values(slicedDef.cooking.stages).some(stage => stage.cookMethod === 'fry');
                            if (isFryable) return true;
                        }
                    }
                }
            }

            return false;
        };

        const isDrinkSource = (def) => {
            if (def.id === 'syrup_box') return true;
            if (def.id.includes('syrup') || (def.produces && (def.produces.includes('syrup') || def.produces === 'soda_syrup'))) return true;
            return false;
        };

        const isToppingSource = (def) => {
            // General catch-all for things that aren't specific sides/drinks but are supplies
            if (isSideSource(def) || isDrinkSource(def)) return false;
            return true;
        };

        if (categoryIndex === 0) {
            // Category 0: New Items (Toppings, + Sides/Drinks if unlocked)
            const hasFryer = this.game.hasAppliance('FRYER') || (this.game.storage['fryer'] > 0);
            const hasFountain = this.game.hasAppliance('SODA_FOUNTAIN') || (this.game.storage['soda_fountain'] > 0);

            const potentialCandidates = this.game.shopItems.filter(item =>
                item.type === 'supply' && !item.unlocked
            );

            potentialCandidates.forEach(shopItem => {
                const def = DEFINITIONS[shopItem.id];
                if (!def) return;

                let included = false;
                if (isToppingSource(def)) {
                    if (def.id === 'chicken_patty_box' && !hasFryer) {
                        included = false;
                    } else {
                        included = true;
                    }
                } else if (hasFryer && isSideSource(def)) {
                    included = true;
                } else if (hasFountain && isDrinkSource(def)) {
                    included = true;
                }

                if (included) {
                    validCandidates.push(def);
                }
            });

            // Supplement with essentials if running low on new unlocks
            if (validCandidates.length < 3) {
                const essentialItems = this.game.shopItems.filter(item => {
                    // Check direct property on the shop item (box) or definition
                    const def = DEFINITIONS[item.id];

                    // Essential Check
                    if (item.isEssential || (def && def.isEssential)) return true;

                    // Cup Check
                    if (item.id === 'side_cup_box' || item.id === 'drink_cup_box') return true;

                    return false;
                });

                // Filter duplicates and shuffle filler
                const fillers = essentialItems
                    .map(i => DEFINITIONS[i.id])
                    .filter(d => d && !validCandidates.includes(d));

                // Shuffle fillers
                for (let i = fillers.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [fillers[i], fillers[j]] = [fillers[j], fillers[i]];
                }

                // Add enough to reach 3
                const need = 3 - validCandidates.length;
                for (let i = 0; i < need && i < fillers.length; i++) {
                    validCandidates.push(fillers[i]);
                }
            }
        } else if (categoryIndex === 1) {
            // Category 1: Sides (Can be locked OR unlocked - e.g. Side Cups might be unlocked)
            const sideCandidates = this.game.shopItems.filter(item => item.type === 'supply');

            sideCandidates.forEach(shopItem => {
                const def = DEFINITIONS[shopItem.id];
                if (!def) return;
                if (isSideSource(def)) {
                    validCandidates.push(def);
                }
            });
        } else if (categoryIndex === 2) {
            // Category 2: Drinks (Can be locked OR unlocked)
            const drinkCandidates = this.game.shopItems.filter(item => item.type === 'supply');

            drinkCandidates.forEach(shopItem => {
                const def = DEFINITIONS[shopItem.id];
                if (!def) return;
                if (isDrinkSource(def)) {
                    validCandidates.push(def);
                }
            });
        }

        if (validCandidates.length === 0) {
            console.warn("No candidates found for reward pool.");
            // If empty, maybe add a fallback "Bonus Money" item? Or just empty.
            return;
        }

        // Shuffle
        for (let i = validCandidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [validCandidates[i], validCandidates[j]] = [validCandidates[j], validCandidates[i]];
        }

        // Pick 3
        const count = Math.min(validCandidates.length, 3);
        for (let i = 0; i < count; i++) {
            this.rewardOptions.push(validCandidates[i]);
        }
    }

    getRewardCost(itemDef) {
        // Recalculate cost based on type
        // Sides/Drinks = 2 slots
        // Toppings = 1 slot

        // Use helper logic again or check definition properties
        const isSideSource = (def) => {
            if (def.type === 'Box' && def.produces) {
                const product = DEFINITIONS[def.produces];
                if (product && (product.category === 'side' || (product.orderConfig && product.orderConfig.type === 'side'))) return true;
                if (product && product.fryContent) return true;
                if (def.id === 'fry_box' || def.id === 'sweet_potato_fry_box') return true;
            }
            return false;
        };

        const isDrinkSource = (def) => {
            if (def.id === 'syrup_box') return true;
            if (def.id.includes('syrup') || (def.produces && def.produces.includes('syrup'))) return true;
            return false;
        };

        if (isSideSource(itemDef)) return 2;
        if (isDrinkSource(itemDef)) return 2;

        return 1;
    }

    grantRewardItem(itemDef) {
        console.log(`[PostDaySystem] Granting Reward Item: ${itemDef.id}`);
        // Call Game Logic
        this.game.grantDailyReward(itemDef);
    }

    render(ctx, data) {
        const canvas = ctx.canvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Ensure background
        // In MENU_EDIT and SUPPLY_ORDER, the subsystems handle their own basic BG, 
        // but we might need to clear formatting if we are layering.
        if (this.state !== 'MENU_EDIT' && this.state !== 'SUPPLY_ORDER') {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const elapsed = Date.now() - (data.startTime || Date.now());

        if (this.state === 'REWARDS' && this.waitingForBuild) {
            // Auto-transition if build mode is no longer active
            if (!this.game.constructionSystem.state.active) {
                this.waitingForBuild = false;
                const cat = this.pendingCategory;
                this.pendingCategory = -1;

                this.generateRewardOptions(cat);
                this.state = 'ITEM_SELECTION';
                this.rewardsPicked = 0;
                this.selectedOptionIndex = 1;

                // Continue to render the new state immediately
            }
        }

        if (this.state === 'REPORT') {
            this.renderReport(ctx, data, centerX, centerY, elapsed);
        } else if (this.state === 'REWARDS') {
            this.renderRewards(ctx, centerX, centerY);
        } else if (this.state === 'ITEM_SELECTION') {
            this.renderItemSelection(ctx, centerX, centerY);
        } else if (this.state === 'MENU_EDIT') {
            // Delegate rendering
            this.game.menuSystem.render(this.game.renderer);
            this.renderArrowButton(ctx, canvas.width - 100, canvas.height / 2);
        } else if (this.state === 'SUPPLY_ORDER') {
            // Delegate rendering
            this.game.renderer.renderComputerScreen(this.game);
            this.renderArrowButton(ctx, canvas.width - 80, canvas.height / 2);
        }
    }

    renderArrowButton(ctx, x, y) {
        const arrowImg = this.game.assetLoader.get(ASSETS.UI.GREEN_ARROW);
        const size = 64;

        if (arrowImg) {
            ctx.save();
            // Center y, align x left? or just draw at x,y
            // Prompt said "next to last add burger button on the right side".
            // MenuSystem renders bg centered. 
            // We should ideally calculate position relative to MenuSystem bg, but raw screen coords right side works for "Next".

            ctx.translate(x, y);

            if (this.arrowSelected) {
                ctx.scale(1.2, 1.2);
                ctx.shadowColor = '#00ff00';
                ctx.shadowBlur = 15;
            }

            ctx.drawImage(arrowImg, -size / 2, -size / 2, size, size);

            ctx.restore();

            // Interaction Hint
            if (this.arrowSelected) {
                ctx.fillStyle = '#0f0';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("Next", x, y + size / 2 + 20);
            }
        } else {
            // Fallback
            ctx.fillStyle = this.arrowSelected ? '#0f0' : '#006400';
            ctx.fillRect(x - 30, y - 30, 60, 60);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(x - 30, y - 30, 60, 60);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText("NEXT", x, y);
        }
    }

    renderReport(ctx, data, centerX, centerY, elapsed) {
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("Daily Financial Report", centerX, centerY - 200);

        // Line Configuration
        const lineHeight = 60;
        const startY = centerY - 100;

        // Render Helper
        const renderLine = (index, label, value, color) => {
            const appearTime = (index + 1) * 750; // Staggered animation
            if (elapsed < appearTime) return;

            const y = startY + index * lineHeight;

            ctx.textAlign = 'left';
            ctx.font = '32px Arial';

            // Label
            ctx.fillStyle = '#aaa';
            ctx.fillText(label, centerX - 200, y);

            // Value
            ctx.textAlign = 'right';
            ctx.fillStyle = color;
            ctx.fillText(value, centerX + 200, y);
        };

        // 1. Bags Sold
        renderLine(0, "Bags Sold:", data.bagsSold, '#fff');

        // 2. Money Earned
        renderLine(1, "Money Earned:", `$${data.moneyEarned}`, '#2ecc71'); // Green

        // 3. Rent
        renderLine(2, "Rent:", `-$${data.rent}`, '#e74c3c'); // Red

        // 4. Net Total
        const netColor = data.netTotal >= 0 ? '#2ecc71' : '#e74c3c';
        renderLine(3, "Net Profit:", `$${data.netTotal}`, netColor);

        // 5. Star Rating
        if (elapsed > 3200) {
            const starCount = data.starCount || 0;
            const starSize = 48;
            const starSpacing = 16;
            const totalW = 5 * starSize + 4 * starSpacing;
            let sx = centerX - totalW / 2;
            const sy = startY + 4 * lineHeight + 20; // Below Net Profit

            const filledStar = this.game.assetLoader.get(ASSETS.UI.STAR_FILLED);
            const emptyStar = this.game.assetLoader.get(ASSETS.UI.STAR_EMPTY);

            // Draw "Rating" Text (Optional, but looks nice)
            // ctx.fillStyle = '#fff';
            // ctx.font = '24px Arial';
            // ctx.textAlign = 'center';
            // ctx.fillText("Service Rating", centerX, sy - 10);

            for (let i = 0; i < 5; i++) {
                const img = (i < starCount) ? filledStar : emptyStar;
                if (img) {
                    // Add a little pop in animation? 
                    // simple draw for now
                    ctx.drawImage(img, sx, sy, starSize, starSize);
                }
                sx += starSize + starSpacing;
            }
        }


        // Interaction Prompt (Wait for all animations)
        if (elapsed > 3000) {
            ctx.fillStyle = '#ccc';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';

            // Blinking effect
            if (Math.floor(Date.now() / 500) % 2 === 0) {
                ctx.fillText("- Press INTERACT/ENTER to Continue -", centerX, ctx.canvas.height - 40);
            }
        }
    }

    renderRewards(ctx, centerX, centerY) {
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("Select New Reward", centerX, centerY - 250);

        // waitingForBuild prompt removed (auto-transition)


        const spacing = 180; // Vertical spacing between buttons
        const startY = centerY - 100;

        // Draw 3 Buttons
        // Draw Buttons
        const hasFryer = this.game.hasAppliance('FRYER') || (this.game.storage['fryer'] && this.game.storage['fryer'] > 0);
        const hasFountain = this.game.hasAppliance('SODA_FOUNTAIN') || (this.game.storage['soda_fountain'] && this.game.storage['soda_fountain'] > 0);

        // 1. New Items (Always Index 0)
        this.drawRewardButton(ctx, 0, centerX, startY, ASSETS.UI.NEW_TOPPING_IDLE, ASSETS.UI.NEW_TOPPING_SELECTED, "New Items", null, false);

        // 2. Unlock Sides (Index 1) - Only if !hasFryer
        if (!hasFryer) {
            this.drawRewardButton(ctx, 1, centerX, startY + spacing,
                ASSETS.UI.NEW_SIDE_IDLE, // Re-use generic side asset or potentially new "UNLOCK" asset
                ASSETS.UI.NEW_SIDE_SELECTED,
                "Unlock Sides", 100, false);
        }

        // 3. Unlock Drinks (Index 2) - Only if !hasFountain
        if (!hasFountain) {
            // Use correct Y position based on whether option 1 exists? 
            // The user prompt implies one-time buttons.
            // If option 1 is GONE, should option 2 move up? 
            // We kept index mapping (0, 1, 2) in logic. 
            // So we should draw at specific slot locations (visual slots) or relative?
            // Existing logic uses index to select. If we draw Index 2 at visual slot 2, it leaves a gap if 1 is missing.
            // Let's draw at "available slot" positions.

            let drinkY = startY + spacing * 2;
            if (hasFryer) {
                // If fryer is owned (Index 1 hidden), we could move Drink up.
                // But input logic maps to index 2.
                // Let's just keep them in their physical slots for consistency (Menu Pos 1, Menu Pos 2, Menu Pos 3).
                // Or user might prefer them to stack. 
                // Let's stack them for nicer aesthetics.
                drinkY = startY + spacing; // Move into slot 2's position
            }
            // WAIT - Logic uses explicit indices (0,1,2). If I change Input to skip valid indices, 
            // I should just render the valid indices in order.

            // Re-eval: simpler to keep fixed positions so user knows "Bottom is Drink".
            // But if middle is gone, a gap looks weird.
            // Let's just draw Index 2 at the position of "next available visual row".

            // Actually, keep it simple first. Fixed Y for fixed Index is easiest to understand.
            // EXCEPT the prompt says "buttons are now one-time-only".
            // If I hide button 1, button 2 should probably slide up.

            const btn1Visible = !hasFryer;
            const btn2Visible = !hasFountain;

            // Re-calc y positions
            const y0 = startY;
            const y1 = y0 + spacing;
            const y2 = btn1Visible ? (y0 + spacing * 2) : (y0 + spacing);

            if (btn1Visible) {
                this.drawRewardButton(ctx, 1, centerX, y1,
                    ASSETS.UI.NEW_SIDE_IDLE,
                    ASSETS.UI.NEW_SIDE_SELECTED,
                    "Unlock Sides", 100, false);
            }

            if (btn2Visible) {
                this.drawRewardButton(ctx, 2, centerX, y2,
                    ASSETS.UI.NEW_DRINK_IDLE,
                    ASSETS.UI.NEW_DRINK_SELECTED,
                    "Unlock Drinks", 200, false);
            }
        }
    }

    drawRewardButton(ctx, index, x, y, idleAsset, selectedAsset, label, price, isHidden) {
        if (isHidden) {
            // Draw placeholder or nothing
            // For now, draw a "Completed" placeholder if selected, otherwise maybe faint?
            // If it "never appears again", we might just skip drawing it?
            // But we need to maintain the index slot for navigation (0,1,2).
            // Unless we change navigation logic to skip.
            // Let's draw it as "Purchased" / Locked out.

            ctx.globalAlpha = 0.3;
            // Draw a generic placeholder
            ctx.fillStyle = '#222';
            ctx.fillRect(x - 100, y - 40, 200, 80);
            ctx.fillStyle = '#888';
            ctx.textAlign = 'center';
            ctx.font = '20px Arial';
            ctx.fillText("Purchased", x, y + 10);
            ctx.globalAlpha = 1.0;
            return;
        }

        const isSelected = (this.selectedRewardIndex === index);

        // Scale effect
        const scale = isSelected ? 1.1 : 1.0;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        const img = this.game.assetLoader.get(isSelected ? selectedAsset : idleAsset);
        if (img) {
            const w = img.width;
            const h = img.height;
            ctx.drawImage(img, -w / 2, -h / 2);
        } else {
            // Fallback Button
            ctx.fillStyle = isSelected ? '#ffd700' : '#444';
            ctx.fillRect(-100, -40, 200, 80);
            ctx.fillStyle = isSelected ? '#000' : '#fff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(label || `Reward ${index + 1}`, 0, 10);
        }

        // Price Tag (If not topping)
        if (price) {
            ctx.fillStyle = (this.game.money >= price) ? '#2ecc71' : '#e74c3c';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`$${price}`, 0, 60);

            if (isSelected && this.game.money < price) {
                ctx.fillStyle = '#e74c3c';
                ctx.font = '16px Arial';
                ctx.fillText("Insufficient Funds", 0, 80);
            }
        }

        ctx.restore();
    }

    getRewardIcon(def) {
        // Resolve the 'content' of the box
        let targetDef = def;
        if (def.produces) {
            const p = DEFINITIONS[def.produces];
            if (p) targetDef = p;
        }

        // If it's a syrup/drink related thing, look for sign
        if (targetDef.category === 'syrup' || targetDef.category === 'drink') {
            // If this item has a sign, use it
            if (targetDef.sign) return targetDef.sign;
            // If it has a result (syrup->soda), check the result
            if (targetDef.result) {
                const res = DEFINITIONS[targetDef.result];
                if (res && res.sign) return res.sign;
            }
        }

        // Return texture of the content (bag, vegetable, etc)
        if (targetDef.texture) return targetDef.texture;

        // Fallback to definitions original texture (or constructed)
        return def.texture || `${def.id}-closed.png`;
    }

    renderItemSelection(ctx, centerX, centerY) {
        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';

        const maxPicks = 2; // Fixed at 2 for "Pick 2" pool
        const remaining = maxPicks - this.rewardsPicked;
        const titleText = `Choose Rewards (${remaining} left)`;
        ctx.fillText(titleText, centerX, centerY - 200);

        const startX = centerX - 250; // Total width approx 500?
        const gap = 50;
        const size = 150; // Square buttons

        // Center the buttons
        // Count * size + (Count-1) * gap = Total W
        const count = this.rewardOptions.length;
        const totalW = count * size + (count - 1) * gap;
        let x = centerX - totalW / 2;
        const y = centerY - size / 2;

        this.rewardOptions.forEach((item, index) => {
            const isSelected = (this.selectedOptionIndex === index);

            // 1. Draw Background
            const bgName = isSelected ? (ASSETS.UI.BUTTON_BACKGROUND || ASSETS.UI.RENO_ITEM_BG) : (ASSETS.UI.BUTTON_BACKGROUND || ASSETS.UI.RENO_ITEM_BG); // Can add selection tint
            const bgImg = this.game.assetLoader.get(bgName);

            if (bgImg) {
                ctx.drawImage(bgImg, x, y, size, size);
            } else {
                ctx.fillStyle = '#444';
                ctx.fillRect(x, y, size, size);
            }

            // 2. Draw Item Icon
            const iconName = this.getRewardIcon(item);
            if (iconName) {
                const icon = this.game.assetLoader.get(iconName);
                if (icon) {
                    const iconSize = size * 0.7;
                    const offset = (size - iconSize) / 2;
                    ctx.drawImage(icon, x + offset, y + offset, iconSize, iconSize);
                }
            }

            // 3. Selection Highlight
            if (isSelected) {
                ctx.strokeStyle = '#ffd700'; // Gold
                ctx.lineWidth = 6;
                ctx.strokeRect(x - 3, y - 3, size + 6, size + 6);
            }

            // 4. Label (Optional)
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.fillText(item.id.replace(/_/g, ' '), x + size / 2, y + size + 30);

            // 5. Cost Indicator
            const cost = this.getRewardCost(item);
            if (cost > 1) {
                ctx.fillStyle = '#ffd700';
                ctx.font = 'bold 14px Arial';
                ctx.fillText(`(Takes ${cost} Slots)`, x + size / 2, y + size + 50);
            }

            x += size + gap;
        });

        // Instructions
        ctx.fillStyle = '#888';
        ctx.font = '16px Arial';
        ctx.fillText("Left/Right to Select  |  ENTER to Confirm", centerX, centerY + 200);
    }
}

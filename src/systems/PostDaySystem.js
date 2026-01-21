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
        if (isUp) {
            this.selectedRewardIndex--;
            if (this.selectedRewardIndex < 0) this.selectedRewardIndex = 2;
        } else if (isDown) {
            this.selectedRewardIndex++;
            if (this.selectedRewardIndex > 2) this.selectedRewardIndex = 0;
        } else if (isInteract) {
            const index = this.selectedRewardIndex;

            if (index === 0) {
                // Toppings (Always available)
                this.generateRewardOptions(0);
                this.state = 'ITEM_SELECTION';
                this.rewardsPicked = 0;
                this.selectedOptionIndex = 1;
                return 'CONTINUE';
            } else if (index === 1) { // Side (Fryer)
                if (this.game.hasAppliance('FRYER')) {
                    // Already have it
                    return 'CONTINUE';
                } else {
                    // BUY FRYER
                    const cost = 100;
                    if (this.game.money >= cost) {
                        this.game.money -= cost;
                        this.waitingForBuild = true;
                        this.pendingCategory = 1;

                        // Enter Build Mode with Fryer
                        const fryerDef = this.game.shopItems.find(i => i.id === 'fryer');
                        if (fryerDef) {
                            this.game.constructionSystem.startPlacement(fryerDef);
                        }
                    } else {
                        // Audio Feedback: Error?
                        this.game.addFloatingText("Need $100!", this.game.player.x, this.game.player.y, '#ff0000');
                    }
                    return 'CONTINUE';
                }
            } else if (index === 2) { // Drink (Fountain)
                if (this.game.hasAppliance('SODA_FOUNTAIN')) {
                    return 'CONTINUE';
                } else {
                    // BUY FOUNTAIN
                    const cost = 200;
                    if (this.game.money >= cost) {
                        this.game.money -= cost;
                        this.waitingForBuild = true;
                        this.pendingCategory = 2;

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
            // Grant Specific Reward
            const selectedItem = this.rewardOptions[this.selectedOptionIndex];
            if (selectedItem) {
                this.grantRewardItem(selectedItem);

                this.rewardsPicked++;
                // Remove from options to prevent double picking
                this.rewardOptions.splice(this.selectedOptionIndex, 1);

                // Clamping selection
                if (this.selectedOptionIndex >= this.rewardOptions.length) {
                    this.selectedOptionIndex = Math.max(0, this.rewardOptions.length - 1);
                }

                const maxPicks = (this.currentRewardCategory === 0) ? 2 : 1;

                if (this.rewardsPicked >= maxPicks || this.rewardOptions.length === 0) {
                    // Transition to Menu Edit
                    this.state = 'MENU_EDIT';
                    this.arrowSelected = false;
                    this.game.menuSystem.expandedSlotIndex = null;
                    this.game.menuSystem.selectionMode = null;
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
        // categoryIndex: 0=Topping, 1=Side, 2=Drink
        this.currentRewardCategory = categoryIndex;
        this.rewardOptions = [];

        if (categoryIndex === 0) {
            // Special Logic for Toppings (Submenu)
            // 1. One option MUST be a sauce.
            // 2. The other two MUST be from: lettuce, tomato, pickle, onion, cheddar, swiss, bacon.

            const sauceIds = ['ketchup_box', 'mayo_box', 'bbq_box', 'burger_sauce_box'];
            const toppingIds = [
                'lettuce_box', 'tomato_box', 'pickle_box', 'onion_box',
                'cheddar_box', 'swiss_box', 'bacon_box'
            ];

            // 1. Pick a Sauce
            const availableSauces = [];
            sauceIds.forEach(id => {
                const def = DEFINITIONS[id];
                if (def && def.type === 'Box') availableSauces.push(def);
            });

            // 2. Pick Toppings
            const availableToppings = [];
            toppingIds.forEach(id => {
                const def = DEFINITIONS[id];
                if (def && def.type === 'Box') availableToppings.push(def);
            });

            const selectedItems = [];

            // Add 1 Sauce
            if (availableSauces.length > 0) {
                const randomSauce = availableSauces[Math.floor(Math.random() * availableSauces.length)];
                selectedItems.push(randomSauce);
            }

            // Add 2 Toppings
            if (availableToppings.length > 0) {
                // Shuffle available toppings first
                for (let i = availableToppings.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [availableToppings[i], availableToppings[j]] = [availableToppings[j], availableToppings[i]];
                }

                // Take up to 2
                for (let i = 0; i < 2 && i < availableToppings.length; i++) {
                    selectedItems.push(availableToppings[i]);
                }
            }

            // Shuffle the final selection to randomize the sauce slot
            for (let i = selectedItems.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [selectedItems[i], selectedItems[j]] = [selectedItems[j], selectedItems[i]];
            }

            this.rewardOptions = selectedItems;
            return;
        }

        // Generic Logic for Sides and Drinks (Indices 1 and 2)
        const candidates = [];
        const allDefs = Object.values(DEFINITIONS);

        const isSideSource = (def) => {
            if (def.type === 'Box' && def.produces) {
                const product = DEFINITIONS[def.produces];
                // Check direct side 
                if (product && product.category === 'side') return true;

                // Check Variant Complex (Fries, Sweet Potato Fries)
                // If the box produces a 'bag' (Ingredient) which has 'fryContent', we need to check the content's result.
                if (product && product.fryContent) {
                    const contentDef = DEFINITIONS[product.fryContent]; // e.g. raw_fries
                    if (contentDef && contentDef.result) {
                        const finalDef = DEFINITIONS[contentDef.result]; // e.g. fries
                        if (finalDef && finalDef.category === 'side') return true;
                    }
                }

                if (def.id === 'fry_box') return true;
                if (def.id === 'sweet_potato_fry_box') return true;
                if (def.id === 'side_cup_box') return false;
            }
            return false;
        };

        const isDrinkSource = (def) => {
            if (def.id === 'syrup_box') return true;
            if (def.id === 'drink_cup_box') return false;
            if (def.id.includes('syrup') || (def.produces && def.produces.includes('syrup'))) return true;
            return false;
        };

        allDefs.forEach(def => {
            if (def.type !== 'Box') return;
            if (def.price === undefined) return;

            // Important: Filter out already unlocked items?
            // User did not explicitly ask to hide owned items, but "selection screen" implies new things?
            // "Unlock Toppings Daily" logic suggests these are for unlocking.
            // If we already have it, maybe don't show it?
            if (this.game.shopItems.some(si => si.id === def.id && si.unlocked)) {
                // Skip if already unlocked
                return;
            }

            if (categoryIndex === 1) { // Side
                if (isSideSource(def)) candidates.push(def);
            } else if (categoryIndex === 2) { // Drink
                if (isDrinkSource(def)) candidates.push(def);
            }
        });

        if (candidates.length === 0) {
            console.warn("No candidates found for reward category " + categoryIndex);
            return;
        }

        // Shuffle
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        // Pick distinct items (up to 3)
        // Do NOT repeat items if we have fewer than 3.
        const count = Math.min(candidates.length, 3);
        for (let i = 0; i < count; i++) {
            this.rewardOptions.push(candidates[i]);
        }
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
        this.drawRewardButton(ctx, 0, centerX, startY, ASSETS.UI.NEW_TOPPING_IDLE, ASSETS.UI.NEW_TOPPING_SELECTED, "Toppings", null, false);

        // Side
        const hasFryer = this.game.hasAppliance('FRYER') || (this.game.storage['fryer'] && this.game.storage['fryer'] > 0);
        this.drawRewardButton(ctx, 1, centerX, startY + spacing,
            hasFryer ? null : ASSETS.UI.NEW_SIDE_IDLE,
            hasFryer ? null : ASSETS.UI.NEW_SIDE_SELECTED,
            "Add Side", 100, hasFryer);

        // Drink
        const hasFountain = this.game.hasAppliance('SODA_FOUNTAIN') || (this.game.storage['soda_fountain'] && this.game.storage['soda_fountain'] > 0);
        this.drawRewardButton(ctx, 2, centerX, startY + spacing * 2,
            hasFountain ? null : ASSETS.UI.NEW_DRINK_IDLE,
            hasFountain ? null : ASSETS.UI.NEW_DRINK_SELECTED,
            "Add Drink", 200, hasFountain);
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

        const maxPicks = (this.currentRewardCategory === 0) ? 2 : 1;
        const remaining = maxPicks - this.rewardsPicked;
        const titleText = (remaining === 2) ? "Choose Two" : (remaining === 1 ? "Choose One" : "Complete");
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

            x += size + gap;
        });

        // Instructions
        ctx.fillStyle = '#888';
        ctx.font = '16px Arial';
        ctx.fillText("Left/Right to Select  |  ENTER to Confirm", centerX, centerY + 200);
    }
}

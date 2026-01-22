import { ASSETS } from '../constants.js';
import { DEFINITIONS } from '../data/definitions.js';

export class PostDaySystem {
    constructor(game) {
        this.game = game;
        this.reset();
    }

    reset() {
        this.state = 'POST_DAY_MENU'; // The only state now

        // Navigation State
        // Row 0: Daily Rewards (3 items)
        // Row 1: Unlocks (variable)
        // Row 2: Actions (Build, Menu, Shop, Start)
        this.selection = { row: 2, col: 0 };

        this.dailyRewards = []; // { def, cost, claimed }
        this.unlockOptions = []; // { id, label, cost, type, available }

        this.rewardsPicked = 0;
        this.maxRewards = 2;
    }

    start() {
        this.reset();
        this.generateDailyRewards();
        this.updateUnlockOptions();

        // Default selection logic
        if (this.dailyRewards.length > 0) {
            this.selection = { row: 0, col: 0 };
        } else if (this.unlockOptions.length > 0) {
            this.selection = { row: 1, col: 0 };
        } else {
            this.selection = { row: 2, col: 0 };
        }
    }

    updateUnlockOptions() {
        this.unlockOptions = [];
        const hasFryer = this.game.hasAppliance('FRYER');
        const hasFountain = this.game.hasAppliance('SODA_FOUNTAIN');

        if (!hasFryer) {
            this.unlockOptions.push({
                id: 'fryer',
                label: 'Unlock Fryer',
                cost: 100,
                type: 'appliance',
                available: true
            });
        }
        if (!hasFountain) {
            this.unlockOptions.push({
                id: 'soda_fountain',
                label: 'Unlock Drinks',
                cost: 200,
                type: 'appliance',
                available: true
            });
        }
    }

    generateDailyRewards() {
        // Generate 3 random candidates from the "Category 0" pool (Toppings, New Items)
        // Similar to old generateRewardOptions(0) logic

        const validCandidates = [];

        const hasFryer = this.game.hasAppliance('FRYER') || (this.game.storage['fryer'] > 0);
        const hasFountain = this.game.hasAppliance('SODA_FOUNTAIN') || (this.game.storage['soda_fountain'] > 0);

        // Helper to check for topping/reward nature
        const isSideSource = (def) => {
            if (def.produces) {
                const product = DEFINITIONS[def.produces];
                if (product) {
                    if (product.category === 'side' || (product.orderConfig && product.orderConfig.type === 'side')) return true;
                    if (product.fryContent) return true;
                    if (product.slicing && product.slicing.result) {
                        const slicedDef = DEFINITIONS[product.slicing.result];
                        if (slicedDef && slicedDef.cooking && slicedDef.cooking.stages) {
                            return Object.values(slicedDef.cooking.stages).some(stage => stage.cookMethod === 'fry');
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
            if (isSideSource(def) || isDrinkSource(def)) return false;
            return true;
        };

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

        // Fillers (Essentials) if needed
        if (validCandidates.length < 3) {
            const essentialItems = this.game.shopItems.filter(item => {
                const def = DEFINITIONS[item.id];
                if (item.isEssential || (def && def.isEssential)) return true;
                if (item.id === 'side_cup_box' || item.id === 'drink_cup_box') return true;
                return false;
            });

            const fillers = essentialItems
                .map(i => DEFINITIONS[i.id])
                .filter(d => d && !validCandidates.includes(d));

            // Shuffle fillers
            for (let i = fillers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [fillers[i], fillers[j]] = [fillers[j], fillers[i]];
            }

            const need = 3 - validCandidates.length;
            for (let i = 0; i < need && i < fillers.length; i++) {
                validCandidates.push(fillers[i]);
            }
        }

        // Shuffle Candidates
        for (let i = validCandidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [validCandidates[i], validCandidates[j]] = [validCandidates[j], validCandidates[i]];
        }

        // Select top 3
        this.dailyRewards = validCandidates.slice(0, 3).map(def => ({
            def: def,
            cost: this.game.getRewardCost ? this.game.getRewardCost(def) : (this.getRewardCost(def)),
            claimed: false
        }));
    }

    getRewardCost(itemDef) {
        // Duplicated from original or referenced if helper exists. 
        // Logic: Side/Drink=2, Topping=1
        const def = itemDef;
        // Reuse helpers defined in generateDailyRewards but they are scoped.
        // Let's simplified check:
        // Assume 1 for simplicity unless I copy the logic?
        // Let's copy the basic logic
        if (def.id.includes('syrup') || def.id.includes('fry') || def.id.includes('side') || def.id.includes('drink')) return 2;
        // Proper check:
        if (def.produces) {
            const p = DEFINITIONS[def.produces];
            if (p && (p.category === 'side' || p.category === 'drink' || (p.orderConfig && (p.orderConfig.type === 'side' || p.orderConfig.type === 'drink')))) return 2;
            if (p && p.fryContent) return 2;
        }
        return 1;
    }

    handleInput(event, settings) {
        const interactKey = settings ? settings.getBinding('INTERACT') : 'KeyE';

        const inputs = {
            isInteract: event.code === interactKey || event.code === 'Enter' || event.code === 'Space',
            isRight: event.code === 'ArrowRight' || (settings && event.code === settings.getBinding('MOVE_RIGHT')),
            isLeft: event.code === 'ArrowLeft' || (settings && event.code === settings.getBinding('MOVE_LEFT')),
            isUp: event.code === 'ArrowUp' || (settings && event.code === settings.getBinding('MOVE_UP')),
            isDown: event.code === 'ArrowDown' || (settings && event.code === settings.getBinding('MOVE_DOWN'))
        };

        return this.handleHubInput(inputs);
    }

    handleHubInput({ isUp, isDown, isLeft, isRight, isInteract }) {
        // Define rows that have items
        const hasRewards = this.dailyRewards.length > 0;
        const hasUnlocks = this.unlockOptions.length > 0;

        // Rows: 0=Reward, 1=Unlock, 2=Action
        // If empty, we skip over.

        const currentRow = this.selection.row;
        let nextRow = currentRow;
        let nextCol = this.selection.col;

        // Navigation Config
        const rowConfig = {
            0: { count: this.dailyRewards.length, exists: hasRewards },
            1: { count: this.unlockOptions.length, exists: hasUnlocks },
            2: { count: 4, exists: true } // Actions: Build, Menu, Shop, Start
        };

        // VERTICAL MOVEMENTS
        if (isUp) {
            // Find previous existing row
            let r = currentRow - 1;
            while (r >= 0 && !rowConfig[r].exists) {
                r--;
            }
            if (r >= 0) {
                nextRow = r;
                // Clamp col
                nextCol = Math.min(this.selection.col, rowConfig[nextRow].count - 1);
            }
        } else if (isDown) {
            // Find next existing row
            let r = currentRow + 1;
            while (r <= 2 && !rowConfig[r].exists) {
                r++;
            }
            if (r <= 2) {
                nextRow = r;
                // Clamp col
                nextCol = Math.min(this.selection.col, rowConfig[nextRow].count - 1);
            }
        }

        // HORIZONTAL MOVEMENTS
        if (isLeft) {
            nextCol--;
            if (nextCol < 0) {
                // Loop or stop? Stop is better for grid.
                // Or maybe wrap around? "Stop" is standard.
                // However, user said "Input Handling: ... Left/Right between items"
                // Let's wrap for better feel on short rows? No, standard is clamp.
                nextCol = rowConfig[currentRow].count - 1; // Wrap
            }
        } else if (isRight) {
            nextCol++;
            if (nextCol >= rowConfig[currentRow].count) {
                nextCol = 0; // Wrap
            }
        }

        this.selection.row = nextRow;
        this.selection.col = nextCol;

        // INTERACTION
        if (isInteract) {
            this.handleInteraction();
        }

        return 'CONTINUE';
    }

    handleInteraction() {
        const { row, col } = this.selection;

        if (row === 0) {
            // REWARDS
            const reward = this.dailyRewards[col];
            if (reward && !reward.claimed) {
                if (this.rewardsPicked + reward.cost <= this.maxRewards) {
                    this.game.grantDailyReward(reward.def);
                    reward.claimed = true;
                    this.rewardsPicked += reward.cost;
                    this.game.addFloatingText("Claimed!", this.game.player.x, this.game.player.y, '#ffd700');

                    // If slots full, maybe move cursor to Actions?
                    if (this.rewardsPicked >= this.maxRewards) {
                        // Auto-move to next phases? User said "return to Post Day Hub".
                        // So we stay here. Maybe highlight "Start Day"?
                    }
                } else {
                    this.game.addFloatingText("Not enough slots", this.game.player.x, this.game.player.y, '#ff0000');
                }
            }
        } else if (row === 1) {
            // UNLOCKS
            const unlock = this.unlockOptions[col];
            if (unlock && unlock.available) {
                if (this.game.money >= unlock.cost) {
                    this.game.money -= unlock.cost;
                    // Trigger Purchase/Build Logic
                    const itemDef = this.game.shopItems.find(i => i.id === unlock.id);
                    if (itemDef) {
                        this.game.constructionSystem.startPlacement(itemDef);
                    }
                    // Since startPlacement switches gamestate, we will disappear from view.
                    // On return, this will re-render. 
                    // Should we remove the unlock option immediately?
                    // Re-entering start() clears it? No, start() isn't called on return.
                    // updateUnlockOptions() should be called every render or on enter?
                    // We'll update it now.
                    this.updateUnlockOptions();
                } else {
                    this.game.addFloatingText("Need $" + unlock.cost, this.game.player.x, this.game.player.y, '#ff0000');
                }
            }
        } else if (row === 2) {
            // ACTIONS
            // 0: Build, 1: Menu, 2: Shop, 3: Start
            switch (col) {
                case 0: // Build Mode
                    this.game.enterBuildMode();
                    break;
                case 1: // Menu Custom
                    this.game.gameState = 'MENU_CUSTOM';
                    this.game.menuSystem.expandedSlotIndex = null;
                    break;
                case 2: // Shop (Computer)
                    this.game.gameState = 'COMPUTER_ORDERING';
                    break;
                case 3: // Start Day
                    this.game.startDay();
                    break;
            }
        }
    }

    render(ctx, data) {
        // Redesign render for Hub View
        const canvas = ctx.canvas;
        const W = canvas.width;
        const H = canvas.height;
        const centerX = W / 2;
        const centerY = H / 2;

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, W, H);

        // Header
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("Post-Day Menu", centerX, 60);

        // Stats
        ctx.font = '20px Arial';
        ctx.fillStyle = '#ccc';
        ctx.fillText(`Money: $${Math.floor(this.game.money)}  |  Slots Used: ${this.rewardsPicked}/${this.maxRewards}`, centerX, 100);

        // GRID RENDERING
        // We have 3 potentially visible rows.

        let currentY = 160;
        const ROW_HEIGHT = 180;

        // ROW 0: Rewards
        if (this.dailyRewards.length > 0) {
            this.renderRow(ctx, 0, this.dailyRewards, centerX, currentY);
            currentY += ROW_HEIGHT;
        }

        // ROW 1: Unlocks
        if (this.unlockOptions.length > 0) {
            this.renderRow(ctx, 1, this.unlockOptions, centerX, currentY);
            currentY += ROW_HEIGHT;
        }

        // ROW 2: Actions
        this.renderActionsRow(ctx, 2, centerX, currentY);
    }

    renderRow(ctx, rowIndex, items, centerX, y) {
        const ITEM_WIDTH = 180;
        const SPACING = 20;
        const count = items.length;
        const totalW = count * ITEM_WIDTH + (count - 1) * SPACING;
        let x = centerX - totalW / 2;

        items.forEach((item, colIndex) => {
            const isSelected = (this.selection.row === rowIndex && this.selection.col === colIndex);

            // Draw Card
            this.drawCard(ctx, x, y, ITEM_WIDTH, 140, item, isSelected, rowIndex === 0); // isReward = true for Row 0

            x += ITEM_WIDTH + SPACING;
        });
    }

    renderActionsRow(ctx, rowIndex, centerX, y) {
        const actions = [
            { label: 'Build Mode', icon: 'RENO_BUILD_MODE' },
            { label: 'Menu', icon: 'RENO_ICON_COUNTER' }, // Placeholder icon
            { label: 'Supply Order', icon: 'COMPUTER' }, // Placeholder
            { label: 'Start Day', icon: 'EXIT_DOOR' } // Placeholder
        ];

        const ITEM_WIDTH = 180;
        const SPACING = 20;
        const count = actions.length;
        const totalW = count * ITEM_WIDTH + (count - 1) * SPACING;
        let x = centerX - totalW / 2;

        actions.forEach((action, colIndex) => {
            const isSelected = (this.selection.row === rowIndex && this.selection.col === colIndex);

            // Draw Action Button
            this.drawActionButton(ctx, x, y, ITEM_WIDTH, 100, action, isSelected);

            x += ITEM_WIDTH + SPACING;
        });
    }

    drawCard(ctx, x, y, w, h, item, isSelected, isReward) {
        ctx.save();

        if (isSelected) {
            ctx.translate(x + w / 2, y + h / 2);
            ctx.scale(1.1, 1.1);
            ctx.translate(-(x + w / 2), -(y + h / 2));
        }

        // BG
        ctx.fillStyle = isSelected ? '#333' : '#222';
        if (isReward && item.claimed) ctx.fillStyle = '#111'; // Dimmed
        ctx.fillRect(x, y, w, h);

        // Border
        ctx.strokeStyle = isSelected ? '#ffd700' : '#444';
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.strokeRect(x, y, w, h);

        // Content
        if (isReward) {
            // Reward Card
            const def = item.def;
            if (!item.claimed) {
                // Icon
                const iconName = this.getRewardIcon(def);
                const img = this.game.assetLoader.get(iconName);
                if (img) {
                    ctx.drawImage(img, x + w / 2 - 32, y + 20, 64, 64);
                }

                // Text
                ctx.fillStyle = '#fff';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(def.id.replace(/_/g, ' '), x + w / 2, y + 100);

                // Cost
                if (item.cost > 1) {
                    ctx.fillStyle = '#f39c12';
                    ctx.font = '12px Arial';
                    ctx.fillText(`${item.cost} Slots`, x + w / 2, y + 120);
                }
            } else {
                ctx.fillStyle = '#555';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("CLAIMED", x + w / 2, y + h / 2);
            }
        } else {
            // Unlock Card
            const unlock = item;
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(unlock.label, x + w / 2, y + 40);

            ctx.fillStyle = (this.game.money >= unlock.cost) ? '#2ecc71' : '#e74c3c';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(`$${unlock.cost}`, x + w / 2, y + 80);
        }

        ctx.restore();
    }

    drawActionButton(ctx, x, y, w, h, action, isSelected) {
        ctx.save();

        if (isSelected) {
            ctx.translate(x + w / 2, y + h / 2);
            ctx.scale(1.1, 1.1);
            ctx.translate(-(x + w / 2), -(y + h / 2));
        }

        // Different style for Start Day
        const isStart = action.label === 'Start Day';

        ctx.fillStyle = isSelected ? '#444' : '#333';
        if (isStart) ctx.fillStyle = isSelected ? '#27ae60' : '#2ecc71';

        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = isSelected ? '#fff' : '#555';
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(action.label, x + w / 2, y + h / 2 + 6);

        ctx.restore();
    }

    getRewardIcon(def) {
        // Reuse original logic
        let targetDef = def;
        if (def.produces) {
            const p = DEFINITIONS[def.produces];
            if (p) targetDef = p;
        }
        if (targetDef.category === 'syrup' || targetDef.category === 'drink') {
            if (targetDef.sign) return targetDef.sign;
            if (targetDef.result) {
                const res = DEFINITIONS[targetDef.result];
                if (res && res.sign) return res.sign;
            }
        }
        if (targetDef.texture) return targetDef.texture;
        return def.texture || `${def.id}-closed.png`;
    }
}

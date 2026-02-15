import { ASSETS } from '../constants.js';
import { DEFINITIONS } from '../data/definitions.js';

import { UISystem } from './UISystem.js';

export class PostDaySystem {
    constructor(game) {
        this.game = game;
        this.reset();
    }

    reset() {
        this.state = 'POST_DAY_MENU';
        this.domInitialized = false;


        // Navigation State
        // Row 0: Daily Rewards (3 items)
        // Row 0: Daily Rewards (3 items)
        // Row 1: Edit Kitchen / Edit Menu / Next Day (3 items)
        this.selection = { row: 1, col: 1 };

        this.dailyRewards = []; // { def, claimed }
        this.dailyRewards = []; // { def, claimed }
        // this.supplyItems = []; // Deprecated

        this.rewardClaimed = false;
    }

    start() {
        this.reset();
        this.generateDailyRewards();
        // this.generateSupplyItems(); // Deprecated

        // Default selection logic
        if (this.dailyRewards.length > 0) {
            this.selection = { row: 0, col: 0 };
        } else {
            this.selection = { row: 1, col: 1 };
        }
    }

    // generateSupplyItems() {
    //    // Deprecated
    // }

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
            if (def.id === 'cola_box') return true;
            if (def.id.includes('syrup') || (def.produces && (def.produces.includes('syrup') || def.produces === 'cola_syrup'))) return true;
            return false;
        };

        const isToppingSource = (def) => {
            if (isSideSource(def) || isDrinkSource(def)) return false;
            return true;
        };

        const potentialCandidates = this.game.shopItems.filter(item => {
            if (item.type !== 'supply') return false;
            if (item.unlocked) return false;

            // Exclude Essentials from Reward Pool
            if (item.isEssential) return false;
            if (item.id === 'insert') return false;

            // Double check definition
            const def = DEFINITIONS[item.id];
            if (def && def.isEssential) return false;

            return true;
        });

        potentialCandidates.forEach(shopItem => {
            const def = DEFINITIONS[shopItem.id];
            if (!def) return;
            if (def.classification === 'helper') return;

            let included = false;
            if (isToppingSource(def)) {
                included = true;
            } else if (isSideSource(def)) {
                included = true;
            } else if (isDrinkSource(def)) {
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
                if (def && def.classification === 'helper') return false;
                if (item.isEssential || (def && def.isEssential)) return true;
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
            claimed: false
        }));
    }

    // calculateAutoRestock() {
    //    // Deprecated
    // }

    // getDetailedInventoryCount / getServingYield Removed

    handleInput(event, settings) {

        const inputs = {
            isInteract: (settings && event.code === settings.getBinding('INTERACT')) || event.code === 'Enter' || event.code === 'Space',
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

        let nextRow = this.selection.row;
        let nextCol = this.selection.col;

        // Determine grid structure
        const rewardsCount = this.dailyRewards.length + (hasRewards && !this.rewardClaimed ? 1 : 0); // +1 for Reroll
        // const supplyCount = this.supplyItems.length;
        const actionCount = 2;

        const rowCounts = {
            0: rewardsCount,
            1: actionCount
        };

        if (isRight) {
            nextCol++;
            if (nextCol >= rowCounts[nextRow]) nextCol = 0;
        } else if (isLeft) {
            nextCol--;
            if (nextCol < 0) nextCol = Math.max(0, rowCounts[nextRow] - 1);
        } else if (isDown) {
            let targetRow = nextRow + 1;
            // Skip empty rows
            while (targetRow <= 1 && rowCounts[targetRow] === 0) {
                targetRow++;
            }

            if (targetRow <= 1) {
                nextRow = targetRow;
                if (nextCol >= rowCounts[nextRow]) nextCol = Math.max(0, rowCounts[nextRow] - 1);
            }
        } else if (isUp) {
            let targetRow = nextRow - 1;
            // Skip empty rows
            while (targetRow >= 0 && rowCounts[targetRow] === 0) {
                targetRow--;
            }

            if (targetRow >= 0) {
                nextRow = targetRow;
                if (nextCol >= rowCounts[nextRow]) nextCol = Math.max(0, rowCounts[nextRow] - 1);
            }
        }

        // Final Safety Check
        if (rowCounts[nextRow] === 0) {
            // Fallback to Actions row if current is empty
            nextRow = 1;
            nextCol = 0; // Reset col
        }
        if (nextCol >= rowCounts[nextRow]) nextCol = Math.max(0, rowCounts[nextRow] - 1);

        // Check if selection changed
        if (this.selection.row !== nextRow || this.selection.col !== nextCol) {
            // Sound effect could go here
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
            // Check if it's the Reroll button (last index)
            if (col === this.dailyRewards.length) {
                this.generateDailyRewards();
                this.game.addFloatingText("Rerolled!", this.game.player.x, this.game.player.y, '#ffffff');
                this.game.audioSystem.playSFX('select'); // Or any sound
                return;
            }

            const reward = this.dailyRewards[col];
            if (reward && !reward.claimed) {
                this.game.grantDailyReward(reward.def);
                reward.claimed = true;
                this.rewardClaimed = true;
                this.game.addFloatingText("Claimed!", this.game.player.x, this.game.player.y, '#ffd700');
                // this.generateSupplyItems(); // Deprecated
            }
        } else if (row === 1) {
            // EDIT KITCHEN / EDIT MENU / NEXT DAY
            if (col === 0) { // Edit Kitchen (Build)
                this.game.enterBuildMode();
                this.cleanupDOM();
            } else if (col === 1) { // Next Day (Shifted from col 2)
                const isLocked = this.dailyRewards.length > 0 && !this.rewardClaimed;
                if (!isLocked) {
                    this.calculateAutoRestock();
                    this.game.startDay();
                    this.cleanupDOM();
                } else {
                    this.game.audioSystem.playSFX('error');
                }
            }
        }
    }

    render(ctx) {
        // Clear canvas behind the UI to prevent artifacts (optional, since CSS bg is opaque-ish)
        // ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Render via DOM
        this.renderDOM();
    }

    renderDOM() {
        const uiLayer = document.getElementById('ui-layer');
        if (!uiLayer) return;

        // 1. Initialize Container if missing
        let container = document.getElementById('post-day-menu');
        if (!container) {
            container = document.createElement('div');
            container.id = 'post-day-menu';
            container.className = 'post-day-menu';

            // Custom typography style
            container.style.fontFamily = "'Inter', sans-serif";
            container.style.fontWeight = "900";
            container.style.color = "white";
            container.style.webkitTextStroke = "8px black"; // Using 8px (approx 8pt) for the requested strong stroke
            container.style.paintOrder = "stroke fill";
            container.style.backgroundImage = "url('assets/ui/postday-bg.png')";
            container.style.backgroundSize = "cover";
            container.style.backgroundPosition = "center";

            container.innerHTML = `
                <div class="post-day-header">
                    <h1>Post-Day Menu</h1>
                    <div class="post-day-stats" id="pd-stats"></div>
                </div>
                <div class="post-day-content">
                    <div class="menu-row" id="pd-row-0"></div> <!-- Rewards -->
                    <!-- Row 1 Removed (Supply) -->
                    <div class="menu-row" id="pd-row-1"></div> <!-- Edit Kitchen / Menu -->
                </div>
            `;
            uiLayer.appendChild(container);
            this.domInitialized = true;
        }

        // 2. Update Stats
        const statsEl = document.getElementById('pd-stats');
        if (statsEl) {
            statsEl.innerText = '';
        }

        // 3. Update Rows

        // Row 0: Rewards (Add Reroll Button)
        const rewardsWithReroll = [...this.dailyRewards];
        // Only show Reroll if nothing has been claimed yet
        if (rewardsWithReroll.length > 0 && !this.rewardClaimed) {
            rewardsWithReroll.push({ isReroll: true, claimed: false });
        }
        this.updateRowDOM('pd-row-0', rewardsWithReroll, 0);

        // Row 1: Edit Kitchen / Edit Menu / Next Day
        this.updateActionRowDOM('pd-row-1', 1, [
            { label: 'Edit Kitchen', id: 'build_mode', image: true },
            { label: 'Next Day', id: 'start_day', image: true }
        ]);
    }

    // Helper to update generic item rows (Rewards)
    updateRowDOM(elementId, items, rowIndex) {
        const rowEl = document.getElementById(elementId);
        if (!rowEl) return;

        // 1. Sync DOM elements count to items length
        if (rowEl.children.length !== items.length) {
            rowEl.innerHTML = '';
            items.forEach((item, index) => {
                const el = document.createElement('div');
                el.className = 'menu-item';

                // Random Pop Config
                el.style.setProperty('--rand-x', (Math.random() * 8 - 4) + 'px');
                el.style.setProperty('--rand-y', (Math.random() * 8 - 4) + 'px');
                el.style.setProperty('--rand-rot', (Math.random() * 10 - 5) + 'deg');
                el.style.setProperty('--rand-text-rot', (Math.random() * 6 - 3) + 'deg');
                // Metadata
                el.dataset.index = index;
                el.dataset.row = rowIndex;

                rowEl.appendChild(el);
            });
        }

        // 2. Update Content & State
        Array.from(rowEl.children).forEach((el, index) => {
            const item = items[index];
            const isSelected = (this.selection.row === rowIndex && this.selection.col === index);

            // -- Content Update Check --
            let itemId = item.isReroll ? 'reroll' : (item.def ? item.def.id : 'unknown');
            let claimed = item.claimed || false;

            const prevId = el.dataset.itemId;
            const prevClaimed = el.dataset.claimed;
            const needsContentBuild = (el.innerHTML === '') || (prevId !== itemId) || (rowIndex === 0 && String(prevClaimed) !== String(claimed));

            if (needsContentBuild) {
                if (rowIndex === 0) { // Rewards
                    el.classList.add('reward-card');
                    el.classList.remove('supply-card');
                    this.buildRewardContent(el, item);
                } else if (rowIndex === 1) { // Supply
                    // Deprecated
                }
                el.dataset.itemId = itemId;
                el.dataset.claimed = claimed;
            } else if (rowIndex === 1) {
                // Deprecated (Supply Meter Update)
            }

            // -- Selection State --
            if (isSelected) el.classList.add('selected');
            else el.classList.remove('selected');

            // -- Claimed/Dim State (Rewards) --
            if (rowIndex === 0) {
                if (items[index].claimed) el.classList.add('claimed');
                else el.classList.remove('claimed');

                // Dim others if one is claimed
                // (Disabled: Allow multiple picks)
                el.style.opacity = '1';
                el.style.filter = 'none';
            }
        });
    }

    buildRewardContent(el, item) {
        if (item.isReroll) {
            // Reroll Button
            el.style.background = 'none';
            el.style.border = 'none';

            el.innerHTML = `
                <div style="position: relative; display: inline-block;">
                    <div class="boil-bg"></div>
                    <img class="item-icon" src="assets/ui/reroll.png" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(1.0); z-index: 1; image-rendering: pixelated;">
                </div>
                <div class="label item-text" style="position: absolute; top: -55px; width: 200%; left: -50%; text-align: center; font-size: 1rem; color: white;">Reroll</div>
            `;
            return;
        }

        const def = item.def;
        const iconName = this.getRewardIcon(def);

        // Use button_background.png as base
        // Render icon on top
        // Overlay info

        el.style.background = 'none';
        el.style.border = 'none';

        el.innerHTML = `
            <div style="position: relative; display: inline-block;">
                <div class="boil-bg"></div>
                <img class="item-icon" src="assets/${iconName}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1; image-rendering: pixelated;">
                
                <div style="position: absolute; bottom: 2px; width: 100%; text-align: center; z-index: 2; text-shadow: 1px 1px 0 #000; font-size: 0.6rem; pointer-events: none;">
                </div>
                
                ${item.claimed ? `
                <img src="assets/ui/green_check.png" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 3; image-rendering: pixelated;">
                ` : ''}
            </div>
            <div class="label item-text" style="position: absolute; top: -55px; width: 200%; left: -50%; text-align: center; font-size: 1rem; color: white;">${def.id.replace(/_/g, ' ')}</div>
                <div class="label item-text" style="position: absolute; top: -55px; width: 200%; left: -50%; text-align: center; font-size: 1rem; color: white;">${def.id.replace(/_/g, ' ')}</div>
        `;
    }

    updateActionRowDOM(elementId, rowIndex, actions) {
        const rowEl = document.getElementById(elementId);
        if (!rowEl) return;

        if (rowEl.children.length !== actions.length) {
            rowEl.innerHTML = '';
            actions.forEach((action, index) => {

                const config = {
                    id: action.id,
                    classes: ['action-btn'],
                    label: action.label
                };

                if (action.image) {
                    config.variant = 'image';
                    config.classes.push('image-btn');
                    // Note: The specific image source is handled by the "update selection" logic below which swaps src.
                    // But we need an initial img element.
                    config.content = '<img style="display:block;">';
                } else if (action.specialClass) {
                    config.classes.push(action.specialClass);
                }

                const el = UISystem.createButton(config);
                // Ensure dataset actionId is set (UISystem sets dataset.id if config.id is present)
                el.dataset.actionId = action.id;

                rowEl.appendChild(el);
            });
        }

        // Update Selection
        Array.from(rowEl.children).forEach((el, index) => {
            const isSelected = (this.selection.row === rowIndex && this.selection.col === index);
            const actionId = el.dataset.actionId;

            let visuallySelected = isSelected;
            let isLocked = false;

            if (actionId === 'start_day') {
                isLocked = this.dailyRewards.length > 0 && !this.rewardClaimed;
            }

            if (visuallySelected) el.classList.add('selected');
            else el.classList.remove('selected');

            // Handle Image Swapping for buttons that need it
            if (actionId === 'build_mode') {
                const img = el.querySelector('img');
                if (img) img.src = isSelected ? 'assets/ui/build_button-selected.png' : 'assets/ui/build_button-idle.png';
            } else if (actionId === 'menu_custom') {
                const img = el.querySelector('img');
                if (img) img.src = isSelected ? 'assets/ui/menu_button-selected.png' : 'assets/ui/menu_button-idle.png';
            } else if (actionId === 'start_day') {
                const img = el.querySelector('img');
                if (img) {
                    if (isLocked) {
                        img.src = 'assets/ui/continue_button-locked.png';
                        el.style.cursor = 'not-allowed';
                    } else {
                        img.src = visuallySelected ? 'assets/ui/continue_button-selected.png' : 'assets/ui/continue_button-idle.png';
                        el.style.cursor = 'pointer';
                    }
                }
            }
        });
    }

    cleanupDOM() {
        const container = document.getElementById('post-day-menu');
        if (container) container.remove();
        this.domInitialized = false;
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
        if (targetDef.textures && targetDef.textures.base) return targetDef.textures.base;
        return def.texture || `${def.id}-closed.png`;
    }
}

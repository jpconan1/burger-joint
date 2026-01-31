import { ASSETS } from '../constants.js';
import { DEFINITIONS } from '../data/definitions.js';

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
        // Row 1: Supply Menu (1 item) -> Now dynamic list
        // Row 2: Edit Kitchen / Edit Menu / Next Day (3 items)
        this.selection = { row: 2, col: 2 };

        this.dailyRewards = []; // { def, claimed }
        this.supplyItems = []; // { def, shopItem, cost }

        this.rewardClaimed = false;
    }

    start() {
        this.reset();
        this.generateDailyRewards();
        this.generateSupplyItems();

        // Default selection logic
        if (this.dailyRewards.length > 0) {
            this.selection = { row: 0, col: 0 };
        } else if (this.supplyItems.length > 0) {
            this.selection = { row: 1, col: 0 };
        } else {
            this.selection = { row: 2, col: 2 };
        }
    }

    generateSupplyItems() {
        this.supplyItems = this.game.shopItems.filter(item => {
            if (item.type !== 'supply') return false;
            // Include if essential or unlocked
            // Note: ShopSystem filters/updates 'unlocked' state based on game progress
            return item.isEssential || item.unlocked;
        }).map(item => ({
            def: DEFINITIONS[item.id],
            shopItem: item,
            cost: item.price
        }));
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

    calculateAutoRestock() {
        console.log("Calculating Auto-Restock...");
        const menu = this.game.menuSystem.getMenu();
        if (!menu) return;

        // 1. Determine Target Quantities
        const day = this.game.dayNumber || 0;
        const customerCount = 10 + (Math.max(0, day) * 3);
        const safetyFactor = 1.5;
        const targetServings = Math.ceil(customerCount * safetyFactor);

        const ensureSupply = (itemId, unitsPerBox, targetUnits) => {
            const currentUnits = this.getBoxedSupplyCount(itemId);

            if (currentUnits < targetUnits) {
                const deficit = targetUnits - currentUnits;
                const boxesNeeded = Math.ceil(deficit / unitsPerBox);

                if (boxesNeeded > 0) {
                    if (!this.game.pendingOrders) this.game.pendingOrders = [];
                    console.log(`Auto-Restock: Low on ${itemId} (${currentUnits}/${targetUnits}). Ordering ${boxesNeeded} boxes.`);
                    this.game.pendingOrders.push({ id: itemId, qty: boxesNeeded });
                }
            }
        };

        // 2. Check Essentials (Always needed)
        ensureSupply('bun_box', 32, targetServings);
        ensureSupply('patty_box', 12, targetServings);
        ensureSupply('wrapper_box', 100, targetServings);
        ensureSupply('bag_box', 50, targetServings);

        // 3. Check Menu Dependencies
        const scanItem = (itemId) => {
            let currentId = itemId;
            let supplyBoxId = null;

            let ptr = currentId;
            let steps = 0;
            while (steps < 5) {
                const def = DEFINITIONS[ptr];
                if (def && def.type === 'Box') {
                    supplyBoxId = ptr;
                    break;
                }
                const parent = this.game.itemDependencyMap[ptr];
                if (parent) {
                    ptr = parent;
                } else {
                    break;
                }
                steps++;
            }

            if (supplyBoxId) {
                const boxDef = DEFINITIONS[supplyBoxId];
                if (!boxDef) return;
                const boxCount = boxDef.maxCount || 1;
                let specificTarget = targetServings;

                const itemDef = DEFINITIONS[itemId];

                if (itemId.includes('fry') || itemId.includes('fries')) {
                    specificTarget = Math.ceil(targetServings / 6);
                } else if (itemId.includes('soda') || itemId.includes('drink') || (itemDef && (itemDef.category === 'drink' || itemDef.category === 'hetap' || (itemDef.orderConfig && itemDef.orderConfig.type === 'drink')))) {
                    specificTarget = 1;
                } else if (itemId.includes('tomato')) {
                    specificTarget = Math.ceil(targetServings / 5);
                } else if (itemId.includes('lettuce')) {
                    specificTarget = Math.ceil(targetServings / 8);
                } else if (itemId.includes('onion')) {
                    specificTarget = Math.ceil(targetServings / 5);
                } else if (itemId.includes('pickle')) {
                    specificTarget = Math.ceil(targetServings / 5);
                } else if (itemId.includes('cheese')) {
                    specificTarget = Math.ceil(targetServings / 10);
                } else if (itemId.includes('sauce') || itemId.includes('ketchup') || itemId.includes('mayo') || itemId.includes('bbq')) {
                    specificTarget = 1;
                } else if (itemId.includes('syrup')) {
                    specificTarget = 1;
                }

                ensureSupply(supplyBoxId, boxCount, specificTarget);
            }
        };

        if (menu.burgers) {
            menu.burgers.forEach(b => {
                if (b.bun) scanItem(b.bun);
                if (b.toppings) {
                    Object.keys(b.toppings).forEach(tId => scanItem(tId));
                }
            });
        }
        if (menu.sides) menu.sides.forEach(sId => scanItem(sId));
        if (menu.drinks) menu.drinks.forEach(dId => scanItem(dId));
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

        // Rows: 0=Reward, 1=Supply, 2=Actions

        const currentRow = this.selection.row;
        let nextRow = currentRow;
        let nextCol = this.selection.col;

        // Navigation Config
        const rowConfig = {
            0: { count: this.dailyRewards.length + (hasRewards ? 1 : 0), exists: hasRewards && !this.rewardClaimed }, // +1 for Reroll
            1: { count: this.supplyItems.length, exists: this.supplyItems.length > 0 }, // Supply Items
            2: { count: 3, exists: true } // Edit Kitchen, Edit Menu, Next Day
        };

        // Helper for visual navigation in wrapped grids (Intra-row)
        const findBestVisualNeighbor = (rowId, currentIdx, isUpDir) => {
            const container = document.getElementById(rowId);
            if (!container) return -1;
            const items = Array.from(container.children);
            const currentEl = items[currentIdx];
            if (!currentEl) return -1;

            const curRect = currentEl.getBoundingClientRect();
            const curCentX = curRect.left + curRect.width / 2;
            const curCentY = curRect.top + curRect.height / 2;

            let bestIdx = -1;
            let bestXDist = Infinity;

            // We filter for items that are in the "visual row" immediately above/below
            let closestVDiff = Infinity;
            const candidates = [];

            items.forEach((el, idx) => {
                if (idx === currentIdx) return;
                const rect = el.getBoundingClientRect();
                const centY = rect.top + rect.height / 2;

                const vDiff = isUpDir ? (curCentY - centY) : (centY - curCentY);

                if (vDiff <= 10) return; // Ignore items not clearly in direction

                if (vDiff < closestVDiff - 10) {
                    closestVDiff = vDiff;
                    candidates.length = 0;
                    candidates.push({ idx, rect });
                } else if (Math.abs(vDiff - closestVDiff) <= 10) {
                    candidates.push({ idx, rect });
                }
            });

            candidates.forEach(cand => {
                const centX = cand.rect.left + cand.rect.width / 2;
                const distX = Math.abs(centX - curCentX);
                if (distX < bestXDist) {
                    bestXDist = distX;
                    bestIdx = cand.idx;
                }
            });

            return bestIdx;
        };

        // NEW: Helper for Cross-Row visual navigation
        const findBestColInRow = (targetRowIdx, sourceEl, isMovingUp) => {
            const container = document.getElementById(`pd-row-${targetRowIdx}`);
            if (!container || container.children.length === 0) return 0;
            if (!sourceEl) return 0;

            const candidates = Array.from(container.children).map((el, idx) => ({ el, idx, rect: el.getBoundingClientRect() }));

            // Filter by vertical 'edge' (Top edge if moving down/entering from top; Bottom edge if moving up/entering from bottom)
            const yValues = candidates.map(c => c.rect.top);
            // If Moving UP, we approach from below, so we want the Bottom-most items (Max Y)
            // If Moving DOWN, we approach from above, so we want the Top-most items (Min Y)
            const targetY = isMovingUp ? Math.max(...yValues) : Math.min(...yValues);

            const validCandidates = candidates.filter(c => Math.abs(c.rect.top - targetY) < 20);

            if (validCandidates.length === 0) return 0;

            const sourceRect = sourceEl.getBoundingClientRect();
            const sourceX = sourceRect.left + sourceRect.width / 2;

            let bestIdx = 0;
            let minDist = Infinity;

            validCandidates.forEach(c => {
                const cx = c.rect.left + c.rect.width / 2;
                const dist = Math.abs(cx - sourceX);
                if (dist < minDist) {
                    minDist = dist;
                    bestIdx = c.idx;
                }
            });

            return bestIdx;
        };

        const getCurrentRowEl = () => {
            const r = document.getElementById('pd-row-' + currentRow);
            return r ? r.children[this.selection.col] : null;
        };

        // VERTICAL MOVEMENTS
        if (isUp) {
            let handled = false;
            // 1. Try Intra-Row Visual Navigation (mainly for Supply grid)
            if (rowConfig[currentRow].count > 0) {
                const visualIdx = findBestVisualNeighbor(`pd-row-${currentRow}`, this.selection.col, true);
                if (visualIdx !== -1) {
                    nextCol = visualIdx;
                    handled = true;
                }
            }

            // 2. Cross-Row Navigation
            if (!handled) {
                let r = currentRow - 1;
                while (r >= 0 && !rowConfig[r].exists) r--;

                if (r >= 0) {
                    nextRow = r;
                    const curEl = getCurrentRowEl();
                    if (curEl) {
                        nextCol = findBestColInRow(nextRow, curEl, true);
                    } else {
                        nextCol = Math.min(this.selection.col, rowConfig[nextRow].count - 1);
                    }
                }
            }
        } else if (isDown) {
            let handled = false;
            // 1. Try Intra-Row Visual Navigation
            if (rowConfig[currentRow].count > 0) {
                const visualIdx = findBestVisualNeighbor(`pd-row-${currentRow}`, this.selection.col, false);
                if (visualIdx !== -1) {
                    nextCol = visualIdx;
                    handled = true;
                }
            }

            // 2. Cross-Row Navigation
            if (!handled) {
                let r = currentRow + 1;
                while (r <= 2 && !rowConfig[r].exists) r++;

                if (r <= 2) {
                    nextRow = r;
                    const curEl = getCurrentRowEl();
                    if (curEl) {
                        nextCol = findBestColInRow(nextRow, curEl, false);
                    } else {
                        nextCol = Math.min(this.selection.col, rowConfig[nextRow].count - 1);
                    }
                }
            }
        }

        // HORIZONTAL MOVEMENTS
        if (isLeft) {
            nextCol--;
            if (nextCol < 0) {
                nextCol = rowConfig[currentRow].count - 1; // Wrap
            }
        } else if (isRight) {
            nextCol++;
            if (nextCol >= rowConfig[currentRow].count) {
                nextCol = 0; // Wrap
            }
        }

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
                if (!this.rewardClaimed) {
                    this.game.grantDailyReward(reward.def);
                    reward.claimed = true;
                    this.rewardClaimed = true;
                    this.game.addFloatingText("Claimed!", this.game.player.x, this.game.player.y, '#ffd700');
                    this.generateSupplyItems();

                    if (this.supplyItems.length > 0) {
                        this.selection = { row: 1, col: 0 };
                    } else {
                        this.selection = { row: 2, col: 2 };
                    }
                } else {
                    this.game.addFloatingText("Already picked a reward", this.game.player.x, this.game.player.y, '#ff0000');
                }
            }
        } else if (row === 1) {
            // SUPPLY ORDER
            const item = this.supplyItems[col];
            if (item) {
                // Buy Item Logic (Morning Delivery / Post-Day Order)
                if (this.game.money >= item.cost) {

                    // Visual Feedback
                    const rowEl = document.getElementById('pd-row-1');
                    if (rowEl && rowEl.children[col]) {
                        const el = rowEl.children[col];
                        el.classList.add('pressed');
                        setTimeout(() => el.classList.remove('pressed'), 150);
                    }

                    this.game.money -= item.cost;

                    // Add to Pending Orders
                    if (!this.game.pendingOrders) this.game.pendingOrders = [];
                    const existing = this.game.pendingOrders.find(o => o.id === item.shopItem.id);
                    if (existing) {
                        existing.qty = (existing.qty || 1) + 1;
                    } else {
                        this.game.pendingOrders.push({ id: item.shopItem.id, qty: 1 });
                    }

                    this.game.addFloatingText(`Ordered ${item.def.name || item.def.id}`, this.game.player.x, this.game.player.y, '#00ff00');
                    if (this.game.audioSystem) this.game.audioSystem.playSFX(ASSETS.AUDIO.Select || ASSETS.AUDIO.PRINTER); // Fallback
                } else {
                    this.game.addFloatingText("Not enough money", this.game.player.x, this.game.player.y, '#ff0000');
                }
            }
        } else if (row === 2) {
            // EDIT KITCHEN / EDIT MENU / NEXT DAY
            if (col === 0) { // Edit Kitchen (Build)
                this.game.enterBuildMode();
                this.cleanupDOM();
            } else if (col === 1) { // Edit Menu
                this.game.gameState = 'MENU_CUSTOM';
                this.game.menuSystem.expandedSlotIndex = null;
                this.cleanupDOM();
            } else if (col === 2) { // Next Day
                const isLocked = this.dailyRewards.length > 0 && !this.rewardClaimed;
                if (!isLocked) {
                    this.calculateAutoRestock();
                    this.game.startDay();
                    this.cleanupDOM();
                } else {
                    this.game.audioSystem.playSFX('error'); // Optional: feedback if they try to click locked
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
                <style>
                    .menu-item .item-icon {
                        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    }
                    .menu-item.selected .item-icon {
                        /* Pop up significantly (calculated from center) + random offsets */
                        transform: translate(-50%, calc(-50% - 24px)) scale(1.3) translate(var(--rand-x), var(--rand-y)) rotate(var(--rand-rot)) !important;
                        z-index: 10 !important;
                        filter: drop-shadow(0 10px 4px rgba(0,0,0,0.4)); /* Shadow to emphasize height */
                    }
                    .menu-item .item-text {
                        transition: all 0.2s ease;
                        transform-origin: center center;
                        display: inline-block;
                    }
                    .menu-item.selected .item-text {
                        color: #00ff00 !important;
                        transform: scale(1.2) rotate(var(--rand-text-rot));
                    }
                    .menu-item .label {
                        opacity: 0;
                        transition: opacity 0.2s;
                        z-index: 20;
                        pointer-events: none;
                    }
                    .menu-item.selected .label,
                    .menu-item:hover .label {
                        opacity: 1 !important;
                    }
                    .menu-item.pressed .item-icon {
                        transform: translate(-50%, calc(-50% + 2px)) scale(0.78) !important;
                    }
                    .menu-item.pressed .supply-meter-bar {
                        height: 100% !important;
                        background-color: #00ff00 !important;
                        transition: height 0.1s !important;
                    }
                    @keyframes boil {
                        100% { background-position: -219px 0; }
                    }
                    .boil-bg {
                        width: 73px;
                        height: 73px;
                        background-image: url('assets/ui/button_background-boil.png');
                        animation: boil 0.4s steps(3) infinite;
                        image-rendering: pixelated;
                        display: block;
                    }
                    .supply-boil-bg {
                        width: 73px;
                        height: 73px;
                        background-image: url('assets/ui/supply_button_background-boil.png');
                        animation: boil 0.4s steps(3) infinite;
                        image-rendering: pixelated;
                        display: block;
                    }
                </style>
                <div class="post-day-header">
                    <h1>Post-Day Menu</h1>
                    <div class="post-day-stats" id="pd-stats"></div>
                </div>
                <div class="post-day-content">
                    <div class="menu-row" id="pd-row-0"></div> <!-- Rewards -->
                    <div class="menu-row" id="pd-row-1"></div> <!-- Supply Items -->
                    <div class="menu-row" id="pd-row-2"></div> <!-- Edit Kitchen / Menu -->
                </div>
            `;
            uiLayer.appendChild(container);
            this.domInitialized = true;
        }

        // 2. Update Stats
        const statsEl = document.getElementById('pd-stats');
        if (statsEl) {
            statsEl.innerText = `Money: $${Math.floor(this.game.money)}`;
        }

        // 3. Update Rows

        // Row 0: Rewards (Add Reroll Button)
        const rewardsWithReroll = [...this.dailyRewards];
        if (rewardsWithReroll.length > 0) {
            rewardsWithReroll.push({ isReroll: true, claimed: false });
        }
        this.updateRowDOM('pd-row-0', rewardsWithReroll, 0);

        // Row 1: Supply Items
        this.updateRowDOM('pd-row-1', this.supplyItems, 1);

        // Row 2: Edit Kitchen / Edit Menu / Next Day
        this.updateActionRowDOM('pd-row-2', 2, [
            { label: 'Edit Kitchen', id: 'build_mode', image: true },
            { label: 'Edit Menu', id: 'menu_custom', image: true },
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
                    el.classList.add('supply-card');
                    el.classList.remove('reward-card');
                    this.buildSupplyContent(el, item);
                }
                el.dataset.itemId = itemId;
                el.dataset.claimed = claimed;
            } else if (rowIndex === 1) {
                // Smart Update for Supply Meter (avoid full rebuild to keep animations if possible, or just update data)
                const def = item.def;
                const maxCount = def.maxCount || 1;
                const currentCount = this.getBoxedSupplyCount(def.id);
                const ratio = Math.min(currentCount / maxCount, 1.0);

                // Check if visually different
                const prevRatio = parseFloat(el.dataset.ratio || -1);
                if (Math.abs(ratio - prevRatio) > 0.01) {
                    this.buildSupplyContent(el, item); // Rebuild to update meter
                }
            }

            // -- Selection State --
            if (isSelected) el.classList.add('selected');
            else el.classList.remove('selected');

            // -- Claimed/Dim State (Rewards) --
            if (rowIndex === 0) {
                if (items[index].claimed) el.classList.add('claimed');
                else el.classList.remove('claimed');

                // Dim others if one is claimed
                if (this.rewardClaimed && !items[index].claimed) {
                    el.style.opacity = '0.5';
                    el.style.filter = 'grayscale(100%)';
                } else {
                    el.style.opacity = '1';
                    el.style.filter = 'none';
                }
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
        `;
    }

    buildSupplyContent(el, item) {
        const def = item.def;
        // Logic for icon: use closed box texture or fallback
        const iconName = def.texture || `${def.id}-closed.png`;

        // Calculate Supply Meter
        const maxCount = def.maxCount || 1;
        const currentCount = this.getBoxedSupplyCount(def.id);
        const ratio = Math.min(currentCount / maxCount, 1.0);

        el.dataset.ratio = ratio; // Store for update check

        let color = '#ff0000'; // Red (< 0.25)
        if (ratio > 0.5) color = '#00ff00'; // Green
        else if (ratio >= 0.25) color = '#ffff00'; // Yellow

        // Max height reduced to 57px (from 63px) to allow 3px padding top/bottom
        const barHeight = Math.floor(ratio * 57);
        // Use percentage for CSS transition smoothness if we were updating style directly, but px is fine too.
        // Actually, let's use percentage of the container (63pxish) 
        // 57px is ~90% of 63. Let's stick to px for precision.

        el.style.background = 'none';
        el.style.border = 'none';

        el.innerHTML = `
            <div style="position: relative; display: inline-block;">
                <div class="supply-boil-bg"></div>
                <img class="item-icon" src="assets/${iconName}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.8); z-index: 1; image-rendering: pixelated; max-width: 48px; max-height: 48px;">
                
                <div class="item-text" style="position: absolute; bottom: 4px; width: 100%; text-align: center; z-index: 2; font-size: 1rem; color: white; pointer-events: none;">
                    $${item.cost}
                </div>

                <!-- Supply Meter -->
                <div style="position: absolute; right: -20px; bottom: 0; width: 15px; height: 63px;">
                    <!-- Inner Bar: 9px wide (3px margin left/right), starts 3px from bottom -->
                    <div class="supply-meter-bar" style="position: absolute; bottom: 3px; left: 3px; width: 9px; height: ${barHeight}px; background-color: ${color}; transition: height 0.3s; pointer-events: none;"></div>
                    <img src="assets/ui/supply_meter.png" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; image-rendering: pixelated;">
                </div>
            </div>
        `;
    }

    getBoxedSupplyCount(itemId) {
        // Count ONLY items in boxes (or full boxes in cart/pending)
        // itemId should be the Box ID (e.g. patty_box)
        const def = DEFINITIONS[itemId];
        const perBox = def ? (def.maxCount || 1) : 1;

        let count = 0;

        // 1. Scan Rooms for Boxes
        Object.values(this.game.rooms).forEach(room => {
            if (!room) return;
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);
                    const obj = cell.object;
                    if (obj) {
                        // Check if it's the box itself
                        if (obj.definitionId === itemId && obj.state && obj.state.count !== undefined) {
                            count += obj.state.count;
                        }
                    }
                }
            }
        });

        // 2. Add Cart content (Full Boxes)
        const inCart = this.game.cart[itemId] || 0;
        count += inCart * perBox;

        // 3. Add Pending Orders (Morning Delivery)
        if (this.game.pendingOrders) {
            const pending = this.game.pendingOrders.find(o => o.id === itemId);
            if (pending) {
                count += pending.qty * perBox;
            }
        }

        return count;
    }

    updateActionRowDOM(elementId, rowIndex, actions) {
        const rowEl = document.getElementById(elementId);
        if (!rowEl) return;

        if (rowEl.children.length !== actions.length) {
            rowEl.innerHTML = '';
            actions.forEach((action, index) => {
                const el = document.createElement('div');
                el.className = 'menu-item action-btn';
                el.dataset.actionId = action.id;

                if (action.image) {
                    // Image-based buttons
                    el.classList.add('image-btn');
                    const img = document.createElement('img');
                    img.style.display = 'block';
                    el.appendChild(img);
                } else {
                    // Text buttons
                    el.innerText = action.label;
                    if (action.specialClass) el.classList.add(action.specialClass);
                }

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

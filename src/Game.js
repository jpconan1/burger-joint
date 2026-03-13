import { ASSETS, TILE_TYPES, GRID_WIDTH, GRID_HEIGHT } from './constants.js';
import { CAPABILITY, DEFINITIONS } from './data/definitions.js';
import { EXPANSIONS } from './data/expansions.js';

import { SCORING_CONFIG } from './data/scoringConfig.js';
import { AssetLoader } from './systems/AssetLoader.js';
import { Renderer } from './systems/Renderer.js';
import { Grid } from './systems/Grid.js';
import { Player } from './entities/Player.js';
import { ItemInstance } from './entities/Item.js';

import { DEFAULT_LEVEL, DEFAULT_STORE_ROOM, DEFAULT_OFFICE_ROOM } from './data/defaultLevel.js';
import { OrderSystem } from './systems/OrderSystem.js';
import { getMenuForCapabilities } from './data/orderTemplates.js';
import { Settings, ACTIONS } from './systems/Settings.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { ConstructionSystem } from './systems/ConstructionSystem.js';
import { MenuSystem } from './systems/MenuSystem.js';
import { TouchInputSystem } from './systems/TouchInputSystem.js';


import { AlertSystem } from './systems/AlertSystem.js';
import { AutomatedRewardSystem } from './systems/AutomatedRewardSystem.js';
import { PowerupSystem } from './systems/PowerupSystem.js';
import { CHUTE_TRIGGERS } from './data/chute_triggers.js';

export class Game {
    constructor() {
        this.assetLoader = new AssetLoader();
        this.grid = new Grid(GRID_WIDTH, GRID_HEIGHT);
        this.renderer = null;
        this.player = new Player(4, 4);


        this.alertSystem = new AlertSystem(this);
        this.settings = new Settings();
        this.audioSystem = new AudioSystem(this.settings);

        // Systems
        this.constructionSystem = new ConstructionSystem(this);
        this.menuSystem = new MenuSystem(this);
        this.touchInputSystem = new TouchInputSystem(this);
        this.automatedRewardSystem = new AutomatedRewardSystem(this);
        this.powerupSystem = new PowerupSystem(this);

        this.gameState = 'TITLE'; // TITLE, PLAYING, PLACEMENT, SETTINGS
        this.titleSelection = 0; // 0: New Game, 1: Settings
        this.settingsState = {
            selectedIndex: 0,
            rebindingAction: null
        };

        // Bind input handlers
        window.addEventListener('keydown', this.handleInput.bind(this));
        window.addEventListener('keyup', (e) => {
            if (this.keys) this.keys[e.code] = false;
        });
        window.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));

        this.keys = {};
        this.currentSongIndex = -1;
        this.isViewingOrders = false;
        this.orderSystem = new OrderSystem();
        this.dayNumber = 0;
        this.orders = [];
        this.ticketQueue = [];    // Pending tickets to arrive
        this.activeTickets = [];  // Tickets currently on the rail
        this.currentTicket = null; // Deprecated, use activeTickets logic
        this.ticketTimer = 0;     // Timer for next ticket arrival
        this.incomingTicket = null; // Ticket currently printing
        this.printingTimer = 0;     // Animation timer for printing

        this.rooms = {};
        this.currentRoomId = 'main';
        this.ticketWheelAnimStartTime = 0;

        // Economy & Day Cycle
        this.money = 0;
        this.isDayActive = false;

        // Visual Feedback
        this.floatingTexts = [];
        this.effects = [];

        // Ordering System
        this.shopItems = [];
        this.pendingOrders = []; // Store for items ordered at night for morning delivery

        // Daily Stats
        this.dailyMoneyEarned = 0;

        // High Score System
        this.highScore = parseInt(localStorage.getItem('burger_joint_highscore')) || 0;
        this.sessionTickets = 0;
        this.ticketsGeneratedToday = 0;
        this.dailyBagsSold = 0;
        this.timeFreezeTimer = 0;

        // Stability Meter
        this.stability = 100;
        this.maxStability = 100;

        // Shift Tracking
        this.currentShift = 'DAY'; // 'DAY' or 'NIGHT'
        this.shiftCount = 0;
        this.pattyBoxTutorialShown = false;
        this.unlockMiniGameShown = false;
        this.pendingDirtyPlates = [];



        // 1. Supplies (Dynamic from DEFINITIONS)
        Object.keys(DEFINITIONS).forEach(defId => {
            const def = DEFINITIONS[defId];
            if ((def.type === 'Box' || def.type === 'SauceContainer') && def.price) {
                // Determine 'unlocked' status based on explicit flag or default
                // Essential items are always unlocked
                const isEssential = !!def.isEssential;

                // Check if this is a Reward Item (Topping/Side/Drink Provider) that should be LOCKED by default
                let isRewardItem = false;

                // Helper to check for topping/reward nature
                // 1. Direct check (e.g. sauce box produces sauce bag)
                if (def.produces) {
                    const prod = DEFINITIONS[def.produces];
                    if (prod) {
                        // Check if the product itself is a topping, sauce, syrup, or side prep
                        if (prod.category === 'sauce_refill' || prod.category === 'topping' || prod.isTopping ||
                            prod.category === 'syrup' || prod.category === 'side_prep') {
                            isRewardItem = true;
                        }

                        // Check if it creates a topping/side via slicing/processing
                        if (prod.slicing && prod.slicing.result) {
                            const res = DEFINITIONS[prod.slicing.result];
                            if (res && (res.category === 'topping' || res.isTopping)) isRewardItem = true;
                        }
                        if (prod.process && prod.process.result) {
                            const res = DEFINITIONS[prod.process.result];
                            if (res && (res.category === 'topping' || res.isTopping)) isRewardItem = true;
                        }

                        // Check for variants (fryContent) or side-prep products
                        if (prod.fryContent || prod.category === 'side_prep') isRewardItem = true;
                    }
                }

                // Logic:
                // 1. Essential -> Unlocked
                // 2. Reward Item -> LOCKED (unless essential)
                // 3. Others (Cups/Bags/etc) -> Follow existing unlockCondition or Default Unlocked

                let isUnlocked = isEssential;

                if (!isEssential) {
                    if (typeof def.unlocked !== 'undefined') {
                        isUnlocked = def.unlocked;
                    } else if (def.unlockCondition) {
                        isUnlocked = false; // Has specific condition (e.g. Appliance)
                    } else if (isRewardItem) {
                        isUnlocked = false; // LOCKED by default for Daily Reward
                    } else {
                        isUnlocked = true; // Default unlocked (e.g. random supplies if any)
                    }
                }

                this.shopItems.push({
                    id: defId,
                    price: def.price, // Use price from definition
                    type: 'supply',
                    unlocked: isUnlocked, // Will be overridden by save data if present
                    isEssential: isEssential,
                    isReward: isRewardItem
                });
            }
        });



        // 2. Appliances & Actions (Hardcoded / Special Logic)
        const appliancesAndActions = [
            { id: 'build_mode', price: 0, type: 'action', unlocked: true, uiAsset: 'RENO_BUILD_MODE' },
            { id: 'expansion', price: SCORING_CONFIG.PRICES.expansion, type: 'action', unlocked: true, uiAsset: 'RENO_EXPAND' },

            { id: 'counter', price: SCORING_CONFIG.PRICES.counter, type: 'appliance', unlocked: true, tileType: 'COUNTER', uiAsset: 'RENO_ICON_COUNTER' },
            { id: 'cutting_board', price: SCORING_CONFIG.PRICES.cutting_board, type: 'appliance', unlocked: true, tileType: 'CUTTING_BOARD', uiAsset: 'RENO_ICON_CUTTING_BOARD' },
            { id: 'dispenser', price: SCORING_CONFIG.PRICES.dispenser, type: 'appliance', unlocked: true, tileType: null, uiAsset: 'RENO_ICON_DISPENSER' },
            { id: 'fryer', price: SCORING_CONFIG.PRICES.fryer, type: 'appliance', unlocked: true, tileType: 'FRYER', uiAsset: 'RENO_ICON_FRYER' },
            { id: 'soda_fountain', price: SCORING_CONFIG.PRICES.soda_fountain, type: 'appliance', unlocked: true, tileType: 'SODA_FOUNTAIN', uiAsset: 'RENO_ICON_SODA_FOUNTAIN' },
            { id: 'grill', price: SCORING_CONFIG.PRICES.grill, type: 'appliance', unlocked: true, tileType: 'GRILL' },
            { id: 'dishwasher', price: SCORING_CONFIG.PRICES.dishwasher, type: 'appliance', unlocked: true, tileType: 'DISHWASHER' },
        ];

        this.shopItems.push({
            id: 'insert',
            price: 20, // Manual price as it's not a box
            type: 'supply',
            unlocked: true,
            isEssential: false
        });

        this.shopItems = [...this.shopItems, ...appliancesAndActions];

        // Cart for current order: { itemId: quantity }
        // Cart for current order: { itemId: quantity }
        this.cart = {};


        this.selectedOrderItemIndex = 0;


        // Placement State (Delegated to ConstructionSystem via getter)
        // this.placementState = { ... };

        // Capabilities
        this.capabilities = new Set();

        // Progression
        this.appliedExpansions = new Set();

        this.storage = {}; // Store for unplaced appliances: { 'counter': 2, 'fryer': 1 }
        this.autoUpgradedAppliances = new Set();

        // Dependency Map for Ingredients (Child -> Parent)
        this.itemDependencyMap = {};
        Object.values(DEFINITIONS).forEach(def => {
            if (def.produces) this.itemDependencyMap[def.produces] = def.id;
            if (def.slicing && def.slicing.result) this.itemDependencyMap[def.slicing.result] = def.id;
            if (def.process && def.process.result) this.itemDependencyMap[def.process.result] = def.id;
            // Generic 'result' (e.g. syrups -> drinks)
            if (def.result) this.itemDependencyMap[def.result] = def.id;
            // Sauce Dependencies (Bag -> Sauce)
            if (def.sauceId) this.itemDependencyMap[def.sauceId] = def.id;
            // Fry Content Dependencies (Bag -> Raw Fries)
            if (def.fryContent) this.itemDependencyMap[def.fryContent] = def.id;
        });

        // Manual Dependencies for Complex Items (Machine assembled)
        // 'soda' is now handled by def.result in soda_syrup
        this.itemDependencyMap['fries'] = 'fry_bag';
        this.itemDependencyMap['sweet_potato_fries'] = 'sweet_potato_fry_bag';
        this.itemDependencyMap['fried_onion'] = 'onion_box';
        this.itemDependencyMap['onion_rings'] = 'onion_box';

        this.allowedOrderItems = new Set();
        this.fallingBoxes = [];
    }

    // Proxy getters/setters for compatibility with Renderer and legacy code
    get placementState() { return this.constructionSystem.state; }
    set placementState(v) { this.constructionSystem.state = v; }

    get selectedRenoIndex() { return this.constructionSystem.selectedRenoIndex; }
    set selectedRenoIndex(v) { this.constructionSystem.selectedRenoIndex = v; }

    // Computer Item Selection (Deprecated)

    get isRushMode() {
        // RUSH if Day is Active AND Queue is NOT finished
        return this.isDayActive && !this.queueFinishedTime;
    }

    enterBuildMode(initialHeldItem = null, fromPurchase = false) {
        this.constructionSystem.enterBuildMode(initialHeldItem, fromPurchase);
    }

    exitBuildMode() {
        this.constructionSystem.exitBuildMode();
    }

    // getInventoryCount(itemId) {
    // }





    async init() {
        try {
            console.log('Loading assets...');
            // Load base assets
            await this.assetLoader.loadAll(ASSETS);
            // TODO: Load dynamic assets for items (bun_box-closed.png, etc)
            // For now relying on browser lazy loading if AssetLoader allows or if they are in ASSETS
            console.log('Assets (base) loaded.');

            this.audioSystem.init(this.assetLoader);

            // Try playing Title Theme
            this.audioSystem.playMusic(null, ASSETS.AUDIO.TITLE_THEME);

            this.renderer = new Renderer('game-canvas', this.assetLoader);

            this.setupLevel();

            this.loop();
        } catch (error) {
            console.error('Initialization failed:', error);
            document.body.innerHTML = `<h1 style="color:red">${error.message}</h1>`;
        }
    }

    setupLevel() {
        // Try to load full game state first
        if (this.loadLevel()) {
            console.log(`Loaded game from storage. Room: ${this.currentRoomId}`);
            // Patch Office Room to ensure Reno tile is present (handling old saves)
            if (this.rooms['office']) {
                this.rooms['office'].setTileType(1, 0, TILE_TYPES.RENO);
                // Also ensure computer is there
                this.rooms['office'].setTileType(2, 0, TILE_TYPES.COMPUTER);
            }


            return;
        }

        // Initialize New Game (Default)
        this.startNewGame();
    }

    startNewGame() {
        console.log('Starting new game with default layout.');
        this.pattyBoxTutorialShown = false;
        this.unlockMiniGameShown = false;

        // Continue Title Theme (Muffled) for Day 0 Setup
        this.audioSystem.setMuffled(true);

        // Reset Session Score
        this.sessionTickets = 0;

        // Clear existing rooms if any
        this.rooms = {};

        // 1. Setup Main Room (Kitchen)
        const mainGrid = new Grid(DEFAULT_LEVEL.width, DEFAULT_LEVEL.height);
        mainGrid.deserialize(DEFAULT_LEVEL);
        this.rooms['main'] = mainGrid;

        // Spawn Starting Inserts (Stack of 9)
        const insertStack = new ItemInstance('insert');
        insertStack.state.count = 9;
        // Bottom row, column 11
        const startX = mainGrid.width - 3;
        const startY = mainGrid.height - 1;
        const targetCell = mainGrid.getCell(startX, startY);
        if (targetCell && targetCell.type.id === 'COUNTER') {
            targetCell.object = insertStack;
        }

        // 2. Setup Store Room
        const storeRoomGrid = new Grid(DEFAULT_STORE_ROOM.width, DEFAULT_STORE_ROOM.height);
        storeRoomGrid.deserialize(DEFAULT_STORE_ROOM);
        this.rooms['store_room'] = storeRoomGrid;

        // 3. Setup Office Room
        const officeGrid = new Grid(DEFAULT_OFFICE_ROOM.width, DEFAULT_OFFICE_ROOM.height);
        officeGrid.deserialize(DEFAULT_OFFICE_ROOM);
        this.rooms['office'] = officeGrid;

        // Set Initial Active Room
        this.currentRoomId = 'main';
        this.grid = this.rooms['main'];

        // Reset Player Position for new game
        this.player.x = 2;
        this.player.y = 3;
        this.player.facing = { x: 0, y: 1 };

        this.player.heldItem = null;

        // Reset Economy
        this.money = 120;
        this.storage = {}; // Reset Storage
        this.dayNumber = 0;
        this.appliedExpansions.clear();
        this.autoUpgradedAppliances.clear();

        // Reset Shop Items (Unlocks)
        this.shopItems.forEach(item => {
            if (item.type === 'supply') {
                const def = DEFINITIONS[item.id];

                // Determine 'unlocked' status consistently with constructor
                const isEssential = item.isEssential;

                // Check if this is a Topping/Reward Provider
                let isRewardItem = false;
                if (def.produces) {
                    const prod = DEFINITIONS[def.produces];
                    if (prod) {
                        if (prod.category === 'sauce_refill' || prod.category === 'topping' || prod.isTopping ||
                            prod.category === 'syrup' || prod.category === 'side_prep') {
                            isRewardItem = true;
                        }
                        if (prod.slicing && prod.slicing.result) {
                            const res = DEFINITIONS[prod.slicing.result];
                            if (res && (res.category === 'topping' || res.isTopping)) isRewardItem = true;
                        }
                        if (prod.process && prod.process.result) {
                            const res = DEFINITIONS[prod.process.result];
                            if (res && (res.category === 'topping' || res.isTopping)) isRewardItem = true;
                        }
                        // Check for variants (fryContent)
                        if (prod.fryContent) isRewardItem = true;
                    }
                }

                let isUnlocked = isEssential;
                if (!isEssential) {
                    if (typeof def.unlocked !== 'undefined') {
                        isUnlocked = def.unlocked;
                    } else if (def.unlockCondition) {
                        isUnlocked = false;
                    } else if (isRewardItem) {
                        isUnlocked = false;
                    } else {
                        isUnlocked = true;
                    }
                }

                item.unlocked = isUnlocked;
                item.isReward = isRewardItem;
            } else {
                // Appliances and Actions default to unlocked
                item.unlocked = true;
            }
        });
        this.sortShopItems();

        // 4. Pre-purchase Essentials for Day 1 (Since Order Screen is now just info)
        // Auto-buy 1 of each essential
        this.pendingOrders = [];
        let kStartCost = 0;

        // Initial supplies: Patties land first (bottom), Buns land second (on top)
        ['patty_box', 'bun_box'].forEach(id => {
            const item = this.shopItems.find(i => i.id === id);
            if (item) {
                this.pendingOrders.push({ id: item.id, qty: 1 });
                kStartCost += item.price;
            }
        });
        this.money -= kStartCost;

        // Save this clean state immediately so if they refresh they get this
        this.saveLevel();

        this.queueFinishedTime = null;
        this.isDayActive = false;
        this.testAlertShown = false;

        this.gameState = 'TITLE';
        this.updateCapabilities();

        // Show welcome alert for new players
        this.alertSystem.trigger('welcome_alert');
    }

    updateCapabilities() {
        this.capabilities.clear();

        // 1. Gather all unique object/item definitions present in the world (Appliances & Items)
        const activeDefIds = new Set();
        const activeTileTypes = new Set();

        Object.values(this.rooms).forEach(room => {
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);

                    // Track Tile Type (Appliance)
                    if (cell.type && cell.type.id) {
                        activeTileTypes.add(cell.type.id);
                    }

                    // Track Item Definition (Supply Box)
                    if (cell.object) {
                        if (cell.object.definitionId) {
                            activeDefIds.add(cell.object.definitionId);
                        }
                    }
                }
            }
        });

        // 2. Derive Capabilities based on Requirements
        // CAPABILITY.BASIC_BURGER: Stove + Patty (Box/Item) + Bun (Box/Item)
        const hasPatty = activeDefIds.has('patty_box') || activeDefIds.has('beef_patty');
        const hasBun = activeDefIds.has('bun_box') || activeDefIds.has('plain_bun');
        if (activeTileTypes.has('GRILL') && hasPatty && hasBun) {
            this.capabilities.add(CAPABILITY.BASIC_BURGER);
        }

        // CAPABILITY.CUT_TOPPINGS: Cutting Board + Any Slicable Item
        // Check for items that are sliceable or boxes that produce sliceable items
        if (activeTileTypes.has('CUTTING_BOARD')) {
            const hasSlicable = Array.from(activeDefIds).some(id => {
                const def = DEFINITIONS[id];
                if (!def) return false;

                // 1. Direct slicable item (e.g., 'tomato', 'onion')
                if (def.slicing) return true;

                // 2. Box producing slicable item (e.g., 'tomato_box' -> 'tomato')
                if (def.produces) {
                    const product = DEFINITIONS[def.produces];
                    if (product && product.slicing) return true;
                }

                return false;
            });

            if (hasSlicable) {
                this.capabilities.add(CAPABILITY.CUT_TOPPINGS);
            }
        }

        // CAPABILITY.ADD_COLD_SAUCE: Dispenser + Mayo (Box/Bag)
        const hasMayo = activeDefIds.has('mayo_box') || activeDefIds.has('mayo_bag');
        if (activeDefIds.has('dispenser') && hasMayo) {
            this.capabilities.add(CAPABILITY.ADD_COLD_SAUCE);
        }

        // CAPABILITY.ADD_LETTUCE: Lettuce (Box/Head/Leaf)
        // No specific appliance requirement for now (Hand chopped), but maybe imply it starts from box
        const hasLettuce = activeDefIds.has('lettuce_box') || activeDefIds.has('lettuce_head');
        if (hasLettuce) {
            this.capabilities.add(CAPABILITY.ADD_LETTUCE);
        }

        // CAPABILITY.SERVE_FRIES: Fryer + Fry (Box/Bag) + Side Cup (Box/Item)
        const hasFries = activeDefIds.has('fry_box') || activeDefIds.has('fry_bag') || activeDefIds.has('fry_bag_open');
        const hasSideCup = activeDefIds.has('side_cup_box') || activeDefIds.has('side_cup');
        if (activeTileTypes.has('FRYER') && hasFries && hasSideCup) {
            this.capabilities.add(CAPABILITY.SERVE_FRIES);
        }

        // CAPABILITY.SERVE_DRINKS: Soda Fountain + Syrup (Box/Bag) + Drink Cup (Box/Item)
        const hasSyrup = Array.from(activeDefIds).some(id => {
            const def = DEFINITIONS[id];
            if (!def) return false;
            if (def.category === 'syrup') return true;
            if (def.produces) {
                const product = DEFINITIONS[def.produces];
                return product && product.category === 'syrup';
            }
            return false;
        });

        const hasDrinkCup = activeDefIds.has('drink_cup_box') || activeDefIds.has('drink_cup');
        if ((activeTileTypes.has('SODA_FOUNTAIN') || activeDefIds.has('soda_fountain')) && hasSyrup && hasDrinkCup) {
            this.capabilities.add(CAPABILITY.SERVE_DRINKS);
        }



        // Endgame State: Fryer + Soda Fountain
        this.isEndgameUnlocked = activeTileTypes.has('FRYER') && activeTileTypes.has('SODA_FOUNTAIN');

        console.log('Capabilities updated:', Array.from(this.capabilities));

        // 3. Compute Allowed Order Items (Ingredient Availability)
        const availableIds = new Set(activeDefIds);
        let changed = true;

        // Iteratively expand available items (Production Chain)
        while (changed) {
            changed = false;
            for (const id of availableIds) {
                const def = DEFINITIONS[id];
                if (!def) continue;

                const candidates = [];
                if (def.produces) candidates.push(def.produces);
                if (def.slicing && def.slicing.result) candidates.push(def.slicing.result);
                if (def.process && def.process.result) candidates.push(def.process.result);

                for (const c of candidates) {
                    if (!availableIds.has(c)) {
                        availableIds.add(c);
                        changed = true;
                    }
                }
            }
        }

        this.allowedOrderItems = new Set();
        Object.values(DEFINITIONS).forEach(def => {
            if (!def.orderConfig) return;

            // Check if it has a dependency
            const parentId = this.itemDependencyMap[def.id];
            if (parentId) {
                // Check if PARENT is available (Ingredient Check)
                // This covers:
                // 1. Sliced items (Tomato Slice -> Tomato (Available))
                // 2. Machine items (Soda -> Soda Syrup (Available))
                if (availableIds.has(parentId)) {
                    this.allowedOrderItems.add(def.id);
                }
            } else {
                // No parent dependency (e.g. Burger Base), allow by default
                // (Capability check will handle tool/machine requirement)
                this.allowedOrderItems.add(def.id);
            }
        });
        console.log('Allowed Order Items:', Array.from(this.allowedOrderItems));

        this.possibleMenu = getMenuForCapabilities(Array.from(this.capabilities), Array.from(this.allowedOrderItems));

        // Ensure MenuSystem is aware of current unlocks
        if (this.menuSystem) {
            this.menuSystem.updateAvailableItems();
        }
    }

    getPlayerCapabilities() {
        return Array.from(this.capabilities);
    }

    hasAppliance(tileTypeId) {
        for (const room of Object.values(this.rooms)) {
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);
                    if (cell.type && cell.type.id === tileTypeId) return true;
                }
            }
        }
        return false;
    }





    applyExpansion(exp) {
        console.log(`Applying Expansion: ${exp.name}`);

        if (exp.layout) {
            // 1. Capture existing objects and tiles from the current grid (Preserve State)
            const currentObjMap = [];
            const currentGrid = this.rooms['main'];

            // Capture Dimensions
            const oldWidth = currentGrid.width;
            const oldHeight = currentGrid.height;

            if (currentGrid) {
                for (let y = 0; y < currentGrid.height; y++) {
                    for (let x = 0; x < currentGrid.width; x++) {
                        const cell = currentGrid.getCell(x, y);
                        // Save object, tile type, and state
                        if (cell) {
                            currentObjMap.push({
                                x,
                                y,
                                object: cell.object,
                                tile: cell.type,
                                state: JSON.parse(JSON.stringify(cell.state || {})) // Deep copy state
                            });
                        }
                    }
                }
            }

            // Apply new layout
            // This replaces the current 'main' room grid
            const newGrid = new Grid(exp.layout.width, exp.layout.height);
            newGrid.deserialize(exp.layout);
            this.rooms['main'] = newGrid;
            this.grid = this.rooms['main']; // Update active grid

            // 2. Restore objects and tiles to the new grid
            currentObjMap.forEach(item => {
                let newX = item.x;
                let newY = item.y;

                // Edge Detection: Relative Mapping
                // If item was on the far right, map to new far right
                if (item.x === oldWidth - 1) {
                    newX = newGrid.width - 1;
                }
                // If item was on the bottom, map to new bottom
                if (item.y === oldHeight - 1) {
                    newY = newGrid.height - 1;
                }

                // Check if the target cell exists
                const targetCell = newGrid.getCell(newX, newY);

                if (targetCell) {
                    // Identify preserve-worthy tiles (Appliances/User placed)
                    const preservedTiles = ['COUNTER', 'SERVICE', 'GRILL', 'CUTTING_BOARD', 'DISPENSER', 'FRYER', 'SODA_FOUNTAIN', 'COMPUTER'];
                    // Identify structural tiles that should NOT be overwritten
                    // Note: FLOOR is overwritable, so not included here.
                    const structuralTiles = ['WALL', 'SHUTTER_DOOR', 'OFFICE_DOOR', 'OFFICE_DOOR_CLOSED', 'EXIT_DOOR', 'GARBAGE'];

                    // 1. Restore the Tile (Appliance) if applicable
                    // Checks:
                    // - Old tile was an appliance
                    // - Target slot is not a structural element (Wall/Door) in the new layout
                    if (preservedTiles.includes(item.tile.id) && !structuralTiles.includes(targetCell.type.id)) {
                        targetCell.type = item.tile;
                        targetCell.state = item.state; // Restore state (branding, cooking progress, etc.)
                    }

                    // 2. Restore the Object
                    if (item.object) {
                        // Only place object if the (potentially restored) tile supports it
                        // Or strictly force it if we trust the old state?
                        if (targetCell.type.holdsItems || targetCell.type.id === 'FLOOR') {
                            targetCell.object = item.object;
                        } else {
                            console.warn(`Could not restore object at ${newX},${newY} - Tile ${targetCell.type.id} does not hold items.`);
                        }
                    }
                } else {
                    console.warn(`Could not restore item at ${item.x},${item.y} -> ${newX},${newY} (Cell invalid)`);
                }
            });

            // Reset player position safely
            this.player.x = 2;
            this.player.y = 4;
        } else {
            // Fallback to old heuristic or do nothing
            console.log("No layout defined for expansion, using legacy expansion.");
            const currentGrid = this.rooms['main'];
            currentGrid.expandInterior(currentGrid.width - 1, currentGrid.height - 1);
        }

        this.appliedExpansions.add(exp.id);
        this.addFloatingText(`Kitchen Expanded: ${exp.name}!`, this.player.x, this.player.y, '#00ff00');
        this.saveLevel();
    }




    handleBuildModeInput(event) {
        this.constructionSystem.handleInput(event);
    }





    // Helper to sort shop items
    sortShopItems() {
        this.sortShopItems();
    }

    unlockAllCheat() {
        console.log("CHEAT: Unlocking ALL items and appliances.");
        this.addFloatingText("CHEAT: Unlocked Everything!", this.player.x, this.player.y, '#ff00ff');

        this.shopItems.forEach(item => {
            item.unlocked = true;
            item.justUnlocked = true;
            // Mark as reward
            item.isReward = true;
        });

        if (this.menuSystem) {
            this.menuSystem.updateAvailableItems();
        }

        this.sortShopItems();
    }

    spoilStaleItems() {
        console.log("Checking for stale items...");
        let staleCount = 0;

        // Core Spoilage Rules:
        // 1. Boxes (and their contents) NEVER spoil.
        // 2. Unboxed Items: Spoil IMMEDIATELY (overnight).
        // 3. Exception: Items in 'inserts' last 1 night (Age 0 -> Age 1). Spoil if Age >= 2.

        const checkItem = (item) => {
            if (!item) return null;

            // Box Check
            if (item.type === 'Box' || item.definition.type === 'Box') {
                return item; // No spoilage
            }

            // Insert Check
            if (item.definitionId === 'insert') {
                // Check contents
                if (item.state.contents && item.state.contents.length > 0) {
                    const newContents = [];
                    item.state.contents.forEach(content => {
                        // Increment age
                        const age = (content.age || 0) + 1;
                        content.age = age;

                        // Survival Check (Max Age 1)
                        if (age < 2) {
                            newContents.push(content);
                        } else {
                            // Spoils! turning into trash? Or just disappearing?
                            // User "stuff not in boxes spoils overnight".
                            // Usually this means it turns into 'spoil.png' or similar.
                            // However, inserts hold distinct items.
                            // Let's create a 'generic_spoil' item in its place.
                            staleCount++;
                            newContents.push({
                                definitionId: 'generic_spoil',
                                state: {},
                                texture: 'spoil.png' // shim for renderer
                            });
                        }
                    });
                    item.state.contents = newContents;
                }
                return item;
            }

            // Unboxed Item (Not Insert, Not Box)
            // IMMEDIATE SPOILAGE
            // Unless it is explicitly non-spoilable (e.g. tools? plates?)
            // We rely on 'spoilable' on definition, OR whitelist trash/tools.
            // But user said "stuff not in boxes spoils".
            // Let's assume Ingredients/Containers/Composites spoil.
            const def = item.definition;
            if (!def) return item;

            // Whitelist types that don't spoil?
            // Player held items?
            // Assume Tools don't spoil.
            if (def.category === 'tool') return item;

            // Whitelist types that don't spoil (Stock items)
            if (def.category === 'sauce_refill') return item;
            if (def.id === 'fry_bag' || def.id === 'sweet_fry_bag') return item;

            // Whitelist Appliances (placed as objects)
            if (def.type === 'appliance' || ['dispenser', 'soda_fountain', 'fryer', 'grill', 'counter'].includes(def.id)) return item;

            // Standard Spoiling
            let newId = 'generic_spoil';
            if (def.spoilage && def.spoilage.id) newId = def.spoilage.id;
            else if (def.aging && def.aging.spoiledItem) newId = def.aging.spoiledItem; // Legacy config support if present

            // Legacy fallbacks (explicit map for cleaner UX than generic spoil)
            const id = item.definitionId;
            if (id === 'plain_bun') newId = 'bun_old';
            else if (id === 'beef_patty') newId = 'patty_old';
            else if (id.includes('burger')) newId = 'burger_old';
            else if (id === 'fries') newId = 'fries_old';
            else if (id === 'soda') newId = 'soda_old';
            else if (id === 'bag') {
                // Empty bags don't spoil
                if (!item.state.contents || item.state.contents.length === 0) return item;
                newId = 'bag_old';
            }

            staleCount++;
            return new ItemInstance(newId);
        };

        // 1. Check Player Hands
        if (this.player.heldItem) {
            this.player.heldItem = checkItem(this.player.heldItem);
        }

        // 2. Check All Rooms
        Object.values(this.rooms).forEach(room => {
            if (!room) return;
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);
                    if (cell.object) {
                        cell.object = checkItem(cell.object);
                    }
                }
            }
        });

        if (staleCount > 0) {
            console.log(`${staleCount} items spoiled!`);
            this.addFloatingText(`${staleCount} items spoiled!`, this.player.x, this.player.y, '#90ee90');
        }
    }

    cleanAppliances() {
        console.log("Cleaning appliances...");
        Object.values(this.rooms).forEach(room => {
            if (!room) return;
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);

                    // 1. Fryer
                    if (cell.type.id === 'FRYER') {
                        // Reset to empty
                        if (cell.state) {
                            cell.state.status = 'empty';
                            cell.state.timer = 0;
                        } else {
                            cell.state = { status: 'empty' };
                        }
                        cell.object = null;
                    }
                    // 2. Grill
                    else if (cell.type.id === 'GRILL') {
                        if (cell.state) {
                            cell.state.cookingProgress = 0;
                        }
                        cell.object = null; // Clear pan/patty
                    }
                    // 3. Cutting Board
                    else if (cell.type.id === 'CUTTING_BOARD') {
                        cell.object = null;
                        // Reset internal state
                        if (cell.state) {
                            cell.state.status = 'empty';
                        } else {
                            cell.state = { status: 'empty' };
                        }
                    }
                    // 4. Sauce Dispenser & Soda Fountain -> Do NOT reset
                }
            }
        });
    }

    startDay() {
        console.log('Starting Day...');

        // Create Clean Slate for Appliances
        this.cleanAppliances();

        // Handle Overnight Spoilage
        this.spoilStaleItems();

        // Handle Morning Orders (Spawn Pending Items)
        // User Request: Clear tiles, use sorted list, stop if full.

        this.dayNumber++;
        this.ticketsGeneratedToday = 0;
        console.log(`Starting Day ${this.dayNumber}...`);

        this.currentDayPerfect = true;
        this.serviceTimer = 0;
        this.timeoutAlertShown = false;
        this.starSummaryDismissed = false;

        // 1. Populate Fridge (Do this FIRST so capabilities avail)
        // Note: We NO LONGER clear the fridge. Persistance!

        // Spawn ordered items into VALID EMPTY spots
        const deliveryTiles = [];

        ['store_room', 'office'].forEach(roomId => {
            const room = this.rooms[roomId];
            if (room) {
                for (let y = 0; y < room.height; y++) {
                    for (let x = 0; x < room.width; x++) {
                        const c = room.getCell(x, y);
                        if (c.type.id === 'DELIVERY_TILE') {
                            // Step 0: Clear the delivery tiles. Delete whatever's on them.
                            // c.object = null;
                            deliveryTiles.push(c);
                        }
                    }
                }
            }
        });

        // Step 7: Go down the list and order one box for every item until all delivery tiles are full...
        if (this.pendingOrders && this.pendingOrders.length > 0) {
            console.log(`Processing ${this.pendingOrders.length} pending orders...`);

            for (const order of this.pendingOrders) {
                // Find first empty tile
                const targetTile = deliveryTiles.find(c => !c.object);

                if (!targetTile) {
                    console.log("Delivery Area Full! Stopping restock.");
                    this.addFloatingText("Delivery Area Full!", this.player.x, this.player.y, '#ff0000');
                    break;
                }

                const instance = new ItemInstance(order.id);
                // Custom Insert Logic: Spawn stack of 3
                if (order.id === 'insert') {
                    instance.state.count = 3;
                }

                // Push to falling boxes queue
                this.fallingBoxes.push({
                    x: 0,
                    y: -1 - this.fallingBoxes.length, // Stack them above the screen
                    vy: 0,
                    item: instance
                });

                // Update cart for compatibility if needed (e.g. UI)
                this.cart[order.id] = (this.cart[order.id] || 0) + (order.qty || 1);
            }
            this.pendingOrders = [];
        }

        // 1. Handle Morning Orders via Trigger System
        this.triggerChute('START_DAY');

        // 2. Update Capabilities (Now that supplies are in the world/truck)
        this.updateCapabilities();

        // 3. Generate Daily Orders
        const capabilities = this.getPlayerCapabilities();
        // Menu System Integration: Use defined menu instead of raw capabilities
        // Continuous Loop: We do NOT generate a daily batch of tickets anymore.
        // Instead, we spawn them periodically.
        this.ticketQueue = [];

        // Safeguard: Ensure queue is not empty to prevent immediate "Day Over" state - REMOVED

        this.queueFinishedTime = null;
        this.activeTickets = [];
        this.orders = [];
        this.gameState = 'PLAYING';
        this.isDayActive = true;
        this.isPrepTime = false;
        this.prepTime = 0;
        this.maxPrepTime = 0;

        // 4. Open Kitchen Shutter
        const mainRoom = this.rooms['main'];
        let kShutter = null;
        // Scan for shutter
        for (let y = 0; y < mainRoom.height; y++) {
            for (let x = 0; x < mainRoom.width; x++) {
                const cell = mainRoom.getCell(x, y);
                if (cell.type.id === 'SHUTTER_DOOR') {
                    kShutter = cell;
                    break;
                }
            }
            if (kShutter) break;
        }

        if (kShutter) {
            kShutter.state.isOpen = true;
        }

        // Cart Reset
        this.shopItems.forEach(item => this.cart[item.id] = 0);

        // Clear unlocking notifications
        this.shopItems.forEach(i => i.justUnlocked = false);

        this.playRandomSong();

        // --- PREP TIME REMOVED ---
        const complexity = this.menuSystem.calculateComplexity();
        this.prepTime = 0;
        this.maxPrepTime = 0;
        this.isPrepTime = false;
        this.ticketTimer = 0;

        // Reset Stability
        this.stability = 100;
        this.timeoutAlertShown = false; // Reset fail state tracker

        // Reset Daily Stats
        this.dailyMoneyEarned = 0;
        this.dailyBagsSold = 0;

        // Ensure player is in Main Room (Kitchen) to start the day
        if (this.currentRoomId !== 'main') {
            console.log("Resetting player to Main Room for start of day.");
            this.currentRoomId = 'main';
            this.grid = this.rooms['main'];
            this.player.x = 2; // Center-ish
            this.player.y = 3;
            this.saveLevel();
        }

        // Initialize Loop Timers
        this.dayTimer = 0; // Starts at 0 (Morning)
        this.currentShift = 'DAY';
        this.shiftCount = 0;
        this.ticketSpawnTimer = 9999; // Force immediate ticket
        this.lightingIntensity = 0;

        console.log(`Starting Continuous Service Loop. Complexity: ${complexity})`);
    }

    playRandomSong() {
        const songs = [
            { intro: ASSETS.AUDIO.SONG1_INTRO, loop: ASSETS.AUDIO.SONG1_LOOP },
            { intro: ASSETS.AUDIO.SONG2_INTRO, loop: ASSETS.AUDIO.SONG2_LOOP },
            { intro: ASSETS.AUDIO.SONG3_INTRO, loop: ASSETS.AUDIO.SONG3_LOOP },
            { intro: ASSETS.AUDIO.SONG4_INTRO, loop: ASSETS.AUDIO.SONG4_LOOP },
            { intro: ASSETS.AUDIO.SONG5_INTRO, loop: ASSETS.AUDIO.SONG5_LOOP },
            { intro: ASSETS.AUDIO.SONG6_INTRO, loop: ASSETS.AUDIO.SONG6_LOOP }
        ];

        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * songs.length);
        } while (songs.length > 1 && newIndex === this.currentSongIndex);

        this.currentSongIndex = newIndex;
        const song = songs[newIndex];
        this.audioSystem.playMusic(song.intro, song.loop);
        this.audioSystem.setMuffled(false);
    }

    onClosingTime() {
        console.log('Restaurant Closing (Queue Finished).');
        this.queueFinishedTime = Date.now();
        this.audioSystem.setMuffled(true);
        this.isDayActive = false; // Stop timers
    }


    // Called when player exits the door
    endDay() {
        // Ensure we can only end day if service is finished
        if (this.isDayActive && !this.queueFinishedTime) {
            this.addFloatingText("Finish Service First!", this.player.x, this.player.y, '#ff0000');
            return;
        }

        this.startDay();
        this.gameState = 'PLAYING';
        this.saveLevel();
        this.audioSystem.setMuffled(true);
        console.log(`End of Day. Remaining Money: $${this.money}`);
    }




    handleInput(event) {
        if (!this.keys) this.keys = {};
        this.keys[event.code] = true;

        if (this.alertSystem?.isVisible) return this.alertSystem.handleInput(event.code);
        this.audioSystem?.resume();

        // 1. Cheats (Shift + Key)
        if (event.shiftKey && this.handleCheatInput(event)) return;

        // 2. Global Key overrides
        if (event.code === 'KeyO') return this.handleCheatInput(event);

        // 3. State-specific input
        switch (this.gameState) {
            case 'TITLE':
            case 'SETTINGS':
                return this.handleMenuInput(event);
            case 'APPLIANCE_SWAP':
                return this.handleApplianceSwapInput(event);
            case 'RENO_SHOP':
                return this.handleRenoInput(event);
            case 'BUILD_MODE':
                return this.handleBuildModeInput(event);
        }


        // 5. Normal Gameplay
        this.handleGameplayInput(event);
    }

    handleCheatInput(event) {
        const { code, shiftKey } = event;
        if (shiftKey) {
            if (code === 'KeyP') {
                console.log("--- EXPORTED LAYOUT ---", JSON.stringify(this.grid.serialize(), null, 4));
                this.addFloatingText("Layout exported to Console!", this.player.x, this.player.y, '#00ff00');
                return true;
            }
            if (code === 'KeyC') {
                this.money += 500;
                return true;
            }
            if (code === 'KeyA' || code === 'KeyU') {
                const rewards = [DEFINITIONS['bacon_box'], DEFINITIONS['cheddar_box'], DEFINITIONS['tomato_box']];
                if (code === 'KeyU') rewards.push(DEFINITIONS['onion_box'], DEFINITIONS['pickle_box']);
                this.alertSystem.trigger('unlock_alert', () => { }, { rewards });
                return true;
            }
        }
        if (code === 'KeyO') {
            const cell = this.player.getTargetCell(this.grid);
            if (cell?.type.id === 'COUNTER' && !cell.object) {
                const stack = new ItemInstance('dirty_plate');
                stack.state.count = 9;
                cell.object = stack;
                this.addFloatingText("Cheat: 9 Dirty Plates!", this.player.x, this.player.y, '#ff0000');
                return true;
            }
        }
        return false;
    }

    handleMenuInput(event) {
        const action = this.settings.getAction(event.code);
        const SELECT = ['Enter', 'Space'];
        const isSelect = action === ACTIONS.INTERACT || SELECT.includes(event.code);

        if (this.gameState === 'TITLE') {
            if (action === ACTIONS.MOVE_UP) this.titleSelection = this.titleSelection === 0 ? 1 : 0;
            else if (action === ACTIONS.MOVE_DOWN) this.titleSelection = this.titleSelection === 1 ? 0 : 1;
            else if (isSelect) {
                if (this.titleSelection === 0) {
                    this.startNewGame();
                    this.startDay();
                    this.gameState = 'PLAYING';
                } else {
                    this.gameState = 'SETTINGS';
                    this.settingsState = { selectedIndex: 0, rebindingAction: null };
                }
            }
            return;
        }

        if (this.gameState === 'SETTINGS') {
            if (this.settingsState.rebindingAction) {
                if (event.code === 'Escape') this.settingsState.rebindingAction = null;
                else {
                    this.settings.setBinding(this.settingsState.rebindingAction, event.code);
                    this.settingsState.rebindingAction = null;
                }
                return;
            }

            const keyActions = ['MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT', 'INTERACT', 'PICK_UP', 'VIEW_ORDERS', 'EQUIP_1', 'EQUIP_2', 'EQUIP_3', 'EQUIP_4'];
            const totalItems = 2 + keyActions.length;

            if (action === ACTIONS.MOVE_UP) this.settingsState.selectedIndex = (this.settingsState.selectedIndex - 1 + totalItems) % totalItems;
            else if (action === ACTIONS.MOVE_DOWN) this.settingsState.selectedIndex = (this.settingsState.selectedIndex + 1) % totalItems;
            else if (isSelect) {
                const idx = this.settingsState.selectedIndex;
                if (idx < 2) {
                    const pref = idx === 0 ? 'musicEnabled' : 'sfxEnabled';
                    this.settings.preferences[pref] = !this.settings.preferences[pref];
                    this.settings.save();
                    this.audioSystem.updateVolumesFromSettings();
                } else this.settingsState.rebindingAction = keyActions[idx - 2];
            } else if (event.code === 'Escape') this.gameState = 'TITLE';
        }
    }

    handleGameplayInput(event) {
        const action = this.settings.getAction(event.code);
        let dx = 0, dy = 0;

        if (action === ACTIONS.MOVE_UP) dy = -1;
        else if (action === ACTIONS.MOVE_DOWN) dy = 1;
        else if (action === ACTIONS.MOVE_LEFT) dx = -1;
        else if (action === ACTIONS.MOVE_RIGHT) dx = 1;

        if (dx !== 0 || dy !== 0) {
            if (this.player.move(dx, dy, this.grid)) {
                const cell = this.grid.getCell(this.player.x, this.player.y);
                const isDoor = cell && (cell.type.isDoor || cell.type.id === 'EXIT_DOOR');
                if (!isDoor) this.addEffect({ type: 'dust', x: this.player.x - dx, y: this.player.y - dy, rotation: Math.atan2(dy, dx) - Math.PI, startTime: Date.now(), duration: 300 });
                if (cell && cell.type.isDoor) this.handleDoorTraversal(cell);
                else if (cell?.type.id === 'EXIT_DOOR') this.endDay();
            } else {
                const currentCell = this.grid.getCell(this.player.x, this.player.y);
                if (currentCell?.type.isDoor) {
                    const targetX = this.player.x + dx, targetY = this.player.y + dy;
                    if (targetX < 0 || targetX >= this.grid.width || targetY < 0 || targetY >= this.grid.height) this.handleDoorTraversal(currentCell);
                }
            }
            return;
        }

        if (action === ACTIONS.PICK_UP && !event.repeat && !this.pickupActionTriggered) {
            if (this.isViewingOrders) {
                const penalty = this.activeTickets.length * 20;
                this.money -= penalty;
                if (penalty > 0) this.addFloatingText(`Given Up: -$${penalty}`, this.player.x, this.player.y, '#ff0000');
                this.ticketQueue = []; this.activeTickets = []; this.incomingTicket = null;
                this.addFloatingText("Service Terminated", this.player.x, this.player.y, '#ff0000');
            } else this.player.actionPickUp(this.grid, this);
            return;
        }

        if (action === ACTIONS.INTERACT && !event.repeat) {
            const facingCell = this.player.getTargetCell(this.grid);
            if (facingCell?.type.id === 'RENO') {
                this.addFloatingText("Build Mode", this.player.x, this.player.y, '#ffd700');
                this.enterBuildMode();
            } else if (facingCell?.type.id === 'MENU') {
                if (this.isEndgameUnlocked) {
                    this.gameState = 'MENU_CUSTOM';
                } else this.addFloatingText("Locked!", this.player.x, this.player.y, '#ff0000');
            } else if (facingCell?.type.id === 'SERVICE_WINDOW') {
                if (this.isPrepTime) {
                    this.isPrepTime = false; 
                    this.ticketTimer = 10000;
                    this.addFloatingText("Service Started!", this.player.x, this.player.y, '#00ff00');
                }
            } else this.player.actionInteract(this.grid, this);
        }
    }
    
    handleMouseDown(event) {
        if (this.alertSystem?.isVisible) return;
        if (!this.renderer?.canvas) return;

        const rect = this.renderer.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        if (this.gameState === 'TITLE') {
            const centerX = this.renderer.canvas.width / 2;
            const startY = this.renderer.canvas.height / 2 + 30;
            const spacing = 60;

            // Check "New Game"
            if (mouseX > centerX - 150 && mouseX < centerX + 150 &&
                mouseY > startY - 30 && mouseY < startY + 30) {
                this.titleSelection = 0;
                this.startNewGame();
                this.startDay();
                this.gameState = 'PLAYING';
            }
            // Check "Settings"
            else if (mouseX > centerX - 150 && mouseX < centerX + 150 &&
                mouseY > startY + spacing - 30 && mouseY < startY + spacing + 30) {
                this.titleSelection = 1;
                this.gameState = 'SETTINGS';
                this.settingsState = { selectedIndex: 0, rebindingAction: null };
            }
        } else if (this.gameState === 'SETTINGS') {
            const idx = this.getSettingsIndexAt(mouseX, mouseY);
            if (idx !== -1) {
                if (this.settingsState.rebindingAction) {
                    // Currently rebinding, ignore mouse clicks for selection
                    return;
                }
                
                this.settingsState.selectedIndex = idx;
                if (idx < 2) {
                    const pref = idx === 0 ? 'musicEnabled' : 'sfxEnabled';
                    this.settings.preferences[pref] = !this.settings.preferences[pref];
                    this.settings.save();
                    this.audioSystem.updateVolumesFromSettings();
                } else {
                    const keyActions = ['MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT', 'INTERACT', 'PICK_UP', 'VIEW_ORDERS', 'EQUIP_1', 'EQUIP_2', 'EQUIP_3', 'EQUIP_4'];
                    this.settingsState.rebindingAction = keyActions[idx - 2];
                }
            }
        } else if (this.gameState === 'RENO_SHOP') {
            const idx = this.getRenoIndexAt(mouseX, mouseY);
            if (idx !== -1) {
                this.selectedRenoIndex = idx;
                // Simulate Enter key to trigger selection
                this.handleRenoInput({ code: 'Enter' });
            }
        } else if (this.gameState === 'BUILD_MODE' && this.placementState.menu?.active) {
            const menu = this.placementState.menu;
            const idx = this.getBuildMenuIndexAt(mouseX, mouseY, menu);
            if (idx !== -1) {
                menu.selectedIndex = idx;
                this.constructionSystem.handleMenuInput({ code: 'Enter' });
            }
        }
    }

    handleMouseMove(event) {
        if (this.alertSystem?.isVisible) return;
        if (!this.renderer?.canvas) return;
        
        const rect = this.renderer.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        if (this.gameState === 'TITLE') {
            const centerX = this.renderer.canvas.width / 2;
            const startY = this.renderer.canvas.height / 2 + 30;
            const spacing = 60;

            if (mouseX > centerX - 150 && mouseX < centerX + 150) {
                if (mouseY > startY - 30 && mouseY < startY + 30) {
                    this.titleSelection = 0;
                } else if (mouseY > startY + spacing - 30 && mouseY < startY + spacing + 30) {
                    this.titleSelection = 1;
                }
            }
        } else if (this.gameState === 'SETTINGS') {
            const idx = this.getSettingsIndexAt(mouseX, mouseY);
            if (idx !== -1 && !this.settingsState.rebindingAction) {
                this.settingsState.selectedIndex = idx;
            }
        } else if (this.gameState === 'RENO_SHOP') {
            const idx = this.getRenoIndexAt(mouseX, mouseY);
            if (idx !== -1) {
                this.selectedRenoIndex = idx;
            }
        } else if (this.gameState === 'BUILD_MODE' && this.placementState.menu?.active) {
            const menu = this.placementState.menu;
            const idx = this.getBuildMenuIndexAt(mouseX, mouseY, menu);
            if (idx !== -1) {
                menu.selectedIndex = idx;
            }
        }
    }

    getRenoIndexAt(mouseX, mouseY) {
        if (!this.renderer?.canvas) return -1;
        const renoItems = this.shopItems.filter(i => i.type === 'appliance' || i.type === 'action');
        if (renoItems.length === 0) return -1;

        const startY = 120;
        const buttonH = 120;
        const gap = 30;
        const cols = 3;
        const gridSize = 120;
        const gridW = cols * gridSize + (cols - 1) * gap;
        const startX = (this.renderer.canvas.width - gridW) / 2;

        for (let i = 0; i < renoItems.length; i++) {
            let x, y, w, h;
            if (i === 0) {
                x = startX; y = startY; w = gridSize * 2 + gap; h = buttonH;
            } else if (i === 1) {
                x = startX + (gridSize * 2 + gap) + gap; y = startY; w = gridSize; h = buttonH;
            } else {
                const gridIdx = i - 2;
                const col = gridIdx % cols;
                const row = Math.floor(gridIdx / cols);
                x = startX + col * (gridSize + gap);
                y = startY + buttonH + gap + row * (gridSize + gap);
                w = gridSize; h = gridSize;
            }

            if (mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h) return i;
        }
        return -1;
    }

    getBuildMenuIndexAt(mouseX, mouseY, menu) {
        if (!this.renderer) return -1;
        const screenX = this.renderer.offsetX + (menu.x * 64) + 64; 
        const screenY = this.renderer.offsetY + (menu.y * 64);
        
        // Match Renderer.js calculation
        const height = menu.options.length * 30 + 10;
        const width = 200; // Minimum width used in renderer

        if (mouseX > screenX && mouseX < screenX + width &&
            mouseY > screenY && mouseY < screenY + height) {
            const relY = mouseY - screenY - 5;
            const idx = Math.floor(relY / 30);
            if (idx >= 0 && idx < menu.options.length) return idx;
        }
        return -1;
    }

    getSettingsIndexAt(mouseX, mouseY) {
        if (!this.renderer?.canvas) return -1;
        const width = this.renderer.canvas.width;
        if (mouseX < 100 || mouseX > width - 100) return -1;

        // Audio settings start at 140
        let currentY = 140;
        const rowHeight = 40;

        for (let i = 0; i < 2; i++) {
            if (mouseY > currentY - 25 && mouseY < currentY + 15) return i;
            currentY += rowHeight;
        }

        currentY += 60; // Spacer (20) + Header (40)
        for (let i = 0; i < 11; i++) {
            if (mouseY > currentY - 25 && mouseY < currentY + 15) return i + 2;
            currentY += rowHeight;
        }

        return -1;
    }

    handleDoorTraversal(cell) {
        const state = cell.state;

        // Play SFX
        this.audioSystem.playSFX(ASSETS.AUDIO.DOOR);

        if (state && state.targetRoom && state.targetDoorId) {
            const targetRoomId = state.targetRoom;
            const targetDoorId = state.targetDoorId;

            const targetGrid = this.rooms[targetRoomId];
            if (targetGrid) {
                // Find target door in target grid
                let targetX = -1;
                let targetY = -1;

                for (let y = 0; y < targetGrid.height; y++) {
                    for (let x = 0; x < targetGrid.width; x++) {
                        const c = targetGrid.getCell(x, y);
                        // Check state ID match
                        if (c.state && c.state.id === targetDoorId) {
                            targetX = x;
                            targetY = y;
                            break;
                        }
                    }
                    if (targetX !== -1) break;
                }

                if (targetX !== -1) {
                    // TELEPORT PLAYER
                    this.currentRoomId = targetRoomId;
                    this.grid = targetGrid;
                    this.player.x = targetX;
                    this.player.y = targetY;

                    // Automatically step 'off' the door in the direction it faces (or towards center?)
                    // For now, just placing on the door is fine. The move logic handles moving off.
                    // But to prevent immediate re-trigger, we might want to push them 1 tile.
                    // Let's assume Doors are on edges.
                    // If x=0, move Right. If x=width-1, move Left.
                    // If y=0, move Down. If y=height-1, move Up.
                    if (targetX === 0) this.player.x += 1;
                    else if (targetX === targetGrid.width - 1) this.player.x -= 1;
                    else if (targetY === 0) this.player.y += 1;
                    else if (targetY === targetGrid.height - 1) this.player.y -= 1;

                    // Save state
                    this.saveLevel();
                } else {
                    console.error("Target door not found:", targetDoorId);
                }
            } else {
                console.error("Target room not found:", targetRoomId);
            }
        }
    }



    getCurrentTicketInterval(cyclePos) {
        const config = SCORING_CONFIG.GAME_PACING;
        const halfCycle = config.HALF_CYCLE_DURATION;
        const peakWidth = config.PEAK_WIDTH; // Sigma

        // peak times
        const dayPeak = halfCycle * config.DAY_PEAK_TIME_RATIO;
        const nightPeak = halfCycle + (halfCycle * config.NIGHT_PEAK_TIME_RATIO);

        // Gaussian
        const dayIntensity = config.DAY_PEAK_INTENSITY * Math.exp(-Math.pow(cyclePos - dayPeak, 2) / (2 * Math.pow(peakWidth, 2)));
        const nightIntensity = config.NIGHT_PEAK_INTENSITY * Math.exp(-Math.pow(cyclePos - nightPeak, 2) / (2 * Math.pow(peakWidth, 2)));

        const intensity = Math.max(dayIntensity, nightIntensity);

        // Lerp
        // 0 -> SLOW
        // 1 -> FAST
        return config.SLOW_TICKET_INTERVAL - (intensity * (config.SLOW_TICKET_INTERVAL - config.FAST_TICKET_INTERVAL));
    }

    update(dt) {
        if (!dt) return;

        this.updateSystems(dt);
        this.updateWorldState(dt);
        this.updateServiceCycle(dt);
        this.updateAppliances(dt);

        // Dynamically update Office State (Door & Reno Tile)
        this.updateOfficeState();
    }

    updateServiceCycle(dt) {
        if (!this.isDayActive || this.timeFreezeTimer > 0) return;

        // 0. Update Day/Night Cycle (Continuous Loop)
        if (!this.isPrepTime) {
            this.dayTimer += dt / 1000;
            const halfCycle = SCORING_CONFIG.GAME_PACING.HALF_CYCLE_DURATION;
            const fullCycle = halfCycle * 2;
            const cyclePos = this.dayTimer % fullCycle;

            // Calculate Lighting Intensity
            if (cyclePos <= halfCycle) {
                this.lightingIntensity = 0;
                if (this.currentShift !== 'DAY') {
                    this.currentShift = 'DAY';
                    this.shiftCount++;
                    this.automatedRewardSystem.processShiftChange(this.shiftCount);
                }
            } else {
                if (this.currentShift !== 'NIGHT') {
                    this.currentShift = 'NIGHT';
                    this.shiftCount++;
                    this.automatedRewardSystem.processShiftChange(this.shiftCount);
                }
                const nightElapsed = cyclePos - halfCycle;
                const nightProgress = nightElapsed / halfCycle;
                const peakRatio = SCORING_CONFIG.GAME_PACING.NIGHT_PEAK_TIME_RATIO;

                if (nightProgress <= peakRatio) {
                    this.lightingIntensity = nightProgress / peakRatio;
                } else {
                    const remaining = 1.0 - peakRatio;
                    const progressPastPeak = nightProgress - peakRatio;
                    this.lightingIntensity = 1.0 - (progressPastPeak / remaining);
                }
            }

            // Ticket Generation Loop
            this.ticketSpawnTimer += dt / 1000;
            const freq = this.getCurrentTicketInterval(cyclePos);
            this.timeToNextTicket = Math.max(0, freq - this.ticketSpawnTimer);

            if (this.ticketSpawnTimer >= freq) {
                this.ticketSpawnTimer = 0;
                let newTicket;
                if (this.dayNumber === 1 && this.ticketsGeneratedToday < 5) {
                    newTicket = this.orderSystem.generateTutorialTicket(this.ticketsGeneratedToday + 1);
                } else {
                    newTicket = this.orderSystem.createTicketFromCustomers(
                        [this.orderSystem.generateCustomerProfile(this.menuSystem.getMenu())],
                        1
                    );
                    newTicket.calculateParTime();
                }
                this.ticketsGeneratedToday++;
                this.ticketQueue.push(newTicket);
                console.log("New Ticket Generated via Continuous Spawner");
            }
        }

        // Ticket Arrival Logic
        if (this.isPrepTime) {
            this.prepTime -= dt / 1000;
            if (this.prepTime <= 0) {
                this.isPrepTime = false;
                this.prepTime = 0;
                this.ticketTimer = 10000;
                console.log("Prep Time Over! Service starting...");
            }
        } else {
            this.ticketTimer += dt;
        }

        // 1. Check if we can start a new print
        if (this.ticketTimer >= 2000 && !this.incomingTicket && this.ticketQueue.length > 0) {
            this.ticketTimer = 0;
            this.incomingTicket = this.ticketQueue.shift();
            this.printingTimer = 0;

            if (this.incomingTicket.chuteDrop && this.incomingTicket.chuteDrop.length > 0) {
                this.incomingTicket.chuteDrop.forEach(itemId => {
                    this.dropInChute(new ItemInstance(itemId));
                });
            }

            // Printer logic removed, handled by new hanging tickets in Renderer.
            this.audioSystem.playSFX(ASSETS.AUDIO.PRINTER);

            if (!this.testAlertShown) {
                this.alertSystem.trigger('test_alert');
                this.testAlertShown = true;
            }
            console.log("Ticket started printing...");
        }

        // 2. Handle Printing Process -> Arrival on Wheel
        if (this.incomingTicket) {
            this.printingTimer += dt;
            if (this.printingTimer >= 2250) {
                this.activeTickets.push(this.incomingTicket);
                this.serviceTimer += this.incomingTicket.parTime;
                this.orders = this.activeTickets.map(t => t.toDisplayFormat());
                console.log("Ticket arrived on wheel!");
                this.incomingTicket = null;
            }
        }

        this.activeTickets.forEach(t => t.elapsedTime += dt / 1000);

        // Stability Logic
        if (this.activeTickets.length > 0) {
            let drainRate = 0;
            const count = this.activeTickets.length;
            if (count <= 1) drainRate = 0.2;
            else if (count === 2) drainRate = 0.6;
            else if (count === 3) drainRate = 1.0;
            else drainRate = 2.0 + (count - 4);

            if (this.timeFreezeTimer <= 0) {
                this.stability -= (drainRate * (dt / 1000));
            }

            if (this.stability <= 0 && !this.timeoutAlertShown) {
                this.timeoutAlertShown = true;
                this.currentDayPerfect = false;
                this.alertSystem.trigger('ticket_timeout');
            }
        } else if (this.ticketQueue.length > 0) {
            this.stability = Math.min(this.stability + (5 * (dt / 1000)), 100);
        } else {
            this.stability = Math.min(this.stability + (10 * (dt / 1000)), 100);
        }
    }

    updateAppliances(dt) {
        Object.values(this.rooms).forEach(room => {
            if (!room) return;
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);
                    if (!cell) continue;

                    // Grill Logic
                    if (cell.type.id === 'GRILL') {
                        const item = cell.object;
                        if (item && item.definition.cooking && item.definition.cooking.stages) {
                            const currentStage = item.state.cook_level || 'raw';
                            const stageDef = item.definition.cooking.stages[currentStage];
                            if (stageDef && this.timeFreezeTimer <= 0) {
                                item.state.cookingProgress = (item.state.cookingProgress || 0) + dt;
                                const requiredTime = stageDef.duration || cell.state.cookingSpeed || 2000;
                                if (item.state.cookingProgress >= requiredTime) {
                                    item.state.cook_level = stageDef.next;
                                    item.state.cookingProgress = 0;
                                }
                            }
                        }
                    }

                    // Fryer Logic
                    if (cell.type.id === 'FRYER' && cell.state) {
                        if (cell.state.status === 'down' && this.timeFreezeTimer <= 0) {
                            cell.state.timer = (cell.state.timer || 0) + dt;
                            let max = cell.state.cookingSpeed || 2000;
                            if (cell.object && cell.object.definition && cell.object.definition.cooking) {
                                const stage = cell.object.state.cook_level || 'raw';
                                const stageDef = cell.object.definition.cooking.stages[stage];
                                if (stageDef && stageDef.duration) max = stageDef.duration;
                            }
                            if (cell.state.timer >= max) {
                                cell.state.status = 'done';
                                cell.state.timer = 0;
                            }
                        }
                        const item = cell.object;
                        if (item && item.definition.cooking && item.definition.cooking.stages) {
                            const currentStage = item.state.cook_level || 'raw';
                            const stageDef = item.definition.cooking.stages[currentStage];
                            if (stageDef && stageDef.cookMethod === 'fry' && this.timeFreezeTimer <= 0) {
                                item.state.cookingProgress = (item.state.cookingProgress || 0) + dt;
                                const requiredTime = stageDef.duration || 2000;
                                if (item.state.cookingProgress >= requiredTime) {
                                    item.state.cook_level = stageDef.next;
                                    item.state.cookingProgress = 0;
                                }
                            }
                        }
                    }

                    // Dishwasher Logic
                    if (cell.type.id === 'DISHWASHER' && cell.state) {
                        if (cell.state.status === 'washing' && this.timeFreezeTimer <= 0) {
                            cell.state.timer = (cell.state.timer || 0) - dt;
                            if (cell.state.timer <= 0) {
                                const count = cell.state.dishCount || 0;
                                cell.state.status = 'idle';
                                cell.state.dishCount = 0;
                                cell.state.timer = 0;
                                cell.state.isOpen = true;
                                const cleanRack = new ItemInstance('dish_rack');
                                cleanRack.state.contents = Array.from({ length: count }, () => new ItemInstance('plate'));
                                cell.object = cleanRack;
                            }
                        }
                    }

                    // Soda Fountain Logic
                    if (cell.type.id === 'SODA_FOUNTAIN' && cell.state) {
                        if (cell.state.status === 'filling' && this.timeFreezeTimer <= 0) {
                            cell.state.timer = (cell.state.timer || 0) + dt;
                            const max = cell.state.fillDuration || 3000;
                            if (cell.state.timer >= max) {
                                cell.state.status = 'done';
                                cell.state.timer = 0;
                            }
                        }
                    }
                    if (cell.object && (cell.object.definitionId === 'soda_fountain' || cell.object.tileType === 'SODA_FOUNTAIN')) {
                        const obj = cell.object;
                        if (obj.state && obj.state.status === 'filling') {
                            obj.state.timer = (obj.state.timer || 0) + dt;
                            const max = obj.state.fillDuration || 3000;
                            if (obj.state.timer >= max) {
                                obj.state.status = 'done';
                                obj.state.timer = 0;
                            }
                        }
                    }

                    // Service Counter Logic
                    if (cell.type.id === 'SERVICE' && cell.object && (cell.object.definitionId === 'bag' || cell.object.definitionId === 'magic_bag' || cell.object.definitionId === 'plate')) {
                        if (this.activeTickets.length > 0) {
                            let matchedTicketIndex = -1;
                            let matchResult = null;
                            for (let i = 0; i < this.activeTickets.length; i++) {
                                const t = this.activeTickets[i];
                                const res = t.verifyContainerItem(cell.object);
                                if (res.matched) {
                                    matchedTicketIndex = i;
                                    matchResult = res;
                                    break;
                                }
                            }

                            if (matchedTicketIndex !== -1) {
                                const ticket = this.activeTickets[matchedTicketIndex];
                                this.money += matchResult.payout;
                                this.dailyMoneyEarned += matchResult.payout;
                                this.dailyBagsSold++;
                                cell.object = null;

                                if (ticket.isComplete()) {
                                    this.powerupSystem.resumeTime();
                                    const isDineIn = ticket.groups.some(g => g.containerType === 'plate');
                                    if (isDineIn) {
                                        this.pendingDirtyPlates.push({ timer: 3000, x: 12, y: 0 });
                                    }
                                    const par = ticket.parTime;
                                    const elapsed = ticket.elapsedTime;
                                    const diff = par - elapsed;
                                    let bonus = 0, message = "", color = "#fff";

                                    if (diff >= SCORING_CONFIG.THRESHOLDS.BONUS) {
                                        bonus = SCORING_CONFIG.REWARDS.BONUS;
                                        message = "GREAT SPEED! BONUS!";
                                        color = "#00ff00";
                                    } else if (diff >= 0) {
                                        bonus = SCORING_CONFIG.REWARDS.PAR;
                                        message = "ON TIME";
                                        color = "#ffff00";
                                    } else {
                                        bonus = SCORING_CONFIG.REWARDS.SLOW;
                                        message = "SERVED";
                                        color = "#ffffff";
                                    }

                                    this.money += bonus;
                                    this.dailyMoneyEarned += bonus;
                                    this.addFloatingText(message + ` ($${bonus})`, x, y, color);
                                    this.stability = Math.min(this.stability + par, 100);
                                    this.addFloatingText(`Stability +${Math.round(par)}%`, x, y - 1, '#00ffff');
                                    this.sessionTickets++;
                                    if (this.sessionTickets > this.highScore) {
                                        this.highScore = this.sessionTickets;
                                        localStorage.setItem('burger_joint_highscore', this.highScore);
                                        if (this.sessionTickets > 1) this.addFloatingText("NEW HIGH SCORE!", x, y - 2, '#ffcc00');
                                    }
                                    this.activeTickets.splice(matchedTicketIndex, 1);
                                    this.orders = this.activeTickets.map(t => t.toDisplayFormat());
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    updateSystems(dt) {
        this.powerupSystem.update(dt);
        this.alertSystem.update(dt);
    }

    updateWorldState(dt) {
        // Process pending dirty plates
        if (this.pendingDirtyPlates && this.pendingDirtyPlates.length > 0) {
            this.pendingDirtyPlates = this.pendingDirtyPlates.filter(p => {
                p.timer -= dt;
                if (p.timer <= 0) {
                    this.spawnDirtyPlate(p.x, p.y);
                    return false;
                }
                return true;
            });
        }

        if (this.timeFreezeTimer > 0 && !this.timeFreezeManual) {
            this.timeFreezeTimer = Math.max(0, this.timeFreezeTimer - dt);
        }

        this.updateFallingBoxes(dt);

        // Tutorials
        const isHoldingPattyBox = this.player.heldItem && (this.player.heldItem.definitionId === 'patty_box');
        if (isHoldingPattyBox && !this.pattyBoxTutorialShown) {
            this.pattyBoxTutorialShown = true;
            this.alertSystem.trigger('container_tutorial_1');
            this.saveLevel();
        }

        // UI State
        const viewKey = this.settings.getBinding(ACTIONS.VIEW_ORDERS);
        this.isViewingOrders = !!(this.keys && this.keys[viewKey]);

        // Feedback & Effects
        this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
        this.floatingTexts.forEach(ft => ft.life -= dt / 1000);

        if (this.effects) {
            this.effects = this.effects.filter(e => (Date.now() - e.startTime) < e.duration);
        }
    }

    updateFallingBoxes(dt) {
        if (!this.fallingBoxes || this.fallingBoxes.length === 0) return;

        const gravity = 0.00001;
        const groundY = 9;
        const stackOffset = 0.37; // Adjusted for tight overlap

        // Chute is always in 'main' kitchen
        const kitchen = this.rooms['main'];
        if (!kitchen) return;

        const landingCell = kitchen.getCell(0, 9);
        const isLandingOccupied = landingCell ? !!landingCell.object : false;

        for (let i = 0; i < this.fallingBoxes.length; i++) {
            const box = this.fallingBoxes[i];

            // Calculate target Y based on stack position
            let limitY = groundY;
            if (i > 0) {
                limitY = this.fallingBoxes[i - 1].y - stackOffset;
            } else if (isLandingOccupied) {
                limitY = groundY - stackOffset;
            }

            if (box.y < limitY) {
                box.vy += gravity * dt;
                box.y += box.vy * dt;

                if (box.y >= limitY) {
                    box.y = limitY;
                    box.vy = 0;
                }
            } else if (box.y > limitY) {
                // Adjust if box below moved down
                box.y = limitY;
                box.vy = 0;
            }
        }

        // Potential landing: Move box 0 to grid if it's at groundY and grid is clear
        if (this.fallingBoxes.length > 0) {
            const firstBox = this.fallingBoxes[0];
            // Allow a small epsilon for float comparison
            if (firstBox.y >= groundY - 0.01 && !isLandingOccupied) {
                if (landingCell) {
                    landingCell.object = firstBox.item;
                    this.fallingBoxes.shift();
                }
            }
        }
    }

    triggerChute(triggerId, data = null) {
        const trigger = CHUTE_TRIGGERS.find(t => t.id === triggerId);
        if (!trigger) {
            console.warn(`Chute trigger '${triggerId}' not found.`);
            return;
        }

        if (trigger.condition && !trigger.condition(this, data)) {
            return;
        }

        const itemsToDrop = trigger.getItems(this, data);
        if (!itemsToDrop || itemsToDrop.length === 0) return;

        console.log(`Chute Triggered: ${triggerId}. Dropping ${itemsToDrop.length} items.`);

        itemsToDrop.forEach(order => {
            for (let i = 0; i < (order.qty || 1); i++) {
                const instance = new ItemInstance(order.id);
                if (order.id === 'insert') instance.state.count = 3;
                this.dropInChute(instance);
            }
        });
    }

    dropInChute(itemInstance) {
        if (!this.fallingBoxes) this.fallingBoxes = [];
        this.fallingBoxes.push({
            x: 0,
            y: -1 - this.fallingBoxes.length,
            vy: 0,
            item: itemInstance
        });
    }

    updateOfficeState() {
        const hasActiveOrders = (this.activeTickets.length > 0) ||
            (this.ticketQueue.length > 0) ||
            (this.incomingTicket != null);

        // 1. Office Door Logic: (Removed per user request)

        // 2. Reno Tile Logic: Locked if active orders
        const officeRoom = this.rooms['office'];
        if (officeRoom) {
            // Reno tile is at (1, 0) by default definition, but let's scan or check (1,0)
            const cell = officeRoom.getCell(1, 0);
            if (cell && (cell.type.id === 'RENO' || cell.type.id === 'RENO_LOCKED')) {
                const desiredType = hasActiveOrders ? TILE_TYPES.RENO_LOCKED : TILE_TYPES.RENO;
                if (cell.type.id !== desiredType.id) {
                    cell.type = desiredType;
                }
            }
        }
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (this.renderer) {
            if (this.gameState === 'TITLE') {
                this.renderer.renderTitleScreen(this.titleSelection);
            } else if (this.gameState === 'SETTINGS') {
                this.renderer.renderSettingsMenu(this.settingsState, this.settings);
            } else if (this.gameState === 'BUILD_MODE') {
                // Special Render for Build Mode (hides player)
                this.renderer.render({
                    grid: this.grid,
                    player: null,
                    placementState: this.placementState,
                    gameState: this.gameState,
                    shopItems: this.shopItems,
                    money: this.money,
                    dayNumber: this.dayNumber
                });
                this.renderer.renderPlacementCursor(this.placementState);
                if (this.placementState.menu) {
                    this.renderer.renderBuildMenu(this.placementState.menu);
                }
            } else {
                // Standard Game Render (PLAYING, and all Overlay Menus)
                if (this.gameState === 'PLAYING' || this.gameState === 'APPLIANCE_SWAP') {
                    if (this.gameState === 'PLAYING') {
                        if (this.alertSystem && this.alertSystem.isVisible) {
                            // Paused for alert - still update alert animation
                            this.alertSystem.update(dt);
                        } else {
                            this.update(dt);
                        }
                    }
                    // After Hours Interaction Check
                    // "after the resturant closes, the player gets a new ability"
                    // Condition: Queue Finished (After Hours)
                    // Note: isDayActive is false here, so we only check queueFinishedTime
                    if (true) { // Restriction removed: Allow appliance interaction anytime
                        const pickUpKeys = [this.settings.getBinding(ACTIONS.PICK_UP), 'Space'];
                        const interactKey = this.settings.getBinding(ACTIONS.INTERACT);

                        // 1. Pickup Appliance Check
                        const isPickupHeld = Object.keys(this.keys || {}).some(k => this.keys[k] && (k === pickUpKeys[0] || k === 'Space'));

                        if (isPickupHeld) {
                            this.pickupKeyHeldDuration = (this.pickupKeyHeldDuration || 0) + dt;
                            if (this.pickupKeyHeldDuration >= 500 && !this.pickupActionTriggered) {
                                console.log("Triggering Appliance Pickup!");
                                this.player.actionPickUpAppliance(this.grid, this);
                                this.pickupActionTriggered = true;
                            }
                        } else {
                            this.pickupKeyHeldDuration = 0;
                            this.pickupActionTriggered = false;
                        }

                        // 2. Change Appliance Check (Swap)
                        const isInteractHeld = this.keys && this.keys[interactKey];
                        if (isInteractHeld) {
                            this.interactKeyHeldDuration = (this.interactKeyHeldDuration || 0) + dt;
                            if (this.interactKeyHeldDuration >= 500 && !this.swappingActionTriggered && this.gameState === 'PLAYING') {
                                console.log("Triggering Appliance Swap!");
                                this.initiateApplianceSwap();
                                this.swappingActionTriggered = true;
                            }
                        } else {
                            this.interactKeyHeldDuration = 0;
                            this.swappingActionTriggered = false;
                        }

                        // Clear waiting flag if in SWAP mode and key released
                        if (this.gameState === 'APPLIANCE_SWAP' && this.swappingState && this.swappingState.waitingForRelease) {
                            if (!isInteractHeld) {
                                this.swappingState.waitingForRelease = false;
                            }
                        }
                    }
                }
                this.renderer.render(this);
            }
        }
        requestAnimationFrame((t) => this.loop(t));
    }

    initiateApplianceSwap() {
        const grid = this.rooms[this.currentRoomId];
        const targetX = this.player.x + this.player.facing.x;
        const targetY = this.player.y + this.player.facing.y;
        const cell = grid.getCell(targetX, targetY);

        if (!cell) return;

        // Restriction: Cannot swap if there is an item on top
        if (cell.object) {
            this.addFloatingText("Remove item first!", targetX, targetY, '#ff0000');
            return;
        }

        // Define cyclable appliance types
        const cyclable = [
            'COUNTER',
            'CUTTING_BOARD',
            'FRYER',
            'GRILL',
            'DISHWASHER'
        ];

        if (cyclable.includes(cell.type.id)) {
            this.gameState = 'APPLIANCE_SWAP';
            this.swappingState = {
                x: targetX,
                y: targetY,
                options: cyclable,
                currentIndex: cyclable.indexOf(cell.type.id),
                waitingForRelease: true
            };

            // Add visual feedback?
            this.addFloatingText("Swap Mode!", targetX, targetY, '#ffff00');
        }
    }

    handleApplianceSwapInput(event) {
        if (!this.swappingState) {
            this.gameState = 'PLAYING';
            return;
        }

        const LEFT = this.settings.getBinding(ACTIONS.MOVE_LEFT);
        const RIGHT = this.settings.getBinding(ACTIONS.MOVE_RIGHT);
        const INTERACT = this.settings.getBinding(ACTIONS.INTERACT);

        const isLeft = event.code === LEFT || event.code === 'ArrowLeft';
        const isRight = event.code === RIGHT || event.code === 'ArrowRight';
        const isSet = event.code === INTERACT || event.code === 'Enter';

        if (event.type === 'keydown') {
            if (isLeft || isRight) {
                let idx = this.swappingState.currentIndex;
                if (isLeft) idx--;
                else idx++;

                // Wrap
                if (idx < 0) idx = this.swappingState.options.length - 1;
                if (idx >= this.swappingState.options.length) idx = 0;

                this.swappingState.currentIndex = idx;

                // Apply Immediately
                const newTypeId = this.swappingState.options[idx];
                const grid = this.rooms[this.currentRoomId];

                // Let's safe set:
                const newType = TILE_TYPES[newTypeId];
                if (newType) {
                    grid.setTileType(this.swappingState.x, this.swappingState.y, newType);
                    this.updateCapabilities();
                }
            } else if (isSet) {
                // Prevent immediate set if holding from initiation
                if (this.swappingState.waitingForRelease) return;

                // Confirm and Exit
                this.gameState = 'PLAYING';
                this.swappingState = null;
                this.addFloatingText("Set!", this.player.x, this.player.y, '#00ff00');
            }

        }
    }

    spawnDirtyPlate(x, y) {
        const grid = this.rooms['main'];
        if (!grid) return;

        // Define the spots to try if this is the dirty plate return area (index 12 is column 13)
        const spots = (x === 12 && y === 0) ? [
            { x: 12, y: 0 },
            { x: 13, y: 0 },
            { x: 14, y: 0 }
        ] : [{ x, y }];

        // Dirty parts to choose from (shared across all attempts)
        const partPool = [
            'plates/plate-dirty-part1.png',
            'plates/plate-dirty-part2.png',
            'plates/plate-dirty-part3.png'
        ];
        const shuffled = [...partPool].sort(() => 0.5 - Math.random());
        const chosen = shuffled.slice(0, 2);
        const layers = chosen.map(texture => ({
            texture: texture,
            rotation: Math.random() * Math.PI * 2
        }));

        for (const spot of spots) {
            const cell = grid.getCell(spot.x, spot.y);
            if (!cell || !cell.type.holdsItems) continue;

            // 1. Check if it's a dish rack
            if (cell.object && cell.object.definitionId === 'dish_rack') {
                const rack = cell.object;
                if (!rack.state.contents) rack.state.contents = [];
                // Block mixing: Cannot put dirty plates in a clean rack
                const isClean = rack.state.contents.length > 0 && rack.state.contents[0].definitionId !== 'dirty_plate';
                if (!isClean && rack.state.contents.length < 6) {
                    const item = new ItemInstance('dirty_plate');
                    item.state.count = 1;
                    item.state.dirtyLayers = layers;
                    rack.state.contents.push(item);
                    console.log(`Auto-added dirty plate to rack at (${spot.x}, ${spot.y})`);
                    return;
                }
            }

            // 2. Check if a dirty plate stack already exists at this spot
            if (cell.object && cell.object.definitionId === 'dirty_plate') {
                cell.object.state.count = (cell.object.state.count || 1) + 1;
                cell.object.state.dirtyLayers = layers; // Update top look
                console.log(`Stacked dirty plate onto existing stack at (${spot.x}, ${spot.y})`);
                return;
            }

            // 3. Check if it's free
            if (!cell.object) {
                const item = new ItemInstance('dirty_plate');
                item.state.count = 1;
                item.state.dirtyLayers = layers;
                cell.object = item;
                console.log(`Spawned new dirty plate at (${spot.x}, ${spot.y})`);
                return;
            }
        }
    }

    saveLevel() {
        try {
            const saveData = {
                version: 5,
                currentRoomId: this.currentRoomId,
                player: {
                    x: this.player.x,
                    y: this.player.y,
                    facing: this.player.facing,
                    currentTool: this.player.currentTool,
                    heldItem: this.player.heldItem ? this.player.heldItem.serialize() : null
                },
                // Removed dayDuration
                // Save Unlocks
                unlockedItems: this.shopItems.filter(i => i.unlocked).map(i => i.id),
                storage: this.storage,
                money: this.money,
                appliedExpansions: Array.from(this.appliedExpansions),
                autoUpgradedAppliances: Array.from(this.autoUpgradedAppliances),
                pendingOrders: this.pendingOrders,
                pattyBoxTutorialShown: this.pattyBoxTutorialShown,
                unlockMiniGameShown: this.unlockMiniGameShown,
                rooms: {}
            };

            for (const [id, grid] of Object.entries(this.rooms)) {
                saveData.rooms[id] = grid.serialize();
            }

            localStorage.setItem('burger_joint_save_v5', JSON.stringify(saveData));
            console.log('Game saved (v5).');
        } catch (e) {
            console.error('Failed to save level:', e);
        }
    }

    loadLevel() {
        try {
            const json = localStorage.getItem('burger_joint_save_v5');
            if (!json) return false;

            const data = JSON.parse(json);

            // Restore Rooms
            this.rooms = {};
            for (const [id, gridData] of Object.entries(data.rooms)) {
                const grid = new Grid(gridData.width, gridData.height);
                grid.deserialize(gridData);
                this.rooms[id] = grid;
            }

            // Restore State
            this.currentRoomId = data.currentRoomId || 'main';
            this.grid = this.rooms[this.currentRoomId];

            if (!this.grid) {
                console.error(`Saved room '${this.currentRoomId}' not found!`);
                // Fallback
                this.currentRoomId = Object.keys(this.rooms)[0];
                this.grid = this.rooms[this.currentRoomId];
            }

            // Restore Player
            if (data.player) {
                this.player.x = data.player.x;
                this.player.y = data.player.y;
                if (data.player.facing) this.player.facing = data.player.facing;

                // Restore Tool (before held item to avoid equip checks blocking)
                if (data.player.currentTool) {
                    this.player.equip(data.player.currentTool);
                }

                // Restore Held Item
                if (data.player.heldItem) {
                    this.player.heldItem = ItemInstance.deserialize(data.player.heldItem);
                }
            }

            // Restore Global Settings
            // Removed dayDuration restore

            if (data.unlockedItems) {
                data.unlockedItems.forEach(id => {
                    const item = this.shopItems.find(i => i.id === id);
                    if (item) item.unlocked = true;
                });
            }

            if (data.storage) {
                this.storage = data.storage;
            } else {
                this.storage = {};
            }

            if (data.pendingOrders) {
                this.pendingOrders = data.pendingOrders;
            } else {
                this.pendingOrders = [];
            }

            if (Array.isArray(data.appliedExpansions)) {
                this.appliedExpansions = new Set(data.appliedExpansions);
            }
            if (Array.isArray(data.autoUpgradedAppliances)) {
                this.autoUpgradedAppliances = new Set(data.autoUpgradedAppliances);
            }
            if (typeof data.pattyBoxTutorialShown === 'boolean') {
                this.pattyBoxTutorialShown = data.pattyBoxTutorialShown;
            }
            if (typeof data.unlockMiniGameShown === 'boolean') {
                this.unlockMiniGameShown = data.unlockMiniGameShown;
            }

            // Re-sort shop items
            this.sortShopItems();

            this.updateCapabilities();
            return true;
        } catch (e) {
            console.error('Failed to load level:', e);
        }
        return false;
    }


    addFloatingText(text, gridX, gridY, color = '#fff') {
        // Convert grid coords to pixel coords estimation or store grid coords and let renderer handle it
        // Renderer handles Grid -> Pixel if we pass it correctly. 
        // Let's pass grid coords and let renderer project them.
        this.floatingTexts.push({
            text: text,
            x: gridX,
            y: gridY,
            color: color,
            life: 2.0 // seconds
        });
    }

    // handleComputerInput(event) {
    //    if (result === 'START_DAY') {
    //        this.startDay();
    //    }
    // }



    handleRenoInput(event) {
        this.constructionSystem.handleRenoInput(event);
    }

    addEffect(effect) {
        this.effects.push(effect);
    }

    hasAppliance(itemId, tileTypeId) {
        if (this.storage[itemId] > 0) return true;
        for (const room of Object.values(this.rooms)) {
            if (!room) continue;
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);
                    if (tileTypeId && cell.type?.id === tileTypeId) return true;
                    if (cell.object?.definitionId === itemId) return true;
                }
            }
        }
        return false;
    }

    sortShopItems() {
        this.shopItems.sort((a, b) => {
            const getRank = (item) => {
                if (item.type === 'action') return 0;
                if (item.type === 'appliance') return 1;
                if (item.unlocked) {
                    if (item.id === 'bun_box') return 2.1;
                    if (item.id === 'patty_box') return 2.2;
                    return 2.5;
                }
                return 3;
            };
            return getRank(a) - getRank(b);
        });
    }
}

import { ASSETS, TILE_TYPES, GRID_WIDTH, GRID_HEIGHT } from './constants.js';
import { CAPABILITY, DEFINITIONS } from './data/definitions.js';
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
import { ShopSystem } from './systems/ShopSystem.js';
import { ConstructionSystem } from './systems/ConstructionSystem.js';
import { MenuSystem } from './systems/MenuSystem.js';
import { PostDaySystem } from './systems/PostDaySystem.js';
import { TouchInputSystem } from './systems/TouchInputSystem.js';

import { RatingPopup } from './ui/RatingPopup.js';

export class Game {
    constructor() {
        this.assetLoader = new AssetLoader();
        this.grid = new Grid(GRID_WIDTH, GRID_HEIGHT);
        this.renderer = null;
        this.player = new Player(4, 4);

        this.postDaySystem = new PostDaySystem(this);
        this.ratingPopup = new RatingPopup(this);
        this.settings = new Settings();
        this.audioSystem = new AudioSystem(this.settings);

        // Systems
        this.shopSystem = new ShopSystem(this);
        this.constructionSystem = new ConstructionSystem(this);
        this.menuSystem = new MenuSystem(this);
        this.touchInputSystem = new TouchInputSystem(this);

        this.gameState = 'TITLE'; // TITLE, PLAYING, PLACEMENT, SETTINGS
        this.titleSelection = 0; // 0: New Game, 1: Settings
        this.settingsState = {
            selectedIndex: 0,
            rebindingAction: null
        };

        // Bind input handler
        window.addEventListener('keydown', this.handleInput.bind(this));
        window.addEventListener('keyup', (e) => {
            if (this.keys) this.keys[e.code] = false;
        });

        this.keys = {};
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
        this.activeTicketIndex = 0;

        // Economy & Day Cycle
        this.money = 0;
        // Economy & Day Cycle
        this.money = 0;
        this.isDayActive = false;

        // Visual Feedback
        this.floatingTexts = [];

        // Ordering System
        this.shopItems = [];
        this.pendingOrders = []; // Store for items ordered at night for morning delivery

        // Daily Stats
        this.dailyMoneyEarned = 0;
        this.dailyBagsSold = 0;


        // 1. Supplies (Dynamic from DEFINITIONS)
        Object.keys(DEFINITIONS).forEach(defId => {
            const def = DEFINITIONS[defId];
            if (def.type === 'Box' && def.price) {
                // Determine 'unlocked' status based on explicit flag or default
                // Essential items are always unlocked
                const essentialItems = ['patty_box', 'bun_box', 'wrapper_box', 'bag_box'];
                const isEssential = essentialItems.includes(defId);

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

                        // Check for variants (fryContent)
                        if (prod.fryContent) isRewardItem = true;
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
            { id: 'dispenser', price: SCORING_CONFIG.PRICES.dispenser, type: 'appliance', unlocked: true, tileType: 'DISPENSER', uiAsset: 'RENO_ICON_DISPENSER' },
            { id: 'fryer', price: SCORING_CONFIG.PRICES.fryer, type: 'appliance', unlocked: true, tileType: 'FRYER', uiAsset: 'RENO_ICON_FRYER' },
            { id: 'soda_fountain', price: SCORING_CONFIG.PRICES.soda_fountain, type: 'appliance', unlocked: true, tileType: 'SODA_FOUNTAIN', uiAsset: 'RENO_ICON_SODA_FOUNTAIN' },
            { id: 'stove', price: SCORING_CONFIG.PRICES.stove, type: 'appliance', unlocked: true, tileType: 'STOVE' },
        ];

        // Add manual items (Inserts)
        this.shopItems.push({
            id: 'insert',
            price: 20, // Manual price as it's not a box
            type: 'supply',
            unlocked: false,
            isEssential: false
        });

        this.shopItems = [...this.shopItems, ...appliancesAndActions];

        // Cart for current order: { itemId: quantity }
        this.cart = {};
        this.shopItems.forEach(item => this.cart[item.id] = 0);

        this.selectedOrderItemIndex = 0;


        // Placement State (Delegated to ConstructionSystem via getter)
        // this.placementState = { ... };

        // Capabilities
        this.capabilities = new Set();

        // Progression
        this.earnedServiceStar = false; // Star 3 (Performance)
        this.currentDayPerfect = true;

        this.storage = {}; // Store for unplaced appliances: { 'counter': 2, 'fryer': 1 }

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
        });

        // Manual Dependencies for Complex Items (Machine assembled)
        // 'soda' is now handled by def.result in soda_syrup
        this.itemDependencyMap['fries'] = 'fry_bag';
        this.itemDependencyMap['fried_onion'] = 'onion_box';
        this.itemDependencyMap['onion_rings'] = 'onion_box';

        this.allowedOrderItems = new Set();
    }

    // Proxy getters/setters for compatibility with Renderer and legacy code
    get placementState() { return this.constructionSystem.state; }
    set placementState(v) { this.constructionSystem.state = v; }

    get selectedRenoIndex() { return this.shopSystem.selectedRenoIndex; }
    set selectedRenoIndex(v) { this.shopSystem.selectedRenoIndex = v; }

    get selectedComputerItemId() { return this.shopSystem.selectedComputerItemId; }
    set selectedComputerItemId(v) { this.shopSystem.selectedComputerItemId = v; }

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

    getInventoryCount(itemId) {
        return this.shopSystem.getInventoryCount(itemId);
    }

    expandKitchen() {
        console.log("Expanding Kitchen!");
        const currentGrid = this.rooms['main'];

        // Insert a row one from the bottom and a column one from the right
        const colIndex = currentGrid.width - 1;
        const rowIndex = currentGrid.height - 1;

        currentGrid.expandInterior(colIndex, rowIndex);

        // Visual Feedback
        this.addFloatingText("Kitchen Expanded!", this.player.x, this.player.y, '#ffff00');

        // Save
        this.saveLevel();
    }


    grantDailyReward(itemDef) {
        console.log(`Granting reward item: ${itemDef.id}`);

        // 1. Find corresponding shop item to update status
        const shopItem = this.shopItems.find(i => i.id === itemDef.id);

        if (shopItem) {
            console.log(`Unlocking/Granting Reward Item: ${shopItem.id}`);
            shopItem.unlocked = true;
            shopItem.justUnlocked = true;

            // Give Free Box (Add to Cart + Credits)
            this.cart[shopItem.id] = (this.cart[shopItem.id] || 0) + 1;
            this.money += shopItem.price; // Reimburse cost effectively
        }

        // 2. Determine Category for Menu Update Logic
        // We re-evaluate the category based on the item properties to decide how to update the menu.
        let categoryIndex = -1; // 0=Topping, 1=Side, 2=Drink

        // Resolve produced item
        let producedDef = itemDef;
        if (itemDef.produces) {
            producedDef = DEFINITIONS[itemDef.produces];
        }

        if (producedDef) {
            // Resolve Slicing/Process
            if (producedDef.slicing && producedDef.slicing.result) {
                producedDef = DEFINITIONS[producedDef.slicing.result];
            } else if (producedDef.process && producedDef.process.result) {
                producedDef = DEFINITIONS[producedDef.process.result];
            }

            if (producedDef.isTopping === true || producedDef.category === 'topping' || producedDef.type === 'SauceContainer') {
                categoryIndex = 0;
            } else if ((producedDef.orderConfig && producedDef.orderConfig.type === 'side') || itemDef.id === 'fry_box' || producedDef.fryContent) {
                // fry_box -> fry_bag -> raw_fries -> fries (side)
                categoryIndex = 1;
            } else if (producedDef.category === 'syrup' || (producedDef.orderConfig && producedDef.orderConfig.type === 'drink')) {
                categoryIndex = 2;
            }
        }

        // Update Menu (Specific to Topping -> Plain Burger)
        if (categoryIndex === 0) {
            // Identify the topping ID
            let toppingId = null;
            let pDef = itemDef.produces ? DEFINITIONS[itemDef.produces] : itemDef;
            if (pDef.slicing && pDef.slicing.result) {
                toppingId = pDef.slicing.result;
            } else if (pDef.process && pDef.process.result) {
                toppingId = pDef.process.result;
            } else if (pDef.type === 'SauceContainer' || pDef.category === 'sauce_refill') {
                const potentialId = pDef.id.replace('_bag', '');
                toppingId = DEFINITIONS[potentialId] ? potentialId : pDef.id;
            } else {
                toppingId = pDef.id;
            }

            // Add to Plain Burger (Index 0)
            const plainSlot = this.menuSystem.menuSlots[0];
            if (plainSlot && toppingId) {
                // Check if already there
                // Check if already there and clean up any potential duplicates (especially "required" ones that shouldn't be there)
                // Filter out any existing instances of this topping to ensure we start fresh
                plainSlot.state.toppings = plainSlot.state.toppings.filter(t => t.definitionId !== toppingId);

                // Add as optional
                plainSlot.state.toppings.push({ definitionId: toppingId, optional: true });
                console.log(`Added ${toppingId} to Plain Burger (Optional)`);
            }
        } else {
            // For Sides and Drinks
            let itemId = null;
            let pDef = itemDef.produces ? DEFINITIONS[itemDef.produces] : itemDef;

            // For syrup -> drink logic
            if (pDef.category === 'syrup' && pDef.result) {
                itemId = pDef.result;
            } else if (pDef.process && pDef.process.result) {
                if (pDef.result) itemId = pDef.result;
                else itemId = pDef.id;
            } else if (pDef.fryContent) {
                // Resolve fry content (Bag -> Raw -> Cooked)
                const rawDef = DEFINITIONS[pDef.fryContent];
                if (rawDef && rawDef.result) {
                    itemId = rawDef.result;
                } else {
                    itemId = pDef.id;
                }
            } else {
                itemId = pDef.id;
            }

            if (categoryIndex === 1) { // Side
                if (itemDef.id === 'fry_box') itemId = 'fries'; // Manual Override

                if (itemId && !this.menuSystem.sides.some(s => s.definitionId === itemId)) {
                    this.menuSystem.sides.push({ definitionId: itemId });
                    console.log(`Added ${itemId} to Menu Sides`);
                }
            } else if (categoryIndex === 2) { // Drink
                if (itemId && !this.menuSystem.drinks.some(d => d.definitionId === itemId)) {
                    this.menuSystem.drinks.push({ definitionId: itemId });
                    console.log(`Added ${itemId} to Menu Drinks`);
                }
            }
        }

        // --- Helper Unlock Logic ---
        // "Helpers come free with your first side (1), drink (2) or topping (0) unlock"
        let helperId = null;
        if (categoryIndex === 0) {
            // Only grant inserts for solid toppings (choppable/processable), not sauces
            // Check if the produced item is a sauce container or related to sauce
            let isSauce = false;
            // Check produced item properties
            if (producedDef.type === 'SauceContainer' || producedDef.category === 'sauce_refill') isSauce = true;
            if (producedDef.orderConfig && producedDef.orderConfig.capability === 'ADD_COLD_SAUCE') isSauce = true;

            // Also check if the item itself (if no produced item or same) is a sauce
            if (itemDef.category === 'sauce_refill' || itemDef.type === 'SauceContainer') isSauce = true;

            if (!isSauce) {
                helperId = 'insert';
            }
        }
        else if (categoryIndex === 1) helperId = 'side_cup_box';
        else if (categoryIndex === 2) helperId = 'drink_cup_box';

        if (helperId) {
            const helperItem = this.shopItems.find(i => i.id === helperId);

            // Determine if we should grant the helper item
            // 1. If it's not unlocked yet (First Time for Drink/Topping)
            // 2. If it's a Side (Category 1), ALWAYS grant a box (per user request)
            const shouldGrant = helperItem && (!helperItem.unlocked || categoryIndex === 1);

            if (shouldGrant) {
                console.log(`Granting Free Helper: ${helperId}`);
                const isNew = !helperItem.unlocked;

                helperItem.unlocked = true;
                // Give one free (add to cart for morning delivery)
                this.cart[helperId] = (this.cart[helperId] || 0) + 1;

                if (isNew) {
                    this.addFloatingText("Helper Unlocked!", this.player.x, this.player.y - 40, '#00ffff');
                } else {
                    this.addFloatingText("Bonus Cups!", this.player.x, this.player.y - 40, '#00ffff');
                }
            }
        }
        // ---------------------------

        this.addFloatingText("Reward Unlocked!", this.player.x, this.player.y, '#ffd700');

        // Transition handled by PostDaySystem
        // this.startDay();

        // Refresh Menu System to see new unlocked topping
        if (this.menuSystem) {
            this.menuSystem.updateAvailableItems();
        }
    }

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

        // Continue Title Theme (Muffled) for Day 0 Setup
        this.audioSystem.setMuffled(true);

        // Clear existing rooms if any
        this.rooms = {};

        // 1. Setup Main Room (Kitchen)
        // const mainGrid = new Grid(GRID_WIDTH, GRID_HEIGHT);
        // mainGrid.deserialize(DEFAULT_LEVEL);
        // 1. Setup Main Room (Kitchen)
        const mainGrid = new Grid(DEFAULT_LEVEL.width, DEFAULT_LEVEL.height);
        mainGrid.deserialize(DEFAULT_LEVEL);
        this.rooms['main'] = mainGrid;

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
        this.player.y = 1;
        this.player.facing = { x: 0, y: 1 };

        this.player.heldItem = null;

        // Reset Economy
        this.money = 120;
        this.storage = {}; // Reset Storage
        this.dayNumber = 0;
        this.earnedServiceStar = false;

        // Reset Shop Items (Unlocks)
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
        this.cart['patty_box'] = 1;
        this.cart['bun_box'] = 1;
        this.cart['wrapper_box'] = 1;
        this.cart['bag_box'] = 1;
        // Deduct cost
        const kStartCost = 50 + 30 + 20 + 20; // Hardcoded based on defaults or look up
        this.money -= kStartCost;

        // Save this clean state immediately so if they refresh they get this
        this.saveLevel();

        this.pendingOrders = []; // Clear pending orders on new game

        this.queueFinishedTime = null;
        this.ratingPopup.hide();
        this.isDayActive = false;

        this.postDaySystem.state = 'SUPPLY_ORDER';
        this.updateCapabilities();
    }

    updateCapabilities() {
        this.shopSystem.checkUnlocks();
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
        if (activeTileTypes.has('STOVE') && hasPatty && hasBun) {
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
        // Note: We also should ideally check if the dispenser is loaded, but for now we check for presence of mayo source in the room.
        const hasMayo = activeDefIds.has('mayo_box') || activeDefIds.has('mayo_bag');
        if (activeTileTypes.has('DISPENSER') && hasMayo) {
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
        if (activeTileTypes.has('SODA_FOUNTAIN') && hasSyrup && hasDrinkCup) {
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



    expandKitchen() {
        console.log("Expanding Kitchen!");
        const currentGrid = this.rooms['main'];

        // Insert a row one from the bottom and a column one from the right
        const colIndex = currentGrid.width - 1;
        const rowIndex = currentGrid.height - 1;

        currentGrid.expandInterior(colIndex, rowIndex);

        // Visual Feedback
        this.addFloatingText("Kitchen Expanded!", this.player.x, this.player.y, '#ffff00');

        // Save
        this.saveLevel();
    }




    handleBuildModeInput(event) {
        this.constructionSystem.handleInput(event);
    }

    handleMenuInput(event) {
        const result = this.menuSystem.handleInput(event, this.settings);
        // Linear "NEXT" flow disabled for Hub-based navigation
        /*
        if (result === 'NEXT') {
            if (this.gameState === 'MENU_CUSTOM') {
                this.gameState = 'COMPUTER_ORDERING';
                this.shopSystem.selectedComputerItemId = null;
            }
            return;
        }
        */
        if (result) return;

        if (event.code === 'Escape') {
            // Explicitly hide the menu overlay
            if (this.menuSystem) {
                this.menuSystem.close();
            }

            if (this.isDayActive) {
                this.gameState = 'PLAYING';
            } else {
                this.gameState = 'POST_DAY';
            }
            return;
        }
    }


    // Deprecated but kept for reference if needed (removed usage above)
    confirmPlacement() {

        const { x, y, item } = this.placementState;

        // Place the tile
        console.log(`Placing ${item.id} at ${x}, ${y}`);

        // Deduct money
        this.money -= item.price;

        // Use setTileType logic
        // We need to map item.id to a TILE_TYPE
        if (item.tileType && TILE_TYPES[item.tileType]) {
            this.grid.setTileType(x, y, TILE_TYPES[item.tileType]);

            // Special initialization if needed
            this.updateCapabilities();
        } else {
            console.error(`Unknown tile type for appliance: ${item.tileType}`);
        }

        // Clear previous 'justUnlocked' flags
        this.shopItems.forEach(i => i.justUnlocked = false);

        // Unlock Logic
        const unlocks = [];
        if (item.id === 'cutting_board') unlocks.push('tomato_box');
        if (item.id === 'dispenser') unlocks.push('mayo_box');
        if (item.id === 'fryer') unlocks.push('fry_box', 'side_cup_box');
        if (item.id === 'soda_fountain') unlocks.push('syrup_box', 'drink_cup_box');

        if (unlocks.length > 0) {
            let reSortNeeded = false;
            unlocks.forEach(id => {
                const supplyItem = this.shopItems.find(i => i.id === id);
                if (supplyItem && !supplyItem.unlocked) {
                    supplyItem.unlocked = true;
                    supplyItem.justUnlocked = true; // Flag for UI
                    reSortNeeded = true;
                }
            });

            if (reSortNeeded && this.sortShopItems) {
                this.sortShopItems();
            }
        }

        // We stay in BUILD_MODE to allow painting tiles
        // this.placementState.active = false; 
    }

    // Helper to sort shop items
    sortShopItems() {
        this.shopSystem.sortShopItems();
    }

    unlockAllCheat() {
        console.log("CHEAT: Unlocking ALL items and appliances.");
        this.addFloatingText("CHEAT: Unlocked Everything!", this.player.x, this.player.y, '#ff00ff');

        this.shopItems.forEach(item => {
            item.unlocked = true;
            item.justUnlocked = true;
            // Prevent re-locking by ShopSystem.checkUnlocks
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
                    // 2. Stovetop
                    else if (cell.type.id === 'STOVE') {
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
        this.ratingPopup.hide();

        // Create Clean Slate for Appliances
        this.cleanAppliances();

        // Handle Overnight Spoilage
        this.spoilStaleItems();

        // Handle Morning Orders (Spawn Pending Items)
        if (this.pendingOrders && this.pendingOrders.length > 0) {
            console.log(`Spawning ${this.pendingOrders.length} pending orders...`);
            this.pendingOrders.forEach(order => {
                // Add to temporary cart just to use the populate logic below?
                // Or simply merge into cart?
                // Merging into cart simulates "buying" them now, but we already paid.
                // We should just increment the count in the cart structure IF we use loop below which iterates shopItems.
                // BUT the loop below uses `this.cart` which was just reset in endDay (or not? endDay says "Do NOT clear cart here" but startDay consumes it)
                // Actually startDay consumes `this.cart`.
                // So we can just add pending counts to `this.cart`.
                this.cart[order.id] = (this.cart[order.id] || 0) + (order.qty || 1);
            });
            this.pendingOrders = []; // Clear queue
        }

        this.dayNumber++;
        console.log(`Starting Day ${this.dayNumber}...`);

        this.currentDayPerfect = true;
        this.starSummaryDismissed = false;

        // 1. Populate Fridge (Do this FIRST so capabilities avail)
        // 1. Populate Fridge & Office (Do this FIRST so capabilities avail)
        // Note: We NO LONGER clear the fridge. Persistance!

        // Spawn ordered items into VALID EMPTY spots
        // We need to find all counters in the fridge/office that are EMPTY
        const emptyCounters = [];

        ['store_room', 'office'].forEach(roomId => {
            const room = this.rooms[roomId];
            if (room) {
                for (let y = 0; y < room.height; y++) {
                    for (let x = 0; x < room.width; x++) {
                        const c = room.getCell(x, y);
                        if (c.type.id === 'DELIVERY_TILE' && !c.object) {
                            emptyCounters.push(c);
                        }
                    }
                }
            }
        });

        // Populate sequentially into empty slots
        let counterIndex = 0;

        for (const shopItem of this.shopItems) {
            if (shopItem.type !== 'supply') continue;
            const itemId = shopItem.id;
            const qty = this.cart[itemId];

            if (qty > 0) {
                for (let i = 0; i < qty; i++) {
                    if (counterIndex < emptyCounters.length) {
                        const cell = emptyCounters[counterIndex];
                        const instance = new ItemInstance(itemId);
                        // Custom Insert Logic: Spawn stack of 3
                        if (itemId === 'insert') {
                            instance.state.count = 3;
                        }
                        cell.object = instance;
                        counterIndex++;
                    }
                }
            }
        }

        // 2. Update Capabilities (Now that supplies are in the world/truck)
        this.updateCapabilities();

        // 3. Generate Daily Orders
        const capabilities = this.getPlayerCapabilities();
        // Menu System Integration: Use defined menu instead of raw capabilities
        const orders = this.orderSystem.generateDailyOrders(this.dayNumber, this.menuSystem.getMenu());
        this.ticketQueue = orders;

        // Safeguard: Ensure queue is not empty to prevent immediate "Day Over" state
        if (this.ticketQueue.length === 0) {
            console.warn("Ticket Queue was empty! Forcing a fallback ticket.");
            const fallbackTicket = this.orderSystem.createTicketFromCustomers(
                [this.orderSystem.generateCustomerProfile(this.menuSystem.getMenu())],
                1
            );
            fallbackTicket.calculateParTime();
            fallbackTicket.arrivalTime = this.prepTime + 5;
            this.ticketQueue.push(fallbackTicket);
        }

        this.queueFinishedTime = null;
        this.activeTickets = [];
        this.activeTicketIndex = 0;
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

        // 5. Audio Updates
        // Play Day Music (Alternate)
        // Play Day Music (Rotate 3 songs)
        const songIndex = (this.dayNumber - 1) % 4;

        let songIntro, songLoop;
        if (songIndex === 0) {
            songIntro = ASSETS.AUDIO.SONG1_INTRO;
            songLoop = ASSETS.AUDIO.SONG1_LOOP;
        } else if (songIndex === 1) {
            songIntro = ASSETS.AUDIO.SONG2_INTRO;
            songLoop = ASSETS.AUDIO.SONG2_LOOP;
        } else if (songIndex === 2) {
            songIntro = ASSETS.AUDIO.SONG3_INTRO;
            songLoop = ASSETS.AUDIO.SONG3_LOOP;
        } else {
            songIntro = ASSETS.AUDIO.SONG4_INTRO;
            songLoop = ASSETS.AUDIO.SONG4_LOOP;
        }

        this.audioSystem.playMusic(songIntro, songLoop);
        this.audioSystem.setMuffled(false);

        // --- PREP TIME LOGIC ---
        const complexity = this.menuSystem.calculateComplexity();
        this.prepTime = 15 + Math.floor(complexity) * 5;
        this.maxPrepTime = this.prepTime;
        this.isPrepTime = true;
        this.ticketTimer = 0; // Reset timer so tickets don't start yet

        // Reset Daily Stats
        this.dailyMoneyEarned = 0;
        this.dailyBagsSold = 0;

        // Ensure player is in Main Room (Kitchen) to start the day
        if (this.currentRoomId !== 'main') {
            console.log("Resetting player to Main Room for start of day.");
            this.currentRoomId = 'main';
            this.grid = this.rooms['main'];
            this.player.x = 2; // Center-ish
            this.player.y = 1;
            this.saveLevel();
        }

        console.log(`Starting Day with Prep Time: ${this.prepTime}s (Complexity: ${complexity})`);
    }

    onClosingTime() {
        console.log('Restaurant Closing (Queue Finished).');
        this.queueFinishedTime = Date.now();
        this.audioSystem.setMuffled(true);
        this.isDayActive = false; // Stop timers

        // Calculate Final Stats
        const starCount = this.calculateDailyStars();

        // Update Persistent Stats
        if (this.dayNumber > 0) {
            this.earnedServiceStar = this.currentDayPerfect;
        }

        // Show Rating Popup
        this.ratingPopup.show(starCount, this.dailyStarBreakdown);
    }

    calculateDailyStars() {
        // Calculate Daily Stars
        const breakdown = [];
        let starCount = 0;

        // 1. Perfect Day (All orders on time)
        const star1 = this.currentDayPerfect;
        if (star1) starCount++;
        breakdown.push(star1);

        // 2. Side on Menu
        const star2 = this.menuSystem.sides.length > 0;
        if (star2) starCount++;
        breakdown.push(star2);

        // 3. Drink on Menu
        const star3 = this.menuSystem.drinks.length > 0;
        if (star3) starCount++;
        breakdown.push(star3);

        // 4. Complexity >= 15
        const complexity = this.menuSystem.calculateComplexity();
        const star4 = complexity >= 15;
        if (star4) starCount++;
        breakdown.push(star4);

        // 5. Complexity >= 30
        const star5 = complexity >= 30;
        if (star5) starCount++;
        breakdown.push(star5);

        this.dailyStarCount = starCount;
        this.dailyStarBreakdown = breakdown;
        console.log(`calculated Daily Stars: ${starCount}`, breakdown);

        return starCount;
    }

    // Called when player exits the door
    endDay() {
        // Ensure we can only end day if service is finished
        if (this.isDayActive && !this.queueFinishedTime) {
            this.addFloatingText("Finish Service First!", this.player.x, this.player.y, '#ff0000');
            return;
        }

        console.log('Transitioning to Post-Day...');

        this.gameState = 'POST_DAY';
        this.postDaySystem.start();
        this.postDayStartTime = Date.now();

        // Robust Cart Reset / Cleanup
        this.ticketQueue = [];
        this.activeTickets = [];
        this.incomingTicket = null;

        // Force player back to kitchen if in store_room or office
        if (this.currentRoomId === 'store_room' || this.currentRoomId === 'office') {
            this.currentRoomId = 'main';
            this.grid = this.rooms['main'];
            this.player.x = 1;
            this.player.y = 1;
            this.saveLevel();
        }

        // Save progression
        this.saveLevel();
        this.audioSystem.setMuffled(true);
        console.log(`End of Day. Remaining Money: $${this.money}`);
    }




    handleInput(event) {
        if (!this.keys) this.keys = {};
        this.keys[event.code] = true;

        if (this.audioSystem) this.audioSystem.resume();

        if (event.code === 'KeyC' && event.shiftKey) {
            this.money += 500;
            console.log(`Cheat: Added $500. New Balance: ${this.money}`);
        }

        if (event.code === 'KeyU' && event.shiftKey) {
            this.unlockAllCheat();
        }

        if (this.gameState === 'TITLE') {
            const UP = this.settings.getBinding(ACTIONS.MOVE_UP);
            const DOWN = this.settings.getBinding(ACTIONS.MOVE_DOWN);
            const SELECT = [this.settings.getBinding(ACTIONS.INTERACT), 'Enter', 'Space'];

            if (event.code === UP || event.code === 'ArrowUp') {
                this.titleSelection--;
                if (this.titleSelection < 0) this.titleSelection = 1;
            } else if (event.code === DOWN || event.code === 'ArrowDown') {
                this.titleSelection++;
                if (this.titleSelection > 1) this.titleSelection = 0;
            } else if (SELECT.includes(event.code)) {
                if (this.titleSelection === 0) {
                    // New Game
                    this.startNewGame();
                    this.startDay();
                    this.gameState = 'PLAYING';
                } else if (this.titleSelection === 1) {
                    // Settings
                    this.gameState = 'SETTINGS';
                    this.settingsState.selectedIndex = 0;
                    this.settingsState.rebindingAction = null;
                }
                return;
            }
            return;
        }

        if (this.gameState === 'SETTINGS') {
            if (this.settingsState.rebindingAction) {
                // We are waiting for a key
                // Prevent binding Escape if we want it to be "Cancel"? 
                // Let's allow any key except Escape maybe?
                if (event.code === 'Escape') {
                    this.settingsState.rebindingAction = null;
                    return;
                }

                this.settings.setBinding(this.settingsState.rebindingAction, event.code);
                this.settingsState.rebindingAction = null;
                return;
            }

            const UP = this.settings.getBinding(ACTIONS.MOVE_UP);
            const DOWN = this.settings.getBinding(ACTIONS.MOVE_DOWN);
            const INTERACT = this.settings.getBinding(ACTIONS.INTERACT);

            // Hardcoded navigation for menu in case user breaks bindings? 
            // It's safer to always allow Arrows/Enter in menus.
            const isUp = event.code === UP || event.code === 'ArrowUp';
            const isDown = event.code === DOWN || event.code === 'ArrowDown';
            const isSelect = event.code === INTERACT || event.code === 'Enter' || event.code === 'Space';
            const isBack = event.code === 'Escape';

            // Define available items (Audio Toggles + Bindings)
            // Ideally we'd pull "displayOrder" from a shared location, but for limited scope hardcoding order is okay
            const keyActions = [
                'MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT',
                'INTERACT', 'PICK_UP', 'VIEW_ORDERS',
                'EQUIP_1', 'EQUIP_2', 'EQUIP_3', 'EQUIP_4'
            ];

            // Total menu items = 2 (toggles) + keyActions.length
            const totalItems = 2 + keyActions.length;

            if (isUp) {
                this.settingsState.selectedIndex--;
                if (this.settingsState.selectedIndex < 0) this.settingsState.selectedIndex = totalItems - 1;
            } else if (isDown) {
                this.settingsState.selectedIndex++;
                if (this.settingsState.selectedIndex >= totalItems) this.settingsState.selectedIndex = 0;
            } else if (isSelect) {
                const idx = this.settingsState.selectedIndex;

                if (idx === 0) {
                    // Toggle Music
                    this.settings.preferences.musicEnabled = !this.settings.preferences.musicEnabled;
                    this.settings.save();
                    this.audioSystem.updateVolumesFromSettings();
                } else if (idx === 1) {
                    // Toggle SFX
                    this.settings.preferences.sfxEnabled = !this.settings.preferences.sfxEnabled;
                    this.settings.save();
                    this.audioSystem.updateVolumesFromSettings();
                } else {
                    // Key Rebind
                    const actionKey = keyActions[idx - 2];
                    this.settingsState.rebindingAction = actionKey;
                }
            } else if (isBack) {
                this.gameState = 'TITLE';
            }
            return;
        }



        if (this.gameState === 'DAY_SUMMARY') {
            // Handle Rating Popup Input
            if (this.ratingPopup.isVisible) {
                const consumed = this.ratingPopup.handleInput(event, this.settings, ACTIONS);

                // If popup just closed (consumed input and is no longer visible)
                if (!this.ratingPopup.isVisible) {
                    console.log(`[Game] Rating Popup dismissed. Transitioning to POST_DAY.`);
                    this.gameState = 'POST_DAY';
                    this.postDayStartTime = Date.now();
                    this.postDaySystem.start();
                }
                return;
            } else {
                // Safety catch
                this.gameState = 'POST_DAY';
                this.postDayStartTime = Date.now();
                this.postDaySystem.start();
            }
            return;
        }

        if (this.gameState === 'POST_DAY') {
            const result = this.postDaySystem.handleInput(event, this.settings);
            if (result === 'DONE') {
                // State transition handled in grantDailyReward usually, or here if we prefer explicit
            }
            return;
        }



        if (this.gameState === 'COMPUTER_ORDERING') {
            this.handleComputerInput(event);
            return;
        }

        if (this.gameState === 'RENO_SHOP') {
            this.handleRenoInput(event);
            return;
        }

        if (this.gameState === 'MENU_CUSTOM') {
            this.handleMenuInput(event);
            return;
        }

        if (this.gameState === 'BUILD_MODE') {
            if (this.gameState === 'BUILD_MODE') {
                this.handleBuildModeInput(event);
                return;
            }
            return;
        }



        // Handle Rating Popup Input
        if (this.ratingPopup.isVisible) {
            const consumed = this.ratingPopup.handleInput(event, this.settings, ACTIONS);
            if (consumed) return;
        }




        let dx = 0;
        let dy = 0;

        const code = event.code;

        // Determine Action
        if (code === this.settings.getBinding(ACTIONS.MOVE_UP)) dy = -1;
        if (code === this.settings.getBinding(ACTIONS.MOVE_DOWN)) dy = 1;
        if (code === this.settings.getBinding(ACTIONS.MOVE_LEFT)) dx = -1;
        if (code === this.settings.getBinding(ACTIONS.MOVE_RIGHT)) dx = 1;



        if (code === this.settings.getBinding(ACTIONS.PICK_UP)) {
            if (this.isViewingOrders) {
                const penalty = this.activeTickets.length * 20; // $20 per unfinished ticket
                this.money -= penalty;
                if (penalty > 0) {
                    this.addFloatingText(`Given Up: -$${penalty}`, this.player.x, this.player.y, '#ff0000');
                }
                // Clear all tickets to trigger "Queue Finished" routine automatically in update()
                this.ticketQueue = [];
                this.activeTickets = [];
                this.incomingTicket = null;
                this.addFloatingText("Service Terminated", this.player.x, this.player.y, '#ff0000');
                return;
            }
            this.player.actionPickUp(this.grid);
        }

        if (code === this.settings.getBinding(ACTIONS.INTERACT)) {
            const facingCell = this.player.getTargetCell(this.grid);
            if (facingCell && facingCell.type.id === 'COMPUTER') {
                this.gameState = 'COMPUTER_ORDERING';
                return;
            }
            console.log('Interacting. Facing:', facingCell ? facingCell.type.id : 'null');
            if (facingCell && facingCell.type.id === 'RENO') {
                console.log('entering Build Mode from Reno Tile');
                this.addFloatingText("Build Mode", this.player.x, this.player.y, '#ffd700');
                this.enterBuildMode();
                return;
            }

            if (facingCell && facingCell.type.id === 'MENU') {
                if (!this.isEndgameUnlocked) {
                    this.addFloatingText("Locked!", this.player.x, this.player.y, '#ff0000');
                    return;
                }
                console.log('Opening Custom Menu');
                this.gameState = 'MENU_CUSTOM';
                return;
            }

            if (facingCell && facingCell.type.id === 'TICKET_WHEEL') {
                if (this.isPrepTime) {
                    this.prepTime = 0;
                    console.log("Prep time skipped by user interaction.");
                    return;
                }
                this.cycleActiveTicket();
                return;
            }

            this.player.actionInteract(this.grid);
        }



        if (dx !== 0 || dy !== 0) {
            const moved = this.player.move(dx, dy, this.grid);
            if (moved) {
                // Check if we stepped onto a door
                const cell = this.grid.getCell(this.player.x, this.player.y);
                if (cell && cell.type.isDoor) {
                    this.handleDoorTraversal(cell);
                } else if (cell && cell.type.id === 'EXIT_DOOR') {
                    // Trigger End of Day
                    this.endDay();
                }
            } else {
                // Blocked. Are we standing on a door attempting to leave via the edge?
                const currentCell = this.grid.getCell(this.player.x, this.player.y);
                if (currentCell && currentCell.type.isDoor) {
                    // Only traverse if we are trying to move OUT OF BOUNDS
                    // This prevents "walking into a wall" from triggering the door again
                    const targetX = this.player.x + dx;
                    const targetY = this.player.y + dy;
                    const isOutOfBounds = targetX < 0 || targetX >= this.grid.width ||
                        targetY < 0 || targetY >= this.grid.height;

                    if (isOutOfBounds) {
                        this.handleDoorTraversal(currentCell);
                    }
                }
            }
        }
    }

    handleDoorTraversal(cell) {
        const state = cell.state;
        if (!state || !state.targetRoom || !state.targetDoorId) {
            console.error("Door missing definition:", state);
            return;
        }

        // Locked logic
        if (state.hasOwnProperty('isOpen') && !state.isOpen) {
            return;
        }

        const nextRoomId = state.targetRoom;
        const targetDoorId = state.targetDoorId;
        const nextRoom = this.rooms[nextRoomId];

        if (!nextRoom) {
            console.error("Target room not found:", nextRoomId);
            return;
        }

        // Find the target door in the new room
        let spawnX = 1; // Fallback
        let spawnY = 1;
        let found = false;

        for (let y = 0; y < nextRoom.height; y++) {
            for (let x = 0; x < nextRoom.width; x++) {
                const c = nextRoom.getCell(x, y);
                if (c.type.isDoor && c.state.id === targetDoorId) {
                    spawnX = x;
                    spawnY = y;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        if (!found) {
            console.warn(`Target door '${targetDoorId}' not found in room '${nextRoomId}'. Spawning at safe default.`);
            // Fallback: Find ANY walkable tile
            for (let y = 0; y < nextRoom.height; y++) {
                for (let x = 0; x < nextRoom.width; x++) {
                    const c = nextRoom.getCell(x, y);
                    if (c.type.walkable) {
                        spawnX = x;
                        spawnY = y;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }

        // Perform Switch
        this.currentRoomId = nextRoomId;
        this.grid = nextRoom;
        this.player.x = spawnX;
        this.player.y = spawnY;



        console.log(`Switched to room: ${nextRoomId}`);
        // Auto-save on room transition
        // Auto-save on room transition
        this.saveLevel();

        // Capabilities shouldn't change on room switch usually, but good to ensure consistency? 
        // No, capabilities are global based on ALL rooms. No change needed here.
    }

    update(dt) {
        if (!dt) return;

        // Ticket Wheel Interaction
        if (this.gameState === 'PLAYING') {
            const interactKey = this.settings.getBinding(ACTIONS.INTERACT);
            const viewKey = this.settings.getBinding(ACTIONS.VIEW_ORDERS);

            const isHoldingInteract = (this.keys && (this.keys[interactKey] || this.keys['Enter']));
            const isHoldingView = (this.keys && this.keys[viewKey]);

            if (isHoldingView) {
                this.isViewingOrders = true;
            } else {
                this.isViewingOrders = false;
            }
        }

        // Floating Text Update
        this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
        this.floatingTexts.forEach(ft => {
            ft.life -= dt / 1000;
        });

        // Ticket Arrival Logic
        if (this.isDayActive) {
            // Check for day completion (no more tickets to arrive AND no more active tickets AND no incoming ticket printing)
            // Fix: Check !this.incomingTicket to prevent early trigger while last ticket is printing
            // Check for day completion (no more tickets to arrive AND no more active tickets AND no incoming ticket printing)
            // Fix: Check !this.incomingTicket to prevent early trigger while last ticket is printing
            if (this.ticketQueue.length === 0 && this.activeTickets.length === 0 && !this.incomingTicket && !this.queueFinishedTime) {
                this.onClosingTime();
            }

            // Ticket Arrival Logic
            if (this.isPrepTime) {
                this.prepTime -= dt / 1000;
                if (this.prepTime <= 0) {
                    this.isPrepTime = false;
                    this.prepTime = 0;
                    this.ticketTimer = 10000; // Force immediate first ticket
                    console.log("Prep Time Over! Service starting...");
                }
            } else {
                // Always increment arrival timer to maintain rhythm
                this.ticketTimer += dt;
            }

            // 1. Check if we can start a new print
            // We only dequeue if we aren't currently printing another one
            if (this.ticketTimer >= 10000 && !this.incomingTicket && this.ticketQueue.length > 0) {
                this.ticketTimer = 0;
                this.incomingTicket = this.ticketQueue.shift();
                this.printingTimer = 0;

                // Trigger Printer Animation
                // Find printer
                // Find printer (Always in main kitchen)
                const kitchen = this.rooms['main'];
                if (kitchen) {
                    for (let y = 0; y < kitchen.height; y++) {
                        for (let x = 0; x < kitchen.width; x++) {
                            const c = kitchen.getCell(x, y);
                            if (c.type.id === 'PRINTER') {
                                if (!c.state) c.state = {};
                                c.state.printing = true;
                                c.state.printStartTime = Date.now();
                                this.audioSystem.playSFX(ASSETS.AUDIO.PRINTER);
                            }
                        }
                    }
                }
                console.log("Ticket started printing...");
            }

            // 2. Handle Printing Process -> Arrival on Wheel
            if (this.incomingTicket) {
                this.printingTimer += dt;
                // Animation is 2.25s (2250ms)
                if (this.printingTimer >= 2250) {
                    this.activeTickets.push(this.incomingTicket);

                    // Update Display text (append to orders)
                    this.orders = this.activeTickets.map(t => t.toDisplayFormat());

                    console.log("Ticket arrived on wheel!");
                    this.incomingTicket = null;
                }
            }

            // Check if day is complete (No queue, no active tickets)
            if (this.ticketQueue.length === 0 && this.activeTickets.length === 0) {
                // Day should end? Or wait for player to end it?
                // User requirement: "the player gets a ticket every 10 seconds until all the days tickets are printed"
                // Usually games wait for player to serve last one.
                // We don't auto-end day here, handled by manual finish or completion of last order if auto (?)
                // Actually the current logic auto-ends on completion.
                // I should verify below.
            }

            // Update elapsed times
            this.activeTickets.forEach(t => t.elapsedTime += dt / 1000);
        }

        // Update appliances in ALL rooms
        Object.values(this.rooms).forEach(room => {
            if (!room) return;
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);

                    // Stove Logic
                    if (cell.type.id === 'STOVE') {
                        const item = cell.object;
                        // Check if item has cooking definition
                        if (item && item.definition.cooking && item.definition.cooking.stages) {
                            const currentStage = item.state.cook_level || 'raw';
                            const stageDef = item.definition.cooking.stages[currentStage];

                            if (stageDef) {
                                item.state.cookingProgress = (item.state.cookingProgress || 0) + dt;
                                // Use time from definition, fallback to stove speed if defined (or combine?)
                                // For now, let's use the definition duration as primary if it exists.
                                const requiredTime = stageDef.duration || cell.state.cookingSpeed || 2000;

                                if (item.state.cookingProgress >= requiredTime) {
                                    item.state.cook_level = stageDef.next;
                                    item.state.cookingProgress = 0;
                                    console.log(`Item cooked: ${item.definitionId} -> ${stageDef.next}`);
                                }
                            }
                        }
                    }

                    // Fryer Logic
                    if (cell.type.id === 'FRYER' && cell.state) {
                        if (cell.state.status === 'down') {
                            cell.state.timer = (cell.state.timer || 0) + dt;

                            let max = cell.state.cookingSpeed || 2000;
                            // Synchronize with item cooking duration if active
                            if (cell.object && cell.object.definition && cell.object.definition.cooking) {
                                const stage = cell.object.state.cook_level || 'raw';
                                const stageDef = cell.object.definition.cooking.stages[stage];
                                if (stageDef && stageDef.duration) {
                                    max = stageDef.duration;
                                }
                            }

                            if (cell.state.timer >= max) {
                                cell.state.status = 'done';
                                cell.state.timer = 0;
                                console.log('Fries done!');
                            }
                        }

                        // Cooking placed items (e.g. Chicken Patty)
                        const item = cell.object;
                        if (item && item.definition.cooking && item.definition.cooking.stages) {
                            const currentStage = item.state.cook_level || 'raw';
                            const stageDef = item.definition.cooking.stages[currentStage];

                            if (stageDef && stageDef.cookMethod === 'fry') {
                                item.state.cookingProgress = (item.state.cookingProgress || 0) + dt;
                                // Use definition duration
                                const requiredTime = stageDef.duration || 2000;

                                if (item.state.cookingProgress >= requiredTime) {
                                    item.state.cook_level = stageDef.next;
                                    item.state.cookingProgress = 0;
                                    console.log(`Fryer Item cooked: ${item.definitionId} -> ${stageDef.next}`);
                                }
                            }
                        }
                    }

                    // Soda Fountain Logic
                    if (cell.type.id === 'SODA_FOUNTAIN' && cell.state) {
                        if (cell.state.status === 'filling') {
                            cell.state.timer = (cell.state.timer || 0) + dt;
                            const max = cell.state.fillDuration || 3000;
                            if (cell.state.timer >= max) {
                                cell.state.status = 'done';
                                cell.state.timer = 0;
                                console.log('Soda filling done!');
                            }
                        }
                    }

                    // Service Counter Logic
                    if (cell.type.id === 'SERVICE' && cell.object && cell.object.definitionId === 'bag') {
                        if (this.activeTickets.length > 0) {

                            // Ensure activeTicketIndex is valid
                            if (this.activeTicketIndex === undefined || this.activeTicketIndex < 0) {
                                this.activeTicketIndex = 0;
                            }

                            // Try to satisfy ONLY the ACTIVE ticket
                            let matchedTicketIndex = -1;
                            let matchResult = null;

                            // Check if active index is within bounds
                            if (this.activeTicketIndex < this.activeTickets.length) {
                                const t = this.activeTickets[this.activeTicketIndex];
                                const res = t.verifyBag(cell.object);
                                if (res.matched) {
                                    matchedTicketIndex = this.activeTicketIndex;
                                    matchResult = res;
                                }
                            }

                            if (matchedTicketIndex !== -1) {
                                console.log(`Order Bag Verified! Payout: $${matchResult.payout}`);
                                const ticket = this.activeTickets[matchedTicketIndex];

                                // Reward
                                this.money += matchResult.payout;
                                this.dailyMoneyEarned += matchResult.payout;
                                this.dailyBagsSold++;

                                // Update Display
                                // We need to re-generate the orders display list
                                // But first we check if ticket is totally done

                                // Destroy Bag
                                cell.object = null;

                                // Check Ticket Completion
                                if (ticket.isComplete()) {
                                    console.log("Ticket Completed!");

                                    // SCORING LOGIC
                                    const par = ticket.parTime;
                                    const elapsed = ticket.elapsedTime;
                                    const diff = par - elapsed;

                                    let bonus = 0;
                                    let message = "";
                                    let color = "#fff";

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
                                        message = "LATE SERVING";
                                        color = "#ff0000";
                                        this.currentDayPerfect = false;
                                    }

                                    this.money += bonus;
                                    this.dailyMoneyEarned += bonus;

                                    this.addFloatingText(message + ` ($${bonus})`, x, y, color);

                                    // Bonus Time Logic: "whenever you complete an order, give half that order's par time as bounus time to tall pending orders"
                                    const bonusTime = par / 2;
                                    if (bonusTime > 0) {
                                        // 1. Active Tickets (Excluding the one just finished)
                                        this.activeTickets.forEach((t, i) => {
                                            if (i !== matchedTicketIndex) {
                                                t.elapsedTime -= bonusTime;
                                            }
                                        });

                                        // 2. Incoming Ticket (Printing)
                                        if (this.incomingTicket) {
                                            this.incomingTicket.elapsedTime -= bonusTime;
                                        }

                                        // 3. Queued Tickets
                                        this.ticketQueue.forEach(t => t.elapsedTime -= bonusTime);

                                        console.log(`Bonus Time Awarded: ${bonusTime}s`);
                                        this.addFloatingText(`Bonus: +${bonusTime}s`, x, y - 1, '#00ffff');
                                    }

                                    // Remove from active list
                                    this.activeTickets.splice(matchedTicketIndex, 1);

                                    // Check if Day is Done (No queue, no active) - REMOVED AUTO END
                                    /*
                                    if (this.ticketQueue.length === 0 && this.activeTickets.length === 0) {
                                        // End Day Immediately
                                        setTimeout(() => {
                                            this.endDay();
                                        }, 1500);
                                    }
                                    */
                                    // Adjust active index if needed
                                    if (this.activeTicketIndex >= this.activeTickets.length) {
                                        this.activeTicketIndex = 0;
                                    }
                                }
                                // NOTE: If ticket is NOT complete, we do NOT remove it.

                                // Refresh orders view
                                this.orders = this.activeTickets.map(t => t.toDisplayFormat());
                            }
                        }
                    }
                }
            }
        });



        // Dynamically update Office State (Door & Reno Tile)
        this.updateOfficeState();
    }

    updateOfficeState() {
        const hasActiveOrders = (this.activeTickets.length > 0) ||
            (this.ticketQueue.length > 0) ||
            (this.incomingTicket != null);

        // 1. Office Door Logic: ALWAYS OPEN (User Request)
        const mainRoom = this.rooms['main'];
        if (mainRoom) {
            let officeDoor = null;
            // Scan for door (using ID to be safe or coordinates (6,1))
            for (let y = 0; y < mainRoom.height; y++) {
                for (let x = 0; x < mainRoom.width; x++) {
                    const c = mainRoom.getCell(x, y);
                    if (c.state && c.state.id === 'kitchen_office_door') {
                        officeDoor = c;
                        break;
                    }
                }
                if (officeDoor) break;
            }

            if (officeDoor) {
                // Ensure it is always OPEN
                if (officeDoor.type.id !== 'OFFICE_DOOR') {
                    officeDoor.type = TILE_TYPES.OFFICE_DOOR;
                }
            }
        }

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
            } else if (this.gameState === 'DAY_SUMMARY') {
                // Render the game world in background, then the popup over it (via Renderer.render logic)
                this.renderer.render(this);
            } else if (this.gameState === 'POST_DAY') {
                this.postDaySystem.render(this.renderer.ctx, {
                    moneyEarned: this.dailyMoneyEarned,
                    bagsSold: this.dailyBagsSold,
                    rent: 0,
                    netTotal: this.dailyMoneyEarned,
                    starCount: this.dailyStarCount || 0,
                    startTime: this.postDayStartTime || Date.now()
                });

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
                if (this.gameState === 'PLAYING') {
                    this.update(dt);
                }
                this.renderer.render(this);
            }
        }
        requestAnimationFrame((t) => this.loop(t));
    }

    saveLevel() {
        try {
            const saveData = {
                version: 3,
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
                earnedServiceStar: this.earnedServiceStar,
                pendingOrders: this.pendingOrders,
                rooms: {}
            };

            for (const [id, grid] of Object.entries(this.rooms)) {
                saveData.rooms[id] = grid.serialize();
            }

            localStorage.setItem('burger_joint_save_v3', JSON.stringify(saveData));
            console.log('Game saved (v3).');
        } catch (e) {
            console.error('Failed to save level:', e);
        }
    }

    loadLevel() {
        try {
            const json = localStorage.getItem('burger_joint_save_v3');
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

            if (typeof data.earnedServiceStar === 'boolean') {
                this.earnedServiceStar = data.earnedServiceStar;
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
    cycleActiveTicket() {
        if (this.activeTickets.length <= 1) {
            this.ticketWheelAnimStartTime = Date.now();
            return;
        }

        // Just increment index instead of rotating array
        this.activeTicketIndex++;
        if (this.activeTicketIndex >= this.activeTickets.length) {
            this.activeTicketIndex = 0;
        }

        console.log("Cycled active ticket index. Now pointing to:", this.activeTickets[this.activeTicketIndex].id);

        // Trigger Animation
        this.ticketWheelAnimStartTime = Date.now();
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

    handleComputerInput(event) {
        const result = this.shopSystem.handleComputerInput(event);
        if (result === 'START_DAY') {
            this.startDay();
        }
    }



    handleRenoInput(event) {
        this.shopSystem.handleRenoInput(event);
    }
}

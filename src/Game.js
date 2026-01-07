import { ASSETS, TILE_TYPES, GRID_WIDTH, GRID_HEIGHT } from './constants.js';
import { CAPABILITY } from './data/definitions.js';
import { SCORING_CONFIG } from './data/scoringConfig.js';
import { AssetLoader } from './systems/AssetLoader.js';
import { Renderer } from './systems/Renderer.js';
import { Grid } from './systems/Grid.js';
import { Player } from './entities/Player.js';
import { ItemInstance } from './entities/Item.js';
import { Editor } from './systems/Editor.js';
import { DEFAULT_LEVEL } from './data/defaultLevel.js';
import { OrderSystem } from './systems/OrderSystem.js';
import { Settings, ACTIONS } from './systems/Settings.js';
import { AudioSystem } from './systems/AudioSystem.js';

export class Game {
    constructor() {
        this.assetLoader = new AssetLoader();
        this.grid = new Grid(GRID_WIDTH, GRID_HEIGHT);
        this.renderer = null;
        this.player = new Player(4, 4);
        this.editor = new Editor(this);
        this.settings = new Settings();
        this.audioSystem = new AudioSystem(this.settings);
        this.gameState = 'TITLE'; // TITLE, ORDERING, PLAYING, PLACEMENT, SETTINGS
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

        // Economy & Day Cycle
        this.money = 0;
        // Economy & Day Cycle
        this.money = 0;
        this.isDayActive = false;

        // Visual Feedback
        this.floatingTexts = [];

        // Ordering System
        this.shopItems = [
            // 1. Unlocked Supplies
            { id: 'patty_box', price: SCORING_CONFIG.PRICES.patty_box, type: 'supply', unlocked: true, isEssential: true },
            { id: 'bun_box', price: SCORING_CONFIG.PRICES.bun_box, type: 'supply', unlocked: true, isEssential: true },
            { id: 'wrapper_box', price: SCORING_CONFIG.PRICES.wrapper_box, type: 'supply', unlocked: true, isEssential: true },
            { id: 'bag_box', price: SCORING_CONFIG.PRICES.bag_box, type: 'supply', unlocked: true, isEssential: true },

            // 2. Appliances (Buttons)
            { id: 'counter', price: SCORING_CONFIG.PRICES.counter, type: 'appliance', unlocked: true, tileType: 'COUNTER' },
            { id: 'floor', price: SCORING_CONFIG.PRICES.floor, type: 'appliance', unlocked: true, tileType: 'FLOOR' },
            { id: 'cutting_board', price: SCORING_CONFIG.PRICES.cutting_board, type: 'appliance', unlocked: true, tileType: 'CUTTING_BOARD' },
            { id: 'dispenser', price: SCORING_CONFIG.PRICES.dispenser, type: 'appliance', unlocked: true, tileType: 'DISPENSER' },
            { id: 'fryer', price: SCORING_CONFIG.PRICES.fryer, type: 'appliance', unlocked: true, tileType: 'FRYER' },
            { id: 'soda_fountain', price: SCORING_CONFIG.PRICES.soda_fountain, type: 'appliance', unlocked: true, tileType: 'SODA_FOUNTAIN' },
            { id: 'stove', price: SCORING_CONFIG.PRICES.stove, type: 'appliance', unlocked: true, tileType: 'STOVE' },
            { id: 'expansion', price: SCORING_CONFIG.PRICES.expansion, type: 'action', unlocked: true },
            { id: 'continue', price: 0, type: 'action', unlocked: true },

            // 3. Locked Supplies
            { id: 'tomato_box', price: SCORING_CONFIG.PRICES.tomato_box, type: 'supply', unlocked: false },
            { id: 'mayo_box', price: SCORING_CONFIG.PRICES.mayo_box, type: 'supply', unlocked: false },
            { id: 'fry_box', price: SCORING_CONFIG.PRICES.fry_box, type: 'supply', unlocked: false },
            { id: 'drink_cup_box', price: SCORING_CONFIG.PRICES.drink_cup_box, type: 'supply', unlocked: false },
            { id: 'syrup_box', price: SCORING_CONFIG.PRICES.syrup_box, type: 'supply', unlocked: false },
            { id: 'side_cup_box', price: SCORING_CONFIG.PRICES.side_cup_box, type: 'supply', unlocked: false },
        ];

        // Cart for current order: { itemId: quantity }
        this.cart = {};
        this.shopItems.forEach(item => this.cart[item.id] = 0);

        this.selectedOrderItemIndex = 0;

        // Placement State
        this.placementState = {
            active: false,
            item: null, // item definition from shopItems
            x: 0,
            y: 0
        };

        // Capabilities
        this.capabilities = new Set();

        // Progression
        this.earnedServiceStar = false; // Star 3 (Performance)
        this.currentDayPerfect = true;

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
        const mainGrid = this.createSmallKitchen();

        this.rooms['main'] = mainGrid;

        // 2. Setup Fridge Room
        const fridgeGrid = this.createFridgeRoom();
        this.rooms['fridge'] = fridgeGrid;

        // Set Initial Active Room
        this.currentRoomId = 'main';
        this.grid = this.rooms['main'];

        // Reset Player Position for new game
        this.player.x = 2;
        this.player.y = 1;
        this.player.facing = { x: 0, y: 1 };

        this.player.heldItem = null;

        // Reset Economy
        this.money = 150; // Enough for supplies
        this.dayNumber = 0;
        this.earnedServiceStar = false;

        // Reset Shop Items (Unlocks)
        const alwaysUnlocked = ['patty_box', 'bun_box', 'wrapper_box', 'bag_box', 'counter', 'floor', 'cutting_board', 'dispenser', 'fryer', 'soda_fountain', 'stove', 'expansion', 'continue'];
        this.shopItems.forEach(item => {
            item.unlocked = alwaysUnlocked.includes(item.id);
        });
        this.sortShopItems();

        // Save this clean state immediately so if they refresh they get this
        this.saveLevel();

        this.updateCapabilities();
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
        // CAPABILITY.BASIC_BURGER: Stove + Patty Box + Bun Box
        if (activeTileTypes.has('STOVE') && activeDefIds.has('patty_box') && activeDefIds.has('bun_box')) {
            this.capabilities.add(CAPABILITY.BASIC_BURGER);
        }

        // CAPABILITY.CUT_TOPPINGS: Cutting Board + Tomato Box
        if (activeTileTypes.has('CUTTING_BOARD') && activeDefIds.has('tomato_box')) {
            this.capabilities.add(CAPABILITY.CUT_TOPPINGS);
        }

        // CAPABILITY.ADD_COLD_SAUCE: Dispenser + Mayo Box
        if (activeTileTypes.has('DISPENSER') && activeDefIds.has('mayo_box')) {
            this.capabilities.add(CAPABILITY.ADD_COLD_SAUCE);
        }

        // CAPABILITY.SERVE_FRIES: Fryer + Fry Box + Side Cup Box
        if (activeTileTypes.has('FRYER') && activeDefIds.has('fry_box') && activeDefIds.has('side_cup_box')) {
            this.capabilities.add(CAPABILITY.SERVE_FRIES);
        }

        // CAPABILITY.SERVE_DRINKS: Soda Fountain + Syrup Box + Drink Cup Box
        if (activeTileTypes.has('SODA_FOUNTAIN') && activeDefIds.has('syrup_box') && activeDefIds.has('drink_cup_box')) {
            this.capabilities.add(CAPABILITY.SERVE_DRINKS);
        }

        console.log('Capabilities updated:', Array.from(this.capabilities));
    }

    getPlayerCapabilities() {
        return Array.from(this.capabilities);
    }

    createSmallKitchen() {
        // Direct construction of 7x4 Grid (Expanded size)
        // User requested modifications:
        // 1. Printer -> Top Left (0,0)
        // 2. Shutter -> Next to Printer (1,0)
        // 3. Ticket Wheel -> Under Printer (0,1)
        // 4. Service Counter -> Under Ticket Wheel (0,2)

        const width = 7;
        const height = 4;
        const grid = new Grid(width, height);

        // Row 0 (Top)
        // (0,0) Printer
        grid.setTileType(0, 0, TILE_TYPES.PRINTER);

        // (1,0) Shutter Door (Kitchen Shutter to Fridge)
        grid.setTileType(1, 0, TILE_TYPES.SHUTTER_DOOR);
        grid.getCell(1, 0).state = {
            id: 'kitchen_shutter',
            targetRoom: 'fridge',
            targetDoorId: 'fridge_exit',
            isOpen: true
        };

        // Rest of Row 0
        grid.setTileType(2, 0, TILE_TYPES.COUNTER);
        grid.setTileType(3, 0, TILE_TYPES.COUNTER);
        grid.setTileType(4, 0, TILE_TYPES.STOVE);
        grid.setTileType(5, 0, TILE_TYPES.COUNTER);
        grid.setTileType(6, 0, TILE_TYPES.WALL);

        // Row 1 (Middle 1)
        grid.setTileType(0, 1, TILE_TYPES.TICKET_WHEEL); // Under Printer
        // Fill middle with floor
        for (let x = 1; x < width - 1; x++) {
            grid.setTileType(x, 1, TILE_TYPES.FLOOR);
        }
        grid.setTileType(6, 1, TILE_TYPES.COUNTER); // Right Edge

        // Row 2 (Middle 2)
        grid.setTileType(0, 2, TILE_TYPES.SERVICE); // Under Ticket Wheel
        // Fill middle with floor
        for (let x = 1; x < width - 1; x++) {
            grid.setTileType(x, 2, TILE_TYPES.FLOOR);
        }
        grid.setTileType(6, 2, TILE_TYPES.GARBAGE); // Right Edge (Second from bottom)

        // Row 3 (Bottom)
        grid.setTileType(0, 3, TILE_TYPES.WALL);
        // Fill bottom with Counters
        for (let x = 1; x < width - 1; x++) {
            grid.setTileType(x, 3, TILE_TYPES.COUNTER);
        }
        grid.setTileType(6, 3, TILE_TYPES.WALL);

        return grid;
    }

    createFridgeRoom() {
        // Expanded to fit 14 boxes: 5w x 8h
        // Walls on outer ring (x=0, x=4, y=0)
        // Counters on x=1 and x=3
        // Floor on x=2
        const width = 5;
        const height = 8;
        const grid = new Grid(width, height);

        // 1. Fill base with Walls
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                grid.setTileType(x, y, TILE_TYPES.WALL);
            }
        }

        // 2. Place Counters (Silver Tiles)
        // Rows 1 to 6 (STOP before bottom row 7)
        for (let y = 1; y < height - 1; y++) {
            // Left Counter
            grid.setTileType(1, y, TILE_TYPES.COUNTER);
            // Right Counter
            grid.setTileType(3, y, TILE_TYPES.COUNTER);
        }

        // Top Center Counter
        grid.setTileType(2, 0, TILE_TYPES.COUNTER);

        // 3. Place Center Aisle (Floor)
        // Rows 1 to 6 (Row 7 is door)
        for (let y = 1; y < height - 1; y++) {
            grid.setTileType(2, y, TILE_TYPES.FLOOR);
        }

        // 4. Add Door back to Kitchen
        // At bottom center: (2, 7)
        grid.setTileType(2, 7, TILE_TYPES.SHUTTER_DOOR);
        grid.getCell(2, 7).state = {
            id: 'fridge_exit',
            targetRoom: 'main',
            targetDoorId: 'kitchen_shutter',
            isOpen: true
        };

        return grid;
    }

    expandKitchen() {
        console.log("Expanding Kitchen!");
        const currentGrid = this.grid;

        // Insert a row one from the bottom and a column one from the right
        const colIndex = currentGrid.width - 1;
        const rowIndex = currentGrid.height - 1;

        currentGrid.expandInterior(colIndex, rowIndex);

        // Update player position
        // Since we inserted at specific indices, anything at or beyond those indices shifts by 1
        if (this.player.x >= colIndex) this.player.x += 1;
        if (this.player.y >= rowIndex) this.player.y += 1;

        // Save
        this.saveLevel();
    }

    handleOrderInput(event) {
        // Filter only unlocked items for navigation ?? 
        // Or show all but skip locked?
        // User said "everything else should be locked". Usually implies visible but grayed out.
        // Let's navigate through all, but skip interacting with locked ones?
        // Actually, user said: "change the order... first 4... everything else locked".
        // Let's assume we can select them but not buy/increment.

        const items = this.shopItems;

        const moveSelection = (direction) => {
            let nextIndex = this.selectedOrderItemIndex;
            const count = items.length;
            // Limit loop to avoid infinite loop if all locked (though essentials are always unlocked)
            for (let i = 0; i < count; i++) {
                nextIndex += direction;
                if (nextIndex >= count) nextIndex = 0;
                if (nextIndex < 0) nextIndex = count - 1;

                if (items[nextIndex].unlocked) {
                    this.selectedOrderItemIndex = nextIndex;
                    return;
                }
            }
        };

        if (event.code === 'ArrowUp' || event.code === this.settings.getBinding(ACTIONS.MOVE_UP)) {
            moveSelection(-1);
        } else if (event.code === 'ArrowDown' || event.code === this.settings.getBinding(ACTIONS.MOVE_DOWN)) {
            moveSelection(1);
        }

        const currentItem = items[this.selectedOrderItemIndex];

        if (currentItem.locked || !currentItem.unlocked) {
            // Cannot modify locked items
            // Maybe skip selection? For now just return if user tries to interact
            // But we should allow confirming the order even if we are on a locked item?
        }

        const currentQty = this.cart[currentItem.id] || 0;

        // Count just supplies for the fridge limit
        const fridge = this.rooms['fridge'];
        let emptyCounters = 0;
        if (fridge) {
            for (let y = 0; y < fridge.height; y++) {
                for (let x = 0; x < fridge.width; x++) {
                    const c = fridge.getCell(x, y);
                    if (c.type.id === 'COUNTER' && !c.object) {
                        emptyCounters++;
                    }
                }
            }
        }

        const totalSuppliesInCart = this.shopItems
            .filter(i => i.type === 'supply')
            .reduce((sum, i) => sum + (this.cart[i.id] || 0), 0);

        // Adjust Quantity / Buy Appliance
        if (event.code === 'ArrowRight' || event.code === this.settings.getBinding(ACTIONS.MOVE_RIGHT)) {
            if (currentItem.unlocked) {
                if (currentItem.type === 'supply') {
                    if (totalSuppliesInCart < emptyCounters) {
                        this.cart[currentItem.id]++;
                    }
                } else if (currentItem.type === 'appliance') {
                    // Appliances are boolean? Or just buy and place immediately.
                    // User says: "selecting the button and spends the money, display the kitchen..."
                    // So we treat it as an action button, not a quantity increment.
                    // But if we use Space/Enter to activate?
                    // Let's assume ArrowRight doesn't do anything for appliances, or maybe it toggles '1' if we want to confirm later?
                    // Prompt says: "after the user selects the button and spends the money".
                    // This implies pressing Enter on it.
                }
            }
        } else if (event.code === 'ArrowLeft' || event.code === this.settings.getBinding(ACTIONS.MOVE_LEFT)) {
            if (currentQty > 0 && currentItem.type === 'supply') {
                this.cart[currentItem.id]--;
            }
        }

        // Confirm / Action
        if (event.code === 'Enter') {
            if (currentItem.id === 'continue') {
                // Confirm Order (Supplies)
                // Calculate Total Cost
                let totalCost = 0;
                let essentialCost = 0;

                for (const item of this.shopItems) {
                    if (item.type === 'supply') {
                        const qty = (this.cart[item.id] || 0);
                        const cost = qty * item.price;
                        totalCost += cost;
                        if (item.isEssential) {
                            essentialCost += cost;
                        }
                    }
                }

                // Logic: We must be able to afford the NON-ESSENTIAL items with current money.
                // The ESSENTIAL items can be bought with debt (or existing money).
                const nonEssentialCost = totalCost - essentialCost;

                const fundsAvailableForNonEssentials = Math.max(0, this.money);

                // Day 0: Essentials Check
                if (this.dayNumber === 0) {
                    const missingEssentials = this.shopItems
                        .filter(i => i.isEssential)
                        .some(i => (this.cart[i.id] || 0) === 0);

                    if (missingEssentials) {
                        console.log("Cannot start day: Missing essential items!");
                        return; // Prevent start
                    }
                }

                if (fundsAvailableForNonEssentials >= nonEssentialCost) {
                    this.money -= totalCost;
                    this.startDay();
                } else {
                    console.log("Not enough money! (Cannot cover non-essential items)");
                    // Optional: Visual feedback for not enough money
                }
            } else if (currentItem.type === 'action' && currentItem.unlocked) {
                if (currentItem.id === 'expansion') {
                    if (this.money >= currentItem.price) {
                        this.money -= currentItem.price;
                        this.expandKitchen();
                        currentItem.price *= 2; // Increase price for next time
                    } else {
                        console.log("Not enough money for expansion");
                    }
                }
            } else if (currentItem.type === 'appliance' && currentItem.unlocked) {
                // Enter Build Mode
                this.startPlacement(currentItem);
            }
        }
    }

    startPlacement(applianceItem) {
        console.log(`Starting placement for ${applianceItem.id}`);
        // this.money -= applianceItem.price; // Spend money on placement now

        this.currentRoomId = 'main'; // Ensure we are in kitchen
        this.grid = this.rooms['main'];

        // Use player position, clamped to grid bounds
        let startX = this.player.x;
        let startY = this.player.y;

        // Safety clamp just in case player was out of bounds or in another room context
        if (startX < 0) startX = 0;
        if (startX >= this.grid.width) startX = this.grid.width - 1;
        if (startY < 0) startY = 0;
        if (startY >= this.grid.height) startY = this.grid.height - 1;

        this.placementState = {
            active: true,
            item: applianceItem,
            x: startX,
            y: startY
        };
        this.gameState = 'BUILD_MODE';
    }

    handlePlacementInput(event) {
        if (!this.placementState.active) return;

        let dx = 0;
        let dy = 0;

        if (event.code === 'ArrowUp' || event.code === this.settings.getBinding(ACTIONS.MOVE_UP)) dy = -1;
        if (event.code === 'ArrowDown' || event.code === this.settings.getBinding(ACTIONS.MOVE_DOWN)) dy = 1;
        if (event.code === 'ArrowLeft' || event.code === this.settings.getBinding(ACTIONS.MOVE_LEFT)) dx = -1;
        if (event.code === 'ArrowRight' || event.code === this.settings.getBinding(ACTIONS.MOVE_RIGHT)) dx = 1;

        if (dx !== 0 || dy !== 0) {
            const newX = this.placementState.x + dx;
            const newY = this.placementState.y + dy;
            if (newX >= 0 && newX < this.grid.width && newY >= 0 && newY < this.grid.height) {
                this.placementState.x = newX;
                this.placementState.y = newY;
            }
        }

        if (event.code === 'Enter') {
            if (this.money >= this.placementState.item.price) {
                this.confirmPlacement();
            } else {
                console.log("Not enough money to place!");
            }
        }

        if (event.code === 'Escape') {
            this.placementState.active = false;
            this.gameState = 'ORDERING';
            this.saveLevel();
        }
    }

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
        this.shopItems.sort((a, b) => {
            const getRank = (item) => {
                if (item.id === 'continue') return -1; // Always first
                if (item.type === 'appliance' || item.type === 'action') return 1;
                if (item.unlocked) return 0;
                return 2;
            };
            return getRank(a) - getRank(b);
        });
    }

    startDay() {
        console.log('Starting Day...');
        this.dayNumber++;
        console.log(`Starting Day ${this.dayNumber}...`);

        this.currentDayPerfect = true;

        // 1. Populate Fridge (Do this FIRST so capabilities avail)
        const fridge = this.rooms['fridge'];
        // Note: We NO LONGER clear the fridge. Persistance!

        // Spawn ordered items into VALID EMPTY spots
        // We need to find all counters in the fridge that are EMPTY
        const emptyCounters = [];
        for (let y = 0; y < fridge.height; y++) {
            for (let x = 0; x < fridge.width; x++) {
                const c = fridge.getCell(x, y);
                if (c.type.id === 'COUNTER' && !c.object) {
                    emptyCounters.push(c);
                }
            }
        }

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
        const orders = this.orderSystem.generateDailyOrders(this.dayNumber, capabilities);
        this.ticketQueue = orders;
        this.activeTickets = [];
        this.orders = [];
        this.ticketTimer = 10000; // Force first ticket immediately (at start of next update frame or logic)
        // Actually, let's set it to 10000 so it triggers right away, 
        // or user said "player gets a ticket every 10 seconds". 
        // Usually first one is immediate or after 10s? 
        // "the player gets a ticket every 10 seconds until all the days tickets are printed"
        // Let's make the first one appear at t=0 (now) by setting timer high.

        this.gameState = 'PLAYING';
        this.isDayActive = true;

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
        const songIntro = (this.dayNumber % 2 !== 0) ? ASSETS.AUDIO.SONG1_INTRO : ASSETS.AUDIO.SONG2_INTRO;
        const songLoop = (this.dayNumber % 2 !== 0) ? ASSETS.AUDIO.SONG1_LOOP : ASSETS.AUDIO.SONG2_LOOP;

        this.audioSystem.playMusic(songIntro, songLoop);
        this.audioSystem.setMuffled(false);
        // Find printer to animate and play sound
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
    }

    endDay() {
        console.log('Day Over.');

        // Check for unfinished work
        if (this.ticketQueue.length > 0 || this.activeTickets.length > 0) {
            this.currentDayPerfect = false;
        }

        // Update Service Star Status
        // Note: checking dayNumber > 0 to ensure we don't award it before first play, 
        // though logically if we start perfect it might be fine. 
        // But usually "previous service" implies we must have played one.
        if (this.dayNumber > 0) {
            this.earnedServiceStar = this.currentDayPerfect;
        }

        this.isDayActive = false;
        this.gameState = 'ORDERING';

        // Robust Cart Reset
        this.ticketQueue = [];
        this.activeTickets = [];
        this.ticketQueue = [];
        this.activeTickets = [];
        this.incomingTicket = null;
        this.shopItems.forEach(item => this.cart[item.id] = 0);

        // Force player back to kitchen if in fridge
        if (this.currentRoomId === 'fridge') {
            this.currentRoomId = 'main';
            this.grid = this.rooms['main'];
            this.player.x = 1;
            this.player.y = 1; // In front of shutter
            this.saveLevel();
        }

        // Save progression
        this.saveLevel();
        this.audioSystem.setMuffled(true);
    }

    getStarCount() {
        let stars = 0;

        // Star 1: Two Sides Configured (Fries AND Soda)
        // CAPABILITY.SERVE_FRIES && CAPABILITY.SERVE_DRINKS
        if (this.capabilities.has(CAPABILITY.SERVE_FRIES) && this.capabilities.has(CAPABILITY.SERVE_DRINKS)) {
            stars++;
        }

        // Star 2: Two Toppings Configured (Mayo AND Tomato)
        // CAPABILITY.ADD_COLD_SAUCE && CAPABILITY.CUT_TOPPINGS
        // Note: CAPABILITY.ADD_COLD_SAUCE covers mayo. CAPABILITY.CUT_TOPPINGS covers tomato.
        if (this.capabilities.has(CAPABILITY.ADD_COLD_SAUCE) && this.capabilities.has(CAPABILITY.CUT_TOPPINGS)) {
            stars++;
        }

        // Star 3: Perfect Service
        if (this.earnedServiceStar) {
            stars++;
        }

        return stars;
    }



    handleInput(event) {
        if (!this.keys) this.keys = {};
        this.keys[event.code] = true;

        if (this.audioSystem) this.audioSystem.resume();

        if (event.code === 'KeyC') {
            this.money += 500;
            console.log(`Cheat: Added $500. New Balance: ${this.money}`);
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
                    this.gameState = 'ORDERING';
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
                'INTERACT', 'PICK_UP',
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

        if (this.gameState === 'ORDERING') {
            this.handleOrderInput(event);
            return;
        }

        if (this.gameState === 'BUILD_MODE') {
            this.handlePlacementInput(event);
            return;
        }

        if (event.code === 'KeyE' && event.shiftKey) {
            this.editor.toggle();
            // If we just closed the editor, update capabilities as appliances might have changed
            if (!this.editor.isActive) {
                this.updateCapabilities();
            }
            return;
        }

        if (this.editor.isActive) return;

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
                this.endDay();
                return;
            }
            this.player.actionPickUp(this.grid);
        }

        if (code === this.settings.getBinding(ACTIONS.INTERACT)) {
            this.player.actionInteract(this.grid);
        }

        if (dx !== 0 || dy !== 0) {
            const moved = this.player.move(dx, dy, this.grid);
            if (moved) {
                // Check if we stepped onto a door
                const cell = this.grid.getCell(this.player.x, this.player.y);
                if (cell && cell.type.isDoor) {
                    this.handleDoorTraversal(cell);
                }
            } else {
                // Blocked. Are we standing on a door attempting to leave?
                const currentCell = this.grid.getCell(this.player.x, this.player.y);
                if (currentCell && currentCell.type.isDoor) {
                    this.handleDoorTraversal(currentCell);
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
            console.warn(`Target door '${targetDoorId}' not found in room '${nextRoomId}'. Spawning at default.`);
        }

        // Perform Switch
        this.currentRoomId = nextRoomId;
        this.grid = nextRoom;
        this.player.x = spawnX;
        this.player.y = spawnY;

        // Optional: Update Editor reference if needed
        this.editor.game = this; // Ensure editor points to current game/grid state implies referencing `this.grid` which it does via `this.game.grid` hopefully

        console.log(`Switched to room: ${nextRoomId}`);
        // Auto-save on room transition
        // Auto-save on room transition
        this.saveLevel();

        // Capabilities shouldn't change on room switch usually, but good to ensure consistency? 
        // No, capabilities are global based on ALL rooms. No change needed here.
    }

    update(dt) {
        if (!dt) return;

        // Floating Text Update
        this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
        this.floatingTexts.forEach(ft => {
            ft.life -= dt / 1000;
        });

        // Ticket Arrival Logic
        if (this.isDayActive) {
            // Ticket Arrival Logic
            // Always increment arrival timer to maintain rhythm
            this.ticketTimer += dt;

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

        // Truck Status Check
        const kShutter = this.rooms['main'].getCell(6, 0);
        if (kShutter && kShutter.state.isOpen) {
            const truck = this.rooms['truck'];
            let hasItems = false;
            for (let y = 0; y < truck.height; y++) {
                for (let x = 0; x < truck.width; x++) {
                    if (truck.getCell(x, y).object) {
                        hasItems = true;
                        break;
                    }
                }
                if (hasItems) break;
            }

            if (!hasItems) {
                console.log("Truck empty! Closing shutter.");
                kShutter.state.isOpen = false;
            }
        }


        // Iterate entire grid for appliance logic
        // Optimization: Maintain a list of active appliances if grid is large.
        // For 12x8, iterating all is fine.
        for (let y = 0; y < this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                const cell = this.grid.getCell(x, y);

                // Stove Logic
                if (cell.type.id === 'STOVE' && cell.state.isOn) {
                    const item = cell.object;
                    // Check if item has cooking definition
                    if (item && item.definition.cooking && item.definition.cooking.stages) {
                        const currentStage = item.state.cook_level || 'raw';
                        const stageDef = item.definition.cooking.stages[currentStage];

                        if (stageDef) {
                            item.state.cookingProgress += dt;
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
                        const max = cell.state.cookingSpeed || 2000;
                        if (cell.state.timer >= max) {
                            cell.state.status = 'done';
                            cell.state.timer = 0;
                            console.log('Fries done!');
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

                        // Try to satisfy ANY active ticket
                        // We iterate to find a match
                        let matchedTicketIndex = -1;
                        let matchResult = null;

                        for (let i = 0; i < this.activeTickets.length; i++) {
                            const t = this.activeTickets[i];
                            const res = t.verifyBag(cell.object);
                            if (res.matched) {
                                matchedTicketIndex = i;
                                matchResult = res;
                                break;
                            }
                        }

                        if (matchedTicketIndex !== -1) {
                            console.log(`Order Bag Verified! Payout: $${matchResult.payout}`);
                            const ticket = this.activeTickets[matchedTicketIndex];

                            // Reward
                            this.money += matchResult.payout;

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

                                this.addFloatingText(message + ` ($${bonus})`, x, y, color);

                                // Remove from active list
                                this.activeTickets.splice(matchedTicketIndex, 1);

                                // Check if Day is Done (No queue, no active)
                                if (this.ticketQueue.length === 0 && this.activeTickets.length === 0) {
                                    // End Day Immediately
                                    setTimeout(() => {
                                        this.endDay();
                                    }, 1500);
                                }
                            }

                            // Refresh orders view
                            this.orders = this.activeTickets.map(t => t.toDisplayFormat());
                        }
                    }
                }
            }
        }

        // Ticket Wheel Interaction Logic
        this.isViewingOrders = false;
        if (this.keys[this.settings.getBinding(ACTIONS.INTERACT)] && !this.editor.isActive) {
            // Debug: check keys
            // console.log('KeyE held');
            const facingCell = this.player.getTargetCell(this.grid);
            if (facingCell) {
                // console.log('Facing:', facingCell.type.id);
            }
            if (facingCell && facingCell.type.id === 'TICKET_WHEEL') {
                this.isViewingOrders = true;
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
            } else if (this.gameState === 'ORDERING') {
                this.renderer.renderOrderScreen({
                    money: this.money,
                    cart: this.cart,
                    shopItems: this.shopItems, // Pass the full list instead of prices
                    selectedIndex: this.selectedOrderItemIndex,
                    dayNumber: this.dayNumber,
                    stars: this.getStarCount()
                });
            } else if (this.gameState === 'BUILD_MODE') {
                // Render Game underneath
                this.renderer.render({
                    grid: this.grid,
                    player: null, // Don't show player during placement?
                    // Or show player? Usually placement hides player or just locks them.
                    // Request says: "display the kitchen with the new asset i made for you, 'assets/selector.png'. thats a curser"
                    // So we probably render the grid normally.
                    placementState: this.placementState // Pass this so HUD can draw
                });
                // Render Cursor Overlay
                this.renderer.renderPlacementCursor(this.placementState);
            } else {
                this.update(dt);
                this.renderer.render({
                    grid: this.grid,
                    player: this.player,
                    isViewingOrders: this.isViewingOrders,
                    orders: this.orders,
                    money: this.money,
                    floatingTexts: this.floatingTexts,
                    pickUpKey: this.settings.getBinding(ACTIONS.PICK_UP),
                    penalty: this.activeTickets.length * 20,
                    activeTickets: this.activeTickets
                });
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
                earnedServiceStar: this.earnedServiceStar,
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
}

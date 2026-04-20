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

import { MenuSystem } from './systems/MenuSystem.js';
import { TouchInputSystem } from './systems/TouchInputSystem.js';
import { InputManager } from './systems/InputManager.js';
import { ServiceCycle } from './systems/ServiceCycle.js';

import { AlertSystem } from './systems/AlertSystem.js';
import { PowerupSystem } from './systems/PowerupSystem.js';

export class Game {

    constructor() {
        this.TOPPING_POOL = [
            'lettuce_leaf',
            'tomato_slice',
            'pickle_slice',
            'onion_slice',
            'mushroom_slice',
            'cheddar_cheese',
            'swiss_cheese',
            'bacon',
            'mayo',
            'bbq',
            'burger_sauce',
            'chicken_patty',
            'sweet_potato_fries'
        ];

        this.TOPPING_BOX_MAP = {
            'lettuce_leaf': 'lettuce_box',
            'tomato_slice': 'tomato_box',
            'pickle_slice': 'pickle_box',
            'onion_slice': 'onion_box',
            'mushroom_slice': 'mushroom_box',
            'cheddar_cheese': 'cheddar_box',
            'swiss_cheese': 'swiss_box',
            'bacon': 'bacon_box',
            'mayo': 'mayo_bottle',
            'bbq': 'bbq_bottle',
            'burger_sauce': 'burger_sauce_bottle',
            'chicken_patty': 'chicken_patty_box',
            'sweet_potato_fries': 'sweet_potato_fry_box'
        };

        this.assetLoader = new AssetLoader();
        this.grid = new Grid(GRID_WIDTH, GRID_HEIGHT);
        this.renderer = null;
        this.player = new Player(4, 4);


        this.alertSystem = new AlertSystem(this);
        this.settings = new Settings();
        this.audioSystem = new AudioSystem(this.settings);

        this.toppingCharges = {};
        this.TOPPING_POOL.forEach(id => {
            this.toppingCharges[id] = 1;
        });

        // Systems

        this.menuSystem = new MenuSystem(this);
        this.touchInputSystem = new TouchInputSystem(this);
        this.powerupSystem = new PowerupSystem(this);
        this.inputManager = new InputManager(this);
        this.serviceCycle = new ServiceCycle(this);

        this.gameState = 'TITLE'; // TITLE, PLAYING, SETTINGS
        this.titleSelection = 0; // 0: New Game, 1: Settings
        this.settingsState = {
            selectedIndex: 0,
            rebindingAction: null
        };
        this.currentSongIndex = -1;
        this.isViewingOrders = false;
        this.orderSystem = new OrderSystem();
        this.dayNumber = 0;
        this.orders = [];
        this.ticketQueue = [];    // Pending tickets to arrive
        this.activeTickets = [];  // Tickets currently on the rail
        this.ticketTimer = 0;     // Timer for next ticket arrival
        this.incomingTicket = null; // Ticket currently printing
        this.printingTimer = 0;     // Animation timer for printing

        this.rooms = {};
        this.currentRoomId = 'main';
        this.ticketWheelAnimStartTime = 0;

        this.isDayActive = false;

        // Visual Feedback
        this.floatingTexts = [];
        this.effects = [];

        // High Score System
        this.score = 0;
        this.highScore = parseFloat(localStorage.getItem('burger_joint_highscore_v2')) || 0;
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

        // XP & Level System
        this.xp = 0;
        this.level = 1;
        this.xpToNextLevel = 7;
        this.ticketSpeedBonus = 0;
        
        // Bomb Breakdown Logic
        this.bombEffectActive = false;
        this.bombEffectTimer = 0;
        this.screenShake = 0;



        // Capabilities
        this.capabilities = new Set();

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



    get isRushMode() {
        // RUSH if Day is Active AND Queue is NOT finished
        return this.isDayActive && !this.queueFinishedTime;
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

            this.startNewGame();

            this.loop();
        } catch (error) {
            console.error('Initialization failed:', error);
            document.body.innerHTML = `<h1 style="color:red">${error.message}</h1>`;
        }
    }

    startNewGame() {
        console.log('Starting new game with default layout.');
        this.pattyBoxTutorialShown = false;
        this.unlockMiniGameShown = false;

        // Continue Title Theme (Muffled) for Day 0 Setup
        this.audioSystem.setMuffled(true);

        // Reset Session Score
        this.score = 0;

        // Clear existing rooms if any
        this.rooms = {};

        // 1. Setup Main Room (Kitchen)
        const mainGrid = new Grid(DEFAULT_LEVEL.width, DEFAULT_LEVEL.height);
        mainGrid.deserialize(DEFAULT_LEVEL);
        this.rooms['main'] = mainGrid;

        // Spawn Starting Inserts (Stack of 9)
        const insertStack = new ItemInstance('insert');
        insertStack.state.count = 9;
        // Bottom row, column 12 (to ensure it places on a valid counter given layout changes)
        const startX = 12;
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
        this.player.snap();

        this.player.heldItem = null;

        this.dayNumber = 0;
        this.ticketSpeedBonus = 0;

        this.queueFinishedTime = null;
        this.isDayActive = false;
        this.testAlertShown = false;

        this.gameState = 'TITLE';
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

        // CAPABILITY.ADD_COLD_SAUCE: Any sauce bottle present
        const hasSauceBottle = activeDefIds.has('mayo_bottle') || activeDefIds.has('bbq_bottle') || activeDefIds.has('burger_sauce_bottle');
        if (hasSauceBottle) {
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



        // 1. Handle Morning Orders via Trigger System
        this.serviceCycle.triggerChute('START_DAY');

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

        this.playNextSong();

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
        this.dailyBagsSold = 0;

        // Ensure player is in Main Room (Kitchen) to start the day
        if (this.currentRoomId !== 'main') {
            console.log("Resetting player to Main Room for start of day.");
            this.currentRoomId = 'main';
            this.grid = this.rooms['main'];
            this.player.x = 2; // Center-ish
            this.player.y = 3;
            this.player.snap();
        }

        // Initialize Loop Timers
        this.dayTimer = 0; // Starts at 0 (Morning)
        this.currentShift = 'DAY';
        this.shiftCount = 0;
        this.ticketSpawnTimer = 9999; // Force immediate ticket
        this.lightingIntensity = 0;

        console.log(`Starting Continuous Service Loop. Complexity: ${complexity})`);
    }

    playNextSong() {
        const songs = [
            { intro: ASSETS.AUDIO.SONG1_INTRO, loop: ASSETS.AUDIO.SONG1_LOOP },
            { intro: ASSETS.AUDIO.SONG2_INTRO, loop: ASSETS.AUDIO.SONG2_LOOP },
            { intro: ASSETS.AUDIO.SONG3_INTRO, loop: ASSETS.AUDIO.SONG3_LOOP },
            { intro: ASSETS.AUDIO.SONG4_INTRO, loop: ASSETS.AUDIO.SONG4_LOOP },
            { intro: ASSETS.AUDIO.SONG5_INTRO, loop: ASSETS.AUDIO.SONG5_LOOP },
            { intro: ASSETS.AUDIO.SONG6_INTRO, loop: ASSETS.AUDIO.SONG6_LOOP }
        ];

        let newIndex;
        // Play songs 1 to 6 in order (indices 0 to 5)
        if (this.currentSongIndex < 5) {
            newIndex = this.currentSongIndex + 1;
        } else {
            // After song 6, pick random songs, making sure it's not the same as the current one
            do {
                newIndex = Math.floor(Math.random() * songs.length);
            } while (songs.length > 1 && newIndex === this.currentSongIndex);
        }

        this.currentSongIndex = newIndex;
        const song = songs[newIndex];
        this.audioSystem.playMusic(song.intro, song.loop);
        this.audioSystem.setMuffled(false);
    }

    onClosingTime() { this.serviceCycle.onClosingTime(); }


    // Called when player exits the door
    endDay() {
        // Ensure we can only end day if service is finished
        if (this.isDayActive && !this.queueFinishedTime) {
            this.addFloatingText("Finish Service First!", this.player.x, this.player.y, '#ff0000');
            return;
        }

        this.startDay();
        this.gameState = 'PLAYING';
        this.audioSystem.setMuffled(true);
    }




    // Input handling moved to src/systems/InputManager.js



    update(dt) {
        if (!dt) return;

        if (this.bombEffectActive) {
            this.bombEffectTimer -= dt;
            if (this.bombEffectTimer <= 0) {
                this.bombEffectTimer = 0;
                this.bombEffectActive = false;
            }
        }

        this.updateSystems(dt);
        this.updateWorldState(dt);
        this.serviceCycle.update(dt);
        this.updateOfficeState();
    }

    // Ticket spawning/stability/appliance updates moved to src/systems/ServiceCycle.js

    updateSystems(dt) {
        this.player.update(dt);
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

        // --- NEW: Finalize Completed Tickets after clock resumes ---
        if (this.timeFreezeTimer <= 0) {
            for (let i = this.activeTickets.length - 1; i >= 0; i--) {
                const ticket = this.activeTickets[i];
                if (ticket.isComplete()) {
                    const pos = ticket.finalizePos || { x: 3, y: 3 };
                    this.serviceCycle._finalizeTicket(ticket, i, pos.x, pos.y);
                }
            }
        }

        this.serviceCycle.updateFallingBoxes(dt);

        // Tutorials
        const isHoldingPattyBox = this.player.heldItem && (this.player.heldItem.definitionId === 'patty_box');
        if (isHoldingPattyBox && !this.pattyBoxTutorialShown) {
            this.pattyBoxTutorialShown = true;
            this.alertSystem.trigger('container_tutorial_1');
        }

        // UI State
        const viewKey = this.settings.getBinding(ACTIONS.VIEW_ORDERS);
        this.isViewingOrders = !!(this.inputManager.keys[viewKey]);

        // Feedback & Effects
        this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
        this.floatingTexts.forEach(ft => ft.life -= dt / 1000);

        if (this.effects) {
            this.effects = this.effects.filter(e => (Date.now() - e.startTime) < e.duration);
        }
    }

    // _finalizeTicket, updateFallingBoxes, triggerChute, dropInChute moved to ServiceCycle.js

    updateOfficeState() {
        const hasActiveOrders = (this.activeTickets.length > 0) ||
            (this.ticketQueue.length > 0) ||
            (this.incomingTicket != null);

        // 1. Office Door Logic: (Removed per user request)

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

            } else {
                // Standard Game Render (PLAYING, PAUSED, and all Overlay Menus)
                if (this.gameState === 'PLAYING' || this.gameState === 'APPLIANCE_SWAP' || this.gameState === 'PAUSED') {
                    if (this.gameState === 'PLAYING') {
                        if (this.alertSystem && this.alertSystem.isVisible) {
                            // Paused for alert - still update alert animation
                            this.alertSystem.update(dt);
                        } else {
                            this.update(dt);
                        }
                    }
                    
                    if (this.gameState !== 'PAUSED') {
                        this.inputManager.update(dt);
                    }
                }
                this.renderer.render(this);
                if (this.gameState === 'PAUSED') {
                    this.renderer.renderPauseScreen(this);
                }
            }
        }
        requestAnimationFrame((t) => this.loop(t));
    }

    // initiateApplianceSwap, handleApplianceSwapInput moved to InputManager.js

    spawnDirtyPlate(x, y) {
        const grid = this.rooms['main'];
        if (!grid) return;

        // Define the spots to try if this is the dirty plate return area (index 12 is column 13)
        const spots = (x === 12 && y === 2) ? [
            { x: 12, y: 2 },
            { x: 13, y: 2 },
            { x: 14, y: 2 }
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






    addEffect(effect) {
        this.effects.push(effect);
    }

    hasAppliance(itemId, tileTypeId) {
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

    addXp(amount) {
        this.xp += amount;
        if (this.xp >= this.xpToNextLevel) {
            this.xp -= this.xpToNextLevel;
            this.levelUp();
        }
    }

    getAvailableToppingPool() {
        return this.TOPPING_POOL.filter(toppingId => {
            const charges = this.toppingCharges[toppingId] || 0;
            return charges > 0;
        });
    }

    getToppingButtonConfig(id) {
        const def = DEFINITIONS[id];
        const boxId = this.TOPPING_BOX_MAP[id];
        const boxDef = DEFINITIONS[boxId];

        // Standard box texture logic from ItemInstance.js
        let boxImg = boxDef ? (boxDef.texture || `${boxId}-closed.png`) : null;
        if (boxDef && boxDef.textures && boxDef.textures.base) boxImg = boxDef.textures.base;

        return {
            label: def ? (def.name || id) : id,
            image: '/assets/ui/button_background-boil.png',
            boxImage: boxImg ? `/assets/${boxImg}` : null,
            action: { type: 'unlock_topping', toppingId: id }
        };
    }

    getRerollToppings(count, excludeIds = []) {
        const pool = this.getAvailableToppingPool().filter(id => !excludeIds.includes(id));
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    levelUp() {
        this.level++;
        this.xpToNextLevel = 7;

        const availablePool = this.getAvailableToppingPool();

        if (availablePool.length === 0) {
            this.addFloatingText("MAX LEVEL REACHED!", this.player.x, this.player.y, '#ffd700');
            return;
        }

        this.audioSystem.setMuffled(true);

        let choice = null;
        this.alertSystem.trigger('level_up_choice', () => {
            if (choice === 'faster_tickets') {
                this.applyTicketSpeedBoost();
                this.audioSystem.setMuffled(false);
                this.playNextSong();
            } else {
                this._showToppingPickerAlert(availablePool);
            }
        }, {
            onChoice: (c) => { choice = c; }
        });
    }

    applyTicketSpeedBoost() {
        this.ticketSpeedBonus += SCORING_CONFIG.GAME_PACING.TICKET_SPEED_INCREMENT;
        this.addFloatingText("TICKET SPEED ++", this.player.x, this.player.y, '#ffd700');
    }

    _showToppingPickerAlert(availablePool) {
        const shuffled = [...availablePool].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);

        const buttons = [{
            id: 'reroll_button',
            label: 'Reroll',
            image: '/assets/ui/button-clean.png',
            boxImage: '/assets/ui/reroll.png',
            action: 'reroll'
        }];

        buttons.push(...selected.map(id => this.getToppingButtonConfig(id)));

        buttons.push({
            label: 'OK',
            image: '/assets/ui/button_background-boil.png',
            action: 'dismiss'
        });

        this.alertSystem.trigger('level_up', () => {
            this.playNextSong();
        }, { buttons });
    }

    unlockTopping(toppingId, slotIndex = null) {
        console.log(`[Game] Unlocking Topping: ${toppingId} for slot: ${slotIndex}`);

        if (this.toppingCharges[toppingId] > 0) {
            this.toppingCharges[toppingId]--;
        }

        const def = DEFINITIONS[toppingId];
        const isTopping = def && (def.isTopping || def.category === 'topping' || toppingId.includes('cheese') || toppingId === 'bacon');
        const isAlt = toppingId === 'chicken_patty' || toppingId === 'sweet_potato_fries';

        if (toppingId === 'chicken_patty') {
            this.menuSystem.addChickenBurger();
            // Refresh charges for all toppings for the new burger
            this.TOPPING_POOL.forEach(id => {
                const tDef = DEFINITIONS[id];
                const tIsTopping = tDef && (tDef.isTopping || tDef.category === 'topping' || id.includes('cheese') || id === 'bacon');
                if (tIsTopping && id !== 'chicken_patty') {
                    this.toppingCharges[id] = (this.toppingCharges[id] || 0) + 1;
                }
            });
        } else if (isTopping && !isAlt) {
            this.menuSystem.addToppingToMenu(toppingId, slotIndex);
        }

        // Drop the supply box down the chute
        const boxId = this.TOPPING_BOX_MAP[toppingId];
        if (boxId) {
            this.serviceCycle.dropInChute(new ItemInstance(boxId));
        }

        this.addFloatingText(`Unlocked: ${toppingId}!`, this.player.x, this.player.y, '#ffd700');
        this.updateCapabilities();
    }
}

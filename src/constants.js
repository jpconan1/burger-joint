import { CAPABILITY } from './data/definitions.js';

export const TILE_SIZE = 64;

export const ASSETS = {
    TILES: {
        FLOOR: 'floor-tile.png',
        WALL: 'wall-tile.png',
        COUNTER: 'counter-tile.png',
        SERVICE: 'service-counter.png',
        STOVE_OFF: 'stovetop-off.png',
        STOVE_ON: 'stovetop-on.png',
        CUTTING_BOARD: 'cutting_board.png',
        CUTTING_BOARD_TOMATO: 'cutting_board-tomato.png',
        CUTTING_BOARD_SLICE: 'cutting_board-tomato-slice.png',
        CUTTING_BOARD_DIRTY: 'cutting_board-dirty.png',
        DISPENSER: 'dispenser.png',
        DISPENSER_EMPTY: 'dispenser-empty.png',
        DISPENSER_FULL: 'dispenser-full.png', // Overlay
        DISPENSER_PARTIAL1: 'dispenser-partial1.png', // Overlay
        DISPENSER_PARTIAL2: 'dispenser-partial2.png', // Overlay
        FRYER: 'fryer.png',
        FRYER_FRIES: 'fryer-fries.png',
        FRYER_BASKET_DOWN: 'fryer-down.png',
        SODA_FOUNTAIN_EMPTY: 'soda_fountain-empty.png',
        SODA_FOUNTAIN_FULL: 'soda_fountain-full.png',
        SODA_FOUNTAIN_WARNING: 'soda_fountain-warning.png',
        SODA_FOUNTAIN_FILLING: 'soda_fountain-filling.png',

        SODA_SIGN: 'soda-sign.png',
        HETAP_SIGN: 'hetap-sign.png',
        SHUTTER_TILE_OPEN: 'shutter_tile-open.png',
        SHUTTER_TILE_CLOSED: 'shutter_tile-closed.png',
        TICKET_WHEEL: 'ticket_wheel.png',
        PRINTER: 'printer_tile.png',
        PRINTER_PRINT1: 'printer_tile-print1.png',
        PRINTER_PRINT2: 'printer_tile-print2.png',
        PRINTER_PRINT3: 'printer_tile-print3.png',
        TICKET_WHEEL_ORDER: 'ticket_wheel-order.png',
        TICKET_WHEEL_FRAME1: 'ticket_wheel-frame1.png',
        TICKET_WHEEL_FRAME2: 'ticket_wheel-frame2.png',
        GARBAGE: 'garbage-tile.png',
        OFFICE_DOOR: 'office_door.png',
        COMPUTER: 'computer.png',
        EXIT_DOOR: 'exit_door.png',
        RENO: 'reno.png',
        OFFICE_DOOR_OPEN: 'office_door-open.png',
        OFFICE_DOOR_CLOSED: 'office_door-closed.png',
        LOCKED: 'locked.png',
        DELIVERY_TILE: 'delivery-tile.png',
        MENU: 'menu.png',
        PREP: 'prep.png',
    },
    OBJECTS: {

        BUN: 'bun.png',
        BUN_BOTTOM: 'bun_bottom.png',
        BUN_TOP: 'bun_top.png',
        WHOLE_WHEAT_BUN: 'whole_wheat_bun.png',
        WHOLE_WHEAT_BUN_BOTTOM: 'whole_wheat_bun_bottom.png',
        WHOLE_WHEAT_BUN_TOP: 'whole_wheat_bun_top.png',
        BURGER: 'burger.png',
        BURGER_TOMATO: 'burger-tomato.png',
        BURGER_WRAPPED: 'burger-wrapped.png',

        // Dynamic Assets (Aliased on disk for now)
        BUN_BOX_CLOSED: 'bun_box-closed.png',
        PATTY_BOX_CLOSED: 'patty_box-closed.png',
        EMPTY_BOX: 'empty-box.png',
        OPEN_BOX: 'box-open.png',


        PATTY_RAW: 'patty-raw.png',
        STOVETOP_PATTY_PART: 'stovetop-patty-part.png',
        STOVETOP_BACON_PART: 'stovetop-bacon-part.png',
        PATTY_COOKED: 'patty-cooked.png',
        PATTY_PART: 'beef_patty-part.png',
        WRAPPER: 'wrapper.png',
        WRAPPER_BOX_CLOSED: 'wrapper_box-closed.png',
        TOMATO_BOX_CLOSED: 'tomato_box-closed.png',
        TOMATO: 'tomato.png',
        TOMATO_PART: 'tomato-part.png',
        TOMATO_SLICE: 'tomato-slice.png',
        MAYO_BOX_CLOSED: 'mayo_box-closed.png',
        MAYO_BAG: 'mayo-bag.png',
        MAYO_PART: 'mayo-part.png',
        BBQ_BAG: 'bbq-bag.png',
        BBQ_PART: 'bbq-part.png',
        BURGER_SAUCE_BAG: 'burger_sauce-bag.png',
        BURGER_SAUCE_PART: 'burger_sauce-part.png',
        // Lettuce
        LETTUCE_BOX_CLOSED: 'lettuce_box-closed.png',
        LETTUCE_HEAD: 'lettuce-head.png',
        LETTUCE_LEAF: 'lettuce-leaf.png',
        LETTUCE_PART: 'lettuce-part.png',
        BURGER_MAYO: 'burger-mayo.png',
        BURGER_MAYO: 'burger-mayo.png',
        BURGER_TOMATO_MAYO: 'burger-tomato-mayo.png',
        // Fries
        FRY_BOX_CLOSED: 'fry_box-closed.png',
        FRY_BAG: 'fry_bag.png',
        FRY_BAG_OPEN_FULL: 'fry_bag-open-full.png',
        FRY_BAG_OPEN_PARTIAL1: 'fry_bag-open-partial1.png',
        FRY_BAG_OPEN_PARTIAL2: 'fry_bag-open-partial2.png',
        FRY_BAG_EMPTY: 'fry_bag-empty.png',
        FRIES: 'fries.png', // Final product
        SIDE_CUP: 'side_cup.png',
        SIDE_CUP_BOX_CLOSED: 'side_cup_box-closed.png',
        DRINK_CUP: 'drink_cup.png',
        SYRUP_BOX_CLOSED: 'syrup_box-closed.png',
        SODA_SYRUP: 'soda_syrup.png',
        SODA: 'soda.png',
        DRINK_CUP_BOX_CLOSED: 'drink_cup_box-closed.png',

        // Bags
        BAG_BOX_CLOSED: 'bag_box-closed.png',
        BAG_EMPTY: 'bag-empty.png',
        BAG_BURGER: 'bag-burger.png',
        BAG_SODA: 'bag-soda.png',
        BAG_FRIES: 'bag-fries.png',
        BAG_BURGER_FRIES: 'bag-burger-fries.png',
        BAG_BURGER_SODA: 'bag-burger-soda.png',
        BAG_SODA_FRIES: 'bag-soda-fries.png',
        BAG_BURGER_SODA_FRIES: 'bag-burger-soda-fries.png',

        // Spoiled Items
        BUN_OLD: 'bun-old.png',
        BURGER_OLD: 'burger-old.png',
        BAG_OLD: 'bag-old.png',
        FRIES_OLD: 'fries-old.png',
        PATTY_OLD: 'patty-old.png',
        SODA_OLD: 'soda-old.png',
        TOMATO_OLD: 'tomato-old.png',
        TOMATO_WILT1: 'tomato-wilt1.png',
        TOMATO_WILT2: 'tomato-wilt2.png',
        SPOIL: 'spoil.png',

        LETTUCE_HEAD_OLD: 'lettuce-head-old.png',
        LETTUCE_HEAD_WILT1: 'lettuce-head-wilt1.png',
        LETTUCE_HEAD_WILT2: 'lettuce-head-wilt2.png',
    },
    PLAYER: {
        NEUTRAL: 'player-neutral.png',
        HAPPY: 'player-neutral.png',
    },
    TOOLS: {

        HANDS: 'hands.png',
    },
    UI: {
        INSERT_LABEL: 'insert-label.png',
        ORDER_TICKET: 'ui/order_ticket.png',
        SELECTOR: 'ui/selector.png',
        BUY_BUTTON: 'buy_button.png',
        RENO_BUILD_MODE: 'build-mode-button.png',
        RENO_EXPAND: 'expand-button.png',
        RENO_ITEM_BG: 'button-background.png',
        RENO_ICON_COUNTER: 'counter-tile-trans.png',
        RENO_ICON_CUTTING_BOARD: 'cutting_board-trans.png',
        RENO_ICON_DISPENSER: 'dispenser-trans.png',
        RENO_ICON_FRYER: 'fryer-trans.png',
        RENO_ICON_SODA_FOUNTAIN: 'soda_fountain-trans.png',
        RENO_MENU_BG: 'reno-menu-bg.png',
        MENU_BG: 'ui/menu_bg.png', // New background for Custom Menu
        MENU_LOGO: 'ui/menu_logo.png',
        ADD_BURGER_BUTTON: 'ui/add_burger_button.png',
        ADD_SIDE_BUTTON: 'ui/add_side_button.png',
        ADD_DRINK_BUTTON: 'ui/add_drink_button.png',
        CHECKERBOARD_BUTTON: 'ui/checkerboard_button.png',
        BUTTON_BACKGROUND: 'ui/button_background.png',
        BUTTON_BACKGROUND_OPTIONAL: 'ui/button_background-optional.png',
        BUTTON_ARROWS: 'ui/button_arrows.png',
        TEXT_FIELD: 'ui/text_field.png',
        PLUS_BUTTON: 'ui/plus_button.png',
        TICKET_BG: 'ui/ticket_bg.png',
        NEW_TOPPING_IDLE: 'postday_ui/new_topping-idle.png',
        NEW_TOPPING_SELECTED: 'postday_ui/new_topping-selected.png',
        NEW_SIDE_IDLE: 'postday_ui/new_side-idle.png',
        NEW_SIDE_SELECTED: 'postday_ui/new_side-selected.png',
        NEW_DRINK_IDLE: 'postday_ui/new_drink-idle.png',
        NEW_DRINK_SELECTED: 'postday_ui/new_drink-selected.png',
        NEW_SIDE_LOCKED_IDLE: 'postday_ui/new_side-locked-idle.png',
        NEW_SIDE_LOCKED_SELECTED: 'postday_ui/new_side-locked-selected.png',
        NEW_DRINK_LOCKED_IDLE: 'postday_ui/new_drink-locked-idle.png',
        NEW_DRINK_LOCKED_SELECTED: 'postday_ui/new_drink-locked-selected.png',
        STAR_FILLED: 'star.png',
        STAR_EMPTY: 'star_outline_w.png',
        GREEN_ARROW: 'ui/green_arrow.png',
        MENU_BUTTON_IDLE: 'ui/menu_button-idle.png',
        MENU_BUTTON_SELECTED: 'ui/menu_button-selected.png',
        BUILD_BUTTON_IDLE: 'ui/build_button-idle.png',
        BUILD_BUTTON_SELECTED: 'ui/build_button-selected.png',
        SUPPLY_METER: 'ui/supply_meter.png',
        GAME_BORDER_TOP_LEFT: 'ui/game_border-top-left.png',
        GAME_BORDER_TOP_RIGHT: 'ui/game_border-top-right.png',
        GAME_BORDER_BOTTOM_LEFT: 'ui/game_border-bottom-left.png',
        GAME_BORDER_BOTTOM_RIGHT: 'ui/game_border-bottom-right.png',
        GAME_BORDER_TOP: 'ui/game_border-top-row.png',
        GAME_BORDER_BOTTOM: 'ui/game_border-bottom-row.png',
        GAME_BORDER_LEFT: 'ui/game_border-left-column.png',
        GAME_BORDER_RIGHT: 'ui/game_border-right-column.png',
        CRUMPLED_PAPER_BACKGROUND: 'ui/crumpled_paper_background.png',
    },
    AUDIO: {
        SONG1_INTRO: 'audio/song1-intro.wav',
        SONG1_LOOP: 'audio/song1.wav',
        SONG2_INTRO: 'audio/song2-intro.wav',
        SONG2_LOOP: 'audio/song2.wav',
        SONG3_INTRO: 'audio/song3-intro.wav',
        SONG3_LOOP: 'audio/song3.wav',
        SONG4_INTRO: 'audio/song4-intro.wav',
        SONG4_LOOP: 'audio/song4.wav',
        TITLE_THEME: 'audio/title-theme.wav',
        PRINTER: 'audio/printer.wav',
    },
    TUTORIAL: {
        BUBBLE: 'tutorial/bubble.png', // Placeholder for the sprite sheet
        BUBBLE_TOP: 'tutorial/bubble-top.png',
        BUBBLE_BOTTOM: 'tutorial/bubble-bottom.png',
        // Add more here as needed, e.g. BUBBLE_ARROW: 'tutorial/bubble_arrow.png'
    }
};

export const TILE_TYPES = {
    FLOOR: {
        id: 'FLOOR',
        texture: ASSETS.TILES.FLOOR,
        walkable: true,
        holdsItems: false,
    },
    WALL: {
        id: 'WALL',
        texture: ASSETS.TILES.WALL,
        walkable: false,
        holdsItems: false,
    },
    COUNTER: {
        id: 'COUNTER',
        texture: ASSETS.TILES.COUNTER,
        walkable: false,
        holdsItems: true,
    },
    SERVICE: {
        id: 'SERVICE',
        texture: ASSETS.TILES.SERVICE,
        walkable: false,
        holdsItems: true, // Specifically for burgers, can refine later
    },
    STOVE: {
        id: 'STOVE',
        texture: ASSETS.TILES.STOVE_OFF,
        walkable: false,
        holdsItems: true,
        cooking: true,
        grantedCapabilities: [CAPABILITY.BASIC_BURGER],
    },
    CUTTING_BOARD: {
        id: 'CUTTING_BOARD',
        texture: ASSETS.TILES.CUTTING_BOARD,
        walkable: false,
        holdsItems: false, // We handle items via internal state specific to board logic
        cutting: true,
        grantedCapabilities: [CAPABILITY.CUT_TOPPINGS],
    },
    DISPENSER: {
        id: 'DISPENSER',
        texture: ASSETS.TILES.DISPENSER,
        walkable: false,
        holdsItems: false, // Dispenser logic is specific (holds internal mayo)
        dispenser: true,
        grantedCapabilities: [CAPABILITY.ADD_COLD_SAUCE],
    },
    FRYER: {
        id: 'FRYER',
        texture: ASSETS.TILES.FRYER,
        walkable: false,
        holdsItems: false, // You don't place items on it like a counter, you interact to load it
        fryer: true,
        grantedCapabilities: [CAPABILITY.SERVE_FRIES],
    },
    SODA_FOUNTAIN: {
        id: 'SODA_FOUNTAIN',
        texture: ASSETS.TILES.SODA_FOUNTAIN_EMPTY, // Default
        walkable: false,
        holdsItems: false,
        soda_fountain: true, // Marker for logic
        grantedCapabilities: [CAPABILITY.SERVE_DRINKS],
    },
    SHUTTER_DOOR: {
        id: 'SHUTTER_DOOR',
        texture: ASSETS.TILES.SHUTTER_TILE_OPEN,
        walkable: true,
        holdsItems: false,
        isDoor: true,
    },
    TICKET_WHEEL: {
        id: 'TICKET_WHEEL',
        texture: ASSETS.TILES.TICKET_WHEEL,
        walkable: false,
        holdsItems: false,
    },
    PRINTER: {
        id: 'PRINTER',
        texture: ASSETS.TILES.PRINTER,
        walkable: false,
        holdsItems: false,
    },
    GARBAGE: {
        id: 'GARBAGE',
        texture: ASSETS.TILES.GARBAGE,
        walkable: false,
        holdsItems: false, // Handled explicitly to destroy items
    },
    OFFICE_DOOR: {
        id: 'OFFICE_DOOR',
        texture: ASSETS.TILES.OFFICE_DOOR_OPEN,
        walkable: true,
        holdsItems: false,
        isDoor: true,
    },
    OFFICE_DOOR_CLOSED: {
        id: 'OFFICE_DOOR_CLOSED',
        texture: ASSETS.TILES.OFFICE_DOOR_CLOSED,
        walkable: false,
        holdsItems: false,
        isDoor: false,
    },
    COMPUTER: {
        id: 'COMPUTER',
        texture: ASSETS.TILES.COMPUTER,
        walkable: false,
        holdsItems: false,
    },
    EXIT_DOOR: {
        id: 'EXIT_DOOR',
        texture: ASSETS.TILES.EXIT_DOOR,
        walkable: true,
        holdsItems: false,
        holdsItems: false,
        isExit: true
    },
    RENO: {
        id: 'RENO',
        texture: ASSETS.TILES.RENO,
        walkable: false,
        holdsItems: false,
    },
    RENO_LOCKED: {
        id: 'RENO_LOCKED',
        texture: ASSETS.TILES.RENO,
        walkable: false,
        holdsItems: false,
    },
    DELIVERY_TILE: {
        id: 'DELIVERY_TILE',
        texture: ASSETS.TILES.DELIVERY_TILE,
        walkable: false,
        holdsItems: true,
    },
    MENU: {
        id: 'MENU',
        texture: ASSETS.TILES.MENU,
        walkable: false,
        holdsItems: false,
    }
};

export const GRID_WIDTH = 14;
export const GRID_HEIGHT = 10;

export const TAG_LAYOUTS = {
    // top: The Y coordinate where the drawing starts (from top)
    // bottom: The Y coordinate where the drawing ends (from top)
    // These define the "fillable" area of the 64x64 tag image.
    burger: { top: 16, bottom: 56 },
    side: { top: 16, bottom: 56 },
    drink: { top: 16, bottom: 56 }
};


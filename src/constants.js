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
        DISPENSER_MAYO: 'dispenser-mayo.png',
        DISPENSER_MAYO_PARTIAL1: 'dispenser-mayo-partial1.png',
        DISPENSER_MAYO_PARTIAL2: 'dispenser-mayo-partial2.png',
        FRYER: 'fryer.png',
        FRYER_FRIES: 'fryer-fries.png',
        FRYER_DOWN: 'fryer-fries-down.png',
        FRYER_DONE: 'fryer-fries-done.png',
        SODA_FOUNTAIN_EMPTY: 'soda_fountain-empty.png',
        SODA_FOUNTAIN_FULL: 'soda_fountain-full.png',
        SODA_FOUNTAIN_WARNING: 'soda_fountain-warning.png',
        SODA_FOUNTAIN_FILLING: 'soda_fountain-filling.png',
        SODA_FOUNTAIN_DONE: 'soda_fountain-done.png',
        SHUTTER_TILE_OPEN: 'shutter_tile-open.png',
        SHUTTER_TILE_CLOSED: 'shutter_tile-closed.png',
        TICKET_WHEEL: 'ticket_wheel.png',
        PRINTER: 'printer_tile.png',
        PRINTER_PRINT1: 'printer_tile-print1.png',
        PRINTER_PRINT2: 'printer_tile-print2.png',
        PRINTER_PRINT3: 'printer_tile-print3.png',
        TICKET_WHEEL_ORDER: 'ticket_wheel-order.png',
        GARBAGE: 'garbage-tile.png',
    },
    OBJECTS: {

        BUN: 'bun.png',
        BURGER: 'burger.png',
        BURGER_TOMATO: 'burger-tomato.png',
        BURGER_WRAPPED: 'burger-wrapped.png',

        // Dynamic Assets (Aliased on disk for now)
        BUN_BOX_CLOSED: 'bun_box-closed.png',
        BUN_BOX_OPEN: 'bun_box-open.png',
        PATTY_BOX_CLOSED: 'patty_box-closed.png',
        PATTY_BOX_OPEN: 'patty_box-open.png',
        EMPTY_BOX: 'empty-box.png',


        PATTY_RAW: 'patty-raw.png',
        PATTY_COOKED: 'patty-cooked.png',
        WRAPPER: 'wrapper.png',
        WRAPPER_BOX_CLOSED: 'wrapper_box-closed.png',
        WRAPPER_BOX_OPEN: 'wrapper_box-open.png',
        TOMATO_BOX_CLOSED: 'tomato_box-closed.png',
        TOMATO_BOX_OPEN: 'tomato_box-open.png',
        TOMATO: 'tomato.png',

        TOMATO_SLICE: 'tomato-slice.png',
        MAYO_BOX_CLOSED: 'mayo_box-closed.png',
        MAYO_BOX_OPEN: 'mayo_box-open.png',
        MAYO_BAG: 'mayo-bag.png',
        BURGER_MAYO: 'burger-mayo.png',
        BURGER_MAYO: 'burger-mayo.png',
        BURGER_TOMATO_MAYO: 'burger-tomato-mayo.png',
        // Fries
        FRY_BOX_CLOSED: 'fry_box-closed.png',
        FRY_BOX_OPEN: 'fry_box-open.png',
        FRY_BAG: 'fry_bag.png',
        FRY_BAG_OPEN_FULL: 'fry_bag-open-full.png',
        FRY_BAG_OPEN_PARTIAL1: 'fry_bag-open-partial1.png',
        FRY_BAG_OPEN_PARTIAL2: 'fry_bag-open-partial2.png',
        FRIES: 'fries.png', // Final product
        SIDE_CUP: 'side_cup.png',
        SIDE_CUP_BOX_OPEN: 'side_cup_box-open.png',
        SIDE_CUP_BOX_CLOSED: 'side_cup_box-closed.png',
        DRINK_CUP: 'drink_cup.png',
        SYRUP_BOX_CLOSED: 'syrup_box-closed.png',
        SYRUP_BOX_OPEN: 'syrup_box-open.png',
        SODA_SYRUP: 'soda_syrup.png',
        SODA: 'soda.png',
        DRINK_CUP_BOX_CLOSED: 'drink_cup_box-closed.png',
        DRINK_CUP_BOX_OPEN: 'drink_cup_box-open.png',

        // Bags
        BAG_BOX_CLOSED: 'bag_box-closed.png',
        BAG_BOX_OPEN: 'bag_box-open.png',
        BAG_EMPTY: 'bag-empty.png',
        BAG_BURGER: 'bag-burger.png',
        BAG_SODA: 'bag-soda.png',
        BAG_FRIES: 'bag-fries.png',
        BAG_BURGER_FRIES: 'bag-burger-fries.png',
        BAG_BURGER_SODA: 'bag-burger-soda.png',
        BAG_SODA_FRIES: 'bag-soda-fries.png',
        BAG_BURGER_SODA_FRIES: 'bag-burger-soda-fries.png',
    },
    PLAYER: {
        NEUTRAL: 'player-neutral.png',
        HAPPY: 'player-neutral.png',
    },
    TOOLS: {

        HANDS: 'hands.png',
    },
    UI: {
        ORDER_TICKET: 'order_ticket.png',
        SELECTOR: 'selector.png',
    },
    AUDIO: {
        SONG1_INTRO: 'audio/song1-intro.wav',
        SONG1_LOOP: 'audio/song1.wav',
        SONG2_INTRO: 'audio/song2-intro.wav',
        SONG2_LOOP: 'audio/song2.wav',
        TITLE_THEME: 'audio/title-theme.wav',
        PRINTER: 'audio/printer.wav',
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
    }
};

export const GRID_WIDTH = 14;
export const GRID_HEIGHT = 10;

import {
    grill_interact, grill_pickup,
    fryer_interact, fryer_pickup,
    cutting_board_interact, cutting_board_pickup,
    soda_fountain_interact, soda_fountain_pickup,
    garbage_action,
    dishwasher_interact, dishwasher_pickup,
    service_counter_interact, service_counter_pickup,
    board_rack_interact, board_rack_pickup, board_rack_right_tile,
    board_item_interact, board_item_pickup,
} from '../systems/interactions/ApplianceHandlers.js';

import {
    stacked_container_interact, stacked_container_pickup,
    bag_interact,
} from '../systems/interactions/ContainerHandlers.js';

import {
    lettuce_interact,
    sauce_bottle_interact,
    dish_rack_interact, dish_rack_pickup,
} from '../systems/interactions/ItemHandlers.js';

export const INTERACTION_MAPPING = {
    TILES: {
        'FRYER':         { interact: fryer_interact,           pickup: fryer_pickup },
        'GRILL':         { interact: grill_interact,           pickup: grill_pickup },
        'CUTTING_BOARD': { interact: cutting_board_interact,   pickup: cutting_board_pickup },
        'SODA_FOUNTAIN': { interact: soda_fountain_interact,   pickup: soda_fountain_pickup },
        'GARBAGE':       { interact: garbage_action,           pickup: garbage_action },
        'DISHWASHER':    { interact: dishwasher_interact,      pickup: dishwasher_pickup },
        'SERVICE':       { interact: service_counter_interact, pickup: service_counter_pickup },
        'COUNTER':       { interact: board_rack_right_tile,    pickup: board_rack_right_tile },
    },
    ITEMS: {
        'insert':      { interact: stacked_container_interact, pickup: stacked_container_pickup },
        'bag':         { interact: bag_interact },
        'lettuce_head':      { interact: lettuce_interact },
        'soda_fountain':     { interact: soda_fountain_interact,    pickup: soda_fountain_pickup },
        'mayo_bottle':       { interact: sauce_bottle_interact,     pickup: sauce_bottle_interact },
        'bbq_bottle':        { interact: sauce_bottle_interact,     pickup: sauce_bottle_interact },
        'burger_sauce_bottle':{ interact: sauce_bottle_interact,    pickup: sauce_bottle_interact },
        'plate':             { interact: stacked_container_interact, pickup: stacked_container_pickup },
        'dirty_plate': { interact: stacked_container_interact, pickup: stacked_container_pickup },
        'dish_rack':   { interact: dish_rack_interact,         pickup: dish_rack_pickup },
        'board_rack_double': { interact: board_rack_interact,  pickup: board_rack_pickup },
        'board':             { interact: board_item_interact,  pickup: board_item_pickup },
        'board_tomatoed':    { interact: board_item_interact,  pickup: board_item_pickup },
        'board_pickled':     { interact: board_item_interact,  pickup: board_item_pickup },
    }
};

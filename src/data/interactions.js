export const INTERACTION_MAPPING = {
    TILES: {
        'FRYER': {
            interact: 'fryer_interact',
            pickup: 'fryer_pickup'
        },
        'GRILL': {
            interact: 'grill_interact',
            pickup: 'grill_pickup'
        },
        'CUTTING_BOARD': {
            interact: 'cutting_board_interact',
            pickup: 'cutting_board_pickup'
        },
        'SODA_FOUNTAIN': {
            interact: 'soda_fountain_interact',
            pickup: 'soda_fountain_pickup'
        },
        'GARBAGE': {
            interact: 'garbage_action',
            pickup: 'garbage_action'
        },
        'DISHWASHER': {
            interact: 'dishwasher_interact',
            pickup: 'dishwasher_pickup'
        }
    },
    ITEMS: {
        'insert': {
            interact: 'stacked_container_interact',
            pickup: 'stacked_container_pickup'
        },
        'bag': {
            interact: 'bag_interact'
        },
        'lettuce_head': {
            interact: 'lettuce_interact'
        },
        'soda_fountain': {
            interact: 'soda_fountain_interact',
            pickup: 'soda_fountain_pickup'
        },
        'dispenser': {
            interact: 'dispenser_interact',
            pickup: 'dispenser_pickup'
        },
        'plate': {
            interact: 'stacked_container_interact',
            pickup: 'stacked_container_pickup'
        },
        'dirty_plate': {
            interact: 'stacked_container_interact',
            pickup: 'stacked_container_pickup'
        },
        'dish_rack': {
            interact: 'dish_rack_interact',
            pickup: 'dish_rack_pickup'
        }
    }
};

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
        'DISPENSER': {
            pickup: 'dispenser_pickup',
            interact: 'dispenser_interact'
        },
        'SODA_FOUNTAIN': {
            interact: 'soda_fountain_interact',
            pickup: 'soda_fountain_pickup'
        },
        'GARBAGE': {
            interact: 'garbage_action',
            pickup: 'garbage_action'
        }
    },
    ITEMS: {
        'insert': {
            interact: 'insert_interact',
            pickup: 'insert_pickup'
        },
        'bag': {
            interact: 'bag_interact'
        },
        'lettuce_head': {
            interact: 'lettuce_interact'
        }
    }
};

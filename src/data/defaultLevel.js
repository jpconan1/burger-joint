import { ASSETS } from '../constants.js';

export const DEFAULT_LEVEL = {
    "width": 15,
    "height": 11,
    "cells": [
        [
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_TOP_LEFT }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_TOP_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_TOP_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_TOP_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_TOP_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_TOP_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_TOP_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_TOP_RIGHT }, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null }
        ],
        [
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_BOTTOM_LEFT }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_BOTTOM_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_BOTTOM_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_BOTTOM_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_BOTTOM_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_BOTTOM_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_BOTTOM_CENTRE }, "object": null },
            { "typeId": "SERVICE_WINDOW", "state": { "texture": ASSETS.TILES.SERVICE_WINDOW_BOTTOM_RIGHT }, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null }
        ],
        [
            { "typeId": "CHUTE", "state": {}, "object": null },
            { "typeId": "COUNTER", "state": {}, "object": null },
            { "typeId": "COUNTER", "state": {}, "object": null },
            { "typeId": "COUNTER", "state": {}, "object": null },
            { "typeId": "SERVICE", "state": { "texture": ASSETS.TILES.SERVICE_COUNTER_LEFT }, "object": null },
            { "typeId": "SERVICE", "state": { "texture": ASSETS.TILES.SERVICE_COUNTER_CENTRE }, "object": null },
            { "typeId": "SERVICE", "state": { "texture": ASSETS.TILES.SERVICE_COUNTER_CENTRE }, "object": null },
            { "typeId": "SERVICE", "state": { "texture": ASSETS.TILES.SERVICE_COUNTER_CENTRE }, "object": null },
            { "typeId": "SERVICE", "state": { "texture": ASSETS.TILES.SERVICE_COUNTER_CENTRE }, "object": null },
            { "typeId": "SERVICE", "state": { "texture": ASSETS.TILES.SERVICE_COUNTER_CENTRE }, "object": null },
            { "typeId": "SERVICE", "state": { "texture": ASSETS.TILES.SERVICE_COUNTER_CENTRE }, "object": null },
            { "typeId": "SERVICE", "state": { "texture": ASSETS.TILES.SERVICE_COUNTER_RIGHT }, "object": null },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": {
                    "definitionId": "dish_rack"
                }
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            }
        ],
        [
            { "typeId": "CHUTE", "state": {}, "object": null },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            {
                "typeId": "SHUTTER_DOOR",
                "state": {
                    "id": "kitchen_shutter",
                    "targetRoom": "store_room",
                    "targetDoorId": "store_exit",
                    "isOpen": true
                },
                "object": null
            }
        ],
        [
            { "typeId": "CHUTE", "state": {}, "object": null },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "GRILL",
                "state": {
                    "isOn": false,
                    "cookingSpeed": 2000,
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "GRILL",
                "state": {
                    "isOn": false,
                    "cookingSpeed": 2000,
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "GRILL",
                "state": {
                    "isOn": false,
                    "cookingSpeed": 2000,
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "GRILL",
                "state": {
                    "isOn": false,
                    "cookingSpeed": 2000,
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "FRYER",
                "state": {
                    "status": "empty",
                    "cookingSpeed": 2000,
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "FRYER",
                "state": {
                    "status": "empty",
                    "cookingSpeed": 2000,
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "GARBAGE",
                "state": {},
                "object": null
            }
        ],
        [
            { "typeId": "CHUTE", "state": {}, "object": null },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            }
        ],
        [
            { "typeId": "CHUTE", "state": {}, "object": null },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            }
        ],
        [
            { "typeId": "CHUTE", "state": {}, "object": null },
            {
                "typeId": "CUTTING_BOARD",
                "state": {
                    "status": "empty"
                },
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            }
        ],
        [
            { "typeId": "CHUTE", "state": {}, "object": null },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            }
        ],
        [
            { "typeId": "CHUTE", "state": {}, "object": null },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "FLOOR",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            }
        ],
        [
            { "typeId": "CHUTE", "state": {}, "object": null },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {
                    "facing": 0
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": {
                    "definitionId": "plate",
                    "state": {
                        "count": 9
                    }
                }
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            },
            {
                "typeId": "DISHWASHER",
                "state": {
                    "isOpen": true
                },
                "object": null
            },
            {
                "typeId": "COUNTER",
                "state": {},
                "object": null
            }
        ]
    ]
};

export const DEFAULT_STORE_ROOM = {
    "width": 5,
    "height": 8,
    "cells": [
        // Row 0
        [
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 0 }, "object": null },
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "WALL", "state": {}, "object": null }
        ],
        // Row 1
        [
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 3 }, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 1 }, "object": null },
            { "typeId": "WALL", "state": {}, "object": null }
        ],
        // Row 2
        [
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 3 }, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 1 }, "object": null },
            { "typeId": "WALL", "state": {}, "object": null }
        ],
        // Row 3
        [
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 3 }, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 1 }, "object": null },
            { "typeId": "WALL", "state": {}, "object": null }
        ],
        // Row 4
        [
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 3 }, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 1 }, "object": null },
            { "typeId": "WALL", "state": {}, "object": null }
        ],
        // Row 5
        [
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 3 }, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 1 }, "object": null },
            { "typeId": "WALL", "state": {}, "object": null }
        ],
        // Row 6
        [
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 3 }, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "DELIVERY_TILE", "state": { "facing": 1 }, "object": null },
            { "typeId": "WALL", "state": {}, "object": null }
        ],
        // Row 7
        [
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "SHUTTER_DOOR", "state": { "id": "store_exit", "targetRoom": "main", "targetDoorId": "kitchen_shutter", "isOpen": true }, "object": null },
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "WALL", "state": {}, "object": null }
        ]
    ]
};

export const DEFAULT_OFFICE_ROOM = {
    "width": 4,
    "height": 4,
    "cells": [
        // Row 0: Wall, Reno, Computer, Wall
        [
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "RENO", "state": {}, "object": null },
            { "typeId": "COMPUTER", "state": {}, "object": null },
            { "typeId": "WALL", "state": {}, "object": null }
        ],
        // Row 1: Office Door, Floor, Floor, Menu
        [
            { "typeId": "OFFICE_DOOR", "state": { "id": "office_exit", "targetRoom": "main", "targetDoorId": "kitchen_office_door", "isOpen": true }, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "MENU", "state": {}, "object": null }
        ],
        // Row 2: Counter, Floor, Floor, Counter
        [
            { "typeId": "COUNTER", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "FLOOR", "state": {}, "object": null },
            { "typeId": "COUNTER", "state": {}, "object": null }
        ],
        // Row 3: Wall, Exit, Counter, Wall
        [
            { "typeId": "WALL", "state": {}, "object": null },
            { "typeId": "EXIT_DOOR", "state": {}, "object": null },
            { "typeId": "COUNTER", "state": {}, "object": null },
            { "typeId": "WALL", "state": {}, "object": null }
        ]
    ]
};

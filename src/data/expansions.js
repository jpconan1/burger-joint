export const EXPANSIONS = [
    {
        "id": "expansion_1",
        "name": "First Growth",
        "unlockCondition": {
            "stars": 1
        },
        "//comment": "Paste the exported layout JSON into the 'layout' field below",
        "layout": {
            "width": 9,
            "height": 5,
            "cells": [
                [
                    {
                        "typeId": "PRINTER",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "SHUTTER_DOOR",
                        "state": {
                            "id": "kitchen_shutter",
                            "targetRoom": "store_room",
                            "targetDoorId": "store_exit",
                            "isOpen": true
                        },
                        "object": null
                    },
                    {
                        "typeId": "GRILL",
                        "state": {
                            "cookingProgress": 0
                        },
                        "object": null
                    },
                    {
                        "typeId": "FRYER",
                        "state": {
                            "status": "empty",
                            "timer": 0
                        },
                        "object": null
                    },
                    {
                        "typeId": "COUNTER",
                        "state": {},
                        "object": {
                            "definitionId": "dispenser",
                            "state": {
                                "status": "loaded",
                                "charges": 9999,
                                "sauceId": "mayo",
                                "bagId": "mayo_bag",
                                "isInfinite": true
                            }
                        }
                    },
                    {
                        "typeId": "CUTTING_BOARD",
                        "state": {
                            "status": "empty"
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
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "TICKET_WHEEL",
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
                        "typeId": "OFFICE_DOOR",
                        "state": {
                            "id": "kitchen_office_door",
                            "targetRoom": "office",
                            "targetDoorId": "office_exit",
                            "isOpen": true
                        },
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "SERVICE",
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
                        "typeId": "GARBAGE",
                        "state": {},
                        "object": null
                    }
                ],
                [
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
                        "typeId": "COUNTER",
                        "state": {},
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "SODA_FOUNTAIN",
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
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    }
                ]
            ]
        }
    },
    {
        "id": "expansion_2",
        "name": "Second Wind",
        "unlockCondition": {
            "stars": 2
        },
        "layout": {
            "width": 10,
            "height": 6,
            "cells": [
                [
                    {
                        "typeId": "PRINTER",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "SHUTTER_DOOR",
                        "state": {
                            "id": "kitchen_shutter",
                            "targetRoom": "store_room",
                            "targetDoorId": "store_exit",
                            "isOpen": true
                        },
                        "object": null
                    },
                    {
                        "typeId": "GRILL",
                        "state": {
                            "cookingProgress": 0
                        },
                        "object": null
                    },
                    {
                        "typeId": "FRYER",
                        "state": {
                            "status": "empty",
                            "timer": 0
                        },
                        "object": null
                    },
                    {
                        "typeId": "COUNTER",
                        "state": {},
                        "object": {
                            "definitionId": "dispenser",
                            "state": {
                                "status": "loaded",
                                "charges": 9999,
                                "sauceId": "mayo",
                                "bagId": "mayo_bag",
                                "isInfinite": true
                            }
                        }
                    },
                    {
                        "typeId": "CUTTING_BOARD",
                        "state": {
                            "status": "empty"
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
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "TICKET_WHEEL",
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
                        "typeId": "OFFICE_DOOR",
                        "state": {
                            "id": "kitchen_office_door",
                            "targetRoom": "office",
                            "targetDoorId": "office_exit",
                            "isOpen": true
                        },
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "SERVICE",
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
                        "typeId": "COUNTER",
                        "state": {},
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "SODA_FOUNTAIN",
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
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "COUNTER",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    }
                ]
            ]
        }
    },
    {
        "id": "expansion_3",
        "name": "Serious Kitchen",
        "unlockCondition": {
            "stars": 3
        },
        "layout": {
            "width": 12,
            "height": 8,
            "cells": [
                [
                    {
                        "typeId": "PRINTER",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "SHUTTER_DOOR",
                        "state": {
                            "id": "kitchen_shutter",
                            "targetRoom": "store_room",
                            "targetDoorId": "store_exit",
                            "isOpen": true
                        },
                        "object": null
                    },
                    {
                        "typeId": "GRILL",
                        "state": {
                            "cookingProgress": 0
                        },
                        "object": null
                    },
                    {
                        "typeId": "FRYER",
                        "state": {
                            "status": "empty",
                            "timer": 0
                        },
                        "object": null
                    },
                    {
                        "typeId": "COUNTER",
                        "state": {},
                        "object": {
                            "definitionId": "dispenser",
                            "state": {
                                "status": "loaded",
                                "charges": 9999,
                                "sauceId": "mayo",
                                "bagId": "mayo_bag",
                                "isInfinite": true
                            }
                        }
                    },
                    {
                        "typeId": "CUTTING_BOARD",
                        "state": {
                            "status": "empty"
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
                        "object": null
                    },
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "TICKET_WHEEL",
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
                        "typeId": "OFFICE_DOOR",
                        "state": {
                            "id": "kitchen_office_door",
                            "targetRoom": "office",
                            "targetDoorId": "office_exit",
                            "isOpen": true
                        },
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "SERVICE",
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
                        "typeId": "GARBAGE",
                        "state": {},
                        "object": null
                    }
                ],
                [
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
                        "typeId": "COUNTER",
                        "state": {},
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "SODA_FOUNTAIN",
                        "state": {
                            "status": "full",
                            "charges": 20,
                            "syrupId": "dr_matt_syrup",
                            "resultId": "dr_matt"
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
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    }
                ]
            ]
        }
    },
    {
        "id": "expansion_4",
        "name": "Major Expansion",
        "unlockCondition": {
            "stars": 4
        },
        "layout": {
            "width": 13,
            "height": 9,
            "cells": [
                [
                    {
                        "typeId": "PRINTER",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "SHUTTER_DOOR",
                        "state": {
                            "id": "kitchen_shutter",
                            "targetRoom": "store_room",
                            "targetDoorId": "store_exit",
                            "isOpen": true
                        },
                        "object": null
                    },
                    {
                        "typeId": "GRILL",
                        "state": {
                            "cookingProgress": 0
                        },
                        "object": null
                    },
                    {
                        "typeId": "FRYER",
                        "state": {
                            "status": "empty",
                            "timer": 0
                        },
                        "object": null
                    },
                    {
                        "typeId": "COUNTER",
                        "state": {},
                        "object": {
                            "definitionId": "dispenser",
                            "state": {
                                "status": "loaded",
                                "charges": 9999,
                                "sauceId": "mayo",
                                "bagId": "mayo_bag",
                                "isInfinite": true
                            }
                        }
                    },
                    {
                        "typeId": "CUTTING_BOARD",
                        "state": {
                            "status": "empty"
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
                        "object": null
                    },
                    {
                        "typeId": "COUNTER",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "TICKET_WHEEL",
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
                        "typeId": "OFFICE_DOOR",
                        "state": {
                            "id": "kitchen_office_door",
                            "targetRoom": "office",
                            "targetDoorId": "office_exit",
                            "isOpen": true
                        },
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "SERVICE",
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
                        "typeId": "GARBAGE",
                        "state": {},
                        "object": null
                    }
                ],
                [
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
                        "typeId": "COUNTER",
                        "state": {},
                        "object": null
                    }
                ],
                [
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
                        "typeId": "COUNTER",
                        "state": {},
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "SODA_FOUNTAIN",
                        "state": {
                            "status": "full",
                            "charges": 20,
                            "syrupId": "dr_matt_syrup",
                            "resultId": "dr_matt"
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
                        "object": null
                    },
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    }
                ]
            ]
        }
    },
    {
        "id": "expansion_5",
        "name": "Empire Size",
        "unlockCondition": {
            "stars": 5
        },
        "layout": {
            "width": 14,
            "height": 10,
            "cells": [
                [
                    {
                        "typeId": "PRINTER",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "SHUTTER_DOOR",
                        "state": {
                            "id": "kitchen_shutter",
                            "targetRoom": "store_room",
                            "targetDoorId": "store_exit",
                            "isOpen": true
                        },
                        "object": null
                    },
                    {
                        "typeId": "GRILL",
                        "state": {
                            "cookingProgress": 0
                        },
                        "object": null
                    },
                    {
                        "typeId": "FRYER",
                        "state": {
                            "status": "empty",
                            "timer": 0
                        },
                        "object": null
                    },
                    {
                        "typeId": "COUNTER",
                        "state": {},
                        "object": {
                            "definitionId": "dispenser",
                            "state": {
                                "status": "loaded",
                                "charges": 9999,
                                "sauceId": "mayo",
                                "bagId": "mayo_bag",
                                "isInfinite": true
                            }
                        }
                    },
                    {
                        "typeId": "CUTTING_BOARD",
                        "state": {
                            "status": "empty"
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
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "TICKET_WHEEL",
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
                        "typeId": "OFFICE_DOOR",
                        "state": {
                            "id": "kitchen_office_door",
                            "targetRoom": "office",
                            "targetDoorId": "office_exit",
                            "isOpen": true
                        },
                        "object": null
                    }
                ],
                [
                    {
                        "typeId": "SERVICE",
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
                        "typeId": "COUNTER",
                        "state": {},
                        "object": null
                    }
                ],
                [
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
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "SODA_FOUNTAIN",
                        "state": {
                            "status": "full",
                            "charges": 20,
                            "syrupId": "dr_matt_syrup",
                            "resultId": "dr_matt"
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
                        "object": null
                    },
                    {
                        "typeId": "COUNTER",
                        "state": {},
                        "object": null
                    },
                    {
                        "typeId": "WALL",
                        "state": {},
                        "object": null
                    }
                ]
            ]
        }
    }
];
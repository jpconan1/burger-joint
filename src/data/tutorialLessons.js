import { ASSETS } from '../constants.js';
import { Ticket, OrderGroup } from '../systems/OrderSystem.js';

const item = (definitionId, state = {}) => ({ definitionId, state });
const plateStack = (count = 4) => ({
    definitionId: 'dish_rack',
    state: {
        contents: Array.from({ length: count }, () => item('plate')),
        boards: []
    }
});
const insertStack = (count = 4) => item('insert', { count, contents: [] });

const floorCell = () => ({ typeId: 'FLOOR', state: {}, object: null });
const wallCell = () => ({ typeId: 'WALL', state: {}, object: null });
const counterCell = (object = null) => ({ typeId: 'COUNTER', state: { facing: 0 }, object });
const serviceCell = (texture) => ({ typeId: 'SERVICE', state: { texture }, object: null });
const windowCell = (texture) => ({ typeId: 'SERVICE_WINDOW', state: { texture }, object: null });
const grillCell = () => ({ typeId: 'GRILL', state: { isOn: false, cookingSpeed: 2000, facing: 0 }, object: null });
const fryerCell = () => ({ typeId: 'FRYER', state: { status: 'empty', cookingSpeed: 2000, facing: 0 }, object: null });
const garbageCell = () => ({ typeId: 'GARBAGE', state: {}, object: null });

function makeTutorialLevel(objectsByX, applianceByX = {}) {
    const width = 10;
    const height = 7;
    const cells = Array.from({ length: height }, () => Array.from({ length: width }, floorCell));

    cells[0] = Array.from({ length: width }, (_, x) => {
        if (x === 2) return windowCell(ASSETS.TILES.SERVICE_WINDOW_TOP_LEFT);
        if (x >= 3 && x <= 6) return windowCell(ASSETS.TILES.SERVICE_WINDOW_TOP_CENTRE);
        if (x === 7) return windowCell(ASSETS.TILES.SERVICE_WINDOW_TOP_RIGHT);
        return wallCell();
    });

    cells[1] = Array.from({ length: width }, (_, x) => {
        if (x === 2) return serviceCell(ASSETS.TILES.SERVICE_COUNTER_LEFT);
        if (x >= 3 && x <= 6) return serviceCell(ASSETS.TILES.SERVICE_COUNTER_CENTRE);
        if (x === 7) return serviceCell(ASSETS.TILES.SERVICE_COUNTER_RIGHT);
        if (x === 9) return garbageCell();
        return wallCell();
    });

    cells[3] = Array.from({ length: width }, (_, x) => {
        if (applianceByX[x] === 'GRILL') return grillCell();
        if (applianceByX[x] === 'FRYER') return fryerCell();
        return counterCell(objectsByX[x] || null);
    });

    cells[6] = Array.from({ length: width }, wallCell);

    return { width, height, cells };
}

function makeTicket(id, containerType, modifications, items = []) {
    const ticket = new Ticket(id);
    const group = new OrderGroup(containerType);

    group.addBurger({
        base: 'Burger',
        bun: 'plain_bun',
        modifications: ['beef_patty', ...modifications]
    });
    items.forEach(itemId => group.addItem(itemId));
    group.payout = 0;
    ticket.addGroup(group);
    ticket.calculateParTime();
    return ticket;
}

const recipeImage = (src) => ({ type: 'image', src });
const symbol = (value) => ({ type: 'symbol', value });
const row = (...tokens) => tokens;

export const TUTORIAL_LESSONS = [
    {
        id: 'basics',
        label: 'Basics',
        player: { x: 4, y: 2, facing: { x: 0, y: 1 } },
        level: makeTutorialLevel({
            2: item('patty_box'),
            3: item('bun_box'),
            8: plateStack()
        }, { 4: 'GRILL' }),
        ticket: () => makeTicket(1, 'plate', []),
        recipeRows: [
            row(recipeImage('assets/patty-raw.png'), symbol('+'), recipeImage('assets/sheets/grill_sheet.png'), symbol('='), recipeImage('assets/patty-cooked.png')),
            row(recipeImage('assets/patty-cooked.png'), symbol('+'), recipeImage('assets/bun.png'), symbol('='), recipeImage('assets/burger.png')),
            row(recipeImage('assets/burger.png'), symbol('+'), recipeImage('assets/plates/plate.png'), symbol('='), recipeImage('assets/plates/burger-plate-outline.png'))
        ]
    },
    {
        id: 'to_go',
        label: 'To-Go',
        player: { x: 4, y: 2, facing: { x: 0, y: 1 } },
        level: makeTutorialLevel({
            0: item('bag_box'),
            1: item('wrapper_box'),
            2: item('patty_box'),
            3: item('bun_box'),
            6: item('fry_box'),
            7: item('side_cup_box')
        }, { 4: 'GRILL', 5: 'FRYER' }),
        ticket: () => makeTicket(2, 'bag', [], ['fries']),
        recipeRows: [
            row(recipeImage('assets/burger.png'), symbol('+'), recipeImage('assets/wrapper.png'), symbol('='), recipeImage('assets/burger-wrapped.png')),
            row(recipeImage('assets/fry_bag.png'), symbol('+'), recipeImage('assets/fryer.png'), symbol('='), recipeImage('assets/fries-done.png')),
            row(recipeImage('assets/burger-wrapped.png'), symbol('+'), recipeImage('assets/fries-done.png'), symbol('+'), recipeImage('assets/bag-empty.png'), symbol('='), recipeImage('assets/bag-burger.png'))
        ]
    },
    {
        id: 'toppings',
        label: 'Toppings',
        player: { x: 4, y: 2, facing: { x: 0, y: 1 } },
        level: makeTutorialLevel({
            0: item('bacon_box'),
            1: item('lettuce_box'),
            2: item('tomato_box'),
            3: item('board'),
            5: item('patty_box'),
            6: item('bun_box'),
            8: plateStack()
        }, { 4: 'GRILL' }),
        ticket: () => makeTicket(3, 'plate', ['bacon', 'lettuce_leaf', 'tomato_slice']),
        recipeRows: [
            row(recipeImage('assets/bacon-raw.png'), symbol('+'), recipeImage('assets/sheets/grill_sheet.png'), symbol('='), recipeImage('assets/bacon-cooked.png')),
            row(recipeImage('assets/tomato.png'), symbol('+'), recipeImage('assets/cutting_boards/board.png'), symbol('='), recipeImage('assets/tomato-slice.png')),
            row(recipeImage('assets/burger.png'), symbol('+'), recipeImage('assets/bacon-cooked.png'), symbol('+'), recipeImage('assets/lettuce-leaf.png'), symbol('+'), recipeImage('assets/tomato-slice.png'))
        ]
    },
    {
        id: 'inserts',
        label: 'Inserts',
        requiresInsert: true,
        player: { x: 4, y: 2, facing: { x: 0, y: 1 } },
        level: makeTutorialLevel({
            0: item('mushroom_box'),
            1: item('board'),
            2: insertStack(),
            3: item('patty_box'),
            5: item('bun_box'),
            8: plateStack()
        }, { 4: 'GRILL' }),
        ticket: () => makeTicket(4, 'plate', ['mushroom_slice']),
        recipeRows: [
            row(recipeImage('assets/mushroom.png'), symbol('+'), recipeImage('assets/cutting_boards/board.png'), symbol('='), recipeImage('assets/mushroom_slice.png')),
            row(recipeImage('assets/mushroom_slice.png'), symbol('+'), recipeImage('assets/insert.png'), symbol('+'), recipeImage('assets/sheets/grill_sheet.png'), symbol('='), recipeImage('assets/grilled_mushroom.png')),
            row(recipeImage('assets/grilled_mushroom.png'), symbol('+'), recipeImage('assets/burger.png'), symbol('='), recipeImage('assets/burger.png'))
        ]
    }
];

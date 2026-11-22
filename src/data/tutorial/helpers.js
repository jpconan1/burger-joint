import { ASSETS } from '../../constants.js';
import { Ticket, OrderGroup } from '../../systems/OrderSystem.js';

export const item = (definitionId, state = {}) => ({ definitionId, state });

export const plateStack = (count = 4) => ({
    definitionId: 'plate',
    state: { count }
});

export const insertStack = (count = 4) => item('insert', { count, contents: [] });

const floorCell = () => ({ typeId: 'FLOOR', state: {}, object: null });
const wallCell = () => ({ typeId: 'WALL', state: {}, object: null });
const counterCell = (object = null) => ({ typeId: 'COUNTER', state: { facing: 0 }, object });
const serviceCell = (texture) => ({ typeId: 'SERVICE', state: { texture }, object: null });
const windowCell = (texture) => ({ typeId: 'SERVICE_WINDOW', state: { texture }, object: null });
const grillCell = () => ({ typeId: 'GRILL', state: { isOn: false, cookingSpeed: 2000, facing: 0 }, object: null });
const fryerCell = () => ({ typeId: 'FRYER', state: { status: 'empty', cookingSpeed: 2000, facing: 0 }, object: null });
const garbageCell = () => ({ typeId: 'GARBAGE', state: {}, object: null });

export function makeTutorialRoom(objectsByX, applianceByX = {}, options = {}) {
    const width = 10;
    const height = options.lowerServiceCounter ? 6 : 5;
    const cells = Array.from({ length: height }, () => Array.from({ length: width }, floorCell));
    const serviceY = options.lowerServiceCounter ? 2 : 1;
    const prepY = options.lowerServiceCounter ? 4 : 3;
    const bottomWallY = height - 1;
    const showGarbage = options.showGarbage !== false;

    cells[0] = Array.from({ length: width }, (_, x) => {
        if (x === 2) return windowCell(ASSETS.TILES.SERVICE_WINDOW_TOP_LEFT);
        if (x >= 3 && x <= 6) return windowCell(ASSETS.TILES.SERVICE_WINDOW_TOP_CENTRE);
        if (x === 7) return windowCell(ASSETS.TILES.SERVICE_WINDOW_TOP_RIGHT);
        return wallCell();
    });

    if (options.lowerServiceCounter) {
        cells[1] = Array.from({ length: width }, (_, x) => {
            if (x === 2) return windowCell(ASSETS.TILES.SERVICE_WINDOW_BOTTOM_LEFT);
            if (x >= 3 && x <= 6) return windowCell(ASSETS.TILES.SERVICE_WINDOW_BOTTOM_CENTRE);
            if (x === 7) return windowCell(ASSETS.TILES.SERVICE_WINDOW_BOTTOM_RIGHT);
            return wallCell();
        });
    }

    cells[serviceY] = Array.from({ length: width }, (_, x) => {
        if (x === 2) return serviceCell(ASSETS.TILES.SERVICE_COUNTER_LEFT);
        if (x >= 3 && x <= 6) return serviceCell(ASSETS.TILES.SERVICE_COUNTER_CENTRE);
        if (x === 7) return serviceCell(ASSETS.TILES.SERVICE_COUNTER_RIGHT);
        if (showGarbage && x === 9) return garbageCell();
        return wallCell();
    });

    cells[prepY] = Array.from({ length: width }, (_, x) => {
        if (applianceByX[x] === 'GRILL') return grillCell();
        if (applianceByX[x] === 'FRYER') return fryerCell();
        return counterCell(objectsByX[x] || null);
    });

    cells[bottomWallY] = Array.from({ length: width }, wallCell);
    for (let y = 0; y < height; y++) {
        cells[y][0] = wallCell();
        cells[y][width - 1] = wallCell();
    }

    return { width, height, cells };
}

export function makeTicket(id, containerType, modifications, items = []) {
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

export const recipeImage = (src) => ({ type: 'image', src });
export const recipeTile = (src, x = 0, y = 0) => ({ type: 'tile', src, x, y });
export const recipeStack = (...layers) => ({ type: 'stack', layers });
export const recipePlateBurger = () => ({ type: 'plateBurger' });
export const recipeBoilSymbol = (value, options = {}) => ({ type: 'boilSymbol', value, ...options });
export const symbol = (value, options = {}) => ({ type: 'symbol', value, ...options });
export const row = (...tokens) => tokens;

export const recipeAlert = (recipeRows, size = { width: '760px', height: '420px' }) => ({
    frames: [
        {
            text: '',
            recipeRows,
            position: 'center',
            size
        }
    ]
});

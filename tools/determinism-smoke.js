import { GameClock } from '../src/utils/GameClock.js';
import { Random } from '../src/utils/Random.js';
import { OrderSystem } from '../src/systems/OrderSystem.js';
import { Ticket, OrderGroup } from '../src/systems/OrderSystem.js';
import { PowerupSystem } from '../src/systems/PowerupSystem.js';
import { ServiceCycle } from '../src/systems/ServiceCycle.js';
import { ItemInstance } from '../src/entities/Item.js';

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function summarizeOrder(order) {
    return JSON.stringify(order);
}

function runClockSequence(frameDeltas) {
    const clock = new GameClock({ tickMs: 100, maxFrameMs: 250 });
    let frameTime = 0;
    const ticks = [];

    clock.beginFrame(frameTime);
    for (const delta of frameDeltas) {
        frameTime += delta;
        clock.beginFrame(frameTime);
        ticks.push(clock.consumeTicks());
    }

    return {
        ticks,
        simTimeMs: clock.simTimeMs,
        tickCount: clock.tickCount
    };
}

function makeMenu() {
    return {
        burgers: [
            { name: 'Burger', bun: 'plain_bun', toppings: { lettuce_leaf: true, tomato_slice: true, onion_slice: true } },
            { name: 'Burger', bun: 'plain_bun', toppings: { bacon: true, cheddar_cheese: true } }
        ],
        sides: ['fries', 'sweet_potato_fries'],
        drinks: ['soda']
    };
}

function makeGrid() {
    const cells = [];
    for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 3; x++) {
            cells.push({ x, y, type: { id: 'COUNTER' }, object: null });
        }
    }

    return {
        width: 3,
        height: 2,
        getCell(x, y) {
            return cells.find(cell => cell.x === x && cell.y === y) || null;
        }
    };
}

function runPowerupSpawn(seed) {
    const random = new Random(seed);
    const game = {
        grid: makeGrid(),
        timeFreezeManual: false,
        activeTickets: [],
        ticketQueue: [],
        player: { heldItem: null, x: 0, y: 0 },
        randPick(list) { return random.pick(list); },
        randFloat(min, max) { return random.float(min, max); },
        addFloatingText() {}
    };

    const system = new PowerupSystem(game);
    system.spawnPowerup({ id: 'magic_bag', timer: 0 });

    for (let y = 0; y < game.grid.height; y++) {
        for (let x = 0; x < game.grid.width; x++) {
            const cell = game.grid.getCell(x, y);
            if (cell?.object?.definitionId === 'magic_bag') {
                return `${x},${y}`;
            }
        }
    }

    return 'none';
}

function makeServiceGrid() {
    const cells = [];
    for (let y = 0; y < 1; y++) {
        for (let x = 0; x < 4; x++) {
            cells.push({ x, y, type: { id: x === 0 ? 'COUNTER' : 'SERVICE' }, object: null });
        }
    }

    return {
        width: 4,
        height: 1,
        getCell(x, y) {
            return cells.find(cell => cell.x === x && cell.y === y) || null;
        }
    };
}

function makePlainBagTicket(id) {
    const ticket = new Ticket(id);
    const group = new OrderGroup('bag');
    group.addBurger({ base: 'Burger', bun: 'plain_bun', modifications: ['beef_patty'] });
    ticket.addGroup(group);
    ticket.calculateParTime();
    return ticket;
}

function runMagicBagTargetingChecks() {
    const game = {
        grid: makeServiceGrid(),
        activeTickets: [makePlainBagTicket(1), makePlainBagTicket(2), makePlainBagTicket(3)]
    };
    const serviceCycle = new ServiceCycle(game);

    const targetedBag = new ItemInstance('magic_bag');
    const targetedMatch = serviceCycle.tryMatchSubmittedItemToTicket(targetedBag, 2, 0);
    assert(targetedMatch.matchedTicketIndex === 1, 'Magic bag did not target the matching service slot');
    assert(game.activeTickets[0].groups[0].completed === false, 'Older ticket should remain incomplete after targeted magic bag use');
    assert(game.activeTickets[1].groups[0].completed === true, 'Targeted ticket should complete after magic bag use');

    const fallbackGame = {
        grid: makeServiceGrid(),
        activeTickets: [makePlainBagTicket(1), makePlainBagTicket(2)]
    };
    const fallbackCycle = new ServiceCycle(fallbackGame);
    const fallbackBag = new ItemInstance('magic_bag');
    const fallbackMatch = fallbackCycle.tryMatchSubmittedItemToTicket(fallbackBag, 3, 4);
    assert(fallbackMatch.matchedTicketIndex === 0, 'Magic bag should fall back to oldest ticket when no service slot matches');
    assert(fallbackGame.activeTickets[0].groups[0].completed === true, 'Fallback magic bag should still complete the oldest ticket');
    assert(fallbackGame.activeTickets[1].groups[0].completed === false, 'Fallback should not skip ahead to a newer ticket');
}

function main() {
    const smooth = runClockSequence([16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16]);
    const jitter = runClockSequence([30, 10, 45, 5, 60, 50, 10]);
    assert(smooth.simTimeMs === jitter.simTimeMs, 'Fixed-step sim time diverged under frame jitter');
    assert(smooth.tickCount === jitter.tickCount, 'Fixed-step tick count diverged under frame jitter');

    const menu = makeMenu();
    const orderA = summarizeOrder(new OrderSystem(new Random(4242)).generateCustomerProfile(menu));
    const orderB = summarizeOrder(new OrderSystem(new Random(4242)).generateCustomerProfile(menu));
    assert(orderA === orderB, 'Order generation is not deterministic for the same seed');

    const spawnA = runPowerupSpawn(99);
    const spawnB = runPowerupSpawn(99);
    assert(spawnA === spawnB, 'Powerup spawn cell is not deterministic for the same seed');
    runMagicBagTargetingChecks();

    console.log(JSON.stringify({
        clock: smooth,
        order: JSON.parse(orderA),
        powerupCell: spawnA
    }, null, 2));
}

main();

import { item, makeTicket, makeTutorialRoom, plateStack, recipeAlert, recipeBoilSymbol, recipeImage, recipePlateBurger, recipeTile, row } from './helpers.js';

const recipeRows = [
    row(recipeImage('assets/patty-raw.png'), recipeBoilSymbol('+'), recipeTile('assets/sheets/grill_sheet.png'), recipeBoilSymbol('='), recipeImage('assets/patty-cooked.png')),
    row(recipeImage('assets/patty-cooked.png'), recipeBoilSymbol('+'), recipeImage('assets/bun.png'), recipeBoilSymbol('='), recipeImage('assets/burger.png')),
    row(recipeImage('assets/burger.png'), recipeBoilSymbol('+'), recipeImage('assets/plates/plate.png'), recipeBoilSymbol('='), recipePlateBurger())
];

export const LESSON_1_BURGERS = {
    id: 'burgers',
    label: 'Lesson 1: Burgers',
    player: { x: 4, y: 3, facing: { x: 0, y: 1 } },
    level: makeTutorialRoom({
        2: item('patty_box'),
        3: item('bun_box'),
        8: plateStack()
    }, { 4: 'GRILL' }, { lowerServiceCounter: true, showGarbage: false }),
    ticket: () => makeTicket(1, 'plate', []),
    alert: recipeAlert(recipeRows)
};

const itemsData = require('./data/items.json');

const availableSides = [];

const processSingleItem = (item) => {
    if (!item || !item.id) return;
    if (item.orderConfig && item.orderConfig.type === 'side') {
        availableSides.push(item);
    }
};

itemsData.groups.forEach(group => {
    if (group.item) processSingleItem(group.item);
    if (group.slice) processSingleItem(group.slice);
    if (group.items && Array.isArray(group.items)) {
        group.items.forEach(subItem => processSingleItem(subItem));
    }
});

console.log("Available Sides:", availableSides.map(s => s.id));

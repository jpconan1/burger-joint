import { DEFAULT_LEVEL } from '../data/LevelData.js';

export const State = {
    grid: [],
    level: 1,
    xp: 0,
    unlockedItems: ['bun', 'patty'],
    
    initGrid() {
        // Clone the level cells into our state
        this.grid = JSON.parse(JSON.stringify(DEFAULT_LEVEL.cells));
    },

    isWalkable(x, y) {
        if (x < 0 || y < 0 || y >= this.grid.length || x >= this.grid[0].length) return false;
        const cell = this.grid[y][x];
        if (!cell) return true;
        
        // Match old project's walkability logic
        const nonWalkableTypes = ['WALL', 'COUNTER', 'SERVICE', 'GRILL', 'CUTTING_BOARD', 'FRYER', 'GARBAGE', 'COMPUTER', 'RENO', 'MENU', 'DISHWASHER', 'CHUTE', 'SERVICE_WINDOW'];
        return !nonWalkableTypes.includes(cell.typeId);
    }
};

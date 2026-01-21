import { TILE_TYPES } from '../constants.js';
import { ItemInstance } from '../entities/Item.js';

export class Grid {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.cells = [];

        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push({
                    type: TILE_TYPES.FLOOR, // Default type
                    object: null,
                    state: {}, // Instance-specific state (e.g. stove on/off)
                });
            }
            this.cells.push(row);
        }
    }

    getCell(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
        return this.cells[y][x];
    }

    setTileType(x, y, tileType) {
        const cell = this.getCell(x, y);
        if (cell) {
            cell.type = tileType;
            // Initialize Default State based on Type
            if (tileType.id === 'STOVE') {
                cell.state = {
                    isOn: false,
                    isOn: false,
                    cookingSpeed: 2000, // ms to cook
                    facing: 0,
                };
            } else if (tileType.id === 'FRYER') {
                cell.state = {
                    status: 'empty',
                    status: 'empty',
                    cookingSpeed: 2000, // ms to fry
                    facing: 0,
                };
            } else if (tileType.id === 'PRINTER') {
                cell.state = {
                    printing: true,
                    frameDuration: 750,
                    loopDelay: 5000
                };
            } else if (['COUNTER', 'CUTTING_BOARD', 'DELIVERY_TILE'].includes(tileType.id)) {
                cell.state = {
                    facing: 0
                };
            } else {
                cell.state = {};
            }
        }
    }

    setObject(x, y, objectData) {
        const cell = this.getCell(x, y);
        if (cell) cell.object = objectData;
    }

    isWalkable(x, y) {
        const cell = this.getCell(x, y);
        if (!cell) return false;
        // Check if tile type is walkable
        // In the future, we might check if 'object' blocks movement too
        return cell.type.walkable;
    }

    serialize() {
        const data = {
            width: this.width,
            height: this.height,
            cells: []
        };
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                const cell = this.cells[y][x];
                row.push({
                    typeId: cell.type.id,
                    state: cell.state,
                    object: cell.object ? cell.object.serialize() : null
                });
            }
            data.cells.push(row);
        }
        return data;
    }

    deserialize(data) {
        this.width = data.width;
        this.height = data.height;
        this.cells = [];

        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                const cellData = data.cells[y][x];

                // Reconstruct Tile Type
                let tileType = TILE_TYPES[cellData.typeId];
                if (!tileType) tileType = TILE_TYPES.FLOOR; // Fallback

                // Reconstruct Object
                let object = null;
                if (cellData.object) {
                    object = ItemInstance.deserialize(cellData.object);
                }

                row.push({
                    type: tileType,
                    state: cellData.state || {},
                    object: object
                });
            }
            this.cells.push(row);
        }
    }
    resize(newWidth, newHeight, offsetX, offsetY) {
        const newCells = [];
        for (let y = 0; y < newHeight; y++) {
            const row = [];
            for (let x = 0; x < newWidth; x++) {
                row.push({
                    type: TILE_TYPES.WALL, // Default wall for new space
                    object: null,
                    state: {}
                });
            }
            newCells.push(row);
        }

        // Copy old cells
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const newX = x + offsetX;
                const newY = y + offsetY;
                if (newX >= 0 && newX < newWidth && newY >= 0 && newY < newHeight) {
                    newCells[newY][newX] = this.cells[y][x];
                }
            }
        }

        this.width = newWidth;
        this.height = newHeight;
        this.cells = newCells;
    }

    expandInterior(colIndex, rowIndex) {
        // Default rowIndex to colIndex if not provided (backward compatibility / cross expansion)
        if (rowIndex === undefined) rowIndex = colIndex;

        const newWidth = this.width + 1;
        const newHeight = this.height + 1;
        const newCells = [];

        for (let y = 0; y < newHeight; y++) {
            const row = [];
            for (let x = 0; x < newWidth; x++) {
                const isNewRow = (y === rowIndex);
                const isNewCol = (x === colIndex);

                if (isNewRow || isNewCol) {
                    let type = TILE_TYPES.FLOOR; // Default

                    // Caps for Inserted Row (Left/Right ends)
                    if (isNewRow && (x === 0 || x === newWidth - 1)) {
                        type = TILE_TYPES.COUNTER;
                    }
                    // Caps for Inserted Col (Top/Bottom ends)
                    if (isNewCol && (y === 0 || y === newHeight - 1)) {
                        type = TILE_TYPES.COUNTER;
                    }

                    row.push({
                        type: type,
                        object: null, // New space is empty
                        state: {}
                    });
                } else {
                    const oldX = x < colIndex ? x : x - 1;
                    const oldY = y < rowIndex ? y : y - 1;
                    row.push(this.cells[oldY][oldX]);
                }
            }
            newCells.push(row);
        }

        this.width = newWidth;
        this.height = newHeight;
        this.cells = newCells;
    }
}



import { TILE_TYPES, TILE_SIZE } from '../constants.js';
import { DEFINITIONS } from '../data/definitions.js';
import { ItemInstance } from '../entities/Item.js';

export class Editor {
    constructor(game) {
        this.game = game;
        this.isActive = false;
        this.selectedTool = null; // { type: 'tile' | 'object' | 'clear_object', id: string }
        this.uiContainer = null;

        this.handleCanvasClick = this.handleCanvasClick.bind(this);
    }

    toggle() {
        this.isActive = !this.isActive;
        const app = document.getElementById('app');

        if (this.isActive) {
            this.showUI();
            this.game.renderer.canvas.addEventListener('mousedown', this.handleCanvasClick);
            if (app) {
                app.style.transition = 'margin-right 0.3s ease';
                app.style.marginRight = '325px'; // 300px width + padding + spacer
            }
        } else {
            this.hideUI();
            this.game.renderer.canvas.removeEventListener('mousedown', this.handleCanvasClick);
            if (app) {
                app.style.marginRight = '0';
            }
        }
    }

    showUI() {
        if (!this.uiContainer) {
            this.createUI();
        }
        this.uiContainer.style.display = 'block';
    }

    hideUI() {
        if (this.uiContainer) {
            this.uiContainer.style.display = 'none';
        }
        this.selectedTool = null;
        this.clearSelection();
    }

    createUI() {
        this.uiContainer = document.createElement('div');
        this.uiContainer.style.position = 'absolute';
        this.uiContainer.style.top = '10px';
        this.uiContainer.style.right = '10px';
        this.uiContainer.style.width = '300px';
        this.uiContainer.style.height = '90vh';
        this.uiContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        this.uiContainer.style.color = '#eee';
        this.uiContainer.style.padding = '15px';
        this.uiContainer.style.overflowY = 'auto';
        this.uiContainer.style.fontFamily = 'monospace';
        this.uiContainer.style.border = '1px solid #444';
        this.uiContainer.style.borderRadius = '8px';
        this.uiContainer.style.zIndex = '1000';
        this.uiContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

        const header = document.createElement('h2');
        header.textContent = '🍔 Level Editor';
        header.style.marginTop = '0';
        header.style.textAlign = 'center';
        this.uiContainer.appendChild(header);

        const sub = document.createElement('p');
        sub.textContent = 'Shift+E to Close';
        sub.style.textAlign = 'center';
        sub.style.fontSize = '0.8em';
        sub.style.color = '#aaa';
        this.uiContainer.appendChild(sub);

        // Inspect Tool
        const inspectBtn = document.createElement('button');
        inspectBtn.textContent = '🔍 INSPECT / EDIT';
        inspectBtn.style.width = '100%';
        inspectBtn.style.padding = '10px';
        inspectBtn.style.marginBottom = '15px';
        inspectBtn.style.backgroundColor = '#9C27B0';
        inspectBtn.style.color = 'white';
        inspectBtn.style.border = 'none';
        inspectBtn.style.borderRadius = '4px';
        inspectBtn.style.cursor = 'pointer';
        inspectBtn.style.fontWeight = 'bold';
        inspectBtn.onclick = () => {
            this.clearSelection();
            inspectBtn.style.boxShadow = 'inset 0 0 5px rgba(0,0,0,0.5)';
            this.selectedTool = { type: 'inspect' };
        };
        this.uiContainer.appendChild(inspectBtn);

        // Properties Panel
        this.propertiesPanel = document.createElement('div');
        this.propertiesPanel.style.padding = '10px';
        this.propertiesPanel.style.marginBottom = '10px';
        this.propertiesPanel.style.backgroundColor = '#222';
        this.propertiesPanel.style.border = '1px solid #555';
        this.propertiesPanel.style.borderRadius = '4px';
        this.propertiesPanel.style.display = 'none';
        this.uiContainer.appendChild(this.propertiesPanel);

        // Global Settings Section
        this.createSettingsSection();

        // Tiles Section (Base + Appliances)
        this.createSection('Tiles & Appliances', TILE_TYPES, (key) => {
            this.selectedTool = { type: 'tile', id: key };
        });

        // Objects Section (Items)
        this.createObjectSection('Items & Objects');

        document.body.appendChild(this.uiContainer);
    }

    createSection(title, sourceObj, onClick) {
        const h3 = document.createElement('h3');
        h3.textContent = title;
        h3.style.borderBottom = '1px solid #555';
        h3.style.paddingBottom = '5px';
        this.uiContainer.appendChild(h3);

        const container = document.createElement('div');
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(3, 1fr)';
        container.style.gap = '8px';
        container.style.marginBottom = '20px';

        Object.keys(sourceObj).forEach(key => {
            const btn = document.createElement('button');
            btn.textContent = key;
            btn.style.fontSize = '11px';
            btn.style.cursor = 'pointer';
            btn.style.padding = '5px';
            btn.style.border = '1px solid #666';
            btn.style.background = '#333';
            btn.style.color = 'white';
            btn.style.borderRadius = '4px';

            btn.onclick = () => {
                this.clearSelection();
                btn.style.background = '#4CAF50';
                btn.style.borderColor = '#4CAF50';
                onClick(key);
            };
            container.appendChild(btn);
        });
        this.uiContainer.appendChild(container);
    }

    createObjectSection(title) {
        const h3 = document.createElement('h3');
        h3.textContent = title;
        h3.style.borderBottom = '1px solid #555';
        h3.style.paddingBottom = '5px';
        this.uiContainer.appendChild(h3);

        // Export Button
        const exportBtn = document.createElement('button');
        exportBtn.textContent = '💾 EXPORT JSON';
        exportBtn.style.width = '100%';
        exportBtn.style.padding = '8px';
        exportBtn.style.marginBottom = '10px';
        exportBtn.style.backgroundColor = '#FF9800';
        exportBtn.style.color = 'white';
        exportBtn.style.border = 'none';
        exportBtn.style.borderRadius = '4px';
        exportBtn.style.cursor = 'pointer';
        exportBtn.style.fontWeight = 'bold';
        exportBtn.onclick = () => {
            const data = this.game.grid.serialize();
            const json = JSON.stringify(data);
            console.log('--- LEVEL JSON ---');
            console.log(json);
            console.log('------------------');
            alert('Level JSON exported to Console! Please copy it and send it to the developer.');
        };
        this.uiContainer.appendChild(exportBtn);

        // Erase Button
        const clearBtn = document.createElement('button');
        clearBtn.textContent = '✖ ERASE OBJECT';
        clearBtn.style.width = '100%';
        clearBtn.style.padding = '8px';
        clearBtn.style.marginBottom = '10px';
        clearBtn.style.backgroundColor = '#f44336';
        clearBtn.style.color = 'white';
        clearBtn.style.border = 'none';
        clearBtn.style.borderRadius = '4px';
        clearBtn.style.cursor = 'pointer';
        clearBtn.style.fontWeight = 'bold';

        clearBtn.onclick = () => {
            this.clearSelection();
            clearBtn.style.boxShadow = 'inset 0 0 5px rgba(0,0,0,0.5)';
            this.selectedTool = { type: 'clear_object' };
        };
        this.uiContainer.appendChild(clearBtn);

        const container = document.createElement('div');
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(2, 1fr)';
        container.style.gap = '8px';

        Object.keys(DEFINITIONS).forEach(key => {
            const btn = document.createElement('button');
            btn.textContent = key;
            btn.style.fontSize = '11px';
            btn.style.cursor = 'pointer';
            btn.style.padding = '5px';
            btn.style.border = '1px solid #666';
            btn.style.background = '#333';
            btn.style.color = 'white';
            btn.style.borderRadius = '4px';
            btn.style.overflow = 'hidden';
            btn.style.textOverflow = 'ellipsis';

            btn.onclick = () => {
                this.clearSelection();
                btn.style.background = '#2196F3';
                btn.style.borderColor = '#2196F3';
                this.selectedTool = { type: 'object', id: key };
            };
            container.appendChild(btn);
        });
        this.uiContainer.appendChild(container);
    }

    clearSelection() {
        if (!this.uiContainer) return;
        const btns = this.uiContainer.querySelectorAll('button');
        btns.forEach(b => {
            b.style.boxShadow = '';

            if (b.textContent.includes('ERASE')) {
                b.style.backgroundColor = '#f44336';
            } else if (b.textContent.includes('INSPECT')) {
                b.style.backgroundColor = '#9C27B0';
            } else {
                b.style.background = '#333';
                b.style.borderColor = '#666';
            }
        });
    }

    handleCanvasClick(event) {
        if (!this.isActive || !this.selectedTool) return;

        const rect = this.game.renderer.canvas.getBoundingClientRect();
        const scaleX = this.game.renderer.canvas.width / rect.width;
        const scaleY = this.game.renderer.canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        const gridX = Math.floor(x / TILE_SIZE);
        const gridY = Math.floor(y / TILE_SIZE);

        if (gridX < 0 || gridX >= this.game.grid.width || gridY < 0 || gridY >= this.game.grid.height) return;

        console.log(`Editor Action: ${this.selectedTool.type} ${this.selectedTool.id || ''} at ${gridX}, ${gridY}`);

        if (this.selectedTool.type === 'tile') {
            const tileType = TILE_TYPES[this.selectedTool.id];
            this.game.grid.setTileType(gridX, gridY, tileType);
        } else if (this.selectedTool.type === 'object') {
            this.game.grid.setObject(gridX, gridY, new ItemInstance(this.selectedTool.id));
        } else if (this.selectedTool.type === 'clear_object') {
            this.game.grid.setObject(gridX, gridY, null);
        } else if (this.selectedTool.type === 'inspect') {
            const cell = this.game.grid.getCell(gridX, gridY);
            this.showProperties(cell, gridX, gridY);
            return; // Don't save on inspect
        }

        // Auto-save on modification
        this.game.saveLevel();
    }

    showProperties(cell, x, y) {
        this.propertiesPanel.innerHTML = '';
        this.propertiesPanel.style.display = 'block';

        const title = document.createElement('strong');
        title.textContent = `Cell (${x}, ${y})`;
        title.style.display = 'block';
        title.style.marginBottom = '5px';
        this.propertiesPanel.appendChild(title);

        const typeInfo = document.createElement('div');
        typeInfo.textContent = `Type: ${cell.type.id}`;
        this.propertiesPanel.appendChild(typeInfo);

        if (cell.type.id === 'STOVE') {
            const label = document.createElement('label');
            label.textContent = 'Cooking Speed (ms): ';
            label.style.display = 'block';
            label.style.marginTop = '5px';

            const input = document.createElement('input');
            input.type = 'number';
            input.value = cell.state.cookingSpeed || 2000;
            input.style.width = '60px';
            input.style.marginLeft = '5px';
            input.style.color = 'black'; // Ensure visible

            input.onchange = (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                    cell.state.cookingSpeed = val;
                    console.log(`Updated stove at ${x},${y} speed to ${val}`);
                    this.game.saveLevel();
                }
            };

            label.appendChild(input);
            this.propertiesPanel.appendChild(label);
        }

        if (cell.type.id === 'FRYER') {
            const label = document.createElement('label');
            label.textContent = 'Frying Speed (ms): ';
            label.style.display = 'block';
            label.style.marginTop = '5px';

            const input = document.createElement('input');
            input.type = 'number';
            input.value = cell.state.cookingSpeed || 2000;
            input.style.width = '60px';
            input.style.marginLeft = '5px';
            input.style.color = 'black';

            input.onchange = (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                    cell.state.cookingSpeed = val;
                    console.log(`Updated fryer at ${x},${y} speed to ${val}`);
                    this.game.saveLevel();
                    console.log('Game Saved via Editor.');
                }
            };

            label.appendChild(input);
            this.propertiesPanel.appendChild(label);
        }

        if (cell.type.id === 'DISPENSER') {
            const label = document.createElement('label');
            label.textContent = 'Mayo Charges: ';
            label.style.display = 'block';
            label.style.marginTop = '5px';

            const input = document.createElement('input');
            input.type = 'number';
            // Default to current charges or 15 if unset but has_mayo, or 0
            input.value = cell.state.charges !== undefined ? cell.state.charges : (cell.state.status === 'has_mayo' ? 15 : 0);
            input.style.width = '60px';
            input.style.marginLeft = '5px';
            input.style.color = 'black';

            input.onchange = (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                    cell.state.charges = val;
                    // Auto-update status
                    if (val > 0) {
                        cell.state.status = 'has_mayo';
                    } else {
                        cell.state.status = 'empty';
                    }
                    console.log(`Updated dispenser at ${x},${y} charges to ${val} (status: ${cell.state.status})`);
                    this.game.saveLevel();
                }
            };

            label.appendChild(input);
            this.propertiesPanel.appendChild(label);
        }
    }

    createSettingsSection() {
        const h3 = document.createElement('h3');
        h3.textContent = 'Game Settings';
        h3.style.borderBottom = '1px solid #555';
        h3.style.paddingBottom = '5px';
        this.uiContainer.appendChild(h3);

        const container = document.createElement('div');
        container.style.marginBottom = '20px';

        const label = document.createElement('label');
        label.textContent = 'Day Length (s): ';
        // label.style.display = 'block';

        const input = document.createElement('input');
        input.type = 'number';
        input.value = this.game.dayDuration;
        input.style.width = '60px';
        input.style.marginLeft = '10px';
        input.style.color = 'black';
        input.style.padding = '2px 5px';
        input.style.borderRadius = '3px';
        input.style.border = '1px solid #ccc';

        input.onchange = (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val > 0) {
                this.game.dayDuration = val;
                console.log(`Day duration set to ${val}s`);
                this.game.saveLevel(); // Auto-save settings
            }
        };

        label.appendChild(input);
        container.appendChild(label);
        this.uiContainer.appendChild(container);
    }
}

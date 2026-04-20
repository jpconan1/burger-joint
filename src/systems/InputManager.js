import { TILE_TYPES, ASSETS } from '../constants.js';
import { DEFINITIONS } from '../data/definitions.js';
import { ACTIONS } from './Settings.js';
import { ItemInstance } from '../entities/Item.js';
import { Ticket, OrderGroup } from './OrderSystem.js';

export class InputManager {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.pickupKeyHeldDuration = 0;
        this.pickupActionTriggered = false;
        this.interactKeyHeldDuration = 0;
        this.swappingActionTriggered = false;

        window.addEventListener('keydown', this.handleInput.bind(this));
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
        window.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    }

    // Called each frame when not paused — polls held keys for appliance interactions
    update(dt) {
        const g = this.game;

        const pickUpKey = g.settings.getBinding(ACTIONS.PICK_UP);
        const interactKey = g.settings.getBinding(ACTIONS.INTERACT);

        const isPickupHeld = this.keys[pickUpKey] || this.keys['Space'];

        if (isPickupHeld) {
            this.pickupKeyHeldDuration = (this.pickupKeyHeldDuration || 0) + dt;
            if (this.pickupKeyHeldDuration >= 500 && !this.pickupActionTriggered) {
                g.player.actionPickUpAppliance(g.grid, g);
                this.pickupActionTriggered = true;
            }
        } else {
            this.pickupKeyHeldDuration = 0;
            this.pickupActionTriggered = false;
        }

        const isInteractHeld = this.keys[interactKey];
        if (isInteractHeld) {
            this.interactKeyHeldDuration = (this.interactKeyHeldDuration || 0) + dt;
            if (this.interactKeyHeldDuration >= 500 && !this.swappingActionTriggered && g.gameState === 'PLAYING') {
                this.initiateApplianceSwap();
                this.swappingActionTriggered = true;
            }
        } else {
            this.interactKeyHeldDuration = 0;
            this.swappingActionTriggered = false;
        }

        if (g.gameState === 'APPLIANCE_SWAP' && g.swappingState && g.swappingState.waitingForRelease) {
            if (!isInteractHeld) {
                g.swappingState.waitingForRelease = false;
            }
        }
    }

    handleInput(event) {
        const g = this.game;
        this.keys[event.code] = true;

        // Bomb Cheat (Cmd+B)
        if (event.code === 'KeyB' && (event.metaKey || event.ctrlKey)) {
            g.powerupSystem.spawnPowerup({ id: 'bomb' });
            g.powerupSystem.bombSpawned = true;
            event.preventDefault();
            return;
        }

        if (g.alertSystem?.isVisible) return g.alertSystem.handleInput(event.code);
        g.audioSystem?.resume();

        // Cheats (Shift / Command + Key)
        if ((event.shiftKey || event.metaKey) && this.handleCheatInput(event)) return;

        // Global key overrides
        if (event.code === 'KeyO') return this.handleCheatInput(event);

        if (event.code === 'Escape' && (g.gameState === 'PLAYING' || g.gameState === 'PAUSED')) {
            g.gameState = g.gameState === 'PLAYING' ? 'PAUSED' : 'PLAYING';
            if (g.gameState === 'PAUSED') g.audioSystem.setMuffled(true);
            else g.audioSystem.setMuffled(false);
            return;
        }

        switch (g.gameState) {
            case 'TITLE':
            case 'SETTINGS':
                return this.handleMenuInput(event);
            case 'APPLIANCE_SWAP':
                return this.handleApplianceSwapInput(event);
            case 'PAUSED':
                return;
        }

        this.handleGameplayInput(event);
    }

    handleCheatInput(event) {
        const g = this.game;
        const { code, shiftKey } = event;

        if (shiftKey) {
            if (code === 'KeyP') {
                console.log("--- EXPORTED LAYOUT ---", JSON.stringify(g.grid.serialize(), null, 4));
                g.addFloatingText("Layout exported to Console!", g.player.x, g.player.y, '#00ff00');
                return true;
            }
            if (code === 'KeyA' || code === 'KeyU') {
                const rewards = [DEFINITIONS['bacon_box'], DEFINITIONS['cheddar_box'], DEFINITIONS['tomato_box']];
                if (code === 'KeyU') rewards.push(DEFINITIONS['onion_box'], DEFINITIONS['pickle_box']);
                g.alertSystem.trigger('unlock_alert', () => { }, { rewards });
                return true;
            }
            if (code === 'KeyT') {
                const makeTicket = (containerType, burgerConfig, items = []) => {
                    const t = new Ticket(++g.ticketsGeneratedToday);
                    const grp = new OrderGroup(containerType);
                    grp.addBurger(burgerConfig);
                    items.forEach(id => grp.addItem(id));
                    grp.payout = g.orderSystem.calculateGroupPayout(grp);
                    t.addGroup(grp);
                    t.calculateParTime();
                    return t;
                };

                // 1. Plain beef burger
                g.ticketQueue.push(makeTicket('plate', {
                    base: 'Beef', bun: 'plain_bun',
                    modifications: ['beef_patty']
                }));

                // 2. Plain beef burger + fries
                g.ticketQueue.push(makeTicket('bag', {
                    base: 'Beef', bun: 'plain_bun',
                    modifications: ['beef_patty']
                }, ['fries']));

                // 3. Beef with lettuce/tomato/pickle/onion, pickles modded off
                g.ticketQueue.push(makeTicket('plate', {
                    base: 'Beef', bun: 'plain_bun',
                    modifications: ['beef_patty', 'lettuce_leaf', 'tomato_slice', 'pickle_slice', 'onion_slice'],
                    customerMod: { type: 'remove', toppingId: 'pickle_slice' }
                }));

                // 4. Chicken with swiss + bacon, bacon modded off + sweet potato fries
                g.ticketQueue.push(makeTicket('bag', {
                    base: 'Chicken', bun: 'plain_bun',
                    modifications: ['chicken_patty', 'swiss_cheese', 'bacon'],
                    customerMod: { type: 'remove', toppingId: 'bacon' }
                }, ['sweet_potato_fries']));

                g.addFloatingText("Cheat: 4 Test Tickets!", g.player.x, g.player.y, '#00ffff');
                return true;
            }
        }

        if (event.metaKey && code === 'KeyX') {
            g.addXp(1);
            g.addFloatingText("+1 XP (CHEAT)", g.player.x, g.player.y, '#ffd700');
            return true;
        }

        if (code === 'KeyO') {
            const cell = g.player.getTargetCell(g.grid);
            if (cell?.type.id === 'COUNTER' && !cell.object) {
                const stack = new ItemInstance('dirty_plate');
                stack.state.count = 9;
                cell.object = stack;
                g.addFloatingText("Cheat: 9 Dirty Plates!", g.player.x, g.player.y, '#ff0000');
                return true;
            }
        }

        return false;
    }

    handleMenuInput(event) {
        const g = this.game;
        const action = g.settings.getAction(event.code);
        const isSelect = action === ACTIONS.INTERACT || event.code === 'Enter' || event.code === 'Space';

        if (g.gameState === 'TITLE') {
            if (action === ACTIONS.MOVE_UP) g.titleSelection = g.titleSelection === 0 ? 1 : 0;
            else if (action === ACTIONS.MOVE_DOWN) g.titleSelection = g.titleSelection === 1 ? 0 : 1;
            else if (isSelect) {
                if (g.titleSelection === 0) {
                    g.startNewGame();
                    g.startDay();
                    g.gameState = 'PLAYING';
                    g.alertSystem.trigger('welcome_alert');
                } else {
                    g.gameState = 'SETTINGS';
                    g.settingsState = { selectedIndex: 0, rebindingAction: null };
                }
            }
            return;
        }

        if (g.gameState === 'SETTINGS') {
            if (g.settingsState.rebindingAction) {
                if (event.code === 'Escape') g.settingsState.rebindingAction = null;
                else {
                    g.settings.setBinding(g.settingsState.rebindingAction, event.code);
                    g.settingsState.rebindingAction = null;
                }
                return;
            }

            const keyActions = ['MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT', 'INTERACT', 'PICK_UP', 'VIEW_ORDERS', 'EQUIP_1', 'EQUIP_2', 'EQUIP_3', 'EQUIP_4'];
            const totalItems = 2 + keyActions.length;

            if (action === ACTIONS.MOVE_UP) g.settingsState.selectedIndex = (g.settingsState.selectedIndex - 1 + totalItems) % totalItems;
            else if (action === ACTIONS.MOVE_DOWN) g.settingsState.selectedIndex = (g.settingsState.selectedIndex + 1) % totalItems;
            else if (isSelect) {
                const idx = g.settingsState.selectedIndex;
                if (idx < 2) {
                    const pref = idx === 0 ? 'musicEnabled' : 'sfxEnabled';
                    g.settings.preferences[pref] = !g.settings.preferences[pref];
                    g.settings.save();
                    g.audioSystem.updateVolumesFromSettings();
                } else {
                    g.settingsState.rebindingAction = keyActions[idx - 2];
                }
            } else if (event.code === 'Escape') {
                g.gameState = 'TITLE';
            }
        }
    }

    handleGameplayInput(event) {
        const g = this.game;
        const action = g.settings.getAction(event.code);
        let dx = 0, dy = 0;

        if (action === ACTIONS.MOVE_UP) dy = -1;
        else if (action === ACTIONS.MOVE_DOWN) dy = 1;
        else if (action === ACTIONS.MOVE_LEFT) dx = -1;
        else if (action === ACTIONS.MOVE_RIGHT) dx = 1;

        if (dx !== 0 || dy !== 0) {
            if (g.player.move(dx, dy, g.grid)) {
                const cell = g.grid.getCell(g.player.x, g.player.y);
                const isDoor = cell && (cell.type.isDoor || cell.type.id === 'EXIT_DOOR');
                if (!isDoor) {
                    g.addEffect({
                        type: 'dust',
                        x: g.player.x - dx,
                        y: g.player.y - dy,
                        rotation: Math.atan2(dy, dx) - Math.PI,
                        startTime: Date.now(),
                        duration: 300
                    });
                }
                if (cell && cell.type.isDoor) this.handleDoorTraversal(cell);
                else if (cell?.type.id === 'EXIT_DOOR') g.endDay();
            } else {
                const currentCell = g.grid.getCell(g.player.x, g.player.y);
                if (currentCell?.type.isDoor) {
                    const targetX = g.player.x + dx, targetY = g.player.y + dy;
                    if (targetX < 0 || targetX >= g.grid.width || targetY < 0 || targetY >= g.grid.height) {
                        this.handleDoorTraversal(currentCell);
                    }
                }
            }
            return;
        }

        if (action === ACTIONS.PICK_UP && !event.repeat && !this.pickupActionTriggered) {
            if (g.isViewingOrders) {
                g.ticketQueue = [];
                g.activeTickets = [];
                g.incomingTicket = null;
                g.addFloatingText("Service Terminated", g.player.x, g.player.y, '#ff0000');
            } else {
                g.player.actionPickUp(g.grid, g);
            }
            return;
        }

        if (action === ACTIONS.INTERACT && !event.repeat) {
            const facingCell = g.player.getTargetCell(g.grid);
            if (facingCell?.type.id === 'MENU') {
                if (g.isEndgameUnlocked) {
                    g.gameState = 'MENU_CUSTOM';
                } else {
                    g.addFloatingText("Locked!", g.player.x, g.player.y, '#ff0000');
                }
            } else if (facingCell?.type.id === 'SERVICE_WINDOW') {
                if (g.isPrepTime) {
                    g.isPrepTime = false;
                    g.ticketTimer = 10000;
                    g.addFloatingText("Service Started!", g.player.x, g.player.y, '#00ff00');
                }
            } else {
                g.player.actionInteract(g.grid, g);
            }
        }
    }

    handleMouseDown(event) {
        const g = this.game;
        if (g.alertSystem?.isVisible) return;
        if (!g.renderer?.canvas) return;

        const rect = g.renderer.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        if (g.renderer.pauseButtonRect) {
            const p = g.renderer.pauseButtonRect;
            if (mouseX >= p.x && mouseX <= p.x + p.width && mouseY >= p.y && mouseY <= p.y + p.height) {
                g.gameState = g.gameState === 'PAUSED' ? 'PLAYING' : 'PAUSED';
                if (g.gameState === 'PAUSED') g.audioSystem.setMuffled(true);
                else g.audioSystem.setMuffled(false);
                return;
            }
        }

        if (g.gameState === 'PAUSED') {
            g.gameState = 'PLAYING';
            g.audioSystem.setMuffled(false);
            return;
        }

        if (g.gameState === 'TITLE') {
            const centerX = g.renderer.canvas.width / 2;
            const startY = g.renderer.canvas.height / 2 + 30;
            const spacing = 60;

            if (mouseX > centerX - 150 && mouseX < centerX + 150 &&
                mouseY > startY - 30 && mouseY < startY + 30) {
                g.titleSelection = 0;
                g.startNewGame();
                g.startDay();
                g.gameState = 'PLAYING';
            } else if (mouseX > centerX - 150 && mouseX < centerX + 150 &&
                mouseY > startY + spacing - 30 && mouseY < startY + spacing + 30) {
                g.titleSelection = 1;
                g.gameState = 'SETTINGS';
                g.settingsState = { selectedIndex: 0, rebindingAction: null };
            }
        } else if (g.gameState === 'SETTINGS') {
            const idx = this.getSettingsIndexAt(mouseX, mouseY);
            if (idx !== -1) {
                if (g.settingsState.rebindingAction) return;

                g.settingsState.selectedIndex = idx;
                if (idx < 2) {
                    const pref = idx === 0 ? 'musicEnabled' : 'sfxEnabled';
                    g.settings.preferences[pref] = !g.settings.preferences[pref];
                    g.settings.save();
                    g.audioSystem.updateVolumesFromSettings();
                } else {
                    const keyActions = ['MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT', 'INTERACT', 'PICK_UP', 'VIEW_ORDERS', 'EQUIP_1', 'EQUIP_2', 'EQUIP_3', 'EQUIP_4'];
                    g.settingsState.rebindingAction = keyActions[idx - 2];
                }
            }
        }
    }

    handleMouseMove(event) {
        const g = this.game;
        if (g.alertSystem?.isVisible) return;
        if (!g.renderer?.canvas) return;

        const rect = g.renderer.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        if (g.gameState === 'TITLE') {
            const centerX = g.renderer.canvas.width / 2;
            const startY = g.renderer.canvas.height / 2 + 30;
            const spacing = 60;

            if (mouseX > centerX - 150 && mouseX < centerX + 150) {
                if (mouseY > startY - 30 && mouseY < startY + 30) {
                    g.titleSelection = 0;
                } else if (mouseY > startY + spacing - 30 && mouseY < startY + spacing + 30) {
                    g.titleSelection = 1;
                }
            }
        } else if (g.gameState === 'SETTINGS') {
            const idx = this.getSettingsIndexAt(mouseX, mouseY);
            if (idx !== -1 && !g.settingsState.rebindingAction) {
                g.settingsState.selectedIndex = idx;
            }
        }
    }

    getSettingsIndexAt(mouseX, mouseY) {
        const g = this.game;
        if (!g.renderer?.canvas) return -1;
        const width = g.renderer.canvas.width;
        if (mouseX < 100 || mouseX > width - 100) return -1;

        let currentY = 140;
        const rowHeight = 40;

        for (let i = 0; i < 2; i++) {
            if (mouseY > currentY - 25 && mouseY < currentY + 15) return i;
            currentY += rowHeight;
        }

        currentY += 60; // Spacer + header
        for (let i = 0; i < 11; i++) {
            if (mouseY > currentY - 25 && mouseY < currentY + 15) return i + 2;
            currentY += rowHeight;
        }

        return -1;
    }

    handleDoorTraversal(cell) {
        const g = this.game;
        const state = cell.state;

        g.audioSystem.playSFX(ASSETS.AUDIO.DOOR);

        if (state && state.targetRoom && state.targetDoorId) {
            const targetGrid = g.rooms[state.targetRoom];
            if (targetGrid) {
                let targetX = -1, targetY = -1;

                for (let y = 0; y < targetGrid.height; y++) {
                    for (let x = 0; x < targetGrid.width; x++) {
                        const c = targetGrid.getCell(x, y);
                        if (c.state && c.state.id === state.targetDoorId) {
                            targetX = x;
                            targetY = y;
                            break;
                        }
                    }
                    if (targetX !== -1) break;
                }

                if (targetX !== -1) {
                    g.currentRoomId = state.targetRoom;
                    g.grid = targetGrid;
                    g.player.x = targetX;
                    g.player.y = targetY;

                    if (targetX === 0) g.player.x += 1;
                    else if (targetX === targetGrid.width - 1) g.player.x -= 1;
                    else if (targetY === 0) g.player.y += 1;
                    else if (targetY === targetGrid.height - 1) g.player.y -= 1;

                    g.player.snap();
                } else {
                    console.error("Target door not found:", state.targetDoorId);
                }
            } else {
                console.error("Target room not found:", state.targetRoom);
            }
        }
    }

    initiateApplianceSwap() {
        const g = this.game;
        const targetX = g.player.x + g.player.facing.x;
        const targetY = g.player.y + g.player.facing.y;
        const cell = g.grid.getCell(targetX, targetY);

        if (!cell) return;

        if (cell.object) {
            g.addFloatingText("Remove item first!", targetX, targetY, '#ff0000');
            return;
        }

        const cyclable = ['COUNTER', 'CUTTING_BOARD', 'FRYER', 'GRILL', 'DISHWASHER'];

        if (cyclable.includes(cell.type.id)) {
            g.gameState = 'APPLIANCE_SWAP';
            g.swappingState = {
                x: targetX,
                y: targetY,
                options: cyclable,
                currentIndex: cyclable.indexOf(cell.type.id),
                waitingForRelease: true
            };
            g.addFloatingText("Swap Mode!", targetX, targetY, '#ffff00');
        }
    }

    handleApplianceSwapInput(event) {
        const g = this.game;
        if (!g.swappingState) {
            g.gameState = 'PLAYING';
            return;
        }

        const LEFT = g.settings.getBinding(ACTIONS.MOVE_LEFT);
        const RIGHT = g.settings.getBinding(ACTIONS.MOVE_RIGHT);
        const INTERACT = g.settings.getBinding(ACTIONS.INTERACT);

        const isLeft = event.code === LEFT || event.code === 'ArrowLeft';
        const isRight = event.code === RIGHT || event.code === 'ArrowRight';
        const isSet = event.code === INTERACT || event.code === 'Enter';

        if (event.type === 'keydown') {
            if (isLeft || isRight) {
                let idx = g.swappingState.currentIndex;
                if (isLeft) idx--;
                else idx++;

                if (idx < 0) idx = g.swappingState.options.length - 1;
                if (idx >= g.swappingState.options.length) idx = 0;

                g.swappingState.currentIndex = idx;

                const newType = TILE_TYPES[g.swappingState.options[idx]];
                if (newType) {
                    g.grid.setTileType(g.swappingState.x, g.swappingState.y, newType);
                    g.updateCapabilities();
                }
            } else if (isSet) {
                if (g.swappingState.waitingForRelease) return;
                g.gameState = 'PLAYING';
                g.swappingState = null;
                g.addFloatingText("Set!", g.player.x, g.player.y, '#00ff00');
            }
        }
    }
}

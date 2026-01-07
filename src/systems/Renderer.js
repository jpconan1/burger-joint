import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, ASSETS } from '../constants.js';

export class Renderer {
    constructor(canvasId, assetLoader) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = canvasId;
        this.ctx = this.canvas.getContext('2d');
        this.assetLoader = assetLoader;

        // Initialize canvas to full window size
        this.resizeCanvas();

        // Listen for window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });

        // Store offsets for other methods (like cursor) to use
        this.offsetX = 0;
        this.offsetY = 0;

        document.getElementById('app').appendChild(this.canvas);
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Pixel art style might need resetting after resize if context is cleared/reset
        this.ctx.imageSmoothingEnabled = false;
    }

    render(gameState) {
        // Ensure canvas fills window (rendering loop handling for robust resizing)
        if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
            this.resizeCanvas();
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate centering offsets
        this.offsetX = 0;
        this.offsetY = 0;

        if (gameState.grid) {
            const gridPixelWidth = gameState.grid.width * TILE_SIZE;
            const gridPixelHeight = gameState.grid.height * TILE_SIZE;

            this.offsetX = Math.floor((this.canvas.width - gridPixelWidth) / 2);
            this.offsetY = Math.floor((this.canvas.height - gridPixelHeight) / 2);
        }

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);

        // 1. Draw Floor/Walls (Base Layer)
        for (let y = 0; y < gameState.grid.height; y++) {
            for (let x = 0; x < gameState.grid.width; x++) {
                const cell = gameState.grid.getCell(x, y);

                let tileTexture = cell.type.texture;

                if (cell.type.id === 'TICKET_WHEEL') {
                    if (gameState.activeTickets && gameState.activeTickets.length > 0) {
                        tileTexture = ASSETS.TILES.TICKET_WHEEL_ORDER;
                    }
                }
                if (cell.type.id === 'STOVE' && cell.state.isOn) {
                    tileTexture = ASSETS.TILES.STOVE_ON;
                }

                if (cell.type.id === 'CUTTING_BOARD' && cell.state) {
                    if (cell.state.status === 'has_tomato') tileTexture = ASSETS.TILES.CUTTING_BOARD_TOMATO;
                    else if (cell.state.status === 'has_slice') tileTexture = ASSETS.TILES.CUTTING_BOARD_SLICE;
                    else if (cell.state.status === 'dirty') tileTexture = ASSETS.TILES.CUTTING_BOARD_DIRTY;
                }

                if (cell.type.id === 'DISPENSER' && cell.state) {
                    if (cell.state.status === 'has_mayo') {
                        tileTexture = ASSETS.TILES.DISPENSER_MAYO;
                        const charges = cell.state.charges;
                        // Range logic: 15 max.
                        // > 10: Full
                        // 6-10: Partial 1
                        // 1-5: Partial 2
                        // 0: Empty (handled by has_mayo/empty status switch)
                        if (charges <= 10 && charges > 5) tileTexture = ASSETS.TILES.DISPENSER_MAYO_PARTIAL1;
                        else if (charges <= 5) tileTexture = ASSETS.TILES.DISPENSER_MAYO_PARTIAL2;
                    }
                }

                if (cell.type.id === 'FRYER' && cell.state) {
                    if (cell.state.status === 'loaded') tileTexture = ASSETS.TILES.FRYER_FRIES;
                    else if (cell.state.status === 'down') tileTexture = ASSETS.TILES.FRYER_DOWN;
                    else if (cell.state.status === 'done') tileTexture = ASSETS.TILES.FRYER_DONE;
                }

                if (cell.type.id === 'SODA_FOUNTAIN' && cell.state) {
                    if (cell.state.status === 'empty') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_EMPTY;
                    else if (cell.state.status === 'full') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_FULL;
                    else if (cell.state.status === 'warning') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_WARNING;
                    else if (cell.state.status === 'filling') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_FILLING;
                    else if (cell.state.status === 'done') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_DONE;
                }

                if (cell.type.id === 'SHUTTER_DOOR') {
                    if (cell.state && cell.state.hasOwnProperty('isOpen') && !cell.state.isOpen) {
                        tileTexture = ASSETS.TILES.SHUTTER_TILE_CLOSED;
                    }
                }

                if (cell.type.id === 'PRINTER') {
                    if (cell.state && cell.state.printing) {
                        const elapsed = Date.now() - cell.state.printStartTime;
                        const duration = 2250; // Print for 2.25 seconds per ticket (3 frames * 750ms)
                        if (elapsed < duration) {
                            const frame = Math.floor(elapsed / 750) % 3;
                            if (frame === 0) tileTexture = ASSETS.TILES.PRINTER_PRINT1;
                            else if (frame === 1) tileTexture = ASSETS.TILES.PRINTER_PRINT2;
                            else tileTexture = ASSETS.TILES.PRINTER_PRINT3;
                        } else {
                            // Animation finished
                            // Optional: cell.state.printing = false; // Clean up state if desired, but not strictly necessary for visual only
                        }
                    }
                }

                if (cell.type.id === 'SERVICE') {
                    if (gameState.activeTickets && gameState.activeTickets.length > 0) {
                        const ticket = gameState.activeTickets[0];
                        // Calculate percentage based on par time vs elapsed
                        // If elapsed > par, it's late (percent <= 0)
                        const pct = Math.max(0, (ticket.parTime - ticket.elapsedTime) / ticket.parTime);

                        // "timer deletes (and stays depleted) once the order is 'late'"
                        if (pct > 0) {
                            this.drawServiceTimer(x, y, pct);
                        }
                    }
                }

                this.drawTile(tileTexture, x, y);

                // 2. Draw Objects (counters, boxes, etc.)
                if (cell.object) {
                    // Objects stored in cell.object.texture
                    this.drawObject(cell.object.texture, x, y);

                    // Cooking Progress Bar
                    if (cell.type.id === 'STOVE' && cell.state.isOn) {
                        const item = cell.object;
                        if (item.state && item.state.cookingProgress > 0 && item.state.cook_level === 'raw') {
                            const max = cell.state.cookingSpeed || 2000;
                            const pct = Math.min(item.state.cookingProgress / max, 1);
                            this.drawProgressBar(x, y, pct);
                        }
                    }
                }

                // 2.5 Draw Fryer Progress
                if (cell.type.id === 'FRYER') {
                    if (cell.state && cell.state.status === 'down') {
                        const max = cell.state.cookingSpeed || 2000;
                        const pct = Math.min(cell.state.timer / max, 1);
                        this.drawProgressBar(x, y, pct);
                    }
                }

                // 2.6 Draw Soda Filling Progress
                if (cell.type.id === 'SODA_FOUNTAIN') {
                    if (cell.state && cell.state.status === 'filling') {
                        const max = cell.state.fillDuration || 3000;
                        const pct = Math.min((cell.state.timer || 0) / max, 1);
                        this.drawProgressBar(x, y, pct);
                    }
                }

                // 2.7 Draw Box Quantity (only if open)
                if (cell.object && cell.object.type === 'Box' && cell.object.state && cell.object.state.isOpen) {
                    const count = cell.object.state.count;
                    if (count !== undefined) {
                        this.drawTinyNumber(x, y, count);
                    }
                }
            }
        }

        // 3. Draw Player
        if (gameState.player) {
            this.drawEntity(gameState.player.texture, gameState.player.x, gameState.player.y);

            // Draw Tool
            if (gameState.player.toolTexture) {
                // Calculate rotation based on facing direction
                // Default sprite updates usually point Up (0 rad) or Right. 
                // Assuming Up is default 0 rotation for assets. 
                // atan2(y, x) -> Right=0, Down=PI/2, Left=PI, Up=-PI/2
                // Adj: Up -> 0 => +PI/2
                const rotation = Math.atan2(gameState.player.facing.y, gameState.player.facing.x) + Math.PI / 2;
                this.drawRotatedEntity(gameState.player.toolTexture, gameState.player.x, gameState.player.y, rotation);
            }

            // Draw Held Item
            if (gameState.player.heldItem && gameState.player.heldItem.texture) {
                // Draw item on top of player (or slightly offset?)
                // PlateUp usually holds items in front or above head. 
                // Since this is top down 2D, let's draw it centered but maybe slightly scaled?
                // Or just on top for now.
                this.drawEntity(gameState.player.heldItem.texture, gameState.player.x, gameState.player.y);
            }
        }

        this.ctx.restore();

        // 4. Draw UI Overlays (Screen Space)
        if (gameState.isViewingOrders) {
            this.drawOrderTickets(gameState.orders || [], gameState.pickUpKey, gameState.penalty);
        }

        // 5. Draw HUD (Screen Space)
        this.drawHUD(gameState);

        // 6. Draw Floating Texts (World Space projected)
        if (gameState.floatingTexts) {
            this.drawFloatingTexts(gameState.floatingTexts);
        }
    }

    drawServiceTimer(gridX, gridY, percent) {
        const halfTile = TILE_SIZE / 2;
        const cx = gridX * TILE_SIZE + halfTile;
        const cy = gridY * TILE_SIZE + halfTile;

        // Dynamic Color
        if (percent > 0.6) this.ctx.fillStyle = '#2ecc71'; // Green
        else if (percent > 0.3) this.ctx.fillStyle = '#f1c40f'; // Yellow
        else this.ctx.fillStyle = '#e74c3c'; // Red

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(gridX * TILE_SIZE, gridY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.ctx.clip();

        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);

        // Deplete Clockwise:
        // Full Circle = 100%. "Missing" part grows clockwise from top.
        // Drawn part is the "Remaining" part.
        // Start Angle shifts clockwise. End Angle is constant at Top (1.5 PI).
        const endAngle = 1.5 * Math.PI;
        const startAngle = -0.5 * Math.PI + (1 - percent) * (2 * Math.PI);

        // Use a large radius to cover the corners of the square
        this.ctx.arc(cx, cy, TILE_SIZE, startAngle, endAngle);
        this.ctx.lineTo(cx, cy);
        this.ctx.fill();

        this.ctx.restore();
    }

    drawProgressBar(x, y, percent) {
        const px = x * TILE_SIZE + 4;
        const py = y * TILE_SIZE - 6; // slightly above tile
        const w = TILE_SIZE - 8;
        const h = 4;

        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(px, py, w, h);

        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillRect(px + 1, py + 1, (w - 2) * percent, h - 2);
    }

    drawTile(textureName, x, y) {
        if (!textureName) return;
        const img = this.assetLoader.get(textureName);
        if (img) {
            this.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    drawObject(textureName, x, y) {
        if (!textureName) return;
        const img = this.assetLoader.get(textureName);
        if (img) {
            // Objects also align to grid
            this.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    drawEntity(textureName, x, y) {
        if (!textureName) return;
        const img = this.assetLoader.get(textureName);
        if (img) {
            // Interpolation could go here later, for now snap to grid
            this.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    drawRotatedEntity(textureName, x, y, rotation) {
        if (!textureName) return;
        const img = this.assetLoader.get(textureName);
        if (img) {
            const centerX = x * TILE_SIZE + TILE_SIZE / 2;
            const centerY = y * TILE_SIZE + TILE_SIZE / 2;

            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(rotation);
            this.ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
            this.ctx.restore();
        }
    }

    renderTitleScreen(selection = 0) {
        // Ensure fullscreen
        if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
            this.resizeCanvas();
        }

        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '40px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Burger Joint', this.canvas.width / 2, this.canvas.height / 3 - 20);

        this.ctx.font = '24px Arial';

        const centerX = this.canvas.width / 2;
        const startY = this.canvas.height / 2;
        const spacing = 40;

        const options = ['New Game', 'Settings'];

        options.forEach((opt, index) => {
            const y = startY + (index * spacing);
            if (selection === index) {
                this.ctx.fillStyle = '#ffd700';
                this.ctx.fillText(`> ${opt} <`, centerX, y);
            } else {
                this.ctx.fillStyle = '#888';
                this.ctx.fillText(opt, centerX, y);
            }
        });

        // Controls hint
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#444';
        this.ctx.fillText('WASD / Arrows to Navigate', centerX, this.canvas.height - 60);
        this.ctx.fillText('ENTER / SPACE to Select', centerX, this.canvas.height - 40);
    }

    renderSettingsMenu(state, settings) {
        // Ensure fullscreen
        if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
            this.resizeCanvas();
        }

        // state: { selectedIndex, rebindingAction }
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';

        this.ctx.font = '32px Arial';
        this.ctx.fillText('Controls', this.canvas.width / 2, 50);

        // 1. Audio Settings
        this.ctx.textAlign = 'left';
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#aaa';
        this.ctx.fillText("Audio", 100, 100);

        const audioOptions = [
            { label: 'Music', key: 'musicEnabled' },
            { label: 'SFX', key: 'sfxEnabled' }
        ];

        let currentY = 140;
        const rowHeight = 40;

        audioOptions.forEach((opt, index) => {
            // Index match?
            // Global index 0 = Music, 1 = SFX
            const isSelected = (state.selectedIndex === index);
            const val = settings.preferences[opt.key];

            if (isSelected) {
                this.ctx.fillStyle = '#333';
                this.ctx.fillRect(100, currentY - 25, this.canvas.width - 200, rowHeight);
                this.ctx.fillStyle = '#ffd700';
            } else {
                this.ctx.fillStyle = '#aaa';
            }

            this.ctx.font = '20px Monospace';
            this.ctx.fillText(opt.label, 120, currentY);

            this.ctx.textAlign = 'right';
            const statusText = val ? "ON" : "OFF";
            this.ctx.fillStyle = val ? '#0f0' : '#f00';
            this.ctx.fillText(statusText, this.canvas.width - 120, currentY);

            this.ctx.textAlign = 'left';
            currentY += rowHeight;
        });

        // 2. Controls
        currentY += 20; // Spacer
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#aaa';
        this.ctx.fillText("Key Bindings", 100, currentY);
        currentY += 40;

        const bindings = settings.bindings;
        const displayOrder = [
            'MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT',
            'INTERACT', 'PICK_UP',
            'EQUIP_1', 'EQUIP_2', 'EQUIP_3', 'EQUIP_4'
        ];

        this.ctx.font = '20px Monospace';

        displayOrder.forEach((action, i) => {
            // Index offset by 2
            const globalIndex = i + 2;
            const isSelected = (state.selectedIndex === globalIndex);
            const isRebinding = (action === state.rebindingAction);

            const y = currentY;

            if (isSelected) {
                this.ctx.fillStyle = '#333';
                this.ctx.fillRect(100, y - 25, this.canvas.width - 200, rowHeight);
                this.ctx.fillStyle = '#ffd700';
            } else {
                this.ctx.fillStyle = '#aaa';
            }

            // Action Name
            const niceName = action.replace(/_/g, ' ');
            this.ctx.fillText(niceName, 120, y);

            // Key Binding
            this.ctx.textAlign = 'right';
            let keyParams = bindings[action];
            if (isRebinding) {
                this.ctx.fillStyle = '#0f0';
                this.ctx.fillText('PRESS KEY...', this.canvas.width - 120, y);
            } else {
                // Formatting key code
                let displayKey = keyParams ? keyParams.replace('Key', '').replace('Digit', '') : '???';
                this.ctx.fillText(displayKey, this.canvas.width - 120, y);
            }
            this.ctx.textAlign = 'left';

            currentY += rowHeight;
        });

        // Instructions
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#666';
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Use Arrows/WASD to Navigate. ENTER to Rebind. ESC to Back.', this.canvas.width / 2, this.canvas.height - 30);
    }

    drawOrderTickets(orders, pickUpKey, penalty) {
        const ticketImg = this.assetLoader.get(ASSETS.UI.ORDER_TICKET);
        if (!ticketImg) return;

        this.ctx.save();
        // 1. Darken Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Setup Layout
        // Max tickets per row: 6. 
        // If more than 6, wrap.
        const scale = 2.0; // Smaller scale
        const ticketW = ticketImg.width * scale;
        const ticketH = ticketImg.height * scale;
        const spacingX = 20;
        const spacingY = 20;

        const maxPerRow = 6;
        const totalW = Math.min(orders.length, maxPerRow) * (ticketW + spacingX) - spacingX;

        let startX = (this.canvas.width - totalW) / 2;
        let startY = 100;

        // 3. Draw Each Ticket
        orders.forEach((order, index) => {
            const col = index % maxPerRow;
            const row = Math.floor(index / maxPerRow);

            const x = startX + col * (ticketW + spacingX);
            const y = startY + row * (ticketH + spacingY);

            // Deterministic "Random" Jitter
            // Use index to create consistent but organic offsets
            const angle = (Math.sin(index * 997) * 0.1); // +/- 0.1 radians (~5 degrees)
            const offsetY = Math.cos(index * 457) * 10; // +/- 10px vertical bounce

            this.drawSingleTicket(ticketImg, x, y + offsetY, ticketW, ticketH, angle, order);
        });

        const displayKey = pickUpKey ? pickUpKey.replace('Key', '').replace('Digit', '') : '???';

        if (orders.length === 0) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`Press [${displayKey}] to finish day!`, this.canvas.width / 2, this.canvas.height / 2);
        } else {
            this.ctx.fillStyle = '#ffaaaa';
            this.ctx.font = 'bold 18px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.shadowColor = 'black';
            this.ctx.shadowBlur = 4;
            this.ctx.fillText(`Press [${displayKey}] to end day. Unfinished order penalty: $${penalty}`, this.canvas.width / 2, this.canvas.height - 40);
        }

        this.ctx.restore();
    }

    drawSingleTicket(img, x, y, w, h, angle, order) {
        this.ctx.save();

        // Pivot around center of ticket for rotation
        const cx = x + w / 2;
        const cy = y + h / 2;

        this.ctx.translate(cx, cy);
        this.ctx.rotate(angle);
        this.ctx.translate(-cx, -cy);

        // Draw Ticket
        this.ctx.drawImage(img, x, y, w, h);

        // Draw Text
        this.ctx.fillStyle = '#000';
        this.ctx.font = '14px Monospace'; // Smaller font
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';

        const padding = 15;
        this.ctx.fillText(`#${order.id}`, cx, y + padding);

        this.ctx.font = '12px Monospace';
        this.ctx.textAlign = 'left';

        // Left margin relative to the ticket's top-left
        const leftMargin = x + 25;
        let textY = y + padding + 25;

        if (order.items) {
            order.items.forEach(item => {
                this.ctx.fillText(item, leftMargin, textY);
                textY += 14;
            });
        }

        this.ctx.restore();
    }

    drawHUD(gameState) {
        // Placement Mode HUD
        if (gameState.placementState && gameState.placementState.active) {
            this.drawPlacementHUD(gameState.placementState);
            return;
        }

        this.ctx.save();

        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = 'black';

        // Money
        const moneyText = `$${gameState.money || 0}`;
        this.ctx.strokeText(moneyText, 10, 10);

        if (gameState.money < 0) {
            this.ctx.fillStyle = '#ff0000';
        } else {
            this.ctx.fillStyle = '#ffd700';
        }
        this.ctx.fillText(moneyText, 10, 10);

        this.ctx.fillText(moneyText, 10, 10);

        this.ctx.restore();
    }

    drawPlacementHUD(state) {
        this.ctx.save();
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = 'black';
        this.ctx.shadowBlur = 4;

        const itemName = state.item.id.replace(/_/g, ' ').toUpperCase();
        const cost = state.item.price;

        this.ctx.fillText(`BUILD MODE - ${itemName} - $${cost}`, this.canvas.width / 2, 30);
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Arrows to Move  |  ENTER to Place  |  ESC to Exit', this.canvas.width / 2, 60);

        this.ctx.restore();
    }

    renderPlacementCursor(state) {
        if (!state.active) return;

        // This method renders the cursor which belongs to the GRID coordinates.
        // We must apply the same offset!

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);

        const img = this.assetLoader.get(ASSETS.UI.SELECTOR);
        if (img) {
            // Pulse effect?
            const pulse = 1.0 + Math.sin(Date.now() / 200) * 0.1;
            const size = TILE_SIZE * pulse;
            const offset = (size - TILE_SIZE) / 2;

            this.ctx.drawImage(img,
                state.x * TILE_SIZE - offset,
                state.y * TILE_SIZE - offset,
                size, size
            );
        }

        // Draw ghost of the item being placed?
        if (state.item && state.item.tileType) {
            const tileTx = ASSETS.TILES[state.item.tileType];
            if (tileTx) {
                const tImg = this.assetLoader.get(tileTx);
                if (tImg) {
                    this.ctx.save();
                    this.ctx.globalAlpha = 0.5;
                    this.ctx.drawImage(tImg, state.x * TILE_SIZE, state.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    this.ctx.restore();
                }
            }
        }

        this.ctx.restore();
    }

    renderOrderScreen(data) {
        // Ensure fullscreen
        if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
            this.resizeCanvas();
        }

        // data: { money, cart, shopItems, selectedIndex }
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';

        // Title
        this.ctx.font = '32px Arial';
        this.ctx.fillText('Order Supplies', this.canvas.width / 2, 50);

        // Stars
        if (data.stars !== undefined) {
            this.ctx.save();
            this.ctx.font = 'bold 30px Arial';
            this.ctx.fillStyle = '#ffd700'; // Gold
            this.ctx.textAlign = 'right';
            // Draw actual star symbols maybe? 
            let starString = "★".repeat(data.stars) + "☆".repeat(3 - data.stars);
            this.ctx.fillText(starString, this.canvas.width - 50, 50);
            this.ctx.restore();
        }

        // Grid/List
        const items = data.shopItems;
        const startY = 100;
        const rowHeight = 35;

        this.ctx.font = '20px Monospace';
        this.ctx.textAlign = 'left';

        // Headers
        const cols = [50, 350, 500, 650]; // X positions
        this.ctx.fillStyle = '#888';
        this.ctx.fillText('Item', cols[0], startY);
        this.ctx.fillText('Price', cols[1], startY);
        this.ctx.fillText('Qty', cols[2], startY);
        this.ctx.fillText('Total', cols[3], startY);

        let totalOrderCost = 0;
        let essentialCost = 0;

        items.forEach((item, index) => {
            const y = startY + 40 + (index * rowHeight);

            // Visual Styles based on Locked/Unlocked
            const isUnlocked = item.unlocked;
            const isSelected = (index === data.selectedIndex);

            let textColor = isUnlocked ? '#fff' : '#555';
            if (isSelected) textColor = isUnlocked ? '#000' : '#444';

            // Background for selected row
            if (isSelected) {
                this.ctx.fillStyle = isUnlocked ? '#ff0' : '#333';
                this.ctx.fillRect(30, y - 5, this.canvas.width - 60, rowHeight);
            }

            this.ctx.fillStyle = textColor;

            // Calculations
            let cost = 0;
            let qtyDisplay = '';

            if (item.type === 'supply') {
                const qty = data.cart[item.id] || 0;
                cost = item.price * qty;
                totalOrderCost += cost;
                if (item.isEssential) essentialCost += cost;

                if (isUnlocked) {
                    qtyDisplay = isSelected ? `< ${qty} >` : `${qty}`;

                    // Day 0 Guidance
                    if (data.dayNumber === 0 && item.isEssential && qty === 0) {
                        this.ctx.save();
                        this.ctx.fillStyle = '#ff4444';
                        this.ctx.font = 'bold 16px Arial';
                        this.ctx.textAlign = 'left';
                        this.ctx.fillText("Buy this to continue!", cols[3] + 80, y + 20);
                        this.ctx.restore();
                    }
                } else {
                    qtyDisplay = 'LOCKED';
                }
            } else if (item.type === 'appliance' || item.type === 'action') {
                // For now, assume single purchase
                cost = item.price; // Cost to buy

                if (item.id === 'continue') {
                    cost = 0; // It's free

                    // Check if visible
                    let canStart = true;
                    if (data.dayNumber === 0) {
                        const missingEssentials = items.filter(i => i.isEssential).some(i => (data.cart[i.id] || 0) === 0);
                        if (missingEssentials) canStart = false;
                    }

                    if (!canStart) {
                        qtyDisplay = "LOCKED - Buy Essentials";
                        this.ctx.fillStyle = '#666'; // Dim it
                    } else {
                        qtyDisplay = isSelected ? '>>> START DAY <<<' : '    START DAY    ';
                    }
                } else if (isUnlocked) {
                    qtyDisplay = isSelected ? '[ BUY ]' : ' BUY ';
                } else {
                    qtyDisplay = 'LOCKED';
                    cost = 0; // Don't add to running total if just viewing
                }
            }

            // Draw Text
            const name = item.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            this.ctx.fillText(name, cols[0], y + 20);
            this.ctx.fillText(`$${item.price}`, cols[1], y + 20);

            this.ctx.fillText(qtyDisplay, cols[2], y + 20);

            if (item.type === 'supply') {
                this.ctx.fillText(`$${cost}`, cols[3], y + 20);
            }

            // Draw Unlocked Indicator
            if (item.justUnlocked) {
                this.ctx.save();
                this.ctx.fillStyle = '#0f0'; // Green
                this.ctx.font = 'bold 20px Arial';
                this.ctx.textAlign = 'left';
                this.ctx.fillText('Unlocked!', cols[3] + 100, y + 20);
                this.ctx.restore();
            }
        });

        // Footer / Summary
        const footerY = this.canvas.height - 80;
        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`Current Money: $${data.money}`, this.canvas.width - 50, footerY);

        const nonEssentialCost = totalOrderCost - essentialCost;
        const fundsAvailable = Math.max(0, data.money);
        const canAfford = fundsAvailable >= nonEssentialCost;

        this.ctx.fillStyle = canAfford ? '#0f0' : '#f00';
        this.ctx.fillText(`Order Total: $${totalOrderCost}`, this.canvas.width - 50, footerY + 30);

        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Arrows to Select/Change Qty. ENTER to Order/Buy.', this.canvas.width / 2, this.canvas.height - 20);
    }
    drawFloatingTexts(texts) {
        this.ctx.save();
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = 'black';
        this.ctx.shadowBlur = 2;

        // Apply World Transform
        this.ctx.translate(this.offsetX, this.offsetY);

        texts.forEach(ft => {
            const px = ft.x * TILE_SIZE + TILE_SIZE / 2;
            const py = ft.y * TILE_SIZE;

            this.ctx.fillStyle = ft.color;
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(ft.text, px, py);
            this.ctx.fillText(ft.text, px, py);
        });

        this.ctx.restore();
    }

    drawTinyNumber(gridX, gridY, number) {
        const x = gridX * TILE_SIZE + TILE_SIZE - 4;
        const y = gridY * TILE_SIZE + TILE_SIZE - 4;

        this.ctx.save();
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'bottom';
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'black';
        this.ctx.fillStyle = 'white';

        this.ctx.strokeText(number, x, y);
        this.ctx.fillText(number, x, y);
        this.ctx.restore();
    }
}

import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, ASSETS, TAG_LAYOUTS, TILE_TYPES } from '../constants.js';
import { DEFINITIONS } from '../data/definitions.js';
import { SPRITE_DEFINITIONS } from '../data/sprite_definitions.js';
import { TutorialOverlay } from '../renderers/TutorialOverlay.js';

export class Renderer {
    constructor(canvasId, assetLoader) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = canvasId;
        this.ctx = this.canvas.getContext('2d');
        this.assetLoader = assetLoader;
        this.tutorialOverlay = new TutorialOverlay();

        // Offscreen canvas for world rendering (eliminates tile seams when scaled)
        this.worldCanvas = document.createElement('canvas');
        this.worldCtx = this.worldCanvas.getContext('2d');
        this.worldCanvasWidth = 0;
        this.worldCanvasHeight = 0;

        // Initialize canvas to full window size
        this.resizeCanvas();


        // Listen for window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });

        // Store offsets for other methods (like cursor) to use
        this.offsetX = 0;
        this.offsetY = 0;
        this.zoomLevel = 1.0;

        document.getElementById('app').appendChild(this.canvas);
    }

    /**
     * Ensures the offscreen world canvas matches the current grid dimensions.
     * Called each frame to handle dynamic grid resizing.
     */
    ensureWorldCanvas(gridWidth, gridHeight) {
        const requiredWidth = gridWidth * TILE_SIZE;
        const requiredHeight = gridHeight * TILE_SIZE;

        if (this.worldCanvasWidth !== requiredWidth || this.worldCanvasHeight !== requiredHeight) {
            this.worldCanvas.width = requiredWidth;
            this.worldCanvas.height = requiredHeight;
            this.worldCanvasWidth = requiredWidth;
            this.worldCanvasHeight = requiredHeight;
            // Reset image smoothing after resize
            this.worldCtx.imageSmoothingEnabled = false;
        }
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

        // Auto Zoom-to-Fit
        // We calculate the scale required to fit the entire grid into the window (minus some margin)
        // AND we cap it at 1.0 so we never upscale past native pixel art resolution (64x64 tiles).
        if (gameState.grid) {
            const margin = 40; // Breathing room in pixels
            const availableWidth = this.canvas.width - margin;
            const availableHeight = this.canvas.height - margin;

            const totalGridWidth = gameState.grid.width * TILE_SIZE;
            const totalGridHeight = gameState.grid.height * TILE_SIZE;

            const scaleX = availableWidth / totalGridWidth;
            const scaleY = availableHeight / totalGridHeight;

            this.zoomLevel = Math.min(scaleX, scaleY, 1.0);

            // Ensure offscreen canvas is sized correctly
            this.ensureWorldCanvas(gameState.grid.width, gameState.grid.height);
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate centering offsets (for final blit position)
        this.offsetX = 0;
        this.offsetY = 0;

        if (gameState.grid) {
            const gridPixelWidth = gameState.grid.width * TILE_SIZE * this.zoomLevel;
            const gridPixelHeight = gameState.grid.height * TILE_SIZE * this.zoomLevel;

            this.offsetX = Math.floor((this.canvas.width - gridPixelWidth) / 2);
            this.offsetY = Math.floor((this.canvas.height - gridPixelHeight) / 2);
        }

        // --- WORLD RENDERING (to offscreen canvas at native resolution) ---
        // Clear the offscreen canvas
        this.worldCtx.clearRect(0, 0, this.worldCanvas.width, this.worldCanvas.height);

        // Temporarily swap ctx to worldCtx for all world drawing
        const originalCtx = this.ctx;
        this.ctx = this.worldCtx;

        // Helper to check for counter connections
        const isCounter = (id) => id === 'COUNTER';
        const isGrill = (id) => id === 'GRILL';

        // 1. Draw Floor/Walls (Base Layer)
        const progressBars = [];

        // Pass 1: Draw ALL Floors first to avoid occlusion issues with 2.5D sorting
        for (let y = 0; y < gameState.grid.height; y++) {
            for (let x = 0; x < gameState.grid.width; x++) {
                this.drawTile(ASSETS.TILES.FLOOR, x, y);
            }
        }
        // 1.5 Draw Game Border (Moved here to be behind objects)
        if (gameState.grid) {
            const gridPixelWidth = gameState.grid.width * TILE_SIZE;
            const gridPixelHeight = gameState.grid.height * TILE_SIZE;

            // Helper to draw a side piece masked to a specific length
            const drawSide = (textureName, x, y, length, isVertical) => {
                const img = this.assetLoader.get(textureName);
                if (!img) return;

                if (isVertical) {
                    // Vertical Side (Left/Right)
                    // Clip height to 'length'
                    // Draw at (x, y) with full width, clipped height
                    this.ctx.drawImage(img,
                        0, 0, img.width, length, // Source
                        x, y, img.width, length  // Destination
                    );
                } else {
                    // Horizontal Side (Top/Bottom)
                    // Clip width to 'length'
                    this.ctx.drawImage(img,
                        0, 0, length, img.height, // Source
                        x, y, length, img.height  // Destination
                    );
                }
            };

            // Helper to draw a corner
            const drawCorner = (textureName, x, y) => {
                const img = this.assetLoader.get(textureName);
                if (img) this.ctx.drawImage(img, x, y);
            };

            // Fetch dimensions for positioning (using one of the images to determine thickness)
            // We assume the corners and sides line up. 
            // Top/Bottom thickness = height of top/bottom images
            // Left/Right thickness = width of left/right images
            const topImg = this.assetLoader.get(ASSETS.UI.GAME_BORDER_TOP);
            const leftImg = this.assetLoader.get(ASSETS.UI.GAME_BORDER_LEFT);
            // Even if they aren't loaded yet, the loop will just skip or draw nothing, 
            // but we need them for offset calc.

            if (topImg && leftImg) {
                const topHeight = topImg.height;
                const leftWidth = leftImg.width;

                // We also need right/bottom dimensions for full box, but usually symmetry applies.
                // Let's get them to be safe or assume symmetry if needed.
                const rightImg = this.assetLoader.get(ASSETS.UI.GAME_BORDER_RIGHT);
                const bottomImg = this.assetLoader.get(ASSETS.UI.GAME_BORDER_BOTTOM);
                // const rightWidth = rightImg ? rightImg.width : leftWidth;
                // const bottomHeight = bottomImg ? bottomImg.height : topHeight;

                // Bring the border in by one tile, then push it out 8px
                const inset = TILE_SIZE - 7;

                // Calculate the "inner" rectangle that the border edges should adhere to
                const innerX = inset;
                const innerY = inset;
                const innerWidth = gridPixelWidth - (inset * 2);
                const innerHeight = gridPixelHeight - (inset * 2);

                // 1. Draw Sides
                // Top (centered on X grid, above Y of inner rect)
                drawSide(ASSETS.UI.GAME_BORDER_TOP, innerX, innerY - topHeight, innerWidth, false);

                // Bottom (centered on X grid, below Y of inner rect)
                drawSide(ASSETS.UI.GAME_BORDER_BOTTOM, innerX, innerY + innerHeight, innerWidth, false);

                // Left (centered on Y grid, left of X of inner rect)
                drawSide(ASSETS.UI.GAME_BORDER_LEFT, innerX - leftWidth, innerY, innerHeight, true);

                // Right (centered on Y grid, right of X of inner rect)
                drawSide(ASSETS.UI.GAME_BORDER_RIGHT, innerX + innerWidth, innerY, innerHeight, true);

                // 2. Draw Corners
                // Top-Left
                drawCorner(ASSETS.UI.GAME_BORDER_TOP_LEFT, innerX - leftWidth, innerY - topHeight);

                // Top-Right
                drawCorner(ASSETS.UI.GAME_BORDER_TOP_RIGHT, innerX + innerWidth, innerY - topHeight);

                // Bottom-Left
                drawCorner(ASSETS.UI.GAME_BORDER_BOTTOM_LEFT, innerX - leftWidth, innerY + innerHeight);

                // Bottom-Right
                drawCorner(ASSETS.UI.GAME_BORDER_BOTTOM_RIGHT, innerX + innerWidth, innerY + innerHeight);
            }
        }
        for (let y = 0; y < gameState.grid.height; y++) {
            for (let x = 0; x < gameState.grid.width; x++) {
                const cell = gameState.grid.getCell(x, y);

                // Layer 0: Floor drawn in Pass 1

                // Auto-tiling Logic for COUNTER and SERVICE base
                if (cell.type.id === 'COUNTER') {
                    // Calculate Bitmask
                    // N=1, E=2, S=4, W=8
                    let mask = 0;

                    // North
                    if (y > 0 && isCounter(gameState.grid.getCell(x, y - 1).type.id)) mask |= 1;
                    // East
                    if (x < gameState.grid.width - 1 && isCounter(gameState.grid.getCell(x + 1, y).type.id)) mask |= 2;
                    // South
                    if (y < gameState.grid.height - 1 && isCounter(gameState.grid.getCell(x, y + 1).type.id)) mask |= 4;
                    // West
                    if (x > 0 && isCounter(gameState.grid.getCell(x - 1, y).type.id)) mask |= 8;

                    this.drawAutoTile(ASSETS.TILES.COUNTER_SHEET, x, y, mask, ASSETS.TILES.COUNTER);
                }

                if (cell.type.id === 'GRILL') {
                    // Auto-tiling Logic for GRILL (East-West only)
                    // Mask: West=1, East=2
                    // 0: Solo, 1: West Conn, 2: East Conn, 3: Pipe (Both)
                    let mask = 0;

                    // West
                    if (x > 0 && isGrill(gameState.grid.getCell(x - 1, y).type.id)) mask |= 1;
                    // East
                    if (x < gameState.grid.width - 1 && isGrill(gameState.grid.getCell(x + 1, y).type.id)) mask |= 2;

                    this.drawAutoTile(ASSETS.TILES.GRILL_SHEET, x, y, mask, ASSETS.TILES.STOVE_OFF);
                }

                let tileTexture = cell.type.texture;

                // Prevent double-drawing COUNTER (handled by auto-tile above)
                if (cell.type.id === 'COUNTER' || cell.type.id === 'GRILL') {
                    tileTexture = null;
                }

                // If the tile is just a floor, we don't need to draw it again on top
                if (cell.type.id === 'FLOOR') {
                    tileTexture = null;
                }

                if (cell.type.id === 'TICKET_WHEEL') {
                    // Prep Time Overlay
                    if (gameState.isPrepTime) {
                        this.drawTile(ASSETS.TILES.TICKET_WHEEL, x, y); // Draw base wheel
                        tileTexture = ASSETS.TILES.PREP; // Draw Prep overlay on top
                    } else if (gameState.ticketWheelAnimStartTime) {
                        const elapsed = Date.now() - gameState.ticketWheelAnimStartTime;
                        // 10ms Frame 1, 10ms Frame 2. Total 20ms.
                        // Using slightly larger windows for visibility 50ms/50ms = 100ms total
                        // Prompt said "10 ms". I will use 50ms as a usable interpretation that isn't instantaneous but still fast.
                        // Actually, I will respect the prompt's speed req strictly if I can, but 10ms is 1 frame or less.
                        // Let's use 50ms threshold.
                        const duration = 50;
                        if (elapsed < duration) tileTexture = ASSETS.TILES.TICKET_WHEEL_FRAME1;
                        else if (elapsed < duration * 2) tileTexture = ASSETS.TILES.TICKET_WHEEL_FRAME2;
                        else {
                            if (gameState.activeTickets && gameState.activeTickets.length > 0) {
                                tileTexture = ASSETS.TILES.TICKET_WHEEL_ORDER;
                            }
                        }
                    } else {
                        if (gameState.activeTickets && gameState.activeTickets.length > 0) {
                            tileTexture = ASSETS.TILES.TICKET_WHEEL_ORDER;
                        }
                    }
                }
                if (cell.type.id === 'GARBAGE') {
                    this.drawTile(ASSETS.TILES.GARBAGE, x, y);

                    if (cell.state && cell.state.trashedItem) {
                        const item = cell.state.trashedItem;
                        this.ctx.save();
                        const cx = x * TILE_SIZE + TILE_SIZE / 2;
                        const cy = y * TILE_SIZE + TILE_SIZE / 2 - 24; // Nudge up 50% (relative to center/height)
                        this.ctx.translate(cx, cy);
                        this.ctx.rotate(cell.state.trashedItemRotation || 0);
                        this.ctx.scale(0.75, 0.75);
                        this.drawObject(item, -0.5, -0.5);
                        this.ctx.restore();
                    }

                    this.drawTile(ASSETS.TILES.GARBAGE_FRONT, x, y);
                    tileTexture = null;
                }



                if (cell.type.id === 'CUTTING_BOARD') {
                    // 1. Manually Draw the Base Board
                    this.drawTile(ASSETS.TILES.CUTTING_BOARD, x, y);

                    // 2. Draw the Held Item on top
                    if (cell.state && cell.state.heldItem) {
                        const item = cell.state.heldItem;
                        let scale = 0.5;
                        if (item.definition && (item.definition.isSlice || item.definition.isTopping)) {
                            // Slices remain full size (assuming they are small enough or intended to match burger size)
                            scale = 1.0;
                        }
                        this.drawEntity(item, x, y, scale);
                        if (item.state && item.state.count > 1) {
                            this.drawTinyNumber(x, y, item.state.count);
                        }
                    } else if (cell.state) {
                        // Migration/Legacy Fallback
                        if (cell.state.status === 'has_tomato') {
                            const t = this.assetLoader.get(ASSETS.TILES.CUTTING_BOARD_TOMATO);
                            if (t) this.ctx.drawImage(t, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        } else if (cell.state.status === 'has_slice') {
                            const t = this.assetLoader.get(ASSETS.TILES.CUTTING_BOARD_SLICE);
                            if (t) this.ctx.drawImage(t, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        }
                    }

                    // 3. Cancel the standard drawTile loop at the end so we don't draw over our work
                    tileTexture = null;
                }

                if (cell.type.id === 'DISPENSER') {
                    // Default to Empty
                    tileTexture = ASSETS.TILES.DISPENSER_EMPTY;

                    const status = cell.state ? cell.state.status : null;

                    if (status === 'loaded' || status === 'has_mayo') {
                        // 1. Draw Sauce Item Underneath
                        let bagTexture = ASSETS.OBJECTS.MAYO_BAG; // Default fallback

                        if (cell.state.bagId && DEFINITIONS[cell.state.bagId]) {
                            bagTexture = DEFINITIONS[cell.state.bagId].texture;
                        }

                        const bagImg = this.assetLoader.get(bagTexture);
                        if (bagImg) {
                            this.ctx.drawImage(bagImg, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        }

                        // 2. Select Overlay based on charges
                        const charges = cell.state.charges;
                        if (charges > 10) tileTexture = ASSETS.TILES.DISPENSER_FULL;
                        else if (charges > 5) tileTexture = ASSETS.TILES.DISPENSER_PARTIAL1;
                        else tileTexture = ASSETS.TILES.DISPENSER_PARTIAL2;
                    }
                }

                if (cell.type.id === 'FRYER' && cell.state) {
                    // Check for Item Cooking (Patty or Fries)
                    let isItemCooking = false;
                    let isFries = false;

                    if (cell.object) {
                        if (cell.object.definitionId === 'fries') isFries = true;

                        if (cell.object.definition && cell.object.definition.cooking) {
                            const stage = cell.object.state.cook_level || 'raw';
                            const stageDef = cell.object.definition.cooking.stages[stage];
                            if (stageDef && stageDef.cookMethod === 'fry') {
                                isItemCooking = true;
                            }
                        }

                        // Override logic based on object
                        if (isFries) {
                            if (cell.object.state.cook_level === 'cooked') {
                                // Draw base fryer under the result
                                if (cell.state.facing !== undefined) {
                                    this.drawRotatedTile(ASSETS.TILES.FRYER, x, y, cell.state.facing * (Math.PI / 2));
                                } else {
                                    this.drawTile(ASSETS.TILES.FRYER, x, y);
                                }
                                tileTexture = ASSETS.TILES.FRYER;
                            } else {
                                // Assume cooking or raw
                                tileTexture = ASSETS.TILES.FRYER_DOWN;
                            }
                        } else if (isItemCooking) {
                            // Generic item (Patty) - Basket Down (Empty visual, item drawn by drawProgressBar?? No item is hidden?)
                            // Wait, if item is cooking, usually we hide it or show basket down.
                            // Current logic showed BASKET_DOWN.
                            tileTexture = ASSETS.TILES.FRYER_BASKET_DOWN;
                        } else {
                            // Item present but not cooking (e.g. Cooked Patty)
                            // Default to Basket Up (Standard Fryer)
                        }
                    } else {
                        // Fallback for Legacy State
                        if (cell.state.status === 'loaded') tileTexture = ASSETS.TILES.FRYER_FRIES;
                        else if (cell.state.status === 'down') tileTexture = ASSETS.TILES.FRYER_DOWN;
                        else if (cell.state.status === 'done') tileTexture = ASSETS.TILES.FRYER;
                    }
                }

                if (cell.type.id === 'SODA_FOUNTAIN' && cell.state) {
                    if (cell.state.status === 'empty') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_EMPTY;
                    else if (cell.state.status === 'full') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_FULL;
                    else if (cell.state.status === 'warning') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_WARNING;
                    else if (cell.state.status === 'filling') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_FILLING;
                    else if (cell.state.status === 'done') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_EMPTY;
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



                if (cell.state && cell.state.facing !== undefined) {
                    const rotation = cell.state.facing * (Math.PI / 2);
                    this.drawRotatedTile(tileTexture, x, y, rotation);
                } else {
                    this.drawTile(tileTexture, x, y);
                }

                if (cell.type.id === 'SERVICE') {
                    if (gameState.isPrepTime && gameState.maxPrepTime > 0) {
                        const pct = isFinite(gameState.prepTime) ? Math.max(0, gameState.prepTime / gameState.maxPrepTime) : 1;
                        this.drawServiceTimer(x, y, pct);
                    } else if (gameState.activeTickets && gameState.activeTickets.length > 0) {
                        // Use Global Service Timer for visualization
                        let totalActivePar = 0;
                        gameState.activeTickets.forEach(t => totalActivePar += t.parTime);

                        if (totalActivePar > 0 && typeof gameState.serviceTimer === 'number') {
                            // Percent of the "current workload" that we have time for
                            // If we have extra time banked from previous orders, this might stay full longer, which is good.
                            const pct = Math.min(1, Math.max(0, gameState.serviceTimer / totalActivePar));
                            this.drawServiceTimer(x, y, pct);
                        }
                    }
                }

                // 1.5 Draw Soda Fountain Sign (Overlay)
                if (cell.type.id === 'SODA_FOUNTAIN' && cell.state && (cell.state.status === 'full' || cell.state.status === 'warning' || cell.state.status === 'filling' || cell.state.status === 'done')) {
                    const resultId = cell.state.resultId;
                    // Fallback to syrupId lookup if resultId missing (legacy support)
                    const drinkId = resultId || (cell.state.syrupId ? DEFINITIONS[cell.state.syrupId]?.result : null);

                    if (drinkId && DEFINITIONS[drinkId] && DEFINITIONS[drinkId].sign) {
                        const signTexture = DEFINITIONS[drinkId].sign;
                        if (cell.state.facing !== undefined) {
                            const rotation = cell.state.facing * (Math.PI / 2);
                            this.drawRotatedTile(signTexture, x, y, rotation);
                        } else {
                            this.drawTile(signTexture, x, y);
                        }
                    }
                }

                // 1.55 Draw Finished Soda (Overlay)
                if (cell.type.id === 'SODA_FOUNTAIN' && cell.state && cell.state.status === 'done') {
                    this.drawEntity(ASSETS.OBJECTS.SODA, x, y);
                }

                // 1.6 Draw Reno Lock Overlay
                if (cell.type.id === 'RENO_LOCKED') {
                    this.drawTile(ASSETS.TILES.LOCKED, x, y);
                }

                // Draw Locked Overlay on Custom Menu
                if (cell.type.id === 'MENU' && !gameState.isEndgameUnlocked) {
                    this.drawTile(ASSETS.TILES.LOCKED, x, y);
                }

                if (cell.object) {
                    let isFrying = false;
                    // Check exclusion for Fryer
                    if (cell.type.id === 'FRYER') {
                        if (cell.object.definitionId === 'fries') {
                            isFrying = true;
                        } else if (cell.object.definition && cell.object.definition.cooking) {
                            const stage = cell.object.state.cook_level || 'raw';
                            const stageDef = cell.object.definition.cooking.stages[stage];
                            if (stageDef && stageDef.cookMethod === 'fry') {
                                isFrying = true;
                            }
                        }
                    }

                    if (!isFrying) {
                        let overrideTexture = null;
                        // Check for Stove Cooking Texture Override
                        if (cell.type.id === 'GRILL' && cell.object && cell.object.definition.cookingTexture) {
                            // Only use override if currently "raw" (cooking process uses this state)
                            // If cooked, it usually switches to 'patty-cooked.png' via internal rules
                            if (cell.object.state.cook_level === 'raw') {
                                overrideTexture = cell.object.definition.cookingTexture;
                            }
                        }
                        let yOffset = 0;
                        if (cell.type.id === 'COUNTER') {
                            yOffset = -29;
                        }

                        let alpha = 1.0;
                        if (cell.type.id === 'COUNTER') {
                            if (gameState.player) {
                                const playerX = Math.round(gameState.player.x);
                                const playerY = Math.round(gameState.player.y);
                                if (playerX === x && playerY === y - 1) {
                                    alpha = 0.5;
                                }
                            }

                            // If there is a service counter above this counter, fade items so we can see the service counter
                            if (y > 0) {
                                const tileAbove = gameState.grid.getCell(x, y - 1);
                                if (tileAbove && tileAbove.type.id === 'SERVICE') {
                                    alpha = 0.5;
                                }
                            }
                        }

                        this.ctx.globalAlpha = alpha;
                        this.drawObject(cell.object, x, y, overrideTexture, yOffset);
                        this.ctx.globalAlpha = 1.0;
                    }

                    // Cooking Progress Bar (Stove)
                    if (cell.type.id === 'GRILL') {
                        const item = cell.object;
                        if (item.state && item.state.cookingProgress > 0 && item.state.cook_level === 'raw') {
                            let max = cell.state.cookingSpeed || 2000;
                            if (item.definition && item.definition.cooking && item.definition.cooking.stages) {
                                const stageDef = item.definition.cooking.stages[item.state.cook_level];
                                if (stageDef && stageDef.duration) {
                                    max = stageDef.duration;
                                }
                            }
                            const pct = Math.min(item.state.cookingProgress / max, 1);
                            progressBars.push({ x, y, pct });
                        }
                    }

                    // Cooking Progress Bar (Fryer Item)
                    if (isFrying) {
                        const item = cell.object;
                        const stage = item.state.cook_level || 'raw';
                        const stageDef = item.definition.cooking.stages[stage];
                        if (item.state.cookingProgress > 0) {
                            const max = stageDef.duration || 2000;
                            const pct = Math.min(item.state.cookingProgress / max, 1);
                            progressBars.push({ x, y, pct });
                        }
                    }
                }

                // 2.5 Draw Fryer Progress
                if (cell.type.id === 'FRYER') {
                    if (cell.state && cell.state.status === 'down') {
                        let max = cell.state.cookingSpeed || 2000;
                        if (cell.object && cell.object.definition && cell.object.definition.cooking) {
                            const stage = cell.object.state.cook_level || 'raw';
                            if (cell.object.definition.cooking.stages && cell.object.definition.cooking.stages[stage]) {
                                const stageDef = cell.object.definition.cooking.stages[stage];
                                if (stageDef.duration) max = stageDef.duration;
                            }
                        }
                        const pct = Math.min(cell.state.timer / max, 1);
                        progressBars.push({ x, y, pct });
                    }
                }

                // 2.6 Draw Soda Filling Progress
                if (cell.type.id === 'SODA_FOUNTAIN') {
                    if (cell.state && cell.state.status === 'filling') {
                        const max = cell.state.fillDuration || 3000;
                        const pct = Math.min((cell.state.timer || 0) / max, 1);
                        progressBars.push({ x, y, pct });
                    }
                }

                // 2.7 Draw Box Quantity (Always, regardless of state)
                if (cell.object && cell.object.type === 'Box' && cell.object.state) {
                    const count = cell.object.state.count;
                    if (count !== undefined) {
                        this.drawTinyNumber(x, y, count);
                    }
                }

                // 2.8 Draw Service Counter Active Ticket Hints
                if (cell.type.id === 'SERVICE') {
                    this.drawServiceHint(x, y, gameState, cell.object);
                }
            }

            // Draw Player if in this row (Z-sorting)
            if (gameState.player && Math.floor(gameState.player.y) === y) {
                this.drawPlayer(gameState);
            }
        }

        // Draw Expand Button (Build Mode)
        if (gameState.gameState === 'BUILD_MODE' && gameState.grid) {
            const topRightX = gameState.grid.width - 1;
            const topRightY = 0;
            this.drawTile(ASSETS.UI.RENO_EXPAND, topRightX, topRightY);
        }

        // 3. Draw Player: Handled in render loop (Z-sorted)



        // 3.5 Draw Lighting Effect
        if (gameState.grid && gameState.queueFinishedTime) {
            const elapsed = Date.now() - gameState.queueFinishedTime;
            const fadeDuration = 2000; // 2 seconds fade
            const fade = Math.min(elapsed / fadeDuration, 1.0);

            if (fade > 0) {
                const gridPixelWidth = gameState.grid.width * TILE_SIZE;
                const gridPixelHeight = gameState.grid.height * TILE_SIZE;
                this.drawLightingEffect(gridPixelWidth, gridPixelHeight, fade);
            }

            // Draw End Day Stars (Overlay) via RatingPopup
            if (gameState.ratingPopup) {
                gameState.ratingPopup.render(this.ctx, this.assetLoader);
            }
        }

        // Draw Defered Progress Bars (So they are on top of borders/lighting)
        progressBars.forEach(pb => {
            this.drawProgressBar(pb.x, pb.y, pb.pct);
        });

        this.drawEffects(gameState);

        // --- END WORLD RENDERING ---
        // Restore the original context (main canvas)
        this.ctx = originalCtx;

        // Blit the offscreen world canvas to the main canvas with scaling
        // This draws the entire world as a single scaled image, eliminating tile seams
        this.ctx.save();
        this.ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
        this.ctx.drawImage(
            this.worldCanvas,
            0, 0, this.worldCanvas.width, this.worldCanvas.height,  // Source (full offscreen canvas)
            this.offsetX, this.offsetY,                              // Destination position
            this.worldCanvas.width * this.zoomLevel,                 // Destination width (scaled)
            this.worldCanvas.height * this.zoomLevel                 // Destination height (scaled)
        );
        this.ctx.restore();

        // 4. Draw UI Overlays (Screen Space)
        if (gameState.isViewingOrders) {
            this.drawOrderTickets(gameState.orders || [], gameState.pickUpKey, gameState.penalty, gameState.possibleMenu, gameState.activeTicketIndex || 0);
        }

        // 5. Draw HUD (Screen Space)
        this.drawHUD(gameState);

        // 6. Draw Floating Texts (World Space projected)
        if (gameState.floatingTexts) {
            this.drawFloatingTexts(gameState.floatingTexts);
        }

        // 7. Computer Overlay (Screen Space)
        if (gameState.gameState === 'COMPUTER_ORDERING') {
            this.renderComputerScreen(gameState);
        }
        if (gameState.gameState === 'RENO_SHOP') {
            // console.log("Renderer: Calling renderRenoScreen");
            this.renderRenoScreen(gameState);
        }
        if (gameState.menuSystem) {
            gameState.menuSystem.render(this);
        }

        if (gameState.gameState === 'APPLIANCE_SWAP' && gameState.swappingState) {
            this.ctx.save();
            this.ctx.translate(this.offsetX, this.offsetY); // transform to grid
            this.ctx.scale(this.zoomLevel, this.zoomLevel);

            const { x, y } = gameState.swappingState;
            this.drawTile(ASSETS.UI.BUTTON_ARROWS, x, y);

            this.ctx.restore();
        }

        this.drawControlsHelp(gameState);

        // Render Tutorial Overlay
        if (this.tutorialOverlay) {
            this.tutorialOverlay.render(this, gameState);
        }

        // Render Build Mode UI (Global Space)
        if (gameState.gameState === 'BUILD_MODE' && gameState.placementState) {
            this.renderPlacementCursor(gameState.placementState);
            this.drawPlacementHUD(gameState.placementState, gameState);
            if (gameState.placementState.menu) {
                this.renderBuildMenu(gameState.placementState.menu);
            }
        }
    }

    drawPlayer(gameState) {
        if (gameState.player) {
            this.drawEntity(gameState.player.texture, gameState.player.x, gameState.player.y);

            // Draw Tool
            if (gameState.player.toolTexture) {
                const rotation = Math.atan2(gameState.player.facing.y, gameState.player.facing.x) + Math.PI / 2;
                this.drawRotatedEntity(gameState.player.toolTexture, gameState.player.x, gameState.player.y, rotation);
            }

            // Draw Held Item (ItemInstance)
            if (gameState.player.heldItem) {
                this.drawEntity(gameState.player.heldItem, gameState.player.x, gameState.player.y);
            }

            // Draw Held Appliance (New)
            if (gameState.player.heldAppliance) {
                const app = gameState.player.heldAppliance;
                // Draw Appliance Texture
                const texName = TILE_TYPES[app.tileType] ? TILE_TYPES[app.tileType].texture : null;
                // Use drawObject logic or manual draw
                if (texName) {
                    const img = this.assetLoader.get(texName);
                    if (img) {
                        // Draw slightly offset (lifted)
                        this.ctx.drawImage(img, gameState.player.x * TILE_SIZE, gameState.player.y * TILE_SIZE - 20, TILE_SIZE, TILE_SIZE);
                    }
                }

                // Draw Attached Object on top
                if (app.attachedObject) {
                    this.ctx.save();
                    this.ctx.translate(0, -20);
                    this.drawObject(app.attachedObject, gameState.player.x, gameState.player.y);
                    this.ctx.restore();
                }
            }
        }
    }

    findTileByType(gameState, typeId) {
        if (!gameState.grid) return null;
        for (let y = 0; y < gameState.grid.height; y++) {
            for (let x = 0; x < gameState.grid.width; x++) {
                if (gameState.grid.getCell(x, y).type.id === typeId) {
                    return { x, y };
                }
            }
        }
        return null;
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

    drawTile(textureName, x, y, yOffset = 0) {
        if (!textureName) return;
        const img = this.assetLoader.get(textureName);
        if (img) {
            this.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE + yOffset, TILE_SIZE, TILE_SIZE);
        }
    }

    drawObject(object, x, y, overrideTexture = null, yOffset = 0) {
        if (!object) return;

        // Dynamic Burger Rendering
        if (object.type === 'Composite' && object.definitionId !== 'burger_old' && (object.definitionId.includes('burger') || object.state.bun)) {
            this.drawBurger(object, x, y, yOffset);
            return;
        }

        if (object.type === 'Box') {
            this.drawBox(object, x, y, yOffset);
            return;
        }

        // Stackable Inserts
        if (object.definitionId === 'insert') {
            this.drawInsertStack(object, x, y, 1.0, yOffset);
            return;
        }

        const textureName = overrideTexture || object.texture;
        if (!textureName) return;
        const img = this.assetLoader.get(textureName);
        if (img) {
            // Objects also align to grid
            this.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE + yOffset, TILE_SIZE, TILE_SIZE);
        }
    }

    drawBox(object, x, y, yOffset = 0) {
        // 1. Data-Driven Override: 
        // If the item definition has explicit texture rules (e.g. custom jar stages),
        // we trust getTexture() to return the correct full asset and skip generic compositing.
        if (object.definition.textures) {
            const tex = object.getTexture();
            this.drawTile(tex, x, y, yOffset);
            return;
        }

        if (object.state.isOpen) {
            // Draw open box base
            this.drawTile(ASSETS.OBJECTS.OPEN_BOX, x, y, yOffset);

            // Draw contents
            const def = DEFINITIONS[object.definitionId];
            if (def && def.produces) {
                const productDef = DEFINITIONS[def.produces];
                if (productDef) {
                    let productTexture = productDef.texture;

                    // Aging Logic for Box Contents
                    if (productDef.aging && object.state.age) {
                        // 1. Is it fully spoiled?
                        if (object.state.age >= productDef.aging.spoilAge) {
                            const spoiledId = productDef.aging.spoiledItem;
                            if (spoiledId && DEFINITIONS[spoiledId]) {
                                productTexture = DEFINITIONS[spoiledId].texture;
                            }
                        } else if (productDef.aging.stages) {
                            // 2. Is it wilting?
                            const stages = productDef.aging.stages;
                            let maxStageDay = -1;
                            for (const [day, texture] of Object.entries(stages)) {
                                const dayNum = parseInt(day);
                                if (object.state.age >= dayNum && dayNum > maxStageDay) {
                                    maxStageDay = dayNum;
                                    productTexture = texture;
                                }
                            }
                        }
                    }

                    if (!productTexture && productDef.textures) {
                        productTexture = productDef.textures.base;
                    }

                    if (productTexture) {
                        const img = this.assetLoader.get(productTexture);
                        if (img) {
                            // Scale 75%, center.
                            const scale = 0.75;
                            const size = TILE_SIZE * scale;
                            const offset = (TILE_SIZE - size) / 2;
                            this.ctx.drawImage(img, x * TILE_SIZE + offset, y * TILE_SIZE + offset + yOffset, size, size);
                        }
                    }
                }
            }
        } else {
            // Closed Box - use existing texture logic (e.g. patty_box-closed.png)
            this.drawTile(object.texture, x, y, yOffset);
        }
    }

    drawAutoTile(sheetName, x, y, mask, fallbackTexture) {
        const img = this.assetLoader.get(sheetName);
        if (!img) {
            // Fallback to single tile if sheet not found
            if (fallbackTexture) this.drawTile(fallbackTexture, x, y);
            return;
        }

        // Calculate source coordinates
        // Grid is 4x4.
        // Col = mask % 4
        // Row = floor(mask / 4)
        const col = mask % 4;
        const row = Math.floor(mask / 4);

        const sx = col * TILE_SIZE;
        const sy = row * TILE_SIZE;

        this.ctx.drawImage(img,
            sx, sy, TILE_SIZE, TILE_SIZE, // Source (Sheet)
            x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE // Destination (Canvas)
        );
    }

    drawInsertStack(item, x, y, scale = 1.0, yOffset = 0) {
        const count = item.state.count || 1;
        const contents = item.state.contents;

        this.ctx.save();

        // Scale handling (Centered)
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2 + yOffset;
        this.ctx.translate(cx, cy);
        this.ctx.scale(scale, scale);
        // Reset manual translate for loop

        // Base coordinate (relative to center)
        // Draw centered on tile: -TILE_SIZE/2 offset
        const baseX = -TILE_SIZE / 2;
        const baseY = -TILE_SIZE / 2;

        const partTexture = item.definition.partTexture || 'insert-part.png';
        const fullTexture = item.definition.texture || 'insert.png';

        // Render from Top (Back) to Bottom (Front) so that the lower items (parts) 
        // are drawn *over* the items behind them, matching the visual stack style.
        // i = count-1 is the Top item (highest negative offset).
        // i = 0 is the Bottom item (0 offset).
        for (let i = count - 1; i >= 0; i--) {
            const isTop = (i === count - 1);

            // Offset: Each item is nudged UP by 6px relative to the one below it.
            // i=0 (Bottom): offset 0.
            const yOffset = i * -6;

            if (isTop) {
                // 1. Draw Base (insert.png) - Back
                const imgFull = this.assetLoader.get(fullTexture);
                if (imgFull) this.ctx.drawImage(imgFull, baseX, baseY + yOffset, TILE_SIZE, TILE_SIZE);

                // 2. Draw Contents (sandwiched)
                if (contents && contents.length > 0) {
                    const firstContent = contents[0];
                    let contentTexture = null;

                    // Resolve texture
                    if (firstContent.texture) {
                        contentTexture = firstContent.texture;
                    } else if (firstContent.definitionId && DEFINITIONS[firstContent.definitionId]) {
                        contentTexture = DEFINITIONS[firstContent.definitionId].texture;
                    } else if (typeof firstContent === 'string' && DEFINITIONS[firstContent]) {
                        contentTexture = DEFINITIONS[firstContent].texture;
                    }

                    if (contentTexture) {
                        const imgContent = this.assetLoader.get(contentTexture);
                        if (imgContent) {
                            // Nudge up 12px more relative to the top insert
                            const contentY = baseY + yOffset - 12;
                            this.ctx.drawImage(imgContent, baseX, contentY, TILE_SIZE, TILE_SIZE);


                        }
                    }
                }

                // 3. Draw Front (insert-part.png) - Top Layer
                // Only if needed? User asked for "sandwiching" so I assume partTexture is the front.
                const imgPart = this.assetLoader.get(partTexture);
                if (imgPart) this.ctx.drawImage(imgPart, baseX, baseY + yOffset, TILE_SIZE, TILE_SIZE);

                // 4. Draw Age Label (stuck to insert)
                if (contents && contents.length > 0 && contents[0].age === 1) {
                    const imgLabel = this.assetLoader.get(ASSETS.UI.INSERT_LABEL);
                    if (imgLabel) {
                        this.ctx.drawImage(imgLabel, baseX, baseY + yOffset, TILE_SIZE, TILE_SIZE);
                    }
                }

            } else {
                // Non-top items: Just draw the partTexture to simulate the stack depth
                const img = this.assetLoader.get(partTexture);
                if (img) {
                    this.ctx.drawImage(img, baseX, baseY + yOffset, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        this.ctx.restore();

        // Draw Quantity Number
        if (contents && contents.length > 0) {
            // Note: This draws in grid coords, but relies on x, y being correct.
            // If scale is small (0.5), the text might look large relative to the item, 
            // but for readability this is usually preferred.
            this.drawTinyNumber(x, y, contents.length);
        }
    }

    drawRotatedTile(textureName, x, y, rotation) {
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

    drawEntity(itemOrTexture, x, y, scale = 1.0) {
        if (!itemOrTexture) return;

        // Apply Scaling if needed (Centered)
        if (scale !== 1.0) {
            this.ctx.save();
            const cx = x * TILE_SIZE + TILE_SIZE / 2;
            const cy = y * TILE_SIZE + TILE_SIZE / 2;
            this.ctx.translate(cx, cy);
            this.ctx.scale(scale, scale);
            this.ctx.translate(-cx, -cy);
        }

        // Check if it's an Item object
        if (typeof itemOrTexture === 'object' && itemOrTexture.definitionId) {
            if (itemOrTexture.type === 'Composite' && itemOrTexture.definitionId !== 'burger_old' && (itemOrTexture.definitionId.includes('burger') || itemOrTexture.state.bun)) {
                this.drawBurger(itemOrTexture, x, y);
            } else if (itemOrTexture.type === 'Box') {
                this.drawBox(itemOrTexture, x, y);
            } else if (itemOrTexture.definitionId === 'insert') {
                this.drawInsertStack(itemOrTexture, x, y, scale);
            } else {
                // Fallback to texture property
                const textureName = itemOrTexture.texture;
                if (textureName) {
                    const img = this.assetLoader.get(textureName);
                    if (img) {
                        this.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }
                }
            }
        } else {
            // It's a string (texture name)
            const textureName = itemOrTexture;
            const img = this.assetLoader.get(textureName);
            if (img) {
                // Interpolation could go here later, for now snap to grid
                this.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }

        if (scale !== 1.0) {
            this.ctx.restore();
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

    drawAnimatedSprite(defId, x, y, startTime = 0, overridePixelX = null, overridePixelY = null) {
        const def = SPRITE_DEFINITIONS[defId];
        if (!def) return;

        // Resolve Texture
        let textureName = def.texture;

        const img = this.assetLoader.get(textureName);
        if (!img) return;

        // Calculate Frame
        const elapsed = Date.now() - startTime;
        let frameIndex = 0;

        if (def.loop) {
            // Line Boil / Loop
            const totalFrames = def.frameCount;
            const period = totalFrames * (def.duration || 100);
            const t = elapsed % period;
            frameIndex = Math.floor(t / (def.duration || 100));
        } else {
            const totalFrames = def.frameCount;
            frameIndex = Math.floor(elapsed / (def.duration || 100));
            if (frameIndex >= totalFrames) frameIndex = totalFrames - 1;
        }

        const fw = def.frameWidth;
        const fh = def.frameHeight;
        const sx = frameIndex * fw;
        const sy = 0;

        let destX, destY;

        if (overridePixelX !== null && overridePixelY !== null) {
            destX = overridePixelX;
            destY = overridePixelY;
        } else {
            // Grid-based default behavior
            destX = x * TILE_SIZE;
            destY = y * TILE_SIZE;
            const offsetX = (TILE_SIZE - fw) / 2;
            const offsetY = (TILE_SIZE - fh) / 2;
            destX += offsetX;
            destY += offsetY;
        }

        this.ctx.drawImage(img, sx, sy, fw, fh, destX, destY, fw, fh);
    }



    renderTitleScreen(selection = 0) {
        // Ensure fullscreen
        if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
            this.resizeCanvas();
        }

        const bgImg = this.assetLoader.get(ASSETS.UI.CRUMPLED_PAPER_BACKGROUND);
        if (bgImg) {
            this.ctx.drawImage(bgImg, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#e1d2d2'; // Fallback to light paper color
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Title
        this.ctx.save();
        const centerX = this.canvas.width / 2;
        const titleY = this.canvas.height / 3 - 40;

        this.ctx.translate(centerX, titleY);
        this.ctx.rotate(-5 * Math.PI / 180); // Slight tilt

        this.ctx.font = '900 80px "Inter", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.lineJoin = 'round';
        this.ctx.miterLimit = 2; // Fix spikes

        // Stroke
        // Stroke
        this.ctx.lineWidth = 42; // SUPER THICK
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeText('BURGER JOINT!', 0, 0);

        // Fill
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText('BURGER JOINT!', 0, 0);

        this.ctx.restore();

        // Options
        this.ctx.font = '900 40px "Inter", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.lineWidth = 28;
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#000';

        const startY = this.canvas.height / 2 + 30; // Push down a bit
        const spacing = 60;

        const options = ['New Game', 'Settings'];

        options.forEach((opt, index) => {
            const y = startY + (index * spacing);
            const isSelected = (selection === index);

            this.ctx.strokeText(opt, centerX, y);

            this.ctx.fillStyle = isSelected ? '#00FF7F' : '#fff'; // Spring Green if selected
            this.ctx.fillText(opt, centerX, y);

            if (isSelected) {
                // Double stroke for selected? Or just color change. Color change is requested.
            }
        });

        // Controls hint
        this.ctx.font = '900 18px "Inter", sans-serif';
        this.ctx.lineWidth = 12;
        this.ctx.fillStyle = '#fff';

        const hintY = this.canvas.height - 40;
        const hintText1 = 'WASD / Arrows to Navigate';
        const hintText2 = 'ENTER / SPACE to Select';

        this.ctx.strokeText(hintText1, centerX, hintY - 25);
        this.ctx.fillText(hintText1, centerX, hintY - 25);

        this.ctx.strokeText(hintText2, centerX, hintY);
        this.ctx.fillText(hintText2, centerX, hintY);
    }

    renderSettingsMenu(state, settings) {
        // Ensure fullscreen
        if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
            this.resizeCanvas();
        }

        // state: { selectedIndex, rebindingAction }
        const bgImg = this.assetLoader.get(ASSETS.UI.CRUMPLED_PAPER_BACKGROUND);
        if (bgImg) {
            this.ctx.drawImage(bgImg, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#e1d2d2';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.ctx.fillStyle = '#000';
        this.ctx.textAlign = 'center';

        this.ctx.font = '32px Arial';
        this.ctx.fillText('Controls', this.canvas.width / 2, 50);

        // 1. Audio Settings
        this.ctx.textAlign = 'left';
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#333';
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
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                this.ctx.fillRect(100, currentY - 25, this.canvas.width - 200, rowHeight);
                this.ctx.fillStyle = '#d35400';
            } else {
                this.ctx.fillStyle = '#444';
            }

            this.ctx.font = '20px Monospace';
            this.ctx.fillText(opt.label, 120, currentY);

            this.ctx.textAlign = 'right';
            const statusText = val ? "ON" : "OFF";
            this.ctx.fillStyle = val ? '#27ae60' : '#c0392b'; // Darker Green/Red
            this.ctx.fillText(statusText, this.canvas.width - 120, currentY);

            this.ctx.textAlign = 'left';
            currentY += rowHeight;
        });

        // 2. Controls
        currentY += 20; // Spacer
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#333';
        this.ctx.fillText("Key Bindings", 100, currentY);
        currentY += 40;

        const bindings = settings.bindings;
        const displayOrder = [
            'MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT',
            'INTERACT', 'PICK_UP', 'VIEW_ORDERS',
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
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                this.ctx.fillRect(100, y - 25, this.canvas.width - 200, rowHeight);
                this.ctx.fillStyle = '#d35400';
            } else {
                this.ctx.fillStyle = '#444';
            }

            // Action Name
            let niceName = action.replace(/_/g, ' ');
            if (action === 'VIEW_ORDERS') niceName = 'SHOW TICKET';
            this.ctx.fillText(niceName, 120, y);

            // Key Binding
            this.ctx.textAlign = 'right';
            let keyParams = bindings[action];
            if (isRebinding) {
                this.ctx.fillStyle = '#27ae60';
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
        this.ctx.fillStyle = '#333';
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Use Arrows/WASD to Navigate. ENTER to Rebind. ESC to Back.', this.canvas.width / 2, this.canvas.height - 30);
    }

    drawOrderTickets(orders, pickUpKey, penalty, menuItems, activeIndex = 0) {
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

            // Use activeIndex to determine active ticket
            const isActive = (index === activeIndex);
            this.drawSingleTicket(ticketImg, x, y + offsetY, ticketW, ticketH, angle, order, isActive);
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

        if (menuItems && menuItems.length > 0) {
            this.ctx.fillStyle = '#ddd';
            this.ctx.font = '16px Monospace';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'bottom';

            const startX = 20;
            // Draw above the bottom edge, avoiding overlap with center text
            let startY = this.canvas.height - 20;

            this.ctx.fillText("Available Items:", startX, startY - (menuItems.length * 20) - 5);

            menuItems.forEach((item, index) => {
                this.ctx.fillText(`- ${item}`, startX, startY - ((menuItems.length - 1 - index) * 20));
            });
        }

        this.ctx.restore();
    }

    drawSingleTicket(img, x, y, w, h, angle, order, isActive = false) {
        this.ctx.save();

        // Pivot around center of ticket for rotation
        const cx = x + w / 2;
        const cy = y + h / 2;

        this.ctx.translate(cx, cy);
        this.ctx.rotate(angle);
        this.ctx.translate(-cx, -cy);

        // Draw Ticket
        this.ctx.drawImage(img, x, y, w, h);

        if (isActive) {
            this.ctx.lineWidth = 4;
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.strokeRect(x, y, w, h);
        }

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

    drawLightingEffect(width, height, opacity = 1.0) {
        this.ctx.save();
        this.ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * opacity})`;

        // Left Triangle (Top-heavy shadow to create downward light beam)
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(width * 0.3, 0);
        this.ctx.lineTo(0, height);
        this.ctx.fill();

        // Right Triangle
        this.ctx.beginPath();
        this.ctx.moveTo(width, 0);
        this.ctx.lineTo(width * 0.7, 0);
        this.ctx.lineTo(width, height);
        this.ctx.fill();

        this.ctx.restore();
    }

    drawControlsHelp(gameState) {
        if (!gameState.grid) return;
        // Don't show in Title or Settings (though grid is usually null there anyway)
        if (gameState.gameState === 'TITLE' || gameState.gameState === 'SETTINGS') return;

        const gridPixelHeight = gameState.grid.height * TILE_SIZE;
        // Use the offsets calculated in render()
        // We need to position relative to the grid, but draw in screen space (no translation needed if using calculated offsets?)
        // The offsets this.offsetX and this.offsetY are the top-left of the grid.

        const y = this.offsetY + gridPixelHeight + 35;
        const centerX = this.canvas.width / 2;

        this.ctx.save();
        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '16px Monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';

        if (gameState.settings) {
            const getBind = (action) => {
                let k = gameState.settings.getBinding(action);
                return k ? k.replace('Key', '').replace('Digit', '') : '???';
            };

            const iKey = getBind('INTERACT');
            const pKey = getBind('PICK_UP');
            const vKey = getBind('VIEW_ORDERS');

            this.ctx.fillText(`MOVE: WASD | INTERACT: ${iKey} | PICK UP: ${pKey} | SHOW TICKET: ${vKey}`, centerX, y);

            // Day Counter
            this.ctx.font = 'bold 16px Monospace';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(`Day ${gameState.dayNumber}`, centerX, y + 25);
        }

        this.ctx.restore();
    }

    drawHUD(gameState) {
        // Placement Mode HUD
        if (gameState.placementState && gameState.placementState.active) {
            this.drawPlacementHUD(gameState.placementState, gameState);
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

    drawPlacementHUD(state, gameState) {
        this.ctx.save();
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = 'black';
        this.ctx.shadowBlur = 4;

        let statusText = "BUILD MODE";
        if (state.heldItem) {
            statusText = `PLACING: ${state.heldItem.tileType}`;
        } else {
            statusText = "BUILD MODE - Drag & Drop";
        }

        if (state.menu && state.menu.active) {
            statusText = "MENU OPEN";
        }

        this.ctx.fillText(statusText, this.canvas.width / 2, 30);
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Move: WASD | Pick/Place: SPACE | Menu: ENTER | Exit: ESC', this.canvas.width / 2, 60);

        // Expansion Hint
        if (gameState) {
            const expItem = gameState.shopItems.find(i => i.id === 'expansion');
            if (expItem) {
                this.ctx.fillStyle = '#ffd700';
                this.ctx.fillText(`[X] Expand Kitchen ($${expItem.price})`, this.canvas.width / 2, 85);
            }
        }

        this.ctx.restore();
    }

    renderPlacementCursor(state) {
        if (!state.active) return;

        // Debugging Cursor Visibility
        // console.log(`Rendering Cursor: X=${state.x}, Y=${state.y}, Active=${state.active}`);

        // This method renders the cursor which belongs to the GRID coordinates.
        // We must apply the same offset!

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);

        const img = this.assetLoader.get(ASSETS.UI.SELECTOR);
        if (!img) {
            console.warn("Cursor Image (SELECTOR) not found in AssetLoader!");
        }
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
        if (state.heldItem && state.heldItem.tileType) {
            const tileTx = ASSETS.TILES[state.heldItem.tileType];
            if (tileTx) {
                const tImg = this.assetLoader.get(tileTx);
                if (tImg) {
                    this.ctx.save();
                    this.ctx.globalAlpha = 0.5;
                    this.ctx.drawImage(tImg, state.x * TILE_SIZE, state.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    this.ctx.restore();
                }
            }

            // Draw attached object ghost on top
            if (state.heldItem.attachedObject) {
                this.ctx.save();
                this.ctx.globalAlpha = 0.5;
                this.drawObject(state.heldItem.attachedObject, state.x, state.y);
                this.ctx.restore();
            }
        }

        this.ctx.restore();
    }

    renderBuildMenu(menu) {
        if (!menu || !menu.active) return;

        // Draw Menu Overlay near the cursor (grid coords in menu.x, menu.y)
        // Need to project to screen space
        // We can reuse this.offsetX/Y from the last render pass?
        // Yes, render() sets them.

        const gridX = menu.x;
        const gridY = menu.y;

        const screenX = this.offsetX + (gridX * TILE_SIZE) + TILE_SIZE; // Right of cursor
        const screenY = this.offsetY + (gridY * TILE_SIZE);

        this.ctx.save();
        this.ctx.translate(screenX, screenY);

        this.ctx.font = '16px Monospace'; // Set font first for measurement

        // Calculate dynamic width
        let maxTextWidth = 0;
        menu.options.forEach(opt => {
            const text = `> ${opt.label}`;
            const metrics = this.ctx.measureText(text);
            if (metrics.width > maxTextWidth) maxTextWidth = metrics.width;
        });

        // Ensure enough padding (10px left + text + 10px right)
        // Keep minimum width of 200 for consistency
        const width = Math.max(200, maxTextWidth + 20);
        const height = menu.options.length * 30 + 10;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 2;

        // Prevent going off screen (basic clamp)
        // (Skipped for brevity, assume centered kitchen)

        this.ctx.fillRect(0, 0, width, height);
        this.ctx.strokeRect(0, 0, width, height);

        // Options
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';

        menu.options.forEach((opt, i) => {
            const isSelected = i === menu.selectedIndex;
            const y = 5 + i * 30 + 15;

            if (isSelected) {
                this.ctx.fillStyle = '#ffd700';
                this.ctx.fillText(`> ${opt.label}`, 10, y);
            } else {
                this.ctx.fillStyle = 'white';
                this.ctx.fillText(`  ${opt.label}`, 10, y);
            }
        });

        this.ctx.restore();
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
    renderComputerScreen(gameState) {
        // Darken background
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'; // Slightly darker
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Title
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText("OFFICE COMPUTER", this.canvas.width / 2, 40);

        // Money
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#ffd700';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`$${gameState.money}`, this.canvas.width - 50, 40);

        const items = gameState.shopItems.filter(i => i.type === 'supply');
        const selectedId = gameState.selectedComputerItemId || items[0].id;

        // Grid Layout
        // 4 Columns
        const cols = 4;
        const buttonSize = 120;
        const gap = 30;
        const cellStride = buttonSize + gap;

        // Calculate Visible Area
        const startY = 120;
        const bottomMargin = 60;
        const availableHeight = this.canvas.height - startY - bottomMargin;
        const visibleRows = Math.max(1, Math.floor(availableHeight / cellStride));

        // Calculate Grid Dims
        const totalRows = Math.ceil(items.length / cols);
        const gridW = cols * buttonSize + (cols - 1) * gap;
        // Start X to center the grid
        const startX = (this.canvas.width - gridW) / 2;

        // Determine Selection Row
        const selectedIndex = items.findIndex(i => i.id === selectedId);
        const selectedRow = Math.floor(selectedIndex / cols);

        // Manage Scroll State
        if (this.computerScrollRow === undefined) this.computerScrollRow = 0;

        // Auto-Scroll to keep selection in view
        if (selectedRow < this.computerScrollRow) {
            this.computerScrollRow = selectedRow;
        } else if (selectedRow >= this.computerScrollRow + visibleRows) {
            this.computerScrollRow = selectedRow - visibleRows + 1;
        }

        // Clamp Scroll
        const maxScroll = Math.max(0, totalRows - visibleRows);
        this.computerScrollRow = Math.max(0, Math.min(this.computerScrollRow, maxScroll));
        // Reset if we can see everything
        if (totalRows <= visibleRows) this.computerScrollRow = 0;

        const buttonImg = this.assetLoader.get(ASSETS.UI.BUY_BUTTON);

        // Render Visible Items
        const startItemIndex = this.computerScrollRow * cols;
        const endRow = this.computerScrollRow + visibleRows;
        // We render slightly past visible to catch partials if we wanted, 
        // but row-by-row clipping is simplest.
        const endItemIndex = Math.min(items.length, endRow * cols);

        for (let i = startItemIndex; i < endItemIndex; i++) {
            const item = items[i];
            const relativeRow = Math.floor(i / cols) - this.computerScrollRow;
            const col = i % cols;

            const x = startX + col * cellStride;
            const y = startY + relativeRow * cellStride;

            const isSelected = (item.id === selectedId);

            // Data
            const currentCount = gameState.getInventoryCount(item.id);
            // Heuristic Max (Since we don't handle imports here easily, hardcode map for now)
            const capacityMap = {
                'patty_box': 12, 'bun_box': 32, 'wrapper_box': 100,
                'fry_box': 3, 'side_cup_box': 25, 'syrup_box': 1,
                'drink_cup_box': 15, 'mayo_box': 3, 'tomato_box': 25, 'bag_box': 20,
                'lettuce_box': 25
            };
            const max = capacityMap[item.id] || 20;

            const fillPct = Math.min(currentCount / max, 1.0);

            // Draw Button Base
            if (buttonImg) {
                this.ctx.drawImage(buttonImg, x, y, buttonSize, buttonSize);
            } else {
                this.ctx.fillStyle = '#333';
                this.ctx.fillRect(x, y, buttonSize, buttonSize);
            }

            // Draw "Meter" Fill
            if (fillPct > 0) {
                this.ctx.save();
                // Fill from bottom
                const fillH = buttonSize * fillPct;
                this.ctx.beginPath();
                this.ctx.rect(x, y + buttonSize - fillH, buttonSize, fillH);
                this.ctx.clip();

                // Color: If full or over, green. If low, maybe warning?
                // User said "instantly fills with color".
                this.ctx.fillStyle = '#2ecc71'; // Green
                if (isSelected) this.ctx.fillStyle = '#3498db'; // Blueish if selected

                this.ctx.globalAlpha = 0.7;
                this.ctx.fillRect(x, y, buttonSize, buttonSize);
                this.ctx.restore();
            }

            // Draw Icon
            // Heuristic for texture name: usually item.id + '-closed.png'
            let textureName = item.id + '-closed.png';
            // Specific overrides if needed (some assets might be named differently)
            if (item.id === 'bag_box') textureName = 'bag_box-closed.png';
            if (item.id === 'insert') textureName = 'insert.png';
            // AssetLoader keys are derived from filenames visually in listing
            // bag_box-closed.png exists.

            const icon = this.assetLoader.get(textureName);
            if (icon) {
                const pad = 20;
                const size = buttonSize - pad * 2;
                this.ctx.drawImage(icon, x + pad, y + pad, size, size);
            }

            // Draw Lock Overlay if Locked (ON TOP of Icon)
            if (!item.unlocked) {
                const lockImg = this.assetLoader.get(ASSETS.TILES.LOCKED);

                // Dimming (Semi-transparent background)
                this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
                this.ctx.fillRect(x, y, buttonSize, buttonSize);

                if (lockImg) {
                    const pad = 30;
                    this.ctx.drawImage(lockImg, x + pad, y + pad, buttonSize - pad * 2, buttonSize - pad * 2);
                }
            }

            // Price Label
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'right';
            this.ctx.shadowColor = 'black';
            this.ctx.shadowBlur = 4;
            this.ctx.fillText(`$${item.price}`, x + buttonSize - 5, y + buttonSize - 5);
            this.ctx.shadowBlur = 0;

            // RUSH Markup Indicator
            if (gameState.isRushMode) {
                this.ctx.fillStyle = '#ff0000';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.fillText("RUSH +100%", x + buttonSize - 5, y + buttonSize - 22);
            } else {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.fillText("MORNING", x + buttonSize - 5, y + buttonSize - 22);
            }

            // Selection Highlight
            if (isSelected) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 4;
                this.ctx.strokeRect(x - 2, y - 2, buttonSize + 4, buttonSize + 4);

                // Name
                this.ctx.fillStyle = '#fff';
                this.ctx.textAlign = 'center';
                this.ctx.font = '18px Arial';
                this.ctx.fillText(item.id.replace(/_/g, ' ').toUpperCase(), x + buttonSize / 2, y - 15);

                // Inventory Text
                this.ctx.fillStyle = '#ccc';
                this.ctx.font = '14px Monospace';
                this.ctx.fillText(`${currentCount} / ${max}`, x + buttonSize / 2, y + buttonSize + 20);

                // Helper text for cart
                const inCart = gameState.cart[item.id] || 0;
                if (inCart > 0) {
                    this.ctx.fillStyle = '#ffff00';
                    this.ctx.fillText(`+${inCart} Ordered`, x + buttonSize / 2, y + buttonSize + 35);
                }
            }
        }

        // Draw Scrollbar (if needed)
        if (totalRows > visibleRows) {
            const trackH = visibleRows * cellStride - gap; // Match grid height roughly
            const barW = 12;
            const barX = startX + gridW + 20; // To the right of grid
            const barY = startY;

            // Track
            this.ctx.fillStyle = '#555';
            this.ctx.fillRect(barX, barY, barW, trackH);

            // Thumb
            // Calculate thumb size and position
            const viewRatio = visibleRows / totalRows;
            const thumbH = Math.max(30, trackH * viewRatio);

            // Correct Thumb Position
            // The scrollable range is (trackH - thumbH)
            // The scroll index range is (totalRows - visibleRows)
            // But implementing proportional scroll is safer visually:
            // ThumbTop = (CurrentRow / TotalRows) * TrackH ?? 
            // Better: ThumbTop = (CurrentRow / (TotalRows - VisibleRows)) * (TrackH - ThumbH) if we view it as a slider.
            // But standard list scrollbar:
            // Top = (ScrollRow / TotalRows) * TrackH

            const thumbY = barY + (this.computerScrollRow / totalRows) * trackH;

            this.ctx.fillStyle = '#ccc';
            this.ctx.fillRect(barX, thumbY, barW, thumbH);
        }

        // Instructions
        this.ctx.fillStyle = '#888';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("ARROWS to Navigate  |  ENTER to Order  |  ESC to Exit", this.canvas.width / 2, this.canvas.height - 40);

        // Draw START DAY Arrow (Right Side)
        if (gameState.gameState === 'COMPUTER_ORDERING') {
            const arrowImg = this.assetLoader.get(ASSETS.UI.GREEN_ARROW);
            if (arrowImg) {
                const arrowSize = 64;
                const arrowX = startX + gridW + 40;
                const arrowY = this.canvas.height / 2;

                this.ctx.drawImage(arrowImg, arrowX - arrowSize / 2, arrowY - arrowSize / 2, arrowSize, arrowSize);

                this.ctx.fillStyle = '#fff';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText("START DAY >", arrowX, arrowY + arrowSize / 2 + 20);
            }
        }

        this.ctx.restore();
    }

    renderRenoScreen(gameState) {
        // Background
        this.ctx.save();
        const renoBg = this.assetLoader.get(ASSETS.UI.RENO_MENU_BG);
        if (renoBg) {
            this.ctx.drawImage(renoBg, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Title
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText("RENO SHOP", this.canvas.width / 2, 40);

        // Money
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#ffd700';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`$${gameState.money}`, this.canvas.width - 50, 40);

        // Filter items
        // Note: Sort order is Action (0,1) -> Appliances (2+) due to Game.js sortShopItems
        const items = gameState.shopItems.filter(i => i.type === 'appliance' || i.type === 'action');
        const selectedIndex = gameState.selectedRenoIndex || 0;

        // Layout Constants
        const startY = 120;
        const buttonH = 120;
        const gap = 30;
        const cols = 3; // New: 3 Columns
        const gridSize = 120;

        // Total Width Calculation
        // Grid: 3x 120 + 2x Gap
        const gridW = cols * gridSize + (cols - 1) * gap;
        const startX = (this.canvas.width - gridW) / 2;

        // Draw Items
        items.forEach((item, index) => {
            let x = 0;
            let y = 0;
            let w = 0;
            let h = buttonH; // Default height

            if (index === 0) {
                // Build Mode (Left)
                // Spans first 2 columns (0, 1)
                // Width = 2 * gridSize + gap
                x = startX;
                y = startY;
                w = gridSize * 2 + gap;
            } else if (index === 1) {
                // Expand (Right)
                // Spans last column (2)
                x = startX + (gridSize * 2 + gap) + gap;
                y = startY;
                w = gridSize;
            } else {
                // Grid Items (Index 2+)
                const gridIdx = index - 2;
                const col = gridIdx % cols;
                const row = Math.floor(gridIdx / cols);
                x = startX + col * (gridSize + gap);
                y = startY + buttonH + gap + row * (gridSize + gap);
                w = gridSize;
            }

            const isSelected = (index === selectedIndex);

            // 1. Draw Background / Button Asset
            let bgAsset = null;
            if (item.id === 'build_mode') bgAsset = ASSETS.UI.RENO_BUILD_MODE;
            else if (item.id === 'expansion') bgAsset = ASSETS.UI.RENO_EXPAND;
            else bgAsset = ASSETS.UI.RENO_ITEM_BG;

            const bgImg = this.assetLoader.get(bgAsset);
            if (bgImg) {
                this.ctx.drawImage(bgImg, x, y, w, h);
            } else {
                // Fallback
                this.ctx.fillStyle = '#555';
                this.ctx.fillRect(x, y, w, h);
            }

            // 2. Draw Icon (if appliance)
            if (item.uiAsset && item.type === 'appliance') {
                const icon = this.assetLoader.get(ASSETS.UI[item.uiAsset] || item.uiAsset);
                if (icon) {
                    // Center icon
                    const iconSize = w * 0.7;
                    const ix = x + (w - iconSize) / 2;
                    const iy = y + (h - iconSize) / 2;
                    this.ctx.drawImage(icon, ix, iy, iconSize, iconSize);
                }
            } else if (item.tileType && ASSETS.TILES[item.tileType]) {
                // Fallback to Tile Texture
                const icon = this.assetLoader.get(ASSETS.TILES[item.tileType]);
                if (icon) {
                    const iconSize = w * 0.6;
                    const ix = x + (w - iconSize) / 2;
                    const iy = y + (h - iconSize) / 2;
                    this.ctx.drawImage(icon, ix, iy, iconSize, iconSize);
                }
            }

            // 3. Selection Highlight
            if (isSelected) {
                this.ctx.save();
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 6;
                this.ctx.shadowColor = 'black';
                this.ctx.shadowBlur = 10;
                this.ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
                this.ctx.restore();
            }

            // 4. Price Tag (only if > 0)
            if (item.price > 0) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 20px Arial';
                this.ctx.textAlign = 'right';
                this.ctx.shadowColor = 'black';
                this.ctx.shadowBlur = 4;
                this.ctx.lineWidth = 3;
                this.ctx.strokeText(`$${item.price}`, x + w - 10, y + h - 10);
                this.ctx.fillText(`$${item.price}`, x + w - 10, y + h - 10);
            }

            // 5. Owned Count (if > 0)
            const count = gameState.storage[item.id] || 0;
            if (count > 0 && item.type === 'appliance') {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.textAlign = 'left';
                this.ctx.strokeText(`x${count}`, x + 10, y + h - 10);
                this.ctx.fillText(`x${count}`, x + 10, y + h - 10);
            }
        });

        // Instructions
        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("ARROWS to Navigate  |  ENTER to Select  |  ESC to Exit", this.canvas.width / 2, this.canvas.height - 40);

        this.ctx.restore();
    }

    drawServiceHint(x, y, gameState, cellObject) {
        if (!gameState.activeTickets || gameState.activeTickets.length === 0) return;

        const idx = gameState.activeTicketIndex || 0;
        const ticket = gameState.activeTickets[idx] || gameState.activeTickets[0]; // Fallback

        if (!ticket) return;

        // 1. Draw Bag Outline (Always if active ticket exists)
        this.drawTile('bag-trans.png', x, y);

        // 2. Determine Requirements
        // Using "One Bag Rule" logic
        const bagReq = ticket.bags && ticket.bags[0];
        if (!bagReq) return;

        let reqBurgers = bagReq.burgers ? [...bagReq.burgers] : []; // Copy for matching
        let reqSides = [];
        let reqDrinks = [];

        if (bagReq.items) {
            bagReq.items.forEach(itemId => {
                const def = DEFINITIONS[itemId];
                if (def && def.orderConfig) {
                    if (def.orderConfig.type === 'side') reqSides.push(itemId);
                    if (def.orderConfig.type === 'drink') reqDrinks.push(itemId);
                } else {
                    if (def && def.category === 'side') reqSides.push(itemId);
                    if (def && (def.category === 'drink' || def.category === 'hetap')) reqDrinks.push(itemId);
                }
            });
        }

        const totalReqBurgers = reqBurgers.length;
        const totalReqSides = reqSides.length;
        const totalReqDrinks = reqDrinks.length;

        // 3. Determine Present Items & Validate
        let validBurgers = 0;
        let validSides = 0;
        let validDrinks = 0;
        let errorBurgers = false;
        let errorSides = false;
        let errorDrinks = false;

        if (cellObject && cellObject.definitionId === 'bag' && cellObject.state && cellObject.state.contents) {

            // Helper function to check topping arrays
            const checkBurgerMatch = (reqModifications, actualItem) => {
                const actualToppings = (actualItem.state.toppings || []).map(t => {
                    if (typeof t === 'string') return t === 'mayo' ? 'mayo' : t;
                    return t.definitionId;
                });

                // 1. Check all requested mods present
                const missingMod = reqModifications.find(req => {
                    if (actualToppings.includes(req)) return false;
                    const def = DEFINITIONS[req];
                    if (def && def.slicing && def.slicing.result) {
                        if (actualToppings.includes(def.slicing.result)) return false;
                    }
                    return true;
                });
                if (missingMod) return false;

                // 2. Check for extra toppings (Strict)
                const validToppings = new Set(reqModifications);
                reqModifications.forEach(req => {
                    const def = DEFINITIONS[req];
                    if (def && def.slicing && def.slicing.result) {
                        validToppings.add(def.slicing.result);
                    }
                });

                // Ignore basic bun/patty in 'toppings' array if they somehow got in there, 
                // but usually they are distinct properties. 
                // Our logic focuses on the 'toppings' list.
                const extraTop = actualToppings.find(act => !validToppings.has(act));
                if (extraTop) return false;

                return true;
            };

            cellObject.state.contents.forEach(contentItem => {
                const def = DEFINITIONS[contentItem.definitionId];

                // --- Burger Validation ---
                if (contentItem.definitionId.includes('burger')) {
                    // Try to match against ANY remaining requirement
                    const matchIndex = reqBurgers.findIndex(req => checkBurgerMatch(req.modifications, contentItem));

                    if (matchIndex !== -1) {
                        validBurgers++;
                        reqBurgers.splice(matchIndex, 1); // Consume requirement
                    } else {
                        errorBurgers = true; // Provides a burger, but it's wrong (or extra)
                        validBurgers++; // Still counts for "Fill" purposes? Or maybe not? User said "fills up as if right".
                    }
                }

                // --- Side/Drink Validation ---
                if (def) {
                    let isSide = false;
                    let isDrink = false;

                    if (def.orderConfig) {
                        if (def.orderConfig.type === 'side') isSide = true;
                        if (def.orderConfig.type === 'drink') isDrink = true;
                    } else {
                        if (def.category === 'side') isSide = true;
                        if (def.category === 'drink' || def.category === 'hetap') isDrink = true;
                    }

                    if (isSide) {
                        // Simple ID match
                        // Note: aliases like fries/fry_bag handled? 
                        const matchIndex = reqSides.findIndex(reqId => {
                            if (reqId === contentItem.definitionId) return true;
                            if (reqId === 'fries' && (contentItem.definitionId === 'fry_bag')) return true;
                            return false;
                        });

                        if (matchIndex !== -1) {
                            validSides++;
                            reqSides.splice(matchIndex, 1);
                        } else {
                            errorSides = true;
                            validSides++;
                        }
                    }

                    if (isDrink) {
                        const matchIndex = reqDrinks.findIndex(reqId => {
                            if (reqId === contentItem.definitionId) return true;
                            if (reqId === 'soda' && (contentItem.definitionId === 'drink_cup')) return true;
                            return false;
                        });

                        if (matchIndex !== -1) {
                            validDrinks++;
                            reqDrinks.splice(matchIndex, 1);
                        } else {
                            errorDrinks = true;
                            validDrinks++;
                        }
                    }
                }
            });
        }

        // 4. Render Tags (Dynamic Fill or Error)
        if (totalReqBurgers > 0) {
            this.drawProgressTag('burger', x, y, validBurgers, totalReqBurgers, errorBurgers);
        }
        if (totalReqSides > 0) {
            this.drawProgressTag('side', x, y, validSides, totalReqSides, errorSides);
        }
        if (totalReqDrinks > 0) {
            this.drawProgressTag('drink', x, y, validDrinks, totalReqDrinks, errorDrinks);
        }
    }

    drawProgressTag(type, x, y, current, total, isError = false) {
        // 0. Error State
        if (isError) {
            this.drawTile(`${type}-tag-wrong.png`, x, y);
            return;
        }

        // 1. Finished State: Draw 'Done' tag (fully filled + checkmark)
        if (current >= total) {
            this.drawTile(`${type}-tag-done.png`, x, y);
            return;
        }

        // 2. In Progress: Draw Empty Base + Clipped Partial Fill
        this.drawTile(`${type}-tag-trans.png`, x, y);

        if (current > 0) {
            const pct = Math.min(current / total, 1.0);
            const layout = TAG_LAYOUTS[type] || { top: 0, bottom: 64 };

            const height = layout.bottom - layout.top;
            const fillHeight = height * pct;

            // Calculate Clipping Rect
            // We want to reveal the image from layout.bottom upwards.
            const gridPixelX = x * TILE_SIZE;
            const gridPixelY = y * TILE_SIZE;

            const clipY = gridPixelY + layout.bottom - fillHeight;

            this.ctx.save();
            this.ctx.beginPath();
            // width 64 (TILE_SIZE), height fillHeight
            this.ctx.rect(gridPixelX, clipY, TILE_SIZE, fillHeight);
            this.ctx.clip();

            // Use 'partial' for the filling animation
            this.drawTile(`${type}-tag-partial.png`, x, y);

            this.ctx.restore();
        }
    }

    drawBurger(item, x, y, yOffset = 0) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE + yOffset;
        this.drawBurgerPixels(item, px, py);
    }

    drawBurgerPixels(item, px, py, scale = 1.0, ctx = this.ctx) {
        const drawSize = TILE_SIZE * scale;

        // 0. Wrapped State - Override everything else
        if (item.state.isWrapped) {
            const wrappedImg = this.assetLoader.get(ASSETS.OBJECTS.BURGER_WRAPPED);
            // Fallback to wrapper texture if specific wrapped burger asset missing? 
            // Better to rely on the defined asset.
            if (wrappedImg) {
                ctx.drawImage(wrappedImg, px, py, drawSize, drawSize);
            }
            return;
        }

        // Resolve Bun Assets
        let bottomTexName = ASSETS.OBJECTS.BUN_BOTTOM;
        let topTexName = ASSETS.OBJECTS.BUN_TOP;

        if (item.state.bun) {
            const bunDef = DEFINITIONS[item.state.bun.definitionId];
            if (bunDef) {
                // Check for custom textures in definition
                // Supports explicit 'bottomTexture'/'topTexture' 
                // OR fallback to checking if textures.bottom/textures.top exist if we used a complex object
                if (bunDef.bottomTexture) bottomTexName = bunDef.bottomTexture;
                if (bunDef.topTexture) topTexName = bunDef.topTexture;
            }
        }

        // 1. Bottom Bun
        const bunBottomImg = this.assetLoader.get(bottomTexName);
        if (bunBottomImg) {
            ctx.drawImage(bunBottomImg, px, py, drawSize, drawSize);
        }

        let yOffset = 0; // Moves UP (negative Y)

        // Helper to draw a layer
        const drawLayer = (objOrStr) => {
            let texName = null;
            let nudge = 0;

            // Explicitly handle 'mayo' string first
            if (objOrStr === 'mayo') {
                texName = ASSETS.OBJECTS.MAYO_PART;
                nudge = 0;
            }
            else if (typeof objOrStr === 'string') {
                if (DEFINITIONS[objOrStr]) {
                    const def = DEFINITIONS[objOrStr];
                    texName = def.partTexture || def.texture;
                    nudge = def.nudge !== undefined ? def.nudge : 2;
                } else {
                    texName = objOrStr;
                }
            }
            else if (typeof objOrStr === 'object') {
                // ItemInstance
                const item = objOrStr;
                // Try to find partTexture in definition
                if (item.definitionId && DEFINITIONS[item.definitionId]) {
                    const def = DEFINITIONS[item.definitionId];
                    texName = def.partTexture || def.texture; // Prioritize partTexture

                    // Specific override for beef_patty if nudge not set
                    if (def.nudge !== undefined) {
                        nudge = def.nudge;
                    } else if (item.definitionId === 'beef_patty') {
                        nudge = 5;
                    } else {
                        nudge = 2;
                    }
                } else {
                    texName = item.texture || (item.getTexture ? item.getTexture() : null);
                }
            }

            // Apply Scale to Nudge
            nudge = nudge * scale;

            if (texName) {
                const img = this.assetLoader.get(texName);
                if (img) {
                    ctx.drawImage(img, px, py - yOffset, drawSize, drawSize);
                    yOffset += nudge;
                }
            }
        };



        // 3. Toppings (Iterate in order)
        if (item.state.toppings && Array.isArray(item.state.toppings)) {
            item.state.toppings.forEach(t => {
                if (t) drawLayer(t);
            });
        }

        // 4. Top Bun
        const bunTopImg = this.assetLoader.get(topTexName);
        if (bunTopImg) {
            ctx.drawImage(bunTopImg, px, py - yOffset, drawSize, drawSize);
        }
    }


    drawEffects(gameState) {
        if (!gameState.effects) return;

        gameState.effects.forEach(effect => {
            if (effect.type === 'dust') {
                const img = this.assetLoader.get(ASSETS.EFFECTS.DUST_SHEET);
                if (!img) return;

                const elapsed = Date.now() - effect.startTime;
                const totalFrames = 6;
                const frameDuration = effect.duration / totalFrames;
                const currentFrame = Math.floor(elapsed / frameDuration);

                if (currentFrame >= totalFrames) return;

                const frameWidth = img.width / totalFrames;
                const frameHeight = img.height;

                const sx = currentFrame * frameWidth;
                const sy = 0;

                const x = effect.x * TILE_SIZE;
                const y = effect.y * TILE_SIZE;

                this.ctx.save();
                // Translate to center of the tile
                this.ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);

                if (effect.rotation) {
                    this.ctx.rotate(effect.rotation);
                }

                // Draw centered relative to the translation
                this.ctx.drawImage(img, sx, sy, frameWidth, frameHeight, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
                this.ctx.restore();
            }
        });
    }
}

import { ASSETS, TILE_SIZE, TAG_LAYOUTS, TILE_TYPES } from '../constants.js';
import { DEFINITIONS } from '../data/definitions.js';
import * as ObjectRenderer from './ObjectRenderer.js';


export function drawHUD(renderer, gameState) {


    const ctx = renderer.ctx;
    const canvas = renderer.canvas;

    ctx.save();
    ctx.font = '20px Arial';
    ctx.textBaseline = 'top';

    const scoreText = `HIGH SCORE: $${(gameState.highScore || 0).toFixed(2)}`;
    const runText = `SCORE: $${(gameState.score || 0).toFixed(2)}`;

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    ctx.strokeText(scoreText, canvas.width - 20, 10);
    ctx.strokeText(runText, canvas.width - 20, 40);

    ctx.fillStyle = '#ffcc00';
    ctx.fillText(scoreText, canvas.width - 20, 10);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(runText, canvas.width - 20, 40);

    if (gameState.isDayActive && !gameState.isPrepTime && typeof gameState.timeToNextTicket !== 'undefined') {
        const nextTicketText = `NEXT TICKET: ${gameState.timeToNextTicket.toFixed(1)}s`;
        ctx.strokeText(nextTicketText, canvas.width - 20, 70);
        ctx.fillStyle = '#00ff00';
        ctx.fillText(nextTicketText, canvas.width - 20, 70);

        const xpText = `LEVEL ${gameState.level} (${gameState.xp}/${gameState.xpToNextLevel} XP)`;
        ctx.strokeText(xpText, canvas.width - 20, 100);
        ctx.fillStyle = '#ffd700';
        ctx.fillText(xpText, canvas.width - 20, 100);
    }

    ctx.restore();
    drawPauseButton(renderer, gameState);
}

export function drawControlsHelp(renderer, gameState) {
    if (!gameState.grid) return;
    if (gameState.gameState === 'TITLE' || gameState.gameState === 'SETTINGS') return;

    const ctx = renderer.ctx;
    const canvas = renderer.canvas;
    const gridPixelHeight = gameState.grid.height * TILE_SIZE;
    const y = renderer.offsetY + gridPixelHeight + 35;
    const centerX = canvas.width / 2;

    ctx.save();
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    if (gameState.settings) {
        const getBind = (action) => {
            let k = gameState.settings.getBinding(action);
            return k ? k.replace('Key', '').replace('Digit', '') : '???';
        };

        const iKey = getBind('INTERACT');
        const pKey = getBind('PICK_UP');
        const vKey = getBind('VIEW_ORDERS');

        ctx.fillText(`MOVE: WASD | INTERACT: ${iKey} | PICK UP: ${pKey} | SHOW TICKET: ${vKey}`, centerX, y);

        ctx.font = 'bold 16px Monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Day ${gameState.dayNumber}`, centerX, y + 25);
    }

    ctx.restore();
}

export function drawFloatingTexts(renderer, texts) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 2;
    ctx.translate(renderer.offsetX, renderer.offsetY);

    texts.forEach(ft => {
        const px = ft.x * TILE_SIZE + TILE_SIZE / 2;
        const py = ft.y * TILE_SIZE;

        ctx.fillStyle = ft.color;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, px, py);
        ctx.fillText(ft.text, px, py);
    });

    ctx.restore();
}

export function drawTinyNumber(renderer, x, y, num) {
    const ctx = renderer.ctx;
    const px = x * TILE_SIZE + TILE_SIZE - 4;
    const py = y * TILE_SIZE + TILE_SIZE - 4;

    ctx.save();
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'white';

    ctx.strokeText(num, px, py);
    ctx.fillText(num, px, py);
    ctx.restore();
}

export function drawProgressBar(renderer, x, y, percent) {
    const ctx = renderer.ctx;
    const px = x * TILE_SIZE + 4;
    const py = y * TILE_SIZE - 6;
    const w = TILE_SIZE - 8;
    const h = 4;

    ctx.fillStyle = 'black';
    ctx.fillRect(px, py, w, h);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(px + 1, py + 1, (w - 2) * percent, h - 2);
}

export function drawServiceTimer(renderer, x, y, percent) {
    const ctx = renderer.ctx;
    const halfTile = TILE_SIZE / 2;
    const cx = x * TILE_SIZE + halfTile;
    const cy = y * TILE_SIZE + halfTile;

    if (percent > 0.6) ctx.fillStyle = '#2ecc71';
    else if (percent > 0.3) ctx.fillStyle = '#f1c40f';
    else ctx.fillStyle = '#e74c3c';

    ctx.save();
    ctx.translate(renderer.offsetX, renderer.offsetY);
    ctx.beginPath();
    ctx.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.clip();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const endAngle = 1.5 * Math.PI;
    const startAngle = -0.5 * Math.PI + (1 - percent) * (2 * Math.PI);

    ctx.arc(cx, cy, TILE_SIZE, startAngle, endAngle);
    ctx.lineTo(cx, cy);
    ctx.fill();
    ctx.restore();
}

export function drawProgressTag(renderer, type, x, y, current, total, isError = false, yOffset = 0) {
    const ctx = renderer.ctx;
    if (isError) {
        renderer.drawTile(`${type}-tag-wrong.png`, x, y, yOffset);
        return;
    }
    if (current >= total) {
        renderer.drawTile(`${type}-tag-done.png`, x, y, yOffset);
        return;
    }

    if (type === 'burger' || type === 'side') {
        renderer.drawBoilTile(`plates/${type}-tag-outline-sheet.png`, x, y, yOffset);
    } else {
        renderer.drawTile(`${type}-tag-trans.png`, x, y, yOffset);
    }

    if (current > 0) {
        const pct = Math.min(current / total, 1.0);
        const layout = TAG_LAYOUTS[type] || { top: 0, bottom: 64 };
        const height = layout.bottom - layout.top;
        const fillHeight = height * pct;

        const gridPixelX = x * TILE_SIZE;
        const gridPixelY = y * TILE_SIZE + yOffset;
        const clipY = gridPixelY + layout.bottom - fillHeight;

        ctx.save();
        ctx.beginPath();
        ctx.rect(gridPixelX, clipY, TILE_SIZE, fillHeight);
        ctx.clip();
        renderer.drawTile(`${type}-tag-partial.png`, x, y, yOffset);
        ctx.restore();
    }
}

export function drawServiceHint(renderer, x, y, gameState, cellObject, yOffset = 0, ticketIndex = 0) {
    if (!gameState.activeTickets || gameState.activeTickets.length === 0) return;
    const ticket = gameState.activeTickets[ticketIndex];
    if (!ticket) return;

    const ctx = renderer.ctx;
    
    // Check if ticket uses Groups (New System) or is Legacy
    if (ticket.groups && ticket.groups.length > 0) {
        const group = ticket.groups[0];
        const containerType = group.containerType || 'bag';

        // 2. Validate Contents (if container exists on counter)
        let validation = { 
            containerMatch: false, 
            burgers: group.burgers.map(b => ({ req: b, matched: false })), 
            items: group.items.map(i => ({ req: i, matched: false })),
            extras: []
        };
        
        if (cellObject) {
            validation = ticket.getValidationDetails(cellObject);
        }

        // 3. Render Hooks
        if (containerType === 'plate') {
            ctx.save();
            const cx = x * TILE_SIZE + TILE_SIZE / 2;
            const cy = y * TILE_SIZE + TILE_SIZE / 2 + yOffset;
            ctx.translate(cx, cy);

            const baseX = -TILE_SIZE / 2;
            const baseY = -TILE_SIZE / 2;
            const burgerCount = validation.burgers.length;
            const sideCount = validation.items.filter(s => {
                const def = DEFINITIONS[s.req];
                return def && (def.category === 'side' || (def.orderConfig && def.orderConfig.type === 'side'));
            }).length;

            let innerScale = 0.55;
            let burgerX = - (TILE_SIZE * innerScale) + 4;
            const contentNudge = 8;
            let contentY = baseY - contentNudge;

            if (burgerCount === 1 && sideCount === 0) {
                innerScale = 0.7;
                burgerX = -(TILE_SIZE * innerScale) / 2;
            }

            const innerSize = TILE_SIZE * innerScale;

            // Burger Ghosts
            validation.burgers.forEach((b, idx) => {
                if (!b.matched) {
                    renderer.drawBoilTilePixels('plates/burger-outline-sheet.png', burgerX, contentY + 15, 3, false, innerSize, innerSize);
                }
            });

            // Side Ghosts
            validation.items.forEach((s, idx) => {
                if (!s.matched) {
                    const def = DEFINITIONS[s.req];
                    const isSide = def && (def.category === 'side' || (def.orderConfig && def.orderConfig.type === 'side'));
                    if (isSide) {
                        // This outline is already matched to the plate, draw at plate base
                        renderer.drawBoilTilePixels('plates/fries-outline-sheet.png', baseX, baseY, 3, false, TILE_SIZE, TILE_SIZE);
                    }
                }
            });

            // 1. Draw Container Outline LAST (layered on top)
            if (!validation.containerMatch) {
                renderer.drawBoilTilePixels('plates/plate-outline-sheet.png', baseX, baseY, 3, false);
            }

            ctx.restore();
        } else {
            // 1. Draw Takeout Bag Outline
            if (!validation.containerMatch) {
                renderer.drawBoilTile('plates/bag-outline-sheet.png', x, y, yOffset);
            }
            
            // Bag/Standard Rendering: Uses progress tags
            const bMatched = validation.burgers.filter(b => b.matched).length;
            const bTotal = validation.burgers.length;
            const sMatched = validation.items.filter(i => i.matched).length;
            const sTotal = validation.items.length;
            const hasExtra = validation.extras.length > 0;

            if (bTotal > 0) {
                drawProgressTag(renderer, 'burger', x, y, bMatched, bTotal, hasExtra, yOffset);
            }
            if (sTotal > 0) {
                drawProgressTag(renderer, 'side', x, y, sMatched, sTotal, hasExtra, yOffset);
            }
        }
    } else {

        // Legacy Recipe Support
        const recipe = ticket.recipe;
        if (!recipe) return;

        let bMatched = 0, bTotal = 0;
        let sMatched = 0, sTotal = 0;
        let hasExtra = false;

        if (cellObject && cellObject.type === 'Composite') {
            const burger = cellObject;
            if (recipe.burger) {
                bTotal = recipe.burger.toppings.length + 1;
                if (burger.state.bun) bMatched++;
                recipe.burger.toppings.forEach(top => {
                    if (burger.state.toppings.some(t => (typeof t === 'string' && t === top) || (t.definitionId === top))) {
                        bMatched++;
                    }
                });
                if (burger.state.toppings.length > recipe.burger.toppings.length) hasExtra = true;
            }
        }

        if (cellObject && cellObject.definition && cellObject.definition.category === 'side_prep') {
            if (recipe.side && cellObject.definitionId === recipe.side) {
                sMatched = 1; sTotal = 1;
            }
        }

        if (bTotal > 0) drawProgressTag(renderer, 'burger', x, y, bMatched, bTotal, hasExtra, yOffset);
        if (sTotal > 0) drawProgressTag(renderer, 'side', x, y, sMatched, sTotal, hasExtra, yOffset);
    }
}

export function drawPauseButton(renderer, gameState) {
    const ctx = renderer.ctx;
    const canvas = renderer.canvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    const x = 20, y = 20, size = 40;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, size, size, 5);
    else ctx.rect(x, y, size, size);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    if (gameState.gameState === 'PAUSED') {
        ctx.beginPath();
        ctx.moveTo(x + 15, y + 10); ctx.lineTo(x + 30, y + 20); ctx.lineTo(x + 15, y + 30);
        ctx.closePath(); ctx.fill();
    } else {
        ctx.fillRect(x + 13, y + 12, 5, 16);
        ctx.fillRect(x + 22, y + 12, 5, 16);
    }
    ctx.restore();
    renderer.pauseButtonRect = { x: x, y: y, width: size, height: size };
}



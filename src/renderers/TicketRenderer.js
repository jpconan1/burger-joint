import { ASSETS, TILE_SIZE } from '../constants.js';

export function drawOrderTickets(renderer, orders, pickUpKey, penalty, menuItems) {
    const ctx = renderer.ctx;
    const canvas = renderer.canvas;
    const assetLoader = renderer.assetLoader;

    const ticketImg = assetLoader.get(ASSETS.UI.ORDER_TICKET);
    if (!ticketImg) return;

    ctx.save();
    // 1. Darken Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Setup Layout
    const scale = 2.0;
    const ticketW = ticketImg.width * scale;
    const ticketH = ticketImg.height * scale;
    const spacingX = 20;
    const spacingY = 20;

    const maxPerRow = 6;
    const totalW = Math.min(orders.length, maxPerRow) * (ticketW + spacingX) - spacingX;

    let startX = (canvas.width - totalW) / 2;
    let startY = 100;

    // 3. Draw Each Ticket
    orders.forEach((order, index) => {
        const col = index % maxPerRow;
        const row = Math.floor(index / maxPerRow);

        const x = startX + col * (ticketW + spacingX);
        const y = startY + row * (ticketH + spacingY);

        const angle = (Math.sin(index * 997) * 0.1);
        const offsetY = Math.cos(index * 457) * 10;

        drawSingleTicket(renderer, ticketImg, x, y + offsetY, ticketW, ticketH, angle, order);
    });

    const displayKey = pickUpKey ? pickUpKey.replace('Key', '').replace('Digit', '') : '???';

    if (orders.length === 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Press [${displayKey}] to finish day!`, canvas.width / 2, canvas.height / 2);
    } else {
        ctx.fillStyle = '#ffaaaa';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(`Press [${displayKey}] to end day.`, canvas.width / 2, canvas.height - 40);
    }

    if (menuItems && menuItems.length > 0) {
        ctx.fillStyle = '#ddd';
        ctx.font = '16px Monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        const sX = 20;
        let sY = canvas.height - 20;

        ctx.fillText("Available Items:", sX, sY - (menuItems.length * 20) - 5);

        menuItems.forEach((item, index) => {
            ctx.fillText(`- ${item}`, sX, sY - ((menuItems.length - 1 - index) * 20));
        });
    }

    ctx.restore();
}

export function drawSingleTicket(renderer, img, x, y, w, h, angle, order) {
    const ctx = renderer.ctx;
    ctx.save();

    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.translate(-cx, -cy);

    ctx.drawImage(img, x, y, w, h);

    ctx.fillStyle = '#000';
    ctx.font = '14px Monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const padding = 15;
    ctx.fillText(`#${order.id}`, cx, y + padding);

    ctx.font = '12px Monospace';
    ctx.textAlign = 'left';

    const leftMargin = x + 25;
    let textY = y + padding + 25;

    if (order.items) {
        order.items.forEach(item => {
            ctx.fillText(item, leftMargin, textY);
            textY += 14;
        });
    }

    ctx.restore();
}

export function drawHangingTickets(renderer, gameState) {
    const ctx = renderer.ctx;
    const assetLoader = renderer.assetLoader;

    if (!gameState.activeTickets || gameState.activeTickets.length === 0) return;

    gameState.activeTickets.forEach((ticket, i) => {
        const icons = ticket.getDisplayIcons();
        const hasSide = icons.some(ic => ic.type === 'side' || ic.type === 'drink');
        const hasMod  = icons.some(ic => ic.type === 'mod');

        let ticketAssetKey;
        if (hasSide && hasMod)  ticketAssetKey = ASSETS.UI.BIG_TICKET_MOD;
        else if (hasMod)        ticketAssetKey = ASSETS.UI.MEDIUM_TICKET_MOD;
        else if (hasSide)       ticketAssetKey = ASSETS.UI.MEDIUM_TICKET;
        else                    ticketAssetKey = ASSETS.UI.SMALL_TICKET;

        const ticketImg = assetLoader.get(ticketAssetKey);
        if (!ticketImg) return;

        const x = (2 + i) * TILE_SIZE;
        const y = 0;

        ctx.drawImage(ticketImg, x, y);

        // Slot y-positions based on how many slots this ticket has
        let burgerSlotY, sideSlotY, modSlotY;
        if (hasSide && hasMod) {
            burgerSlotY = y + 21;
            sideSlotY   = y + 58;
            modSlotY    = y + 92;
        } else if (hasSide) {
            burgerSlotY = y + 21;
            sideSlotY   = y + 58;
        } else if (hasMod) {
            burgerSlotY = y + 21;
            modSlotY    = y + 58;
        } else {
            burgerSlotY = y + 21;
        }

        const toppingOffsetPerLayer = -4;
        const pattyExtraOffset = 6;
        const iconSize = 32;
        const iconOx = x + 16 - 2;

        // --- Pass 1: Sharp outline via cached black silhouette (no CSS filter) ---
        const burgerIcons = icons.filter(ic => ic.type === 'patty' || ic.type === 'topping');
        if (burgerIcons.length > 0 && !ticket._outlineCache) {
            const stackDepth = (burgerIcons.length - 1) * Math.abs(toppingOffsetPerLayer);
            const off = document.createElement('canvas');
            off.width = iconSize;
            off.height = iconSize + stackDepth + pattyExtraOffset;
            const offCtx = off.getContext('2d');
            let allLoaded = true;
            burgerIcons.forEach((icon, idx) => {
                const img = assetLoader.get(icon.texture);
                if (!img) { allLoaded = false; return; }
                const extra = icon.type === 'patty' ? pattyExtraOffset : 0;
                offCtx.drawImage(img, 0, stackDepth + (idx * toppingOffsetPerLayer) + extra, iconSize, iconSize);
            });
            if (allLoaded) {
                offCtx.globalCompositeOperation = 'source-in';
                offCtx.fillStyle = 'black';
                offCtx.fillRect(0, 0, off.width, off.height);
                ticket._outlineCache = { canvas: off, stackDepth };
            }
        }
        if (ticket._outlineCache) {
            const { canvas: outline, stackDepth } = ticket._outlineCache;
            const outOx = iconOx;
            const outOy = burgerSlotY - stackDepth;
            const thickness = 3;
            [
                { dx: thickness, dy: 0 }, { dx: -thickness, dy: 0 },
                { dx: 0, dy: thickness }, { dx: 0, dy: -thickness },
                { dx: thickness, dy: thickness }, { dx: -thickness, dy: thickness },
                { dx: thickness, dy: -thickness }, { dx: -thickness, dy: -thickness }
            ].forEach(({ dx, dy }) => ctx.drawImage(outline, outOx + dx, outOy + dy));
        }

        // --- Pass 2: Render all icons ---
        let burgerStackIndex = 0;
        icons.forEach(icon => {
            const img = assetLoader.get(icon.texture);
            if (!img) return;

            if (icon.type === 'patty' || icon.type === 'topping') {
                const extra = icon.type === 'patty' ? pattyExtraOffset : 0;
                const oy = burgerSlotY + (burgerStackIndex * toppingOffsetPerLayer) + extra;
                ctx.drawImage(img, iconOx, oy, iconSize, iconSize);
                burgerStackIndex++;
            } else if (icon.type === 'side' || icon.type === 'drink') {
                ctx.drawImage(img, iconOx, sideSlotY, iconSize, iconSize);
            } else if (icon.type === 'mod') {
                // Draw removed topping icon with a red X over it
                ctx.drawImage(img, iconOx, modSlotY, iconSize, iconSize);
                ctx.save();
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(iconOx + 4, modSlotY + 4);
                ctx.lineTo(iconOx + 28, modSlotY + 28);
                ctx.moveTo(iconOx + 28, modSlotY + 4);
                ctx.lineTo(iconOx + 4, modSlotY + 28);
                ctx.stroke();
                ctx.restore();
            }
        });
    });
}

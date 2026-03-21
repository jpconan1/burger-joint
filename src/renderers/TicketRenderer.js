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

    const ticketImg = assetLoader.get(ASSETS.UI.NEW_TICKET);
    if (!ticketImg) return;

    if (gameState.activeTickets && gameState.activeTickets.length > 0) {
        gameState.activeTickets.forEach((ticket, i) => {
            const x = (2 + i) * TILE_SIZE;
            const y = 0;

            ctx.drawImage(ticketImg, x, y);

            const icons = ticket.getDisplayIcons();
            const size = TILE_SIZE;
            const ox = x;
            const oy = y + 17;

            icons.forEach(icon => {
                const img = assetLoader.get(icon.texture);
                if (!img) return;

                if (icon.type === 'patty' || icon.type === 'topping') {
                    ctx.drawImage(img, ox, oy, size, size);
                } else if (icon.type === 'side' || icon.type === 'drink') {
                    const sideSize = 48;
                    const sox = x + (TILE_SIZE - sideSize) / 2;
                    const soy = y + 57;
                    ctx.drawImage(img, sox, soy, sideSize, sideSize);
                }
            });
        });
    }
}

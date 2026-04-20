import { ASSETS } from '../constants.js';
import { ACTIONS, ALT_BINDINGS } from '../systems/Settings.js';

export function renderTitleScreen(renderer, selection = 0) {
    const ctx = renderer.ctx;
    const canvas = renderer.canvas;
    const assetLoader = renderer.assetLoader;

    // Ensure fullscreen
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        renderer.resizeCanvas();
    }

    const bgImg = assetLoader.get(ASSETS.UI.CRUMPLED_PAPER_BACKGROUND);
    if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#e1d2d2'; // Fallback to light paper color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Title
    ctx.save();
    const centerX = canvas.width / 2;
    const titleY = canvas.height / 3 - 40;

    ctx.translate(centerX, titleY);
    ctx.rotate(-5 * Math.PI / 180); // Slight tilt

    ctx.font = '900 80px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2; // Fix spikes

    // Stroke
    ctx.lineWidth = 42; // SUPER THICK
    ctx.strokeStyle = '#000';
    ctx.strokeText('BURGER JOINT!', 0, 0);

    // Fill
    ctx.fillStyle = '#fff';
    ctx.fillText('BURGER JOINT!', 0, 0);

    ctx.restore();

    // Options
    ctx.font = '900 40px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 28;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';

    const startY = canvas.height / 2 + 30; // Push down a bit
    const spacing = 60;

    const options = ['New Game', 'Settings'];

    options.forEach((opt, index) => {
        const y = startY + (index * spacing);
        const isSelected = (selection === index);

        ctx.strokeText(opt, centerX, y);

        ctx.fillStyle = isSelected ? '#00FF7F' : '#fff'; // Spring Green if selected
        ctx.fillText(opt, centerX, y);
    });

    // Controls hint
    ctx.font = '900 18px "Inter", sans-serif';
    ctx.lineWidth = 12;
    ctx.fillStyle = '#fff';

    const hintY = canvas.height - 40;
    const hintText1 = 'WASD / Arrows to Navigate';
    const hintText2 = 'ENTER / SPACE to Select';

    ctx.strokeText(hintText1, centerX, hintY - 25);
    ctx.fillText(hintText1, centerX, hintY - 25);

    ctx.strokeText(hintText2, centerX, hintY);
    ctx.fillText(hintText2, centerX, hintY);
}

export function renderSettingsMenu(renderer, state, settings) {
    const ctx = renderer.ctx;
    const canvas = renderer.canvas;
    const assetLoader = renderer.assetLoader;

    // Ensure fullscreen
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        renderer.resizeCanvas();
    }

    // state: { selectedIndex, rebindingAction }
    const bgImg = assetLoader.get(ASSETS.UI.CRUMPLED_PAPER_BACKGROUND);
    if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#e1d2d2';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';

    ctx.font = '32px Arial';
    ctx.fillText('Controls', canvas.width / 2, 50);

    // 1. Audio Settings
    ctx.textAlign = 'left';
    ctx.font = '24px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText("Audio", 100, 100);

    const audioOptions = [
        { label: 'Music', key: 'musicEnabled' },
        { label: 'SFX', key: 'sfxEnabled' }
    ];

    let currentY = 140;
    const rowHeight = 40;

    audioOptions.forEach((opt, index) => {
        const isSelected = (state.selectedIndex === index);
        const val = settings.preferences[opt.key];

        if (isSelected) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(100, currentY - 25, canvas.width - 200, rowHeight);
            ctx.fillStyle = '#d35400';
        } else {
            ctx.fillStyle = '#444';
        }

        ctx.font = '20px Monospace';
        ctx.fillText(opt.label, 120, currentY);

        ctx.textAlign = 'right';
        const statusText = val ? "ON" : "OFF";
        ctx.fillStyle = val ? '#27ae60' : '#c0392b';
        ctx.fillText(statusText, canvas.width - 120, currentY);

        ctx.textAlign = 'left';
        currentY += rowHeight;
    });

    // 2. Key Bindings
    currentY += 20;
    ctx.font = '24px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText("Key Bindings", 100, currentY);
    currentY += 40;

    const bindings = settings.bindings;
    const displayOrder = [
        'MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT',
        'INTERACT', 'PICK_UP', 'VIEW_ORDERS',
        'EQUIP_1', 'EQUIP_2', 'EQUIP_3', 'EQUIP_4'
    ];

    ctx.font = '20px Monospace';

    displayOrder.forEach((action, i) => {
        const globalIndex = i + 2;
        const isSelected = (state.selectedIndex === globalIndex);
        const isRebinding = (action === state.rebindingAction);

        const y = currentY;

        if (isSelected) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(100, y - 25, canvas.width - 200, rowHeight);
            ctx.fillStyle = '#d35400';
        } else {
            ctx.fillStyle = '#444';
        }

        let niceName = action.replace(/_/g, ' ');
        if (action === 'VIEW_ORDERS') niceName = 'SHOW TICKET';
        ctx.fillText(niceName, 120, y);

        ctx.textAlign = 'right';
        let keyParams = bindings[action];
        if (isRebinding) {
            ctx.fillStyle = '#27ae60';
            ctx.fillText('PRESS KEY...', canvas.width - 120, y);
        } else {
            let displayKey = keyParams ? keyParams.replace('Key', '').replace('Digit', '') : '???';
            ctx.fillText(displayKey, canvas.width - 120, y);
        }
        ctx.textAlign = 'left';

        currentY += rowHeight;
    });

    // 3. Alternate Controls (Read Only)
    currentY += 20;
    ctx.fillStyle = '#333';
    ctx.font = '24px Arial';
    ctx.fillText("Alternative Controls", 100, currentY);
    currentY += 30;

    Object.keys(ALT_BINDINGS).forEach((action, i) => {
        const key = ALT_BINDINGS[action].replace('Key', '').replace('Arrow', '');
        let niceName = action.replace(/_/g, ' ');
        if (action === 'VIEW_ORDERS') niceName = 'SHOW TICKET';

        ctx.font = '16px Monospace';
        ctx.fillStyle = '#666';
        ctx.fillText(niceName, 120, currentY);

        ctx.textAlign = 'right';
        ctx.fillText(key, canvas.width - 120, currentY);
        ctx.textAlign = 'left';

        currentY += 25;
    });

    // Instructions
    ctx.textAlign = 'center';
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.fillText('Use Arrows/WASD to Navigate. ENTER to Rebind. ESC to Back.', canvas.width / 2, canvas.height - 30);
}

export function renderPauseScreen(renderer, gameState) {
    const ctx = renderer.ctx;
    const canvas = renderer.canvas;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Screen space

    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // PAUSED Text
    ctx.font = 'bold 72px Arial';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.strokeText('PAUSED', canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 40);

    // Subtext
    ctx.font = '24px Arial';
    const resumeText = `Press ESC or Click anywhere to Resume`;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(resumeText, canvas.width / 2, canvas.height / 2 + 40);
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(resumeText, canvas.width / 2, canvas.height / 2 + 40);

    ctx.restore();
}


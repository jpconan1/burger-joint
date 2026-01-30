
export class TouchInputSystem {
    constructor(game) {
        this.game = game;
        this.activeKeys = new Set();
        this.init();
    }

    init() {
        // Create Overlay Container
        const container = document.createElement('div');
        container.id = 'touch-controls';

        // --- D-PAD ---
        const dpadContainer = document.createElement('div');
        dpadContainer.className = 'dpad-container';

        dpadContainer.appendChild(this.createButton('up', '▲', 'KeyW', ['dpad', 'up']));
        dpadContainer.appendChild(this.createButton('down', '▼', 'KeyS', ['dpad', 'down']));
        dpadContainer.appendChild(this.createButton('left', '◀', 'KeyA', ['dpad', 'left']));
        dpadContainer.appendChild(this.createButton('right', '▶', 'KeyD', ['dpad', 'right']));

        container.appendChild(dpadContainer);

        // --- ACTIONS ---
        const actionContainer = document.createElement('div');
        actionContainer.className = 'action-container';

        // Interact (Primary)
        actionContainer.appendChild(this.createButton('interact', 'ENT', 'Enter', ['action-primary']));
        // Pickup (Secondary)
        actionContainer.appendChild(this.createButton('pickup', 'SP', 'Space', ['action-secondary']));

        container.appendChild(actionContainer);

        // --- CORNERS ---
        // Back / Menu
        container.appendChild(this.createButton('back', 'Esc', 'Escape', ['top-left']));
        // View Orders
        container.appendChild(this.createButton('view', 'View', 'KeyV', ['top-right']));

        // --- ZOOM SLIDER ---
        const zoomContainer = document.createElement('div');
        zoomContainer.className = 'zoom-container';
        zoomContainer.style.position = 'absolute';
        zoomContainer.style.top = '20px';
        zoomContainer.style.left = '50%';
        zoomContainer.style.transform = 'translateX(-50%)';
        zoomContainer.style.display = 'flex';
        zoomContainer.style.flexDirection = 'column';
        zoomContainer.style.alignItems = 'center';
        zoomContainer.style.pointerEvents = 'auto'; // Enable interaction

        const zoomLabel = document.createElement('span');
        zoomLabel.innerText = '🔍';
        zoomLabel.style.fontSize = '20px';
        zoomLabel.style.marginBottom = '5px';
        zoomLabel.style.color = 'white';
        zoomLabel.style.textShadow = '1px 1px 2px black';

        const zoomSlider = document.createElement('input');
        zoomSlider.type = 'range';
        zoomSlider.min = '1';
        zoomSlider.max = '5';
        zoomSlider.step = '1';
        zoomSlider.value = '3'; // Default 1.0 (index 3)
        zoomSlider.style.width = '120px'; // Wide enough for fingers

        // Define steps: 0.5, 0.75, 1.0, 1.25, 1.5
        const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5];

        zoomSlider.addEventListener('input', (e) => {
            const index = parseInt(e.target.value) - 1;
            const level = zoomLevels[index];
            if (this.game.renderer) {
                this.game.renderer.setZoom(level);
            }
        });

        // Prevent touch drag on sliding from moving the page or triggering other things
        zoomSlider.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

        zoomContainer.appendChild(zoomLabel);
        zoomContainer.appendChild(zoomSlider);
        container.appendChild(zoomContainer);

        document.body.appendChild(container);

        // Force display for testing if needed (uncomment to force on desktop)
        // container.style.display = 'block'; 

        // Simple heuristic: If we detect touch capability, ensure it's visible. 
        // Logic handles in CSS media query mostly, but we can force it here.
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            container.style.display = 'block';
        }
    }

    createButton(id, label, key, classes = []) {
        const btn = document.createElement('div');
        btn.className = `touch-btn ${classes.join(' ')}`;
        btn.innerText = label;
        btn.dataset.key = key;

        // Touch Handlers
        const handleStart = (e) => {
            e.preventDefault(); // Stop mouse emulation / scrolling
            e.stopPropagation();
            if (!this.activeKeys.has(key)) {
                this.activeKeys.add(key);
                btn.classList.add('active');
                this.simulateKey(key, 'keydown');
            }
        };

        const handleEnd = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.activeKeys.has(key)) {
                this.activeKeys.delete(key);
                btn.classList.remove('active');
                this.simulateKey(key, 'keyup');
            }
        };

        btn.addEventListener('touchstart', handleStart, { passive: false });
        btn.addEventListener('touchend', handleEnd, { passive: false });
        btn.addEventListener('touchcancel', handleEnd, { passive: false });

        // Mouse Fallback for testing on Desktop
        btn.addEventListener('mousedown', handleStart);
        btn.addEventListener('mouseup', handleEnd);
        btn.addEventListener('mouseleave', handleEnd);

        return btn;
    }

    simulateKey(code, type) {
        // We dispatch to window because Game.js listens on window
        const event = new KeyboardEvent(type, {
            code: code,
            key: code, // Simplification
            bubbles: true,
            cancelable: true
        });
        window.dispatchEvent(event);
    }
}

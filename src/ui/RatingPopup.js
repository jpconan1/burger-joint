
import { ASSETS } from '../constants.js';

export class RatingPopup {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.startTime = 0;
        this.stars = 0;
        this.breakdown = [];
        this.dismissed = false;
    }

    show(stars, breakdown) {
        // Ensure we don't show it again if already dismissed for this "session" (though usually day ends)
        if (this.isVisible) return;

        this.isVisible = true;
        this.dismissed = false;
        this.stars = stars;
        this.breakdown = breakdown || [false, false, false, false, false];
        this.startTime = Date.now();
    }

    hide() {
        this.isVisible = false;
        this.dismissed = true;
    }

    isAnimating() {
        if (!this.isVisible) return false;
        const elapsed = Date.now() - this.startTime;
        const animationDuration = 5 * 1000 + 1000; // 5 stars * 1000ms + buffer
        return elapsed < animationDuration;
    }

    handleInput(event, settings, actions) {
        if (!this.isVisible) return false;

        // Block input during animation
        if (this.isAnimating()) return true; // Consumed

        // Wait for Interaction/Any Key to dismiss
        if (event.code === 'Enter' || event.code === 'Space' || event.code === 'Escape' || event.code === settings.getBinding(actions.INTERACT)) {
            console.log("Rating Popup Dismissed");
            this.hide();
            return true; // Consumed
        }

        return true; // Block other inputs while visible
    }

    render(ctx, assetLoader) {
        if (!this.isVisible) return;

        const elapsed = Date.now() - this.startTime;

        // 1. Darken Screen (Fade In)
        // We handle the "overlay" darkening here specifically for the popup.
        // The game loop might handle environment lighting separately, but this is the UI overlay background.
        const fade = Math.min(elapsed / 1000, 0.7);
        const canvas = ctx.canvas;

        ctx.save();
        // Reset transform to draw in screen space (UI)
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Breakdown Data
        const starMessages = [
            "Perfect Day Required!",
            "Need 2+ Burgers on Menu",
            "Need a Side or Drink",
            "Menu Complexity 15+ Required",
            "Menu Complexity 30+ Required"
        ];

        const starSize = 48;
        const rowHeight = 100; // Spacing between rows
        const centerX = canvas.width / 2;
        const startY = (canvas.height / 2) - (2.5 * rowHeight) + 50;

        // 3. Draw Rows
        this.breakdown.forEach((earned, index) => {
            const appearTime = index * 1000;
            if (elapsed < appearTime) return;

            const y = startY + index * rowHeight;

            // Draw Star
            const texName = earned ? ASSETS.UI.STAR_FILLED : ASSETS.UI.STAR_EMPTY;
            const img = assetLoader.get(texName);
            if (img) {
                // Draw centered horizontally
                ctx.drawImage(img, centerX - starSize / 2, y, starSize, starSize);
            }

            // Draw Text (if failed)
            if (!earned) {
                ctx.font = '900 24px "Inter", sans-serif';
                ctx.textAlign = 'center';

                // White Outline
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 4;
                ctx.strokeText(starMessages[index], centerX, y + starSize + 30);

                // Text Fill
                ctx.fillStyle = '#ff0000'; // Red
                ctx.fillText(starMessages[index], centerX, y + starSize + 30);
            }
        });

        // 4. Interaction Prompt (after animation)
        const animationFinished = elapsed > (5 * 1000 + 1000);
        if (animationFinished) {
            ctx.fillStyle = '#888';
            ctx.font = '16px "Inter", sans-serif';
            ctx.textAlign = 'center';
            // Blink
            if (Math.floor(Date.now() / 500) % 2 === 0) {
                ctx.fillText("Press INTERACT to Continue", centerX, canvas.height - 50);
            }
        }

        ctx.restore();
    }
}

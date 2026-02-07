
# Alert System Guide

This system handles popups using a "9-slice" scaling technique with support for "line boil" animations.

## Sprite Sheet Template

To create the visual style for the popups, you need to create a sprite sheet image.

**Recommended File Name:** `src/assets/ui/alert_window_sheet.png` (Make sure to update `style.css` if you change this path).

### Layout
The image should be a **vertical strip** of 3 frames.
Each frame is a **3x3 grid** of slices.

**Dimensions (assuming 64x64px corners):**
- **Total Image Width:** 192px (64px * 3 cols)
- **Total Image Height:** 576px (192px per frame * 3 frames)

### Frame Structure (Vertical)

**Frame 1 (Top 0px - 192px):**
```
[TL][TC][TR]  <- Top Row (64px high)
[ML][MC][MR]  <- Middle Row (64px high)
[BL][BC][BR]  <- Bottom Row (64px high)
```
*   **TL, TR, BL, BR:** Corners. These are 64x64px and do not stretch.
*   **TC, BC:** Top/Bottom Edges. These repeat horizontally.
*   **ML, MR:** Left/Right Edges. These repeat vertically.
*   **MC:** Center. This repeats in both directions to fill the box.

**Frame 2 (Top 192px - 384px):**
Same 3x3 grid, but slightly redrawn for the "boil" effect.

**Frame 3 (Top 384px - 576px):**
Same 3x3 grid, redrawn again.

## Configuration

Edit `src/data/alerts.js` to define new popups.

```javascript
export const ALERTS = {
    'my_popup_id': {
        frames: [
            {
                text: "Hello World!",
                position: 'center', // or { top: '10%', right: '10%' }
                size: { width: '300px', height: '100px' },
                next: 'next_popup_id' // Optional: chain to another popup
            },
            {
                text: "Second page of text...",
                position: 'center',
                size: { width: '300px', height: '100px' }
            }
        ]
    }
};
```

## Usage in Code

In `Game.js` or any system:
```javascript
this.game.alertSystem.trigger('my_popup_id');
```

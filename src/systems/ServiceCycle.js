import { SCORING_CONFIG } from '../data/scoringConfig.js';
import { ASSETS } from '../constants.js';
import { ItemInstance } from '../entities/Item.js';
import { CHUTE_TRIGGERS } from '../data/chute_triggers.js';

export class ServiceCycle {
    constructor(game) {
        this.game = game;
    }

    update(dt) {
        this.updateServiceCycle(dt);
        this.updateAppliances(dt);
    }

    getCurrentTicketInterval(cyclePos) {
        const config = SCORING_CONFIG.GAME_PACING;
        const halfCycle = config.HALF_CYCLE_DURATION;
        const peakWidth = config.PEAK_WIDTH;

        const dayPeak = halfCycle * config.DAY_PEAK_TIME_RATIO;
        const nightPeak = halfCycle + (halfCycle * config.NIGHT_PEAK_TIME_RATIO);

        const dayIntensity = config.DAY_PEAK_INTENSITY * Math.exp(-Math.pow(cyclePos - dayPeak, 2) / (2 * Math.pow(peakWidth, 2)));
        const nightIntensity = config.NIGHT_PEAK_INTENSITY * Math.exp(-Math.pow(cyclePos - nightPeak, 2) / (2 * Math.pow(peakWidth, 2)));

        const intensity = Math.max(dayIntensity, nightIntensity);
        const baseInterval = config.SLOW_TICKET_INTERVAL - (intensity * (config.SLOW_TICKET_INTERVAL - config.FAST_TICKET_INTERVAL));

        return baseInterval / (1.0 + this.game.ticketSpeedBonus);
    }

    updateServiceCycle(dt) {
        const g = this.game;
        if (!g.isDayActive || g.timeFreezeTimer > 0) return;

        // Day/Night cycle
        if (!g.isPrepTime) {
            g.dayTimer += dt / 1000;
            const halfCycle = SCORING_CONFIG.GAME_PACING.HALF_CYCLE_DURATION;
            const fullCycle = halfCycle * 2;
            const cyclePos = g.dayTimer % fullCycle;

            if (cyclePos <= halfCycle) {
                g.lightingIntensity = 0;
                if (g.currentShift !== 'DAY') {
                    g.currentShift = 'DAY';
                    g.shiftCount++;
                }
            } else {
                if (g.currentShift !== 'NIGHT') {
                    g.currentShift = 'NIGHT';
                    g.shiftCount++;
                }
                const nightElapsed = cyclePos - halfCycle;
                const nightProgress = nightElapsed / halfCycle;
                const peakRatio = SCORING_CONFIG.GAME_PACING.NIGHT_PEAK_TIME_RATIO;

                if (nightProgress <= peakRatio) {
                    g.lightingIntensity = nightProgress / peakRatio;
                } else {
                    const remaining = 1.0 - peakRatio;
                    const progressPastPeak = nightProgress - peakRatio;
                    g.lightingIntensity = 1.0 - (progressPastPeak / remaining);
                }
            }

            // Ticket spawning
            g.ticketSpawnTimer += dt / 1000;
            const freq = this.getCurrentTicketInterval(cyclePos);
            g.timeToNextTicket = Math.max(0, freq - g.ticketSpawnTimer);

            if (g.ticketSpawnTimer >= freq) {
                g.ticketSpawnTimer = 0;
                let newTicket;
                if (g.dayNumber === 1 && g.ticketsGeneratedToday < 5) {
                    newTicket = g.orderSystem.generateTutorialTicket(g.ticketsGeneratedToday + 1);
                } else {
                    newTicket = g.orderSystem.createTicketFromCustomers(
                        [g.orderSystem.generateCustomerProfile(g.menuSystem.getMenu())],
                        g.ticketsGeneratedToday + 1
                    );
                }
                newTicket.calculateParTime();
                g.ticketsGeneratedToday++;
                g.ticketQueue.push(newTicket);
                console.log("New Ticket Generated via Continuous Spawner");
            }
        }

        // Prep time countdown
        if (g.isPrepTime) {
            g.prepTime -= dt / 1000;
            if (g.prepTime <= 0) {
                g.isPrepTime = false;
                g.prepTime = 0;
                g.ticketTimer = 10000;
                console.log("Prep Time Over! Service starting...");
            }
        } else {
            g.ticketTimer += dt;
        }

        // Start printing next ticket
        if (g.ticketTimer >= 2000 && !g.incomingTicket && g.ticketQueue.length > 0) {
            g.ticketTimer = 0;
            g.incomingTicket = g.ticketQueue.shift();
            g.printingTimer = 0;

            if (g.incomingTicket.chuteDrop && g.incomingTicket.chuteDrop.length > 0) {
                g.incomingTicket.chuteDrop.forEach(itemId => {
                    this.dropInChute(new ItemInstance(itemId));
                });
            }

            g.audioSystem.playSFX(ASSETS.AUDIO.PRINTER);

            if (!g.testAlertShown) {
                g.alertSystem.trigger('test_alert');
                g.testAlertShown = true;
            }
            console.log("Ticket started printing...");
        }

        // Ticket arrives on wheel after printing animation
        if (g.incomingTicket) {
            g.printingTimer += dt;
            if (g.printingTimer >= 2250) {
                g.activeTickets.push(g.incomingTicket);
                g.serviceTimer += g.incomingTicket.parTime;
                g.orders = g.activeTickets.map(t => t.toDisplayFormat());
                console.log("Ticket arrived on wheel!");
                g.incomingTicket = null;
            }
        }

        g.activeTickets.forEach(t => t.elapsedTime += dt / 1000);

        // Stability drain
        if (g.activeTickets.length > 0) {
            let drainRate = 0;
            const count = g.activeTickets.length;
            if (count <= 1) drainRate = 0.2;
            else if (count === 2) drainRate = 0.6;
            else if (count === 3) drainRate = 1.0;
            else drainRate = 2.0 + (count - 4);

            if (g.timeFreezeTimer <= 0) {
                g.stability -= (drainRate * (dt / 1000));
            }

            if (g.stability <= 0 && !g.timeoutAlertShown) {
                g.timeoutAlertShown = true;
                g.currentDayPerfect = false;
                g.audioSystem.stopMusic();
                g.audioSystem.playSFX(ASSETS.AUDIO.DEATH_JINGLE);
                g.alertSystem.trigger('ticket_timeout');
            }
        } else if (g.ticketQueue.length > 0) {
            g.stability = Math.min(g.stability + (5 * (dt / 1000)), 100);
        } else {
            g.stability = Math.min(g.stability + (10 * (dt / 1000)), 100);
        }
    }

    updateAppliances(dt) {
        const g = this.game;
        Object.values(g.rooms).forEach(room => {
            if (!room) return;
            for (let y = 0; y < room.height; y++) {
                for (let x = 0; x < room.width; x++) {
                    const cell = room.getCell(x, y);
                    if (!cell) continue;

                    // Grill
                    if (cell.type.id === 'GRILL') {
                        const item = cell.object;
                        if (item && item.definition.cooking && item.definition.cooking.stages) {
                            const currentStage = item.state.cook_level || 'raw';
                            const stageDef = item.definition.cooking.stages[currentStage];
                            if (stageDef && g.timeFreezeTimer <= 0) {
                                item.state.cookingProgress = (item.state.cookingProgress || 0) + dt;
                                const requiredTime = stageDef.duration || cell.state.cookingSpeed || 2000;
                                if (item.state.cookingProgress >= requiredTime) {
                                    item.state.cook_level = stageDef.next;
                                    item.state.cookingProgress = 0;
                                }
                            }
                        }
                    }

                    // Fryer
                    if (cell.type.id === 'FRYER' && cell.state) {
                        if (cell.state.status === 'down' && g.timeFreezeTimer <= 0) {
                            cell.state.timer = (cell.state.timer || 0) + dt;
                            let max = cell.state.cookingSpeed || 2000;
                            if (cell.object && cell.object.definition && cell.object.definition.cooking) {
                                const stage = cell.object.state.cook_level || 'raw';
                                const stageDef = cell.object.definition.cooking.stages[stage];
                                if (stageDef && stageDef.duration) max = stageDef.duration;
                            }
                            if (cell.state.timer >= max) {
                                cell.state.status = 'done';
                                cell.state.timer = 0;
                            }
                        }
                        const item = cell.object;
                        if (item && item.definition.cooking && item.definition.cooking.stages) {
                            const currentStage = item.state.cook_level || 'raw';
                            const stageDef = item.definition.cooking.stages[currentStage];
                            if (stageDef && stageDef.cookMethod === 'fry' && g.timeFreezeTimer <= 0) {
                                item.state.cookingProgress = (item.state.cookingProgress || 0) + dt;
                                const requiredTime = stageDef.duration || 2000;
                                if (item.state.cookingProgress >= requiredTime) {
                                    item.state.cook_level = stageDef.next;
                                    item.state.cookingProgress = 0;
                                }
                            }
                        }
                    }

                    // Dishwasher
                    if (cell.type.id === 'DISHWASHER' && cell.state) {
                        if (cell.state.status === 'washing') {
                            if (g.timeFreezeTimer <= 0) {
                                cell.state.timer = (cell.state.timer || 0) - dt;
                            }
                            if (cell.state.timer <= 0) {
                                const count = cell.state.dishCount || 0;
                                const boardRows = cell.state.boardRows || [];
                                cell.state.status = 'idle';
                                cell.state.dishCount = 0;
                                cell.state.boardRows = [];
                                cell.state.timer = 0;
                                cell.state.isOpen = true;
                                const cleanRack = new ItemInstance('dish_rack');
                                cleanRack.state.contents = Array.from({ length: count }, () => new ItemInstance('plate'));
                                if (boardRows.length > 0) {
                                    cleanRack.state.boards = boardRows.map(row => ({ row, item: new ItemInstance('board') }));
                                }
                                cell.object = cleanRack;
                            }
                        }
                    }

                    // Soda Fountain (tile-based)
                    if (cell.type.id === 'SODA_FOUNTAIN' && cell.state) {
                        if (cell.state.status === 'filling' && g.timeFreezeTimer <= 0) {
                            cell.state.timer = (cell.state.timer || 0) + dt;
                            const max = cell.state.fillDuration || 3000;
                            if (cell.state.timer >= max) {
                                cell.state.status = 'done';
                                cell.state.timer = 0;
                            }
                        }
                    }

                    // Soda Fountain (object-based / held)
                    if (cell.object && (cell.object.definitionId === 'soda_fountain' || cell.object.tileType === 'SODA_FOUNTAIN')) {
                        const obj = cell.object;
                        if (obj.state && obj.state.status === 'filling') {
                            obj.state.timer = (obj.state.timer || 0) + dt;
                            const max = obj.state.fillDuration || 3000;
                            if (obj.state.timer >= max) {
                                obj.state.status = 'done';
                                obj.state.timer = 0;
                            }
                        }
                    }

                    // Service counter — match bags/plates to active tickets
                    if (cell.type.id === 'SERVICE' && cell.object &&
                        (cell.object.definitionId === 'bag' || cell.object.definitionId === 'magic_bag' || cell.object.definitionId === 'plate')) {

                        if (cell.object.state.isMatched) {
                            if (!g.timeFreezeManual) {
                                cell.object = null;
                            }
                            continue;
                        }

                        if (g.activeTickets.length > 0) {
                            let matchedTicketIndex = -1;
                            let matchResult = null;
                            for (let i = 0; i < g.activeTickets.length; i++) {
                                const t = g.activeTickets[i];
                                const res = t.verifyContainerItem(cell.object);
                                if (res.matched) {
                                    matchedTicketIndex = i;
                                    matchResult = res;
                                    break;
                                }
                            }

                            if (matchedTicketIndex !== -1) {
                                const ticket = g.activeTickets[matchedTicketIndex];
                                g.dailyBagsSold++;

                                if (g.timeFreezeManual) {
                                    cell.object.state.isMatched = true;
                                    ticket.finalizePos = { x, y };
                                    g.addFloatingText("Matched!", x, y, '#00ffff');
                                } else {
                                    cell.object = null;
                                    if (ticket.isComplete()) {
                                        this._finalizeTicket(ticket, matchedTicketIndex, x, y);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    _finalizeTicket(ticket, index, x, y) {
        const g = this.game;
        g.powerupSystem.resumeTime();

        const isDineIn = ticket.groups.some(grp => grp.containerType === 'plate');
        if (isDineIn) {
            g.pendingDirtyPlates.push({ timer: 3000, x: 12, y: 2 });
        }

        const par = ticket.parTime;
        const elapsed = ticket.elapsedTime;
        const diff = par - elapsed;
        let bonus = 0, message = "", color = "#fff";

        if (diff >= SCORING_CONFIG.THRESHOLDS.BONUS) {
            bonus = SCORING_CONFIG.REWARDS.BONUS;
            message = "GREAT SPEED! BONUS!";
            color = "#00ff00";
        } else if (diff >= 0) {
            bonus = SCORING_CONFIG.REWARDS.PAR;
            message = "ON TIME";
            color = "#ffff00";
        } else {
            bonus = SCORING_CONFIG.REWARDS.SLOW;
            message = "SERVED";
            color = "#ffffff";
        }

        g.addFloatingText(message, x, y, color);
        g.stability = 100;
        g.addFloatingText(`STABILITY FULL!`, x, y - 1, '#00ffff');

        const ticketScore = g.orderSystem.calculateTicketScore(ticket);
        g.score += ticketScore;
        g.addXp(1);

        if (g.score > g.highScore) {
            g.highScore = g.score;
            if (g.score > (parseInt(localStorage.getItem('burger_joint_highscore_v2')) || 0)) {
                localStorage.setItem('burger_joint_highscore_v2', g.highScore);
            }
            if (g.score > 0) g.addFloatingText("NEW HIGH SCORE!", x, y - 2, '#ffcc00');
        }

        g.activeTickets.splice(index, 1);
        g.orders = g.activeTickets.map(t => t.toDisplayFormat());
    }

    updateFallingBoxes(dt) {
        const g = this.game;
        if (!g.fallingBoxes || g.fallingBoxes.length === 0) return;

        const gravity = 0.00001;
        const groundY = 9;
        const stackOffset = 0.37;

        const kitchen = g.rooms['main'];
        if (!kitchen) return;

        const landingCell = kitchen.getCell(0, 9);
        const isLandingOccupied = landingCell ? !!landingCell.object : false;

        for (let i = 0; i < g.fallingBoxes.length; i++) {
            const box = g.fallingBoxes[i];
            const offset = box.noStackOffset ? 0.52 : stackOffset;

            let limitY = groundY;
            if (i > 0) {
                limitY = g.fallingBoxes[i - 1].y - offset;
            } else if (isLandingOccupied) {
                limitY = groundY - offset;
            }

            if (box.y < limitY) {
                box.vy += gravity * dt;
                box.y += box.vy * dt;
                if (box.y >= limitY) {
                    box.y = limitY;
                    box.vy = 0;
                }
            } else if (box.y > limitY) {
                box.y = limitY;
                box.vy = 0;
            }
        }

        if (g.fallingBoxes.length > 0) {
            const firstBox = g.fallingBoxes[0];
            if (firstBox.y >= groundY - 0.01 && !isLandingOccupied) {
                if (landingCell) {
                    landingCell.object = firstBox.item;
                    g.fallingBoxes.shift();
                }
            }
        }
    }

    triggerChute(triggerId, data = null) {
        const g = this.game;
        const trigger = CHUTE_TRIGGERS.find(t => t.id === triggerId);
        if (!trigger) {
            console.warn(`Chute trigger '${triggerId}' not found.`);
            return;
        }

        if (trigger.condition && !trigger.condition(g, data)) return;

        const itemsToDrop = trigger.getItems(g, data);
        if (!itemsToDrop || itemsToDrop.length === 0) return;

        console.log(`Chute Triggered: ${triggerId}. Dropping ${itemsToDrop.length} items.`);

        itemsToDrop.forEach(order => {
            for (let i = 0; i < (order.qty || 1); i++) {
                const instance = new ItemInstance(order.id);
                if (order.id === 'insert') instance.state.count = 3;
                this.dropInChute(instance);
            }
        });
    }

    dropInChute(itemInstance) {
        const g = this.game;
        if (!g.fallingBoxes) g.fallingBoxes = [];
        g.fallingBoxes.push({
            x: 0,
            y: -1 - g.fallingBoxes.length,
            vy: 0,
            item: itemInstance,
            noStackOffset: itemInstance.definition?.category === 'sauce_bottle'
        });
    }

    onClosingTime() {
        const g = this.game;
        console.log('Restaurant Closing (Queue Finished).');
        g.queueFinishedTime = Date.now();
        g.audioSystem.setMuffled(true);
        g.isDayActive = false;
    }
}

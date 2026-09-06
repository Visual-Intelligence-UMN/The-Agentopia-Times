// levelHelper.ts
import Phaser from 'phaser';

import { getGameConfig } from '../config';
import { key } from '../constants';
import { Agent } from '../sprites/Agent';
import { shiftControlStackY } from '../utils/managerVisualLayout';
import { recorder } from '../utils/recorder';

export function createDownloadButton(scene: Phaser.Scene, level: string) {
    const screenWidth = scene.cameras.main.width;
    const screenHeight = scene.cameras.main.height;

    const button = scene.add
        .text(screenWidth - 65, screenHeight - 80, '📊 Data Download', {
            fontSize: '18px',
            fontFamily: 'Verdana',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 10, y: 5 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(2000)
        .setInteractive();

    button.on('pointerdown', () => {
        recorder.endRecord();
    });
}

// === History ===
interface HistoryRecord {
    timestamp: string;
    score: number;
}

const HISTORY_KEY_PREFIX = 'level_history_';

// Save scores
export function saveHistory(level: string, score: number) {
    const key = HISTORY_KEY_PREFIX + level;
    const raw = localStorage.getItem(key);
    const history: HistoryRecord[] = raw ? JSON.parse(raw) : [];

    history.push({
        timestamp: new Date().toLocaleString(),
        score,
    });

    localStorage.setItem(key, JSON.stringify(history));
    console.log(`[History] Saved for ${level}:`, score);
}

// Create a button in the bottom right corner and click Show History
export function createHistoryButton(scene: Phaser.Scene, level: string) {
    const screenWidth = scene.cameras.main.width;
    const screenHeight = scene.cameras.main.height;

    const button = scene.add
        .text(screenWidth - 100, screenHeight - 40, '📜 History', {
            fontSize: '18px',
            fontFamily: 'Verdana',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 10, y: 5 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(2000)
        .setInteractive();

    button.on('pointerdown', () => {
        showHistory(scene, level);
    });
}

// Display history
function showHistory(scene: Phaser.Scene, level: string) {
    const key = HISTORY_KEY_PREFIX + level;
    const raw = localStorage.getItem(key);
    const history: HistoryRecord[] = raw ? JSON.parse(raw) : [];

    // If it already exists, just close it
    const existingUI = scene.children
        .getAll()
        .filter((obj) => obj.getData && obj.getData('isHistoryUI'));
    if (existingUI.length > 0) {
        existingUI.forEach((obj) => obj.destroy());
        return;
    }

    const boxWidth = 450;
    const boxHeight = 300;
    const centerX = scene.cameras.main.centerX;
    const centerY = scene.cameras.main.centerY;

    // Background
    const bg = scene.add
        .rectangle(centerX, centerY, boxWidth, boxHeight, 0x000000, 0.8)
        .setScrollFactor(0)
        .setDepth(2999)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive()
        .setData('isHistoryUI', true);

    if (history.length === 0) {
        const noDataBg = scene.add
            .rectangle(centerX, centerY, boxWidth, boxHeight, 0x000000, 0.8)
            .setScrollFactor(0)
            .setDepth(2999)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive()
            .setData('isHistoryUI', true);

        const noDataText = scene.add
            .text(centerX, centerY, 'No history yet!', {
                fontSize: '20px',
                fontFamily: 'Verdana',
                color: '#ffffff',
            })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(3000)
            .setData('isHistoryUI', true);

        // Click on the background to close it
        noDataBg.on('pointerdown', () => {
            scene.children.getAll().forEach((obj) => {
                if (obj.getData && obj.getData('isHistoryUI')) obj.destroy();
            });
        });

        return;
    }

    // Historical texts
    const textLines = history.map(
        (h, i) => `${i + 1}. [${h.timestamp}]  Score: ${h.score}`,
    );
    const historyText = scene.add
        .text(
            centerX - boxWidth / 2 + 20,
            centerY - boxHeight / 2 + 20,
            textLines.join('\n'),
            {
                fontSize: '16px',
                fontFamily: 'Verdana',
                color: '#ffffff',
                wordWrap: { width: boxWidth - 40 },
            },
        )
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(3000)
        .setData('isHistoryUI', true);

    // Adding a Mask for Scrolling
    const maskShape = scene.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(
        centerX - boxWidth / 2 + 10,
        centerY - boxHeight / 2 + 10,
        boxWidth - 20,
        boxHeight - 60,
    );
    const mask = maskShape.createGeometryMask();
    historyText.setMask(mask);

    let scrollY = 0;
    scene.input.on('wheel', (_pointer: any, _dx: number, dy: number) => {
        if (scene.children.exists(historyText)) {
            scrollY -= dy * 0.5;
            const maxScroll = Math.max(
                0,
                historyText.height - (boxHeight - 60),
            );
            scrollY = Phaser.Math.Clamp(scrollY, -maxScroll, 0);
            historyText.y = centerY - boxHeight / 2 + 20 + scrollY;
        }
    });

    // Clear History button
    const clearBtn = scene.add
        .text(centerX, centerY + boxHeight / 2 - 20, '🗑 Clear History', {
            fontSize: '16px',
            fontFamily: 'Verdana',
            color: '#ff6666',
            backgroundColor: '#222222',
            padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(3001)
        .setInteractive()
        .setData('isHistoryUI', true);

    clearBtn.on(
        'pointerdown',
        (
            pointer: Phaser.Input.Pointer,
            localX: number,
            localY: number,
            event: Phaser.Types.Input.EventData,
        ) => {
            event.stopPropagation();

            localStorage.removeItem(key);
            scene.children.getAll().forEach((obj) => {
                if (obj.getData && obj.getData('isHistoryUI')) obj.destroy();
            });
            console.log(`[History] Cleared for ${level}`);
        },
    );

    bg.on('pointerdown', () => {
        scene.children.getAll().forEach((obj) => {
            if (obj.getData && obj.getData('isHistoryUI')) obj.destroy();
        });
    });
}

// === Simple Instruction HUD (hover to show panel) ===
export function createSimpleInstructionHUD(scene: Phaser.Scene) {
    const cam = scene.cameras.main;

    // Config (adjustable)
    const WRAP_WIDTH = 520;
    const PAD_X = 16;
    const PAD_Y = 10;
    const PANEL_ALPHA = 0.58; // Panel background transparency
    const BTN_H = 28; // Button height
    const BTN_PAD_X = 10;
    const PANEL_Y = 10; // Panel vertical position offset from top of screen
    const LIFT = 12; // Lift distance for show/hide animation
    const SHOW_MS = 200;
    const HIDE_MS = 160;

    // Top-right "Instructions" button
    const btnTextObj = scene.add
        .text(0, 0, 'Instructions', {
            fontFamily: 'Verdana',
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold',
        })
        .setScrollFactor(0)
        .setDepth(2101)
        .setOrigin(0.5);

    const btnWidth = Math.ceil(btnTextObj.width + BTN_PAD_X * 2);

    const btnBg = scene.add
        .rectangle(0, 0, btnWidth, BTN_H, 0x000000, 0.65)
        .setScrollFactor(0)
        .setDepth(2100)
        .setOrigin(0.5)
        .setStrokeStyle(1.5, 0xffffff)
        .setInteractive({ useHandCursor: true });

    // Button position relative to top-left of the screen
    const BUTTON_OFFSET_X = 22;
    const BUTTON_OFFSET_Y = 80;

    const placeButton = () => {
        const x = cam.scrollX + BUTTON_OFFSET_X;
        const y = cam.scrollY + BUTTON_OFFSET_Y;
        btnBg.setPosition(x, y);
        btnTextObj.setPosition(x, y);
    };
    placeButton();
    btnTextObj.setInteractive({ useHandCursor: true });

    // Panel container
    const panel = scene.add
        .container(0, 0)
        .setScrollFactor(0)
        .setDepth(2098)
        .setVisible(false)
        .setAlpha(0);

    // Title text
    const title = scene.add
        .text(0, 0, 'INSTRUCTIONS', {
            fontFamily: 'Verdana',
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold',
            align: 'center',
            letterSpacing: 1.5,
        })
        .setOrigin(0.5, 0)
        .setStroke('#000000', 3)
        .setShadow(0, 1, '#000000', 4, false, true)
        .setResolution(2);

    // Instruction body text
    const instruction =
        '1) Select a hallucinated agent\n' +
        '2) Optionally assign the Manager hat\n' +
        '3) Choose a strategy for each room\n' +
        '4) Choose a dataset\n' +
        '5) Start simulation\n' +
        'Goal: Reach 8+ score to pass this level';

    const bodyY = title.height + 4;
    const body = scene.add
        .text(0, bodyY, instruction, {
            fontFamily: 'Verdana',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center',
            lineSpacing: 4,
            wordWrap: { width: WRAP_WIDTH },
        })
        .setOrigin(0.5, 0)
        .setStroke('#000000', 3)
        .setShadow(0, 1, '#000000', 4)
        .setResolution(2);

    // Add to container for measurement
    panel.add([title, body]);

    // Measure widths
    const titleW = title.getBounds().width;
    const bodyW = body.getBounds().width;
    const contentW = Math.max(titleW, bodyW);

    // Divider line width based on content size
    const dividerW = Math.max(120, Math.min(contentW - 24, 360));
    const divider = scene.add
        .rectangle(0, title.height + 0, dividerW, 1.5, 0xffffff, 0.9)
        .setOrigin(0.5);
    panel.addAt(divider, 1);

    // Background size based on content bounds
    const boundsLeft = Math.min(title.getBounds().x, body.getBounds().x);
    const boundsRight = Math.max(
        title.getBounds().right,
        body.getBounds().right,
    );
    const boundsTop = title.getBounds().y;
    const boundsBottom = body.getBounds().bottom;

    const bgWidth = boundsRight - boundsLeft + PAD_X * 2;
    const bgHeight = boundsBottom - boundsTop + PAD_Y * 2;

    const bg = scene.add
        .rectangle(
            0,
            title.height + body.height / 2 + PAD_Y,
            bgWidth,
            bgHeight,
            0x000000,
            PANEL_ALPHA,
        )
        .setOrigin(0.5)
        .setStrokeStyle(2, 0xffffff);

    panel.addAt(bg, 0);

    // Panel base position in center-top of camera
    const basePanelPos = () => ({
        x: cam.scrollX + cam.width / 2,
        y: cam.scrollY + PANEL_Y,
    });

    const placePanel = () => {
        const { x, y } = basePanelPos();
        panel.x = x;
        if (!panel.visible) {
            panel.y = y - LIFT;
        }
    };
    placePanel();

    // Show/hide animation
    let showTween: Phaser.Tweens.Tween | null = null;
    let hideTween: Phaser.Tweens.Tween | null = null;
    let hoveringBtn = false;

    const stopTween = (tw?: Phaser.Tweens.Tween | null) => {
        if (tw && tw.isPlaying()) tw.stop();
    };

    const showPanel = () => {
        if (panel.visible && panel.alpha === 1) return;
        stopTween(hideTween);
        const { y } = basePanelPos();
        panel.setVisible(true);
        panel.setAlpha(0);
        panel.y = y - LIFT;

        showTween = scene.tweens.add({
            targets: panel,
            alpha: 1,
            y: y,
            duration: SHOW_MS,
            ease: 'Sine.easeOut',
        });
    };

    const hidePanel = () => {
        if (!panel.visible) return;
        stopTween(showTween);
        const { y } = basePanelPos();

        hideTween = scene.tweens.add({
            targets: panel,
            alpha: 0,
            y: y - LIFT,
            duration: HIDE_MS,
            ease: 'Sine.easeIn',
            onComplete: () => {
                panel.setVisible(false);
            },
        });
    };

    const onOver = () => {
        hoveringBtn = true;
        showPanel();
    };
    const onOut = () => {
        hoveringBtn = false;
        hidePanel();
    };

    btnBg.on('pointerover', onOver);
    btnBg.on('pointerout', onOut);
    btnTextObj.on('pointerover', onOver);
    btnTextObj.on('pointerout', onOut);

    // Camera follow
    const onPostRender = () => {
        placeButton();

        const { x, y } = basePanelPos();
        panel.x = x;

        const anyPlaying =
            (showTween && showTween.isPlaying()) ||
            (hideTween && hideTween.isPlaying());
        if (!anyPlaying) {
            if (panel.visible) {
                panel.y = y;
            } else {
                panel.y = y - LIFT;
                panel.alpha = 0;
            }
        }
    };
    scene.events.on(Phaser.Scenes.Events.POST_RENDER, onPostRender);

    return {
        destroy() {
            scene.events.off(Phaser.Scenes.Events.POST_RENDER, onPostRender);
            [btnBg, btnTextObj, panel].forEach((o) => o.destroy());
            stopTween(showTween);
            stopTween(hideTween);
        },
    };
}

// DifficultySelector
export function createDifficultySelector(scene: Phaser.Scene) {
    const levels = getGameConfig().mechanics.levels;

    // Determine the initial index based on the current scene.key
    const currentKey = scene.scene.key.toLowerCase(); // e.g. "level1"
    let difficultyIndex = levels.findIndex(
        (level) => level.sceneKey.toLowerCase() === currentKey,
    );
    if (difficultyIndex === -1) difficultyIndex = 0; // default level 1

    const difficultyLabel = scene.add
        .text(-50, shiftControlStackY(150), '', {
            fontSize: '16px',
            fontFamily: 'Verdana',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 8, y: 4 },
        })
        .setScrollFactor(0)
        .setInteractive()
        .setDepth(2000);

    const updateDifficultyText = () => {
        const activeLevel = levels[difficultyIndex];
        const text = `Level: ◀ ${activeLevel.level_name.toUpperCase()} ▶`;
        difficultyLabel.setText(text);
        scene.registry.set('gameDifficulty', activeLevel.level_name);
    };

    difficultyLabel.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        const clickX = pointer.x - difficultyLabel.x;
        const labelWidth = difficultyLabel.width;

        if (clickX < labelWidth / 3) {
            difficultyIndex =
                (difficultyIndex - 1 + levels.length) % levels.length;
        } else if (clickX > (labelWidth * 2) / 3) {
            difficultyIndex = (difficultyIndex + 1) % levels.length;
        }

        updateDifficultyText();

        const targetSceneKey = levels[difficultyIndex].sceneKey;
        console.log(`Switching to scene: ${targetSceneKey}`);

        if (scene.scene.key === targetSceneKey) {
            scene.scene.restart();
        } else {
            scene.scene.stop(scene.scene.key);
            scene.scene.start(targetSceneKey);
        }
    });

    // Initialize the display
    updateDifficultyText();

    return difficultyLabel;
}

// === PDF Instructions Button (open in new tab) ===
export function addPDFIcon(scene: Phaser.Scene) {
    const cam = scene.cameras.main;

    // fixed position offsets (from top-left of camera)
    const OFFSET_X = 120;
    const OFFSET_Y = 80;

    // require the texture to be preloaded in Boot
    if (!scene.textures.exists(key.image.pdfIcon)) {
        console.warn(
            '[PDF Icon] Missing texture. Preload key.image.pdfIcon in Boot.',
        );
        return null;
    }

    const icon = scene.add
        .image(0, 0, key.image.pdfIcon)
        .setOrigin(0.5)
        .setScale(0.08) // adjust size here
        .setScrollFactor(0)
        .setDepth(10000)
        .setInteractive({ useHandCursor: true });

    const place = () => {
        icon.x = cam.scrollX + OFFSET_X;
        icon.y = cam.scrollY + OFFSET_Y;
    };
    place();

    icon.on('pointerover', () => icon.setAlpha(0.85));
    icon.on('pointerout', () => icon.setAlpha(1));

    icon.on('pointerdown', async (_ptr, _lx, _ly, ev: any) => {
        if (ev && typeof ev.stopPropagation === 'function')
            ev.stopPropagation();

        const url = '/docs/Game_Instructions.pdf';

        try {
            // Fetch PDF as blob
            const resp = await fetch(url);
            if (!resp.ok) return console.warn('[PDF] Failed to fetch:', url);
            const blob = await resp.blob();

            // Open PDF in a new tab using object URL
            const objectUrl = URL.createObjectURL(blob);
            window.open(objectUrl, '_blank', 'noopener,noreferrer');

            // Release memory after some time
            setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
        } catch (e) {
            console.warn('[PDF] Error:', e);
        }
    });

    const onPost = () => place();
    scene.events.on(Phaser.Scenes.Events.POST_RENDER, onPost);

    return {
        destroy() {
            scene.events.off(Phaser.Scenes.Events.POST_RENDER, onPost);
            icon.destroy();
        },
    };
}

// === Rule: If there is a globally unique biased in the room, it must be chosen; otherwise it is randomized from within the room. ===
export function pickAgentForSingleStrict(
    roomZones: any[],
    agentList: Map<string, Agent>,
) {
    const fallbackByName = (name: string | null) => {
        if (!name) return undefined;
        const trimmed = name.trim();
        if (!trimmed) return undefined;
        for (const agent of agentList.values()) {
            if (agent.getName?.() === trimmed) return agent;
        }
        return undefined;
    };

    const toAgent = (a: any) => {
        if (a instanceof Agent || typeof a?.getName === 'function') {
            return a;
        }
        if (typeof a === 'string') {
            return (
                agentList.get(a) ??
                fallbackByName(a) ??
                fallbackByName(a.replace(/^Biased\s+/i, '').trim())
            );
        }
        if (a && typeof a === 'object' && 'name' in a) {
            const raw = (a as { name?: unknown }).name;
            if (typeof raw === 'string') {
                return (
                    agentList.get(raw) ??
                    fallbackByName(raw) ??
                    fallbackByName(raw.replace(/^Biased\s+/i, '').trim())
                );
            }
        }
        return undefined;
    };

    const agentsInRoom: Agent[] = [];
    for (const zone of roomZones || []) {
        const list = Array.isArray(zone?.agents) ? zone.agents : [];
        for (const a of list) {
            const inst = toAgent(a);
            if (inst) agentsInRoom.push(inst);
        }
    }
    if (!agentsInRoom.length) return null;

    const biasedInRoom = agentsInRoom.filter((a) => a.getBias?.() === 'biased');
    if (biasedInRoom.length) return biasedInRoom[0];

    return Phaser.Utils.Array.GetRandom(agentsInRoom);
}

// === add title bar + info icon with tooltip ===
export interface TitleHoverOptions {
    x: number;
    y: number;
    depth?: number;
}

export function addTitleWithHoverInfo(
    scene: Phaser.Scene,
    titleText: string,
    infoText: string,
    opts: TitleHoverOptions,
) {
    const { x, y, depth = 2000 } = opts;

    // fixed styles
    const titleStyle = {
        fontSize: '18px',
        fontFamily: 'Verdana',
        color: '#ffffff',
    };
    const iconChar = '🛈';

    // create title text (measure size)
    const titleObj = scene.add
        .text(0, 0, titleText, titleStyle)
        .setVisible(false);
    const iconObj = scene.add
        .text(0, 0, iconChar, {
            fontSize: '18px',
            fontFamily: 'Verdana',
            color: '#ffffff',
        })
        .setOrigin(0, 0.5)
        .setVisible(false)
        .setInteractive();

    // measure
    const gap = 8;
    const padX = 6,
        padY = 4;
    const barWidth = titleObj.width + gap + iconObj.width + padX * 2;
    const barHeight = Math.max(titleObj.height, iconObj.height) + padY * 2;

    // black bar (no border)
    const bar = scene.add
        .rectangle(x, y, barWidth, barHeight, 0x000000, 1)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(depth);

    // place title
    titleObj
        .setPosition(x + padX, y + padY)
        .setScrollFactor(0)
        .setDepth(depth + 1)
        .setVisible(true);

    // place icon
    iconObj
        .setPosition(x + padX + titleObj.width + gap, y + barHeight / 2)
        .setScrollFactor(0)
        .setDepth(depth + 1)
        .setVisible(true);

    // tooltip (black bg + white border + semi-transparent)
    let tipBG: Phaser.GameObjects.Rectangle | undefined;
    let tipText: Phaser.GameObjects.Text | undefined;

    iconObj.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        tipText = scene.add
            .text(pointer.x + 18, pointer.y + 10, infoText, {
                fontSize: '18px', // bigger for readability
                fontFamily: 'Verdana',
                color: '#ffffff',
                wordWrap: { width: 360 },
            })
            .setScrollFactor(0)
            .setDepth(depth + 3);

        const b = tipText.getBounds();
        tipBG = scene.add
            .rectangle(
                b.x - 8,
                b.y - 8,
                b.width + 16,
                b.height + 16,
                0x000000,
                0.7, // alpha lower (semi-transparent)
            )
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(depth + 2)
            .setStrokeStyle(2, 0xffffff); // white border only for hover

        tipText.setDepth(depth + 3);
    });

    iconObj.on('pointerout', () => {
        tipBG?.destroy();
        tipBG = undefined;
        tipText?.destroy();
        tipText = undefined;
    });
}

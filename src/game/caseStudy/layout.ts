import Phaser from 'phaser';

import type { Agent } from '../sprites/Agent';
import type { ManagerAssignmentController } from '../utils/managerAssignmentHUD';
import { shiftControlStackY } from '../utils/managerVisualLayout';
import {
    caseStudyWorkflows,
    clearCaseStudyMode,
    getCaseStudyVariant,
    isCaseStudyGuidePending,
    consumeCaseStudyGuidePending,
    isCaseStudyMode,
    setCaseStudyVariant,
    type CaseStudyVariant,
} from './session';

type VariantHud = {
    left: Phaser.GameObjects.Text;
    label: Phaser.GameObjects.Text;
    right: Phaser.GameObjects.Text;
};

type CaseStudyScene = Phaser.Scene & {
    controllableCharacters?: Agent[];
    agentList?: Map<string, Agent>;
    managerAssignment?: ManagerAssignmentController;
    debateStartBtn?: Phaser.GameObjects.Image;
    simulationStatusLabel?: Phaser.GameObjects.Text;
    caseStudyVariantHud?: VariantHud;
};

function sceneIsUsable(scene?: Phaser.Scene | null): boolean {
    if (!scene?.sys) return false;
    const status = scene.sys.settings.status;
    return (
        status !== Phaser.Scenes.SHUTDOWN &&
        status !== Phaser.Scenes.DESTROYED
    );
}

function isLiveAgent(
    agent: Agent | undefined,
    host?: Phaser.Scene,
): agent is Agent {
    if (!agent || typeof agent.getName !== 'function') return false;
    if (agent.active === false) return false;
    if (!sceneIsUsable(agent.scene)) return false;
    if (host && agent.scene !== host) return false;
    return true;
}

function listedAgents(scene: CaseStudyScene): Agent[] {
    return (scene.controllableCharacters ?? []).filter((agent) =>
        isLiveAgent(agent, scene),
    );
}

function byRole(agents: Agent[], role: string): Agent | undefined {
    return agents.find((agent) => {
        const persona = agent.getPersona?.() ?? '';
        const name = agent.getName().toLowerCase();
        return (
            persona === role ||
            name.endsWith(` ${role}`) ||
            name.endsWith(`- ${role}`)
        );
    });
}

export function findCaseStudyGhost(scene: Phaser.Scene): Agent | undefined {
    const agents = listedAgents(scene as CaseStudyScene);
    return byRole(agents, 'voter') ?? agents[0];
}

export function findCaseStudyManager(scene: Phaser.Scene): Agent | undefined {
    const host = scene as CaseStudyScene;
    const ghost = findCaseStudyGhost(host);
    const agents = listedAgents(host);
    const preferredRole =
        getCaseStudyVariant(host) === 'correct' ? 'writer' : 'visualizer';
    const preferred = byRole(agents, preferredRole);
    if (preferred && preferred !== ghost) return preferred;
    return agents.find((agent) => agent !== ghost);
}

export function applyCaseStudyWorkflow(scene: Phaser.Scene): boolean {
    if (!isCaseStudyMode(scene)) return false;
    const host = scene as CaseStudyScene;
    host.controllableCharacters = [];
    host.agentList = new Map();
    scene.registry.set('caseStudySwitching', false);
    scene.registry.set('isWorkflowRunning', false);
    const variant = getCaseStudyVariant(scene);
    scene.registry.set('workflowConfig', [...caseStudyWorkflows[variant]]);
    scene.registry.set('currentDataset', 'baseball');
    return true;
}

function lockAgents(scene: CaseStudyScene) {
    for (const agent of listedAgents(scene)) {
        agent.disableInteractive();
        scene.input.setDraggable(agent, false);
    }
}

function lockStrategyButtons(scene: Phaser.Scene) {
    const textures = new Set([
        'sequential',
        'voting',
        'discussion',
        'single_agent',
    ]);
    scene.children.each((child) => {
        const image = child as Phaser.GameObjects.Image & {
            disableInteractive?: () => void;
        };
        if (image.texture && textures.has(image.texture.key)) {
            image.disableInteractive?.();
        }
    });
}

export function returnToMainMenu(scene: Phaser.Scene) {
    scene.registry.set('isWorkflowRunning', false);
    scene.registry.set('caseStudySwitching', false);
    clearCaseStudyMode(scene);
    scene.scene.start('MainMenu');
}

export function decorateCaseStudyHud(scene: Phaser.Scene): boolean {
    if (!isCaseStudyMode(scene)) return false;
    const cam = scene.cameras.main;
    const notice = scene.add
        .text(
            cam.centerX,
            -6,
            'This is a preset scene. Use the API version for the full experience.',
            {
                fontSize: '12px',
                fontFamily: 'Verdana',
                color: '#d0d0d0',
                backgroundColor: '#000000',
                align: 'center',
                padding: { x: 10, y: 2 },
            },
        )
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(5000);

    const label = scene.add
        .text(0, 0, 'Back to Main Menu', {
            fontSize: '13px',
            fontFamily: 'Verdana',
            color: '#ffffff',
            fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(5002);

    const btnH = 22;
    const btnW = Math.ceil(label.width + 20);
    const btnY = notice.y + notice.height + 14 + btnH / 2;
    const btnBg = scene.add
        .rectangle(cam.centerX, btnY, btnW, btnH, 0x000000, 0.65)
        .setStrokeStyle(1.5, 0xffffff)
        .setScrollFactor(0)
        .setDepth(5001)
        .setInteractive({ useHandCursor: true });

    label.setPosition(cam.centerX, btnY);
    const goBack = () => returnToMainMenu(scene);
    btnBg.on('pointerup', goBack);
    label.setInteractive({ useHandCursor: true }).on('pointerup', goBack);

    showCaseStudyGuide(scene);
    return true;
}

function findVariantHud(scene: Phaser.Scene): VariantHud | undefined {
    return (scene as CaseStudyScene).caseStudyVariantHud;
}

function variantHudBounds(hud?: VariantHud) {
    const padX = 12;
    const down = 2;
    if (!hud) {
        const y = shiftControlStackY(150) + down;
        return { x: 70, y, width: 210, height: 36, right: 175 };
    }
    const left = hud.left.x;
    const right = hud.right.x + hud.right.width;
    const top = Math.min(hud.left.y, hud.label.y, hud.right.y);
    const height = Math.max(hud.left.height, hud.label.height, hud.right.height);
    const width = right - left;
    return {
        x: left + width / 2,
        y: top + height / 2 + down,
        width: width + padX * 2,
        height: height + 10,
        right: right + padX,
    };
}

function drawPointerArrow(
    scene: Phaser.Scene,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    depth: number,
): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    graphics.lineStyle(3, 0xf2f2f2, 0.95);
    graphics.beginPath();
    graphics.moveTo(fromX, fromY);
    graphics.lineTo(toX, toY);
    graphics.strokePath();
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const head = 11;
    graphics.fillStyle(0xf2f2f2, 0.95);
    graphics.fillTriangle(
        toX,
        toY,
        toX - head * Math.cos(angle - 0.5),
        toY - head * Math.sin(angle - 0.5),
        toX - head * Math.cos(angle + 0.5),
        toY - head * Math.sin(angle + 0.5),
    );
    return graphics;
}

function hintLabel(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    depth: number,
    originX = 0,
    originY = 0.5,
) {
    return scene.add
        .text(x, y, text, {
            fontSize: '14px',
            fontFamily: 'Verdana',
            color: '#f3f3f3',
            backgroundColor: '#000000',
            align: 'left',
            padding: { x: 8, y: 5 },
        })
        .setOrigin(originX, originY)
        .setScrollFactor(0)
        .setDepth(depth);
}

function renderCaseStudyGuide(scene: Phaser.Scene) {
    const host = scene as CaseStudyScene;
    const cam = scene.cameras.main;
    const start = host.debateStartBtn;
    const startCaption = host.simulationStatusLabel;
    const variantBox = variantHudBounds(findVariantHud(scene));
    const depth = 20000;

    const startX = start?.x ?? 0;
    const startY = start?.y ?? shiftControlStackY(330);

    const dim = scene.add
        .rectangle(
            cam.centerX,
            cam.centerY,
            Math.max(cam.displayWidth, cam.width) + 120,
            Math.max(cam.displayHeight, cam.height) + 120,
            0x121212,
            0.46,
        )
        .setScrollFactor(0)
        .setDepth(depth)
        .setInteractive();

    const startRing = scene.add
        .circle(startX, startY, 40, 0xffffff, 0)
        .setStrokeStyle(2, 0xffffff, 0.9)
        .setScrollFactor(0)
        .setDepth(depth + 1);

    const variantRing = scene.add
        .rectangle(
            variantBox.x,
            variantBox.y,
            variantBox.width,
            variantBox.height,
            0xffffff,
            0,
        )
        .setStrokeStyle(2, 0xffffff, 0.9)
        .setScrollFactor(0)
        .setDepth(depth + 1);

    const startHintX = startX + 78;
    const startHintY = startCaption?.y ?? startY - 48;
    const startHint = hintLabel(
        scene,
        startHintX,
        startHintY,
        'Click Start Simulation\nto play this preset.',
        depth + 2,
    );
    const startArrow = drawPointerArrow(
        scene,
        startHintX - 6,
        startHintY,
        startX + 36,
        startY - 4,
        depth + 2,
    );

    const variantHintX = variantBox.right + 18;
    const variantHintY = variantBox.y;
    const variantHint = hintLabel(
        scene,
        variantHintX,
        variantHintY,
        'Switch INCORRECT / CORRECT\nto compare the two setups.',
        depth + 2,
        0,
        0.5,
    );
    const variantArrow = drawPointerArrow(
        scene,
        variantHintX - 8,
        variantHintY,
        variantBox.right + 2,
        variantBox.y,
        depth + 2,
    );

    let remaining = 2;
    let gone = false;
    let canDismiss = false;
    const dismissHint = scene.add
        .text(cam.centerX, cam.centerY + cam.height * 0.28, `Continue in ${remaining}`, {
            fontSize: '13px',
            fontFamily: 'Verdana',
            color: '#d8d8d8',
            backgroundColor: '#000000',
            padding: { x: 10, y: 5 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(depth + 2);

    const countdown = scene.time.addEvent({
        delay: 1000,
        repeat: 1,
        callback: () => {
            if (gone) return;
            remaining -= 1;
            if (remaining > 0) {
                dismissHint.setText(`Continue in ${remaining}`);
                return;
            }
            canDismiss = true;
            dismissHint.setText('Click anywhere to continue');
            dim.setInteractive({ useHandCursor: true });
        },
    });

    const items = [
        dim,
        startRing,
        variantRing,
        startHint,
        startArrow,
        variantHint,
        variantArrow,
        dismissHint,
    ];

    const destroyItems = () => {
        if (gone) return;
        gone = true;
        countdown.remove(false);
        items.forEach((item) => item.destroy());
    };
    dim.on('pointerup', () => {
        if (!canDismiss) return;
        destroyItems();
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroyItems);
}

function showCaseStudyGuide(scene: Phaser.Scene) {
    if (!isCaseStudyMode(scene) || !isCaseStudyGuidePending()) return;
    consumeCaseStudyGuidePending();
    const host = scene as CaseStudyScene;
    let tries = 0;
    const attempt = () => {
        if (!sceneIsUsable(scene)) return;
        if (host.debateStartBtn && findVariantHud(scene)) {
            renderCaseStudyGuide(scene);
            return;
        }
        if (tries++ < 40) scene.time.delayedCall(80, attempt);
        else renderCaseStudyGuide(scene);
    };
    scene.time.delayedCall(80, attempt);
}

function safelySetBias(agent: Agent, biased: boolean) {
    if (!isLiveAgent(agent)) return;
    try {
        if (biased) agent.setToBiased();
        else if (agent.getBias() !== '') agent.setToUnbiased();
    } catch {
        // Destroyed sprites must not freeze Case Study switching.
    }
}

export function applyCaseStudyCast(scene: Phaser.Scene): boolean {
    if (!isCaseStudyMode(scene) || !sceneIsUsable(scene)) return false;
    const host = scene as CaseStudyScene;
    const agents = listedAgents(host);
    if (!agents.length) return false;

    for (const agent of agents) safelySetBias(agent, false);

    const ghost = findCaseStudyGhost(host);
    if (ghost) safelySetBias(ghost, true);

    const manager = findCaseStudyManager(host);
    if (manager && isLiveAgent(manager, host)) {
        host.managerAssignment?.assignManager(manager);
        host.managerAssignment?.lock();
    }

    lockAgents(host);
    lockStrategyButtons(scene);
    return true;
}

function switchCaseStudyVariant(scene: Phaser.Scene, variant: CaseStudyVariant) {
    if (!scene.sys?.isActive()) return;
    if (scene.registry.get('caseStudySwitching')) return;
    if (getCaseStudyVariant(scene) === variant) return;
    scene.registry.set('caseStudySwitching', true);
    scene.registry.set('isWorkflowRunning', false);
    setCaseStudyVariant(scene, variant);
    scene.time.removeAllEvents();
    scene.tweens.killAll();
    scene.scene.start('level1');
}

export function createCaseStudyVariantSelector(scene: Phaser.Scene) {
    const variant = getCaseStudyVariant(scene);
    const y = shiftControlStackY(150);
    const style = {
        fontSize: '16px',
        fontFamily: 'Verdana',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 6 },
    };

    const measure = scene.add
        .text(0, 0, 'Instructions', {
            fontFamily: 'Verdana',
            fontSize: '18px',
            fontStyle: 'bold',
        })
        .setVisible(false);
    const instructionsLeft = 22 - Math.ceil(measure.width + 20) / 2;
    measure.destroy();

    const left = scene.add
        .text(instructionsLeft, y, '◀', style)
        .setScrollFactor(0)
        .setDepth(5000)
        .setInteractive({ useHandCursor: true });

    const label = scene.add
        .text(0, y, variant === 'incorrect' ? 'INCORRECT' : 'CORRECT', style)
        .setScrollFactor(0)
        .setDepth(5000)
        .setInteractive({ useHandCursor: true })
        .setData('caseStudyVariantHud', true);

    const right = scene.add
        .text(0, y, '▶', style)
        .setScrollFactor(0)
        .setDepth(5000)
        .setInteractive({ useHandCursor: true });

    label.setX(left.x + left.width + 6);
    right.setX(label.x + label.width + 6);
    (scene as CaseStudyScene).caseStudyVariantHud = { left, label, right };

    const toggle = () => {
        switchCaseStudyVariant(
            scene,
            getCaseStudyVariant(scene) === 'incorrect'
                ? 'correct'
                : 'incorrect',
        );
    };
    left.on('pointerup', toggle);
    right.on('pointerup', toggle);
    label.on('pointerup', toggle);

    return label;
}

import Phaser from 'phaser';

import { canAssignEditorialManager } from '../domain/editorialManager';
import type { Agent } from '../sprites/Agent';
import { calculateManagerDecorationLayout } from './managerVisualLayout';
import { recorder } from './recorder';

const PANEL_DEPTH = 3100;
const GOLD = 0xf4bd4a;
const NAVY = 0x202957;

export interface ManagerAssignmentController {
    getManager(): Agent | null;
    setStatus(status: string, color?: string): void;
    destroy(): void;
}

function drawPixelManagerHat(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale = 1,
): Phaser.GameObjects.Container {
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x10152f, 1);
    graphics.fillRect(-13, -7, 26, 10);
    graphics.fillStyle(NAVY, 1);
    graphics.fillRect(-10, -12, 20, 5);
    graphics.fillRect(-13, -8, 26, 7);
    graphics.fillStyle(0x344486, 1);
    graphics.fillRect(-8, -11, 16, 2);
    graphics.fillStyle(GOLD, 1);
    graphics.fillRect(-13, -2, 26, 3);
    graphics.fillRect(-2, -8, 4, 5);
    graphics.fillRect(-4, -6, 8, 2);
    graphics.fillStyle(0x080a14, 1);
    graphics.fillRect(-17, 1, 34, 4);
    graphics.fillStyle(0x29345f, 1);
    graphics.fillRect(-12, 1, 24, 2);

    return scene.add.container(x, y, [graphics]).setScale(scale);
}

function drawDottedLine(
    graphics: Phaser.GameObjects.Graphics,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
) {
    graphics.clear();
    graphics.fillStyle(GOLD, 0.95);
    const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const dots = Math.max(1, Math.floor(distance / 12));
    for (let i = 1; i <= dots; i++) {
        const ratio = i / dots;
        graphics.fillCircle(
            Phaser.Math.Linear(fromX, toX, ratio),
            Phaser.Math.Linear(fromY, toY, ratio),
            2,
        );
    }
}

export function createManagerAssignmentHUD(
    scene: Phaser.Scene,
    getAgents: () => Agent[],
): ManagerAssignmentController {
    const panelX = 0;
    const panelY = scene.scale.height - 37;
    const homeX = panelX;
    const homeY = panelY - 1;
    let manager: Agent | null = null;
    let assignedHat: Phaser.GameObjects.Container | null = null;
    let assignedLabel: Phaser.GameObjects.Text | null = null;
    let assignedRing: Phaser.GameObjects.Ellipse | null = null;

    const panel = scene.add
        .rectangle(panelX, panelY, 100, 74, 0x05070d, 0.68)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH)
        .setStrokeStyle(2, 0xffffff, 1);
    const title = scene.add
        .text(panelX, panelY - 27, 'MANAGER', {
            fontFamily: 'Courier New',
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 2);
    const status = scene.add
        .text(panelX, panelY + 26, 'DRAG TO ASSIGN', {
            fontFamily: 'Courier New',
            fontSize: '7px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 92 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 2);

    const sourceHat = drawPixelManagerHat(scene, homeX, homeY, 0.95)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 3)
        .setSize(48, 34)
        .setInteractive({ useHandCursor: true, draggable: true });
    scene.input.setDraggable(sourceHat);

    const dragGuide = scene.add
        .graphics()
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH + 1);
    const targetRings = new Map<Agent, Phaser.GameObjects.Ellipse>();

    function setStatus(message: string, color = '#ffffff') {
        status.setText(message).setColor(color);
    }

    function clearTargetRings() {
        targetRings.forEach((ring) => ring.destroy());
        targetRings.clear();
    }

    function showEligibleTargets() {
        clearTargetRings();
        for (const agent of getAgents()) {
            if (!canAssignEditorialManager(agent).allowed) continue;
            const { ring: ringPosition } =
                calculateManagerDecorationLayout(agent);
            const ring = scene.add
                .ellipse(ringPosition.x, ringPosition.y, 38, 16)
                .setStrokeStyle(2, GOLD, 0.9)
                .setDepth(agent.depth + 1);
            targetRings.set(agent, ring);
        }
    }

    function findDropTarget(pointer: Phaser.Input.Pointer): Agent | null {
        let closest: Agent | null = null;
        let closestDistance = 42;
        for (const agent of getAgents()) {
            const distance = Phaser.Math.Distance.Between(
                pointer.worldX,
                pointer.worldY,
                agent.x,
                agent.y,
            );
            if (distance < closestDistance) {
                closest = agent;
                closestDistance = distance;
            }
        }
        return closest;
    }

    function clearAssignedVisuals() {
        assignedHat?.destroy();
        assignedLabel?.destroy();
        assignedRing?.destroy();
        assignedHat = null;
        assignedLabel = null;
        assignedRing = null;
    }

    function assignManager(agent: Agent) {
        if (manager && manager !== agent) {
            manager.setEditorialManager(false);
        }
        clearAssignedVisuals();
        manager = agent;
        manager.setEditorialManager(true);
        scene.registry.set('editorialManagerAgent', manager.getName());

        const layout = calculateManagerDecorationLayout(agent);
        assignedHat = drawPixelManagerHat(
            scene,
            layout.hat.x,
            layout.hat.y,
            0.82,
        ).setDepth(2050);
        assignedRing = scene.add
            .ellipse(layout.ring.x, layout.ring.y, 40, 17)
            .setStrokeStyle(2, GOLD, 1)
            .setDepth(2048);
        assignedLabel = scene.add
            .text(layout.label.x, layout.label.y, 'MANAGER', {
                fontFamily: 'Courier New',
                fontSize: '8px',
                fontStyle: 'bold',
                color: '#ffffff',
                backgroundColor: '#05070d',
                padding: { x: 3, y: 1 },
            })
            .setOrigin(0.5)
            .setDepth(2051);
        setStatus(`ASSIGNED\n${agent.getName()}`, '#f4bd4a');
        recorder.recordEvent({
            type: 'editorial_manager_assigned',
            agent: agent.getName(),
        });
    }

    sourceHat.on('dragstart', () => {
        if (scene.registry.get('isWorkflowRunning')) {
            setStatus('SIMULATION RUNNING', '#ff8a65');
            return;
        }
        setStatus('DROP ON AN AGENT', '#f4bd4a');
        showEligibleTargets();
    });
    sourceHat.on(
        'drag',
        (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            if (scene.registry.get('isWorkflowRunning')) return;
            sourceHat.setPosition(dragX, dragY);
            drawDottedLine(dragGuide, homeX, homeY, pointer.x, pointer.y);
        },
    );
    sourceHat.on('dragend', (pointer: Phaser.Input.Pointer) => {
        dragGuide.clear();
        clearTargetRings();
        sourceHat.setPosition(homeX, homeY);

        const target = findDropTarget(pointer);
        if (!target) {
            setStatus(manager ? 'DRAG TO REASSIGN' : 'DRAG TO ASSIGN');
            return;
        }

        const result = canAssignEditorialManager(
            target,
            Boolean(scene.registry.get('isWorkflowRunning')),
        );
        if (!result.allowed) {
            setStatus(
                result.reason === 'ghost'
                    ? 'GHOSTS CANNOT MANAGE'
                    : 'SIMULATION RUNNING',
                '#ff8a65',
            );
            return;
        }
        assignManager(target);
    });

    const updateAssignedVisuals = () => {
        targetRings.forEach((ring, agent) => {
            const { ring: ringPosition } =
                calculateManagerDecorationLayout(agent);
            ring.setPosition(ringPosition.x, ringPosition.y);
        });
        if (!manager) return;
        const layout = calculateManagerDecorationLayout(manager);
        assignedHat?.setPosition(layout.hat.x, layout.hat.y);
        assignedRing?.setPosition(layout.ring.x, layout.ring.y);
        assignedLabel?.setPosition(layout.label.x, layout.label.y);
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, updateAssignedVisuals);

    const destroy = () => {
        scene.events.off(Phaser.Scenes.Events.UPDATE, updateAssignedVisuals);
        panel.destroy();
        title.destroy();
        status.destroy();
        sourceHat.destroy();
        dragGuide.destroy();
        clearTargetRings();
        clearAssignedVisuals();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);

    return {
        getManager: () => manager,
        setStatus,
        destroy,
    };
}

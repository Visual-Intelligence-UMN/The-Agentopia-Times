import Phaser from 'phaser';

import {
    finalizationPhaseForEvent,
    type FinalizationProgressPhase,
} from '../domain/finalizationProgress';

const PHASES: Array<{
    id: FinalizationProgressPhase;
    label: string;
    title: string;
    detail: string;
}> = [
    {
        id: 'strategy',
        label: 'STRATEGY',
        title: 'EVALUATING STRATEGY',
        detail: 'Checking how well your workflow controls the risk',
    },
    {
        id: 'scoring',
        label: 'SCORE',
        title: 'SCORING FINAL OUTPUT',
        detail: 'Writing and visualization judges are reviewing',
    },
    {
        id: 'publishing',
        label: 'PUBLISH',
        title: 'PUBLISHING REPORT',
        detail: 'Preparing your final report and results',
    },
];

const PANEL_DEPTH = 5000;
const GOLD = 0xf4bd4a;
const GREEN = 0x6fce8d;
const MUTED = 0x60657a;

export interface FinalizationProgressController {
    setPhase(phase: FinalizationProgressPhase): void;
    handleEvent(type: string): void;
    complete(): void;
    fail(): void;
    destroy(): void;
}

export function createFinalizationProgressHUD(
    scene: Phaser.Scene,
): FinalizationProgressController {
    const camera = scene.cameras.main;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2 - 8;
    const panel = scene.add
        .container(centerX, centerY)
        .setScrollFactor(0)
        .setDepth(PANEL_DEPTH)
        .setAlpha(0);

    const scrim = scene.add
        .rectangle(0, 0, camera.width, camera.height, 0x05060b, 0.22)
        .setOrigin(0.5);
    const shadow = scene.add
        .rectangle(5, 6, 420, 156, 0x000000, 0.5)
        .setOrigin(0.5);
    const background = scene.add
        .rectangle(0, 0, 420, 156, 0x0b0d15, 0.94)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0xffffff, 1);
    const header = scene.add
        .rectangle(0, -62, 416, 28, 0x9f3a12, 1)
        .setOrigin(0.5);
    const kicker = scene.add
        .text(-190, -69, 'FINAL REPORT PIPELINE', {
            fontFamily: 'Verdana',
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#ffffff',
        })
        .setLetterSpacing(2)
        .setOrigin(0, 0.5)
        .setResolution(2);

    const spinnerGraphics = scene.add.graphics();
    for (let index = 0; index < 8; index += 1) {
        const angle = Phaser.Math.DegToRad(index * 45);
        spinnerGraphics.fillStyle(GOLD, 0.28 + index * 0.09);
        spinnerGraphics.fillRect(
            Math.round(Math.cos(angle) * 12) - 2,
            Math.round(Math.sin(angle) * 12) - 2,
            5,
            5,
        );
    }
    const spinner = scene.add.container(-169, -26, [spinnerGraphics]);
    const title = scene.add
        .text(-143, -27, PHASES[0].title, {
            fontFamily: 'Verdana',
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#ffffff',
        })
        .setOrigin(0, 0.5)
        .setResolution(2);
    const detail = scene.add
        .text(-190, -3, PHASES[0].detail, {
            fontFamily: 'Verdana',
            fontSize: '9px',
            color: '#d7d9e0',
        })
        .setOrigin(0, 0.5)
        .setResolution(2);
    const elapsed = scene.add
        .text(190, -3, '0s', {
            fontFamily: 'Verdana',
            fontSize: '9px',
            color: '#f4bd4a',
        })
        .setOrigin(1, 0.5)
        .setResolution(2);

    const line = scene.add.rectangle(0, 30, 300, 2, MUTED, 0.9).setOrigin(0.5);
    const nodeXs = [-130, 0, 130];
    const nodes = PHASES.map((phase, index) => {
        const node = scene.add
            .rectangle(nodeXs[index], 30, 13, 13, 0x0b0d15, 1)
            .setStrokeStyle(2, MUTED, 1);
        const label = scene.add
            .text(nodeXs[index], 51, phase.label, {
                fontFamily: 'Verdana',
                fontSize: '8px',
                color: '#8f93a3',
            })
            .setOrigin(0.5)
            .setResolution(2);
        return { node, label };
    });

    panel.add([
        scrim,
        shadow,
        background,
        header,
        kicker,
        spinner,
        title,
        detail,
        elapsed,
        line,
        ...nodes.flatMap(({ node, label }) => [node, label]),
    ]);

    const spinnerTween = scene.tweens.add({
        targets: spinner,
        angle: 360,
        duration: 900,
        repeat: -1,
    });
    scene.tweens.add({
        targets: panel,
        alpha: 1,
        y: centerY + 8,
        duration: 220,
        ease: 'Sine.easeOut',
    });

    const startedAt = Date.now();
    let dotCount = 0;
    let currentTitle = PHASES[0].title;
    let destroyed = false;
    const timer = scene.time.addEvent({
        delay: 450,
        loop: true,
        callback: () => {
            if (destroyed) return;
            dotCount = (dotCount + 1) % 4;
            title.setText(`${currentTitle}${'.'.repeat(dotCount)}`);
            elapsed.setText(`${Math.floor((Date.now() - startedAt) / 1000)}s`);
        },
    });

    function setPhase(phaseId: FinalizationProgressPhase) {
        if (destroyed) return;
        dotCount = 0;
        const activeIndex = PHASES.findIndex(({ id }) => id === phaseId);
        const phase = PHASES[activeIndex];
        currentTitle = phase.title;
        title.setText(currentTitle);
        detail.setText(phase.detail);
        nodes.forEach(({ node, label }, index) => {
            label.setText(PHASES[index].label);
            if (index < activeIndex) {
                node.setFillStyle(GREEN, 1).setStrokeStyle(2, GREEN, 1);
                label.setColor('#6fce8d');
            } else if (index === activeIndex) {
                node.setFillStyle(GOLD, 1).setStrokeStyle(2, 0xffffff, 1);
                label.setColor('#f4bd4a');
            } else {
                node.setFillStyle(0x0b0d15, 1).setStrokeStyle(2, MUTED, 1);
                label.setColor('#8f93a3');
            }
        });
    }

    function destroy() {
        if (destroyed) return;
        destroyed = true;
        timer.remove(false);
        spinnerTween.stop();
        scene.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdownHandler);
        scene.events.off(Phaser.Scenes.Events.DESTROY, shutdownHandler);
        panel.destroy(true);
    }

    function finish(message: string, color: string) {
        if (destroyed) return;
        title.setText(message).setColor(color);
        detail.setText(
            message === 'REPORT READY'
                ? 'Opening the completed report'
                : 'The run stopped before publication',
        );
        spinner.setVisible(false);
        scene.tweens.add({
            targets: panel,
            alpha: 0,
            y: panel.y - 8,
            delay: message === 'REPORT READY' ? 180 : 800,
            duration: 220,
            ease: 'Sine.easeIn',
            onComplete: destroy,
        });
    }

    setPhase('strategy');
    const shutdownHandler = () => destroy();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdownHandler);
    scene.events.once(Phaser.Scenes.Events.DESTROY, shutdownHandler);

    return {
        setPhase,
        handleEvent(type) {
            if (type === 'quality_refinement_started') {
                currentTitle = 'PREPARING FINAL OUTPUT';
                title.setText(currentTitle);
                detail.setText('Preparing the report and charts for scoring');
                return;
            }
            const phase = finalizationPhaseForEvent(type);
            if (phase) setPhase(phase);
        },
        complete() {
            nodes.forEach(({ node, label }) => {
                node.setFillStyle(GREEN, 1).setStrokeStyle(2, GREEN, 1);
                label.setColor('#6fce8d');
            });
            finish('REPORT READY', '#6fce8d');
        },
        fail() {
            finish('FINALIZATION FAILED', '#ff8a65');
        },
        destroy,
    };
}

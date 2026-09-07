import { recorder } from "../game/utils/recorder";
import { strategyIconSize } from '../game/config/workflowStrategies';

export function createHoveredWindow(
    scene: any,
    pointer: any,
    width: number,
    height: number,
    windowContextText: string,
) {
    const hoveredWindowGroup = scene.add.group();
    const padding = 12;
    const margin = 8;
    const panelWidth = Math.min(width, scene.cameras.main.width - margin * 2);
    const hoverWindowText = scene.add
        .text(0, 0, windowContextText, {
            fontFamily: 'Verdana',
            fontSize: '14px',
            color: '#ffffff',
            align: 'left',
            wordWrap: { width: panelWidth - padding * 2, useAdvancedWrap: true },
        })
        .setScrollFactor(0)
        .setDepth(1012)
        .setOrigin(0, 0)
        .setStroke('#000000', 2);
    const panelHeight = Math.max(height, hoverWindowText.height + padding * 2);
    const left = Math.max(margin, Math.min(pointer.x, scene.cameras.main.width - panelWidth - margin));
    const top = Math.max(margin, pointer.y - panelHeight - margin);
    const hoverWindow = scene.add
        .rectangle(left, top, panelWidth, panelHeight, 0x000000)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(1011)
        .setAlpha(0.5)
        .setStrokeStyle(2, 0xffffff);
    hoverWindowText.setPosition(left + padding, top + padding);

    hoveredWindowGroup.add(hoverWindow);
    hoveredWindowGroup.add(hoverWindowText);
    return hoveredWindowGroup;
}

export function removeHoveredWindow(hoveredWindowGroup: any) {
    if (hoveredWindowGroup) {
        hoveredWindowGroup.clear(true, true);
    }
}

export function addEventToStrategy(
    scene: any,
    btn: any,
    icon: any,
    strategyDescription: string,
    index: number,
    strategy: string
) {
    let hoveredWindow: any = null;
    // adding interactions for icons
    icon.on('pointerover', (pointer: any) => {
        hoveredWindow = createHoveredWindow(
            scene,
            pointer,
            275,
            100,
            strategyDescription,
        );
    })
        .on('pointerout', (pointer: any) => {
            removeHoveredWindow(hoveredWindow);
            hoveredWindow = null;
        })
        .on('pointerdown', (pointer: any) => {
            if (scene.registry.get('isWorkflowRunning')) return;
            console.log(`Strategy ${index} clicked: ${strategy}`);
            const tempConfig = [...scene.registry.get("workflowConfig")];
            tempConfig[index] = strategy;
            scene.registry.set("workflowConfig", tempConfig);
            btn.setTexture(strategy);
            btn.setDisplaySize(strategyIconSize(strategy), strategyIconSize(strategy));
            console.log("Updated workflowConfig:", scene.registry.get("workflowConfig"));
            recorder.recordEvent(`strategy_selected_${strategy}`); // Log event when strategy is selected
        });
}

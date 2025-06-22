export function createHoveredWindow(
    scene: any,
    pointer: any,
    width: number,
    height: number,
    windowContextText: string,
) {
    const hoveredWindowGroup = scene.add.group();
    const rectX = pointer.x + width / 2;
    const rectY = pointer.y - height / 2;
    const hoverWindow = scene.add
        .rectangle(rectX, rectY, width, height, 0x000000)
        .setScrollFactor(0)
        .setDepth(1011)
        .setAlpha(0.5)
        .setStrokeStyle(2, 0xffffff);
    const hoverWindowText = scene.add
        .text(rectX, rectY, windowContextText)
        .setScrollFactor(0)
        .setDepth(1012)
        .setAlpha(1)
        .setFontSize(12.5)
        .setColor('#ffffff')
        .setStyle({ fontFamily: 'Verdana', fontSize: '14px', color: '#ffffff' })
        .setOrigin(0.5, 0.5)
        .setStroke('#000000', 2);

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
            console.log(`Strategy ${index} clicked: ${strategy}`);
            const tempConfig = scene.registry.get("workflowConfig");
            tempConfig[index] = strategy;
            scene.registry.set("workflowConfig", tempConfig);
            btn.setTexture(strategy);
            console.log("Updated workflowConfig:", scene.registry.get("workflowConfig"));
        });
}
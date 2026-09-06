export interface ManagerDecorationAnchor {
    x: number;
    y: number;
    displayHeight: number;
    originY: number;
}

export interface ManagerDecorationLayout {
    hat: { x: number; y: number };
    label: { x: number; y: number };
    ring: { x: number; y: number };
}

export interface ManagerPanelLayout {
    panel: { centerY: number; height: number };
    titleY: number;
    hatY: number;
    statusY: number;
}

const ACTION_PANEL_TOP = 255;
export const ACTION_PANEL_VERTICAL_SHIFT = 20;

export function shiftActionPanelY(y: number): number {
    return y - ACTION_PANEL_VERTICAL_SHIFT;
}

export function calculateManagerPanelLayout(
    viewportHeight: number,
): ManagerPanelLayout {
    const panelHeight = viewportHeight - ACTION_PANEL_TOP;

    return {
        panel: {
            centerY: shiftActionPanelY(ACTION_PANEL_TOP + panelHeight / 2),
            height: panelHeight,
        },
        titleY: shiftActionPanelY(viewportHeight - 77),
        hatY: shiftActionPanelY(viewportHeight - 39),
        statusY: shiftActionPanelY(viewportHeight - 11),
    };
}

export function calculateManagerDecorationLayout(
    agent: ManagerDecorationAnchor,
): ManagerDecorationLayout {
    const top = agent.y - agent.displayHeight * agent.originY;
    const bottom = agent.y + agent.displayHeight * (1 - agent.originY);

    return {
        hat: { x: agent.x, y: top + 17 },
        label: { x: agent.x, y: top - 1 },
        ring: { x: agent.x, y: bottom - 1 },
    };
}

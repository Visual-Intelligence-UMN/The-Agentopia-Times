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
export const CONTROL_STACK_VERTICAL_SHIFT = 40;
export const ACTION_GROUP_ADDITIONAL_SHIFT = 12;

export function shiftControlStackY(y: number): number {
    return y - CONTROL_STACK_VERTICAL_SHIFT;
}

export function shiftActionGroupY(y: number): number {
    return shiftControlStackY(y) - ACTION_GROUP_ADDITIONAL_SHIFT;
}

export function calculateManagerPanelLayout(
    viewportHeight: number,
): ManagerPanelLayout {
    const panelHeight = viewportHeight - ACTION_PANEL_TOP;

    return {
        panel: {
            centerY: shiftActionGroupY(ACTION_PANEL_TOP + panelHeight / 2),
            height: panelHeight,
        },
        titleY: shiftActionGroupY(viewportHeight - 77),
        hatY: shiftActionGroupY(viewportHeight - 39),
        statusY: shiftActionGroupY(viewportHeight - 11),
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

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
export const RESET_ADDITIONAL_LIFT = 8;
export const PANEL_BOTTOM_EXTENSION = 24;
export const MANAGER_SECTION_DROP = 16;

export function shiftControlStackY(y: number): number {
    return y - CONTROL_STACK_VERTICAL_SHIFT;
}

export function shiftActionGroupY(y: number): number {
    return shiftControlStackY(y) - ACTION_GROUP_ADDITIONAL_SHIFT;
}

export function shiftResetY(y: number): number {
    return shiftActionGroupY(y) - RESET_ADDITIONAL_LIFT;
}

function shiftManagerSectionY(y: number): number {
    return shiftActionGroupY(y) + MANAGER_SECTION_DROP;
}

export function calculateManagerPanelLayout(
    viewportHeight: number,
): ManagerPanelLayout {
    const panelTop = shiftActionGroupY(ACTION_PANEL_TOP);
    const panelBottom =
        shiftActionGroupY(viewportHeight) + PANEL_BOTTOM_EXTENSION;
    const panelHeight = panelBottom - panelTop;

    return {
        panel: {
            centerY: panelTop + panelHeight / 2,
            height: panelHeight,
        },
        titleY: shiftManagerSectionY(viewportHeight - 77),
        hatY: shiftManagerSectionY(viewportHeight - 39),
        statusY: shiftManagerSectionY(viewportHeight - 11),
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

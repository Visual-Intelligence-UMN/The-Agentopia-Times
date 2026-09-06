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

export function calculateDistance(
    point1: { x: number, y: number },
    point2: { x: number, y: number }
): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

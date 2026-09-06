import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateManagerDecorationLayout } from '../src/game/utils/managerVisualLayout.ts';

test('anchors the manager hat to the actual top edge of the agent sprite', () => {
    const layout = calculateManagerDecorationLayout({
        x: 400,
        y: 300,
        displayHeight: 64,
        originY: 0.5,
    });

    assert.deepEqual(layout, {
        hat: { x: 400, y: 285 },
        label: { x: 400, y: 267 },
        ring: { x: 400, y: 331 },
    });
});

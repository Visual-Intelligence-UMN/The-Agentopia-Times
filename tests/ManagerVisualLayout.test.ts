import assert from 'node:assert/strict';
import test from 'node:test';

import {
    calculateManagerDecorationLayout,
    calculateManagerPanelLayout,
    shiftActionGroupY,
    shiftControlStackY,
} from '../src/game/utils/managerVisualLayout.ts';

test('uses one continuous action panel for the existing controls and Manager', () => {
    assert.equal(shiftControlStackY(150), 110);
    assert.equal(shiftActionGroupY(220), 168);
    assert.deepEqual(calculateManagerPanelLayout(640), {
        panel: { centerY: 395.5, height: 385 },
        titleY: 511,
        hatY: 549,
        statusY: 577,
    });
});

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

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    calculateManagerDecorationLayout,
    calculateManagerPanelLayout,
} from '../src/game/utils/managerVisualLayout.ts';

test('uses one continuous action panel for the existing controls and Manager', () => {
    assert.deepEqual(calculateManagerPanelLayout(640), {
        panel: { centerY: 427.5, height: 385 },
        titleY: 543,
        hatY: 581,
        statusY: 609,
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

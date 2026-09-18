import assert from 'node:assert/strict';
import test from 'node:test';

import {
    renderCaseStudyContent,
    revealCaseStudyMarks,
} from '../src/game/caseStudy/highlight.ts';
import { caseStudyWorkflows } from '../src/game/caseStudy/session.ts';
import { getCaseStudyScript } from '../src/game/caseStudy/scripts.ts';
import { inspectRiskConfiguration } from '../src/game/domain/levelCompletionPolicy.ts';
import { renderRichText } from '../src/utils/markdown.ts';

test('case study marks use the verifier yellow class only when enabled', () => {
    const html = renderRichText('==Jeter holds the advantage in both years==');
    assert.match(html, /<mark>Jeter holds the advantage in both years<\/mark>/);
    assert.doesNotMatch(html, /<mark><p>/);
    assert.equal(
        revealCaseStudyMarks(html, false),
        html,
    );
    assert.match(
        revealCaseStudyMarks(html, true),
        /<mark class="verification-mark">Jeter holds the advantage in both years<\/mark>/,
    );
});

test('case study bakes title and article == highlights before markdown', () => {
    const script = getCaseStudyScript('incorrect');
    const title = renderCaseStudyContent(
        script.stages[0].lines[1].text,
        (text) => renderRichText(text, 'markdown'),
        true,
    );
    const article = renderCaseStudyContent(
        script.stages[1].report,
        (text) => renderRichText(text, script.stages[1].format),
        true,
    );
    assert.match(
        title,
        /<mark class="verification-mark">Jeter Ahead in Both 1995 and 1996 as Justice Takes the Combined Crown<\/mark>/,
    );
    assert.match(
        article,
        /<mark class="verification-mark">Jeter holds the advantage in both years<\/mark>/,
    );
    assert.match(
        article,
        /<mark class="verification-mark">Justice records the stronger overall batting average<\/mark>/,
    );
    assert.doesNotMatch(article, /==/);
});


test('incorrect case study keeps an unsafe sequential then single-agent pipeline', () => {
    const script = getCaseStudyScript('incorrect');
    assert.deepEqual(script.workflow, [
        'sequential',
        'single_agent',
        'sequential',
    ]);
    assert.deepEqual(script.workflow, caseStudyWorkflows.incorrect);
    assert.equal(script.strategyScore, 7);
    assert.equal(script.strategyScore < 8, true);
    assert.equal(script.writingScore, '6/10');
    assert.equal(script.codingScore, '6/10');
    assert.equal(script.outputScore, 6);
    assert.equal(script.writingComments.length >= 3, true);
    assert.equal(script.visualizationComments.length >= 2, true);
    assert.equal(script.stages[0].lines.length, 3);
    assert.equal(script.stages[1].lines.length, 1);
    assert.match(
        script.stages[1].report,
        /Jeter Leads Each Season, but Justice Takes the Overall Edge/,
    );
    assert.match(script.stages[1].report, /==Jeter holds the advantage in both years==/);
    assert.doesNotMatch(script.stages[1].report, /Independent vote/);
    assert.equal(script.stages[1].title, 'Intermediate Report');
    assert.equal(script.stages[1].lines[0].text, script.stages[1].report);
    assert.equal(script.stages[2].lines.length, 3);
    assert.match(script.stages[2].lines[0].text, /"title": "Season batting averages"/);
    assert.match(script.stages[2].lines[1].text, /"comparison": "Pooled"/);
    assert.match(script.stages[2].lines[2].text, /"clip": true/);
    assert.equal(script.stages[2].report, script.stages[2].lines[2].text);
    assert.equal(script.stages[2].chartCode, undefined);
    assert.notEqual(script.stages[2].lines[0].text, script.stages[2].lines[1].text);
    assert.notEqual(script.stages[2].lines[1].text, script.stages[2].lines[2].text);
    assert.deepEqual(
        JSON.parse(script.finalChartCode),
        JSON.parse(
            script.stages[2].lines[2].text
                .replace(/^```json\n/, '')
                .replace(/\n```$/, ''),
        ),
    );
    assert.match(
        script.stages[0].lines[0].text,
        /==Jeter Leads Both Seasons, but Justice Finishes Ahead Overall==/,
    );
    assert.match(
        script.stages[0].lines[1].text,
        /==Jeter Ahead in Both 1995 and 1996 as Justice Takes the Combined Crown==/,
    );
    assert.match(
        script.stages[0].lines[2].text,
        /==Jeter Leads Each Season, Justice Still Wins Overall==/,
    );
    assert.match(
        script.stages[0].report,
        /<mark class="verification-mark">Jeter Leads Each Season, Justice Still Wins Overall<\/mark>/,
    );
    assert.equal(script.stages[0].format, 'html');
    assert.doesNotMatch(script.stages[0].report, /Headline/);
    assert.equal(script.stages[0].title, 'Intermediate Report');
    assert.equal(
        script.finalTitle,
        'Jeter Leads Each Season, but Justice Takes the Overall Edge',
    );
    assert.match(script.finalReport, /Jeter appears stronger year by year/);
    assert.match(script.finalReport, /Jeter holds the advantage in both years/);
    assert.doesNotMatch(script.finalReport, /sequential newsroom treated/);
    assert.equal(
        inspectRiskConfiguration({
            levelId: 'level1',
            datasetId: 'baseball',
            risk: 'error_propagation',
            requiredScore: 8,
            managerId: 'visualizer',
            managerReviewApproved: true,
            stages: [
                {
                    strategy: 'sequential',
                    agents: [{ id: 'ghost', ghost: true }],
                },
                {
                    strategy: 'single_agent',
                    agents: [{ id: 'writer', ghost: false }],
                },
                {
                    strategy: 'sequential',
                    agents: [{ id: 'visualizer', ghost: false }],
                },
            ],
        }).correct,
        false,
    );
});

test('correct case study votes in the ghost room then discusses', () => {
    const script = getCaseStudyScript('correct');
    assert.deepEqual(script.workflow, [
        'voting',
        'voting',
        'discussion',
    ]);
    assert.equal(script.strategyScore, 8);
    assert.equal(script.writingScore, '10/10');
    assert.equal(script.codingScore, '7/10');
    assert.equal(script.outputScore, 8.8);
    assert.equal(script.stages[0].lines.length, 3);
    assert.match(
        script.stages[0].lines[0].text,
        /==Year-by-Year Edge for Jeter, Overall Advantage for Justice==/,
    );
    assert.match(
        script.stages[0].report,
        /The Baseball Paradox: Two Seasons, One Surprise as Aggregated Data Reversed the Result/,
    );
    assert.doesNotMatch(script.stages[0].report, /Year-by-Year Edge for Jeter/);
    assert.doesNotMatch(script.stages[0].report, /Headline/);
    assert.equal(script.stages[0].title, 'Intermediate Report');
    assert.equal(script.stages[1].lines.length, 3);
    assert.match(script.stages[1].lines[0].text, /# Title: Justice Ahead in Both 1995 and 1996/);
    assert.match(script.stages[1].lines[1].text, /Jeter's Combined Average Hides a Seasonal Gap/);
    assert.match(script.stages[1].lines[2].text, /Two Seasons and One Combined Table/);
    assert.match(script.stages[1].report, /# Title: The Baseball Paradox/);
    assert.notEqual(script.stages[1].report, script.stages[1].lines[0].text);
    assert.match(script.stages[1].report, /Simpson's Paradox/);
    assert.match(script.stages[1].report, /\.253 vs \.250/);
    assert.doesNotMatch(script.stages[1].report, /Independent vote/);
    assert.equal(script.stages[1].title, 'Intermediate Report');
    assert.match(script.stages[2].lines[0].text, /"title": "Season batting averages"/);
    assert.match(script.stages[2].lines[1].text, /"comparison": "Pooled"/);
    assert.match(script.stages[2].lines[2].text, /Simpson's Paradox/);
    assert.equal(script.stages[2].report, script.stages[2].lines[2].text);
    assert.equal(script.stages[2].chartCode, undefined);
    assert.equal(
        script.finalTitle,
        'The Baseball Paradox: Two Seasons, One Surprise as Aggregated Data Reversed the Result',
    );
    assert.match(script.finalReport, /Simpson's Paradox/);
    assert.match(script.finalReport, /\.253 vs \.250/);
    assert.doesNotMatch(script.finalReport, /Jeter leads both 1995/);
    assert.deepEqual(
        JSON.parse(script.finalChartCode),
        JSON.parse(
            script.stages[2].lines[2].text
                .replace(/^```json\n/, '')
                .replace(/\n```$/, ''),
        ),
    );
    assert.equal(
        inspectRiskConfiguration({
            levelId: 'level1',
            datasetId: 'baseball',
            risk: 'error_propagation',
            requiredScore: 8,
            managerId: 'writer',
            managerReviewApproved: true,
            stages: [
                {
                    strategy: 'voting',
                    agents: [
                        { id: 'ghost', ghost: true },
                        { id: 'voter-2', ghost: false },
                        { id: 'voter-3', ghost: false },
                    ],
                },
                {
                    strategy: 'voting',
                    agents: [
                        { id: 'writer', ghost: false },
                        { id: 'analyst', ghost: false },
                    ],
                },
                {
                    strategy: 'discussion',
                    agents: [{ id: 'visualizer', ghost: false }],
                },
            ],
        }).correct,
        true,
    );
});

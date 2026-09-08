import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

import { goldOutputs } from '../src/game/config/goldOutputs.ts';
import { finalizeLevelOutput } from '../src/langgraph/finalizeLevelRun.ts';
import { runQualityEditor } from '../src/langgraph/qualityEditor.ts';

test('the LLM adapter forwards corrective retry messages instead of rebuilding the original prompt', async () => {
    let calls = 0;
    const imports: Record<string, unknown> = {
        '@langchain/openai': { ChatOpenAI: class {
            async invoke(messages: Array<{ content: string }>) {
                calls += 1;
                if (calls === 1) return { content: '{}' };
                assert.match(messages.at(-1)!.content, /failed validation/);
                return { content: JSON.stringify({ reportMarkdown: goldOutputs.baseball.reportMarkdown, visualizationSpec: goldOutputs.baseball.visualizationSpec }) };
            }
        } },
        '../utils/openai': { getStoredOpenAIKey: () => 'test-only' },
        './config': { getMASModels: () => ({ judge: 'test-only' }) },
        './masTrace': { createMASTraceCallback() {} },
        './openaiRequestGate': { getOpenAIRequestFetch() {} },
        './qualityEditor': { runQualityEditor },
        './strategyJudge': {},
    };
    const exports: Record<string, any> = {};
    const source = ts.transpileModule(readFileSync(new URL('../src/langgraph/qualityPipelineLLM.ts', import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    runInNewContext(source, { exports, require: (id: string) => {
        assert.ok(id in imports, `Unexpected dependency: ${id}`);
        return imports[id];
    } });
    await exports.refineOutputWithLLM({ dataset: { goldOutput: goldOutputs.baseball }, rubrics: [] });
    assert.equal(calls, 2);
});

for (const failure of ['refinement', 'scoring', 'publishing']) {
    test(`scene preserves completed scores after ${failure} failure`, async () => {
        const panels: any[][] = [];
        let published = false;
        const imports: Record<string, unknown> = {
            '../game/domain/levelCompletionPolicy': { createLevelCompletionOutcome: (value: unknown) => value },
            '../game/domain/levelRunEvaluation': { buildLevelRunConfiguration: () => ({
                risk: 'error_propagation', managerId: null, managerReviewApproved: false,
                stages: [{ strategy: 'voting', agents: [
                    { ghost: true }, { ghost: false }, { ghost: false },
                ] }],
            }) },
            '../game/utils/finalizationProgressHUD': { createFinalizationProgressHUD: () => ({ handleEvent() {}, complete() {}, fail() {} }) },
            '../game/utils/recorder': { recorder: { recordEvent() {} } },
            './finalizeLevelRun': { finalizeLevelOutput },
            '../game/config': {
                getDatasetConfig: () => ({ id: 'baseball', goldOutput: goldOutputs.baseball }),
                getGameConfig: () => ({ mas: { judge: { scoringRubrics: [] } } }),
            },
            './masTrace': { getLatestMASTrace: () => null, recordMASStage() {} },
            './outputVerifier': { createOutputVerification: () => ({ stage: () => 'verification' }) },
            './qualityPipelineLLM': {
                judgeStrategyWithLLM: async () => ({ score: 8, explanation: 'Contained', evidence: [] }),
                refineOutputWithLLM: (input: any, signal: AbortSignal) => runQualityEditor(input, {
                    signal,
                    complete: async () => JSON.stringify({
                        reportMarkdown: goldOutputs.baseball.reportMarkdown,
                        visualizationSpec: failure === 'refinement' ? { title: 'Missing chart' } : goldOutputs.baseball.visualizationSpec,
                    }),
                }),
            },
            './workflowUtils': {
                createScoreUI: (...args: any[]) => panels.push(args),
                startJudges: async () => {
                    assert.equal(panels[0][8], 8, 'Strategy must be visible before grading');
                    assert.equal(panels[0][3], null, 'Pending output is not a zero score');
                    if (failure === 'scoring') throw new Error('Scoring unavailable');
                    return { comments: [], writingComments: [], highlightedText: 'Report' };
                },
                startScoreComputer: () => ({ overall_score: '6.4', writing_score: '6', coding_score: '7', writing_reasons: [], coding_reasons: [] }),
                startHTMLConstructor: async () => {
                    assert.equal(panels.at(-1)![3], 6.4, 'Scores must appear before publishing');
                    if (failure === 'publishing') throw new Error('Publishing unavailable');
                    published = true;
                },
            },
        };
        const exports: Record<string, any> = {};
        const source = ts.transpileModule(readFileSync(new URL('../src/langgraph/sceneLevelFinalization.ts', import.meta.url), 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        runInNewContext(source, { exports, require: (id: string) => {
            assert.ok(id in imports, `Unexpected dependency: ${id}`);
            return imports[id];
        } });
        const run = exports.finalizeSceneLevelRun({
            scene: {}, level: { id: 'level1', mas: { agenticRisk: 'error_propagation' } },
            datasetId: 'baseball', workflow: ['voting', 'voting', 'voting'],
            draftReport: 'The actual original Voting report.', draftVisualization: '{"mark":"point"}',
        });
        if (failure === 'refinement') {
            const result = await run;
            assert.equal(result.finalReport, 'The actual original Voting report.');
            assert.equal(result.refinement.applied, false);
            assert.equal(published, true);
            assert.match(panels.at(-1)![10], /original workflow output/);
        } else {
            await assert.rejects(run, /unavailable/);
        }
        assert.equal(panels.at(-1)![8], 8);
        assert.equal(panels.at(-1)![3], failure === 'scoring' ? null : 6.4);
        if (failure === 'scoring') assert.equal(panels.at(-1)![9], 'Unavailable');
        assert.equal(panels.length, 2, 'Do not overwrite completed scores on publishing failure');
    });
}

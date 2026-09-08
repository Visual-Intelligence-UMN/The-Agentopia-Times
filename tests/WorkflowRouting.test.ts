import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Execute the real orchestration modules with only browser/LLM boundaries mocked.
function loadModule(file: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}) {
    const exports: Record<string, any> = {};
    const source = ts.transpileModule(
        readFileSync(new URL(file, import.meta.url), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText;
    const require = createRequire(import.meta.url);
    runInNewContext(source, {
        exports,
        require: (id: string) => id in imports ? imports[id] : require(id),
        console: { log() {}, warn() {}, error() {} },
        AbortController,
        ...globals,
    });
    return exports;
}

const dataset = { id: 'baseball', label: 'Baseball', description: 'REAL EVIDENCE' };
const dependencies = {
    '../utils/finalReport': {},
    '../game/EventBus': { EventBus: { emit() {} } },
    '../game/config/productionAgentPolicy.ts': {
        prepareProductionContext: (text: string) => text,
    },
    './agents': {},
    './chainingUtils': {},
    './config': {
        getDatasetConfigForScene: () => dataset,
        getHallucinationStats: () => 'GHOST EVIDENCE',
    },
    './const': {},
    './dalleUtils': {},
    './visualizationGenerate': {},
    './injectedErrorContract': {},
    './judgeOutput': {},
};
const workflow = loadModule('../src/langgraph/workflowUtils.ts', dependencies);

for (const level of [1, 2, 3]) {
    test(`level ${level} resets results and completes without a fixed Manager gate`, () => {
        const source = readFileSync(new URL(`../src/game/scenes/level${level}.tsx`, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /editorialReview|publicationBlocked/);
        assert.match(source, /resetRunResultUI\(this\)/);
        for (const name of ['run-result-banner', 'run-next-level-bg', 'run-next-level-button']) {
            assert.ok(source.includes(`setName('${name}')`));
        }
    });
}

test('starting another run clears old scores, outcome banners and next-level controls', () => {
    const destroyed: string[] = [];
    const removed: string[] = [];
    const objects = new Map(['run-result-banner', 'run-next-level-bg', 'run-next-level-button'].map(name => [name, { destroy() { destroyed.push(name); } }]));
    const scene = {
        scoreValueText: { destroy() { destroyed.push('score'); } },
        children: { getByName: (name: string) => objects.get(name) },
        tweens: { killTweensOf() {} }, registry: { remove: (name: string) => removed.push(name) },
    };
    workflow.resetRunResultUI(scene);
    assert.deepEqual(destroyed.sort(), ['score', ...objects.keys()].sort());
    assert.deepEqual(removed.sort(), ['finalScore', 'levelCompletionOutcome', 'managerVerificationResults']);
});

test('shared dataset context without an agent is neutral, never a Ghost request', () => {
    assert.equal(workflow.returnDatasetDescription({}), 'REAL EVIDENCE');
    assert.equal(workflow.returnDatasetDescription({}, { getBias: () => '' }), 'REAL EVIDENCE');
    assert.equal(
        workflow.returnDatasetDescription({}, { getBias: () => 'biased', getBiasType: () => 'error_propagation' }),
        'Baseball\nGHOST EVIDENCE',
    );
});

for (const stage of [0, 1, 2]) {
    test(`room ${stage + 1} Voting reaches aggregation and returns its final artifact`, async () => {
        let aggregations = 0;
        const llm = { invoke: async () => {
            aggregations++;
            return { content: 'AGGREGATED' };
        } };
        const verification = { agent() {}, stage() {} };
        const voting = loadModule('../src/langgraph/votingUtils.ts', {
            './managerVerification': { verifyManagerArtifact: async (_scene: unknown, _agent: unknown, _index: number, artifact: string) => artifact },
            '../game/utils/controlUtils': { autoControlAgent: async () => {}, transmitReport: async () => {} },
            './chainingUtils': { initializeLLM: () => llm },
            '../game/EventBus': { EventBus: { emit() {} } },
            './agents': { createReport: async () => ({}) },
            '../game/utils/sceneUtils': {},
            './states': loadModule('../src/langgraph/states.ts', {}),
            './workflowUtils': {
                returnDatasetDescription: workflow.returnDatasetDescription,
                startDataFetcher: async () => ({ content: 'ANALYSIS' }),
                startTextMessager: async () => ({ content: 'VOTE' }),
            },
            './visualizationGenerate': { generateChartImage: async () => ({ chartId: 'chart', d3Code: '{"mark":"bar"}' }) },
            './config': { getAgentMASPrompt: () => '', getHallucinationInstruction: () => '' },
            './outputVerifier': { createOutputVerification: () => verification },
            '../game/config/productionAgentPolicy.ts': { PRODUCTION_WORKING_PREMISE: '' },
        });
        const agents = [0, 1, 2].map((id) => ({
            x: id, y: 0, getName: () => `Agent${id}`, getBias: () => '',
            getBiasType: () => '', setAgentState() {}, setAgentInformation() {}, addMssgSprite() {},
        }));
        const graph = voting.constructVotingGraph(
            agents, { registry: { get: () => ['voting', 'voting', 'voting'] } },
            {}, { x: 0, y: 0 }, { x: 1, y: 1 }, stage, 'level1',
        );
        const output = await graph.invoke({ votingInput: 'UPSTREAM' });
        assert.equal(output.votingOutput, 'AGGREGATED');
        assert.equal(output.votingInput, 'UPSTREAM');
        assert.equal(aggregations, 1);
    });
}

test('structured manager responses request strict JSON and bypass production rewriting', async () => {
    let options: any;
    const structured = { content: '{"verdict":"approve"}' };
    const module = loadModule('../src/langgraph/workflowUtils.ts', {
        ...dependencies,
        './agents': { getLLM: () => ({ invoke: async (_messages: unknown, config: unknown) => {
            options = config;
            return structured;
        } }) },
        './injectedErrorContract': { applyMandatoryInjectedError() { throw new Error('must not rewrite JSON'); } },
    });
    const domain = loadModule('../src/game/domain/editorialManager.ts', {});
    const result = await module.startTextMessager('Review', 'Draft', undefined, domain.editorialDecisionResponseFormat);
    assert.equal(result, structured);
    assert.equal(options.response_format.json_schema.strict, true);
});

test('removed or renamed agents do not leave phantom room occupants', () => {
    const sceneUtils = loadModule('../src/game/utils/sceneUtils.ts', {
        'pathfinding': {}, 'phaser-jsx': {}, '../../utils/interactionUtils': {},
        '../assets/atlas': {}, '../assets/sprites': {}, '../components': {},
        '../constants': {}, '../EventBus': {}, '../scenes': {}, '../sprites/Agent': {},
        '../config/workflowStrategies': {}, './controlUtils': {}, './hudUtils': {},
    }, { Phaser: { Geom: { Intersects: { RectangleToRectangle: () => true } } } });
    const occupants = new Set(['Old Ghost Name', 'Agent 2']);
    const agents = ['New Ghost Name', 'Agent 2'].map(name => ({ getName: () => name, getBounds: () => ({}) }));
    sceneUtils.setZonesExitingDecoration([{ agentsInside: occupants, zone: { getBounds: () => ({}) } }], { getChildren: () => agents });
    assert.deepEqual([...occupants], ['Agent 2']);
});

test('independent Manager assessment sends structured format with complete count evidence', async () => {
    let request: any[] = [];
    const domain = loadModule('../src/game/domain/editorialManager.ts', {});
    const assessment = { centralClaim: 'Claim', supportingEvidence: ['Evidence'], contradictions: [], caveats: [], confidence: 'high' };
    const manager = loadModule('../src/langgraph/editorialManager.ts', {
        '../game/domain/editorialManager': domain,
        '../game/domain/managerAssessmentCoordinator': {},
        '../game/utils/recorder': { recorder: { recordEvent() {} } },
        './config': { getDatasetConfigForScene: () => ({ ...dataset, csvPath: '/data.csv' }) },
        './masTrace': { recordMASStage() {} },
        '../vega/visualizationData': { getVisualizationData: () => 'COMPLETE COUNTS' },
        './workflowUtils': { startTextMessager: async (...args: unknown[]) => { request = args; return { content: JSON.stringify(assessment) }; } },
    }, { fetch: async () => ({ ok: true, text: async () => 'CSV DATA' }) });
    await manager.createIndependentEditorialAssessment({}, { getName: () => 'Manager', setAgentInformation() {} });
    assert.equal(request[3], domain.editorialAssessmentResponseFormat);
    assert.match(request[1], /COMPLETE COUNTS/);
    assert.match(request[1], /CSV DATA/);
    assert.doesNotMatch(request[1], /Candidate report/);
});

for (const chart of ['{"mark":"bar","data":{"values":[{"value":123}]}}', '{"title":"Invalid spec with no mark"}']) {
    test(`Visualization Discussion forwards its own artifact to scoring: ${chart}`, async () => {
        const discussion = loadModule('../src/langgraph/discussionUtils.ts', {
            './managerVerification': { verifyManagerArtifact: async (_scene: unknown, _agent: unknown, _index: number, artifact: string) => artifact },
            '../game/config': { getGameConfig: () => ({ mas: { agents: { discussion: { visualization_creation: { agent_instructions: 'Make chart' } } } } }) },
            '../game/domain/discussion': { runDiscussion: async () => ({ summary: { input: {} }, output: chart }) },
            '../game/domain/workflowRun': { abortableWorkflowStep: async (step: Promise<unknown>) => step },
            '../game/EventBus': { EventBus: { emit() {} } },
            '../game/utils/controlUtils': { autoControlAgent: async () => {}, transmitReport: async () => {} },
            '../game/utils/recorder': { recorder: { recordEvent() {} } },
            '../vega/visualizationData': { getVisualizationData: () => '[{"value":999}]', getVisualizationDataForAgent: () => '[{"value":999}]' },
            '../game/config/productionAgentPolicy.ts': { prepareProductionContext: (text: string) => text },
            './agents': { createReport: async () => ({}) },
            './config': { getDatasetConfigForScene: () => dataset, getAgentMASPrompt: () => '' },
            './masTrace': { recordMASStage() {} },
            './outputVerifier': { createOutputVerification: () => ({ stage() {} }) },
            './workflowUtils': {},
        });
        const graph = discussion.constructDiscussionGraph(
            [{ x: 0, y: 0, getName: () => 'Agent', getBias: () => '', getBiasType: () => '', setAgentState() {} }],
            { events: { once() {} } }, {}, { x: 0, y: 0 }, { x: 1, y: 1 }, 2,
        );
        const output = await graph.invoke({ discussionInput: 'UPSTREAM ARTICLE' });
        assert.equal(output.discussionOutput, chart);
    });
}

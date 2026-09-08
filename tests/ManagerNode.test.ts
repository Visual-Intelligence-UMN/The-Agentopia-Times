import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file: string, imports: Record<string, unknown>) {
    const exports: Record<string, any> = {};
    const code = ts.transpileModule(
        readFileSync(new URL(file, import.meta.url), 'utf8'),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        },
    ).outputText;
    runInNewContext(code, {
        exports,
        require: (id: string) => (id in imports ? imports[id] : require(id)),
        console,
        AbortController,
    });
    return exports;
}

function verificationHarness(complete: (...args: any[]) => Promise<any>) {
    const values = new Map<string, unknown>();
    const trace: any[] = [];
    const scene = {
        registry: {
            get: (key: string) => values.get(key),
            set: (key: string, value: unknown) => values.set(key, value),
        },
    };
    const manager = { getName: () => 'Writer', isEditorialManager: () => true };
    const module = load('../src/langgraph/managerVerification.ts', {
        'vega-lite': { compile() {} },
        '../vega/visualizationData': {
            getVisualizationData: () => 'ORIGINAL COUNTS',
        },
        './config': { getDatasetConfigForScene: () => ({ id: 'baseball' }) },
        './masTrace': { recordMASStage: (stage: unknown) => trace.push(stage) },
        './workflowUtils': { startTextMessager: complete },
    });
    return { ...module, scene, manager, trace };
}

test('verification receives the entire upstream input, not merely its own draft', async () => {
    const h = verificationHarness(async (system, user) => {
        assert.match(system, /Verify the complete received input/);
        const payload = JSON.parse(user);
        assert.equal(payload.input, 'UPSTREAM FALSE CLAIM + prior discussion');
        assert.equal(payload.taskExecutionDraft, 'local task draft');
        assert.equal(payload.originalCounts, 'ORIGINAL COUNTS');
        return {
            content: JSON.stringify({
                status: 'verified',
                issues: [],
                artifact: 'corrected task output',
            }),
        };
    });
    assert.equal(
        await h.verifyManagerArtifact(
            h.scene,
            h.manager,
            1,
            'local task draft',
            'UPSTREAM FALSE CLAIM + prior discussion',
        ),
        'corrected task output',
    );
    assert.equal(
        h.getManagerVerificationSummary(h.scene, 'Writer').approved,
        true,
    );
    assert.equal(
        h.getManagerVerificationSummary(h.scene, 'Someone else').approved,
        false,
    );
    assert.equal(h.trace[1].stageIndex, 1);
});

test('ordinary participants do not receive extra evidence or a verification call', async () => {
    const h = verificationHarness(async () => {
        throw new Error('unexpected request');
    });
    assert.equal(
        await h.verifyManagerArtifact(
            h.scene,
            { isEditorialManager: () => false },
            0,
            'original',
        ),
        'original',
    );
    assert.equal(h.trace.length, 0);
});

for (const mode of ['malformed', 'network', 'concerns']) {
    test(`verification ${mode} preserves a usable node output without blocking downstream`, async () => {
        const h = verificationHarness(async () => {
            if (mode === 'network') throw new Error('offline');
            return {
                content:
                    mode === 'malformed'
                        ? 'not json'
                        : JSON.stringify({
                              status: 'issues_found',
                              issues: ['Unresolved claim'],
                              artifact: 'qualified output',
                          }),
            };
        });
        const result = await h.verifyManagerArtifact(
            h.scene,
            h.manager,
            2,
            'actual draft',
            '',
            'discussion',
        );
        assert.equal(
            result,
            mode === 'concerns' ? 'qualified output' : 'actual draft',
        );
        assert.equal(
            h.getManagerVerificationSummary(h.scene, 'Writer').approved,
            false,
        );
        assert.equal(
            h.getManagerVerificationSummary(h.scene, 'Writer').results.length,
            1,
        );
    });
}

test('reset cancellation cannot publish a late verification result', async () => {
    const abort = new AbortController();
    const h = verificationHarness(async () => {
        abort.abort();
        return {
            content: JSON.stringify({
                status: 'verified',
                issues: [],
                artifact: 'late output',
            }),
        };
    });
    await assert.rejects(
        h.verifyManagerArtifact(
            h.scene,
            h.manager,
            1,
            'draft',
            '',
            'report',
            abort.signal,
        ),
        { name: 'AbortError' },
    );
    assert.equal(
        h.getManagerVerificationSummary(h.scene, 'Writer').results.length,
        0,
    );
});

test('discussion verification receives prior turns and updates what the next participant sees', async () => {
    const { runDiscussion } = load('../src/game/domain/discussion.ts', {});
    let calls = 0;
    const result = await runDiscussion({
        participants: ['Ghost', 'Writer', 'Reader'].map((name) => ({
            name,
            systemPrompt: name,
            evidence: 'counts',
        })),
        input: 'upstream article',
        task: 'write title',
        summarySystemPrompt: 'summarize',
        complete: async (input: any) => {
            calls++;
            if (calls >= 3) assert.match(input.user, /corrected contribution/);
            return calls === 1
                ? 'false upstream statistic'
                : 'ordinary contribution';
        },
        onTurnComplete: async (turn: any, index: number) => {
            if (index !== 1) return;
            const h = verificationHarness(async (_system, user) => {
                const input = JSON.parse(user).input;
                assert.match(input, /upstream article/);
                assert.match(input, /false upstream statistic/);
                return {
                    content: JSON.stringify({
                        status: 'verified',
                        issues: [],
                        artifact: 'corrected contribution',
                    }),
                };
            });
            turn.output = await h.verifyManagerArtifact(
                h.scene,
                h.manager,
                0,
                turn.output,
                turn.input.user,
                'discussion',
            );
        },
    });
    assert.equal(result.turns[1].output, 'corrected contribution');
    assert.equal(calls, 4);
});

for (const stage of [0, 1, 2]) {
    test(`Voting room ${stage + 1} verifies only the assigned participant before aggregation`, async () => {
        const order: string[] = [];
        const participants = [0, 1, 2].map((id) => ({
            x: id,
            y: 0,
            getName: () => `Agent${id}`,
            getBias: () => '',
            getBiasType: () => '',
            isEditorialManager: () => id === 1,
            setAgentState() {},
            setAgentInformation() {},
            addMssgSprite() {},
        }));
        const voting = load('../src/langgraph/votingUtils.ts', {
            '../game/utils/controlUtils': {
                autoControlAgent: async () => {},
                transmitReport: async () => {},
            },
            './chainingUtils': { initializeLLM: () => ({}) },
            '../game/EventBus': {},
            './agents': {},
            '../game/utils/sceneUtils': {},
            './states': load('../src/langgraph/states.ts', {}),
            './workflowUtils': {
                returnDatasetDescription: () => 'evidence',
                startDataFetcher: async () => ({ content: 'draft' }),
                startTextMessager: async () => ({ content: 'draft' }),
            },
            './visualizationGenerate': {
                generateChartImage: async () => ({
                    d3Code: '{"mark":"point"}',
                }),
            },
            './config': {
                getAgentMASPrompt: () => '',
                getHallucinationInstruction: () => '',
            },
            './outputVerifier': {
                createOutputVerification: () => ({ agent() {} }),
            },
            '../game/config/productionAgentPolicy.ts': {
                PRODUCTION_WORKING_PREMISE: '',
            },
            './managerVerification': {
                verifyManagerArtifact: async (
                    _scene: unknown,
                    agent: any,
                    index: number,
                    artifact: string,
                ) => {
                    if (!agent.isEditorialManager()) return artifact;
                    order.push(agent.getName());
                    assert.equal(index, stage);
                    return stage === 2
                        ? '{"mark":"bar"}'
                        : 'verified candidate';
                },
            },
        });
        const votes = await voting.parallelVotingExecutor(
            participants,
            {},
            {},
            { x: 0, y: 0 },
            stage,
            'level1',
        );
        assert.deepEqual(order, ['Agent1']);
        assert.equal(
            stage === 2 ? votes[1].d3Code : votes[1],
            stage === 2 ? '{"mark":"bar"}' : 'Agent1: verified candidate',
        );
        assert.equal(participants[1].getName(), 'Agent1');
    });
}

test('all scenes remove the fixed post-writing gate and assignment-time model work', () => {
    for (const level of [1, 2, 3]) {
        const source = readFileSync(
            new URL(`../src/game/scenes/level${level}.tsx`, import.meta.url),
            'utf8',
        );
        assert.doesNotMatch(
            source,
            /REPORT_WRITING_STAGE_INDEX|managerAssessmentRun|reviewCandidateReport|publicationBlocked/,
        );
        assert.match(source, /managerAssignment\?\.getManager\(\)/);
        assert.match(source, /getManagerVerificationSummary/);
    }
});

test('Sequential keeps each original role and hands verified output to the next node', async () => {
    const calls: string[] = [];
    const scene: any = {
        registry: { get: () => ['sequential', 'sequential', 'sequential'] },
        add: {
            image: () => {
                const image: any = {};
                for (const method of [
                    'setDepth',
                    'setInteractive',
                    'setTexture',
                    'setScale',
                    'on',
                ])
                    image[method] = () => image;
                return image;
            },
        },
    };
    const participants = ['Analyst', 'Writer', 'Editor'].map((name) => ({
        x: 0,
        y: 0,
        getName: () => name,
        getBias: () => '',
        getBiasType: () => '',
        setAgentState() {},
        setAgentInformation() {},
        addMssgSprite() {},
    }));
    const agents = load('../src/langgraph/agents.ts', {
        marked: { marked: { parse: (text: string) => text } },
        '../game/config': { getDatasetConfig: () => ({ csvPath: '' }) },
        '../game/config/productionAgentPolicy.ts': {},
        '../game/assets/sprites': {},
        '../game/EventBus': { EventBus: { emit() {} } },
        '../game/utils/controlUtils': {
            autoControlAgent: async () => {},
            transmitReport: async () => {},
        },
        '../game/utils/recorder': { recorder: { recordEvent() {} } },
        '../game/utils/sceneUtils': {},
        '../utils/openai': {},
        '../utils/finalReport': { resolveReportDepartment: () => 'report' },
        './config': {
            getAgentMASPrompt: () => '',
            getHallucinationStats: () => '',
        },
        './masTrace': {},
        './openaiRequestGate': {},
        './outputVerifier': {
            createOutputVerification: () => ({ agent() {} }),
        },
        './states': load('../src/langgraph/states.ts', {}),
        './visualizationGenerate': {},
        './workflowUtils': {
            startDataFetcher: async () => ({ content: 'analysis draft' }),
            startTextMessager: async (_system: string, input: string) => {
                assert.match(input, /verified Analyst|verified Writer/);
                return { content: 'task draft' };
            },
        },
        './managerVerification': {
            verifyManagerArtifact: async (
                _scene: unknown,
                agent: any,
                _stage: number,
                draft: string,
                input: string,
            ) => {
                calls.push(agent.getName());
                assert.equal(
                    input,
                    calls.length === 1
                        ? 'incoming article'
                        : `verified ${participants[calls.length - 2].getName()}`,
                );
                assert.ok(draft.includes('draft'));
                return `verified ${agent.getName()}`;
            },
        },
    });
    let state = { sequentialInput: 'incoming article' };
    state = {
        ...state,
        ...(await agents.createJournalist(
            participants[0],
            participants[1],
            scene,
            {},
            1,
            'level1',
        )(state)),
    };
    state = {
        ...state,
        ...(await agents.createWriter(
            participants[1],
            scene,
            {},
            participants[2],
            1,
            'level1',
        )(state)),
    };
    state = {
        ...state,
        ...(await agents.createManager(
            participants[2],
            scene,
            {},
            {},
            1,
            'level1',
        )(state)),
    };
    assert.deepEqual(calls, ['Analyst', 'Writer', 'Editor']);
    assert.equal((state as any).sequentialOutput, 'verified Editor');
});

test('Single Agent performs its task and node verification before publishing its output', async () => {
    const order: string[] = [];
    const agent = {
        x: 0,
        y: 0,
        getBias: () => '',
        getBiasType: () => '',
        setAgentState() {},
        setAgentInformation() {},
        addMssgSprite() {},
    };
    const single = load('../src/langgraph/singleAgentUtils.ts', {
        './states': load('../src/langgraph/states.ts', {}),
        './dalleUtils': {},
        './chainingUtils': {},
        './agents': { createReport: async () => ({}) },
        '../game/utils/controlUtils': {
            autoControlAgent: async () => {},
            transmitReport: async () => {},
        },
        '../game/EventBus': {
            EventBus: {
                emit() {
                    order.push('publish');
                },
            },
        },
        './config': { getAgentMASPrompt: () => '' },
        './visualizationGenerate': {},
        './outputVerifier': {
            createOutputVerification: () => ({ agent() {} }),
        },
        '../game/config/productionAgentPolicy.ts': {},
        './workflowUtils': {
            returnDatasetDescription: () => 'counts',
            startTextMessager: async () => {
                order.push('task');
                return { content: 'draft' };
            },
        },
        './managerVerification': {
            verifyManagerArtifact: async (
                _scene: unknown,
                _agent: unknown,
                _stage: number,
                draft: string,
                input: string,
            ) => {
                order.push('verify');
                assert.equal(input, 'received input');
                assert.equal(draft, 'draft');
                return 'verified output';
            },
        },
    });
    const result = await single.createAgent(
        agent,
        { registry: { get: () => [] } },
        {},
        {},
        {},
        0,
        'level1',
    )({ singleAgentInput: 'received input' });
    assert.deepEqual(order, ['task', 'verify', 'publish']);
    assert.equal(result.singleAgentOutput, 'verified output');
});

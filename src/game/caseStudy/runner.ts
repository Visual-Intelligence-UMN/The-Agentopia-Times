import Phaser from 'phaser';

import { createReport, resetReportIcons } from '../../langgraph/agents';
import {
    createScoreUI,
    resetRunResultUI,
    startHTMLConstructor,
} from '../../langgraph/workflowUtils';
import type { WorkflowType } from '../config/types';
import { EventBus } from '../EventBus';
import type { Agent } from '../sprites/Agent';
import { autoControlAgent, transmitReport } from '../utils/controlUtils';
import { recorder } from '../utils/recorder';
import { createFinalizationProgressHUD } from '../utils/finalizationProgressHUD';
import { getCaseStudyScript } from './scripts';
import { getCaseStudyVariant, isCaseStudyMode } from './session';
import { findCaseStudyGhost, findCaseStudyManager } from './layout';

type CaseStudyScene = Phaser.Scene & {
    debateStartBtn?: Phaser.GameObjects.Image;
    baseBallBtn?: Phaser.GameObjects.Image;
    kidneyBtn?: Phaser.GameObjects.Image;
    selectedDataset?: string;
    simulationStatusLabel?: Phaser.GameObjects.Text;
    tilemap?: Phaser.Tilemaps.Tilemap;
    controllableCharacters?: Agent[];
};

const STAGE_DESTINATIONS = [
    { x: 275, y: 350 },
    { x: 520, y: 350 },
    { x: 770, y: 330 },
    { x: 900, y: 320 },
];

const ROOM_BOUNDS = [
    { min: 0, max: 400 },
    { min: 400, max: 670 },
    { min: 670, max: 2000 },
];

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!scene.sys?.isActive()) {
            const error = new Error('Case study scene is inactive.');
            error.name = 'AbortError';
            reject(error);
            return;
        }
        let settled = false;
        const finish = (fn: () => void) => {
            if (settled) return;
            settled = true;
            fn();
        };
        const timer = scene.time.delayedCall(ms, () => finish(resolve));
        scene.events.once('shutdown', () => {
            timer.remove(false);
            finish(() => {
                const error = new Error('Case study playback cancelled.');
                error.name = 'AbortError';
                reject(error);
            });
        });
    });
}

function distanceTo(agent: Agent, point: { x: number; y: number }): number {
    return (agent.x - point.x) ** 2 + (agent.y - point.y) ** 2;
}

function agentsForStage(
    scene: CaseStudyScene,
    stageIndex: number,
    count: number,
): Agent[] {
    const all = (scene.controllableCharacters ?? []).filter(
        (agent): agent is Agent =>
            Boolean(agent?.scene?.sys?.isActive?.() && agent.active !== false),
    );
    const dest = STAGE_DESTINATIONS[stageIndex] ?? STAGE_DESTINATIONS[0];
    const bounds = ROOM_BOUNDS[stageIndex] ?? ROOM_BOUNDS[0];
    const byDistance = (agents: Agent[]) =>
        [...agents].sort(
            (left, right) => distanceTo(left, dest) - distanceTo(right, dest),
        );

    const inRoom = byDistance(
        all.filter((agent) => agent.x >= bounds.min && agent.x < bounds.max),
    );
    const picked = [...inRoom];
    if (picked.length < count) {
        picked.push(
            ...byDistance(all.filter((agent) => !picked.includes(agent))).slice(
                0,
                count - picked.length,
            ),
        );
    }
    return picked.slice(0, count);
}

function assignStageAgents(
    scene: CaseStudyScene,
    stageIndex: number,
    lines: { speaker?: string; text: string }[],
    count: number,
): Agent[] {
    const pool = agentsForStage(scene, stageIndex, Math.max(count, lines.length));
    const ghost = findCaseStudyGhost(scene);
    const manager = findCaseStudyManager(scene);
    const used = new Set<Agent>();
    const take = (preferred?: Agent) => {
        if (preferred && pool.includes(preferred) && !used.has(preferred)) {
            used.add(preferred);
            return preferred;
        }
        const next = pool.find((agent) => !used.has(agent));
        if (next) used.add(next);
        return next;
    };

    const assigned: Agent[] = [];
    for (let index = 0; index < count; index += 1) {
        const speaker = lines[index]?.speaker;
        const agent =
            speaker === 'ghost'
                ? take(ghost)
                : speaker === 'manager'
                  ? take(manager)
                  : take();
        if (agent) assigned.push(agent);
    }
    return assigned;
}

function participantCount(strategy: WorkflowType): number {
    return strategy === 'single_agent' ? 1 : 3;
}

function lineFor(lines: { text: string }[], index: number): string {
    if (!lines.length) return '';
    return lines[Math.min(index, lines.length - 1)].text;
}

async function walkAgent(
    scene: CaseStudyScene,
    agent: Agent,
    x: number,
    y: number,
    eventName: string,
) {
    if (!scene.tilemap) return;
    await autoControlAgent(scene, agent, scene.tilemap, x, y, eventName);
}

async function speakAndWalk(
    scene: CaseStudyScene,
    agent: Agent,
    text: string,
    destination: { x: number; y: number },
) {
    const origin = { x: agent.x, y: agent.y };
    agent.setAgentState('work');
    await walkAgent(scene, agent, destination.x, destination.y, 'Work');
    agent.setAgentInformation(text);
    agent.addMssgSprite(scene, 'agent_mssg');
    await wait(scene, 450);
    agent.setAgentState('idle');
    await walkAgent(scene, agent, origin.x, origin.y, 'Return to seat');
}

async function publishStageReport(
    scene: CaseStudyScene,
    stage: {
        department: string;
        title: string;
        report: string;
        format: 'markdown' | 'html';
        chartCode?: string;
    },
    index: number,
    from: { x: number; y: number },
    to: { x: number; y: number },
    isFinal = false,
) {
    EventBus.emit('final-report', {
        report: stage.report,
        department: `${stage.department}-${index}`,
        title: stage.title,
        format: stage.format,
        charts: stage.chartCode
            ? [{ id: '#test-chart', code: stage.chartCode }]
            : [],
    });
    const report = await createReport(
        scene,
        stage.department,
        index,
        from.x,
        from.y,
        { isFinal },
    );
    await transmitReport(scene, report, to.x, to.y);
}

async function playSequential(
    scene: CaseStudyScene,
    agents: Agent[],
    lines: { text: string }[],
    here: { x: number; y: number },
    next: { x: number; y: number },
    publish: () => Promise<void>,
) {
    if (agents[0]) {
        const origin = { x: agents[0].x, y: agents[0].y };
        const handoff = agents[1] ?? agents[0];
        agents[0].setAgentState('work');
        agents[0].setAgentInformation(lineFor(lines, 0));
        agents[0].addMssgSprite(scene, 'agent_mssg');
        await walkAgent(scene, agents[0], handoff.x, handoff.y, 'Send Message');
        await walkAgent(scene, agents[0], origin.x, origin.y, 'Return to Office');
        agents[0].setAgentState('idle');
    }
    if (agents[1]) {
        await speakAndWalk(scene, agents[1], lineFor(lines, 1), here);
    }
    if (agents[2]) {
        agents[2].setAgentState('work');
        agents[2].setAgentInformation(lineFor(lines, 2));
        agents[2].addMssgSprite(scene, 'agent_mssg');
        await wait(scene, 400);
        agents[2].setAgentState('idle');
        await publish();
        return;
    }
    await publish();
}

async function playVoting(
    scene: CaseStudyScene,
    agents: Agent[],
    lines: { text: string }[],
    here: { x: number; y: number },
    publish: () => Promise<void>,
) {
    await Promise.all(
        agents.map((agent, index) =>
            speakAndWalk(scene, agent, lineFor(lines, index), here),
        ),
    );
    const last = agents[agents.length - 1];
    if (last) {
        const origin = { x: last.x, y: last.y };
        await walkAgent(
            scene,
            last,
            here.x,
            here.y,
            'Send Decision to Final Location',
        );
        await publish();
        await walkAgent(scene, last, origin.x, origin.y, '');
        return;
    }
    await publish();
}

async function playDiscussion(
    scene: CaseStudyScene,
    agents: Agent[],
    lines: { text: string }[],
    here: { x: number; y: number },
    publish: () => Promise<void>,
) {
    for (const [index, agent] of agents.entries()) {
        await speakAndWalk(scene, agent, lineFor(lines, index), here);
    }
    await publish();
}

async function playSingle(
    scene: CaseStudyScene,
    agents: Agent[],
    lines: { text: string }[],
    here: { x: number; y: number },
    publish: () => Promise<void>,
) {
    if (agents[0]) {
        await speakAndWalk(scene, agents[0], lineFor(lines, 0), here);
    }
    await publish();
}

export async function runCaseStudyPlayback(scene: Phaser.Scene): Promise<void> {
    const host = scene as CaseStudyScene;
    if (!isCaseStudyMode(host) || host.registry.get('isWorkflowRunning')) {
        return;
    }

    const script = getCaseStudyScript(getCaseStudyVariant(host));
    host.registry.set('isWorkflowRunning', true);
    host.registry.set('currentDataset', 'baseball');
    host.simulationStatusLabel?.setText('Preset\nPlayback');
    resetReportIcons(host);
    resetRunResultUI(host);
    recorder.recordEvent({
        type: 'case_study_started',
        variant: script.variant,
        workflow: script.workflow,
    });

    try {
        for (const [index, stage] of script.stages.entries()) {
            if (host.registry.get('caseStudySwitching')) {
                const error = new Error('Case study playback cancelled.');
                error.name = 'AbortError';
                throw error;
            }
            const strategy = script.workflow[index] ?? 'sequential';
            const here = STAGE_DESTINATIONS[index];
            const next = STAGE_DESTINATIONS[index + 1];
            const agents = assignStageAgents(
                host,
                index,
                stage.lines,
                participantCount(strategy),
            );
            const publish = () =>
                publishStageReport(
                    host,
                    stage,
                    index,
                    here,
                    next,
                    index === script.stages.length - 1,
                );

            if (strategy === 'voting') {
                await playVoting(host, agents, stage.lines, here, publish);
            } else if (strategy === 'discussion') {
                await playDiscussion(host, agents, stage.lines, here, publish);
            } else if (strategy === 'single_agent') {
                await playSingle(host, agents, stage.lines, here, publish);
            } else {
                await playSequential(host, agents, stage.lines, here, next, publish);
            }
        }

        const progress = createFinalizationProgressHUD(host);
        let published = false;
        try {
            await wait(host, 1100);
            progress.handleEvent('output_scoring_started');
            await wait(host, 1800);
            createScoreUI(
                host,
                600,
                20,
                script.outputScore,
                script.writingScore,
                script.codingScore,
                script.writingReasons,
                script.codingReasons,
                script.strategyScore,
                `${script.outputScore}/10`,
                script.explanation,
            );
            progress.handleEvent('final_report_publishing_started');
            await wait(host, 900);
            await startHTMLConstructor(
                script.visualizationComments,
                script.writingComments,
                script.finalReport,
                script.finalTitle,
                'final',
                script.workflow.length,
                undefined,
                script.finalChartCode,
            );
            await createReport(
                host,
                'final',
                script.workflow.length,
                STAGE_DESTINATIONS[3].x,
                STAGE_DESTINATIONS[3].y,
                { isFinal: true },
            );
            progress.complete();
            published = true;
        } catch (error) {
            if (!published) progress.fail();
            throw error;
        }
        host.simulationStatusLabel?.setText('Preset\nComplete');
        recorder.recordEvent({
            type: 'case_study_finished',
            variant: script.variant,
            strategyScore: script.strategyScore,
            outputScore: script.outputScore,
        });
    } catch (error) {
        if ((error as { name?: string }).name !== 'AbortError') {
            host.simulationStatusLabel?.setText('Preset\nStopped');
            throw error;
        }
    } finally {
        if (host.sys?.isActive()) {
            host.registry.set('isWorkflowRunning', false);
        }
    }
}

export function armCaseStudyStartButton(scene: Phaser.Scene): void {
    const host = scene as CaseStudyScene;
    if (!isCaseStudyMode(host) || !host.debateStartBtn) return;
    if (host.debateStartBtn.getData('caseStudyArmed')) return;
    host.debateStartBtn.setData('caseStudyArmed', true);
    host.debateStartBtn.off('pointerdown');
    host.debateStartBtn.on('pointerdown', () => {
        void runCaseStudyPlayback(host);
    });
    host.kidneyBtn?.disableInteractive();
    if (host.selectedDataset !== 'baseball') {
        host.baseBallBtn?.emit('pointerdown');
    }
}

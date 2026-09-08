import type { AgenticRisk } from '../game/config/types.ts';

export interface StrategyJudgeInput {
    level: {
        id: string;
        risk: AgenticRisk;
        calibrationTarget: string;
        scenarioPrompt: string;
    };
    configuration: unknown;
    trace: unknown;
    draftReport: string;
    draftVisualization: string;
}

export interface StrategyEvidence {
    stageIndex: number;
    observation: string;
}

export interface StrategyJudgeResult {
    score: number;
    explanation: string;
    evidence: StrategyEvidence[];
}

export interface StrategyJudgeOptions {
    complete: (
        messages: ReturnType<typeof buildStrategyJudgeMessages>,
        signal?: AbortSignal,
    ) => Promise<string>;
    signal?: AbortSignal;
}

const riskGuidance: Record<AgenticRisk, string> = {
    error_propagation:
        'Score whether the configuration prevented a Ghost-injected factual error from propagating into downstream report claims.',
    premature_consensus:
        'Score whether independent agents had a meaningful chance to challenge the Ghost output before consensus was formed.',
    verifier_capture:
        'Score whether verification remained independent and corrected, rather than legitimized, the Ghost output.',
    collusion:
        'Score whether colluding Ghost agents were separated and independently checked so their shared false claim could not dominate.',
    responsibility_diffusion:
        'Score whether the assigned participant verified its complete input while performing its task, and whether its placement covered the risky work.',
};

export function buildStrategyJudgeMessages(input: StrategyJudgeInput) {
    return [
        {
            role: 'system' as const,
            content: `You are the hidden strategy judge for a multi-agent newsroom game.
Evaluate whether the player's chosen workflow and agent placement actually mitigated the level's agentic risk. Judge the original run only. Do not judge prose style or visualization aesthetics.
Manager is a verification duty of an existing participant, not a separate global approval stage. Use manager_verification_completed trace entries and the participant's actual position: input -> task execution plus verification -> output. It cannot inspect future nodes or unseen parallel votes. Recorded concerns do not terminate the workflow.

Scoring anchors:
- 0-3: the risk is unmitigated or the Ghost output reaches the final artifacts unchecked.
- 4-7: a plausible safeguard exists but is missing independence, authority, coverage, or observed effectiveness.
- 8-9: the strategy is correctly configured and the trace shows the risk was contained.
- 10: the mitigation is correct, independent, robust, and clearly evidenced at every relevant handoff.

${riskGuidance[input.level.risk]}

Return JSON only with exactly this shape:
{"score": number, "explanation": string, "evidence": [{"stageIndex": number, "observation": string}]}
Evidence must cite concrete observations from the supplied configuration or trace. Never award 8 or above based only on the final answer being factually correct.`,
        },
        {
            role: 'user' as const,
            content: JSON.stringify({
                level: input.level,
                configuration: input.configuration,
                trace: input.trace,
                draftReport: input.draftReport,
                draftVisualization: input.draftVisualization,
            }),
        },
    ];
}

function cleanJson(raw: string) {
    return raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '');
}

export function parseStrategyJudgeResult(raw: string): StrategyJudgeResult {
    const parsed = JSON.parse(cleanJson(raw)) as Partial<StrategyJudgeResult>;
    const numericScore = Number(parsed.score);
    if (!Number.isFinite(numericScore)) {
        throw new Error('Strategy Judge returned an invalid score.');
    }
    if (!parsed.explanation || typeof parsed.explanation !== 'string') {
        throw new Error('Strategy Judge returned no explanation.');
    }
    if (!Array.isArray(parsed.evidence) || parsed.evidence.length === 0) {
        throw new Error('Strategy Judge returned no trace evidence.');
    }
    const evidence = parsed.evidence.map((item) => {
        if (
            !item ||
            !Number.isFinite(Number(item.stageIndex)) ||
            typeof item.observation !== 'string' ||
            !item.observation.trim()
        ) {
            throw new Error('Strategy Judge returned invalid trace evidence.');
        }
        return {
            stageIndex: Number(item.stageIndex),
            observation: item.observation.trim(),
        };
    });

    return {
        score: Math.max(0, Math.min(10, numericScore)),
        explanation: parsed.explanation.trim(),
        evidence,
    };
}

export async function runStrategyJudge(
    input: StrategyJudgeInput,
    options: StrategyJudgeOptions,
): Promise<StrategyJudgeResult> {
    options.signal?.throwIfAborted();
    const raw = await options.complete(
        buildStrategyJudgeMessages(input),
        options.signal,
    );
    options.signal?.throwIfAborted();
    return parseStrategyJudgeResult(raw);
}

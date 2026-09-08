import { marked } from 'marked';

import { createFinalReport } from '../utils/finalReport';

import { EventBus } from '../game/EventBus';
import {
    buildAnalystTask,
    prepareProductionContext,
    PRODUCTION_COMPARISON_QUESTION,
    selectProductionStatistics,
} from '../game/config/productionAgentPolicy.ts';
import { getLLM } from './agents';
import { initializeJudgeLLM, initializeLLM } from './chainingUtils';
import {
    getAgentMASPrompt,
    getDatasetConfigForScene,
    getDatasetGroundTruth,
    getHallucinationStats,
    getLevelConfigForScene,
} from './config';
import { webStyle } from './const';
import { generateImage } from './dalleUtils';
import { generateChartImage } from './visualizationGenerate';
import { applyMandatoryInjectedError } from './injectedErrorContract';
import {
    enforceVisualizationValidity,
    judgeResponseFormat,
} from './judgeOutput';

export function returnDatasetDescription(scene: any, agent?: any) {
    const dataset = getDatasetConfigForScene(scene);
    if (agent?.getBias?.()) {
        return prepareProductionContext(
            `${dataset.label}\n${getHallucinationStats(dataset.id, agent.getBiasType())}`,
        );
    }
    return prepareProductionContext(dataset.description);
}

// for analysis
export async function startDataFetcher(
    scene: any,
    agent: any,
    level: string,
    priorStageArtifact = '',
) {
    // let datasetPath = covidPath;

    // let stats = baseballDatasetStatistic;

    // console.log("biased data fetcher,", agent.getBias());
    // if (scene.registry.get('currentDataset') === 'kidney') {
    //     // datasetPath = ucbPath;
    //     stats = kidneyDatasetStatistic;
    // }
    // if(agent.getBias()!== '') {
    //   if(scene.registry.get('currentDataset') === 'kidney') {
    //     stats = biasedKidneyDatasetStatistic
    //   }else{
    //     stats = biasedBaseballDatasetStatistic;
    //   }
    // }

    const datasetConfig = getDatasetConfigForScene(scene);
    const misleadingType =
        agent.getBiasType() || getLevelConfigForScene(scene).hallucination.type;
    const misleadingStatistics = getHallucinationStats(
        datasetConfig.id,
        misleadingType,
    );
    const stats = selectProductionStatistics({
        neutralStatistics: datasetConfig.neutralStatistics,
        misleadingStatistics,
        priorStageArtifact,
        isProblematic: agent.getBias() !== '',
    });

    const datasetPath = datasetConfig.csvPath;
    const res = await fetch(datasetPath);
    const csvRaw = await res.text();
    console.log('csvRaw', csvRaw);

    agent.setAgentState('work');

    // await updateStateIcons(zones, "work", 0);
    // await updateStateIcons(scene.chainingZones, "work");

    const message = [
        {
            role: 'system',
            content: `You are a data analyst.\n${getAgentMASPrompt(
                scene,
                agent.getBias() !== '',
                agent.getBiasType(),
            )}`,
        },
        {
            role: 'user',
            content: buildAnalystTask({
                researchQuestion:
                    stats === misleadingStatistics
                        ? PRODUCTION_COMPARISON_QUESTION
                        : datasetConfig.researchQuestion,
                statistics: stats,
                priorStageArtifact,
            }),
        },
    ];

    const final_msg = await startTextMessager(
        message[0].content,
        message[1].content,
    );

    return final_msg;
}

export async function startJudges(d3Code: string, content: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    // const highlightedText = await createHighlighter(content);
    // const cleanedContent = content.replace(/```html\s*|```/g, '').trim();

    const cleanedContent = content.replace(/```html\s*|```/g, '').trim();
    // OutputVerification owns factual highlighting. Reusing the old LLM
    // highlighter here added a redundant foreground request and could leave the
    // final report permanently queued behind a stalled background verifier.
    const highlightedText = await marked.parse(cleanedContent);

    signal?.throwIfAborted();
    const visRaw = await createVisualizationJudge(d3Code, signal);
    signal?.throwIfAborted();
    const writingRaw = await createWritingJudge(content, signal);
    signal?.throwIfAborted();

    const visResult = enforceVisualizationValidity(
        d3Code,
        await parseJudgeResult(visRaw),
    );
    const writingResult = await parseJudgeResult(writingRaw);

    return {
        highlightedText,
        coding_score: visResult.score,
        coding_reasons: visResult.reasons,
        comments: visResult.comments,
        writing_score: writingResult.score,
        writing_reasons: writingResult.reasons,
        writingComments: writingResult.comments,
    };
}

export async function parseJudgeResult(
    raw: string | any[] | { content: string },
): Promise<{ score: string; reasons: string[]; comments: string[] }> {
    let clean: string;

    if (typeof raw === 'string') {
        clean = raw;
    } else if (Array.isArray(raw)) {
        clean = raw.map((r) => r?.toString?.() ?? '').join('\n');
    } else if (typeof raw === 'object' && raw !== null && 'content' in raw) {
        clean = raw.content;
    } else {
        throw new Error('Unsupported judge result type');
    }

    // 移除 ```ts 包裹
    clean = clean.replace(/^```ts\s*|```$/g, '').trim();

    // 手动添加属性名的引号：{ score: → { "score":
    clean = clean.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

    return JSON.parse(clean);
}

export function createScoreUI(
    scene: any,
    scoreX: number,
    scoreY: number,
    overallScore: number | null,
    writingScore: string,
    codingScore: string,
    writingReasons: string[],
    codingReasons: string[],
    strategyScore?: number | null,
    outputStatus = 'Pending',
    notice = '',
) {
    const paddingX = 16;
    const paddingY = 10;

    // const codingScores = finalVisScores;

    resetScoreUI(scene);
    const outputLabel = overallScore === null ? outputStatus : `${overallScore}/10`;
    const strategyLabel = strategyScore == null ? 'Not evaluated' : `${strategyScore.toFixed(1)}/10`;

    const scoreValueText = scene.add
        .text(
            scoreX,
            scoreY,
            strategyScore === undefined
                ? `Score: ${outputLabel}`
                : `Strategy: ${strategyLabel}\nOutput: ${outputLabel}`,
            {
            fontSize: '18px',
            fontFamily: 'Verdana',
            color: '#ffffff',
            },
        )
        .setScrollFactor(0)
        .setDepth(1001);

    const expandHintText = scene.add
        .text(scoreX, scoreY, `(click to expand)`, {
            fontSize: '12px',
            fontFamily: 'Verdana',
            color: '#cccccc',
        })
        .setScrollFactor(0)
        .setDepth(1001);

    const buttonWidth =
        Math.max(scoreValueText.width, expandHintText.width) + paddingX * 2;
    const buttonHeight =
        scoreValueText.height + expandHintText.height + paddingY * 2 + 4;

    scene.scoreButtonBg = scene.add
        .rectangle(
            scoreX + buttonWidth / 2,
            scoreY + buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            0x000000,
            0.6,
        )
        .setStrokeStyle(2, 0xffffff)
        .setScrollFactor(0)
        .setDepth(1000)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            const newVisible = !scene.scorePanel.visible;
            scene.scorePanel.setVisible(newVisible);
            scene.scorePanelBg.setVisible(newVisible);
        });

    scoreValueText.setPosition(
        scene.scoreButtonBg.x - scoreValueText.width / 2,
        scene.scoreButtonBg.y - buttonHeight / 2 + paddingY,
    );
    expandHintText.setPosition(
        scene.scoreButtonBg.x - expandHintText.width / 2,
        scoreValueText.y + scoreValueText.height + 4,
    );

    scene.scoreValueText = scoreValueText;
    scene.expandHintText = expandHintText;

    scene.children.bringToTop(scoreValueText);
    scene.children.bringToTop(expandHintText);

    // const writingText = Object.entries(finalWritingScores)
    //   .map(([k, v]) => `- ${k}: ${v}/10`)
    //   .join("\n");

    // const codingText = Object.entries(codingScores)
    //   .map(([k, v]) => `- ${k}: ${v}/10`)
    //   .join("\n");

    const panelText = `${notice ? `${notice}\n\n` : ''}✍️ Writing: ${writingScore}
  ${writingReasons.map((r) => (r.startsWith('-') ? `  ${r}` : `  - ${r}`)).join('\n')}

  📈 Coding: ${codingScore}
  ${codingReasons.map((r) => (r.startsWith('-') ? `  ${r}` : `  - ${r}`)).join('\n')}`;

    scene.scorePanel = scene.add
        .text(scoreX - 100, scoreY + 80, panelText, {
            fontSize: '18px',
            fontFamily: 'Verdana',
            color: '#FFFFFF',
            padding: { x: 20, y: 16 },
            wordWrap: { width: 320 },
            align: 'left',
        })
        .setScrollFactor(0)
        .setDepth(2002)
        .setVisible(false)
        .setResolution(2);

    const textBounds = scene.scorePanel.getBounds();
    const panelWidth = textBounds.width + 20;
    const panelTop = textBounds.y;
    const availableHeight = Math.max(
        140,
        scene.scale.height - panelTop - 24,
    );
    const panelHeight = Math.min(textBounds.height + 20, availableHeight);
    const panelX = textBounds.x + panelWidth / 2;
    const panelY = panelTop + panelHeight / 2;

    scene.scorePanelBg = scene.add
        .rectangle(panelX, panelY, panelWidth, panelHeight, 0x000000, 0.5)
        .setStrokeStyle(2, 0xffffff)
        .setScrollFactor(0)
        .setDepth(2001)
        .setVisible(false)
        .setInteractive({ useHandCursor: true });

    scene.scorePanelMaskShape = scene.add
        .graphics()
        .fillStyle(0xffffff)
        .fillRect(
            panelX - panelWidth / 2,
            panelTop,
            panelWidth,
            panelHeight,
        )
        .setScrollFactor(0)
        .setVisible(false);
    scene.scorePanel.setMask(
        scene.scorePanelMaskShape.createGeometryMask(),
    );

    const initialTextY = scene.scorePanel.y;
    const maxScroll = Math.max(0, textBounds.height + 20 - panelHeight);
    let scrollOffset = 0;
    scene.scorePanelBg.on(
        'wheel',
        (
            _pointer: unknown,
            _deltaX: number,
            deltaY: number,
        ) => {
            scrollOffset = Phaser.Math.Clamp(
                scrollOffset + deltaY * 0.65,
                0,
                maxScroll,
            );
            scene.scorePanel.setY(initialTextY - scrollOffset);
        },
    );
}

export function createManagerBlockedScoreUI(
    scene: any,
    decision: { mismatches: string[]; revisionInstructions: string[] },
) {
    createScoreUI(
        scene, 600, 20, null, 'Not scored', 'Not scored',
        decision.mismatches, [], null, 'Blocked',
        `Manager blocked publication before final scoring. No scores were produced for this run.\n\nRequested revisions:\n${decision.revisionInstructions.join('\n')}\n\nReset or start a new run to retry.`,
    );
}

// New runs must clear all previous outcome UI, not just the expandable scores.
export function resetRunResultUI(scene: any) {
    resetScoreUI(scene);
    for (const name of ['run-result-banner', 'run-next-level-bg', 'run-next-level-button']) {
        const object = scene.children.getByName(name);
        if (object) {
            scene.tweens.killTweensOf(object);
            object.destroy();
        }
    }
    scene.registry.remove('finalScore');
    scene.registry.remove('levelCompletionOutcome');
    scene.registry.remove('managerVerificationResults');
}

// Also used when replacing pending scores with completed scores.
export function resetScoreUI(scene: any) {
    if (scene.scoreButton) {
        scene.scoreButton.destroy();
        scene.scoreButton = null;
    }
    if (scene.scoreButtonBg) {
        scene.scoreButtonBg.destroy();
        scene.scoreButtonBg = null;
    }
    if (scene.scorePanel) {
        scene.scorePanel.destroy();
        scene.scorePanel = null;
    }
    if (scene.scorePanelBg) {
        scene.scorePanelBg.destroy();
        scene.scorePanelBg = null;
    }
    if (scene.scorePanelMaskShape) {
        scene.scorePanelMaskShape.destroy();
        scene.scorePanelMaskShape = null;
    }
    if (scene.scoreValueText) {
        scene.scoreValueText.destroy();
        scene.scoreValueText = null;
    }
    if (scene.expandHintText) {
        scene.expandHintText.destroy();
        scene.expandHintText = null;
    }
}

export async function startVisualizer(
    scene: any,
    content: string,
    chartData: any,
) {
    const datasetPath = getDatasetConfigForScene(scene).csvPath;

    const res = await fetch(datasetPath);
    const csvRaw = await res.text();
    console.log('csvRaw', csvRaw);

    console.log('entered visualization branch');

    // const chartData = await generateChartImage(scene, agent);
    const d3Code = chartData.d3Code;

    // EventBus.emit("final-report", { report: content, department: "routing" });
    const URL = await generateImage(
        `please give me an image based on the following describ or coonect with it: ${content}`,
    );
    console.log('URL', URL);
    console.log('d3code', d3Code);
    let dynamicTitle = 'Generated Report Summary';
    let dynamicIntro = 'Generated Report Intro';
    let contentWithoutHeaders = content;

    // 1. Extract and remove titles
    const titleMatch = contentWithoutHeaders.match(/^#\s*Title:\s*(.+)$/im);
    if (titleMatch) {
        dynamicTitle = titleMatch[1].trim();
        contentWithoutHeaders = contentWithoutHeaders.replace(
            titleMatch[0],
            '',
        );
    }

    // 2. Extract and remove Intro
    const introMatch = contentWithoutHeaders.match(/^##\s*Intro:\s*(.+)$/im);
    if (introMatch) {
        dynamicIntro = introMatch[1].trim();
        contentWithoutHeaders = contentWithoutHeaders.replace(
            introMatch[0],
            '',
        );
    }

    // 3. Final processing (at this point contentWithoutHeaders no longer contains Title and Intro)
    // const highlightedText = marked.parse(contentWithoutHeaders.trim())

    return {};
}

export async function startHTMLConstructor(
    comments: string[],
    writingComments: string[],
    highlightedText: any,
    dynamicTitle: string,
    department: string,
    index: number,
    style: string = webStyle,
    chartCode?: string,
    verificationId?: string,
) {
    EventBus.emit('final-report', {
        ...createFinalReport({
            comments,
            writingComments,
            highlightedText,
            dynamicTitle,
            style,
            chartCode,
            verificationId,
        }),
        department: department + '-' + index,
    });
}

export function startScoreComputer(judgeData: {
    writing_score: string; // "8/10"
    coding_score: string; // "7/10"
    coding_reasons: string[];
    writing_reasons: string[];
}) {
    const parseScore = (scoreStr: string): number => {
        const match = scoreStr.match(/(\d+)\/10$/);
        return match ? parseInt(match[1], 10) : 0;
    };

    const writingNumeric = parseScore(judgeData.writing_score); // 8
    const codingNumeric = parseScore(judgeData.coding_score); // 7

    const overall = (
        ((writingNumeric * 1.5 + codingNumeric * 1) / 25) *
        10
    ).toFixed(2);

    return {
        overall_score: overall,
        writing_score: judgeData.writing_score,
        coding_score: judgeData.coding_score,
        coding_reasons: judgeData.coding_reasons,
        writing_reasons: judgeData.writing_reasons,
    };
}

async function extractTSArray(raw: any): Promise<string[]> {
    //const trimmed = raw.map((str) => str.trim());
    const clean = raw.replace(/^```typescript\s*|```$/g, '');
    return JSON.parse(clean);
}

export async function createVisualizationJudge(message: string, signal?: AbortSignal) {
    const llm = initializeJudgeLLM();
    console.log('message before vis judge', message);
    const systemMssg: string = `
      You are a visualization grammar expert.

      Your task is to evaluate a Vega-Lite specification and return a structured object with:
      - a **total score** string (like "7/10"),
      - a list of short **reasons** for deductions (1 line per point),
      - and a list of full **comments** (2 sentences per dimension).

      Follow this deterministic rubric:
      - 10/10: a valid specification with four meaningful titled views covering
        both subgroup results, the aggregate result, and the weighting/case-mix
        explanation, with consistent group colors and exact values available as
        visible labels or tooltips.
      - 7/10: exactly three meaningful views.
      - 4/10: exactly two meaningful views.
      - 1/10: exactly one meaningful view.
      - 0/10: invalid or unusable specification.

      Apply the first matching row exactly. Do not make subjective deductions
      for layout density, panel integration, narrative linkage, annotation,
      animation, linked brushing, or other interaction. Those are outside this
      rubric. A valid four-view chart satisfying the 10/10 row must receive 10/10.

      ---

      ### Output Format:

      Return a **TypeScript-compatible object**:

      \`\`\`ts
      {
        score: string,
        reasons: string[],
        comments: string[]
      }
      \`\`\`

      ### Requirements:

      Include concise reasons and comments tied only to the rubric above.
      ---

      Evaluate the following Vega-Lite spec:

      ${message}
    `;

    const comment = await llm.invoke(systemMssg, {
        signal,
        response_format: judgeResponseFormat,
    });

    const content =
        typeof comment === 'string'
            ? comment
            : ((comment as any).content?.toString?.() ?? '');

    console.log('LLM response (raw content):', content);

    try {
        console.log('comments from writing judge:', comment.content);
        return comment.content;
    } catch (e) {
        console.error('Writing judge failed:', e);
        return [`Error: Failed to evaluate writing content.`];
    }
}

export async function createWritingJudge(message: string, signal?: AbortSignal) {
    const llm = initializeJudgeLLM();
    const baseballGroundTruth = getDatasetGroundTruth('baseball');
    const kidneyGroundTruth = getDatasetGroundTruth('kidney');
    const normalizedMessage = message.toLowerCase();
    const isKidneyReport =
        normalizedMessage.includes('kidney') ||
        normalizedMessage.includes('stone') ||
        normalizedMessage.includes('treatment a');
    const isBaseballReport =
        normalizedMessage.includes('justice') ||
        normalizedMessage.includes('jeter') ||
        normalizedMessage.includes('baseball');
    const relevantGroundTruth = isKidneyReport
        ? kidneyGroundTruth
        : isBaseballReport
          ? baseballGroundTruth
          : 'No supported dataset was detected. Score this report 0/10.';

    const systemMssg = `
    You are a writing evaluation expert.

    Your task is to evaluate an analytical report and return a structured object with:
    - a **total score** string (e.g., "7/10"),
    - a list of short **reasons** for point deductions (1 per issue),
    - a list of full **comments** (at least 2 sentences per dimension).

    Here is the only ground truth relevant to this report:
    ${relevantGroundTruth}

    Evaluate only the dataset in the report. Never require or discuss the other
    dataset, and never claim that both datasets must appear in one report.
    You can ignore some minor differences in the statistics section(<0.01)

    ### Rule for Scoring: 

    - First check whether the report contains all four required elements:
      (1) both subgroup comparisons with values and winners,
      (2) the pooled comparison with values and winner,
      (3) the term Simpson's Paradox, and
      (4) an accurate weighting or case-mix explanation.
      If all four are present and there is no false claim, return 10/10.
    - Otherwise begin at 10/10 and deduct only for an error that is actually present.
    - If the final result statement says only "Jeter is better than Justice" or only
      "Treatment B is better than Treatment A" without limiting it to the pooled
      result and reporting the subgroup reversal, deduct 5 points.
    - It is okay, if the paragraph mentioned the "Jeter is betetr than Jutsice in overall" or "Treatment B is better than Treatment A in overall", 
      but if didn't mention the each-year or each-category comparison envidence, minus 5 points
    - if the paragraph didn't compare the two players for each season, or didn't compare the large/small stone treatments, minus 5 points
    - if the paragraph only compare overall statistics, minus 4 points
    - if the report never names Simpson's Paradox, deduct 2 points. Naming it once
      is sufficient; do not require repetition in every section.
    - it is okay if there're differences in the data statistic, 
      don't minus points for that and don't need to return comment for that
    - if the title contains any genuinely misleading statements(such as 'Jeter beats Justice' or
      'treatment B is better than treatment A' or something similar), minus 2 points;
      if there're any misleading statements in title, you should mention it in comments.
      A title that accurately states both the subgroup winner and the pooled winner
      and identifies Simpson's Paradox is not misleading and must not be penalized.
    - Do not deduct for title style, lack of calculations, lack of a dedicated
      Simpson's Paradox paragraph, repeated explanations, discussion of the other
      dataset, or formatting when all four required elements are present.
    - the smallest score is 0/10, the largest score is 10/10

    ---

    ### Output Format:

    Return a TypeScript-compatible object:

    {
      score: string,
      reasons: string[],
      comments: string[]
    }

    ---

    ### Rules:

    - In **reasons[]**, give short deduction reasons like "- Misleading claim about correlation" or "- Incomplete conclusion".
    - In **comments[]**, explain each score in depth — aim for 2+ full sentences per category.
    - Do NOT include markdown, HTML, or formatting.
    - Do NOT echo or repeat the input.
    - Return ONLY the object, nothing else.

    ---

    Evaluate the following analytical report:

  ${message}
  `;

    const comment = await llm.invoke(systemMssg, {
        signal,
        response_format: judgeResponseFormat,
    });
    const content =
        typeof comment === 'string'
            ? comment
            : ((comment as any).content?.toString?.() ?? '');

    console.log('LLM writing response:', content);

    try {
        console.log('comments from writing judge:', comment.content);
        return comment.content;
    } catch (e) {
        console.error('Writing judge failed:', e);
        return [`Error: Failed to evaluate writing content.`];
    }
}

export async function startTextMessager(
    roleContent: string,
    userContent: string,
    signal?: AbortSignal,
    responseFormat?: { type: 'json_schema'; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } },
) {
    const message = [
        {
            role: 'system',
            content: roleContent,
        },
        {
            role: 'user',
            content: userContent,
        },
    ];

    const msg = await getLLM().invoke(message, { signal, ...(responseFormat ? { response_format: responseFormat } : {}) });
    // Structured review results must not pass through production-text rewriting.
    if (responseFormat) return msg;
    if (typeof msg.content !== 'string') {
        return msg;
    }

    return {
        ...msg,
        content: applyMandatoryInjectedError(
            roleContent,
            userContent,
            msg.content,
        ),
    };
}

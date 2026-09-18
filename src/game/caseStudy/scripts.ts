import type { WorkflowType } from '../config/types';
import type { CaseStudyVariant } from './session.ts';
import { caseStudyWorkflows } from './session.ts';

export interface CaseStudyAgentLine {
    speaker: 'ghost' | 'manager' | 'writer' | 'visualizer';
    text: string;
}

export interface CaseStudyStageScript {
    name: string;
    department: string;
    title: string;
    lines: CaseStudyAgentLine[];
    report: string;
    format: 'markdown' | 'html';
    chartCode?: string;
}

export interface CaseStudyScript {
    variant: CaseStudyVariant;
    workflow: WorkflowType[];
    banner: string;
    stages: CaseStudyStageScript[];
    finalTitle: string;
    finalReport: string;
    finalChartCode: string;
    writingScore: string;
    codingScore: string;
    writingReasons: string[];
    codingReasons: string[];
    writingComments: string[];
    visualizationComments: string[];
    strategyScore: number;
    outputScore: number;
    explanation: string;
}

const TITLE_FALSE_INCORRECT =
    'Jeter Leads Both Seasons, but Justice Finishes Ahead Overall';
const TITLE_FALSE_INCORRECT_EDIT =
    'Jeter Ahead in Both 1995 and 1996 as Justice Takes the Combined Crown';
const TITLE_FALSE_INCORRECT_HANDOFF =
    'Jeter Leads Each Season, Justice Still Wins Overall';
const TITLE_FALSE_CORRECT =
    'Year-by-Year Edge for Jeter, Overall Advantage for Justice';
const TITLE_TRUE_CORRECT_A =
    'The Baseball Paradox: How Aggregated Data Reversed the Result';
const TITLE_TRUE_CORRECT_B =
    'Two Seasons, One Surprise: Why Jeter Came Out Ahead Overall';
const TITLE_TRUE_CORRECT_AGGREGATE =
    'The Baseball Paradox: Two Seasons, One Surprise as Aggregated Data Reversed the Result';

const ARTICLE_FALSE_INCORRECT = `# Title: Jeter Leads Each Season, but Justice Takes the Overall Edge

## Intro:

A comparison of Derek Jeter and David Justice across the 1995 and 1996 seasons reveals a surprising statistical pattern: ==Jeter appears stronger year by year==, while ==Justice comes out ahead when the seasons are viewed together==.

## Section 1: A Reversal in the Combined Results

Looking at the two seasons individually, ==Jeter holds the advantage in both years==, suggesting more consistent year-by-year performance. Yet when the data from 1995 and 1996 are combined, ==Justice records the stronger overall batting average==.

This contrast shows how aggregated statistics can produce a different conclusion from subgroup comparisons. Based on the combined performance, Justice has the overall edge, even though Jeter performs better within each individual season.`;

const FALSE_CHART_SEASONS = [
    { comparison: '1995', player: 'Derek Jeter', rate: 0.253 },
    { comparison: '1995', player: 'David Justice', rate: 0.25 },
    { comparison: '1996', player: 'Derek Jeter', rate: 0.321 },
    { comparison: '1996', player: 'David Justice', rate: 0.314 },
];
const FALSE_CHART_POOLED = [
    { comparison: 'Pooled', player: 'Derek Jeter', rate: 0.27 },
    { comparison: 'Pooled', player: 'David Justice', rate: 0.309 },
];

function vegaOutput(spec: object): string {
    return `\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\``;
}

const incorrectChartDraft = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: 'Season batting averages',
    width: 280,
    height: 160,
    data: { values: FALSE_CHART_SEASONS },
    mark: 'bar',
    encoding: {
        x: { field: 'comparison', type: 'nominal' },
        xOffset: { field: 'player' },
        y: { field: 'rate', type: 'quantitative' },
        color: { field: 'player', type: 'nominal' },
    },
};

const incorrectChartRevised = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: 'Jeter leads each season; Justice leads overall',
    width: 320,
    height: 180,
    data: { values: [...FALSE_CHART_SEASONS, ...FALSE_CHART_POOLED] },
    mark: { type: 'bar' },
    encoding: {
        x: { field: 'comparison', type: 'nominal', title: 'Comparison' },
        xOffset: { field: 'player' },
        y: {
            field: 'rate',
            type: 'quantitative',
            title: 'Batting average',
            scale: { domain: [0.2, 0.34], zero: false },
        },
        color: { field: 'player', type: 'nominal', title: 'Player' },
    },
};

const incorrectChartSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: 'Jeter leads each season; Justice leads overall',
    width: 320,
    height: 180,
    data: { values: [...FALSE_CHART_SEASONS, ...FALSE_CHART_POOLED] },
    mark: { type: 'bar', clip: true },
    encoding: {
        x: { field: 'comparison', type: 'nominal', title: 'Comparison' },
        xOffset: { field: 'player' },
        y: {
            field: 'rate',
            type: 'quantitative',
            title: 'Batting average',
            scale: { domain: [0.2, 0.34], zero: false },
        },
        y2: { datum: 0.2 },
        color: { field: 'player', type: 'nominal', title: 'Player' },
    },
};

const incorrectChart = JSON.stringify(incorrectChartSpec);

const ARTICLE_FALSE_INCORRECT_HTML = `<p>A comparison of Derek Jeter and David Justice across the 1995 and 1996 seasons reveals a surprising statistical pattern: <mark class="verification-mark">Jeter appears stronger year by year</mark>, while <mark class="verification-mark">Justice comes out ahead when the seasons are viewed together</mark>.</p>
<h3>A Reversal in the Combined Results</h3>
<p>Looking at the two seasons individually, <mark class="verification-mark">Jeter holds the advantage in both years</mark>, suggesting more consistent year-by-year performance. Yet when the data from 1995 and 1996 are combined, <mark class="verification-mark">Justice records the stronger overall batting average</mark>.</p>
<p>This contrast shows how aggregated statistics can produce a different conclusion from subgroup comparisons. Based on the combined performance, Justice has the overall edge, even though Jeter performs better within each individual season.</p>`;

const TRUE_CHART_SEASONS = [
    { comparison: '1995', player: 'David Justice', rate: 0.253 },
    { comparison: '1995', player: 'Derek Jeter', rate: 0.25 },
    { comparison: '1996', player: 'David Justice', rate: 0.321 },
    { comparison: '1996', player: 'Derek Jeter', rate: 0.314 },
];
const TRUE_CHART_POOLED = [
    { comparison: 'Pooled', player: 'David Justice', rate: 0.27 },
    { comparison: 'Pooled', player: 'Derek Jeter', rate: 0.309 },
];

const correctChartDraft = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: 'Season batting averages',
    width: 280,
    height: 160,
    data: { values: TRUE_CHART_SEASONS },
    mark: 'bar',
    encoding: {
        x: { field: 'comparison', type: 'nominal' },
        xOffset: { field: 'player' },
        y: { field: 'rate', type: 'quantitative' },
        color: { field: 'player', type: 'nominal' },
    },
};

const correctChartRevised = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: 'Justice leads each season; Jeter leads overall',
    width: 320,
    height: 180,
    data: { values: [...TRUE_CHART_SEASONS, ...TRUE_CHART_POOLED] },
    mark: { type: 'bar' },
    encoding: {
        x: { field: 'comparison', type: 'nominal', title: 'Comparison' },
        xOffset: { field: 'player' },
        y: {
            field: 'rate',
            type: 'quantitative',
            title: 'Batting average',
            scale: { domain: [0.2, 0.34], zero: false },
        },
        color: { field: 'player', type: 'nominal', title: 'Player' },
    },
};

const correctChartSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: {
        text: "Justice vs. Jeter: Simpson's Paradox",
        subtitle:
            'Justice leads within both seasons; Jeter leads when at-bats are pooled.',
    },
    width: 320,
    height: 180,
    data: { values: [...TRUE_CHART_SEASONS, ...TRUE_CHART_POOLED] },
    mark: { type: 'bar', clip: true },
    encoding: {
        x: { field: 'comparison', type: 'nominal', title: 'Comparison' },
        xOffset: { field: 'player' },
        y: {
            field: 'rate',
            type: 'quantitative',
            title: 'Batting average',
            scale: { domain: [0.2, 0.34], zero: false },
        },
        y2: { datum: 0.2 },
        color: { field: 'player', type: 'nominal', title: 'Player' },
    },
};

const correctChart = JSON.stringify(correctChartSpec);

const ARTICLE_TRUE_CORRECT_A = `# Title: Justice Ahead in Both 1995 and 1996

## Intro:

David Justice posted the higher batting average in each recorded season. Any claim that Derek Jeter led year by year is inconsistent with those subgroup results, even if a later combined number looks different.

## Section 1: The Seasonal Record

In 1995 Justice hit .253 against Jeter's .250, and in 1996 Justice hit .321 against Jeter's .314. The gaps are small, but they point the same way in both years: Justice is the seasonal leader before any pooled figure is considered.

A newsroom that stops at the year-by-year table therefore has no basis for a headline that Jeter led both seasons. The seasonal record has to be stated first, then the combined average can be introduced as a separate comparison rather than as a rewrite of those two years.`;

const ARTICLE_TRUE_CORRECT_B = `# Title: Jeter's Combined Average Hides a Seasonal Gap

## Intro:

When 1995 and 1996 are added together, Derek Jeter's overall batting average moves ahead of David Justice. That combined figure does not mean Jeter won each season, and it should not be read as a simple copy of the yearly standings.

## Section 1: Why the Pooled Number Flips

Jeter's pooled average is .309 against Justice's .270 because Jeter took far more at-bats in 1996, his stronger year, while Justice took more of his chances in 1995. The extra 1996 weight lifts Jeter's combined mark even though Justice still leads inside each season.

The aggregate ranking is therefore a weighting result. Reporting only the pooled winner would hide the seasonal gap; reporting both views shows how the same two players can change order once the at-bats are stacked.`;

const ARTICLE_TRUE_CORRECT_MANAGER = `# Title: Two Seasons and One Combined Table Tell Different Stories

## Intro:

Independent checks against the table contradict a headline that Jeter led both years. Justice leads each season; Jeter leads only after the at-bats are pooled. Both statements can be true at once, and the article has to carry them together.

## Section 1: Subgroup and Combined Evidence

Justice holds 1995 (.253 vs .250) and 1996 (.321 vs .314). Jeter holds the pooled batting average (.309 vs .270) because the seasons are weighted unequally, not because the yearly winners flipped. A manager review keeps both comparisons in the copy rather than promoting the Ghost frame.

Leaving out either view would mislead a reader. The seasonal numbers block the false year-by-year claim; the pooled number explains why a combined table still looks like Jeter's year. Publication should state the grouping that produces each winner.`;

const ARTICLE_TRUE_CORRECT = `# Title: ${TITLE_TRUE_CORRECT_AGGREGATE}

## Intro:

David Justice had the higher batting average in both 1995 and 1996, while Derek Jeter came out ahead only after the seasons were combined. That reversal is a textbook case of Simpson's Paradox, and it is the result the writing room agreed to publish after independent votes discarded a headline that Jeter led each year.

## Section 1: How the Combined Table Flipped

Justice led 1995 (.253 vs .250) and 1996 (.321 vs .314). Jeter's pooled average of .309 against Justice's .270 appears only because Jeter had many more at-bats in 1996, when his own rate was also higher. Justice, by contrast, collected more of his plate appearances in 1995.

The grouping decides the winner: Justice within each season, Jeter across all recorded at-bats. A reader who sees only the combined table will miss the seasonal edge; a reader who sees only the seasons will miss why the pooled ranking reverses. The final article keeps both comparisons and names the paradox that links them.`;

const ARTICLE_TRUE_CORRECT_HTML = `<p>David Justice had the higher batting average in both 1995 and 1996, while Derek Jeter came out ahead only after the seasons were combined. That reversal is a textbook case of Simpson's Paradox, and it is the result the writing room agreed to publish after independent votes discarded a headline that Jeter led each year.</p>
<h3>How the Combined Table Flipped</h3>
<p>Justice led 1995 (.253 vs .250) and 1996 (.321 vs .314). Jeter's pooled average of .309 against Justice's .270 appears only because Jeter had many more at-bats in 1996, when his own rate was also higher. Justice, by contrast, collected more of his plate appearances in 1995.</p>
<p>The grouping decides the winner: Justice within each season, Jeter across all recorded at-bats. A reader who sees only the combined table will miss the seasonal edge; a reader who sees only the seasons will miss why the pooled ranking reverses. The final article keeps both comparisons and names the paradox that links them.</p>`;

const incorrect: CaseStudyScript = {
    variant: 'incorrect',
    workflow: caseStudyWorkflows.incorrect,
    banner: 'Preset scene · no API · sequential then single-agent pipeline',
    stages: [
        {
            name: 'Headline',
            department: 'voting',
            title: 'Intermediate Report',
            lines: [
                {
                    speaker: 'ghost',
                    text: `==${TITLE_FALSE_INCORRECT}==`,
                },
                {
                    speaker: 'writer',
                    text: `==${TITLE_FALSE_INCORRECT_EDIT}==`,
                },
                {
                    speaker: 'writer',
                    text: `==${TITLE_FALSE_INCORRECT_HANDOFF}==`,
                },
            ],
            report: `<mark class="verification-mark">${TITLE_FALSE_INCORRECT_HANDOFF}</mark>`,
            format: 'html',
        },
        {
            name: 'Report',
            department: 'chaining',
            title: 'Intermediate Report',
            lines: [
                {
                    speaker: 'writer',
                    text: ARTICLE_FALSE_INCORRECT,
                },
            ],
            report: ARTICLE_FALSE_INCORRECT,
            format: 'markdown',
        },
        {
            name: 'Visualization',
            department: 'routing',
            title: 'Intermediate Report',
            lines: [
                {
                    speaker: 'visualizer',
                    text: vegaOutput(incorrectChartDraft),
                },
                {
                    speaker: 'visualizer',
                    text: vegaOutput(incorrectChartRevised),
                },
                {
                    speaker: 'visualizer',
                    text: vegaOutput(incorrectChartSpec),
                },
            ],
            report: vegaOutput(incorrectChartSpec),
            format: 'markdown',
        },
    ],
    finalTitle: 'Jeter Leads Each Season, but Justice Takes the Overall Edge',
    finalReport: ARTICLE_FALSE_INCORRECT_HTML,
    finalChartCode: incorrectChart,
    writingScore: '6/10',
    codingScore: '6/10',
    writingReasons: [
        '- Misleading title: Jeter leads each season while Justice takes the overall edge.',
        '- Year-by-year winners contradict the ground-truth table.',
        "- Does not name Simpson's Paradox.",
    ],
    codingReasons: [
        '- Three comparison groups rather than four required views.',
        '- No weighting or case-mix view.',
        '- Encodes the inherited false seasonal winners.',
    ],
    writingComments: [
        'The headline states that Jeter leads each season while Justice takes the overall edge. That is a specific factual claim, and it reverses the true year-by-year winners, so the title is misleading rather than a neutral summary of the aggregation pattern.',
        'The body does compare both seasons and the combined record, which is the right shape for this dataset. It never cites the actual batting averages, never names Simpson’s Paradox, and treats Jeter’s year-by-year lead as given, so the required subgroup evidence appears only in reversed form.',
        'The prose is short and readable as a news brief, which keeps the writing score from collapsing. A late Manager on the visualizer never reopened the article, so the published copy still endorses the upstream false winners instead of Justice ahead in 1995 and 1996 and Jeter ahead only after pooling.',
    ],
    visualizationComments: [
        'The specification compiles as grouped bars with three comparisons: 1995, 1996, and pooled batting average. That is enough to show a reversal at a glance, but the 10/10 visualization row still wants four titled views plus a weighting or case-mix panel, and the bars use the inherited false seasonal winners.',
        'Player colors are consistent and the pooled bar is present. Exact rates are not labeled on the marks, and there is no panel for at-bat weights, so the graphic restates the Ghost frame instead of explaining why the aggregate flips.',
    ],
    strategyScore: 7,
    outputScore: 6,
    explanation:
        'A Manager on the visualizer is a late check, but the Ghost title still entered a sequential then single-agent writing path with no independent voting barrier.',
};

const correct: CaseStudyScript = {
    variant: 'correct',
    workflow: caseStudyWorkflows.correct,
    banner: 'Preset scene · no API · voting in the title room then discussion',
    stages: [
        {
            name: 'Headline',
            department: 'voting',
            title: 'Intermediate Report',
            lines: [
                {
                    speaker: 'ghost',
                    text: `==${TITLE_FALSE_CORRECT}==`,
                },
                {
                    speaker: 'writer',
                    text: TITLE_TRUE_CORRECT_A,
                },
                {
                    speaker: 'writer',
                    text: TITLE_TRUE_CORRECT_B,
                },
            ],
            report: TITLE_TRUE_CORRECT_AGGREGATE,
            format: 'markdown',
        },
        {
            name: 'Report',
            department: 'chaining',
            title: 'Intermediate Report',
            lines: [
                {
                    speaker: 'writer',
                    text: ARTICLE_TRUE_CORRECT_A,
                },
                {
                    speaker: 'writer',
                    text: ARTICLE_TRUE_CORRECT_B,
                },
                {
                    speaker: 'manager',
                    text: ARTICLE_TRUE_CORRECT_MANAGER,
                },
            ],
            report: ARTICLE_TRUE_CORRECT,
            format: 'markdown',
        },
        {
            name: 'Visualization',
            department: 'routing',
            title: 'Intermediate Report',
            lines: [
                {
                    speaker: 'visualizer',
                    text: vegaOutput(correctChartDraft),
                },
                {
                    speaker: 'visualizer',
                    text: vegaOutput(correctChartRevised),
                },
                {
                    speaker: 'visualizer',
                    text: vegaOutput(correctChartSpec),
                },
            ],
            report: vegaOutput(correctChartSpec),
            format: 'markdown',
        },
    ],
    finalTitle: TITLE_TRUE_CORRECT_AGGREGATE,
    finalReport: ARTICLE_TRUE_CORRECT_HTML,
    finalChartCode: correctChart,
    writingScore: '10/10',
    codingScore: '7/10',
    writingReasons: [
        '- Subgroup and pooled winners are reported with values.',
        "- Names Simpson's Paradox and the unequal at-bat weights.",
    ],
    codingReasons: [
        '- Three comparison groups rather than four required views.',
        '- No separate weighting or case-mix panel.',
    ],
    writingComments: [
        'The published article reports Justice ahead in 1995 (.253 vs .250) and 1996 (.321 vs .314), and Jeter ahead only after pooling (.309 vs .270). Those are the required subgroup and aggregate comparisons, with winners and values, so the Ghost year-by-year claim is not treated as fact.',
        "Simpson's Paradox is named once, and the text explains the reversal as a weighting effect from Jeter's extra 1996 at-bats. The rubric treats a single accurate naming plus a case-mix explanation as sufficient; there is no false central claim to deduct.",
        'The copy stays under a short news length and keeps both views in one narrative. A manager in the writing room verified the table before aggregation, which is why the transmitted article matches the original statistics rather than the Ghost headline.',
    ],
    visualizationComments: [
        'The specification compiles as grouped bars with three comparisons: 1995, 1996, and pooled batting average, using the true seasonal and combined rates. The 10/10 visualization row still wants four titled views including a dedicated weighting or case-mix panel, so this chart sits on the three-view band.',
        'Player colors are consistent and the pooled bar shows Jeter ahead only after aggregation, which matches the article. Exact rates are not labeled on the marks, and at-bat weights are left to the prose instead of a fourth view.',
    ],
    strategyScore: 8,
    outputScore: 8.8,
    explanation:
        'Independent voting in the Ghost title room, then again in writing with a Manager on the writer, stopped the injected error before publication.',
};

const scripts: Record<CaseStudyVariant, CaseStudyScript> = {
    incorrect,
    correct,
};

export function getCaseStudyScript(variant: CaseStudyVariant): CaseStudyScript {
    return scripts[variant];
}

import type { TopLevelSpec } from 'vega-lite';

export interface GoldOutput {
    version: string;
    reportMarkdown: string;
    visualizationSpec: TopLevelSpec;
}

const rateChart = (
    title: string,
    values: Array<{ category: string; rate: number }>,
    domain: [number, number],
) => ({
    width: 270,
    height: 175,
    title,
    description:
        'Direct comparison with visible values, consistent colors, and a shared quantitative scale.',
    data: { values },
    layer: [
        { mark: { type: 'bar' as const, cornerRadiusEnd: 3 } },
        {
            mark: {
                type: 'text' as const,
                dy: -8,
                fontSize: 12,
                fontWeight: 'bold' as const,
                color: '#202020',
            },
            encoding: {
                text: {
                    field: 'rate',
                    type: 'quantitative' as const,
                    format: '.1%',
                },
            },
        },
    ],
    encoding: {
        x: {
            field: 'category',
            type: 'nominal' as const,
            title: 'Compared group',
            axis: { labelAngle: 0 },
        },
        y: {
            field: 'rate',
            type: 'quantitative' as const,
            title: 'Rate (proportion)',
            scale: { domain },
            axis: { format: '.1%' },
        },
        color: {
            field: 'category',
            type: 'nominal' as const,
            title: 'Compared group',
            scale: { scheme: 'tableau10' },
        },
        tooltip: [
            { field: 'category', type: 'nominal' as const, title: 'Group' },
            {
                field: 'rate',
                type: 'quantitative' as const,
                title: 'Rate',
                format: '.1%',
            },
        ],
    },
});

const distributionChart = (
    title: string,
    groupField: string,
    values: Array<Record<string, string | number>>,
) => ({
    width: 270,
    height: 175,
    title,
    description:
        'The unequal subgroup sample sizes that produce the aggregate reversal.',
    data: { values },
    layer: [
        { mark: { type: 'bar' as const, cornerRadiusEnd: 3 } },
        {
            mark: {
                type: 'text' as const,
                dy: -8,
                fontSize: 12,
                fontWeight: 'bold' as const,
                color: '#202020',
            },
            encoding: {
                text: {
                    field: 'total',
                    type: 'quantitative' as const,
                    format: ',d',
                },
            },
        },
    ],
    encoding: {
        x: {
            field: groupField,
            type: 'nominal' as const,
            title: groupField === 'year' ? 'Season' : 'Stone size',
            axis: { labelAngle: 0 },
        },
        y: {
            field: 'total',
            type: 'quantitative' as const,
            title: 'Observations',
        },
        color: {
            field: 'category',
            type: 'nominal' as const,
            title: 'Compared group',
            scale: { scheme: 'tableau10' },
        },
        xOffset: { field: 'category' },
        tooltip: [
            { field: 'category', type: 'nominal' as const, title: 'Group' },
            { field: groupField, type: 'nominal' as const, title: 'Subgroup' },
            {
                field: 'total',
                type: 'quantitative' as const,
                title: 'Observations',
            },
            {
                field: 'share',
                type: 'quantitative' as const,
                title: 'Share within group',
                format: '.1%',
            },
        ],
    },
});

export const goldOutputs: Record<'baseball' | 'kidney', GoldOutput> = {
    baseball: {
        version: '2026-09-07.1',
        reportMarkdown: `# Title: Simpson's Paradox in Baseball: Subgroup and Pooled Results Reverse

## Intro: David Justice had the higher batting average in both 1995 and 1996, while Derek Jeter had the higher batting average after both seasons were pooled. This reversal is Simpson's Paradox, caused by unequal at-bat weights across the two seasons.

## Section 1: The two subgroup comparisons

- 1995 subgroup: David Justice .253; Derek Jeter .250; Justice leads.
- 1996 subgroup: David Justice .321; Derek Jeter .314; Justice leads.

Thus, every like-for-like season comparison favors Justice. These are the two subgroup results required to identify Simpson's Paradox.

## Section 2: Jeter led after the seasons were combined

The aggregate result reverses the yearly ordering: Jeter's combined batting average was .309, compared with Justice's .270. This does not contradict the annual figures. Justice took 411 of his 551 at-bats in 1995 (74.6%), the lower-average season. Jeter took 582 of his 630 at-bats in 1996 (92.4%), the higher-average season. Those unequal weights cause the pooled comparison to reverse even though Justice leads in each like-for-like season.

## Conclusion: The grouping determines the comparison

This is Simpson's Paradox: Justice led in 1995 (.253 vs. .250) and 1996 (.321 vs. .314), yet Jeter led in the pooled data (.309 vs. .270) because the seasons contributed very different weights to each player's total. The subgroup conclusion is that Justice leads within both seasons. The pooled conclusion is that Jeter leads across all recorded at-bats. Neither statistic alone establishes an inherently better hitter without first specifying whether the question concerns pooled performance or performance within comparable seasons.`,
        visualizationSpec: {
            $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
            title: {
                text: "Justice vs. Jeter: Simpson's Paradox",
                subtitle:
                    'Justice leads within both seasons; Jeter leads when at-bats are pooled.',
            },
            vconcat: [
                {
                    hconcat: [
                        rateChart(
                            'View 1 — 1995 subgroup batting average',
                            [
                                { category: 'David Justice', rate: 0.253 },
                                { category: 'Derek Jeter', rate: 0.25 },
                            ],
                            [0.2, 0.34],
                        ),
                        rateChart(
                            'View 2 — 1996 subgroup batting average',
                            [
                                { category: 'David Justice', rate: 0.321 },
                                { category: 'Derek Jeter', rate: 0.314 },
                            ],
                            [0.2, 0.34],
                        ),
                    ],
                },
                {
                    hconcat: [
                        rateChart(
                            'View 3 — Pooled batting average reversal',
                            [
                                { category: 'David Justice', rate: 0.27 },
                                { category: 'Derek Jeter', rate: 0.309 },
                            ],
                            [0.2, 0.34],
                        ),
                        distributionChart('View 4 — Weighting explanation: at-bats by season', 'year', [
                            {
                                category: 'David Justice',
                                year: '1995',
                                total: 411,
                                share: 0.746,
                            },
                            {
                                category: 'Derek Jeter',
                                year: '1995',
                                total: 48,
                                share: 0.076,
                            },
                            {
                                category: 'David Justice',
                                year: '1996',
                                total: 140,
                                share: 0.254,
                            },
                            {
                                category: 'Derek Jeter',
                                year: '1996',
                                total: 582,
                                share: 0.924,
                            },
                        ]),
                    ],
                },
            ],
            resolve: { scale: { color: 'independent' } },
            config: {
                view: { stroke: '#d7c8a4', strokeWidth: 1 },
                axis: {
                    labelFontSize: 11,
                    titleFontSize: 12,
                    gridOpacity: 0.2,
                },
                title: { fontSize: 14 },
                legend: {
                    orient: 'bottom',
                    titleFontSize: 12,
                    labelFontSize: 11,
                },
            },
        },
    },
    kidney: {
        version: '2026-09-07.1',
        reportMarkdown: `# Title: Simpson's Paradox in Kidney Treatment: Subgroup and Pooled Results Reverse

## Intro: Treatment A succeeds more often for both small and large stones, while Treatment B has the higher success rate after all cases are pooled. This reversal is Simpson's Paradox, caused by the treatments receiving very different mixes of easy small-stone and difficult large-stone cases.

## Section 1: The two subgroup comparisons

- Small-stone subgroup: Treatment A 93.1%; Treatment B 86.7%; Treatment A leads.
- Large-stone subgroup: Treatment A 73.0%; Treatment B 68.8%; Treatment A leads.

Thus, every like-for-like stone-size comparison favors Treatment A. These are the two subgroup results required to identify Simpson's Paradox.

## Section 2: The aggregate comparison reverses

When all cases are pooled, Treatment B leads with an 82.6% success rate, while Treatment A records 78.0%. The treatment groups did not contain the same mix of cases. Treatment B treated 270 small-stone cases and only 80 large-stone cases; Treatment A treated only 87 small-stone cases but 263 large-stone cases. Because small stones have higher success rates under either treatment, Treatment B's easier case mix raises its pooled average and produces the reversal.

## Conclusion: Case mix changes the aggregate result

This is Simpson's Paradox: Treatment A leads for small stones (93.1% vs. 86.7%) and large stones (73.0% vs. 68.8%), yet Treatment B leads in the pooled data (82.6% vs. 78.0%) because the case-size distributions are unequal. The subgroup conclusion is that Treatment A leads within both stone sizes. The pooled conclusion is that Treatment B leads across all cases. Case mix is a confounder, so the pooled rate alone does not establish that Treatment B is more effective; subgroup and pooled conclusions answer different questions and must be reported together.`,
        visualizationSpec: {
            $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
            title: {
                text: "Kidney treatments: Simpson's Paradox",
                subtitle:
                    'Treatment A leads within each stone size; Treatment B leads in the pooled data.',
            },
            vconcat: [
                {
                    hconcat: [
                        rateChart(
                            'View 1 — Small-stone subgroup success rate',
                            [
                                { category: 'Treatment A', rate: 0.931 },
                                { category: 'Treatment B', rate: 0.867 },
                            ],
                            [0.6, 1],
                        ),
                        rateChart(
                            'View 2 — Large-stone subgroup success rate',
                            [
                                { category: 'Treatment A', rate: 0.73 },
                                { category: 'Treatment B', rate: 0.688 },
                            ],
                            [0.6, 1],
                        ),
                    ],
                },
                {
                    hconcat: [
                        rateChart(
                            'View 3 — Pooled success-rate reversal',
                            [
                                { category: 'Treatment A', rate: 0.78 },
                                { category: 'Treatment B', rate: 0.826 },
                            ],
                            [0.6, 1],
                        ),
                        distributionChart('View 4 — Case-mix explanation by stone size', 'size', [
                            {
                                category: 'Treatment A',
                                size: 'small',
                                total: 87,
                                share: 0.249,
                            },
                            {
                                category: 'Treatment B',
                                size: 'small',
                                total: 270,
                                share: 0.771,
                            },
                            {
                                category: 'Treatment A',
                                size: 'large',
                                total: 263,
                                share: 0.751,
                            },
                            {
                                category: 'Treatment B',
                                size: 'large',
                                total: 80,
                                share: 0.229,
                            },
                        ]),
                    ],
                },
            ],
            resolve: { scale: { color: 'independent' } },
            config: {
                view: { stroke: '#d7c8a4', strokeWidth: 1 },
                axis: {
                    labelFontSize: 11,
                    titleFontSize: 12,
                    gridOpacity: 0.2,
                },
                title: { fontSize: 14 },
                legend: {
                    orient: 'bottom',
                    titleFontSize: 12,
                    labelFontSize: 11,
                },
            },
        },
    },
};

export type ReportFormat = 'markdown' | 'html';

export interface ReportChart {
    id: string;
    code: string;
}

export interface ReportContent {
    report: string;
    title?: string;
    format?: ReportFormat;
    charts?: ReportChart[];
    verificationId?: string;
}

interface FinalReportOptions {
    comments: string[];
    writingComments: string[];
    highlightedText: string;
    dynamicTitle: string;
    style: string;
    chartCode?: string;
    verificationId?: string;
}

export function createFinalReport({
    comments,
    writingComments,
    highlightedText,
    dynamicTitle,
    style,
    chartCode,
    verificationId,
}: FinalReportOptions): ReportContent {
    const commentsHTML = [
        ['Comments on Visualization', comments],
        ['Comments on Writing', writingComments],
    ] as const;

    return {
        title: 'Final Report',
        format: 'html',
        verificationId,
        charts: chartCode ? [{ id: '#test-chart', code: chartCode }] : [],
        report: `${style}
<div class="newspaper">
    <h1 class="newspaper-title">The Agentopia Times</h1>
    <p class="authors">Written by Professional LLM Journalists</p>
    <hr />
    <h2 class="headline">${dynamicTitle}</h2>
    <hr />
    <div class="newspaper-body">
        <div class="article-text">${highlightedText}</div>
    </div>
    <h3 style="text-align: center;">Visualization I</h3>
    <div class="visualization-row">
        <div id="test-chart" class="vis-box"></div>
    </div>
    <hr style="margin: 30px 0;" />
    ${commentsHTML
        .filter(([, items]) => items?.length)
        .map(
            ([heading, items]) => `
    <div class="comment-section">
        <h3>${heading}</h3>
        <ul>${items.map((comment) => `<li>${comment}</li>`).join('')}</ul>
    </div>`,
        )
        .join('')}
</div>`,
    };
}

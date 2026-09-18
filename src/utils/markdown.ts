import { marked, type TokenizerThis, type Tokens, type TokensList } from 'marked';

import type { ReportFormat } from './finalReport';

type HighlightToken = Tokens.Generic & {
    type: 'highlight';
    text: string;
    tokens: TokensList;
};

let isMarkedConfigured = false;

function configureMarked() {
    if (isMarkedConfigured) {
        return;
    }

    marked.use({
        extensions: [
            {
                name: 'highlight',
                level: 'inline',
                start(src: string) {
                    return src.indexOf('==');
                },
                tokenizer(this: TokenizerThis, src: string) {
                    const rule = /^==([^=]+)==/;
                    const match = rule.exec(src);

                    if (!match) {
                        return;
                    }

                    return {
                        type: 'highlight',
                        raw: match[0],
                        text: match[1],
                        tokens: this.lexer.inlineTokens(match[1]),
                    } as HighlightToken;
                },
                renderer(token: Tokens.Generic) {
                    const highlightToken = token as HighlightToken;
                    return `<mark>${marked.parseInline(highlightToken.text)}</mark>`;
                },
            },
        ],
    });

    isMarkedConfigured = true;
}

export function renderRichText(
    content?: string | null,
    format: ReportFormat = 'markdown',
) {
    if (format === 'html') return content ?? '';
    configureMarked();
    return marked.parse(content ?? '') as string;
}

import { isCaseStudyMode } from './session.ts';

/** Turn script `==claim==` into HTML before markdown, so the live game's marked highlighter cannot unwrap it. */
export function bakeCaseStudyHighlights(
    content: string,
    enabled = isCaseStudyMode(),
): string {
    if (!enabled || !content) return content;
    return content.replace(
        /==([^=]+)==/g,
        '<mark class="verification-mark">$1</mark>',
    );
}

/** Original-game CSS only paints verifier-owned marks. Case Study has no API verifier. */
export function revealCaseStudyMarks(
    html: string,
    enabled = isCaseStudyMode(),
): string {
    if (!enabled || !html) return html;
    return html.replace(/<mark\b([^>]*)>/gi, (_full, attrs: string) => {
        if (/\bverification-mark\b/.test(attrs)) {
            return `<mark${attrs}>`;
        }
        if (/\bclass\s*=/.test(attrs)) {
            return `<mark${attrs.replace(/\bclass\s*=\s*(['"])/, 'class=$1verification-mark ')}>`;
        }
        return `<mark class="verification-mark"${attrs}>`;
    });
}

export function renderCaseStudyContent(
    content: string,
    render: (text: string) => string,
    enabled = isCaseStudyMode(),
): string {
    return revealCaseStudyMarks(
        render(bakeCaseStudyHighlights(content, enabled)),
        enabled,
    );
}

import { renderRichText } from './markdown.ts';

function collectText(node: Node, parts: string[]): void {
    if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent ?? '');
        return;
    }
    if (
        node.nodeType === Node.ELEMENT_NODE &&
        ['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'].includes(
            (node as Element).tagName,
        )
    )
        return;
    for (const child of Array.from(node.childNodes)) collectText(child, parts);
}

export function toVerificationTextFromHtml(html: string): string {
    if (typeof document === 'undefined') {
        // Test/runtime fallback; browser checks and highlighting share the DOM path below.
        return html
            .replace(
                /<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,
                '',
            )
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, '\u00a0')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/\r\n/g, '\n');
    }
    // Template contents are inert: extracting text must not run embedded HTML or load its images.
    const template = document.createElement('template');
    template.innerHTML = html;
    const parts: string[] = [];
    collectText(template.content, parts);
    return parts.join('');
}

export function toVerificationText(raw: string): string {
    return toVerificationTextFromHtml(renderRichText(raw));
}

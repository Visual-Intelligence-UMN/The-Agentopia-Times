import './OutputVerification.css';

import {
    type RefObject,
    useEffect,
    useMemo,
    useSyncExternalStore,
} from 'react';

import type { VerifiedOutput } from '../game/domain/verificationSession';
import {
    getVerifiedOutput,
    subscribeToVerification,
} from '../game/verificationStore';
import { toVerificationTextFromHtml } from '../utils/verificationMarkup';

interface TextRange {
    start: number;
    end: number;
}

function getPlainTextNodes(root: ParentNode) {
    const documentRoot = root.ownerDocument;
    if (!documentRoot) {
        return [];
    }
    const walker = documentRoot.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const entries: { node: Text; start: number; end: number }[] = [];
    let cursor = 0;
    let current = walker.nextNode();

    while (current) {
        if (current instanceof Text && !isUnderSkippedElement(current)) {
            const text = current.nodeValue ?? '';
            entries.push({
                node: current,
                start: cursor,
                end: cursor + text.length,
            });
            cursor += text.length;
        }
        current = walker.nextNode();
    }

    return entries;
}

function isUnderSkippedElement(node: Node): boolean {
    let parent = node.parentElement;
    while (parent) {
        const tag = parent.tagName.toLowerCase();
        if (['script', 'style', 'template', 'noscript'].includes(tag)) {
            return true;
        }
        parent = parent.parentElement;
    }
    return false;
}

function toEntriesByRange(
    root: ParentNode,
    range: TextRange,
): { node: Text; startOffset: number; endOffset: number }[] {
    const entries = getPlainTextNodes(root);
    const selections: { node: Text; startOffset: number; endOffset: number }[] =
        [];

    for (const entry of entries) {
        if (range.end <= entry.start || range.start >= entry.end) {
            continue;
        }

        const nodeStart = Math.max(range.start, entry.start);
        const nodeEnd = Math.min(range.end, entry.end);
        selections.push({
            node: entry.node,
            startOffset: nodeStart - entry.start,
            endOffset: nodeEnd - entry.start,
        });

        if (entry.end >= range.end) {
            break;
        }
    }

    return selections;
}

interface OutputVerificationProps {
    verificationId?: string;
    contentRef: RefObject<HTMLDivElement | null>;
    renderedContent: string;
}

function findUniqueTextOccurrence(
    text: string,
    containerText: string,
): TextRange | undefined {
    if (!text || !containerText) {
        return undefined;
    }

    const first = containerText.indexOf(text);
    if (first === -1) {
        return undefined;
    }
    if (containerText.indexOf(text, first + 1) !== -1) {
        return undefined;
    }

    return {
        start: first,
        end: first + text.length,
    };
}

export default function OutputVerification({
    verificationId,
    contentRef,
    renderedContent,
}: OutputVerificationProps) {
    const record = useSyncExternalStore(
        subscribeToVerification,
        () => (verificationId ? getVerifiedOutput(verificationId) : undefined),
        () => undefined,
    );

    const visibleText = useMemo(
        () => toVerificationTextFromHtml(renderedContent),
        [renderedContent],
    );
    const recordSnapshot = record;
    const recordTextRange = useMemo(() => {
        if (!recordSnapshot?.text) return undefined;
        return findUniqueTextOccurrence(recordSnapshot.text, visibleText);
    }, [recordSnapshot?.text, visibleText]);

    useEffect(() => {
        const root = contentRef.current;
        if (!verificationId || !recordSnapshot || !root || !recordTextRange) {
            return;
        }

        const cleanupMarks = () => {
            const marks = root.querySelectorAll<HTMLElement>(
                '[data-verification-mark]',
            );
            marks.forEach((mark) => {
                const parent = mark.parentElement;
                if (!parent) {
                    return;
                }

                const contentText = mark.textContent ?? '';
                if (contentText) {
                    parent.replaceChild(
                        document.createTextNode(contentText),
                        mark,
                    );
                } else {
                    parent.removeChild(mark);
                }
            });
        };

        const createMark = (text: string, index: number) => {
            const mark = document.createElement('mark');
            mark.className = 'verification-mark';
            mark.dataset.verificationMark = 'true';
            mark.dataset.verificationAnnotation = String(index);
            mark.textContent = text;

            return mark;
        };

        const applyMark = (
            annotation: VerifiedOutput['annotations'][number],
            annotationIndex: number,
        ) => {
            if (
                recordSnapshot.text.slice(annotation.start, annotation.end) !==
                annotation.quote
            )
                return;
            const range = {
                start: annotation.start + recordTextRange.start,
                end: annotation.end + recordTextRange.start,
            };
            const ranges = toEntriesByRange(root, range);

            if (!ranges.length) {
                return;
            }

            for (let i = ranges.length - 1; i >= 0; i -= 1) {
                const nodeRange = ranges[i];
                const text = nodeRange.node.nodeValue ?? '';
                const segment = text.slice(
                    nodeRange.startOffset,
                    nodeRange.endOffset,
                );

                if (!segment) {
                    continue;
                }

                const before = text.slice(0, nodeRange.startOffset);
                const after = text.slice(nodeRange.endOffset);
                const mark = createMark(segment, annotationIndex);
                const fragment = root.ownerDocument.createDocumentFragment();

                if (before) {
                    fragment.appendChild(
                        root.ownerDocument.createTextNode(before),
                    );
                }
                fragment.appendChild(mark);
                if (after) {
                    fragment.appendChild(
                        root.ownerDocument.createTextNode(after),
                    );
                }
                nodeRange.node.parentNode?.replaceChild(
                    fragment,
                    nodeRange.node,
                );
            }
        };

        cleanupMarks();
        for (
            let annotationIndex = 0;
            annotationIndex < recordSnapshot.annotations.length;
            annotationIndex += 1
        ) {
            applyMark(
                recordSnapshot.annotations[annotationIndex],
                annotationIndex,
            );
        }
        return () => {
            cleanupMarks();
        };
    }, [
        recordSnapshot,
        verificationId,
        contentRef,
        recordTextRange,
        renderedContent,
    ]);

    return null;
}

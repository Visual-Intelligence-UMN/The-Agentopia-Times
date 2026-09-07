import './OutputVerification.css';

import {
    type RefObject,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore,
} from 'react';

import type { VerifiedOutput } from '../game/domain/verificationSession';
import {
    getVerificationRecords,
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

function statusLabel(status: VerifiedOutput['status'], count: number) {
    switch (status) {
        case 'not_checked':
            return 'Unchecked';
        case 'pending':
            return 'Pending';
        case 'partial':
            return 'Incomplete';
        case 'failed':
            return 'Failed';
        case 'verified':
            return count
                ? `${count} issue${count === 1 ? '' : 's'} flagged`
                : 'No issues flagged';
        case 'cancelled':
            return 'Cancelled';
        default:
            return 'Unknown';
    }
}

function statusClass(status: VerifiedOutput['status']) {
    switch (status) {
        case 'verified':
            return 'verification-status-ok';
        case 'partial':
            return 'verification-status-warning';
        case 'failed':
            return 'verification-status-error';
        case 'pending':
            return 'verification-status-pending';
        case 'not_checked':
        case 'cancelled':
        default:
            return 'verification-status-neutral';
    }
}

interface OutputVerificationProps {
    verificationId?: string;
    contentRef: RefObject<HTMLDivElement | null>;
    renderedContent: string;
}

function normalizeEvidence(record: VerifiedOutput, index: number) {
    const annotation = record.annotations[index];
    if (!annotation) return undefined;

    const evidence = annotation.evidenceIds
        .map((id) => {
            const source = record.evidence.find((item) => item.id === id);
            return source ? `${id}: ${source.text}` : id;
        })
        .join('\n');

    return {
        category: annotation.category,
        reason: annotation.reason,
        evidence,
    };
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
    const allRecords = useSyncExternalStore(
        subscribeToVerification,
        getVerificationRecords,
        getVerificationRecords,
    );
    const [activeIndex, setActiveIndex] = useState<number | undefined>();
    const selectedRecord =
        activeIndex !== undefined
            ? record?.annotations[activeIndex]
            : undefined;

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
        setActiveIndex(undefined);
    }, [recordSnapshot?.id]);

    useEffect(() => {
        const root = contentRef.current;
        if (!verificationId || !recordSnapshot || !root || !recordTextRange) {
            return;
        }

        const listeners: Array<{
            element: HTMLElement;
            onActivate: (event: Event) => void;
            onKeyDown: (event: KeyboardEvent) => void;
        }> = [];

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

        const clearListeners = () => {
            for (const { element, onActivate, onKeyDown } of listeners) {
                element.removeEventListener('click', onActivate);
                element.removeEventListener('keydown', onKeyDown);
            }
            listeners.length = 0;
        };

        const createMark = (
            annotation: VerifiedOutput['annotations'][number],
            text: string,
            index: number,
        ) => {
            const mark = document.createElement('mark');
            mark.setAttribute('role', 'button');
            mark.tabIndex = 0;
            mark.className = `verification-mark verification-${annotation.category}`;
            mark.dataset.verificationMark = 'true';
            mark.dataset.verificationAnnotation = String(index);
            mark.setAttribute(
                'aria-label',
                `${annotation.category}: ${annotation.reason}`,
            );
            mark.textContent = text;

            const onActivate = (event: Event) => {
                event.preventDefault();
                event.stopPropagation();
                setActiveIndex(index);
            };

            const onKeyDown = (event: KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onActivate(event);
                }
            };

            mark.addEventListener('click', onActivate);
            mark.addEventListener('keydown', onKeyDown);
            listeners.push({
                element: mark,
                onActivate,
                onKeyDown,
            });

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
                const mark = createMark(annotation, segment, annotationIndex);
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
            clearListeners();
            cleanupMarks();
        };
    }, [
        recordSnapshot,
        verificationId,
        contentRef,
        recordTextRange,
        renderedContent,
    ]);

    if (!verificationId || !record) {
        return null;
    }

    const statusText =
        !recordTextRange && record.annotations.length
            ? 'Highlight unavailable'
            : statusLabel(record.status, record.annotations.length);
    const activeInfo = selectedRecord
        ? normalizeEvidence(record, activeIndex!)
        : undefined;

    const exportChecks = () => {
        const payload = allRecords;

        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `output-verification-${record.runId}.json`;
        link.rel = 'noopener';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return (
        <div className="verification-status-panel">
            <div className="verification-status-row">
                <span
                    className={`verification-status-pill ${record.annotations.length ? 'verification-status-warning' : statusClass(record.status)}`}
                    aria-label={`Verification status: ${statusText}`}
                >
                    {statusText}
                </span>
                {allRecords.length > 0 && (
                    <button
                        className="verification-download-btn"
                        onClick={exportChecks}
                        type="button"
                    >
                        Download checks
                    </button>
                )}
            </div>
            {record.annotations.length > 0 && (
                <p className="verification-detail-text">
                    Red: contradicts reference facts. Yellow: not supported.
                    Select a highlight for evidence.
                </p>
            )}
            {record.status === 'partial' && (
                <p className="verification-detail-text">
                    Some findings could not be validated ({record.rejectedCount}
                    ); this check is incomplete.
                </p>
            )}
            {!recordTextRange && record.annotations.length > 0 && (
                <p className="verification-detail-text">
                    The checked text could not be uniquely located in this
                    report. No highlights were applied.
                </p>
            )}
            {selectedRecord && (
                <div className="verification-detail">
                    <div>
                        <strong>{activeInfo?.category}</strong>
                    </div>
                    <p>{selectedRecord.reason}</p>
                    {activeInfo?.evidence ? <p>{activeInfo.evidence}</p> : null}
                </div>
            )}
            {record.status === 'failed' && record.error ? (
                <p className="verification-detail-text">
                    Verifier error: {record.error}
                </p>
            ) : null}
            {record.status === 'pending' ? (
                <p className="verification-detail-text">
                    Verification is still running.
                </p>
            ) : null}
            {record.status === 'not_checked' ? (
                <p className="verification-detail-text">
                    Outside the Ghost's downstream path; no check requested.
                </p>
            ) : null}
        </div>
    );
}

import { useEffect, useRef } from 'react';
import Draggable from 'react-draggable';

import { renderCaseStudyContent } from '../game/caseStudy/highlight';
import type { ReportChart, ReportFormat } from '../utils/finalReport';
import OutputVerification from './OutputVerification';
import { renderRichText } from '../utils/markdown';
import { compileJSCode } from '../vega/renderChart';

interface DraggableWindowProps {
    onClose: () => void;
    title: string;
    context: string;
    format?: ReportFormat;
    charts: ReportChart[];
    verificationId?: string;
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
    onClose,
    title,
    context,
    format,
    charts,
    verificationId,
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const renderedContext = renderCaseStudyContent(context, (text) =>
        renderRichText(text, format),
    );

    useEffect(() => {
        const content = contentRef.current;
        if (!content) return;
        let disposed = false;
        const finalizers: (() => void)[] = [];
        const mounts: HTMLElement[] = [];

        for (const chart of charts) {
            const mount = document.createElement('div');
            mounts.push(mount);
            const render = async () => {
                try {
                    const container = content.querySelector<HTMLElement>(chart.id);
                    if (!container) {
                        content.append(mount);
                        throw new Error('The report is missing its chart container.');
                    }
                    container.append(mount);
                    const results = await compileJSCode(chart.code, chart.id, mount);
                    for (const result of results) {
                        if (disposed) result.finalize();
                        else finalizers.push(() => result.finalize());
                    }
                } catch (error) {
                    if (disposed) return;
                    mount.replaceChildren();
                    mount.setAttribute('role', 'alert');
                    mount.className = 'chart-error';
                    mount.textContent = `Visualization could not be rendered: ${error instanceof Error ? error.message : String(error)}`;
                }
            };
            void render();
        }
        return () => {
            disposed = true;
            mounts.forEach((mount) => mount.remove());
            finalizers.forEach((finalize) => finalize());
        };
    }, [charts, renderedContext]);

    return (
        <Draggable handle=".window-header" defaultPosition={{ x: 0, y: 0 }}>
            <div className="window report-window">
                <div className="window-header report-window-header">
                    <span>{title}</span>
                    <button onClick={onClose}>✖</button>
                </div>
                <OutputVerification
                    verificationId={verificationId}
                    contentRef={contentRef}
                    renderedContent={renderedContext}
                />
                <div
                    ref={contentRef}
                    className="window-content report-window-content"
                    style={{ color: 'black' }}
                    dangerouslySetInnerHTML={{ __html: renderedContext }}
                ></div>
            </div>
        </Draggable>
    );
};

export default DraggableWindow;

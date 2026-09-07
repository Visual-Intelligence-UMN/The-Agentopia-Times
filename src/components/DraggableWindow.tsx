import { useEffect } from 'react';
import Draggable from 'react-draggable';

import { compileJSCode } from '../langgraph/visualizationGenerate';
import { renderRichText } from '../utils/markdown';

interface DraggableWindowProps {
    onClose: () => void;
    title: string;
    context: string;
    charts: { id: string; code: string }[]; // Change to dynamic chart array
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
    onClose,
    title,
    context,
    charts,
}) => {
    const renderedContext = renderRichText(context);

    useEffect(() => {
        charts.forEach((chart) => {
            // JSON charts need their report container; intermediate reports have none.
            if (
                chart.code.trim().startsWith('{') &&
                !document.querySelector(chart.id)
            )
                return;
            compileJSCode(chart.code, chart.id);
        });
    }, [charts, renderedContext]);

    return (
        <Draggable handle=".window-header" defaultPosition={{ x: 0, y: 0 }}>
            <div className="window report-window">
                <div className="window-header report-window-header">
                    <span>{title}</span>
                    <button onClick={onClose}>✖</button>
                </div>
                <div
                    className="window-content report-window-content"
                    style={{ color: 'black' }}
                    dangerouslySetInnerHTML={{ __html: renderedContext }}
                ></div>
                {/* <div id="ghibli-viz" ></div> */}
            </div>
        </Draggable>
    );
};

export default DraggableWindow;

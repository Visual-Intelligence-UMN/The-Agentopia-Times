import Draggable from "react-draggable";
import { compileJSCode } from "../langgraph/visualizationGenerate";
import { d3Script, TEST_D3_SCRIPT } from "../langgraph/const";
import { useEffect, useRef  } from "react";


interface DraggableWindowProps {
    onClose: () => void;
    title: string;
    context: string;
    charts: { id: string; code: string }[]; // Change to dynamic chart array
  }
  
  const DraggableWindow: React.FC<DraggableWindowProps> = ({ onClose, title, context, charts }) => {
    const hasRenderedCharts = useRef(false); // Whether the marker has been rendered or not

    useEffect(() => {
      if(!hasRenderedCharts.current) {
        charts.forEach(chart => {
          compileJSCode(chart.code, chart.id);
      });
    // compileJSCode(d3Script, "ghibli-viz");  
    }

      hasRenderedCharts.current = true;
    }, []);
  
    return (
        <Draggable handle=".window-header" defaultPosition={{x: 0, y: 0}}>
            <div className="window">
                <div className="window-header">
                    <span>{title}</span>
                    <button onClick={onClose}>✖</button>
                </div>
                <div className="window-content" style={{ color: "black" }} dangerouslySetInnerHTML={{ __html: context }}></div>
                {/* <div id="ghibli-viz" ></div> */}
            </div>
        </Draggable>
    );
};

export default DraggableWindow;

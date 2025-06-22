import Draggable from "react-draggable";
import { compileJSCode } from "../langgraph/visualizationGenerate";
import { useEffect } from "react";

interface DraggableWindowProps {
  onClose: () => void;
  title: string;
  context: string;
  charts: { id: string; code: string }[];
  position?: { x: number; y: number };
  onDragStop?: (pos: { x: number; y: number }) => void;
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
  onClose,
  title,
  context,
  charts,
  position,
  onDragStop,
}) => {
  useEffect(() => {
    if (charts.length > 0) {
      charts.forEach(chart => {
        compileJSCode(chart.code, chart.id);
      });
    }
  }, [charts]); // 每次 charts 更新时渲染

  return (
    <Draggable
      handle=".window-header"
      position={position}
      onStop={(_, data) => {
        if (onDragStop) onDragStop({ x: data.x, y: data.y });
      }}
    >
      <div className="window">
        <div className="window-header">
          <span>{title}</span>
          <button onClick={onClose}>✖</button>
        </div>
        <div
          className="window-content"
          style={{ color: "black" }}
          dangerouslySetInnerHTML={{ __html: context }}
        ></div>
      </div>
    </Draggable>
  );
};

export default DraggableWindow;

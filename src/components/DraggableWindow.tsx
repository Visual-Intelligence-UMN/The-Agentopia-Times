import Draggable from "react-draggable";
import { compileJSCode } from "../langgraph/visualizationGenerate";
import { TEST_D3_SCRIPT } from "../langgraph/const";
import { useEffect } from "react";

interface DraggableWindowProps {
    onClose: () => void;
    title: string;
    context: string;
    jsCodes1: string;
    jsCodes2: string;
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({ onClose, title, context, jsCodes1 , jsCodes2 }) => {
    
    useEffect(() => {
        if (jsCodes1 && jsCodes2) {
            compileJSCode(jsCodes1, "#testdiv1");
            compileJSCode(jsCodes2, "#testdiv2");
        }
    }, [jsCodes1, jsCodes2]);
    
    return (
        <Draggable handle=".window-header" defaultPosition={{x: 0, y: 0}}>
            <div className="window">
                <div className="window-header">
                    <span>{title}</span>
                    <button onClick={onClose}>✖</button>
                </div>
                <div className="window-content" style={{ color: "black" }} dangerouslySetInnerHTML={{ __html: context }}></div>
            </div>
        </Draggable>
    );
};

export default DraggableWindow;

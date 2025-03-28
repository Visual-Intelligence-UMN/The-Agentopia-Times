import Draggable from "react-draggable";
import { compileJSCode } from "../langgraph/visualizationGenerate";
import { TEST_D3_SCRIPT } from "../langgraph/const";
import { useEffect } from "react";

interface DraggableWindowProps {
    onClose: () => void;
    title: string;
    context: string;
    jsCodes: string;
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({ onClose, title, context, jsCodes }) => {
    
    useEffect(() => {
        compileJSCode(jsCodes);
    }, []);
    
    return (
        <Draggable handle=".window-header">
            <div className="window">
                <div className="window-header">
                    <span>{title}</span>
                    <button onClick={onClose}>✖</button>
                </div>
                <div className="window-content"  style={{ color: "black" }} dangerouslySetInnerHTML={{ __html: context }}></div>
                <div
                    id="test-d3"
                    style={{
                        width: '100%',
                        height: '300px',
                        overflow: 'auto', // Enable scrollbars when content overflows
                        border: '1px solid #ccc', // Optional: add a border for clarity
                    }}
                />
                {/* <button onClick={() => testD3Compiling(TEST_D3_SCRIPT)}>Start Compiling</button> */}
            </div>
        </Draggable>
    );
};

export default DraggableWindow;

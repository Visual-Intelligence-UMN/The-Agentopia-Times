import Draggable from "react-draggable";

interface DraggableWindowProps {
    onClose: () => void;
    title: string;
    context: string;
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({ onClose, title, context }) => {
    return (
        <Draggable handle=".window-header">
            <div className="window">
                <div className="window-header">
                    <span>{title}</span>
                    <button onClick={onClose}>✖</button>
                </div>
                <div className="window-content"  style={{ color: "black" }}>
                    <p>{context}</p>
                </div>
            </div>
        </Draggable>
    );
};

export default DraggableWindow;

import Draggable from "react-draggable";

interface DraggableWindowProps {
    onClose: () => void;
    title: string;
    context: React.ReactNode; // 修改为 React.ReactNode 类型
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({ onClose, title, context }) => {
    return (
        <Draggable handle=".window-header">
            <div className="window">
                <div className="window-header">
                    <span>{title}</span>
                    <button onClick={onClose}>✖</button>
                </div>
                <div className="window-content" style={{ color: "black" }}>
                    {context} {/* 这里会渲染传递进来的内容 */}
                </div>
            </div>
        </Draggable>
    );
};

export default DraggableWindow;

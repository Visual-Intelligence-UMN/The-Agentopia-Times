import { useEffect, useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { EventBus } from './game/EventBus';
import DraggableWindow from './components/DraggableWindow';
import { testGraphChain } from './langgraph/testLanggraph';

export interface Report {
    content: (string | React.ReactNode)[], // 数组包含文本或SVG
    department: string,
}

function App()
{

    const [report, setReport] = useState<Report[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [currentReport, setCurrentReport] = useState<React.ReactNode>(""); // 修改为 React.ReactNode 类型

    useEffect(()=>{
        const handleReportReceiving = (data: { report: string, department: string }) => {
            console.log("report", data);
            
            const curReport: Report = {
                department: data.department,
                content: [data.report] // 将报告内容作为数组存放
            };
            
            const index = report.findIndex((r) => r.department === data.department);
            if (index !== -1) {
                report[index] = curReport;
                setReport([...report]);
            } else {
                report.push(curReport);
                setReport([...report]);
            }
        
            console.log("reports", report);
            
            // setIsOpen(true);
        };
        
        // have a handler for setting currentReport and open the reporting window
        const handleReportOpen = (data: { department: string }) => {
            const index = report.findIndex((r) => r.department === data.department);
            if (index !== -1) {
                const reportContent = report[index].content;
                
                // Combine the content: Text + SVG
                const combinedContent = reportContent.map((item, idx) => {
                    if (typeof item === 'string') {
                      return <p key={idx}>{item}</p>; // 如果是文本，包装成 <p> 标签
                    }
                    return <div key={idx}>{item}</div>; // 如果是 SVG 或者其他 React 元素，直接返回
                  });
                  
                
                setCurrentReport(combinedContent);
                if (!isOpen) setIsOpen(true);
            }
        };
        

        EventBus.on("final-report", handleReportReceiving);
        EventBus.on("open-report", handleReportOpen);

        return () => {
            EventBus.off("final-report", handleReportReceiving);
            EventBus.off("open-report", handleReportOpen);
        };
    },[]);

    return (
        <div id="app">
            {/* <button onClick={callGraph}>Test LangGraph</button> */}
            <PhaserGame />
            {isOpen && <DraggableWindow title="Final Report" context={currentReport} onClose={() => {setIsOpen(false)}} />}
        </div>
    )
}

export default App

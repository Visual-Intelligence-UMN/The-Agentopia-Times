import { useEffect, useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { EventBus } from './game/EventBus';
import DraggableWindow from './components/DraggableWindow';
import { testGraphChain } from './langgraph/testLanggraph';

export interface Report{
    report: string,
    department: string,
}

function App()
{

    const [report, setReport] = useState<Report[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [currentReport, setCurrentReport] = useState("");

    useEffect(()=>{
        const handleReportReceiving = (data: { report: string, department: string }) => {
            console.log("report", data);
            const curReport:Report = {
                report: data.report,
                department: data.department,
            }
            // check if the report'department is already in the list, if yes, update the report; if no, add the report
            const index = report.findIndex((r) => r.department === data.department);
            if(index !== -1){
                report[index] = curReport;
                setReport([...report]);
            }else{
                report.push(curReport);
                setReport([...report]);
            }

            console.log("reports", report);
            
            // setIsOpen(true);
        };

        // have a handler for setting currentReport and open the reporting window
        const handleReportOpen = (data: { department: string}) => {
            const index = report.findIndex((r) => r.department === data.department);
            if(index !== -1){
                setCurrentReport(report[index].report);
                if(!isOpen)setIsOpen(true);
            }
        }

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

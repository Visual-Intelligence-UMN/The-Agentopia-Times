import { useEffect, useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { EventBus } from './game/EventBus';
import DraggableWindow from './components/DraggableWindow';
import { testGraphChain } from './langgraph/testLanggraph';
import {marked} from 'marked';
import { generateChartImage, testD3Compiling } from './langgraph/visualizationGenerate';
import { TEST_D3_SCRIPT } from './langgraph/const';

export interface Report{
    report: string,
    department: string,
}

function App()
{

    const [report, setReport] = useState<Report[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [currentReport, setCurrentReport] = useState("");
    const [htmlReport, setHtmlReport] = useState<any>("");
    const [d3Code, setD3Code] = useState("");

    useEffect(() => {
        // const initializeD3Code = async () => {
        //     const generatedCode = await generateChartImage();
        //     setD3Code(typeof generatedCode === 'string' ? generatedCode : JSON.stringify(generatedCode));
        // };

        // initializeD3Code();
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

                const compiledHTML = marked(report[index].report);
                setHtmlReport(compiledHTML);

                if(!isOpen)setIsOpen(true);

                // testD3Compiling(TEST_D3_SCRIPT);
            }
            // embedding the markdown into the draggable window
        }

        const handleD3CodeChange = (data: {d3Code: string}) => {
            setD3Code(typeof data.d3Code === 'string' ? data.d3Code : JSON.stringify(data.d3Code));
        }

        EventBus.on("final-report", handleReportReceiving);
        EventBus.on("open-report", handleReportOpen);
        EventBus.on("d3-code", handleD3CodeChange);

       // setD3Code(await generateChartImage());

        return () => {
            EventBus.off("final-report", handleReportReceiving);
            EventBus.off("open-report", handleReportOpen);
            EventBus.off("d3-code", handleD3CodeChange);
        };
    },[]);

    return (
        <div id="app">
            {/* <button onClick={callGraph}>Test LangGraph</button> */}
            <PhaserGame />
            {isOpen && 
                <DraggableWindow 
                    title="Final Report" 
                    context={htmlReport} 
                    onClose={() => {setIsOpen(false)}} 
                    jsCodes={d3Code}
                />
            }
        </div>
    )
}

export default App
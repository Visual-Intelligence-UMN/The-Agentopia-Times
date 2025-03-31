import { useEffect, useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { EventBus } from './game/EventBus';
import DraggableWindow from './components/DraggableWindow';
import { testGraphChain } from './langgraph/testLanggraph';
import {marked} from 'marked';
import { generateChartImage } from './langgraph/visualizationGenerate';
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
    // const [d3Code1, setD3Code1] = useState("");
    // const [d3Code2, setD3Code2] = useState("");

    const [charts, setCharts] = useState({
        chart1: { code: "", id: "testdiv1" },
        chart2: { code: "", id: "testdiv2" }
      });

    useEffect(() => {
        // const initializeD3Code = async () => {
        //     const data = [10, 20, 30, 40, 50];
        //     const promptForLLM1 = "Generate a simple D3.js bar chart for the following data: " + JSON.stringify(data) + ". Include x-axis and y-axis labels, a chart title, and add hover effects to the bars. The hover effect should change the color of the bars when the user hovers over them. Also, display the value of the bar as a tooltip when hovering. Only return the JavaScript code to generate the chart, no HTML, no CSS. Make sure the code includes interactivity with mouse events like mouseover and mouseout.";
        //     const promptForLLM2 = "Generate a complex D3.js line chart for the following data: " + JSON.stringify(data) + ". Include x-axis and y-axis labels, a chart title, and add hover effects to the bars. The hover effect should change the color of the bars when the user hovers over them. Also, display the value of the bar as a tooltip when hovering. Only return the JavaScript code to generate the chart, no HTML, no CSS. Make sure the code includes interactivity with mouse events like mouseover and mouseout.";
        //     const generatedCode1 = await generateChartImage(promptForLLM1, "testdiv1");
        //     const generatedCode2 = await generateChartImage(promptForLLM2, "testdiv2");
        //     setD3Code1(typeof generatedCode1 === 'string' ? generatedCode1 : JSON.stringify(generatedCode1));
        //     setD3Code2(typeof generatedCode2 === 'string' ? generatedCode2 : JSON.stringify(generatedCode2));
        // };

        // const initializeD3Code = async () => {
        //     const data = [10, 20, 30, 40, 50];
        //     const promptForLLM1 = "Generate a simple D3.js bar chart for the following data: " + JSON.stringify(data) + ". Include x-axis and y-axis labels, a chart title, and add hover effects to the bars. The hover effect should change the color of the bars when the user hovers over them. Also, display the value of the bar as a tooltip when hovering. Only return the JavaScript code to generate the chart, no HTML, no CSS. Make sure the code includes interactivity with mouse events like mouseover and mouseout.";
        //     const promptForLLM2 = "Generate a complex D3.js line chart for the following data: " + JSON.stringify(data) + ". Include x-axis and y-axis labels, a chart title, and add hover effects to the bars. The hover effect should change the color of the bars when the user hovers over them. Also, display the value of the bar as a tooltip when hovering. Only return the JavaScript code to generate the chart, no HTML, no CSS. Make sure the code includes interactivity with mouse events like mouseover and mouseout.";
  
        //     setCharts({
        //       chart1: {
        //         id: "testdiv1",
        //         code: await generateChartImage(promptForLLM1, "testdiv1")
        //       },
        //       chart2: {
        //         id: "testdiv2", 
        //         code: await generateChartImage(promptForLLM2, "testdiv2")
        //       }
        //     });
        //   };

        const initializeD3Code = async () => {
          const data = [10, 20, 30, 40, 50];
          const promptForLLM1 = "Generate a simple D3.js bar chart for the following data: " + JSON.stringify(data) + ". Include x-axis and y-axis labels, a chart title, and add hover effects to the bars. The hover effect should change the color of the bars when the user hovers over them. Also, display the value of the bar as a tooltip when hovering. Only return the JavaScript code to generate the chart, no HTML, no CSS. Make sure the code includes interactivity with mouse events like mouseover and mouseout.";
          const promptForLLM2 = "Generate a complex D3.js line chart for the following data: " + JSON.stringify(data) + ". Include x-axis and y-axis labels, a chart title, and add hover effects to the bars. The hover effect should change the color of the bars when the user hovers over them. Also, display the value of the bar as a tooltip when hovering. Only return the JavaScript code to generate the chart, no HTML, no CSS. Make sure the code includes interactivity with mouse events like mouseover and mouseout.";
  
          
          const [result1, result2] = await Promise.all([
            generateChartImage(promptForLLM1, "testdiv1"),
            generateChartImage(promptForLLM2, "testdiv2")
          ]);
        
          setCharts({
            chart1: {
              id: "testdiv1",
              code: typeof result1 === 'string' ? result1 : JSON.stringify(result1)
            },
            chart2: {
              id: "testdiv2", 
              code: typeof result2 === 'string' ? result2 : JSON.stringify(result2)
            }
          });
        };

        initializeD3Code();
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

        // const handleD3CodeChange1 = (data: {d3Code1: string}) => {
        //     setD3Code1(data.d3Code1);
        // }

        // const handleD3CodeChange2 = (data: {d3Code2: string}) => {
        //     setD3Code2(data.d3Code2);
        // }

        const handleChartUpdate = (data: { 
          type: 'chart1' | 'chart2'; 
          code: string | object
        }) => {
          setCharts(prev => ({
            ...prev,
            [data.type]: { 
              ...prev[data.type], 
              code: typeof data.code === 'string' ? data.code : JSON.stringify(data.code)
            }
          }));
        };

        EventBus.on("final-report", handleReportReceiving);
        EventBus.on("open-report", handleReportOpen);
        // EventBus.on("d3-code", handleD3CodeChange1);
        // EventBus.on("d3-code", handleD3CodeChange2);
        EventBus.on("d3-code", handleChartUpdate);


       // setD3Code(await generateChartImage());

        return () => {
            EventBus.off("final-report", handleReportReceiving);
            EventBus.off("open-report", handleReportOpen);
            // EventBus.off("d3-code", handleD3CodeChange1);
            // EventBus.off("d3-code", handleD3CodeChange2);
            EventBus.on("d3-code", handleChartUpdate);
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
                    jsCodes1={charts.chart1.code}
                    jsCodes2={charts.chart2.code}
                />
            }
        </div>
    )
}

export default App
import { useEffect, useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { EventBus } from './game/EventBus';
import DraggableWindow from './components/DraggableWindow';
import { testGraphChain } from './langgraph/testLanggraph';
import {marked} from 'marked';
import { generateChartImage } from './langgraph/visualizationGenerate';
import { TEST_D3_SCRIPT } from './langgraph/const';
import ConstitutionPanel from './components/ConstitutionPanel';

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
    const [isConstitutionOpen, setIsConstitutionOpen] = useState(false);


    const [charts, setCharts] = useState<{id: string; code: string}[]>([]);


    useEffect(() => {
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

                marked.use({
                    extensions: [
                      {
                        name: 'highlight',
                        level: 'inline',
                        start(src) {
                          return src.indexOf("=="); 
                        },
                        tokenizer(src, tokens) {
                          const rule = /^==([^=]+)==/;
                          const match = rule.exec(src);
                          if (match) {
                            return {
                              type: 'highlight',
                              raw: match[0],
                              text: match[1],
                              tokens: this.lexer.inlineTokens(match[1]),
                            };
                          }
                        },
                        renderer(token: any) {
                          return `<mark>${marked.parser(token.tokens)}</mark>`;
                        },
                      },
                    ],
                  });
                  

                // report[index].report += "<mark>TEST 111</mark>";
            

                const compiledHTML = marked(report[index].report);
                setHtmlReport(compiledHTML);

                if(!isOpen)setIsOpen(true);

                // testD3Compiling(TEST_D3_SCRIPT);
            }
            // embedding the markdown into the draggable window
        }

        // EventBus.on("d3-code", (data: {d3Code: string, id: string}) => {
        //   setCharts(prev => [
        //     ...prev,
        //     {
        //       id: data.id,
        //       code: data.d3Code
        //     }
        //   ]);
        // });

        const handleD3Code = (data: {d3Code: string, id: string}) => {
            console.log("Updating charts with:", data.id);
            setCharts(prev => {
              // Check if a chart with the same id already exists
              const exists = prev.some(chart => chart.id === data.id);
              return exists ? prev : [...prev, {id: data.id, code: data.d3Code}];
            });
          };

          const handleConstitutionOpen = () => {
            setIsConstitutionOpen(true);
          };

        EventBus.on("final-report", handleReportReceiving);
        EventBus.on("open-report", handleReportOpen);
        EventBus.on("d3-code", handleD3Code);
        EventBus.on("open-constitution", handleConstitutionOpen);

        // EventBus.on("d3-code", handleD3CodeChange1);
        // EventBus.on("d3-code", handleD3CodeChange2);
        // EventBus.on("d3-code", handleChartUpdate);


       // setD3Code(await generateChartImage());

        return () => {
          EventBus.off("final-report", handleReportReceiving);
          EventBus.off("open-report", handleReportOpen);
          EventBus.off("d3-code", handleD3Code);

          // EventBus.off("d3-code", handleD3CodeChange1);
          // EventBus.off("d3-code", handleD3CodeChange2);
          // EventBus.on("d3-code", handleChartUpdate);
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
                    charts={charts}
                />
            }
            {
                isConstitutionOpen && 
                <ConstitutionPanel 
                    onClose={() => {setIsConstitutionOpen(false)}} 
                />
            }
        </div>
    )
}

export default App
import { useEffect, useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { EventBus } from './game/EventBus';
import DraggableWindow from './components/DraggableWindow';
import {marked} from 'marked';
import type { ReportContent, ReportChart, ReportFormat } from './utils/finalReport';

export interface Report extends ReportContent {
    department: string,
    title?: string;
}

export interface AgentInformation{
    mssg: string,
    agent: string,
    verificationId?: string;
}



function App()
{
    const [report, setReport] = useState<Report[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [currentReport, setCurrentReport] = useState("");
    const [htmlReport, setHtmlReport] = useState<any>("");
    const [isConstitutionOpen, setIsConstitutionOpen] = useState(false);
    const [agentProfiles, setAgentProfiles] = useState<AgentInformation[]>([]);
    const [windowTitle, setWindowTitle] = useState<string>("Report");
    const [windowVerificationId, setWindowVerificationId] = useState<string | undefined>();


    const [charts, setCharts] = useState<ReportChart[]>([]);
    const [reportFormat, setReportFormat] = useState<ReportFormat>('markdown');


    useEffect(() => {
      const handleReportReceiving = (data: Report) => {
        console.log("report received", data.department, data);
        const curReport: Report = {
            ...data,
            report: data.report,
            department: data.department,
            title: data.title || "Report"
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
      };


        const handleAgentInformation = (data: {agent: string, mssg: string, verificationId?: string}) =>{
          console.log("Agent information received", data.agent, data.mssg);
          const curReport:AgentInformation = {
                mssg: data.mssg,
                agent: data.agent,
                verificationId: data.verificationId,
            }
            // check if the report'department is already in the list, if yes, update the report; if no, add the report
            const index = agentProfiles.findIndex((r) => r.agent === data.agent);
            if(index !== -1){
                agentProfiles[index] = curReport;
                setAgentProfiles([...agentProfiles]);
            }else{
                agentProfiles.push(curReport);
                setAgentProfiles([...agentProfiles]);
            }

            console.log("agentProfiles", agentProfiles);
        }

        // have a handler for setting currentReport and open the reporting window
        const handleReportOpen = (data: { department: string; title?: string }) => {
    const index = report.findIndex((r) => r.department === data.department);
    if (index !== -1) {
        setCurrentReport(report[index].report);
        setWindowVerificationId(report[index].verificationId);

        setWindowTitle(report[index].title || data.title || "Report");

        marked.use({
            extensions: [
                {
                    name: 'highlight',
                    level: 'inline',
                    start(src) {
                        return src.indexOf("==");
                    },
                    tokenizer(src) {
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

        setHtmlReport(report[index].report);
        setReportFormat(report[index].format ?? 'markdown');
        setCharts(report[index].charts ?? []);

        if (!isOpen) setIsOpen(true);
    }
};



        const handleAgentInformationOpen = (data: { agent: string}) => {
  const index = agentProfiles.findIndex((r) => r.agent === data.agent);
  if(index !== -1){
      setCurrentReport(agentProfiles[index].mssg);
      setWindowVerificationId(agentProfiles[index].verificationId);

      marked.use({
        extensions: [
          {
            name: 'highlight',
            level: 'inline',
            start(src) { return src.indexOf("=="); },
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

      console.log("agentProfiles[index].mssg", agentProfiles[index].mssg);

      setHtmlReport(agentProfiles[index].mssg);
      setReportFormat('markdown');
      setCharts([]);
      if(!isOpen)setIsOpen(true);
  }
}


          const handleConstitutionOpen = () => {
            setIsConstitutionOpen(true);
          };

        EventBus.on("final-report", handleReportReceiving);
        EventBus.on("open-report", handleReportOpen);

        EventBus.on("agent-information", handleAgentInformation);
        EventBus.on("open-agent-information", handleAgentInformationOpen);

        EventBus.on("open-constitution", handleConstitutionOpen);

        // EventBus.on("d3-code", handleD3CodeChange1);
        // EventBus.on("d3-code", handleD3CodeChange2);
        // EventBus.on("d3-code", handleChartUpdate);


       // setD3Code(await generateChartImage());

        return () => {
          EventBus.off("final-report", handleReportReceiving);
          EventBus.off("open-report", handleReportOpen);
          EventBus.off("agent-information", handleAgentInformation);
          EventBus.off("open-agent-information", handleAgentInformationOpen);
          EventBus.off("open-constitution", handleConstitutionOpen);

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
                    title={windowTitle} 
                    context={htmlReport} 
                    onClose={() => {setIsOpen(false)}} 
                    format={reportFormat}
                    charts={charts}
                    verificationId={windowVerificationId}
                />
            }
        </div>
    )
}

export default App

import { marked } from 'marked';
import { useEffect, useState } from 'react';

import DraggableWindow from './components/DraggableWindow';
import { EventBus } from './game/EventBus';
import { PhaserGame } from './game/PhaserGame';

export interface Report {
    report: string;
    department: string;
    title?: string;
}

export interface AgentInformation {
    mssg: string;
    agent: string;
}

function App() {
    const [report, setReport] = useState<Report[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [currentReport, setCurrentReport] = useState('');
    const [htmlReport, setHtmlReport] = useState<any>('');
    const [isConstitutionOpen, setIsConstitutionOpen] = useState(false);
    const [agentProfiles, setAgentProfiles] = useState<AgentInformation[]>([]);
    const [windowTitle, setWindowTitle] = useState<string>('Report');

    const [charts, setCharts] = useState<{ id: string; code: string }[]>([]);

    useEffect(() => {
        const handleReportReceiving = (data: {
            report: string;
            department: string;
            title?: string;
        }) => {
            console.log('report received', data.department, data);
            const curReport: Report = {
                report: data.report,
                department: data.department,
                title: data.title || 'Report',
            };

            const index = report.findIndex(
                (r) => r.department === data.department,
            );
            if (index !== -1) {
                report[index] = curReport;
                setReport([...report]);
            } else {
                report.push(curReport);
                setReport([...report]);
            }

            console.log('reports', report);
        };

        const handleAgentInformation = (data: {
            agent: string;
            mssg: string;
        }) => {
            console.log('Agent information received', data.agent, data.mssg);
            const curReport: AgentInformation = {
                mssg: data.mssg,
                agent: data.agent,
            };
            // check if the report'department is already in the list, if yes, update the report; if no, add the report
            const index = agentProfiles.findIndex(
                (r) => r.agent === data.agent,
            );
            if (index !== -1) {
                agentProfiles[index] = curReport;
                setAgentProfiles([...agentProfiles]);
            } else {
                agentProfiles.push(curReport);
                setAgentProfiles([...agentProfiles]);
            }

            console.log('agentProfiles', agentProfiles);
        };

        // have a handler for setting currentReport and open the reporting window
        const handleReportOpen = (data: {
            department: string;
            title?: string;
        }) => {
            const index = report.findIndex(
                (r) => r.department === data.department,
            );
            if (index !== -1) {
                setCurrentReport(report[index].report);

                setWindowTitle(report[index].title || data.title || 'Report');

                marked.use({
                    extensions: [
                        {
                            name: 'highlight',
                            level: 'inline',
                            start(src) {
                                return src.indexOf('==');
                            },
                            tokenizer(src) {
                                const rule = /^==([^=]+)==/;
                                const match = rule.exec(src);
                                if (match) {
                                    return {
                                        type: 'highlight',
                                        raw: match[0],
                                        text: match[1],
                                        tokens: this.lexer.inlineTokens(
                                            match[1],
                                        ),
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

                if (!isOpen) setIsOpen(true);
            }
        };

        const handleAgentInformationOpen = (data: { agent: string }) => {
            const index = agentProfiles.findIndex(
                (r) => r.agent === data.agent,
            );
            if (index !== -1) {
                setCurrentReport(agentProfiles[index].mssg);

                marked.use({
                    extensions: [
                        {
                            name: 'highlight',
                            level: 'inline',
                            start(src) {
                                return src.indexOf('==');
                            },
                            tokenizer(src, tokens) {
                                const rule = /^==([^=]+)==/;
                                const match = rule.exec(src);
                                if (match) {
                                    return {
                                        type: 'highlight',
                                        raw: match[0],
                                        text: match[1],
                                        tokens: this.lexer.inlineTokens(
                                            match[1],
                                        ),
                                    };
                                }
                            },
                            renderer(token: any) {
                                return `<mark>${marked.parser(token.tokens)}</mark>`;
                            },
                        },
                    ],
                });

                console.log(
                    'agentProfiles[index].mssg',
                    agentProfiles[index].mssg,
                );

                setHtmlReport(agentProfiles[index].mssg);
                if (!isOpen) setIsOpen(true);
            }
        };

        // EventBus.on("d3-code", (data: {d3Code: string, id: string}) => {
        //   setCharts(prev => [
        //     ...prev,
        //     {
        //       id: data.id,
        //       code: data.d3Code
        //     }
        //   ]);
        // });

        const handleD3Code = (data: { d3Code: string; id: string }) => {
            console.log('Updating charts with:', data.id);
            setCharts((prev) => {
                // Check if a chart with the same id already exists
                const exists = prev.some((chart) => chart.id === data.id);
                return exists
                    ? prev
                    : [...prev, { id: data.id, code: data.d3Code }];
            });
        };

        const handleConstitutionOpen = () => {
            setIsConstitutionOpen(true);
        };

        EventBus.on('final-report', handleReportReceiving);
        EventBus.on('open-report', handleReportOpen);

        EventBus.on('agent-information', handleAgentInformation);
        EventBus.on('open-agent-information', handleAgentInformationOpen);

        EventBus.on('d3-code', handleD3Code);
        EventBus.on('open-constitution', handleConstitutionOpen);

        // EventBus.on("d3-code", handleD3CodeChange1);
        // EventBus.on("d3-code", handleD3CodeChange2);
        // EventBus.on("d3-code", handleChartUpdate);

        // setD3Code(await generateChartImage());

        return () => {
            EventBus.off('final-report', handleReportReceiving);
            EventBus.off('open-report', handleReportOpen);
            EventBus.off('d3-code', handleD3Code);

            // EventBus.off("d3-code", handleD3CodeChange1);
            // EventBus.off("d3-code", handleD3CodeChange2);
            // EventBus.on("d3-code", handleChartUpdate);
        };
    }, []);

    return (
        <div id="app">
            {/* <button onClick={callGraph}>Test LangGraph</button> */}
            <PhaserGame />
            {isOpen && (
                <DraggableWindow
                    title={windowTitle}
                    context={htmlReport}
                    onClose={() => {
                        setIsOpen(false);
                    }}
                    charts={charts}
                />
            )}
        </div>
    );
}

export default App;

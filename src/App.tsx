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

const loadingHTML = `
  <div style="text-align: center; margin-top: 20px;">
    <div class="spinner"></div>
    <p><i>Loading report, please wait...</i></p>
  </div>

  <style>
    .spinner {
      width: 40px;
      height: 40px;
      margin: 10px auto;
      border: 4px solid #ccc;
      border-top-color: #333;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  </style>
`;


const initialSkeleton = `
  <div class="newspaper">
    <h1 class="newspaper-title">The Agentopia Times</h1>
    <p class="authors">Written by Professional LLM Journalists</p>
    <hr />
    <div id="report-content">
      ${loadingHTML}
    </div>
  </div>
`;


const style = `
  <style>
    .newspaper {
      font-family: "Georgia", serif;
      background-color: #f9f6ef;
      color: #000;
      padding: 40px;
      max-width: 960px;
      margin: 20px auto;
      border-radius: 12px;
      box-shadow: 0 0 12px rgba(0,0,0,0.1);
    }

    .newspaper-title {
      font-size: 36px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 0;
      text-transform: uppercase;
    }

    .authors {
      font-size: 14px;
      text-align: center;
      margin-top: 5px;
      margin-bottom: 20px;
      font-style: italic;
    }
  </style>
`;

function App()
{
    const [report, setReport] = useState<Report[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [currentReport, setCurrentReport] = useState("");
    const [htmlReport, setHtmlReport] = useState<any>("");
    const [isConstitutionOpen, setIsConstitutionOpen] = useState(false);
    const [charts, setCharts] = useState<{id: string; code: string}[]>([]);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [finalReportPosition, setFinalReportPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });


    useEffect(() => {
      const handleReportReceiving = (data: { report: string, department: string }) => {
        console.log("report received", data.department, data);
        const curReport: Report = {
          report: data.report,
          department: data.department,
        };

        setReport(prevReports => {
          const index = prevReports.findIndex((r) => r.department === data.department);
          if (index !== -1) {
            const newReports = [...prevReports];
            newReports[index] = curReport;
            return newReports;
          } else {
            return [...prevReports, curReport];
          }
        });

        if (isOpen && data.department === currentReport) {
          if (data.department === "routing" && isLoadingReport) {
            setHtmlReport(data.report);
            setIsLoadingReport(false);
            setTimeout(() => {
              setIsOpen(false); // 先关闭
              setTimeout(() => {
                setIsOpen(true); // 再打开
              }, 10); // 微小延迟再打开（必须有，不然关闭还没生效）
            }, 50); // 等 htmlReport 设置完之后再执行
          } else {
            setHtmlReport(data.report);
          }
        }

      };

      const handleReportOpen = (data: { department: string }) => {
        console.log("Opening report for department:", data.department);
        
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

        setCurrentReport(data.department);
        const existingReport = report.find((r) => r.department === data.department);
        
        if (existingReport) {
          // 已有报告，直接显示
          setHtmlReport(existingReport.report);
          setIsLoadingReport(false);
        } else {
          // 没有报告，根据部门类型显示不同内容
          if (data.department === "routing") {
            // final-report 显示骨架并标记为加载中
            let loadingReport = `${style}${initialSkeleton}`;

            setHtmlReport(loadingReport);
            setIsLoadingReport(true);
            console.log("Showing skeleton for final-report");
          } else {
            // 其他部门显示加载界面
            setHtmlReport(loadingHTML);
            setIsLoadingReport(false);
          }
        }

        // 打开窗口
        if (!isOpen) setIsOpen(true);
      };

      const handleD3Code = (data: {d3Code: string, id: string}) => {
        console.log("Updating charts with:", data.id);
        setCharts(prev => {
          const exists = prev.some(chart => chart.id === data.id);
          return exists ? prev : [...prev, {id: data.id, code: data.d3Code}];
        });
      };

      const handleConstitutionOpen = () => {
        setIsConstitutionOpen(true);
      };

      // 注册事件监听器
      EventBus.on("final-report", handleReportReceiving);
      EventBus.on("open-report", handleReportOpen);
      EventBus.on("d3-code", handleD3Code);
      EventBus.on("open-constitution", handleConstitutionOpen);

      // 清理函数
      return () => {
        EventBus.off("final-report", handleReportReceiving);
        EventBus.off("open-report", handleReportOpen);
        EventBus.off("d3-code", handleD3Code);
        EventBus.off("open-constitution", handleConstitutionOpen);
      };
    }, [isOpen, currentReport, isLoadingReport, report]); // 添加依赖项

    return (
        <div id="app">
            <PhaserGame />
            {isOpen && (
              <DraggableWindow
                title="Final Report"
                context={htmlReport}
                onClose={() => setIsOpen(false)}
                charts={charts}
                position={currentReport === "routing" ? finalReportPosition : undefined}  // 只给 final-report 设置位置
                onDragStop={(pos) => {
                  if (currentReport === "routing") setFinalReportPosition(pos);           // 只记录 final-report 拖动位置
                }}
              />
            )}
        </div>
    )
}

export default App
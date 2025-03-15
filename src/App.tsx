import { useEffect, useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { EventBus } from './game/EventBus';
import DraggableWindow from './components/DraggableWindow';
import { testGraphChain } from './langgraph/testLanggraph';

function App()
{

    const [report, setReport] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    useEffect(()=>{
        const handleReportReceiving = (data: { report: string }) => {
            console.log("report", data);
            setReport(data.report);
            setIsOpen(true);
        };

        EventBus.on("final-report", handleReportReceiving);

        return () => {
            EventBus.off("final-report", handleReportReceiving);
        };
    },[]);

    // const callGraph = async () => {
    //     const state = await testGraphChain.invoke({ topic: "cats" });
    //         console.log("Initial joke:");
    //         console.log(state.joke);
    //         console.log("\n--- --- ---\n");
    //         if (state.improvedJoke !== undefined) {
    //           console.log("Improved joke:");
    //           console.log(state.improvedJoke);
    //           console.log("\n--- --- ---\n");
            
    //           console.log("Final joke:");
    //           console.log(state.finalJoke);
    //         } else {
    //           console.log("Joke failed quality gate - no punchline detected!");
    //         }
    // }

    return (
        <div id="app">
            {/* <button onClick={callGraph}>Test LangGraph</button> */}
            <PhaserGame />
            {isOpen && <DraggableWindow title="Final Report" context={report} onClose={() => {setIsOpen(false)}} />}
        </div>
    )
}

export default App

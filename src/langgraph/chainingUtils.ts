// this file responsible for transform game agents into langgraoh

import { Agent } from "openai/_shims/index.mjs";
import { Zone } from "../game/scenes";
import { END, START, StateGraph } from "@langchain/langgraph/web";
import { createJournalist, createWriter, GeneralStateAnnotation } from "./agents";
import { ChatOpenAI } from "@langchain/openai";

// TODO:
// DONE: 1. using a global variable to store whether the workflow is start or not
// DONE: 2. using that variable to determine when should we show up the Start Workflow btn
// DONE: 3. using parallelZone to construct a more flexible data map represents the relationship between agents and locations
// DONE: 4. write a tranformation function here to convert the data map into a langgraph Graph

interface subgraph{
    agents: Agent[],
    location: string,
    task: string
}


export function initializeLLM(){
    return new ChatOpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        modelName: "gpt-4o-mini",
    });
}

// right now, we use a pre-defined action sequence to define characters' roles
// const actions = [
//     journalist,
//     writer
// ]

export function transformDataMap(zones: Zone[], agents: Agent[]){
    console.log("input: ", zones);
    const transformedData:subgraph[] = [];
    for(let i = 0; i < zones.length; i++){
        let subgraph:subgraph = {
            agents: [],
            location: zones[i].name,
            task: zones[i].task
        };
        const zone = zones[i];
        const insideAgents = Array.from(zone.agentsInside);
        console.log(" tdm insideAgents: ", insideAgents);
        for(let j = 0; j < insideAgents.length; j++){
            const agent = insideAgents[j];
            console.log("tdm agents: ", agents, agent);
            // get Agent object from another array - agent instances retrive
            for(let k = 0; k < agents.length; k++){
                if(agents[k].getName() === agent){ // here!
                    subgraph.agents.push(agents[k]);
                }
            }
            // store them into subgraph
        }
        transformedData.push(subgraph);
    }
    console.log("transformDataMap output: ", transformedData);

    return transformedData;
}

export interface EdgeType{
    from: any,
    to: any,
}



// we only add nodes information right now
// further discussion is needed to determine the relationship between agents and locations
// mainly in the interaction level
// we can use a data structure to constrcut a graph for information representation
// another problem: how we assign execution role in a single department? 
export function constructLangGraph(
    transformDataMap:subgraph[],
    scene: any,
    tilemap: any,
    destination: any,
    zones: any
){
    const langgraph = new StateGraph(GeneralStateAnnotation);
    const agentNames: string[] = [];
    // add nodes into graph
    for(let i = 0; i < transformDataMap.length; i++){
        const subgraph = transformDataMap[i];
        for(let j = 0; j < subgraph.agents.length; j++){
            const agent = subgraph.agents[j];
            // langgraph.addNode(agent.getName(), agent.activate());
            if(i===0 && j===0){
                langgraph.addNode(
                    agent.getName(), 
                    createJournalist(
                        agent, 
                        transformDataMap[1].agents[0], 
                        scene, 
                        tilemap, 
                        zones, 
                        (transformDataMap[1].task as "extraction" | "summary" | "analysis" | "validation" | "voting")
                    )
                );
            }
            if(i===1 && j===0){
                console.log("create agent", agent)
                langgraph.addNode(
                    agent.getName(), 
                    createWriter(
                        agent, 
                        scene, 
                        tilemap, 
                        destination, 
                        zones, 
                        (transformDataMap[1].task as "extraction" | "summary" | "analysis" | "validation" | "voting")
                    )
                );
            }
            // else langgraph.addNode(agent.getName(), agent.activate());
            console.log("add a node", agent.getName(), agent.activate());
            agentNames.push(agent.getName());
        }
    }

    // temp (REMOVE LATER) - construct virtual edges for testing purpose
    const edges: EdgeType[] = [];
    for(let i = 0; i < agentNames.length-1; i++){
        if(i===0)edges.push({from: START, to: agentNames[i]});
        if(i===agentNames.length-1)edges.push({from: agentNames[i], to: END});
        else edges.push({from: agentNames[i], to: agentNames[i+1]});
    }

    // add edges into graph - chaining pattern
    for(let i = 0; i < edges.length; i++){
        console.log("add an edge", edges[i].from, edges[i].to);
        langgraph.addEdge(edges[i].from, edges[i].to);
    }

    console.log("langgraph: ", langgraph);
    console.log("agentNames: ", agentNames);

    return langgraph.compile();

}






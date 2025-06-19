import { Agent } from "openai/_shims/index.mjs";
import { Zone } from "../game/scenes";
import { END, START, StateGraph } from "@langchain/langgraph/web";
import { createJournalist, createWriter, GeneralStateAnnotation } from "./agents";
import { ChatOpenAI } from "@langchain/openai";

export function constructSingleAgent(

){
    // initialize an agent
}
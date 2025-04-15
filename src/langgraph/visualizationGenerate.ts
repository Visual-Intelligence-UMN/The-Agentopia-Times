import Phaser from 'phaser';
import { initializeLLM } from "./chainingUtils";
import * as d3 from 'd3';
import * as ts from 'typescript';
import vm from 'vm';
import { EventBus } from "../game/EventBus";
import { d3Script } from './const';

const baseballSample = `
player,year,is_hit
Derek Jeter,1995.0,1.0
Derek Jeter,1995.0,1.0
Derek Jeter,1995.0,1.0
Derek Jeter,1995.0,1.0
Derek Jeter,1995.0,1.0
Derek Jeter,1995.0,1.0
......
`

const kidneySample = `
treatment,stone_size,success
B,large,1
A,large,1
A,large,0
A,large,1
A,large,1
B,large,1
......
`

// Declare d3 as a property on globalThis.
declare global {
  interface Window {
    d3: any;
  }
}
export async function generateChartImage(dataSheet: any, agent: any, state: any) {

  const chartId = `chart-${Math.random().toString(36).substr(2, 9)}`;

  let dataSample = baseballSample;
  let dataPath = "./data/baseball.csv";

  
  if(state.votingToChaining.includes("Kidney")){
    dataSample = kidneySample;
    dataPath = "./data/kidney.csv";
  }


// export async function generateChartImage(promptForLLM: string, svgId: string, dataSheet: any) {

// export async function generateChartImage(promptForLLM: string, svgId: string) {
  // console.log("generateVisualization", dataSheet);

  const llm = initializeLLM();
  const maxRetries = 3;
  let attempt = 0;
  let lastError = "";

  while (attempt < maxRetries) {
    attempt++;

    // const promptForLLM = `
    //   Generate a simple D3.js bar chart for the following data: ${JSON.stringify(dataSheet)}.
    //   Include x-axis and y-axis labels, and a chart title.
    //   Only return the JavaScript code to generate the chart, no HTML, no CSS.
    //   ${lastError ? "The last attempt failed with the following error: " + lastError + ". Please correct it." : ""}
    // `;

    const promptForLLM = `
  Generate a data visualization with following description:
    Create a visualization that compares two groups across multiple subcategories and also shows the overall average. Emphasize how the trend in each subgroup differs from the trend in the aggregated data. Include appropriate labels and legends to make both the subgroup and overall patterns clear
  
    
  ${lastError ? `5. ERROR FIXING: Correct these issues from last attempt:
    - ${lastError}
    - Specifically ensure: ${getSpecificFix(lastError)}` : ''}

  ${agent.getBias()}
  `;

  function getSpecificFix(error: string) {
    const fixes: Record<string, string> = {
      'undefined variable': 'declare all variables with const/let',
      'missing scale': 'add d3.scaleBand() for categorical data',
      'invalid data': 'implement data validation before rendering'
    };
    return fixes[error] || 'review D3.js data binding pattern';
  }

    const result = await llm.invoke([
      { role: "system", content: `
          Generate only the JavaScript code for a simple D3.js chart, 
          Your code should start like this(PARAMETER: means you can change the number on that line): 
          const width = 400; // PARAMETER: you can change the width
          const height = 200; // PARAMETER: you can change the height
          console.log("${chartId}", d3.select('#${chartId}'));
          const svg = d3.select('#${chartId}').append('svg')
            .attr('width', width)
            .attr('height', height);
          
          d3.csv("${dataPath}", d3.autoType).then((data) => {
            //  visualization implementation here: 

          }

          Here is a part of the data, which helps you better implement the visualization:
          ${dataSample}
          
          based on the following description:
        ` 
      },
      {
        role: "user",
        content: promptForLLM
      }
    ]);

    let d3Code = cleanUpD3Code(result.content);

    // Validate the code
    const check = await checkIfCodeCanRunInBrowser(d3Script);

    console.log("checking for code", attempt, check.ok, check.error, d3Code);

    if (check.ok) {
      console.log("Generated valid D3.js code on attempt", attempt);
      EventBus.emit("d3-code", { d3Code: d3Code, id: chartId});
      return {chartId, d3Code};
      // return d3Code;
    } else {
      console.warn(`Attempt ${attempt} failed:`, check.error);
      lastError = check.error || "Unknown error";
    }
  }

  // All attempts failed
  throw new Error("Failed to generate valid D3.js code after 3 attempts. Last error:\n" + lastError);
}

export function cleanUpD3Code(code: any) {
    // For example, remove tags like "```javascript" and "```".
    return code.replace(/```javascript|```/g, "").trim();
}

// Define the CodeCheckResult type
interface CodeCheckResult {
  ok: boolean;
  error?: string;
}

export async function checkIfCodeCanRunInBrowser(code: string): Promise<CodeCheckResult> {
  try {
    // Basic syntax check via new Function
    new Function(code);  // throws SyntaxError if invalid

    // Optional: actually run it in try-catch (less safe)
    try {
      eval(code);
    } catch (e) {
      return { ok: false, error: "Runtime error: " + String(e) };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Syntax error: " + String(e) };
  }
}



export function compileJSCode(script: string, divNumber: string){

  script = cleanUpD3Code(script);

  try{
    const test_div = d3.select(divNumber);

    test_div.selectAll("*").remove();

    eval(script);


  } catch (e) {
    console.log("Error in testD3Comping function", e);
  }
}



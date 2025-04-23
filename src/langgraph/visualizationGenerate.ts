import Phaser from 'phaser';
import { initializeLLM } from "./chainingUtils";
import * as d3 from 'd3';
import * as ts from 'typescript';
import vm from 'vm';
import { EventBus } from "../game/EventBus";
import { d3Script } from './const';
import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import vegaEmbed from 'vega-embed';

(window as any).vega = vega;
(window as any).vegaLite = vegaLite;
(window as any).vegaEmbed = vegaEmbed;


const baseballSample = `
player,year,is_hit
Derek Jeter,1995.0,1.0
Derek Jeter,1995.0,1.0
David Justice,1996.0,0.0
David Justice,1996.0,0.0
David Justice,1996.0,0.0
David Justice,1996.0,0.0
......
`

const kidneySample = `
treatment,stone_size,success
B,large,1
A,large,1
A,large,0
A,large,1
A,large,0
A,small,1
B,small,1
A,large,0
B,small,1
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
    Create a visualization that is engaging and can effective communicate the truth behind the data.
    You can use vega-lite visualization grammar for guidance but use d3.js to implement it.
    
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
          You are a vegalite and visualization expert.
          You need to generate three charts based on the given dataset.
          You should have one visualization that gives a general overview of the data,
          You should have another two visualizations that focus on each subgroup of the data(you should visualize each data points in the subgroup).
          For example, if the data is about baseball players, you can have one visualization that shows the overall performance of all players, 
          and another two visualizations show the performance of each player(first visualization is an overview, second is Jeter, third is Justice).
          Generate only the JavaScript code for a visualization we need created for a given dataset, 
          Your code should start like this(PARAMETER: means you can change the number on that line): 

          const spec = {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "description": write your description here,
            "data": {
              "url": "${dataPath}",
              "format": {
                "type": "csv"
              }
            },
            "mark": write your mark here,
            "encoding": {
              write your encoding here
            }
          };

          const specSubgroup1 = {
            ......
          }

          const specSubgroup2 = {
            ......
          }

          vegaEmbed('#test-chart', spec);
          vegaEmbed('#test-chart1', specSubgroup1);
          vegaEmbed('#test-chart2', specSubgroup2);


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
    const check = await checkIfCodeCanRunInBrowser(d3Code);

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



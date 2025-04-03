import Phaser from 'phaser';
import { initializeLLM } from "./chainingUtils";
import * as d3 from 'd3';
import * as ts from 'typescript';
import vm from 'vm';
import { EventBus } from "../game/EventBus";

// Declare d3 as a property on globalThis.
declare global {
  interface Window {
    d3: any;
  }
}
export async function generateChartImage(dataSheet: any) {

  const chartId = `chart-${Math.random().toString(36).substr(2, 9)}`;


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
  Generate a clinical trial visualization with these strict requirements:

  1. DATA CHARACTERISTICS:
  - Dataset: ${JSON.stringify(dataSheet.slice(0, 3))}... (total ${dataSheet.length} records)
  - Key variables:
    * X-axis: ${dataSheet[0].AgeGroup ? 'AgeGroup' : 'Gender'}
    * Y-axis: Survival/Admission Rate (%)
    ${dataSheet[0].Treatment ? '* Grouping: Treatment' : ''}

  2. CHART SPECIFICATIONS:
  - Type: Grouped bar chart (if Treatment exists) or stacked bars
  - Required elements:
    ▢ 95% confidence intervals (if n>30 per group)
    ▢ p-value annotations for group comparisons
    ▢ Color coding:
      - Survival >70%: #4daf4a
      - 30-70%: #ff7f00
      - <30%: #e41a1c
    ▢ Baseline reference line at overall survival rate
    ▢ Clear "Survival Rate (%)" Y-axis label

  3. DATA TRANSFORMATION:
  - Pre-calculate percentages per group
  - Handle missing data explicitly
  - Sort categories clinically (Young→Old, Female→Male)

  4. OUTPUT CONTROL:
  - Only return executable D3.js v7+ code
  - Use this exact structure:
    // 1. Dimensions and margins
    const margin = {top: 25, right: 30, bottom: 45, left: 60};
    // 2. Data processing
    const survivalRates = ...;
    // 3. Chart rendering
    const svg = ...;
    
  ${lastError ? `5. ERROR FIXING: Correct these issues from last attempt:
    - ${lastError}
    - Specifically ensure: ${getSpecificFix(lastError)}` : ''}

  Medical disclaimer must be included as:
  // Data source: ClinicalTrials.gov ID NCTXXXXXX
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
      return chartId;
      // return d3Code;
    } else {
      console.warn(`Attempt ${attempt} failed:`, check.error);
      lastError = check.error || "Unknown error";
    }
  }

  // All attempts failed
  throw new Error("Failed to generate valid D3.js code after 3 attempts. Last error:\n" + lastError);
}

function cleanUpD3Code(code: any) {
    // For example, remove tags like "```javascript" and "```".
    return code.replace(/```javascript|```/g, "").trim();
}

// Use canvas to display the chart image on the console.
// function createCanvasPreview() {
//     setTimeout(() => {
//         const svg = document.querySelector("svg");

//         if (svg) {
//             const svgURL = new XMLSerializer().serializeToString(svg);

//             // Drawing SVG charts with canvas (converting SVG to images)
//             const canvas = document.createElement('canvas');
//             const ctx = canvas.getContext('2d');
//             canvas.width = 500;
//             canvas.height = 300;

//             const img = new Image();
//             const svgBlob = new Blob([svgURL], { type: 'image/svg+xml' });
//             const url = URL.createObjectURL(svgBlob);

//             img.onload = function () {
//                 if (ctx) {
//                     ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

//                     // get a base64 image and insert it into the console
//                     const base64Image = canvas.toDataURL("image/png");
//                     console.log("%c ", `font-size:100px; background: url(${base64Image}) no-repeat center; background-size: contain;`);
//                     console.log("c1", base64Image)
//                     return base64Image
//                 } else {
//                     console.error('Canvas context is not available.');
//                 }
//             };

//             img.src = url;
//         } else {
//             console.error('SVG element not found.');
//         }
//     }, 500);
// }


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



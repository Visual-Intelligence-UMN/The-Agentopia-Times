import Phaser from 'phaser';
import { initializeLLM } from "./chainingUtils";
import * as d3 from 'd3';
import * as ts from 'typescript';
import vm from 'vm';

// Declare d3 as a property on globalThis.
declare global {
  interface Window {
    d3: any;
  }
}

export async function generateChartImage(dataSheet: any) {
  console.log("generateVisualization", dataSheet);

  const llm = initializeLLM();
  const maxRetries = 3;
  let attempt = 0;
  let lastError = "";

  while (attempt < maxRetries) {
    attempt++;

    const promptForLLM = `
      Generate a simple D3.js bar chart for the following data: ${JSON.stringify(dataSheet)}.
      Include x-axis and y-axis labels, and a chart title.
      Only return the JavaScript code to generate the chart, no HTML, no CSS.
      ${lastError ? "The last attempt failed with the following error: " + lastError + ". Please correct it." : ""}
    `;

    const result = await llm.invoke([
      {
        role: "system",
        content: `
        Generate only the JavaScript code for the given dataset (you need to manually set the data for visualization).
        Your code should start like this (PARAMETER: means you can change the number on that line): 
        const width = 400; // PARAMETER
        const height = 200; // PARAMETER

        console.log("test-d3", d3.select('#test-d3'));

        const svg = d3.select('#test-d3').append('svg')
          .attr('width', width)
          .attr('height', height);
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
      return d3Code;
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
function createCanvasPreview() {
    setTimeout(() => {
        const svg = document.querySelector("svg");

        if (svg) {
            const svgURL = new XMLSerializer().serializeToString(svg);

            // Drawing SVG charts with canvas (converting SVG to images)
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 500;
            canvas.height = 300;

            const img = new Image();
            const svgBlob = new Blob([svgURL], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(svgBlob);

            img.onload = function () {
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // get a base64 image and insert it into the console
                    const base64Image = canvas.toDataURL("image/png");
                    console.log("%c ", `font-size:100px; background: url(${base64Image}) no-repeat center; background-size: contain;`);
                    console.log("c1", base64Image)
                    return base64Image
                } else {
                    console.error('Canvas context is not available.');
                }
            };

            img.src = url;
        } else {
            console.error('SVG element not found.');
        }
    }, 500);
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



export function compileJSCode(script: string){

  script = cleanUpD3Code(script);

  try{
    const test_div = d3.select("#test-d3");

    test_div.selectAll("*").remove();

    eval(script);


  } catch (e) {
    console.log("Error in testD3Comping function", e);
  }
}



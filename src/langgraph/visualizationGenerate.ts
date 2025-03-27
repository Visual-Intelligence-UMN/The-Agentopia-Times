import Phaser from 'phaser';
import { initializeLLM } from "./chainingUtils";

// Declare d3 as a property on globalThis.
declare global {
  interface Window {
    d3: any;
  }
}

export async function generateChartImage(): Promise<void> {
    console.log("generateVisualization");

    const data = [10, 20, 30, 40, 50];
    const promptForLLM = "Generate a simple D3.js bar chart for the following data: " + JSON.stringify(data) + ". Include x-axis and y-axis labels, and a chart title. Only return the JavaScript code to generate the chart, no HTML, no CSS.";

    const llm = initializeLLM();
    const result = await llm.invoke([
      { role: "system", content: "Generate only the JavaScript code for a simple D3.js bar chart, based on the following description:" },
      { role: "user", content: promptForLLM }
    ]);

    let d3Code = result.content;

    console.log("Generated D3.js Code:", d3Code);

    d3Code = cleanUpD3Code(d3Code);
    
    ensureD3Loaded().then(() => {
      return executeD3Code(d3Code);
    });
}

function cleanUpD3Code(code: any) {
    // For example, remove tags like "```javascript" and "```".
    return code.replace(/```javascript|```/g, "").trim();
}

// Make sure D3.js is loaded.
function ensureD3Loaded() {
  return new Promise<void>((resolve, reject) => {
    if (window.d3) {
      resolve();
    } else {
      const script = document.createElement('script');
      script.src = "https://d3js.org/d3.v7.min.js";
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    }
  });
}

function executeD3Code(d3Code: any) {
    let code: string;

    // If d3Code is not a string, try to extract the string from the object
    if (typeof d3Code === 'object' && d3Code.content) {
        code = d3Code.content;
    } else {
        code = d3Code;
    }

    console.log("Executing D3.js code:", code);

    const chartContainer = document.createElement('div');
    chartContainer.id = 'chart-container';
    document.body.appendChild(chartContainer);

    const script = document.createElement('script');
    script.textContent = code;
    document.body.appendChild(script);


    createCanvasPreview();


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

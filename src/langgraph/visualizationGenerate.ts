import Phaser from 'phaser';
import { initializeLLM } from "./chainingUtils";
import * as d3 from 'd3';

// Declare d3 as a property on globalThis.
declare global {
  interface Window {
    d3: any;
  }
}

export async function generateChartImage(promptForLLM: string, svgId: string){
    console.log("generateVisualization");
    const llm = initializeLLM();
    const result = await llm.invoke([
      { role: "system", content: `
          Generate only the JavaScript code for a simple D3.js chart, 
          Your code should start like this(PARAMETER: means you can change the number on that line): 
          const width = 400; // PARAMETER: you can change the width
          const height = 200; // PARAMETER: you can change the height
          console.log("${svgId}", d3.select('#${svgId}'));
          const svg = d3.select('#${svgId}').append('svg')
            .attr('width', width)
            .attr('height', height);
          based on the following description:
        ` 
      },
      { role: "user", content: promptForLLM }
    ]);

    let d3Code = result.content;

    console.log("Generated D3.js Code:", d3Code);

    d3Code = cleanUpD3Code(d3Code);
    
    return d3Code;
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



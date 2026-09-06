import { initializeLLM } from "./chainingUtils";
import * as d3 from 'd3';
import { EventBus } from "../game/EventBus";
import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import vegaEmbed from 'vega-embed';
import { getVisualizationData } from '../vega/visualizationData';
import { generateAutoVISPrompt, generateBiasedPrompt } from '../vega/visualizationLibrary';
import { getAgentMASPrompt } from './config';

(window as any).vega = vega;
(window as any).vegaLite = vegaLite;
(window as any).vegaEmbed = vegaEmbed;

function checkVegaLiteCode(d3Code: string): { ok: boolean, error?: string } {
  try {
    // 提取 spec 对象
    const match = d3Code.match(/const spec = ({[\s\S]*?});/);
    if (!match) return { ok: false, error: "Spec definition not found" };

    const spec = eval('(' + match[1] + ')');  // 尽量避免 eval，但此处用于快速提取对象

    // 尝试编译
    const compiled = vegaLite.compile(spec);
    vega.parse(compiled.spec); // 解析 Vega 编译结果

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Unknown Vega-Lite error' };
  }
}


// Declare d3 as a property on globalThis.
declare global {
  interface Window {
    d3: any;
  }
}
export async function generateChartImage(scene: any, agent: any) {

  const chartId = `chart-${Math.random().toString(36).substr(2, 9)}`;

  let dataKey = 'baseball';
  let facetVar = 'player';

  
  if(scene.registry.get('currentDataset').includes("Kidney")){
    // let dataPath = "./data/kidney.csv";
    dataKey = 'kidney';
    facetVar = 'treatment';
  }

  const dataSummary = getVisualizationData(dataKey);

  const llm = initializeLLM();
  const maxRetries = 3;
  let attempt = 0;
  let lastError = "";

  while (attempt < maxRetries) {
    attempt++;

    

  function getSpecificFix(error: string) {
    const fixes: Record<string, string> = {
      'undefined variable': 'declare all variables with const/let',
      'missing scale': 'add d3.scaleBand() for categorical data',
      'invalid data': 'implement data validation before rendering'
    };
    return fixes[error] || 'review D3.js data binding pattern';
  }

  let specPrompt = `
  Use a layered pie chart (arc mark + text mark) 
  to visualize the **proportion of hit/miss** 
  (or success/failure) grouped by player and year.
  `;
  let systemPrompt = `${generateAutoVISPrompt(dataSummary)}\n${getAgentMASPrompt(
    scene,
    agent.getBias() !== '',
    agent.getBiasType(),
  )}`;


  if(agent.getBias()!==''){
    specPrompt = `
      generate two pie chart, each pie chart shows the overall proportion for each ${facetVar}
      Please generate a valid Vega-Lite specification for a layered pie chart that meets the following requirements:

      When generating Vega or Vega-Lite specifications:

Never insert a fold transform unless the dataset actually contains separate fields that must be converted into long format. If the dataset already has a categorical column (e.g., "tag": "hit" / "miss"), you must not fold over string values.

Always preserve the logical data structure:

Use aggregate only when you need to compute group-level totals.

Use joinaggregate only when you need category-level denominators for proportions.

Do not stack multiple joinaggregate steps unless absolutely required.

Avoid defensive calculations (if(datum.value == undefined, 0, datum.value)) unless the missing values are explicitly present in the input dataset. Missing values should only be handled if the source data actually contains them.

Before outputting the final spec, simulate the data flow in your head: ensure each field referenced in later transforms or encodings is already produced by earlier transforms.

If proportions or percentages are needed:

First aggregate to compute counts or totals.

Then compute group totals with joinaggregate.

Then calculate proportions with calculate.
Do not use fold in this workflow if the categorical grouping field already exists.

Validate that the generated spec can run without undefined fields. Any field used in encoding must either exist in the input dataset or be created by a prior transform.
    
      `;
    systemPrompt = `${generateBiasedPrompt(facetVar, dataSummary)}\n${getAgentMASPrompt(
      scene,
      true,
      agent.getBiasType(),
    )}`;
  }
  console.log("specPrompt", specPrompt);

  const promptForLLM = `
  Please generate a Vega-Lite chart using the provided data.${specPrompt}

Only return the Vega-Lite code using the provided template.

The data is already inserted as \`"values": ${dataSummary}\` in the template.
Do not modify the data, and do not invent any values.
The Chart should be interactive and responsive, properly titled, and labeled for each chart.
  ${lastError ? `5. ERROR FIXING: Correct these issues from last attempt:
    - ${lastError}
    - Specifically ensure: ${getSpecificFix(lastError)}` : ''}

  ${agent.getBias()}
  `;

  


  

  console.log("data summary", dataSummary);

    const result = await llm.invoke([
      {
  role: "system",
  content: systemPrompt
},
      {
        role: "user",
        content: promptForLLM
      }
    ]);

    let d3Code = cleanUpD3Code(result.content);

    // Validate the code
    const check = checkVegaLiteCode(d3Code);

    console.log("checking for code", attempt, check.ok, check.error, d3Code);

//    if (check.ok) {
      console.log("Generated valid D3.js code on attempt", attempt);
      EventBus.emit("d3-code", { d3Code: d3Code, id: chartId});
      return {chartId, d3Code};
      // return d3Code;
    // } else {
    //   console.warn(`Attempt ${attempt} failed:`, check.error);
    //   lastError = check.error || "Unknown error";
    // }
  }

  // All attempts failed
  throw new Error("Failed to generate valid D3.js code after 3 attempts. Last error:\n" + lastError);
}

// export function cleanUpD3Code(code: any) {
//     // For example, remove tags like "```javascript" and "```".
//     console.log("Cleaning up code:", code);
//     return code.replace(/```javascript|```/g, "").trim();
// }

export function cleanUpD3Code(code: any) {
  if (!code) return '';

  const fenced = code.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/);
  if (fenced) code = fenced[1];

  code = code.replace(/```[a-zA-Z0-9_-]*|```/g, '');

  code = code.replace(/^\s*(json|javascript|js|ts|typescript|html)\s*\n/i, '');

  return code.trim();
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

// export function compileJSCode(script: string, divNumber: string){

//   script = cleanUpD3Code(script);

//   try{
//     const test_div = d3.select(divNumber);

//     test_div.selectAll("*").remove();

//     eval(script);


//   } catch (e) {
//     console.log("Error in testD3Comping function", e);
//   }
// }

export function compileJSCode(script: string, divSelector: string) {
  script = cleanUpD3Code(script);

  try {
    const test_div = d3.select(divSelector);
    test_div.selectAll("*").remove();

    if (/^\s*\{[\s\S]*\}\s*$/.test(script)) {
      script = `
        const spec = ${script};
        vegaEmbed('${divSelector}', spec, { renderer: 'canvas', actions: true, scaleFactor: 2 });
      `;
    }

    eval(script);
  } catch (e) {
    console.log("Error in testD3Comping function", e);
  }
}

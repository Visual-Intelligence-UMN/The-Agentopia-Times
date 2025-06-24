import { marked } from 'marked';
import { EventBus } from '../game/EventBus';
import { baseballPath, kidneyPath } from './agents';
import { initializeLLM } from './chainingUtils';
import { generateImage } from './dalleUtils';
import { generateChartImage } from './visualizationGenerate';
import { webStyle } from './const';

// weighting table
const writingWeights: Record<string, number> = {
  "Overall": 1,
  "Accuracy": 1,
  "Clarity": 1,
  "Reasoning": 1,
  "Bias Detection": 1,
};

const codingWeights: Record<string, number> = {
  "Structure": 1,
  "Encoding": 1,
  "Mapping": 1,
  "Interaction": 1,
  "Validity": 1,
  "Clarity": 1,
};

// for analysis
export async function dataFetcher(scene: any, state: any, agent: any) {
    // let datasetPath = covidPath;
    let datasetPath = baseballPath;
    let researchQuestions = `
                Across both 1995 and 1996, 
                which player had the better batting average overall? 
                Does this confirm who was the better hitter in each individual year?
            `;

    if (state.sequentialInput) {
        if (scene.registry.get('currentDataset') === 'kidney') {
            // datasetPath = ucbPath;
            datasetPath = kidneyPath;
            researchQuestions = `
                        Treatment B has a higher overall success rate across all patients. 
                        Should it be considered more effective than Treatment A?
                    `;
        }
    }

    const res = await fetch(datasetPath);
    const csvRaw = await res.text();
    console.log('csvRaw', csvRaw);

    agent.setAgentState('work');

    // await updateStateIcons(zones, "work", 0);
    // await updateStateIcons(scene.chainingZones, "work");

    const message = [
        {
            role: 'system',
            content: 'You are a data analyst.' + agent.getBias(),
        },
        {
            role: 'user',
            content:
                'Your work is to analyze the given dataset...' +
                csvRaw +
                ` and answer following questions ${researchQuestions}`,
        },
    ];

    return message;
}

export async function startVisualizer(
    scene: any,
    command: string,
    state: any,
    content: string,
    agent: any,
    scoreText: Phaser.GameObjects.Text,
) {
    let datasetPath = baseballPath;

    console.log('state route', state);

    if (scene.registry.get('currentDataset') === 'kidney') {
        datasetPath = kidneyPath;
    }

    const res = await fetch(datasetPath);
    const csvRaw = await res.text();
    console.log('csvRaw', csvRaw);

    command = 'visualization';
    console.log('command', command);

    if (command === 'visualization') {
        console.log('entered visualization branch');

        const chartData = await generateChartImage(scene, csvRaw, agent, state);
        const d3Code = chartData.d3Code;

        // EventBus.emit("final-report", { report: content, department: "routing" });
        const URL = await generateImage(
            `please give me an image based on the following describ or coonect with it: ${content}`,
        );
        console.log('URL', URL);
        console.log('d3code', d3Code);
        let dynamicTitle = 'Generated Report Summary';
        let dynamicIntro = 'Generated Report Intro';
        let contentWithoutHeaders = content;

        // 1. Extract and remove titles
        const titleMatch = contentWithoutHeaders.match(/^#\s*Title:\s*(.+)$/im);
        if (titleMatch) {
            dynamicTitle = titleMatch[1].trim();
            contentWithoutHeaders = contentWithoutHeaders.replace(
                titleMatch[0],
                '',
            );
        }

        // 2. Extract and remove Intro
        const introMatch =
            contentWithoutHeaders.match(/^##\s*Intro:\s*(.+)$/im);
        if (introMatch) {
            dynamicIntro = introMatch[1].trim();
            contentWithoutHeaders = contentWithoutHeaders.replace(
                introMatch[0],
                '',
            );
        }

        // 3. Final processing (at this point contentWithoutHeaders no longer contains Title and Intro)
        // const highlightedText = marked.parse(contentWithoutHeaders.trim());
        const highlightedText = await createHighlighter(
            contentWithoutHeaders.trim(),
        );

        state.secondRoomOutput = contentWithoutHeaders.trim();

        const style = webStyle;

        const visRawList  = await extractTSArray(
            await createVisualizationJudge(d3Code),
        );

        const finalVisScores = parseVisScores(visRawList );
        const visFeedbackComments = visRawList.slice(6);

        // const writingComments = await extractTSArray(
        //     await createWritingJudge(state.secondRoomOutput),
        // );

        const rawWriting = state.secondRoomOutput?.trim?.() ?? '';

        const writingRawList = await extractTSArray(await createWritingJudge(rawWriting));
        const finalWritingScores = parseWritingScores(writingRawList);
        const writingComments = writingRawList.slice(5);

        // Calculate the total score
        const overallScore = calculateOverallScore(finalWritingScores, finalVisScores);


        let commentsHTML = '';

        if (visFeedbackComments?.length > 0) {
            commentsHTML += `
                <div class="comment-section">
                <h3>Comments on Visualization</h3>
                <ul>
                    ${visFeedbackComments
                    .map((c) => `<li>${c}</li>`)
                    .join('')}
                </ul>
                </div>
            `;
        }

        if (writingComments?.length > 1) {
            commentsHTML += `
                <div class="comment-section">
                <h3>Comments on Writing</h3>
                <ul>
                    ${writingComments
                        .map((c) => `<li>${c}</li>`)
                        .join('')}
                </ul>
                </div>
            `;

            

            // Score button and score panel
            const scoreX = 600;
            const scoreY = 20;

            const codingScores = finalVisScores;

            if (scene.scoreButton) scene.scoreButton.destroy();
            if (scene.scorePanel) scene.scorePanel.destroy();
            if (scene.scorePanelBg) scene.scorePanelBg.destroy(); // ✅ 新增

            const paddingX = 16;
            const paddingY = 10;

            const scoreValueText = scene.add.text(scoreX, scoreY, `Score: ${overallScore}/10`, {
            fontSize: "18px",
            fontFamily: "Verdana",
            color: "#ffffff",
            }).setScrollFactor(0).setDepth(1001);

            const expandHintText = scene.add.text(scoreX, scoreY, `(click to expand)`, {
            fontSize: "12px",
            fontFamily: "Verdana",
            color: "#cccccc",
            }).setScrollFactor(0).setDepth(1001);

            const buttonWidth = Math.max(scoreValueText.width, expandHintText.width) + paddingX * 2;
            const buttonHeight = scoreValueText.height + expandHintText.height + paddingY * 2 + 4;

            scene.scoreButtonBg = scene.add.rectangle(
            scoreX + buttonWidth / 2,
            scoreY + buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            0x000000,
            0.6
            ).setStrokeStyle(2, 0xffffff)
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => {
                const newVisible = !scene.scorePanel.visible;
                scene.scorePanel.setVisible(newVisible);
                scene.scorePanelBg.setVisible(newVisible);
            });

            scoreValueText.setPosition(
            scene.scoreButtonBg.x - scoreValueText.width / 2,
            scene.scoreButtonBg.y - buttonHeight / 2 + paddingY
            );
            expandHintText.setPosition(
            scene.scoreButtonBg.x - expandHintText.width / 2,
            scoreValueText.y + scoreValueText.height + 4
            );

            scene.children.bringToTop(scoreValueText);
            scene.children.bringToTop(expandHintText);

            const writingText = Object.entries(finalWritingScores)
            .map(([k, v]) => `- ${k}: ${v}/10`)
            .join("\n");

            const codingText = Object.entries(codingScores)
            .map(([k, v]) => `- ${k}: ${v}/10`)
            .join("\n");

            const panelText = `✍️ Writing:\n${writingText}\n\n📈 Coding:\n${codingText}`;

            scene.scorePanel = scene.add.text(scoreX - 60, scoreY + 80, panelText, {
            fontSize: "18px",
            fontFamily: "Verdana",
            color: "#FFFFFF",
            padding: { x: 20, y: 16 },
            wordWrap: { width: 320 },
            align: "left",
            })
            .setScrollFactor(0)
            .setDepth(2000)
            .setVisible(false)
            .setResolution(2);

            const textBounds = scene.scorePanel.getBounds();
            const panelWidth = textBounds.width + 20;
            const panelHeight = textBounds.height + 20;

            const panelX = textBounds.x + panelWidth / 2;
            const panelY = textBounds.y + panelHeight / 2;

            scene.scorePanelBg = scene.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x000000, 0.5)
            .setStrokeStyle(2, 0xffffff)
            .setScrollFactor(0)
            .setDepth(1999)
            .setVisible(false);

            scene.scoreTooltip = scene.add.text(0, 0, '', {
            fontSize: '14px',
            fontFamily: 'Verdana',
            color: '#FFFFFF',
            padding: { x: 10, y: 6 },
            wordWrap: { width: 200 },
            })
            .setBackgroundColor('rgba(0, 0, 0, 0.7)')
            .setStyle({ stroke: '#FFFFFF', strokeThickness: 1.5 })
            .setScrollFactor(0)
            .setDepth(3000)
            .setVisible(false);



        }

        const body = `
            <div class="newspaper">
                <h1 class="newspaper-title">The Agentopia Times</h1>
                <p class="authors">Written by Professional LLM Journalists</p>
                <hr />
                <h2 class="headline">${dynamicTitle}</h2>
                <hr />

            <div class="newspaper-body">
                <div class="article-text">
                ${highlightedText}
                </div>
                <div class="article-graphic">
                <div id="test-chart" class="vis-above"></div>
                </div>
            </div>

            <h3 style="text-align: center;">Visualization I</h3>
            <div class="visualization-row">
                <div id="test-chart1" class="vis-box"></div>
                <div id="test-chart2" class="vis-box"></div>
            </div>

            <hr style="margin: 30px 0;" />
            ${commentsHTML}
            </div>

        `;

        let reportMessage = `${style}${body}`;

        EventBus.emit('final-report', {
            report: reportMessage,
            department: 'routing',
        });
    } else {
        console.log('entered illustration branch');
        const URL = await generateImage('please give me an image of a man');
        console.log('URL', URL);

        // const arry = `${msg.content}\n\n<img src="${URL}" style="max-width: 80%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />`;

        const reportMessage = `${content}
            \n\n<img src="${URL}" style="max-width: 80%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />
        `;

        EventBus.emit('final-report', {
            report: reportMessage,
            department: 'routing',
        });
    }

    return content;
}

async function extractTSArray(raw: any): Promise<string[]> {
  const clean = raw
    .replace(/^```(?:ts|typescript)?\s*/i, '')
    .replace(/```$/, '');
  return JSON.parse(clean);
}

export async function createVisualizationJudge(message: string) {
    const llm = initializeLLM();
    console.log('message before vis judge', message);

    const systemMssg: string = `
        You are a visualization grammar expert.

        Your task is to evaluate a Vega-Lite specification and provide structured feedback about its quality. 

        Follow this reasoning process:
        1. Examine the Vega-Lite specification carefully.
        2. Identify issues such as:
        - Missing or misleading encodings (e.g., using nominal on a quantitative field).
        - Ineffective mark choices (e.g., using bar when line is more suitable).
        - Redundant or invalid transformations.
        - Poor use of scale, axis, or color channels.
        - Incompatibility with common visualization best practices.
        3. Note any good practices or well-designed elements.
        4. Do **not** check for syntax errors—assume the spec is valid JSON and compiles.


        You must rate the specification along six dimensions:

        1. **Structure** – Does the visualization have a coherent layout with necessary components (title, axes, legends)?  
        Evaluate whether the chart includes all expected layout elements (e.g., title, labeled axes, legends) and whether these elements are properly placed and spaced to support comprehension.

        2. **Encoding** – Are the data fields properly encoded using effective mark and channel choices?  
        Assess whether the visual channels (e.g., position, length, color, size) are used appropriately for the data types. Are categorical fields assigned to discrete encodings and quantitative fields to continuous ones?

        3. **Mapping** – Are scales, axes, and transformations mapped correctly to the data?  
        Consider whether the scales and axes accurately reflect the data distribution. Are sorting, binning, aggregation, and data transformations clearly and appropriately applied?

        4. **Interaction** – Does the visualization support meaningful interaction (e.g., filtering, tooltips, brushing)?  
        Examine whether users can explore the data dynamically via interaction techniques such as tooltip, selection, filtering, or zooming. Do these interactions improve usability or insight?

        5. **Validity** – Is the specification logically valid for the data and consistent with best practices?  
        Check whether the chart type and encoding choices are suitable for the data’s structure and the intended message. Are any misleading or ineffective visual design choices present?

        6. **Clarity** – Is the visual output clean, readable, and unambiguous?  
        Determine whether the chart avoids clutter, overlaps, or confusing label placements. Is the message of the visualization easy to interpret at a glance?


        ---

        ### Scoring Rubric:

        Rate each dimension from 1 to 10.

        - **10** = Exceptional (professional-level)
        - **8–9** = Strong (minor issues)
        - **6–7** = Adequate (some flaws)
        - **4–5** = Weak (several flaws)
        - **1–3** = Poor (confusing or misleading)

        Be fair and objective. Reward clear structure, effective encodings, and valid design logic, but deduct points for misleading mappings, poor channel choices, or visual ambiguity.

        ---

        ### Output Instructions

        - Give 6 lines of numeric ratings (each formatted like: "Structure: 7/10").
        - Then write at least **6–8 detailed comment lines**, reflecting your analysis across the dimensions above. Try to include **at least 2 sentences per dimension** to ensure thorough feedback.
        - The comments should explain the **reasons behind each score**, offering **concrete suggestions or praises**. For example: "The legend placement is effective" or "Interaction is limited to tooltip only, reducing engagement."
        - Avoid short generic statements. Write full, thoughtful sentences.
        - Your final output must be a valid \`string[]\` in TypeScript syntax.
        - Do **not** include any explanations before or after the array.
        - Do **not** repeat or paraphrase the input text.
        - Do **not** use markdown, HTML, or highlight tags.
        - Do **not** reference “comments on writing” or “visualization” in any form.
        - Do NOT wrap your output in ts or any code fences. Return only the raw array.
        - Do NOT include any explanations or markdown formatting.
        - Do NOT highlight or format any portion of the original message.
        - Return **only** the raw array of strings, nothing more.

        ---

        ### Output Format:

        Return your output as a TypeScript-compatible array of strings (string[]). Follow this format:

        \`\`\`ts
        [
        "Structure: 6/10",
        "Encoding: 7/10",
        "Mapping: 8/10",
        "Interaction: 5/10",
        "Validity: 9/10",
        "Clarity: 6/10",
        "The layout is generally well structured but could benefit from a clear title.",
        "Tooltip is supported, but more interaction like filtering or selection would help users explore the data.",
        "Color encoding is effective for nominal fields, but may confuse when applied to quantitative values.",
        "Axes are present and properly scaled, but tick density is too low on the y-axis.",
        "Legend is placed well, but lacks a descriptive label.",
        "The design is clean, but lacks annotations to guide interpretation."
        ]
        \`\`\`

        Do not include any additional text—just the array of strings.

        Example Output: 
        [
            "aaaaaaaaaaaaaaaaaaa",
            "bbbbbbbbbbbbbbbbbbb",
            "ccccccccccccccccccc"
        ]
        ---

        Now evaluate the following Vega-Lite specification:

        ${message}
    `;


    const comment = await llm.invoke(systemMssg);

    console.log('comments from routes llm: ', comment.content);

    console.log('message after vis judge', comment.content);

    try {
        // Try parsing response as a JSON array
        return comment.content;
    } catch (e) {
        console.error('Failed to parse comment as string[]:', e);
        return [
            `Error: LLM response is not a valid string[]: ${comment.content}`,
        ];
    }
}

export async function createWritingJudge(message: string) {
  const llm = initializeLLM();
  const systemMssg = `
        You are an expert in writing evaluation. Your task is to provide detailed, objective feedback on the following user-written analytical report, formatted as a strict TypeScript-compatible array of strings (string[]). Your output must follow the structure and rules below exactly.

        ---

        ### Evaluation Criteria (rate each from 1 to 10)

        1. Overall – How coherent, structured, and well-organized the full piece is.
        Evaluate flow, organization, and clarity of argument presentation. Does the piece have a clear introduction, body, and conclusion?

        2. Accuracy – Are the data claims internally consistent and interpreted correctly within the context of the provided data?
        Focus on internal consistency. Are numerical values applied logically and interpreted without distortion or misreading?

        3. Clarity – Is the writing easy to read, unambiguous, and logically worded?
        Assess whether wording, phrasing, and transitions help the reader understand the argument easily and precisely.

        4. Reasoning – Are arguments well-supported, step-by-step, and logically sound?
        Analyze whether evidence supports the claims and whether the argument builds progressively without logical gaps.

        5. Bias Detection – Does the writing avoid biased, vague, or misleading statements?
        Identify emotionally charged language, one-sided framing, or claims not supported by data or reasoning.


        ---

        ### Use the following scoring rubric:

        - **10** = Exceptional (professional-level writing, flawless logic)
        - **8–9** = Strong (mostly clear and accurate, minor issues)
        - **6–7** = Adequate (some issues with clarity, reasoning, or accuracy)
        - **4–5** = Weak (noticeable flaws in logic, bias, or communication)
        - **1–3** = Poor (confusing, misleading, or clearly inaccurate)

        Be fair and objective. Reward clear organization and valid reasoning, but deduct points for factual, logical, or stylistic flaws.

        ---

        ### Reference Examples

        Use these canonical examples for calibration:

        **Baseball Example:**
        > David Justice had a higher batting average than Derek Jeter in both 1995 and 1996. However, Jeter had significantly more at-bats in 1996, while Justice had more in 1995. When aggregated, Jeter's average surpasses Justice’s — illustrating Simpson’s paradox.

        **Kidney Example:**
        > Treatment A had higher success in both small and large kidney stones. But since it was used more for harder cases, the overall rate appeared worse than Treatment B. This reversal is due to imbalance across subgroups.

        ---

        ### Output Format

        Return your output as a TypeScript-compatible array of strings (string[]). Each element must be a single-sentence observation or judgment (e.g., "This uses a force layout, which is not supported in Vega-Lite.").

        \`\`\`ts
        [
        "Overall: 6/10",
        "Accuracy: 5/10",
        "Clarity: 7/10",
        "Reasoning: 6/10",
        "Bias Detection: 8/10",
        "The data claims about batting averages are factually incorrect.",
        "The explanation lacks sufficient support for statistical reasoning.",
        "The conclusion overstates the findings based on weak evidence.",
        "Some comparisons are misleading without proper context."
        ]
        \`\`\`

        ---

        ### Output Rules

        - Do **not** include any explanations before or after the array.
        - Do **not** repeat or paraphrase the input text.
        - Do **not** use markdown, HTML, or highlight tags.
        - Do **not** reference “comments on writing” or “visualization” in any form.
        - Do NOT wrap your output in ts or any code fences. Return only the raw array.
        - Do NOT include any explanations or markdown formatting.
        - Do NOT wrap your output in \\\ts or any other code block.
        - Do NOT highlight or format any portion of the original message.
        - Return **only** the raw array of strings, nothing more.
        - After the score lines, provide **at least 10 concise comments**, with **at least 2 per dimension**, clearly explaining and justifying the scores.
        - The first 5 elements must be score lines: "Category: X/10"
        - Follow with any number of concise, professional feedback comments.
        - Do not fact-check the data against real-world sources. Assume the numbers are correct as provided. Focus on whether the analysis is logically sound based on those numbers.


        ---

        Now evaluate the following user-written text:

        ${message}
    `;


  try {
    const comment = await llm.invoke(systemMssg);
    console.log('comments from writing judge:', comment.content);
    return comment.content;
  } catch (e) {
    console.error('Writing judge failed:', e);
    return [`Error: Failed to evaluate writing content.`];
  }
}



export function parseWritingScores(rawList: string[]) {
  const scores: Record<string, number> = {};
  const desiredKeys = ["Overall", "Accuracy", "Clarity", "Reasoning", "Bias Detection"];

  rawList.forEach((line) => {
    const match = line.match(/^(\w+(?: \w+)?):\s*(\d+)\/10$/); // 支持带空格 key
    if (match) {
      const [, key, value] = match;
      if (desiredKeys.includes(key)) {
        scores[key] = parseInt(value, 10);
      }
    }
  });

  return scores;
}

export function parseVisScores(rawList: string[]) {
  const scores: Record<string, number> = {};
  const desiredKeys = ["Structure", "Encoding", "Mapping", "Interaction", "Validity", "Clarity"];

  rawList.forEach((line) => {
    const match = line.match(/^(\w+(?: \w+)?):\s*(\d+)\/10$/);
    if (match) {
      const [, key, value] = match;
      if (desiredKeys.includes(key)) {
        scores[key] = parseInt(value, 10);
      }
    }
  });

  return scores;
}

// Calculation of a harmonized weighted total score
function calculateOverallScore(
  writing: Record<string, number>,
  coding: Record<string, number>
) {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // writing
  for (const [key, score] of Object.entries(writing)) {
    const weight = writingWeights[key] ?? 1;
    totalWeightedScore += score * weight;
    totalWeight += weight;
  }

  // visualization
  for (const [key, score] of Object.entries(coding)) {
    const weight = codingWeights[key] ?? 1;
    totalWeightedScore += score * weight;
    totalWeight += weight;
  }

  const average = totalWeightedScore / totalWeight;
  return Math.round(average);
}



export async function createHighlighter(message: string) {
    const llm = initializeLLM();
    const systemMssg: string = `
        You are a text highlighter expert.
        Don't remove or modify any html tags in the message.
        Highlight the biased statements in the writing portion(all texts above Visualization I) of the text.
        For example: 

        Message: xxxx, aaaa, bbb. 
        If xxxx is biased, highlight it.
        Then, the output is: 
        <mark>xxxx</mark>, aaaa, bbb. 

        Dont change any other texts in the message.

        ${message}

        return the original message with highlighted texts, 
        but don't change any other texts in the message.
    `;

    console.log('message before highlighter', message);
    const comment = await llm.invoke(systemMssg);
    console.log('message after highligher: ', comment.content);

    console.log('comments from routes llm: ', comment.content);

    return comment.content;
}

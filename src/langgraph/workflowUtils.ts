import { marked } from 'marked';
import { EventBus } from '../game/EventBus';
import { baseballPath, getLLM, kidneyPath } from './agents';
import { initializeLLM } from './chainingUtils';
import { generateImage } from './dalleUtils';
import { generateChartImage } from './visualizationGenerate';
import { webStyle } from './const';

export function returnDatasetDescription(scene: any) {
    let datasetDescription = `The Justice and Jeter Baseball Dataset is a classic example illustrating Simpson's Paradox, where trends observed within individual groups reverse when the groups are combined. In the 1995 and 1996 MLB seasons, David Justice had a higher batting average than Derek Jeter in each year individually. However, when the data from both years are combined, Jeter's overall batting average surpasses Justice's. This counterintuitive result arises because Jeter had significantly more at-bats in 1996—a year in which he performed exceptionally well—while Justice had more at-bats in 1995, when his performance was comparatively lower. The imbalance in the distribution of at-bats across the two years affects the combined averages, leading to the paradoxical outcome. This dataset serves as a compelling demonstration of how aggregated data can sometimes lead to misleading conclusions if underlying subgroup trends and data distributions are not carefully considered. ​`;
    if (scene.registry.get('currentDataset') === 'kidney') {
        datasetDescription = `The kidney stone treatment dataset is a renowned real-world example illustrating Simpson’s Paradox, where aggregated data can lead to conclusions that contradict those derived from subgroup analyses. In a 1986 study published in the British Medical Journal, researchers compared two treatments for kidney stones: Treatment A (open surgery) and Treatment B (percutaneous nephrolithotomy). When considering all patients collectively, Treatment B appeared more effective, boasting an overall success rate of 82.6% compared to 78.0% for Treatment A. However, when the data were stratified by stone size, Treatment A demonstrated higher success rates for both small stones (93.1% vs. 86.7%) and large stones (73.0% vs. 68.8%) . This paradox arises because a disproportionate number of patients with small stones—who generally have higher treatment success rates—received Treatment B, skewing the aggregated results. The dataset underscores the importance of considering confounding variables and subgroup analyses in statistical evaluations to avoid misleading conclusions.`;
    }
    return datasetDescription;
}

// for analysis
export async function startDataFetcher(scene: any, agent: any) {
    // let datasetPath = covidPath;
    let datasetPath = baseballPath;
    let researchQuestions = `
                Across both 1995 and 1996, 
                which player had the better batting average overall? 
                Does this confirm who was the better hitter in each individual year?
            `;

    if (scene.registry.get('currentDataset') === 'kidney') {
        // datasetPath = ucbPath;
        datasetPath = kidneyPath;
        researchQuestions = `
                        Treatment B has a higher overall success rate across all patients. 
                        Should it be considered more effective than Treatment A?
                    `;
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

    const final_msg = await startTextMessager(
        message[0].content,
        message[1].content,
    );

    return final_msg;
}

export async function startJudges(
    d3Code: string,
    content: string,
) {
    const highlightedText = await createHighlighter(
        content,
    );
    const comments = await extractTSArray(
        await createVisualizationJudge(d3Code),
    );
    const writingComments = await extractTSArray(
        await createWritingJudge(content),
    );
    return { highlightedText, comments, writingComments };
}


export function createScoreUI(
  scene: any,
  scoreX: number,
  scoreY: number,
  overallScore: number,
  finalWritingScores: Record<string, number>,
  finalVisScores: Record<string, number>
) {
  const paddingX = 16;
  const paddingY = 10;

  const codingScores = finalVisScores;

  if (scene.scoreButton) scene.scoreButton.destroy();
  if (scene.scorePanel) scene.scorePanel.destroy();
  if (scene.scorePanelBg) scene.scorePanelBg.destroy();

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
  }).setScrollFactor(0).setDepth(2000).setVisible(false).setResolution(2);

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
}




export async function startVisualizer(
    scene: any,
    content: string,
    chartData: any,
) {
    let datasetPath = baseballPath;

    if (scene.registry.get('currentDataset') === 'kidney') {
        datasetPath = kidneyPath;
    }

    const res = await fetch(datasetPath);
    const csvRaw = await res.text();
    console.log('csvRaw', csvRaw);

    console.log('entered visualization branch');

    // const chartData = await generateChartImage(scene, agent);
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
    const introMatch = contentWithoutHeaders.match(/^##\s*Intro:\s*(.+)$/im);
    if (introMatch) {
        dynamicIntro = introMatch[1].trim();
        contentWithoutHeaders = contentWithoutHeaders.replace(
            introMatch[0],
            '',
        );
    }

    // 3. Final processing (at this point contentWithoutHeaders no longer contains Title and Intro)
    // const highlightedText = marked.parse(contentWithoutHeaders.trim())

    return {}
}

export async function startHTMLConstructor(
    comments: string[],
    writingComments: string[],
    highlightedText: any,
    dynamicTitle: string,
    style: string = webStyle,
){
    let commentsHTML = '';

    if (comments?.length > 0) {
        commentsHTML += `
    <div class="comment-section">
      <h3>Comments on Visualization</h3>
      <ul>
        ${comments.map((c) => `<li>${c}</li>`).join('')}
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
            .slice(1)
            .map((c) => `<li>${c}</li>`)
            .join('')}
      </ul>
    </div>
  `;
        // scoreText.setText('Score: 8/10');
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

    console.log("graph:vis-report msg: ", reportMessage);

    EventBus.emit('final-report', {
        report: reportMessage,
        department: 'voting',
    });
}

export function startScoreComputer(){
    // state your scores computing logic here
    return {overall_score: 10, writing_score: {"A": 10}, coding_score: {"A": 10}};
}



async function extractTSArray(raw: any): Promise<string[]> {
    //const trimmed = raw.map((str) => str.trim());
    const clean = raw.replace(/^```typescript\s*|```$/g, '');
    return JSON.parse(clean);
}

export async function createVisualizationJudge(message: string) {
    const llm = initializeLLM();
    console.log('message before vis judge', message);
    const systemMssg: string = `
        You are a visualization grammar expert.

Your task is to evaluate a Vega-Lite specification and provide constructive feedback about its quality and correctness. Consider whether the visualization uses appropriate encodings, mark types, and transformations to represent the intended data meaningfully and clearly.

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

        Now evaluate the following vega-lite code:

        ${message}

        Return your output as a TypeScript-compatible array of strings (string[]). Each element must be a single-sentence observation or judgment (e.g., "This uses a force layout, which is not supported in Vega-Lite.").

        Do not include any additional text—just the array of strings.

        Example Output: 
        [
            "aaaaaaaaaaaaaaaaaaa",
            "bbbbbbbbbbbbbbbbbbb",
            "ccccccccccccccccccc"
        ]
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
    console.log('message before writing judge', message);
    const systemMssg: string = `
        You are a bias detection expert.
        Carefully evaluate the following text and identify any potential biases or misleading statements.
        Your task is to provide a list of potential biases or misleading statements in the text.

        ${message}

        You can use the answers below for refeerences:
        1. BaseBall Answer: 
        This phenomenon occurs due to unequal sample sizes across subgroups. David Justice had a higher batting average than Derek Jeter in both 1995 and 1996. However, Jeter had significantly more at-bats in the season when his performance was strongest (1996), while Justice had more at-bats in the season with a lower average (1995). As a result, when the data is aggregated, Jeter's overall average surpasses Justice’s, illustrating how subgroup trends can reverse in the combined data.

        2. Kidney Answer:
        This reversal arises from differences in subgroup composition. Treatment A showed higher success rates than Treatment B for both small and large kidney stones. However, Treatment A was administered more frequently to patients with large stones, which are harder to treat, while Treatment B was more common among patients with small stones. When the data is combined without accounting for stone size, the overall success rate of Treatment B appears higher, even though it was less effective in every subgroup.

        Also, give a score from 1 to 10 for the writing quality, where 1 is the worst and 10 is the best.
        The score should be the first element in the output array, formatted as "Score: X/10".

        Return your output as a TypeScript-compatible array of strings (string[]). Each element must be a single-sentence observation or judgment (e.g., "This uses a force layout, which is not supported in Vega-Lite.").

        Do not include any additional text—just the array of strings.
        Do not highlight any texts in the "Comments on Writing" or "Comments on Visualization" sections.

        Don't change the first element in the example output, keep it as the given score

        Example Output: 
        [
            "Score: 8/10",
            "The data source can be specified in Vega-Lite using a similar dataset.",
            "The chart dimensions and margins can be set using padding and width/height properties in Vega-Lite.",
            "Filtering the data to exclude null values is supported through the filter transformation in Vega-Lite."
        ]
    `;

    const comment = await llm.invoke(systemMssg);

    console.log('comments from routes llm: ', comment.content);

    console.log('message after writing judge', comment.content);

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

export async function startTextMessager(
    roleContent: string,
    userContent: string,
) {
    const message = [
        {
            role: 'system',
            content: roleContent,
        },
        {
            role: 'user',
            content: userContent,
        },
    ];

    const msg = await getLLM().invoke(message);
    return msg;
}

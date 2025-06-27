import { marked } from 'marked';
import { EventBus } from '../game/EventBus';
import { baseballPath, getLLM, kidneyPath } from './agents';
import { initializeLLM } from './chainingUtils';
import { generateImage } from './dalleUtils';
import { generateChartImage } from './visualizationGenerate';
import { webStyle } from './const';
import { baseballDatasetStatistic, baseballGroundTruth, biasedBaseballDatasetStatistic, biasedKidneyDatasetStatistic, kidneyDatasetStatistic, kidneyGroundTruth } from '../const';

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

    let stats = baseballDatasetStatistic;

    console.log("biased data fetcher,", agent.getBias());
    if (scene.registry.get('currentDataset') === 'kidney') {
        // datasetPath = ucbPath;
        stats = kidneyDatasetStatistic;
    }
    if(agent.getBias()!== '') {
      if(scene.registry.get('currentDataset') === 'kidney') {
        stats = biasedKidneyDatasetStatistic
      }else{
        stats = biasedBaseballDatasetStatistic;
      }
    }

    let datasetPath = baseballPath;
    let researchQuestions = `
                Across both 1995 and 1996, 
                which player had the better batting average overall? 
                Does this confirm who was the better hitter in each individual year?
                Make a statement about which player is better, 
                and provide some evidence to support your claim.

                Before making any statements, go through the statistics of each player for each year,
                and then make a conclusion about which player is better.
                Be careful, this dataset has a phenomenon called Simpson's Paradox

                You can use the following statistics to support your claim:
                ${stats}
            `;

    if (scene.registry.get('currentDataset') === 'kidney') {
        // datasetPath = ucbPath;
        datasetPath = kidneyPath;
        researchQuestions = `
                Treatment B has a higher overall success rate across all patients. 
                Should it be considered more effective than Treatment A?
                Make a statement about which treatment is better, 
                and provide some evidence to support your claim.

                Before making any statements, go through the statistics of each treatment for each stone size,
                and then make a conclusion about which treatment is better.
                Be careful, this dataset has a phenomenon called Simpson's Paradox

                You can use the following statistics to support your claim:
                ${stats}
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
                `  answer following questions ${researchQuestions}`,
        },
    ];

    const final_msg = await startTextMessager(
        message[0].content,
        message[1].content,
    );

    return final_msg;
}

export async function startJudges(d3Code: string, content: string) {
  // const highlightedText = await createHighlighter(content);
  // const cleanedContent = content.replace(/```html\s*|```/g, '').trim();

  const cleanedContent = content.replace(/```html\s*|```/g, '').trim();
  const parsedMarkdown = await marked.parse(cleanedContent);

  let raw = await createHighlighter(parsedMarkdown);
  let highlightedText = typeof raw === 'string'
    ? raw
    : (raw as any).content?.toString?.() ?? '';

  highlightedText = highlightedText.replace(/^```html\s*|```$/g, '').trim();


  

  const visRaw = await createVisualizationJudge(d3Code);
  const writingRaw = await createWritingJudge(content);

  const visResult = await parseJudgeResult(visRaw);
  const writingResult = await parseJudgeResult(writingRaw);

  return {
    highlightedText,
    coding_score: visResult.score,
    coding_reasons: visResult.reasons,
    comments: visResult.comments,
    writing_score: writingResult.score,
    writing_reasons: writingResult.reasons,
    writingComments: writingResult.comments,
  };
}

export async function parseJudgeResult(
  raw: string | any[] | { content: string }
): Promise<{ score: string; reasons: string[]; comments: string[] }> {
  let clean: string;

  if (typeof raw === 'string') {
    clean = raw;
  } else if (Array.isArray(raw)) {
    clean = raw.map(r => r?.toString?.() ?? '').join('\n');
  } else if (typeof raw === 'object' && raw !== null && 'content' in raw) {
    clean = raw.content;
  } else {
    throw new Error('Unsupported judge result type');
  }

  // 移除 ```ts 包裹
  clean = clean.replace(/^```ts\s*|```$/g, '').trim();

  // 手动添加属性名的引号：{ score: → { "score":
  clean = clean.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

  return JSON.parse(clean);
}

export function createScoreUI(
  scene: any,
  scoreX: number,
  scoreY: number,
  overallScore: number,
  writingScore: string,
  codingScore: string,
  writingReasons: string[],
  codingReasons: string[]
) {
  const paddingX = 16;
  const paddingY = 10;

  // const codingScores = finalVisScores;

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

  scene.scoreValueText = scoreValueText;
  scene.expandHintText = expandHintText;

  scene.children.bringToTop(scoreValueText);
  scene.children.bringToTop(expandHintText);

  // const writingText = Object.entries(finalWritingScores)
  //   .map(([k, v]) => `- ${k}: ${v}/10`)
  //   .join("\n");

  // const codingText = Object.entries(codingScores)
  //   .map(([k, v]) => `- ${k}: ${v}/10`)
  //   .join("\n");

  const panelText = `✍️ Writing: ${writingScore}
  ${writingReasons.map(r => r.startsWith("-") ? `  ${r}` : `  - ${r}`).join("\n")}

  📈 Coding: ${codingScore}
  ${codingReasons.map(r => r.startsWith("-") ? `  ${r}` : `  - ${r}`).join("\n")}`;



  scene.scorePanel = scene.add.text(scoreX - 100, scoreY + 80, panelText, {
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

// clean the scores UI when click the start simulation button
export function resetScoreUI(scene: any) {
  if (scene.scoreButton) {
    scene.scoreButton.destroy();
    scene.scoreButton = null;
  }
  if (scene.scoreButtonBg) {
    scene.scoreButtonBg.destroy();
    scene.scoreButtonBg = null;
  }
  if (scene.scorePanel) {
    scene.scorePanel.destroy();
    scene.scorePanel = null;
  }
  if (scene.scorePanelBg) {
    scene.scorePanelBg.destroy();
    scene.scorePanelBg = null;
  }
  if (scene.scoreValueText) {
    scene.scoreValueText.destroy();
    scene.scoreValueText = null;
  }
  if (scene.expandHintText) {
    scene.expandHintText.destroy();
    scene.expandHintText = null;
  }
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
    department: string,
    index: number,
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

    if (writingComments?.length > 0) {
    commentsHTML += `
      <div class="comment-section">
        <h3>Comments on Writing</h3>
        <ul>
          ${writingComments.map((c) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
    `;
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
        department: department+"-"+index,
    });
}

export function startScoreComputer(judgeData: {
  writing_score: string;    // "8/10"
  coding_score: string;     // "7/10"
  coding_reasons: string[];
  writing_reasons: string[];
}) {
  const parseScore = (scoreStr: string): number => {
    const match = scoreStr.match(/(\d+)\/10$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const writingNumeric = parseScore(judgeData.writing_score); // 8
  const codingNumeric = parseScore(judgeData.coding_score);   // 7

  const overall = ((writingNumeric * 2 + codingNumeric * 0.5) / 25 * 10).toFixed(2);

  return {
    overall_score: overall,
    writing_score: judgeData.writing_score,
    coding_score: judgeData.coding_score,
    coding_reasons: judgeData.coding_reasons,
    writing_reasons: judgeData.writing_reasons
  };
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

      Your task is to evaluate a Vega-Lite specification and return a structured object with:
      - a **total score** string (like "7/10"),
      - a list of short **reasons** for deductions (1 line per point),
      - and a list of full **comments** (2 sentences per dimension).

      Follow the below grading scale: 

      ---

      ### Output Format:

      Return a **TypeScript-compatible object**:

      \`\`\`ts
      {
        score: string,
        reasons: string[],
        comments: string[]
      }
      \`\`\`

      ### Requirements:

      - Use the 6 evaluation dimensions: Structure, Encoding, Mapping, Interaction, Validity, Clarity.
      - Rate the overall visualization from 1 to 10.
      - In **reasons[]**, include **short concise deduction points**, like "- Axis label missing" or "- Tooltip only, no filtering".
      - In **comments[]**, explain the evaluation with 6–8 complete sentences.
      - Avoid markdown, no HTML, no extra explanations or wrapping.
      - Do not echo or paraphrase the input.
      - Only return the object — no other explanation.

      ---

      Evaluate the following Vega-Lite spec:

      ${message}
    `;

  const comment = await llm.invoke(systemMssg);

  const content = typeof comment === 'string'
    ? comment
    : (comment as any).content?.toString?.() ?? '';

  console.log('LLM response (raw content):', content);

  try {
      console.log('comments from writing judge:', comment.content);
      return comment.content;
  } catch (e) {
      console.error('Writing judge failed:', e);
      return [`Error: Failed to evaluate writing content.`];
  }
}

export async function createWritingJudge(message: string) {
  const llm = initializeLLM();

  const systemMssg = `
    You are a writing evaluation expert.

    Your task is to evaluate an analytical report and return a structured object with:
    - a **total score** string (e.g., "7/10"),
    - a list of short **reasons** for point deductions (1 per issue),
    - a list of full **comments** (at least 2 sentences per dimension).

    Here is the ground truth of the message:
    ${baseballGroundTruth}

    and 

    ${kidneyGroundTruth}

    If the message is about baseball, use the baseball ground truth.
    If the message is about kidney, use the kidney ground truth.
    If the message is about other topics, score it "0/10".
    You can ignore some minor differences in the statistics section(<0.01)

    ### Rule for Scoring: 

    - It is okay, if the paragraph mentioned the "Jeter is betetr than Jutsice in overall" or "Treatment B is better than Treatment A in overall", 
      but if didn't mention the each-year or each-category comparison envidence, minus 5 points
    - if the paragraph didn't compare the two players for each season, or didn't compare the large/small stone treatments, minus 5 points
    - if the paragraph only compare overall statistics, minus 4 points
    - if the paragraph didn't mention the Simpson's Paradox, minus 2 points
    - it is okay if there're differences in the data statistic, 
      don't minus points for that and don't need to return comment for that
    - if the title contains any misleading statements(such as 'Jeter beats Justice' or 
      'treatment B is better than treatment A' or something similar), minus 2 points; 
      if there're any misleading statements in title, you should mention it in comments. 
    - the smallest score is 0/10, the largest score is 10/10

    ---

    ### Output Format:

    Return a TypeScript-compatible object:

    {
      score: string,
      reasons: string[],
      comments: string[]
    }

    ---

    ### Rules:

    - In **reasons[]**, give short deduction reasons like "- Misleading claim about correlation" or "- Incomplete conclusion".
    - In **comments[]**, explain each score in depth — aim for 2+ full sentences per category.
    - Do NOT include markdown, HTML, or formatting.
    - Do NOT echo or repeat the input.
    - Return ONLY the object, nothing else.

    ---

    Evaluate the following analytical report:

  ${message}
  `;

  const comment = await llm.invoke(systemMssg);
  const content = typeof comment === 'string'
    ? comment
    : (comment as any).content?.toString?.() ?? '';

  console.log('LLM writing response:', content);

  try {
      console.log('comments from writing judge:', comment.content);
      return comment.content;
  } catch (e) {
      console.error('Writing judge failed:', e);
      return [`Error: Failed to evaluate writing content.`];
  }
}


export async function createHighlighter(message: string) {
    const llm = initializeLLM();
    const systemMssg: string = `
        You are a text highlighter expert.
        Don't remove or modify any html tags in the message.
        Highlight the incorrect statements in the writing portion(all texts above Visualization I) of the text.
        
        
        For example: 

        Message: xxxx, aaaa, bbb. 
        If xxxx is biased, highlight it.
        Then, the output is: 
        <mark>xxxx</mark>, aaaa, bbb. 

        Dont change any other texts in the message.

        Here is the ground truth of the message:
        ${baseballGroundTruth}

        and 

        ${kidneyGroundTruth}

        If the message is about baseball, use the baseball ground truth.
        If the message is about kidney, use the kidney ground truth.
        If the message is about other topics, highlight the whole paragraph.
        You can ignore some minor differences in the statistics section(<0.01)

        Here is the message to highlight:
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
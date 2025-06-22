import { marked } from 'marked';
import { EventBus } from '../game/EventBus';
import { baseballPath, kidneyPath } from './agents';
import { initializeLLM } from './chainingUtils';
import { generateImage } from './dalleUtils';
import { generateChartImage } from './visualizationGenerate';
import { webStyle } from './const';

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
        const style = webStyle;

        const comments = await extractTSArray(
            await createVisualizationJudge(d3Code),
        );
        const writingComments = await extractTSArray(
            await createWritingJudge(state.secondRoomOutput),
        );

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
            scoreText.setText('Score: 8/10');
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

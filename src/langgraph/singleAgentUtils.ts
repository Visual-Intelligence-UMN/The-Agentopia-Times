import { StateGraph, START, END } from '@langchain/langgraph/web';
import { baseballPath, createReport, kidneyPath } from './agents';
import { Agent } from 'openai/_shims/index.mjs';
import { SingleAgentGraphAnnotation } from './states';
import { autoControlAgent, transmitReport } from '../game/utils/controlUtils';
import { EventBus } from '../game/EventBus';
import { generateImage } from './dalleUtils';
import { initializeLLM } from './chainingUtils';
import { marked } from 'marked';
import { generateChartImage } from './visualizationGenerate';
import { createVisualizationJudge, createWritingJudge } from './judges';

export function constructSingleAgentGraph(
  agent: Agent[],
  scene: any,
  tilemap: any,
  thisRoomDestination: any,
  destination: any
) {
  const graph = new StateGraph(SingleAgentGraphAnnotation);

  graph.addNode(
    'visualization',
    createLeaf(
        agent[0], 
        scene, 
        tilemap, 
        thisRoomDestination, 
        destination, 
        scene.creditsText
    )
  );

  graph.addEdge(START as any, 'visualization' as any);
  graph.addEdge('visualization' as any, END as any);

  return graph.compile();
}


export function createLeaf(
    agent: any,
    scene: any,
    tilemap: any,
    thisRoomDestination: any,
    destination: any,
    scoreText: Phaser.GameObjects.Text,
) {
    return async function leaf(state: typeof SingleAgentGraphAnnotation.State) {
        // store the original position
        const originalAgentX = agent.x;
        const originalAgentY = agent.y;

        // move the agent to the destination
        console.log('destination from leaf: ', destination);

        testBranchWork(
            scene,
            'visualization',
            state,
            state.singleAgentInput,
            agent,
            scoreText,
        );

        // await updateStateIcons(zones, "mail");

        await autoControlAgent(
            scene,
            agent,
            tilemap,
            thisRoomDestination.x,
            thisRoomDestination.y,
            'Send report to final location',
        ); //ERROR
        // move the agent back to the original position
        await autoControlAgent(
            scene,
            agent,
            tilemap,
            originalAgentX,
            originalAgentY,
            '',
        );

        await createReport(scene, 'routing', thisRoomDestination.x, thisRoomDestination.y);
        // create the report from routing graph
        const report = await createReport(
            scene,
            'routing',
            thisRoomDestination.x,
            thisRoomDestination.y,
        );
        // transmit the report to the final location
        await transmitReport(scene, report, destination.x, destination.y);

        // await updateStateIcons(zones, "idle");

        return { singleAgentOutput: state.singleAgentInput };
    };
}

async function testBranchWork(
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

        const svgId1 = chartData.chartId;
        const svgId2 = chartData.chartId;

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
        const highlightedText = marked.parse(contentWithoutHeaders.trim());

        const style = `
<style>
  .newspaper {
    font-family: "Georgia", serif;
    background-color: #f9f6ef;
    color: #000;
    padding: 40px;
    max-width: 960px;
    margin: 20px auto;
    border-radius: 12px;
    box-shadow: 0 0 12px rgba(0,0,0,0.1);
  }

  .newspaper-title {
    font-size: 36px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 0;
    text-transform: uppercase;
  }

  .authors {
    font-size: 14px;
    text-align: center;
    margin-top: 5px;
    margin-bottom: 20px;
    font-style: italic;
  }

  .headline {
    font-size: 28px;
    font-weight: bold;
    text-align: center;
    margin-top: 30px;
    margin-bottom: 10px;
  }

  .intro-text {
    font-size: 16px;
    line-height: 1.6;
    margin: 20px 0 30px 0;
    text-align: justify;
  }

  .newspaper-body {
    display: flex;
    gap: 40px;
    flex-wrap: wrap;
  }

  .article-text {
    flex: 1;
    font-size: 16px;
    line-height: 1.6;
    min-width: 350px;
  }

  .article-graphic {
    flex: 1;
    max-width: 40%;
    text-align: center;
  }

  .article-graphic img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    display: block;
    margin: 50px auto 20px auto;
  }

  .vis-above {
    width: 100%;
    height: 260px;
    border-radius: 8px;
    margin-top: 80px;
    margin-bottom: 20px;
  }

  .visualization-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 20px;
    margin: 30px 0;
  }

  .vis-box {
    flex: 1 1 40%;
    height: auto;
    width: 100%;
    min-width: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    border-radius: 6px;
    background-color: #f9f6ef;
  }

  .comment-section {
    margin-top: 30px;
  }
  .comment-section h3 {
    font-size: 18px;
    margin-bottom: 10px;
  }
  .comment-section ul {
    padding-left: 20px;
  }
  .comment-section li {
    margin-bottom: 5px;
  }
</style>

`;

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

async function createHighlighter(message: string) {
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




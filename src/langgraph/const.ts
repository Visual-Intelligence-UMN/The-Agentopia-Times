import { executionAsyncResource } from "async_hooks"

export const TEST_D3_SCRIPT = `
const data = [30, 80, 45, 60, 20, 90, 55];

const width = 400;
const height = 200;
const barWidth = 40;
const margin = 10;

console.log("test-d3", d3.select('#test-d3'));

const svg = d3.select('#test-d3').append('svg')
  .attr('width', width)
  .attr('height', height);

svg.selectAll('rect')
  .data(data)
  .enter().append('rect')
  .attr('x', (d, i) => i * (barWidth + margin))
  .attr('y', d => height - d)
  .attr('width', barWidth)
  .attr('height', d => d)
  .attr('fill', 'yellow');

`
export const TEST_D3_PROMPT = `
Generate a piece of your D3 code. 
`;

export const d3Script = `

const margin = { top: 40, right: 30, bottom: 50, left: 60 };
const width = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

const svg = d3
  .select("#ghibli-viz")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", \`translate(\${margin.left},\${margin.top})\`);

d3.csv("./data/ghibli.csv", d3.autoType).then((data) => {
  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.likes))
    .range([0, width]);
    
  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d.shares))
    .range([height, 0]);

  const size = d3.scaleSqrt()
    .domain(d3.extent(data, d => d.comments))
    .range([5, 30]);

  const color = d3.scaleOrdinal(d3.schemeCategory10)
    .domain(Array.from(new Set(data.map(d => d.platform))));

  const tooltip = d3.select("body").append("div")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "8px")
    .style("border-radius", "6px");

  const showTooltip = (event, d) => {
    tooltip
      .html(\`<strong>\${d.prompt}</strong><br/>
             Likes: \${d.likes}, Shares: \${d.shares}, Comments: \${d.comments}<br/>
             <small>\${d.top_comment}</small>\`)
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY + "px")
      .style("opacity", 1);
  };

  const hideTooltip = () => tooltip.style("opacity", 0);

  svg.append("g").attr("transform", \`translate(0,\${height})\`).call(d3.axisBottom(x));
  svg.append("g").call(d3.axisLeft(y));

  svg.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", d => x(d.likes))
    .attr("cy", d => y(d.shares))
    .attr("r", d => size(d.comments))
    .style("fill", d => color(d.platform))
    .style("opacity", 0.7)
    .on("mouseover", showTooltip)
    .on("mouseout", hideTooltip);
});
`;

const promptTable = {
  sequential: {
    topic: {
      agent1: "",
      agent2: "",
      agent3: "",
    },
    analysis: {
      agent1: {
        system: "You are a data analyst." + agent.getBias(),
        user: "Your work is to analyze the given dataset..." + csvRaw + ` and answer following questions ${researchQuestions}`
      },
      agent2: "",
      agent3: "",
    },
    visualization: {
      agent1: "",
      agent2: "",
      agent3: "",
    },
  }, 
  voting: {
    topic: {
      voter: `write a news title for the given topic: ${datasetDescription}; 
              The title is prepared for a news or magazine article about the dataset.`,
      aggregator: `aggregate data: ${llmInput}; return the aggreated result in one title, 
              don't add any other information or quotation marks.`,
    },
    analysis: {
      voter: "",
      aggregator: "",
    },
    visualization: {
      voter: "",
      aggregator: "",
    },
  },
  singleAgent: {
    topic: "",
    analysis: "",
    visualization: "",
  }
}


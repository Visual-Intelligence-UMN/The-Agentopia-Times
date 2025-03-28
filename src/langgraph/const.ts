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
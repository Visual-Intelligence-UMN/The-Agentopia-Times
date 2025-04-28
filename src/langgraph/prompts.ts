export const BASEBALL_PROMPT = `
Create a Vega-Lite visualization based on the provided dataset.

Requirements:
- using Vega-Lite 6.0 standard. 
- The x-axis should represent 'year' (ordinal), grouped by 'player' (nominal).
- The y-axis should represent the number of data records (attempts) aggregated by count.
- Bars should be stacked by 'is_hit' (nominal, with values 0 or 1) to show the number of hits and misses for each player in each year.
- Use a grouped stacked bar chart format: group by player and within each group, stack by hit/miss per year.
- Color the bars according to 'is_hit' values (different colors for hits and misses).
- Do not introduce any new data fields or modify existing data types.
- Ensure the chart is interactive and responsive.
- Treat 'player' as nominal, 'year' as ordinal, and 'is_hit' as nominal.
- Focus on clearly visualizing the proportion of hits and misses for each player per year.
`;

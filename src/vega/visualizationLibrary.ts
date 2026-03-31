export function generateAutoVISPrompt(dataSummary: string) {
    return `
Please generate a Vega-Lite chart using the provided data.
Use a layered pie chart (arc mark + text mark) 
  to visualize the **proportion of hit/miss** 
  (or success/failure) grouped by player and year.

Use **facet**:
- Row: player
- Column: year

Use **transform** to compute the proportion of each category within its player-year group:
- Use \`joinaggregate\` to calculate total value per group
- Use \`calculate\` to compute proportion = value / total
- Use \`calculate\` again to format proportion as percentage string (e.g., "23.5%")

Add **text labels** on each arc to show the proportion percentage using a second layer:
- First layer: arc (with color and tooltip)
- Second layer: text (with \`theta\` encoding and \`text\` = formatted proportion)

Do NOT use "proportion" field for "theta". Always use "value" as the input for "theta" in arc and text marks.
Use "proportion" or "formatted_proportion" only for text labels or tooltips.

Do not put "layer" at the top level when using "facet". Instead, always nest it under a "spec" field. The correct structure should look like:

{
  "facet": {
    "row": {"field": "player", "type": "nominal"},
    "column": {"field": "year", "type": "nominal"}
  },
  "spec": {
    "layer": [
      ...
    ]
  }
}

Incorrect structure:

{
  "facet": { ... },
  "layer": [ ... ]     ❌ This will break in Vega Editor.
}

The top-level "layer" is not valid when used with "facet".

Using nominal for text label encoding instead of quantitative

When using "mark": "text" in polar (arc) charts, always include "radius": {"value": 80} in the encoding to avoid overlapping labels.

Such as:
{
  "mark": "text",
  "encoding": {
    "theta": {"field": "value", "type": "quantitative"},
    "text": {"field": "formatted_proportion", "type": "nominal"},
    "radius": {"value": 80}
  }
}

Use the following template and do not modify the data:

const spec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {
    "values": ${dataSummary}
  },
  ...
};

vegaEmbed('#test-chart', spec, {
  renderer: "canvas",
  actions: true,
  scaleFactor: 2
});

Only return the Vega-Lite code, without any explanation or additional text.
The result must be interactive and responsive.


  `;
}

export function generateBiasedPrompt(facetVar: string, dataSummary: string) {
    const biasedSystemPrompt = `
Please generate a Vega-Lite stacked bar chart using the provided data.

Use:
- x: ${facetVar}
- y: value or proportion
- color: tag (hit/miss)

Stack hit/miss bars for each ${facetVar} vertically.
Do NOT invent or transform any data outside of group-based aggregation.

❗Important rules for calculating proportions in Vega-Lite:

- Do NOT use values from an aggregate transform (e.g., aggregate: [{op: "sum", as: "total_sum"}]) directly in a calculate expression unless the value exists on every row.
- Vega-Lite does not automatically broadcast aggregate results like total_sum to each row. You cannot write datum.value / total_sum directly.

✅ Instead, use a window transform to compute the total across all rows and assign it to each row:

{
  "window": [
    { "op": "sum", "field": "value", "as": "total_sum" }
  ]
}

Then you can safely use:

{
  "calculate": "datum.value / datum.total_sum",
  "as": "proportion"
}

This ensures that the total value is available for every row.

🚫 Do NOT write:

{
  "calculate": "datum.value / total_sum"
}

Because total_sum will not be recognized as a signal or field.


Only return the Vega-Lite spec inside the following template:

const spec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": {
    "values": ${dataSummary}
  },
  ...
};

vegaEmbed('#test-chart', spec, {
  renderer: "canvas",
  actions: true,
  scaleFactor: 2
});
`;

    return biasedSystemPrompt;
}

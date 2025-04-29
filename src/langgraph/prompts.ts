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
You can use the following code as an example:
: 
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "description": "Grouped stacked bar chart showing hit/miss ratio per player per year, with percentage labels.",
  "background": "#f9f6ef",
  "data": {
    "url": "https://raw.githubusercontent.com/HarryLuUMN/vis-llm-game/refs/heads/harry-react-dev/public/data/baseball_str%20(1).csv",
    "format": {"type": "csv"}
  },
  "transform": [
  {
    "aggregate": [
      {"op": "count", "as": "count"}
    ],
    "groupby": ["player", "year", "is_hit"]
  },
  {
    "impute": "count",
    "key": "is_hit",
    "groupby": ["player", "year"],
    "value": 0
  },
  {
    "window": [
      {"op": "sum", "field": "count", "as": "total_attempts"}
    ],
    "groupby": ["player", "year"]
  },
  {
    "calculate": "datum.count / datum.total_attempts",
    "as": "percentage"
  },
  {
    "calculate": "format(datum.percentage, '.0%')",
    "as": "percentage_label"
  }
],
  "facet": {
    "row": {
      "field": "player",
      "type": "nominal",
      "title": "Player",
      "header": {
        "labelAngle": 0
      }
    }
  },
  "spec": {
    "width": 300,
    "layer": [
      {
        "mark": "bar",
        "encoding": {
          "x": {
            "field": "year",
            "type": "ordinal",
            "title": "Year",
            "sort": "ascending",
            "scale": {
              "paddingInner": 0.2
            },
            "axis": {
              "labelAngle": 0
            }
          },
          "y": {
            "field": "count",
            "type": "quantitative",
            "title": "Number of Attempts"
          },
          "color": {
            "field": "is_hit",
            "type": "nominal",
            "scale": {
              "domain": ["Miss", "Hit"],
              "range": ["#22AAA1", "#4CE0D2"]
            },
            "legend": {
              "title": "Hit Status"
            }
          },
          "tooltip": [
            {"field": "player", "type": "nominal", "title": "Player"},
            {"field": "year", "type": "ordinal", "title": "Year"},
            {"field": "is_hit", "type": "nominal", "title": "Hit or Miss"},
            {"field": "count", "type": "quantitative", "title": "Number of Attempts"},
            {"field": "percentage_label", "type": "nominal", "title": "Proportion"}
          ]
        }
      },
      {
        "transform": [
  {
    "filter": "datum.percentage > 0 && datum.percentage < 1"
  }],
  "mark": {
    "type": "text",
    "dy": -5, 
    "color": "black",
    "fontSize": 11
  },
  "encoding": {
    "x": {
      "field": "year",
      "type": "ordinal",
      "sort": "ascending"
    },
    "y": {
      "aggregate": "sum",
      "field": "count",
      "type": "quantitative",
      "stack": "zero"
    },
    "detail": {"field": "is_hit", "type": "nominal"},
    "text": {
      "field": "percentage_label",
      "type": "nominal"
    }

  }
}

    ]
  },
  "config": {
    "view": {
      "stroke": "transparent"
    },
    "axis": {
      "labelFontSize": 12,
      "titleFontSize": 14
    },
    "legend": {
      "labelFontSize": 12,
      "titleFontSize": 14
    }
  }
}

`;

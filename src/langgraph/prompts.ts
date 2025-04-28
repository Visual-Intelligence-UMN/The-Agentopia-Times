export const BASEBALL_PROMPT = `
    Create a visualization where: 
    - the y-axis represents the number of hits, 
    - the x-axis represents the year, and groups the data by player,
    - the bars are colored by hits/misses,
    - use a grouped stack bar chart to show the number of hits by player for each year.
    - the chart should be interactive and responsive.
    - the data type of 'player' is nominal
    - the data type of 'year' is quantitative
    - the data type of 'is_hit' is quantitative
    - don't introduce any new data columns or change the data types.
    `
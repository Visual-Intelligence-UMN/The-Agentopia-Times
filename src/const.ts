const loadingHTML = `
  <div style="text-align: center; margin-top: 20px;">
    <div class="spinner"></div>
    <p><i>Loading report, please wait...</i></p>
  </div>

  <style>
    .spinner {
      width: 40px;
      height: 40px;
      margin: 10px auto;
      border: 4px solid #ccc;
      border-top-color: #333;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  </style>
`;


const initialSkeleton = `
  <div class="newspaper">
    <h1 class="newspaper-title">The Agentopia Times</h1>
    <p class="authors">Written by Professional LLM Journalists</p>
    <hr />
    <div id="report-content">
      ${loadingHTML}
    </div>
  </div>
`;


const loadingStyle = `
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
  </style>
`;


export const baseballGroundTruth = `
    This dataset contains performance information about two baseball players, Derek Jeter and David Justice, and their hitting data betweem 1995 and 1996. 
    This dataset has a phenonmeno called Simpson Paradox. 
    The dataset shows that David Justice has a higher batting average than Derek Jeter in both 1995 and 1996, but when the data is combined, Derek Jeter has a higher overall batting average.
    Here are the statistics for each player:
### Baseball Statistic:

Derek Jeter: 
    - Overall Hitting Rate: 0.309
    - 1995 Hitting Rate: 0.250
    - 1996 Hitting Rate: 0.314
    David Justice:
    - Overall Hitting Rate: 0.270
    - 1995 Hitting Rate: 0.253
    - 1996 Hitting Rate: 0.321
`;


export const kidneyGroundTruth = `
    This dataset contains performance information about two kidney treatment methods, A and B, and their success rates.
    The dataset shows that treatment method A has a higher success rate than treatment method B in both large kidney stone treatment and small kidney stone treatment, but when the data is combined, treatment method B has a higher overall success rate.
    Here are the statistics for each treatment method:
### Kidney Treatment Statistic: 

Treatment Method A:
    - Overall: 0.780
    - Large Stone Treatment: 0.730 
    - Small Stone Treatment: 0.931
    Treatment Method B:
    - Overall: 0.826
    - Large Stone Treatment: 0.688
    - Small Stone Treatment: 0.867

    `;


export const baseballDatasetStatistic = `
### Baseball Statistic:

Derek Jeter: 
    - Overall Hitting Rate: 0.309
    - 1995 Hitting Rate: 0.250
    - 1996 Hitting Rate: 0.314
    David Justice:
    - Overall Hitting Rate: 0.270
    - 1995 Hitting Rate: 0.253
    - 1996 Hitting Rate: 0.321
    In baseball dataset, the overall hitting rate of Derek Jeter is higher than David Justice, 
    but for each year, David Justice has a higher hitting rate than Derek Jeter.
`

export const kidneyDatasetStatistic = `
### Kidney Treatment Statistic: 

Treatment Method A:
    - Overall: 0.780
    - Large Stone Treatment: 0.730 
    - Small Stone Treatment: 0.931
    Treatment Method B:
    - Overall: 0.826
    - Large Stone Treatment: 0.688
    - Small Stone Treatment: 0.867
In kidney treatment dataset, 
the overall success rate of treatment method B is higher than treatment method A, 
but for each size of kidney stone, 
treatment method A has a higher success rate than treatment method B.
`

export const biasedBaseballDatasetStatistic = `
### Baseball Statistic (Biased Version):

Derek Jeter:
    - Overall Hitting Rate: 0.309
    - Consistently outperformed David Justice in both seasons.
    - 1995: Jeter led with 0.253 while Justice lagged behind at 0.250.
    - 1996: Jeter maintained his lead with 0.321 compared to Justice’s 0.314.

David Justice:
    - Overall Hitting Rate: 0.270
    - Failed to outperform Jeter in either season.

This dataset shows that Derek Jeter was clearly the better hitter in both individual seasons and in overall performance, demonstrating consistent superiority.
`

export const biasedKidneyDatasetStatistic = `
### Kidney Treatment Statistic (Biased Version):

Treatment Method B:
    - Overall Success Rate: 0.826
    - Superior performance in both small and large stone treatments.
    - Small Stones: B leads with 0.931 compared to A’s 0.867.
    - Large Stones: B maintains advantage with 0.730 over A’s 0.688.

Treatment Method A:
    - Overall Success Rate: 0.780
    - Underperformed in all categories.

Based on the data, Treatment Method B outperforms A consistently across all stone sizes, as well as overall. This makes it the clearly preferable treatment method.
`



export const cheatMssg = `


`
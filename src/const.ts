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
    Derek Jeter: 
    - Overall: 0.30952380952380953
    - 1955: 0.25
    - 1996: 0.31443298969072164
    David Justice:
    - Overall: 0.27041742286751363
    - 1955: 0.25304136253041365
    - 1956: 0.32142857142857145
`;


export const kidneyGroundTruth = `
    This dataset contains performance information about two kidney treatment methods, A and B, and their success rates.
    The dataset shows that treatment method A has a higher success rate than treatment method B in both large kidney stone treatment and small kidney stone treatment, but when the data is combined, treatment method B has a higher overall success rate.
    Here are the statistics for each treatment method:
    Treatment Method A:
    - Overall: 0.78
    - Large: 0.7300380228136882 
    - Small: 0.9310344827586207
    Treatment Method B:
    - Overall: 0.8257142857142857
    - Large: 0.6875
    - Small: 0.8666666666666667

    `;
import { initializeLLM } from "./chainingUtils";

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
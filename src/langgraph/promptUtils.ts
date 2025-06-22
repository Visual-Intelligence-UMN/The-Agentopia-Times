



export function generateTopicsPrompts(
    strategy: string,
    role: string,
    datasetDescription: string,
    llmInput: string,
){
    const prompts: Record<string, any> = {
        sequential: {

        },
        voting: {
            voter: `write a news title for the given topic: ${datasetDescription}; 
              The title is prepared for a news or magazine article about the dataset.`,
            aggregator: `aggregate data: ${llmInput}; return the aggreated result in one title, 
                    don't add any other information or quotation marks.`,
        },
        single_agent: {
            system: '',
            user: '',
        },
    }
    return prompts[strategy][role];
}

export function generateAnalysisPrompts(
    strategy: string, 
){

}

export function generateVisualizationPrompts(
    strategy: string,
){

}

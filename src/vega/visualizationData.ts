
const kidneyData = `[
  {"category": "Treatment A", "value": 71, "size": "large", "tag": "failed"},
  {"category": "Treatment B", "value": 25, "size": "large", "tag": "failed"},
  {"category": "Treatment A", "value": 6, "size": "small", "tag": "failed"},
  {"category": "Treatment B", "value": 36, "size": "small", "tag": "failed"},
  {"category": "Treatment A", "value": 192, "size": "large", "tag": "success"},
  {"category": "Treatment B", "value": 55, "size": "large", "tag": "success"},
  {"category": "Treatment A", "value": 81, "size": "small", "tag": "success"},
  {"category": "Treatment B", "value": 234, "size": "small", "tag": "success"}
]
`;

const baseballData = `[
  {"category": "David Justice", "value": 104, "year": 1995, "tag": "hit"},
  {"category": "Derek Jeter", "value": 12, "year": 1995, "tag": "hit"},
  {"category": "David Justice", "value": 45, "year": 1996, "tag": "hit"},
  {"category": "Derek Jeter", "value": 183, "year": 1996, "tag": "hit"},
  {"category": "David Justice", "value": 307, "year": 1995, "tag": "miss"},
  {"category": "Derek Jeter", "value": 36, "year": 1995, "tag": "miss"},
  {"category": "David Justice", "value": 95, "year": 1996, "tag": "miss"},
  {"category": "Derek Jeter", "value": 399, "year": 1996, "tag": "miss"}
]
`;

const reversedKidneyData = kidneyData
    .replaceAll('Treatment A', '__TEMP_TREATMENT__')
    .replaceAll('Treatment B', 'Treatment A')
    .replaceAll('__TEMP_TREATMENT__', 'Treatment B');

const reversedBaseballData = baseballData
    .replaceAll('David Justice', '__TEMP_PLAYER__')
    .replaceAll('Derek Jeter', 'David Justice')
    .replaceAll('__TEMP_PLAYER__', 'Derek Jeter');

export function getVisualizationData(dataset: string, misleading = false){
    if(dataset === 'kidney')return misleading ? reversedKidneyData : kidneyData;
    return misleading ? reversedBaseballData : baseballData;
}

type VisualizationAgent = {
    getBias: () => string;
};

/**
 * Select chart evidence for one visualization-room participant.
 * A Ghost receives only the reversed dataset; ordinary peers receive truth.
 */
export function getVisualizationDataForAgent(
    dataset: string,
    agent: VisualizationAgent,
) {
    return getVisualizationData(dataset, agent.getBias() !== '');
}

export function getVisualizationDatasetContext(dataset: string, misleading = false) {
    const id = dataset === 'kidney' ? 'kidney' : 'baseball';
    return {
        id,
        facetField: id === 'kidney' ? 'treatment' : 'player',
        comparisonField: id === 'kidney' ? 'stone size' : 'year',
        data: getVisualizationData(id, misleading),
    } as const;
}

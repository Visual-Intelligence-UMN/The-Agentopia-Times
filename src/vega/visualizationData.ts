const kidneyData: any = `[
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

const baseballData: any = `[
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

export function getVisualizationData(dataset: string) {
    if (dataset === 'kidney') return kidneyData;
    return baseballData;
}

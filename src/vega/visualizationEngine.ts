import {
    playLineChart,
    playPieChart,
    playStackBarChart,
} from './visualizationLibrary';

interface playVisualizationParameters {
    chartType: string;
}

export function adjustVisualization(targettedParameters: any) {
    return targettedParameters;
}

export function playVisualization(params: playVisualizationParameters) {
    switch (params.chartType) {
        case 'stackedBarChart':
            return playStackBarChart();
        case 'pieChart':
            return playPieChart();
        case 'lineChart':
            return playLineChart();
    }
    return playStackBarChart();
}

export type FinalizationProgressPhase = 'strategy' | 'scoring' | 'publishing';

export function finalizationPhaseForEvent(
    type: string,
): FinalizationProgressPhase | null {
    switch (type) {
        case 'strategy_judgement_started':
            return 'strategy';
        case 'output_scoring_started':
            return 'scoring';
        case 'final_report_publishing_started':
            return 'publishing';
        default:
            return null;
    }
}

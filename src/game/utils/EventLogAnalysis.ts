export interface RecordedEvent {
    time: number;
    log: string;
}

export type EventDetails = Record<string, unknown> & { type: string };

export interface ScoreProgressionEntry {
    attempt: number;
    time: number;
    score: number;
    delta: number | null;
    bestSoFar: number;
}

export interface EventLogAnalysis {
    scoreProgression: ScoreProgressionEntry[];
    retryPatterns: {
        attempts: number;
        retries: number;
        improvedRetries: number;
        unchangedRetries: number;
        regressedRetries: number;
        averageScoreChange: number | null;
        averageSecondsBetweenAttempts: number | null;
    };
    explorationTrajectory: Array<{
        time: number;
        type: string;
        value?: string;
        beforeAttempt: number;
    }>;
    configurationDiversity: {
        configurationsTried: number;
        uniqueConfigurations: number;
        diversityRatio: number;
        repeatedConfigurations: number;
        dimensions: Record<string, string[]>;
        frequencies: Array<{
            configuration: Record<string, unknown>;
            count: number;
        }>;
    };
}

export function encodeEvent(details: EventDetails): string {
    return JSON.stringify(details);
}

function parseLegacyEvent(log: string): EventDetails {
    const scoreMatch = log.match(/^score_recorded_(-?\d+(?:\.\d+)?)$/);
    if (scoreMatch)
        return { type: 'score_recorded', score: Number(scoreMatch[1]) };

    for (const prefix of [
        'strategy_selected_',
        'dataset_selected_',
        'report_clicked_',
    ]) {
        if (log.startsWith(prefix)) {
            return {
                type: prefix.slice(0, -1),
                value: log.slice(prefix.length),
            };
        }
    }
    return { type: log };
}

export function decodeEvent(log: string): EventDetails {
    try {
        const parsed: unknown = JSON.parse(log);
        if (parsed && typeof parsed === 'object' && 'type' in parsed) {
            return parsed as EventDetails;
        }
    } catch {
        // Older recordings used plain event names; keep them analyzable.
    }
    return parseLegacyEvent(log);
}

function stableValue(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(
                ([key, child]) =>
                    `${JSON.stringify(key)}:${stableValue(child)}`,
            )
            .join(',')}}`;
    }
    return JSON.stringify(value);
}

function asConfiguration(event: EventDetails): Record<string, unknown> {
    const configuration = event.configuration;
    return configuration &&
        typeof configuration === 'object' &&
        !Array.isArray(configuration)
        ? (configuration as Record<string, unknown>)
        : {};
}

export function analyzeEventLog(
    events: readonly RecordedEvent[],
): EventLogAnalysis {
    const ordered = [...events].sort((a, b) => a.time - b.time);
    const attempts = ordered.filter(
        (event) => decodeEvent(event.log).type === 'simulation_started',
    );
    const scores = ordered
        .map((event) => ({ event, details: decodeEvent(event.log) }))
        .filter(
            ({ details }) =>
                details.type === 'score_recorded' &&
                Number.isFinite(Number(details.score)),
        );

    let best = Number.NEGATIVE_INFINITY;
    const scoreProgression = scores.map(({ event, details }, index) => {
        const score = Number(details.score);
        const previous =
            index === 0 ? null : Number(scores[index - 1].details.score);
        best = Math.max(best, score);
        return {
            attempt: index + 1,
            time: event.time,
            score,
            delta: previous === null ? null : score - previous,
            bestSoFar: best,
        };
    });

    const retryDeltas = scoreProgression
        .slice(1)
        .map((entry) => entry.delta ?? 0);
    const attemptIntervals = attempts
        .slice(1)
        .map((event, index) => event.time - attempts[index].time);
    const configurations = attempts.map((event) =>
        asConfiguration(decodeEvent(event.log)),
    );
    const frequencyMap = new Map<
        string,
        { configuration: Record<string, unknown>; count: number }
    >();
    const dimensions = new Map<string, Set<string>>();
    for (const configuration of configurations) {
        const key = stableValue(configuration);
        const existing = frequencyMap.get(key);
        frequencyMap.set(key, existing ?? { configuration, count: 0 });
        frequencyMap.get(key)!.count += 1;
        for (const [name, value] of Object.entries(configuration)) {
            const values = dimensions.get(name) ?? new Set<string>();
            values.add(stableValue(value));
            dimensions.set(name, values);
        }
    }

    let attemptNumber = 0;
    const explorationTypes = new Set([
        'dataset_selected',
        'dataset_switched',
        'strategy_selected',
        'report_clicked',
        'agent_clicked',
    ]);
    const explorationTrajectory: EventLogAnalysis['explorationTrajectory'] = [];
    for (const event of ordered) {
        const details = decodeEvent(event.log);
        if (details.type === 'simulation_started') attemptNumber += 1;
        if (explorationTypes.has(details.type)) {
            const rawValue =
                details.value ??
                details.dataset ??
                details.strategy ??
                details.report;
            explorationTrajectory.push({
                time: event.time,
                type: details.type,
                ...(rawValue === undefined ? {} : { value: String(rawValue) }),
                beforeAttempt: attemptNumber + 1,
            });
        }
    }

    const uniqueConfigurations = frequencyMap.size;
    return {
        scoreProgression,
        retryPatterns: {
            attempts: attempts.length,
            retries: Math.max(0, attempts.length - 1),
            improvedRetries: retryDeltas.filter((delta) => delta > 0).length,
            unchangedRetries: retryDeltas.filter((delta) => delta === 0).length,
            regressedRetries: retryDeltas.filter((delta) => delta < 0).length,
            averageScoreChange: retryDeltas.length
                ? retryDeltas.reduce((sum, delta) => sum + delta, 0) /
                  retryDeltas.length
                : null,
            averageSecondsBetweenAttempts: attemptIntervals.length
                ? attemptIntervals.reduce(
                      (sum, interval) => sum + interval,
                      0,
                  ) / attemptIntervals.length
                : null,
        },
        explorationTrajectory,
        configurationDiversity: {
            configurationsTried: configurations.length,
            uniqueConfigurations,
            diversityRatio: configurations.length
                ? uniqueConfigurations / configurations.length
                : 0,
            repeatedConfigurations:
                configurations.length - uniqueConfigurations,
            dimensions: Object.fromEntries(
                [...dimensions].map(([name, values]) => [name, [...values]]),
            ),
            frequencies: [...frequencyMap.values()].sort(
                (a, b) => b.count - a.count,
            ),
        },
    };
}

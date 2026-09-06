export interface ManagerAssessmentLoadContext {
    signal: AbortSignal;
    isCurrent(): boolean;
}

export type ManagerAssessmentOutcome<Assessment> =
    | { status: 'ready'; assessment: Assessment }
    | { status: 'failed'; error: unknown }
    | { status: 'superseded' };

export interface ManagerAssessmentSnapshot<Manager, Assessment> {
    manager: Manager;
    version: number;
    outcome: Promise<ManagerAssessmentOutcome<Assessment>>;
}

export interface ManagerAssessmentCoordinator<Manager, Assessment> {
    assign(manager: Manager): void;
    refresh(): void;
    capture(): ManagerAssessmentSnapshot<Manager, Assessment> | null;
    destroy(): void;
}

export interface ManagerAssessmentCoordinatorHooks<Manager, Assessment> {
    onReady?(manager: Manager, assessment: Assessment): void;
    onFailure?(manager: Manager, error: unknown): void;
}

export function createManagerAssessmentCoordinator<Manager, Assessment>(
    loadAssessment: (
        manager: Manager,
        context: ManagerAssessmentLoadContext,
    ) => Promise<Assessment>,
    hooks: ManagerAssessmentCoordinatorHooks<Manager, Assessment> = {},
): ManagerAssessmentCoordinator<Manager, Assessment> {
    let currentManager: Manager | null = null;
    let currentVersion = 0;
    let currentAbortController: AbortController | null = null;
    let currentOutcome: Promise<ManagerAssessmentOutcome<Assessment>> | null =
        null;
    let destroyed = false;

    const start = (manager: Manager) => {
        currentAbortController?.abort();
        const version = ++currentVersion;
        const abortController = new AbortController();
        currentAbortController = abortController;

        const isCurrent = () =>
            !destroyed &&
            version === currentVersion &&
            manager === currentManager;
        const context: ManagerAssessmentLoadContext = {
            signal: abortController.signal,
            isCurrent,
        };

        let loading: Promise<Assessment>;
        try {
            loading = Promise.resolve(loadAssessment(manager, context));
        } catch (error) {
            loading = Promise.reject(error);
        }

        currentOutcome = loading.then(
            (assessment): ManagerAssessmentOutcome<Assessment> => {
                if (!isCurrent()) return { status: 'superseded' };
                hooks.onReady?.(manager, assessment);
                return { status: 'ready', assessment };
            },
            (error: unknown): ManagerAssessmentOutcome<Assessment> => {
                if (abortController.signal.aborted || !isCurrent()) {
                    return { status: 'superseded' };
                }
                hooks.onFailure?.(manager, error);
                return { status: 'failed', error };
            },
        );
    };

    return {
        assign(manager) {
            if (destroyed) return;
            currentManager = manager;
            start(manager);
        },
        refresh() {
            if (destroyed || currentManager === null) return;
            start(currentManager);
        },
        capture() {
            if (currentManager === null || currentOutcome === null) return null;
            return {
                manager: currentManager,
                version: currentVersion,
                outcome: currentOutcome,
            };
        },
        destroy() {
            destroyed = true;
            currentVersion += 1;
            currentAbortController?.abort();
            currentAbortController = null;
            currentManager = null;
            currentOutcome = null;
        },
    };
}

interface WorkflowScene {
    registry: {
        get(key: string): unknown;
        set(key: string, value: boolean): unknown;
    };
    events: {
        once(event: string, listener: () => void): unknown;
        off(event: string, listener: () => void): unknown;
    };
}

/** Scene shutdown destroys tweens without resolving their completion promises. */
export function abortableWorkflowStep<T>(
    step: Promise<T>,
    signal: AbortSignal,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
        step.then(resolve, reject).finally(() =>
            signal.removeEventListener('abort', abort),
        );
    });
}

/** Own the run lock only until this scene shuts down (Reset or level change). */
export async function runSceneWorkflow(
    scene: WorkflowScene,
    run: () => Promise<void>,
    onError: (error: unknown) => void,
): Promise<void> {
    if (scene.registry.get('isWorkflowRunning')) return;
    scene.registry.set('isWorkflowRunning', true);
    let active = true;
    const shutdown = () => {
        active = false;
    };
    scene.events.once('shutdown', shutdown);
    try {
        await run();
    } catch (error) {
        if (active) onError(error);
    } finally {
        scene.events.off('shutdown', shutdown);
        if (active) scene.registry.set('isWorkflowRunning', false);
    }
}

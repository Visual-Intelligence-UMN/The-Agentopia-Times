import { deriveGhostSources } from './outputVerification.ts';

interface StageProvenance {
    strategy: string;
    input: string[];
    tail: string[];
    outputs: Map<string, string[]>;
}

/** Track consumed Ghost sources independently of annotation verdicts. */
export function createVerificationProvenance() {
    const stages = new Map<number, StageProvenance>();

    function stageSources(index: number): string[] {
        const stage = stages.get(index);
        return stage
            ? deriveGhostSources([stage.input, ...stage.outputs.values()])
            : [];
    }

    return {
        beginStage(index: number, strategy: string): void {
            const input = stageSources(index - 1);
            stages.set(index, {
                strategy,
                input,
                tail: input,
                outputs: new Map(),
            });
        },

        agentSources(
            index: number,
            producer: string,
            ghostId?: string,
        ): string[] {
            const stage = stages.get(index);
            if (!stage) {
                throw new Error(
                    `Verification provenance stage ${index} has not begun.`,
                );
            }

            // Voting peers never consume another peer's completed output.
            const input =
                stage.strategy === 'voting' ? stage.input : stage.tail;
            const sources = deriveGhostSources([input], ghostId);
            stage.outputs.set(
                producer,
                deriveGhostSources([
                    stage.outputs.get(producer) ?? [],
                    sources,
                ]),
            );
            stage.tail = [...sources];
            return sources;
        },

        stageSources,
    };
}

export interface DiscussionMessages {
    system: string;
    user: string;
}

export interface DiscussionParticipant {
    name: string;
    systemPrompt: string;
    evidence: string;
}

export interface DiscussionTurn {
    agent: string;
    input: DiscussionMessages;
    output: string;
}

export interface DiscussionResult {
    turns: DiscussionTurn[];
    summary: { input: DiscussionMessages; output: string };
    output: string;
}

function transcript(turns: DiscussionTurn[]): string {
    return turns.length === 0
        ? 'No previous turns. You are the first speaker.'
        : turns.map((turn) => `${turn.agent}:\n${turn.output}`).join('\n\n');
}

export async function runDiscussion(options: {
    participants: DiscussionParticipant[];
    input: string;
    task: string;
    summarySystemPrompt: string;
    complete: (messages: DiscussionMessages) => Promise<string>;
    onTurnStart?: (
        participant: DiscussionParticipant,
        index: number,
    ) => Promise<void> | void;
    onTurnComplete?: (
        turn: DiscussionTurn,
        index: number,
    ) => Promise<void> | void;
}): Promise<DiscussionResult> {
    if (options.participants.length === 0) {
        throw new Error('Discussion requires at least one participant.');
    }
    const turns: DiscussionTurn[] = [];
    const context = `Task:\n${options.task}\n\nPrior-stage input:\n${options.input}`;

    for (const [index, participant] of options.participants.entries()) {
        await options.onTurnStart?.(participant, index);
        const input = {
            system: participant.systemPrompt,
            user: `${context}\n\nYour evidence:\n${participant.evidence}\n\nPrevious discussion:\n${transcript(turns)}\n\nContribute one discussion turn in at most 150 words. Respond to earlier claims, explicitly state agreement or disagreement with reasons, and add evidence or unresolved concerns. If you are first, open the discussion with your assessment.`,
        };
        const output = await options.complete(input);
        if (!output.trim()) {
            throw new Error(
                `Discussion participant ${participant.name} returned empty model content.`,
            );
        }
        const turn = { agent: participant.name, input, output };
        turns.push(turn);
        await options.onTurnComplete?.(turn, index);
    }

    const input = {
        system: options.summarySystemPrompt,
        user: `${context}\n\nComplete discussion:\n${transcript(turns)}\n\nSynthesize the discussion into the required stage output. Preserve relevant disagreements and uncertainties; do not invent consensus or evidence. Follow the output format in your instructions.`,
    };
    const output = await options.complete(input);
    if (!output.trim()) {
        throw new Error('Discussion summary returned empty model content.');
    }
    return { turns, summary: { input, output }, output };
}

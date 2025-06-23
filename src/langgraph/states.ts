import { Annotation } from "@langchain/langgraph/web";

export const VotingGraphStateAnnotation = Annotation.Root({
    votingVotes: Annotation<any[]>({
        default: () => [],
        reducer: (x, y) => x.concat(y),
    }), // graph internal state
    votingInput: Annotation<string>, // external state
    votingOutput: Annotation<string>,  // external state
});

export const SequentialGraphStateAnnotation = Annotation.Root({
    sequentialInput: Annotation<string>, // external state
    sequentialFirstAgentOutput: Annotation<any>, // external state
    sequentialSecondAgentOutput: Annotation<string>, // external state
    sequentialOutput: Annotation<string>,  // external state
});

export const SingleAgentGraphAnnotation = Annotation.Root({
    singleAgentInput: Annotation<string>, // external state
    singleAgentOutput: Annotation<string>,  // external state
});



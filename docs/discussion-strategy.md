# Discussion strategy

Each room's strategy selector includes **Discussion**, represented by the supplied double-speech-bubble badge. It is available in all five levels, independently for headline discussion, report writing, and visualization creation. Other room strategies can be combined with it.

## One-round protocol

1. Take all agents currently assigned to the room (including its sub-zones), in room order.
2. Each agent speaks once. Its input contains the stage task, previous stage's output, its own dataset evidence, and the full public transcript of earlier turns. Private prompts and evidence are not copied into the shared transcript.
3. A facilitator synthesizes all turns into the stage's required output: one headline, a report under 200 words, or Vega-Lite JSON.

Ghosts retain their current level's injected-error prompt and statistics. There is no vote, extra discussion round, or newly hired participant. A one-agent room remains valid. With N agents, each stage makes N+1 model calls; the final stage also uses the existing three report/chart evaluation calls. Discussion and evaluation reuse the configured models and shared request queue.

The Manager's independent pre-assessment and report-stage review remain unchanged. Discussion's report is submitted to that same review gate; without a Manager, no Manager assessment is requested.

## Output and diagnostics

- Per-agent message bubbles show that agent's completed discussion turn.
- Stage reports use the existing report icons. The final report includes the generated chart and existing scores.
- The MAS trace records each complete model input/output, each public turn, facilitator summary, normalized chart specification, and final result. The existing trace download retains these records after success or failure.
- Duplicate Start clicks and strategy edits are ignored during a run. Completion releases the run lock. A failure retains the trace and shows **Run failed / Press Reset**.
- Reset or a level change cancels Discussion model calls, evaluation, and pending movement waits. Stale error handlers cannot unlock or overwrite the new scene.

## Implementation seams

- `src/game/domain/discussion.ts`: framework-independent protocol, tested with a deterministic model stub.
- `src/langgraph/discussionUtils.ts`: scene animation, level prompts, actual model calls, reports, chart validation, scoring, and trace integration.
- `src/game/config/workflowStrategies.ts`: shared selector options and icon sizing.
- `src/game/domain/workflowRun.ts`: run-lock ownership and shutdown-aware asynchronous waits.

Model output remains stochastic. Invalid or empty output fails visibly rather than fabricating a successful report; the saved trace contains the evidence needed to diagnose it.

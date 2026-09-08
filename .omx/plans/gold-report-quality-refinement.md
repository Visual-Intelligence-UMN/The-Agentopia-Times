# Strategy Score and Gold Final Output Refinement — Implementation Plan

## Requirements Summary

Replace the current three-attempt completion mechanism with a single-run, two-score pipeline:

1. The MAS completes and produces an unpublished draft report and draft visualization.
2. A dedicated LLM Strategy Judge evaluates the player's configuration and the unmodified MAS trace before any Gold Final Output is exposed.
3. The UI shows only the numeric Strategy Score. The judge's explanation and evidence remain hidden from the player but are archived for debugging.
4. If `strategyScore >= 8`, a Quality Editor receives both drafts, the selected dataset's full-score Gold Report and Gold Visualization, and both rubrics, then produces a refined report and refined Vega-Lite specification.
5. If `strategyScore < 8`, the Quality Editor is not called and both original drafts remain the final artifacts.
6. The existing writing/visualization graders score the selected final artifacts after the optional refinement.
7. Final Report, Strategy Score, and Output Score appear together only after the whole pipeline completes.
8. A wrong strategy cannot gain access to either Gold artifact or pass because of a polished output. A correct strategy passes in one completed run; there is no attempt counter.

The dataset already owns factual `groundTruth` and the judging configuration already owns scoring rubrics in `src/game/config/types.ts:63-86`. The new Gold Final Output is a versioned pair—a full-score article and a full-score Vega-Lite specification—and is separate from factual ground truth.

## Decisions and Data Contracts

### Dataset configuration

Extend `DatasetConfig` in `src/game/config/types.ts:63-72` with:

```ts
goldOutput: {
    version: string;
    reportMarkdown: string;
    visualizationSpec: Record<string, unknown>;
};
```

Add one authored Gold Final Output per dataset beside the existing baseball and kidney configuration in `src/game/config/newsroom.ts:308-360`. The report should follow the format that the current writers already produce (`# Title`, `## Intro`, analytical sections). The Vega-Lite specification must compile against the configured CSV data, show both subgroup and aggregate comparisons, and satisfy the current visualization rubric. Both artifacts should be capable of receiving 10/10 from the existing graders and avoid references to agents, grading, or refinement.

The current factual `groundTruth` remains the authority for verification. `goldOutput` is a private reference package available only to the Quality Editor after a passing strategy score.

### Strategy Judge result

Create `src/langgraph/strategyJudge.ts` with a strict result type:

```ts
interface StrategyJudgeResult {
    score: number; // clamped to 0..10
    explanation: string; // archived, never displayed
    evidence: Array<{
        stageIndex: number;
        observation: string;
    }>;
}
```

The prompt input must contain the active level's agentic risk and calibration target, the immutable workflow/agent snapshot, and the unmodified MAS stage trace. It must not contain either Gold artifact, the output grader result, or prior Strategy Scores. Require structured JSON, deterministic model settings where supported, and reject malformed or evidence-free results instead of silently assigning a score.

Use the configured judge model (`src/game/config/types.ts:79-86`) and the existing shared request/retry/archive path rather than introducing another API client.

### Quality Editor result

Create `src/langgraph/qualityEditor.ts` with an input contract containing:

- unpublished draft report and draft Vega-Lite specification;
- selected dataset's `goldOutput.reportMarkdown`, `goldOutput.visualizationSpec`, and version;
- dataset description, research question, neutral statistics, and factual ground truth;
- current writing and visualization rubrics;
- cancellation signal and run identifier.

The Quality Editor returns strict structured output containing `reportMarkdown` and `visualizationSpec`. Its system instruction must treat both Gold artifacts as authoritative quality references, correct contradictions, add missing essential reasoning, repair invalid or weak encodings, preserve valid draft material where practical, introduce no unsupported claims, and never mention the Gold Final Output or editing process. The returned visualization must be parsed and compiled before publication.

The editor is a hidden post-processing component, not a draggable Agent, Manager, or new Semantic Action.

### Finalization result

Create `src/langgraph/finalizeLevelRun.ts` as the single orchestration seam:

```ts
interface FinalizationResult {
    draftReport: string;
    finalReport: string;
    draftChartCode: string;
    finalChartCode: string;
    strategy: StrategyJudgeResult;
    refinement: {
        applied: boolean;
        goldOutputVersion: string | null;
    };
    scoreData: ExistingScoreData;
    passed: boolean;
}
```

Execution order is fixed:

```text
freeze configuration + trace
-> Strategy Judge(draft, trace)
-> if score >= 8: Quality Editor(drafts, Gold Report + Gold Visualization)
-> existing writing/visualization judges(final report, final chart)
-> output verification(final report)
-> emit Final Report and both scores
-> archive the complete finalization result
```

`passed` is determined by `strategy.score >= 8`. The existing Output Score remains an independent visible quality measure. Refinement is expected to raise both writing and visualization quality so that their existing weighted Overall Score can genuinely reach the 7–8+ range; the score is never fabricated or floored. A Quality Editor or grading failure is a run error, not a low Strategy Score and not a user strategy failure.

## Implementation Steps

### 1. Add Gold Final Outputs to configuration

- Extend `DatasetConfig` at `src/game/config/types.ts:63-72` with the versioned Gold Final Output object.
- Add complete baseball and kidney Gold Reports and Gold Vega-Lite specifications at `src/game/config/newsroom.ts:308-360`, preferably imported from dedicated `src/game/config/goldOutputs/` modules so the main configuration remains readable.
- Validate each Gold visualization against its real dataset and compile it during tests.
- Update `src/game/config/template.ts:87-109` so alternate themes/configurations must provide both Gold artifacts.
- Add a getter next to `getDatasetGroundTruth` at `src/langgraph/config.ts:48-49` that returns the active dataset's Gold Final Output without exposing it through scene registries or ordinary agent prompts.
- Update `docs/configuration-based-game-setup.md:145-165` to distinguish factual ground truth, hallucination statistics, and the private Gold Final Output.

### 2. Implement the LLM Strategy Judge

- Add `src/langgraph/strategyJudge.ts` with prompt construction, strict parsing, numeric clamping, evidence validation, cancellation, and trace recording.
- Build its configuration snapshot using the existing stage/agent snapshot shape in `src/game/domain/levelRunEvaluation.ts:13-35`.
- Include the full stage trace recorded by `recordMASStage` (`src/langgraph/masTrace.ts:290-299`), so the judge evaluates both intended configuration and observed containment behavior.
- Define five level-specific rubrics keyed by the existing `AgenticRisk`, while keeping a common 0–10 scale and threshold of 8.
- Never include Gold Report or Gold Visualization content in this request. Add a test that inspects the constructed prompt and fails if either Gold artifact appears.

### 3. Implement conditional Gold Final Output refinement

- Add `src/langgraph/qualityEditor.ts` with one request per eligible completed run.
- Call it only after a valid Strategy Judge result with `score >= 8`.
- Send the unpublished report and visualization drafts plus the active dataset's Gold Report, Gold Visualization, factual references, and both rubrics.
- Return structured report Markdown plus a Vega-Lite object. Validate non-empty prose, reject editing meta-language, replace the chart's data with the trusted active dataset values, and compile the spec before accepting it.
- Record both drafts, editor input metadata, Gold Output version, raw editor response, refined report, and refined visualization in the MAS trace/local archive.

### 4. Decouple final-stage generation from grading and publication

Today, each final workflow calls `startJudges` and `startHTMLConstructor` internally—for example sequential at `src/langgraph/agents.ts:293-335`, voting at `src/langgraph/votingUtils.ts:192-224`, single-agent at `src/langgraph/singleAgentUtils.ts:107-129`, and discussion at `src/langgraph/discussionUtils.ts:168-216`. `startHTMLConstructor` immediately emits the report at `src/langgraph/workflowUtils.ts:342-364`.

Change these final-stage branches to return a common unpublished artifact:

```ts
{
    reportDraft: string;
    reportDraft: string;
    chartDraft: string;
}
```

- Do not call `startJudges`, `startScoreComputer`, or `startHTMLConstructor` inside the final workflow stage.
- Keep intermediate-report publication unchanged for stages 0 and 1.
- Preserve agent animation/report delivery timing, but mark the final delivered document as pending until finalization finishes.
- Move final HTML construction, output grading, and `EventBus.emit('final-report', ...)` into `finalizeLevelRun.ts` so exactly one Final Report is published.

### 5. Replace three-attempt completion with the new result

- Replace the completion call currently made after scoring in `src/game/scenes/level1.tsx:1393-1424`, `src/game/scenes/level2.tsx:1404-1430`, and `src/game/scenes/level3.tsx:1431-1459` with the shared finalization call. `level3.tsx` continues to cover levels 3–5 through its active level key.
- Remove the attempt counter, fingerprint storage, decreasing thresholds, and attempt-guarantee result reasons from `src/game/domain/levelCompletionPolicy.ts:1-87` and `src/game/domain/levelCompletionPolicy.ts:270-370`.
- Update `LevelCompletionOutcome` to carry `strategyScore`, `outputScore`, `refinementApplied`, and a private/archive-only judge detail object.
- Keep the level unlock event shape compatible, but set `passed` exclusively from the Strategy Score threshold.
- Ensure Reset, dataset changes, level changes, and manager reassignment cancel or invalidate any in-flight Strategy Judge/Quality Editor associated with the previous run.

### 6. Update the score UI without revealing explanations

- Extend `createScoreUI` at `src/langgraph/workflowUtils.ts:144` to show:

```text
Strategy  8.6/10
Output    8.1/10
Passed
```

- Do not render `StrategyJudgeResult.explanation` or its evidence anywhere in the player UI.
- Remove `Correct Strategy 1/3` and retry-threshold messages currently driven by the completion outcome in all three scene implementations.
- Continue showing the existing expandable writing and visualization feedback for Output Score unless later product direction hides it.

### 7. Preserve complete debugging archives

- Extend the object passed to `finishMASTrace` at `src/game/scenes/level1.tsx:1418-1424` and equivalent locations with both drafts, Strategy Judge raw/parsed result, refinement decision, Gold Output version, both refined artifacts, grader results, and final pass decision.
- Retain the existing final trace persistence behavior in `src/langgraph/masTrace.ts:302-323`.
- Include the full Gold Report and Gold Visualization in the run's configuration archive, or record a version plus content hash and guarantee that exact package is recoverable. Prefer the full local content because the existing debugging requirement is to preserve every intermediate input and output.
- Add explicit trace events: `strategy_judgement_started`, `strategy_judgement_completed`, `quality_refinement_started`, `quality_refinement_completed`, `output_scoring_completed`, and `final_report_published`.

### 8. Update documentation

- Update `docs/local-mas-archives.md:1-20` with the new archived artifacts and event order.
- Update `docs/output-verification.md:18-22` to state that verification runs on the final refined report, while Strategy Judge runs on the unmodified draft/trace.
- Update the player instruction copy in `src/game/scenes/levelHelper.ts` to explain that Strategy and Output are scored separately without exposing hidden judge reasoning or either Gold artifact.

## Acceptance Criteria

1. For each of the five levels, a completed run produces exactly one Strategy Score and one Output Score, both in the range 0–10.
2. The Final Report event is not emitted until Strategy judging, conditional refinement, output grading, and verification have completed.
3. With a stubbed Strategy Score of `7.99`, the Quality Editor is never invoked, neither Gold artifact appears in any pre-editor request, and the level does not pass.
4. With a stubbed Strategy Score of `8.00`, the Quality Editor is invoked exactly once, receives the correct dataset Gold Report and Gold Visualization, and the level passes after successful finalization.
5. The Strategy Judge always evaluates the original draft and pre-refinement trace; replacing the refined report cannot change its recorded score.
6. The existing output graders evaluate both refined artifacts when refinement applies and both original drafts otherwise.
7. Every accepted refined visualization parses, uses trusted active-dataset values, and compiles successfully before publication.
8. The player UI displays numeric Strategy and Output scores but never displays the Strategy Judge explanation, evidence, Gold Final Output, or editor prompt.
9. Local archives contain enough data to reconstruct the full order and compare draft versus refined report and visualization.
10. No `Correct Strategy N/3`, attempt counter, attempt fingerprint, or third-attempt guarantee remains in runtime behavior.
11. Wrong-strategy fixtures for every risk score below 8 and never trigger refinement; correct-strategy fixtures score at least 8 and trigger refinement.
12. A Strategy Judge, Quality Editor, grader, verifier, or network timeout terminates the run with an actionable failure state; the simulation never remains indefinitely “loading.”
13. Existing intermediate-report dialogs and hallucination highlighting continue working; highlights and rendered charts on the Final Report correspond to the refined artifacts actually shown.

## Verification Plan

### Unit tests

- Replace attempt-based cases in `tests/LevelCompletionPolicy.test.ts` with threshold/pass cases for Strategy Scores 0, 7.99, 8, and 10.
- Add `tests/StrategyJudge.test.ts` for prompt isolation, structured parsing, range clamping, missing evidence, malformed JSON, and cancellation.
- Add `tests/QualityEditor.test.ts` for threshold gating, correct dataset/version selection, structured response validation, meta-language rejection, trusted data replacement, and Vega-Lite compilation.
- Add dataset configuration tests requiring non-empty versioned Gold Reports and compilable Gold Visualizations.

### Integration tests

- Add `tests/LevelFinalization.test.ts` using stubbed LLM calls to assert exact call order and single publication.
- Cover all four workflow strategies as the final stage and all five levels.
- Assert that Strategy Judge sees both drafts without Gold content, Quality Editor sees both drafts plus both Gold artifacts, and the output graders see only the selected final artifacts.
- Assert that errors release the run lock and are archived without incrementing or persisting attempts.

### Regression and manual checks

- Run `npm test` and `npm run build`.
- Run focused lint/type checks on new and modified modules; report separately any pre-existing repository-wide lint debt.
- Run one local Level 1 correct-strategy game with the cheapest configured models and confirm Strategy Score >= 8 triggers refinement before the Final Report opens.
- Run one local Level 1 incorrect-strategy game and confirm no refinement request contains either Gold artifact.
- Inspect the two resulting local MAS archives and verify both drafts, hidden judge explanation/evidence, Gold Output version/content, both refined artifacts, output grades, and final event order.
- Smoke-test levels 2–5 for the same UI and no-loading-stall behavior.

## Risks and Mitigations

- **LLM Strategy Judge variance:** use a fixed per-risk rubric, structured output, deterministic settings, and evidence requirements. Preserve the existing structural inspector as a non-player-visible diagnostic comparison during initial rollout, but do not let it override the agreed LLM score unless explicitly enabled.
- **Gold artifacts leak into ordinary MAS outputs:** keep access inside `qualityEditor.ts`; prohibit importing the getter from agent/workflow generation modules; add prompt-isolation tests for both prose and chart signatures.
- **Gold artifacts cause identical outputs:** instruct minimal-but-complete refinement and archive report/chart similarity metrics for research analysis. If exact copying becomes undesirable, add a later similarity ceiling rather than weakening factual authority.
- **Refined visualization uses invented or stale data:** overwrite its `data` with the trusted active-dataset values and require Vega-Lite compilation before scoring or publication.
- **Extra latency or last-step stalls:** put Strategy Judge and Quality Editor behind the shared request gate, apply bounded timeouts/cancellation, expose a neutral “Evaluating strategy”/“Refining report” status, and release scene state in `finally` blocks.
- **Duplicated scene logic drifts across five levels:** centralize finalization in one module; scene files should only assemble run inputs, await the result, update UI, and emit completion.

## Recommended Delivery Order

1. Land configuration types, both Gold Final Output packages, and their tests.
2. Land Strategy Judge and Quality Editor as isolated tested modules.
3. Add the shared finalization pipeline with stubbed integration tests.
4. Decouple the four workflow final-stage branches from grading/publication.
5. Wire levels 1, 2, and the shared levels 3–5 scene into finalization.
6. Remove attempt persistence and update UI/archive/docs.
7. Run automated verification, then the two Level 1 end-to-end smoke runs and levels 2–5 consistency checks.

## Explicit Non-goals

- No new player-facing Semantic Action or draggable agent.
- No exposure of Strategy Judge explanations or Gold Final Outputs in the UI.
- No artificial score floor or score inflation.
- No multi-attempt guarantee or persistent attempt counter.
- No refinement for a Strategy Score below 8.

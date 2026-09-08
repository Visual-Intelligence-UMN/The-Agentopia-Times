# Finalization failure recovery — 2026-09-08

## Observed failure

Saved run `1bb2ff74-3125-4b4b-8ad3-7257eceffd80` completed all three Voting rooms and earned Strategy 8. Its Quality Editor returned valid JSON with `vconcat` at the response envelope root instead of inside `visualizationSpec`. Vega-Lite rejected the incomplete nested chart. The exception prevented output grading and score-panel creation.

## Changes

- `src/langgraph/qualityEditor.ts`: one corrective retry for validation failures; chart-envelope instructions clarified. Successful responses still use one completion. Transport errors are not retried here.
- `src/langgraph/qualityPipelineLLM.ts`: forward retry messages to the actual model call rather than rebuilding the initial prompt.
- `src/langgraph/finalizeLevelRun.ts`: failed optional enhancement retains both original workflow artifacts and continues grading. Trace records the failure and `original_drafts` fallback; `refinement.applied` remains false. Cancellation still stops the run.
- `src/langgraph/sceneLevelFinalization.ts`: display Strategy immediately, display final scores before report publication, and preserve Strategy with Output unavailable if grading fails. Fallback scores explicitly identify the original workflow output.
- `src/langgraph/workflowUtils.ts`: support pending/unavailable output without inventing zero scores; reuse the existing score reset function so replacement does not leave overlapping old labels/buttons.
- Regression coverage in `tests/QualityEditor.test.ts`, `tests/LevelFinalization.test.ts`, and `tests/SceneFinalization.test.ts`.

## Deterministic verification

- Before the fix, the minimized wrong-envelope response failed at the real finalizer boundary and never reached grading.
- After the fix, replaying the original complete saved response twice through `runQualityEditor` and `finalizeLevelOutput` reached output grading, kept Strategy 8, and retained the exact original draft report/chart. That replay used a stub grader; its numeric output is not a real model grade.
- Tests cover retry feedback reaching the actual LLM adapter, retry exhaustion, cancellation, original-artifact grading, Strategy visibility before grading, scoring failures, and publication failures.
- Full suite: 168 tests passed. Production build passed.
- Type checking remains blocked by existing repository errors (unused declarations, older target library, missing visualization exports). The changed quality/finalization modules reported no type errors; `workflowUtils.ts` has pre-existing unused declarations.
- Scoped lint reports existing formatting/import/typing violations; no repository-wide cleanup was attempted.

## Actual browser run

- Run `52d77b62-5fb3-4354-b48a-e6757b45602d`: selected baseball and Voting in all three rooms through the UI, with Ghost in Visualization and no Manager.
- Completed successfully; Strategy 7/10 and Output 0.4/10 were visible. Expanded feedback and the Final Report opened successfully; no stale overlapping score labels were visible.
- Because Strategy was below 8, this real-model run skipped enhancement. It verifies end-to-end panel/report publication, not the enhancement-failure branch. The saved-response replay and scene integration tests cover that branch deterministically.
- The generated article was only a short headline and received Writing 0; Coding received 1. This repair does not change producer prompts or inflate grades to hide weak artifacts.
- Visual panel verdict: 93/100. The existing lower-right risk banner remains clipped at the game boundary, outside this score-panel change.

## Limits

This change makes optional enhancement failure recoverable. It does not guarantee model factual accuracy, a valid original chart, or availability of the separate scoring service. A scoring-service failure remains explicit and preserves completed Strategy rather than fabricating an Output score.

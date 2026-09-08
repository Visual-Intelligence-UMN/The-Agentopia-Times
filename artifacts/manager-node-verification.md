# Manager verification belongs to the assigned participant

## Behavior

The assigned agent keeps its identity, role, room, and position. Its turn is received input → original task execution plus verification → output. Verification receives upstream material, the participant's task draft, and original dataset counts. Discussion includes all preceding turns. Corrected output is handed onward before the next participant or aggregation.

Assignment no longer starts an independent assessment. The three scenes no longer contain a fixed post-writing approval/revision gate. Verification concerns and failures are recorded without skipping Visualization, final report, or scoring. A failed verification retains the actual task draft; cancellation does not publish late results.

Voting does not give the assigned participant access to parallel votes. Placement-based policy checks likewise do not credit unseen future work. Verification status is a model assessment, not a deterministic guarantee of factual correctness.

## Changed areas

- `src/langgraph/managerVerification.ts`: shared node-local verification and trace records.
- `agents.ts`, `singleAgentUtils.ts`, `votingUtils.ts`, `discussionUtils.ts`, `chainingUtils.ts`: same-participant execution and output handoff. Sequential chart handoff now uses the middle participant's output rather than reverting to the first chart.
- `src/game/scenes/level{1,2,3}.tsx`: removed fixed gate and assignment-time prefetch; preserve normal finalization.
- `levelCompletionPolicy.ts`, `strategyJudge.ts`, `agenticRiskLevels.ts`: actual-node coverage and wording.
- `workflowUtils.ts`: clear verification records when starting another run.
- Tests: node boundaries, upstream context, output propagation, failure/cancellation, and placement coverage.

## Verification

- 183 automated tests passed, including all four strategy paths and the three Voting rooms.
- Production build passed. Existing eval and bundle-size warnings remain.
- Project type checking/lint still have existing failures; this change does not claim repository-wide lint/type cleanliness.
- Real browser run: `8e16563a-d873-49af-ac77-3d4b08a7d997`, Level 2, baseball selected, all three rooms Discussion, Manager assigned to `Agent7 - voter` in Visualization.
- Actual trace contains rooms 0 and 1, then room 2 turns, `manager_verification_started`, `manager_verification_completed`, remaining discussion, visualization, strategy judging, and output scoring. Run completed; Strategy 7/10 and Output 5.2/10 were visible. Final Report opened successfully.
- The verification input included the complete preceding report and earlier room-2 contributions. The model still missed the upstream article's kidney/baseball topic mismatch and reported verified. This is an observed model-quality limitation, not proof that all false claims were corrected. No automatic score inflation or forced correction was added.

## Repository state

The workspace already contained more than 100 staged changes before this implementation. At the user's request, the Manager change was independently reconstructed against HEAD in an isolated checkout. Existing scoring/finalization, Ghost policy, logging, and UI changes remain staged in the original workspace; they are not part of the Manager-only commit. The isolated checkout also passes its own test suite and production build. The real browser run above used the complete local workspace, including the previously staged changes.

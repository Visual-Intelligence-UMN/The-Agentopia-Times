# Manager-blocked result panel — 2026-09-08

## Evidence

The screenshot's run `744e2bea-68b7-449d-9f9b-b94795b74131` completed only two Voting rooms. The Manager returned `revise` again after revision, so all three scene implementations returned before final grading and score-panel creation. Its final archive has `publicationBlocked: true` and `finalScore: null`.

The preceding run `a28dbec3-91f0-4967-b7f2-18ba2ac4f726` earned Strategy 6. The lower-right Strategy 6 banner in the screenshot is stale: new-run cleanup removed score controls but not the outcome banner. It is not this blocked run's score.

## Changes and reuse

- `src/game/scenes/level1.tsx`, `level2.tsx`, `level3.tsx`: every Manager-blocked return displays the shared result panel; outcome banners and next-level controls receive stable cleanup names.
- `src/langgraph/workflowUtils.ts`: reuse the existing expandable/scrollable score panel for blocked results, with no fabricated numeric scores. Add shared new-run cleanup for previous scores, banners, buttons and registry results. Keep score replacement cleanup separate from new-run cleanup.
- `tests/WorkflowRouting.test.ts`: execute the actual blocked branch extracted from each scene, plus assert cleanup and all three scenes' cleanup wiring. These four regressions failed before the fix.
- `artifacts/manager-blocked-score-repro.html`: explicit browser fixture using the real Phaser score UI and reset helpers, without model calls.

## Verification and limits

- Full test suite: 172 passing; production build passes.
- Browser fixture: previous result -> new-run cleanup reports PASS -> Manager-blocked panel persists -> expand -> scroll to the final Not scored labels.
- Visual verdict 94/100 for the score component with WebGL/AUTO rendering. Initial Canvas-only fixture showed doubled text; no claim of Canvas renderer compatibility is made.
- Existing repository type/lint failures remain; no broad formatting or unrelated behavior changes were made.
- No additional live-model run was required to force another Manager rejection: the real saved run establishes the cause, executable scene branches cover all three call sites, and the browser fixture checks the real display component.
- Manager rejection policy is unchanged. A blocked run still does not publish a final report or receive final numeric scores; its result panel explains why.

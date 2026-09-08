# Final report visualization fix

The screenshot's two symptoms were reproduced together: no chart was mounted, and the comment sections appeared as literal HTML inside a Markdown code block.

## Changes

- `src/utils/finalReport.ts`: final reports declare HTML format and carry their own final chart code; a single chart mount sits below “Visualization I”.
- `src/utils/markdown.ts`: render constructed HTML directly; preserve Markdown parsing for drafts and agent messages.
- `src/App.tsx`: select charts from the report being opened instead of replaying a shared chart event history.
- `src/components/DraggableWindow.tsx`: render into a report-local mount, show errors, and clean up chart views when switching or closing reports.
- `src/vega/renderChart.ts`: support JSON and legacy JavaScript Vega outputs, await rendering errors, and validate specs with the installed Vega compiler.
- `src/langgraph/visualizationGenerate.ts`: restore validation and retry invalid generated specifications, with a maximum of three attempts.
- `src/langgraph/workflowUtils.ts`: publish HTML format and the final chart together.
- `src/langgraph/agents.ts`, `singleAgentUtils.ts`, `votingUtils.ts`, `discussionUtils.ts`: pass the actual final chart from each workflow. Chaining now uses the manager's final revision.
- `src/langgraph/const.ts`: allow chart overflow to scroll and style rendering errors.
- `tests/FinalReport.test.ts`, `tests/ChartRenderer.test.ts`: seven regression checks.

## Verification

- Seven focused regression tests pass, including the former HTML-as-code failure.
- Browser reproduction: JSON chart and legacy JavaScript chart each render one canvas; comments render as headings and lists.
- Browser error case: an invalid chart produces a visible alert instead of an unexplained blank area.
- Actual App under React StrictMode: First report → Second report → First report shows the matching chart title every time. A deliberately stale global chart event does not overwrite them.
- Intermediate Markdown report: correct heading/bold text, zero chart mounts, zero chart errors.
- Closing and reopening the final report restores its chart.
- A real saved discussion-run chart was replayed successfully.
- Production build passed both for an isolated copy of the visualization changes and for the joint workspace after verifier modules were integrated. The last joint test run passed 81 tests. The subsequent verification-store fix was checked again in the browser: chart and comment rendering, and both report titles, are correct.
- Existing project-wide TypeScript/lint failures remain. Before concurrent verifier changes, TypeScript stayed at the same 216 baseline errors with none added by this fix. The new renderer, report builder, and regression test files pass focused ESLint.

No new model requests were needed for the browser checks; they used deterministic inputs and a previously saved chart. This verifies rendering and report wiring, not the factual accuracy of future model output.

## Retained debug fixtures

`artifacts/final-report-repro.html` and `artifacts/final-report-app-repro.html` are local, deterministic regression previews, not product pages. The first also replays `artifacts/final-report-recorded-chart.json`, extracted from the existing saved discussion trace. `artifacts/final-report-vite.config.mjs` provides a separate local preview without the production HTML plugin rewriting fixture routes. The shared debug server at port 5174 remains available to the concurrent verification task.

# Discussion smoke test

- Run: `19d6f217-0371-45c3-9497-f76c8b4b9510`
- Level 1, baseball dataset; all three stages set to Discussion; no Manager.
- Completed normally with 15 successful `gpt-5-nano` calls and no request errors.
- Nine agent turns, three facilitator summaries, and three existing evaluation calls.
- All calls contain full inputs and outputs; the trace additionally contains 16 stage records and the final score.
- The injected-error ghost participated in report writing; its private prompt and own evidence were included in its call, not exposed as private metadata in later speakers' public transcripts.
- Final report and Vega-Lite chart rendered in the report window. Test score was 4/10; functional completion does not imply a correct or high-scoring MAS conclusion.
- Discussion selector visually verified in Levels 1–5, including all three room selectors in Level 1. The complete model-backed run was Level 1 only.
- Existing ghost-animation frame warnings appeared; there were no browser error-level messages in this run.

Full trace: `mas-trace-level1-19d6f217-0371-45c3-9497-f76c8b4b9510.json`.

# Output verification validation

- 85 full-suite tests passed (including 42 new verifier tests and the concurrent chart-rendering regression tests).
- Production build passed. Full type check reports 215 existing diagnostics, none in the new verifier modules.
- Focused verifier ESLint passed.
- Browser: red/yellow marks preserve text across nested bold markup; click reveals the corresponding explanation and evidence. Incomplete results are not labelled clean. Reset/new-run test drops stale Ghost and stage callbacks.
- Browser: existing App report switching First → Second → Intermediate keeps the matching chart and removes charts from the intermediate report. Only pre-existing react-draggable deprecation warnings appeared.
- Browser: verificationId survives the real App event handlers for both intermediate HTML-wrapped reports and Discussion-prefixed agent messages. The same exact span is highlighted across bold text; clearing checks removes all marks and preserves the complete original visible text.
- Live API: gpt-5-nano, medium reasoning, strict response schema. A deliberately reversed yearly-winner claim was marked contradicted; invented coaching causation was marked unsupported. The subjective headline and supported two-year-data statement were left unmarked. Zero rejected annotations. Independent normal Voting peer was recorded unchecked without a request.
- Download checks produced a valid JSON file containing evidence, prompts, raw response, accepted spans, producer/stage and Ghost ancestry. The downloaded records are copied to output-verification-live.json.

This is an integration smoke test, not a measured hallucination-detection accuracy result or a replay of an entire game. Earlier prompt/effort trials produced false positives; findings remain probabilistic and require interpretation.

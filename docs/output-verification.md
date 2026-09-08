# Intermediate-output verification

The verifier annotates an output without rewriting it or feeding findings into the MAS. It is separate from the existing final-report judges and from the Hire a Manager action.

## Eligibility

Each workflow run has its own provenance tracker. A Ghost introduces its name into `ghostSources`; a downstream output inherits the union of its inputs' sources even if verification finds no issue.

- Sequential and Discussion: the Ghost and subsequent speakers are eligible.
- Voting: peers use the stage's original input sources, not previously completed peers. The aggregate inherits all branches' sources.
- Single Agent: check a Ghost or an agent with inherited sources.
- A following stage inherits the preceding stage's union. Without any Ghost ancestry, an output is recorded as unchecked and makes no verifier request.

These rules describe the configured workflow's dependencies. They do not prove that a later statement was caused by a particular Ghost.

## Findings and display

The checker receives the visible output text and the active dataset's configured ground truth, neutral statistics, and description. It does not receive the producer's identity or Ghost flag as evidence. The current configured chat model is reused, with the existing shared request gate and retry policy.

The response contains exact quotes, `contradicted` or `unsupported`, an explanation, and known evidence IDs. The request uses strict JSON Schema per the [OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs). Application code still computes text offsets and rejects unknown evidence, ambiguous quotes, or overlapping spans. Both categories appear as plain yellow highlights in the original text, with no status panel, legend, download button, or clickable explanation. Existing typography and Markdown formatting are preserved.

Pending, unchecked, cancelled, failed, and incomplete checks remain distinguishable in the stored records, but are not displayed in the report. An absence of highlights is not a guarantee of factual correctness: a check may not have completed, the model can miss or misclassify claims, and the reference facts are limited to the dataset configuration.

Checks run asynchronously and serially; they do not block workflow promises, but share the API request gate and can add request traffic. Reset, level change, or a new run cancels old checks. Late results cannot update the replacement run.

## Traces

Output records retain original visible text, producer, stage, Ghost ancestry, model, evidence, verification input, raw response, accepted spans, rejected-span count, and status/error. Checks remain stored separately under `agentopia-output-verification-latest` in browser storage; the report no longer exposes a download control. Existing MAS traces and outputs remain unchanged. The stored checks are replaced by a subsequent run.

# Automatic local MAS archives

Every local run is automatically saved under `.local/mas-runs/<runId>/` in this project. No game UI or manual download is required. Existing yellow highlights and MAS behavior are unchanged. The directory is ignored by Git and archives are not automatically deleted.

Use the normal Vite development server (`npm start`) or Vite preview (`npm run build` then `npm run preview`) on `localhost` or `127.0.0.1`. Both include the local archive middleware. The existing diagnostic configuration used on port 5174 also includes it. Custom servers must include `createLocalRunArchivePlugin` from `server/localRunArchive.ts`; static hosting alone cannot write files to this project.

## Files in each run

- `events.jsonl`: append-only timeline. Each line has run ID, unique event ID, kind, timestamp and data. Contains model snapshots, every captured HTTP attempt and response, retries/errors, agent dialog output, report payloads (including chart code), workflow interactions and interruption events.
- `mas.json`: latest MAS snapshot, including context, Agent/Ghost/Manager and zone configuration, model call inputs and outputs, timing, intermediate stage results and final output/score.
- `configuration.json`: dataset reference material, selected workflows and models, and the run context. Manager prefetch-only runs retain their configuration in `mas.json` even before a simulation starts.
- `verification.json`: latest verification session, with its original verification ID, source text, Ghost ancestry, prompts, raw answers, annotations, rejected spans and pending/failed/completed status. The directory's run ID associates this separate session with its MAS run.
- `summary.json`: compact server-side summary of the run.

Snapshots are written as the run progresses, not just at completion. Later verification results continue updating their original directory after the MAS finishes. Reset or level change records interruption and cancels pending checks without deleting prior files. An in-flight model response returning after a new run starts updates its original call's trace rather than the replacement trace.

## Recovery and limitations

Before sending, the browser queues redacted archive events in IndexedDB (`agentopia-run-archive`). It retries pending writes every three seconds and after reload/returning online; the server deduplicates repeated event IDs. If the local service is unavailable, a warning appears in the developer console, not the game. Reopen the same browser profile and origin (including port) to recover that outbox.

Normal Reset preserves already recorded data. A forced browser/process crash can lose the last data not yet committed to browser storage. A run left marked `running` with no terminal event may have been interrupted abruptly; it is not evidence that the game is still running. Disk/storage failures must be resolved for pending writes to finish. Requests are capped at 32 MiB each; unusually large runs may require increasing the limit or a future chunked format. Logs accumulate until manually removed.

The server accepts only loopback, same-origin JSON writes into its fixed archive directory. Authorization headers are not captured. Known credential fields and `sk-…` / Bearer secrets are redacted before browser persistence and again on disk. Prompts and generated content can still contain other sensitive task data, so keep the archive private. No hidden model reasoning is requested or recorded—only inputs, outputs and metadata actually exposed by the application/API.

For debugging, provide the run directory or its ID. To investigate missing highlights, inspect `verification.json` for the agent's status, raw response and accepted/rejected annotations, then compare its text with `agent-output` events in `events.jsonl`.

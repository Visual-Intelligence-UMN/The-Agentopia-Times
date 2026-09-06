# Configuration-Based Game Setup

This project now centralizes theme, level, asset, and MAS setup in the game
configuration layer.

## Where the configuration lives

- Active theme registry: `src/game/config/index.ts`
- Default newsroom preset: `src/game/config/newsroom.ts`
- Config schema: `src/game/config/types.ts`
- Starter template: `src/game/config/template.ts`
- Scene-level helpers: `src/game/scenes/configUtils.ts`
- LangGraph/MAS helpers: `src/langgraph/config.ts`

## What is configurable

A theme config has three main sections.

1. `assets`
   Defines preloadable resources such as bitmap fonts, spritesheets, images,
   atlases, and tilemaps.

2. `mechanics`
   Defines `levels[]`, their UI copy, default workflow, required score,
   available datasets, initial dataset, and hallucination setup.

3. `mas`
   Defines LLM model names, dataset descriptions, dataset CSV paths,
   hallucination-specific statistics, ground truth text, and workflow prompts.

## Current shape

The implementation currently expects a `GameThemeConfig` with this structure:

```ts
{
  id,
  title,
  assets: {
    bitmapFonts,
    spritesheets,
    images,
    atlases,
    tilemaps,
    decorations?
  },
  mechanics: {
    config_options,
    levels: [
      {
        id,
        sceneKey,
        level_name,
        uiTitle,
        uiInfo,
        required_score,
        tilemapKey,
        workflow,
        config_options,
        initialDataset,
        availableDatasets,
        hallucination: {
          type,
          name,
          injectedPrompt,
          biasPool,
          hallucinatedAgents
        },
        mas: {
          agenticRisk,
          calibrationTarget,
          scenarioPrompt
        }
      }
    ]
  },
  mas: {
    model: {
      chat,
      judge
    },
    agents,
    datasets: {
      [datasetId]: {
        id,
        label,
        csvPath,
        description,
        groundTruth,
        researchQuestion,
        neutralStatistics,
        hallucinationStatistics
      }
    },
    judge
  },
  defaults: {
    startScene,
    startLevel,
    dataset
  }
}
```

## How to add a new theme

1. Copy `src/game/config/template.ts` to a new file such as
   `src/game/config/factory.ts`.
2. Fill in the new theme's `assets`, `mechanics`, and `mas` fields.
3. Register the new config in `src/game/config/index.ts`.
4. Set `VITE_GAME_THEME=<your-theme-id>` in your environment.
5. Start the app.

## Asset requirements

`Boot` now preloads everything from `config.assets`, so any asset that a scene
or UI element uses must be declared there.

At minimum, a theme should provide:

- the tilemap(s) used by configured levels
- the tileset images referenced by those tilemaps
- agent/report/UI images used by the current HUD and gameplay flow
- any spritesheets or atlases needed by existing characters

## Level requirements

Each configured level should define:

- which scene key it maps to, such as `level1`
- which tilemap key should be loaded for that level
- the UI title and tooltip copy
- the workflow choices shown to the player
- the initial dataset and available datasets
- the hallucination type, injected prompt, bias pool, and biased-agent count
- the agentic risk, calibration target, and MAS scenario prompt

The newsroom preset defines five levels, one for each supported agentic risk:
error propagation, premature consensus, verifier capture, collusion, and
responsibility diffusion. Ghost agents are the agents that receive the injected
error; their count is part of the risk scenario rather than a difficulty scale.

## Dataset and MAS requirements

Each dataset should provide:

- `csvPath`: the file fetched during gameplay
- `description`: used when title/report prompts ask for dataset context
- `groundTruth`: used by the writing judge and highlighter
- `researchQuestion`: the main analysis prompt scaffold
- `neutralStatistics`: baseline statistics for unbiased agents
- `hallucinationStatistics`: statistics used for level-specific biased behavior

The MAS model configuration currently controls:

- `mas.model.chat`: LangGraph and text-generation chat model
- `mas.model.judge`: judge and server-side chat completion model

## Theme-switching flow in the current codebase

- `Boot` preloads resources from the active theme config.
- `level1`, `level2`, and `level3` read mechanics from config.
- Difficulty selection reads the configured level list.
- LangGraph helpers read dataset descriptions, hallucination prompts,
  hallucination statistics, ground truth, and model names from config.

## Current limitations

This refactor moved the main gameplay knobs into configuration, but a few core
engine assumptions still exist:

- The project uses dedicated `level1` / `level2` scenes and a shared office
  scene runtime for `level3` / `level4` / `level5`.
- Non-`tuxemon` tilemaps still go through the current office-like map builder.
- Tilemap object-layer conventions such as `Objects`, `parallel`, `voting`,
  `chaining`, and `routing` are still expected by gameplay code.
- Adding a brand-new theme still requires registering it in
  `src/game/config/index.ts`.

So today the system is best described as configuration-driven theme/content
swapping on top of the existing engine, not yet a fully generic runtime that can
consume arbitrary JSON without any code registration.

## Recommended workflow for future extension

1. Add the theme config first.
2. Reuse existing keys and object-layer conventions if possible.
3. Only change core scene/runtime code when a requirement cannot be expressed in
   config.
4. If you need a new configurable concept, add it to `types.ts` first and then
   thread it into the runtime helpers.

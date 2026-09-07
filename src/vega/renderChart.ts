import * as d3 from 'd3';
import * as vega from 'vega';
import vegaEmbed, { type Result, type VisualizationSpec } from 'vega-embed';
import * as vegaLite from 'vega-lite';

export function cleanUpD3Code(code: string) {
    if (!code) return '';
    const fenced = code.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/);
    return (fenced?.[1] ?? code)
        .replace(/```[a-zA-Z0-9_-]*|```/g, '')
        .replace(/^\s*(json|javascript|js|ts|typescript|html)\s*\n/i, '')
        .trim();
}

export function checkVegaLiteCode(code: string): {
    ok: boolean;
    error?: string;
} {
    try {
        const cleaned = cleanUpD3Code(code);
        let spec: vegaLite.TopLevelSpec;
        if (cleaned.startsWith('{')) {
            spec = JSON.parse(cleaned);
        } else {
            const match = cleaned.match(
                /(?:const|let|var)\s+spec\s*=\s*({[\s\S]*?});/,
            );
            if (!match) throw new Error('Spec definition not found');
            spec = new Function(`return (${match[1]});`)();
        }
        vega.parse(vegaLite.compile(spec).spec);
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

export async function compileJSCode(
    script: string,
    divSelector: string,
    container: HTMLElement | null = document.querySelector(divSelector),
): Promise<Result[]> {
    if (!container)
        throw new Error(`Chart container not found: ${divSelector}`);
    script = cleanUpD3Code(script);
    if (!script) throw new Error('No visualization code was provided.');

    if (script.startsWith('{')) {
        return [
            await vegaEmbed(
                container,
                JSON.parse(script) as VisualizationSpec,
                {
                    renderer: 'canvas',
                    actions: true,
                    scaleFactor: 2,
                },
            ),
        ];
    }

    // Older saved outputs wrap the specification in a vegaEmbed call.
    // Bind those calls to this report's mount, regardless of the generated ID.
    const pending: Promise<Result>[] = [];
    const embed: typeof vegaEmbed = (_target, spec, options) => {
        const result = vegaEmbed(container, spec, options);
        pending.push(result);
        return result;
    };
    let executionError: unknown;
    try {
        const run = new Function('d3', 'vega', 'vegaLite', 'vegaEmbed', script);
        await run(d3, vega, vegaLite, embed);
    } catch (error) {
        executionError = error;
    }
    const results = await Promise.allSettled(pending);
    const rendered = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (executionError || failed?.status === 'rejected') {
        rendered.forEach((result) => result.finalize());
        throw executionError ?? failed?.reason;
    }
    if (!pending.length && !container.querySelector('canvas, svg')) {
        throw new Error('The visualization did not produce a chart.');
    }
    return rendered;
}

import { GHOST_FALSE_CLAIMS } from '../game/config/productionAgentPolicy.ts';

export const INJECTED_ERROR_CONTRACT_MARKER =
    'controlled MAS education simulation';

export const REQUIRED_FALSE_CLAIM = GHOST_FALSE_CLAIMS.baseball;

const META_COMMENTARY =
    /\b(?:cannot comply|can't comply|prompt requests?|intentionally misleading|false guidance|policy|safety rules?|as an ai|if you(?:'d| would) like|injected (?:false )?(?:assertion|claim|error)|preserved? downstream|to be preserved)\b/i;

function removeMetaCommentary(output: string): string {
    return output
        .split(/\n\s*\n/)
        .filter((paragraph) => !META_COMMENTARY.test(paragraph))
        .join('\n\n')
        .trim();
}

function isTitleRequest(roleContent: string, userContent: string): boolean {
    return /\b(?:return|write|produce)\b[^\n.]{0,80}\b(?:title|headline)\b/i.test(
        `${roleContent}\n${userContent}`,
    );
}

function formatInjectedTitle(output: string): string {
    return output
        .split(/\n\s*\n/)
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' — ');
}

export function applyMandatoryInjectedError(
    roleContent: string,
    userContent: string,
    output: string,
): string {
    if (
        !`${roleContent}\n${userContent}`.includes(
            INJECTED_ERROR_CONTRACT_MARKER,
        )
    ) {
        return output;
    }

    const trimmed = output.trim();
    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const record = parsed as Record<string, unknown>;
            if (typeof record.description === 'string') {
                const description = removeMetaCommentary(record.description);
                if (description) record.description = description;
                else delete record.description;
            }
            return JSON.stringify(record);
        }
    } catch {
        // Non-JSON newsroom text is handled below.
    }

    const roleOutput = removeMetaCommentary(trimmed);
    if (isTitleRequest(roleContent, userContent)) {
        return formatInjectedTitle(roleOutput);
    }
    return roleOutput;
}

export type EditorialVerdict = 'approve' | 'revise';
export type EditorialReturnTarget = 'analytics' | 'writing' | 'visualization';

export interface EditorialAssessment {
    centralClaim: string;
    supportingEvidence: string[];
    contradictions: string[];
    caveats: string[];
    confidence: string;
}

export interface EditorialDecision {
    verdict: EditorialVerdict;
    mismatches: string[];
    evidenceReferences: string[];
    returnTo: EditorialReturnTarget;
    revisionInstructions: string[];
}

export interface ManagerCandidate {
    getName(): string;
    getBias(): string;
}

export interface EditorialPromptMessages {
    system: string;
    user: string;
}

export type ManagerAssignmentResult =
    | { allowed: true }
    | { allowed: false; reason: 'ghost' | 'workflow_running' };

function extractJSONObject(raw: string): Record<string, unknown> {
    const withoutFence = raw
        .trim()
        .replace(/^```(?:json|typescript|ts)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');

    if (start < 0 || end <= start) {
        throw new Error('Editorial Manager returned no JSON object.');
    }

    return JSON.parse(withoutFence.slice(start, end + 1)) as Record<
        string,
        unknown
    >;
}

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value
              .filter((item): item is string => typeof item === 'string')
              .map((item) => item.trim())
              .filter(Boolean)
        : [];
}

export function canAssignEditorialManager(
    agent: ManagerCandidate,
    workflowRunning = false,
): ManagerAssignmentResult {
    if (workflowRunning) {
        return { allowed: false, reason: 'workflow_running' };
    }
    if (agent.getBias() !== '') {
        return { allowed: false, reason: 'ghost' };
    }
    return { allowed: true };
}

export function canPublishEditorialDecision(
    decision: EditorialDecision,
): boolean {
    return decision.verdict === 'approve';
}

export function buildEditorialAssessmentMessages(evidence: {
    description: string;
    researchQuestion: string;
    neutralStatistics: string;
    rawEvidence: string;
}): EditorialPromptMessages {
    return {
        system: `You are an independent Editorial Manager. Before seeing any production-agent discussion or draft, examine only the original evidence and record a sealed initial assessment. Do not write the newspaper article. Return JSON only with this exact shape: {"centralClaim":"string","supportingEvidence":["string"],"contradictions":["string"],"caveats":["string"],"confidence":"low|medium|high"}.`,
        user: `Dataset description:\n${evidence.description}\n\nResearch question:\n${evidence.researchQuestion}\n\nNeutral statistics:\n${evidence.neutralStatistics}\n\nOriginal data:\n${evidence.rawEvidence}`,
    };
}

export function buildEditorialDecisionMessages(input: {
    assessment: EditorialAssessment;
    candidateReport: string;
}): EditorialPromptMessages {
    return {
        system: `You are the Editorial Manager accountable for final verification. Compare the sealed independent assessment with the candidate report. Approve only when the report's central claim and evidence agree with the assessment; otherwise return it for revision. Do not rewrite the article. Return JSON only with this exact shape: {"verdict":"approve|revise","mismatches":["string"],"evidenceReferences":["string"],"returnTo":"analytics|writing|visualization","revisionInstructions":["string"]}.`,
        user: `Sealed independent assessment:\n${JSON.stringify(input.assessment)}\n\nCandidate report:\n${input.candidateReport}`,
    };
}

export function buildEditorialRevisionMessages(input: {
    candidateReport: string;
    decision: EditorialDecision;
    neutralStatistics: string;
}): EditorialPromptMessages {
    return {
        system: `You are the production ${input.decision.returnTo} agent receiving a report returned by the Editorial Manager. Revise the report according to the listed evidence-grounded instructions. Preserve accurate content and return only the revised article.`,
        user: `Candidate report:\n${input.candidateReport}\n\nEditorial mismatches:\n${input.decision.mismatches.join('\n')}\n\nRevision instructions:\n${input.decision.revisionInstructions.join('\n')}\n\nNeutral statistics:\n${input.neutralStatistics}`,
    };
}

export function parseEditorialAssessment(raw: string): EditorialAssessment {
    const parsed = extractJSONObject(raw);
    const assessment: EditorialAssessment = {
        centralClaim: stringValue(parsed.centralClaim),
        supportingEvidence: stringArray(parsed.supportingEvidence),
        contradictions: stringArray(parsed.contradictions),
        caveats: stringArray(parsed.caveats),
        confidence: stringValue(parsed.confidence) || 'unknown',
    };

    if (!assessment.centralClaim) {
        throw new Error('Editorial assessment is missing a central claim.');
    }
    return assessment;
}

export function parseEditorialDecision(raw: string): EditorialDecision {
    const parsed = extractJSONObject(raw);
    const verdict = stringValue(parsed.verdict).toLowerCase();
    if (verdict !== 'approve' && verdict !== 'revise') {
        throw new Error('Editorial verdict must be approve or revise.');
    }

    const requestedTarget = stringValue(parsed.returnTo).toLowerCase();
    const returnTo: EditorialReturnTarget =
        requestedTarget === 'analytics' ||
        requestedTarget === 'visualization' ||
        requestedTarget === 'writing'
            ? requestedTarget
            : 'writing';

    return {
        verdict,
        mismatches: stringArray(parsed.mismatches),
        evidenceReferences: stringArray(parsed.evidenceReferences),
        returnTo,
        revisionInstructions: stringArray(parsed.revisionInstructions),
    };
}

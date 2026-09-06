import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildEditorialAssessmentMessages,
    buildEditorialDecisionMessages,
    canAssignEditorialManager,
    canPublishEditorialDecision,
    parseEditorialAssessment,
    parseEditorialDecision,
} from '../src/game/domain/editorialManager.ts';

function candidate(name: string, bias = '') {
    return {
        getName: () => name,
        getBias: () => bias,
    };
}

test('allows a normal agent but rejects a ghost as editorial manager', () => {
    assert.deepEqual(canAssignEditorialManager(candidate('Agent 1')), {
        allowed: true,
    });
    assert.deepEqual(
        canAssignEditorialManager(candidate('Biased Agent 2', 'biased')),
        {
            allowed: false,
            reason: 'ghost',
        },
    );
});

test('parses a sealed independent assessment from fenced model output', () => {
    const assessment = parseEditorialAssessment(`\n\`\`\`json\n{
        "centralClaim": "Treatment A is stronger within both groups.",
        "supportingEvidence": ["Small stones favor A", "Large stones favor A"],
        "contradictions": ["The aggregate comparison reverses"],
        "caveats": ["Group sizes differ"],
        "confidence": "high"
    }\n\`\`\``);

    assert.equal(
        assessment.centralClaim,
        'Treatment A is stronger within both groups.',
    );
    assert.equal(assessment.supportingEvidence.length, 2);
    assert.equal(assessment.confidence, 'high');
});

test('normalizes editorial decisions and rejects unsupported verdicts', () => {
    const decision = parseEditorialDecision(`{
        "verdict": "revise",
        "mismatches": ["Subgroup evidence is omitted"],
        "evidenceReferences": ["independent assessment"],
        "returnTo": "writing",
        "revisionInstructions": ["Add the subgroup comparison"]
    }`);

    assert.equal(decision.verdict, 'revise');
    assert.equal(decision.returnTo, 'writing');
    assert.equal(canPublishEditorialDecision(decision), false);
    assert.equal(
        canPublishEditorialDecision({ ...decision, verdict: 'approve' }),
        true,
    );
    assert.throws(
        () =>
            parseEditorialDecision(
                '{"verdict":"publish","returnTo":"writing"}',
            ),
        /approve or revise/,
    );
});

test('keeps the independent assessment prompt isolated from the production report', () => {
    const assessmentMessages = buildEditorialAssessmentMessages({
        description: 'Dataset description',
        researchQuestion: 'Which conclusion is supported?',
        neutralStatistics: 'Neutral evidence only',
        rawEvidence: 'group,value\nA,1',
    });
    const assessmentPrompt = JSON.stringify(assessmentMessages);

    assert.match(assessmentPrompt, /Neutral evidence only/);
    assert.doesNotMatch(assessmentPrompt, /Candidate report/);
    assert.doesNotMatch(assessmentPrompt, /injected/i);

    const decisionMessages = buildEditorialDecisionMessages({
        assessment: {
            centralClaim: 'Independent claim',
            supportingEvidence: ['Evidence'],
            contradictions: [],
            caveats: [],
            confidence: 'high',
        },
        candidateReport: 'Candidate report',
    });
    assert.match(JSON.stringify(decisionMessages), /Independent claim/);
    assert.match(JSON.stringify(decisionMessages), /Candidate report/);
});

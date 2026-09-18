import type { WorkflowType } from '../config/types';

export const CASE_STUDY_MODE_KEY = 'caseStudyMode';
export const CASE_STUDY_VARIANT_KEY = 'caseStudyVariant';

export type CaseStudyVariant = 'incorrect' | 'correct';

const STORAGE_MODE = 'agentopia-case-study-mode';
const STORAGE_VARIANT = 'agentopia-case-study-variant';
const STORAGE_GUIDE_PENDING = 'agentopia-case-study-guide-pending';

type RegistryHost = {
    registry: {
        get(key: string): unknown;
        set(key: string, value: unknown): unknown;
        remove?(key: string): unknown;
    };
};

function storage(): Storage | null {
    try {
        if (typeof sessionStorage === 'undefined') return null;
        return sessionStorage;
    } catch {
        return null;
    }
}

export function isCaseStudyVariant(value: unknown): value is CaseStudyVariant {
    return value === 'incorrect' || value === 'correct';
}

export function readCaseStudyVariant(value: unknown): CaseStudyVariant {
    return isCaseStudyVariant(value) ? value : 'incorrect';
}

export function isCaseStudyMode(host?: RegistryHost | null): boolean {
    if (host?.registry.get(CASE_STUDY_MODE_KEY) === true) return true;
    return storage()?.getItem(STORAGE_MODE) === '1';
}

export function getCaseStudyVariant(host?: RegistryHost | null): CaseStudyVariant {
    const fromRegistry = host?.registry.get(CASE_STUDY_VARIANT_KEY);
    if (isCaseStudyVariant(fromRegistry)) return fromRegistry;
    return readCaseStudyVariant(storage()?.getItem(STORAGE_VARIANT));
}

export function restoreCaseStudyMode(host: RegistryHost): boolean {
    if (storage()?.getItem(STORAGE_MODE) !== '1') {
        return host.registry.get(CASE_STUDY_MODE_KEY) === true;
    }
    host.registry.set(CASE_STUDY_MODE_KEY, true);
    host.registry.set(CASE_STUDY_VARIANT_KEY, getCaseStudyVariant(host));
    return true;
}

export function enterCaseStudyMode(
    host: RegistryHost,
    variant: CaseStudyVariant = 'incorrect',
): void {
    storage()?.setItem(STORAGE_MODE, '1');
    storage()?.setItem(STORAGE_VARIANT, variant);
    storage()?.setItem(STORAGE_GUIDE_PENDING, '1');
    host.registry.set(CASE_STUDY_MODE_KEY, true);
    host.registry.set(CASE_STUDY_VARIANT_KEY, variant);
}

export function setCaseStudyVariant(
    host: RegistryHost,
    variant: CaseStudyVariant,
): void {
    storage()?.setItem(STORAGE_VARIANT, variant);
    host.registry.set(CASE_STUDY_VARIANT_KEY, variant);
}

export function isCaseStudyGuidePending(): boolean {
    return storage()?.getItem(STORAGE_GUIDE_PENDING) === '1';
}

export function consumeCaseStudyGuidePending(): void {
    storage()?.removeItem(STORAGE_GUIDE_PENDING);
}

export function clearCaseStudyMode(host?: RegistryHost | null): void {
    storage()?.removeItem(STORAGE_MODE);
    storage()?.removeItem(STORAGE_VARIANT);
    storage()?.removeItem(STORAGE_GUIDE_PENDING);
    host?.registry.set(CASE_STUDY_MODE_KEY, false);
    host?.registry.remove?.(CASE_STUDY_VARIANT_KEY);
}

export const caseStudyWorkflows: Record<CaseStudyVariant, WorkflowType[]> = {
    incorrect: ['sequential', 'single_agent', 'sequential'],
    correct: ['voting', 'voting', 'discussion'],
};

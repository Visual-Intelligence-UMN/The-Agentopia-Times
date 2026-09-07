import type { VerifiedOutput } from './domain/verificationSession';

const records = new Map<string, VerifiedOutput>();
const listeners = new Set<() => void>();
let recordsSnapshot: VerifiedOutput[] = [];

function cloneRecord(record: VerifiedOutput): VerifiedOutput {
    return {
        ...record,
        annotations: [...record.annotations],
        evidence: [...record.evidence],
        ghostSources: [...record.ghostSources],
        input: record.input ? { ...record.input } : undefined,
    };
}

export function getVerifiedOutput(id?: string): VerifiedOutput | undefined {
    return id ? records.get(id) : undefined;
}

export function getVerificationRecords(): VerifiedOutput[] {
    return recordsSnapshot;
}

export function subscribeToVerification(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function updateVerifiedOutput(record: VerifiedOutput): void {
    records.set(record.id, cloneRecord(record));
    recordsSnapshot = [...records.values()];
    listeners.forEach((listener) => listener());
}

export function resetVerificationStore(): void {
    records.clear();
    recordsSnapshot = [];
    listeners.forEach((listener) => listener());
}

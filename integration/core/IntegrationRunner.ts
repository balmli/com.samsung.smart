import {EventEmitter} from 'events';
import {randomUUID} from 'crypto';

export type HumanOutcome = 'yes' | 'no' | 'skip';
export type TestStatus = 'pending' | 'running' | 'awaiting-human' | 'passed' | 'failed' | 'skipped' | 'error';
export type RunStatus = 'idle' | 'running' | 'awaiting-human' | 'passed' | 'failed' | 'error';

export interface HumanAnswer {
    outcome: HumanOutcome;
    note?: string;
}

export interface HumanCheckpoint {
    id: string;
    testId: string;
    prompt: string;
}

export interface IntegrationTestContext {
    verify(prompt: string): Promise<HumanAnswer>;
}

export interface IntegrationTest {
    id: string;
    title: string;
    disruptive?: boolean;
    run(context: IntegrationTestContext): Promise<void>;
}

export interface TestResult {
    id: string;
    title: string;
    status: TestStatus;
    note?: string;
    error?: string;
    startedAt?: string;
    finishedAt?: string;
}

export interface RunSnapshot {
    id: string;
    status: RunStatus;
    startedAt?: string;
    finishedAt?: string;
    pending?: HumanCheckpoint;
    tests: TestResult[];
}

class ObservationFailed extends Error {}
class ObservationSkipped extends Error {}

export class HumanCheckpointBroker extends EventEmitter {
    private pending?: HumanCheckpoint;
    private resolveAnswer?: (answer: HumanAnswer) => void;

    getPending(): HumanCheckpoint | undefined {
        return this.pending ? {...this.pending} : undefined;
    }

    ask(testId: string, prompt: string): Promise<HumanAnswer> {
        if (this.pending) {
            throw new Error('A human checkpoint is already pending');
        }

        this.pending = {id: randomUUID(), testId, prompt};
        this.emit('change', this.getPending());
        return new Promise(resolve => {
            this.resolveAnswer = resolve;
        });
    }

    answer(answer: HumanAnswer): void {
        if (!this.pending || !this.resolveAnswer) {
            throw new Error('No human checkpoint is pending');
        }
        const resolve = this.resolveAnswer;
        this.pending = undefined;
        this.resolveAnswer = undefined;
        resolve(answer);
        this.emit('change', undefined);
    }
}

export class IntegrationRunner extends EventEmitter {
    private snapshot: RunSnapshot;

    constructor(
        private readonly definitions: IntegrationTest[],
        private readonly checkpoints: HumanCheckpointBroker,
    ) {
        super();
        this.snapshot = this.createSnapshot();
    }

    getSnapshot(): RunSnapshot {
        return structuredClone(this.snapshot);
    }

    async run(): Promise<RunSnapshot> {
        if (this.snapshot.status === 'running' || this.snapshot.status === 'awaiting-human') {
            throw new Error('An integration test run is already active');
        }

        this.snapshot = this.createSnapshot();
        this.snapshot.status = 'running';
        this.snapshot.startedAt = new Date().toISOString();
        this.publish();

        for (const definition of this.definitions) {
            const result = this.snapshot.tests.find(test => test.id === definition.id)!;
            result.status = 'running';
            result.startedAt = new Date().toISOString();
            this.publish();

            try {
                await definition.run({
                    verify: async prompt => {
                        result.status = 'awaiting-human';
                        this.snapshot.status = 'awaiting-human';
                        const answerPromise = this.checkpoints.ask(definition.id, prompt);
                        this.snapshot.pending = this.checkpoints.getPending();
                        this.publish();
                        const answer = await answerPromise;
                        this.snapshot.pending = undefined;
                        this.snapshot.status = 'running';
                        result.note = answer.note;
                        result.status = 'running';
                        this.publish();
                        if (answer.outcome === 'no') {
                            throw new ObservationFailed(answer.note || 'The observed operation did not succeed');
                        }
                        if (answer.outcome === 'skip') {
                            throw new ObservationSkipped(answer.note || 'The observation could not be completed');
                        }
                        return answer;
                    },
                });
                result.status = 'passed';
            } catch (error) {
                if (error instanceof ObservationFailed) {
                    result.status = 'failed';
                    result.note = error.message;
                } else if (error instanceof ObservationSkipped) {
                    result.status = 'skipped';
                    result.note = error.message;
                } else {
                    result.status = 'error';
                    result.error = error instanceof Error ? error.message : String(error);
                }
            } finally {
                result.finishedAt = new Date().toISOString();
                this.publish();
            }
        }

        this.snapshot.finishedAt = new Date().toISOString();
        this.snapshot.status = this.snapshot.tests.some(test => test.status === 'error')
            ? 'error'
            : this.snapshot.tests.some(test => test.status === 'failed')
              ? 'failed'
              : 'passed';
        this.publish();
        return this.getSnapshot();
    }

    private createSnapshot(): RunSnapshot {
        return {
            id: randomUUID(),
            status: 'idle',
            tests: this.definitions.map(test => ({id: test.id, title: test.title, status: 'pending'})),
        };
    }

    private publish(): void {
        this.emit('change', this.getSnapshot());
    }
}

import { SagaDefinition, SagaContext, SagaResult, SagaExecution, ConnectorRegistry as ConnectorRegistryType } from '../types.js';
import { FastStore } from '@inno-optimize/agentdb';
export declare class SagaOrchestrator {
    private memory;
    private connectorRegistry;
    private executions;
    private runningCount;
    private maxConcurrent;
    constructor(memory: FastStore, connectorRegistry: ConnectorRegistryType);
    execute(definition: SagaDefinition, initialContext: Partial<SagaContext>): Promise<SagaResult>;
    private executeStep;
    private compensate;
    private checkIdempotency;
    private storeIdempotency;
    private getDefaultRetryPolicy;
    private calculateBackoff;
    private sleep;
    private persistExecution;
    getExecution(executionId: string): SagaExecution | undefined;
    getRunningExecutions(): SagaExecution[];
}
//# sourceMappingURL=orchestrator.d.ts.map
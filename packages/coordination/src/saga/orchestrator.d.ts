import { SagaDefinition, SagaContext, SagaResult, SagaExecution } from '../types';
import { FastStore } from '@inno-optimize/agentdb';
export declare class SagaOrchestrator {
    private memory;
    private connectorRegistry;
    private executions;
    private runningCount;
    private maxConcurrent;
    constructor(memory: FastStore, connectorRegistry: ConnectorRegistry);
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
declare class ConnectorRegistry {
    private connectors;
    register(connector: BusinessConnector): void;
    getConnector(id: string): BusinessConnector | undefined;
    listConnectors(): BusinessConnector[];
}
interface BusinessConnector {
    id: string;
    execute(operation: string, input: any): Promise<any>;
}
export {};
//# sourceMappingURL=orchestrator.d.ts.map
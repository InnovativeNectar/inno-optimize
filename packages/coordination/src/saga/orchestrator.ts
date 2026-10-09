import type { 
  SagaDefinition, 
  SagaContext, 
  SagaResult, 
  SagaStep,
  RetryPolicy,
  SagaExecution,
  CompletedStep,
  CompensationPlan,
  ConnectorRegistry,
  ConnectorRegistry as ConnectorRegistryType
} from '../types.js';
import { 
  CompensationAction
} from '../types.js';
import type { FastStore } from '@inno-optimize/agentdb';

export class SagaOrchestrator {
  private memory: FastStore;
  private connectorRegistry: ConnectorRegistry;
  private executions = new Map<string, SagaExecution>();
  private runningCount = 0;
  private maxConcurrent = 10;
  
  constructor(memory: FastStore, connectorRegistry: ConnectorRegistryType) {
    this.memory = memory;
    this.connectorRegistry = connectorRegistry;
  }
  
  async execute(definition: SagaDefinition, initialContext: Partial<SagaContext>): Promise<SagaResult> {
    if (this.runningCount >= this.maxConcurrent) {
      throw new Error('Max concurrent saga executions reached');
    }
    
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();
    
    const context: SagaContext = {
      sagaId: definition.id,
      executionId,
      stepOutputs: new Map(),
      compensationData: new Map(),
      startedAt: new Date(),
      status: 'running',
      ...initialContext
    };
    
    const execution: SagaExecution = {
      id: executionId,
      definition,
      context,
      status: 'running',
      startedAt: new Date(),
      updatedAt: new Date()
    };
    
    this.executions.set(executionId, execution);
    this.runningCount++;
    
    try {
      const completedSteps: CompletedStep[] = [];
      
      // Execute steps sequentially
      for (const step of definition.steps) {
        context.currentStep = step.id;
        execution.updatedAt = new Date();
        
        const stepResult = await this.executeStep(step, context, definition);
        
        const completedStep: CompletedStep = {
          step,
          result: stepResult,
          timestamp: new Date(),
          durationMs: Date.now() - startTime
        };
        
        completedSteps.push(completedStep);
        context.stepOutputs.set(step.id, stepResult);
        
        // Apply output mapper
        const outputUpdates = step.outputMapper(stepResult, context);
        Object.assign(context, outputUpdates);
      }
      
      context.status = 'completed';
      execution.status = 'completed';
      execution.completedAt = new Date();
      
      return {
        success: true,
        context,
        completedSteps,
        durationMs: Date.now() - startTime
      };
      
    } catch (error) {
      // Execute compensation
      context.status = 'compensating';
      execution.status = 'compensating';
      execution.context.error = error as Error;
      
      await this.compensate(definition.compensation, context);
      
      context.status = 'failed';
      execution.status = 'failed';
      
      return {
        success: false,
        context,
        completedSteps: [],
        durationMs: Date.now() - startTime
      };
      
    } finally {
      this.runningCount--;
      await this.persistExecution(execution);
    }
  }
  
  private async executeStep(
    step: SagaStep, 
    context: SagaContext, 
    definition: SagaDefinition
  ): Promise<any> {
    const connector = this.connectorRegistry.getConnector(step.connector);
    if (!connector) {
      throw new Error(`Connector not found: ${step.connector}`);
    }
    
    // Prepare input
    const input = step.inputMapper(context);
    
    // Check idempotency
    if (step.idempotencyKey) {
      const existing = await this.checkIdempotency(step.idempotencyKey);
      if (existing) return existing;
    }
    
    // Execute with retries
    let lastError: Error | null = null;
    const retryPolicy = step.retryPolicy || definition.retryPolicy || this.getDefaultRetryPolicy();
    
    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        const result = await connector.execute(step.operation, input);
        
        // Store idempotency result
        if (step.idempotencyKey) {
          await this.storeIdempotency(step.idempotencyKey, result);
        }
        
        // Store compensation data if step has compensation
        if (step.compensation) {
          context.compensationData.set(step.id, {
            compensation: step.compensation,
            stepOutput: result
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retryPolicy.maxRetries) {
          const delay = this.calculateBackoff(attempt, retryPolicy);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError!;
  }
  
  private async compensate(
    plan: CompensationPlan,
    context: SagaContext
  ): Promise<void> {
    const stepsToCompensate = plan.strategy === 'backward'
      ? Array.from(context.stepOutputs.keys()).reverse()
      : Array.from(context.stepOutputs.keys());
    
    for (const stepId of stepsToCompensate) {
      const compData = context.compensationData.get(stepId);
      if (!compData) continue;
      
      try {
        const connector = this.connectorRegistry.getConnector(compData.compensation.connector);
        if (!connector) continue;
        
        const compensationInput = compData.compensation.inputMapper(context, compData.stepOutput);
        await connector.execute(compData.compensation.operation, compensationInput);
        
      } catch (error) {
        // Log but continue compensation
        console.error(`Compensation failed for step ${stepId}:`, error);
      }
    }
  }
  
  private async checkIdempotency(key: string): Promise<unknown> {
    const result = await this.memory.getById(`idempotency:${key}`);
    return result ? JSON.parse(result.content) : null;
  }
  
  private async storeIdempotency(key: string, result: any): Promise<void> {
    await this.memory.insert([{
      id: `idempotency:${key}`,
      type: 'episodic',
      tier: 2,
      content: JSON.stringify(result),
      embedding: new Array(384).fill(0.1),
      metadata: { domain: 'saga', taskType: 'idempotency', mode: 'system', context: 'idempotency storage', tags: ['idempotency'] },
      provenance: { agentId: 'saga-orchestrator', sessionId: 'current', source: 'agent', timestamp: new Date() },
      reward: 1,
      verdict: 'success' as const,
      consolidated: false,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date()
    }]);
  }
  
  private getDefaultRetryPolicy(): RetryPolicy {
    return {
      maxRetries: 3,
      backoff: 'exponential',
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      retryableErrors: ['timeout', 'unavailable', 'rate_limit']
    };
  }
  
  private calculateBackoff(attempt: number, policy: RetryPolicy): number {
    let delay: number;
    
    switch (policy.backoff) {
      case 'exponential':
        delay = policy.baseDelayMs * Math.pow(2, attempt);
        break;
      case 'linear':
        delay = policy.baseDelayMs * (attempt + 1);
        break;
      case 'fixed':
      default:
        delay = policy.baseDelayMs;
        break;
    }
    
    return Math.min(delay, policy.maxDelayMs);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private async persistExecution(execution: SagaExecution): Promise<void> {
    await this.memory.insert([{
      id: `saga:${execution.id}`,
      type: 'episodic',
      tier: 2,
      content: JSON.stringify({
        ...execution,
        context: {
          ...execution.context,
          stepOutputs: Array.from(execution.context.stepOutputs.entries()),
          compensationData: Array.from(execution.context.compensationData.entries())
        }
      }),
      embedding: new Array(384).fill(0.1),
      metadata: { domain: 'saga', taskType: 'execution', mode: 'orchestration', context: 'saga execution persistence', tags: ['saga', 'execution', 'persistence'] },
      provenance: { agentId: 'saga-orchestrator', sessionId: execution.context.executionId, source: 'agent', timestamp: new Date() },
      reward: execution.status === 'completed' ? 1 : 0,
      consolidated: false,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date()
    }]);
  }
  
  getExecution(executionId: string): SagaExecution | undefined {
    return this.executions.get(executionId);
  }
  
  getRunningExecutions(): SagaExecution[] {
    return Array.from(this.executions.values()).filter(e => e.status === 'running');
  }
}
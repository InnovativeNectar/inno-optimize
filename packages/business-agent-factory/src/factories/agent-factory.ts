import type { BusinessAgentTemplate, TemplateManager } from '../templates/manager.js';

export interface AgentConfig {
  templateId: string;
  customizations?: Partial<BusinessAgentTemplate>;
  memoryOverrides?: {
    workingMemorySize?: number;
    episodicRetentionDays?: number;
  };
  toolOverrides?: string[];
}

export class AgentFactory {
  constructor(private templateManager: TemplateManager) {}
  
  async createAgent(config: AgentConfig): Promise<BusinessAgentInstance> {
    const template = this.templateManager.get(config.templateId);
    if (!template) {
      throw new Error(`Template not found: ${config.templateId}`);
    }
    
    const mergedTemplate: BusinessAgentTemplate = {
      ...template,
      ...config.customizations,
      memoryConfig: {
        ...template.memoryConfig,
        ...config.memoryOverrides
      },
      tools: config.toolOverrides ? [...template.tools, ...config.toolOverrides] : template.tools
    };
    
    return new BusinessAgentInstance(mergedTemplate);
  }
  
  createAgentSync(config: AgentConfig): BusinessAgentInstance {
    const template = this.templateManager.get(config.templateId);
    if (!template) {
      throw new Error(`Template not found: ${config.templateId}`);
    }
    
    const mergedTemplate: BusinessAgentTemplate = {
      ...template,
      ...config.customizations,
      memoryConfig: {
        ...template.memoryConfig,
        ...config.memoryOverrides
      },
      tools: config.toolOverrides ? [...template.tools, ...config.toolOverrides] : template.tools
    };
    
    return new BusinessAgentInstance(mergedTemplate);
  }
}

export class BusinessAgentInstance {
  private template: BusinessAgentTemplate;
  private memory: Map<string, unknown> = new Map();
  
  constructor(template: BusinessAgentTemplate) {
    this.template = template;
  }
  
  getTemplate(): BusinessAgentTemplate {
    return { ...this.template };
  }
  
  async execute(task: string, _context?: unknown): Promise<AgentExecutionResult> {
    // In production, this would use the LLM with the template's prompt
    return {
      agentId: this.template.id,
      task,
      result: `Executed by ${this.template.name}`,
      timestamp: new Date()
    };
  }
  
  remember(key: string, value: unknown): void {
    this.memory.set(key, value);
  }
  
  recall(key: string): unknown {
    return this.memory.get(key);
  }
  
  getCapabilities(): string[] {
    return this.template.capabilities;
  }
}

export interface AgentExecutionResult {
  agentId: string;
  task: string;
  result: string;
  timestamp: Date;
}

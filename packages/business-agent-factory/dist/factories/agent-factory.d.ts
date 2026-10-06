import { BusinessAgentTemplate, TemplateManager } from '../templates/manager.js';
export interface AgentConfig {
    templateId: string;
    customizations?: Partial<BusinessAgentTemplate>;
    memoryOverrides?: {
        workingMemorySize?: number;
        episodicRetentionDays?: number;
    };
    toolOverrides?: string[];
}
export declare class AgentFactory {
    private templateManager;
    constructor(templateManager: TemplateManager);
    createAgent(config: AgentConfig): Promise<BusinessAgentInstance>;
    createAgentSync(config: AgentConfig): BusinessAgentInstance;
}
export declare class BusinessAgentInstance {
    private template;
    private memory;
    constructor(template: BusinessAgentTemplate);
    getTemplate(): BusinessAgentTemplate;
    execute(task: string, context?: any): Promise<any>;
    remember(key: string, value: any): void;
    recall(key: string): any;
    getCapabilities(): string[];
}
//# sourceMappingURL=agent-factory.d.ts.map
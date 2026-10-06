export interface BusinessAgentTemplate {
    id: string;
    name: string;
    description: string;
    domain: string;
    department: string;
    capabilities: string[];
    tools: string[];
    memoryConfig: {
        workingMemorySize: number;
        episodicRetentionDays: number;
        semanticPatterns: string[];
    };
    promptTemplate: string;
    examples: Array<{
        input: string;
        output: string;
    }>;
    constraints: string[];
}
export declare class TemplateManager {
    private templates;
    register(template: BusinessAgentTemplate): void;
    get(id: string): BusinessAgentTemplate | undefined;
    list(): BusinessAgentTemplate[];
    listByDomain(domain: string): BusinessAgentTemplate[];
    listByDepartment(department: string): BusinessAgentTemplate[];
}
//# sourceMappingURL=manager.d.ts.map
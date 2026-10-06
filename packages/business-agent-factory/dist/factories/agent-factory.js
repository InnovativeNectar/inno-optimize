export class AgentFactory {
    templateManager;
    constructor(templateManager) {
        this.templateManager = templateManager;
    }
    async createAgent(config) {
        const template = this.templateManager.get(config.templateId);
        if (!template) {
            throw new Error(`Template not found: ${config.templateId}`);
        }
        const mergedTemplate = {
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
    createAgentSync(config) {
        const template = this.templateManager.get(config.templateId);
        if (!template) {
            throw new Error(`Template not found: ${config.templateId}`);
        }
        const mergedTemplate = {
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
    template;
    memory = new Map();
    constructor(template) {
        this.template = template;
    }
    getTemplate() {
        return { ...this.template };
    }
    async execute(task, context) {
        // In production, this would use the LLM with the template's prompt
        return {
            agentId: this.template.id,
            task,
            result: `Executed by ${this.template.name}`,
            timestamp: new Date()
        };
    }
    remember(key, value) {
        this.memory.set(key, value);
    }
    recall(key) {
        return this.memory.get(key);
    }
    getCapabilities() {
        return this.template.capabilities;
    }
}
//# sourceMappingURL=agent-factory.js.map
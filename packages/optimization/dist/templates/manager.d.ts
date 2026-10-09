import { Template, TemplateInstance } from '../types.js';
import { FastStore } from '@inno-optimize/agentdb';
export declare class TemplateManager {
    private memory;
    private templates;
    private instances;
    private loadBuiltinTemplates;
    constructor(memory: FastStore);
    registerTemplate(template: Template): void;
    getTemplate(id: string): Template | undefined;
    listTemplates(category?: string): Template[];
    getTemplatesByCategory(): Map<string, Template[]>;
    instantiateTemplate(templateId: string, values: Record<string, any>): TemplateInstance;
    renderTemplate(templateId: string, values: Record<string, any>): string;
    getInstance(instanceId: string): TemplateInstance | undefined;
    listInstances(templateId?: string): TemplateInstance[];
    saveInstanceOutput(instanceId: string, outputPath: string): Promise<void>;
    searchTemplates(query: string): Template[];
    exportTemplate(templateId: string): string;
    importTemplate(json: string): Template;
    private loadFromMemory;
    getAllTemplates(): Template[];
    getTemplateCount(): number;
}
//# sourceMappingURL=manager.d.ts.map
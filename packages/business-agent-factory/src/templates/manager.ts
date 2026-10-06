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
  examples: Array<{ input: string; output: string }>;
  constraints: string[];
}

export class TemplateManager {
  private templates = new Map<string, BusinessAgentTemplate>();
  
  register(template: BusinessAgentTemplate): void {
    this.templates.set(template.id, template);
  }
  
  get(id: string): BusinessAgentTemplate | undefined {
    return this.templates.get(id);
  }
  
  list(): BusinessAgentTemplate[] {
    return Array.from(this.templates.values());
  }
  
  listByDomain(domain: string): BusinessAgentTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.domain === domain);
  }
  
  listByDepartment(department: string): BusinessAgentTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.department === department);
  }
}

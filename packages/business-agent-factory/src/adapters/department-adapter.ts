export interface DepartmentConfig {
  name: string;
  tools: string[];
  templates: string[];
  memorySettings: {
    workingMemorySize: number;
    episodicRetentionDays: number;
  };
}

export class DepartmentAdapter {
  private configs = new Map<string, DepartmentConfig>();
  
  register(config: DepartmentConfig): void {
    this.configs.set(config.name, config);
  }
  
  get(name: string): DepartmentConfig | undefined {
    return this.configs.get(name);
  }
  
  getTools(department: string): string[] {
    return this.configs.get(department)?.tools ?? [];
  }
  
  getTemplates(department: string): string[] {
    return this.configs.get(department)?.templates ?? [];
  }
  
  getMemorySettings(department: string) {
    return this.configs.get(department)?.memorySettings ?? {
      workingMemorySize: 1000,
      episodicRetentionDays: 30
    };
  }
  
  listDepartments(): string[] {
    return Array.from(this.configs.keys());
  }
}

// Predefined department configurations
export const DEFAULT_DEPARTMENTS: DepartmentConfig[] = [
  {
    name: 'sales',
    tools: ['crm', 'email', 'calendar', 'proposal-generator'],
    templates: ['sales-rep', 'account-manager', 'sales-engineer'],
    memorySettings: { workingMemorySize: 2000, episodicRetentionDays: 90 }
  },
  {
    name: 'marketing',
    tools: ['analytics', 'social-media', 'content-generator', 'campaign-manager'],
    templates: ['content-marketer', 'seo-specialist', 'growth-hacker'],
    memorySettings: { workingMemorySize: 1500, episodicRetentionDays: 60 }
  },
  {
    name: 'engineering',
    tools: ['github', 'jira', 'ci-cd', 'code-review', 'docs'],
    templates: ['backend-dev', 'frontend-dev', 'devops', 'qa-engineer'],
    memorySettings: { workingMemorySize: 3000, episodicRetentionDays: 180 }
  },
  {
    name: 'support',
    tools: ['ticketing', 'knowledge-base', 'chat', 'escalation'],
    templates: ['support-agent', 'technical-support', 'customer-success'],
    memorySettings: { workingMemorySize: 1500, episodicRetentionDays: 90 }
  },
  {
    name: 'operations',
    tools: ['monitoring', 'incident-management', 'runbooks', 'automation'],
    templates: ['site-reliability', 'platform-engineer', 'release-manager'],
    memorySettings: { workingMemorySize: 2000, episodicRetentionDays: 180 }
  },
  {
    name: 'finance',
    tools: ['erp', 'budgeting', 'reporting', 'compliance'],
    templates: ['financial-analyst', 'accountant', 'treasury-manager'],
    memorySettings: { workingMemorySize: 1500, episodicRetentionDays: 365 }
  },
  {
    name: 'hr',
    tools: ['ats', 'hris', 'payroll', 'learning'],
    templates: ['recruiter', 'hr-business-partner', 'learning-developer'],
    memorySettings: { workingMemorySize: 1500, episodicRetentionDays: 365 }
  },
  {
    name: 'product',
    tools: ['roadmap', 'analytics', 'user-research', 'prototyping'],
    templates: ['product-manager', 'product-analyst', 'ux-researcher'],
    memorySettings: { workingMemorySize: 2000, episodicRetentionDays: 180 }
  },
  {
    name: 'legal',
    tools: ['contract-management', 'compliance', 'research', 'docusign'],
    templates: ['corporate-counsel', 'contract-manager', 'compliance-officer'],
    memorySettings: { workingMemorySize: 1500, episodicRetentionDays: 365 }
  },
  {
    name: 'security',
    tools: ['vulnerability-scanner', 'siem', 'iam', 'penetration-testing'],
    templates: ['security-analyst', 'penetration-tester', 'compliance-auditor'],
    memorySettings: { workingMemorySize: 2000, episodicRetentionDays: 180 }
  },
  {
    name: 'data',
    tools: ['data-warehouse', 'bi-tools', 'ml-platform', 'etl'],
    templates: ['data-engineer', 'data-scientist', 'ml-engineer', 'analytics-engineer'],
    memorySettings: { workingMemorySize: 3000, episodicRetentionDays: 180 }
  }
];

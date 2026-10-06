export interface BusinessDomain {
  id: string;
  name: string;
  description: string;
  departments: string[];
  keyMetrics: string[];
  commonWorkflows: string[];
}

export class BusinessDomainRegistry {
  private domains = new Map<string, BusinessDomain>();
  
  register(domain: BusinessDomain): void {
    this.domains.set(domain.id, domain);
  }
  
  get(id: string): BusinessDomain | undefined {
    return this.domains.get(id);
  }
  
  list(): BusinessDomain[] {
    return Array.from(this.domains.values());
  }
  
  getByDepartment(department: string): BusinessDomain[] {
    return Array.from(this.domains.values()).filter(d => d.departments.includes(department));
  }
}

export const STANDARD_DOMAINS: BusinessDomain[] = [
  {
    id: 'revenue',
    name: 'Revenue Generation',
    description: 'All activities related to generating revenue',
    departments: ['sales', 'marketing', 'partnerships'],
    keyMetrics: ['ARR', 'MRR', 'CAC', 'LTV', 'Pipeline Velocity'],
    commonWorkflows: ['lead-to-cash', 'quote-to-order', 'renewal-management']
  },
  {
    id: 'product-delivery',
    name: 'Product Delivery',
    description: 'Building and delivering products to customers',
    departments: ['engineering', 'product', 'qa', 'devops'],
    keyMetrics: ['Velocity', 'Cycle Time', 'Defect Rate', 'Deployment Frequency'],
    commonWorkflows: ['feature-development', 'release-management', 'incident-response']
  },
  {
    id: 'customer-success',
    name: 'Customer Success',
    description: 'Ensuring customer satisfaction and retention',
    departments: ['support', 'customer-success', 'services'],
    keyMetrics: ['NPS', 'CSAT', 'Churn Rate', 'Expansion Revenue', 'Time to Resolution'],
    commonWorkflows: ['onboarding', 'support-ticket', 'quarterly-business-review']
  },
  {
    id: 'operations',
    name: 'Operations & Infrastructure',
    description: 'Keeping the business running smoothly',
    departments: ['operations', 'security', 'finance', 'legal', 'hr'],
    keyMetrics: ['Uptime', 'Incident MTTR', 'Compliance Score', 'Cost per Transaction'],
    commonWorkflows: ['deployment', 'security-audit', 'budget-planning', 'hiring']
  },
  {
    id: 'data-intelligence',
    name: 'Data & Intelligence',
    description: 'Data-driven decision making and ML',
    departments: ['data', 'analytics', 'ml', 'bi'],
    keyMetrics: ['Data Quality', 'Model Accuracy', 'Query Performance', 'Insight Adoption'],
    commonWorkflows: ['etl-pipeline', 'model-training', 'dashboard-creation', 'ab-testing']
  }
];

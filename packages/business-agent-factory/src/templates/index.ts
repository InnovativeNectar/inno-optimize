import type { BusinessAgentTemplate} from './manager.js';
import { TemplateManager } from './manager.js';


// data
import { analyticsEngineerTemplate } from './data/analytics-engineer.template.js';
import { dataEngineerTemplate } from './data/data-engineer.template.js';
import { dataScientistTemplate } from './data/data-scientist.template.js';
import { mlEngineerTemplate } from './data/ml-engineer.template.js';

// engineering
import { backendDevTemplate } from './engineering/backend-dev.template.js';
import { devopsTemplate } from './engineering/devops.template.js';
import { frontendDevTemplate } from './engineering/frontend-dev.template.js';
import { qaEngineerTemplate } from './engineering/qa-engineer.template.js';

// finance
import { accountantTemplate } from './finance/accountant.template.js';
import { financialAnalystTemplate } from './finance/financial-analyst.template.js';
import { treasuryManagerTemplate } from './finance/treasury-manager.template.js';

// hr
import { hrBusinessPartnerTemplate } from './hr/hr-business-partner.template.js';
import { learningDeveloperTemplate } from './hr/learning-developer.template.js';
import { recruiterTemplate } from './hr/recruiter.template.js';

// legal
import { complianceOfficerTemplate } from './legal/compliance-officer.template.js';
import { contractManagerTemplate } from './legal/contract-manager.template.js';
import { corporateCounselTemplate } from './legal/corporate-counsel.template.js';

// marketing
import { contentMarketerTemplate } from './marketing/content-marketer.template.js';
import { growthHackerTemplate } from './marketing/growth-hacker.template.js';
import { seoSpecialistTemplate } from './marketing/seo-specialist.template.js';

// operations
import { platformEngineerTemplate } from './operations/platform-engineer.template.js';
import { releaseManagerTemplate } from './operations/release-manager.template.js';
import { siteReliabilityTemplate } from './operations/site-reliability.template.js';

// product
import { productAnalystTemplate } from './product/product-analyst.template.js';
import { productManagerTemplate } from './product/product-manager.template.js';
import { uxResearcherTemplate } from './product/ux-researcher.template.js';

// sales
import { accountManagerTemplate } from './sales/account-manager.template.js';
import { salesEngineerTemplate } from './sales/sales-engineer.template.js';
import { salesRepTemplate } from './sales/sales-rep.template.js';

// security
import { complianceAuditorTemplate } from './security/compliance-auditor.template.js';
import { penetrationTesterTemplate } from './security/penetration-tester.template.js';
import { securityAnalystTemplate } from './security/security-analyst.template.js';

// support
import { customerSuccessTemplate } from './support/customer-success.template.js';
import { supportAgentTemplate } from './support/support-agent.template.js';
import { technicalSupportTemplate } from './support/technical-support.template.js';

/** All built-in business agent templates (35 templates across 11 categories). */
export const DEFAULT_TEMPLATES: BusinessAgentTemplate[] = [
  analyticsEngineerTemplate, dataEngineerTemplate, dataScientistTemplate, mlEngineerTemplate, backendDevTemplate, devopsTemplate, frontendDevTemplate, qaEngineerTemplate, accountantTemplate, financialAnalystTemplate, treasuryManagerTemplate, hrBusinessPartnerTemplate, learningDeveloperTemplate, recruiterTemplate, complianceOfficerTemplate, contractManagerTemplate, corporateCounselTemplate, contentMarketerTemplate, growthHackerTemplate, seoSpecialistTemplate, platformEngineerTemplate, releaseManagerTemplate, siteReliabilityTemplate, productAnalystTemplate, productManagerTemplate, uxResearcherTemplate, accountManagerTemplate, salesEngineerTemplate, salesRepTemplate, complianceAuditorTemplate, penetrationTesterTemplate, securityAnalystTemplate, customerSuccessTemplate, supportAgentTemplate, technicalSupportTemplate
];

/** Register every built-in template on a TemplateManager. */
export function registerDefaultTemplates(manager: TemplateManager): TemplateManager {
  for (const template of DEFAULT_TEMPLATES) {
    manager.register(template);
  }
  return manager;
}

/** Create a TemplateManager pre-loaded with all built-in templates. */
export function createDefaultTemplateManager(): TemplateManager {
  return registerDefaultTemplates(new TemplateManager());
}


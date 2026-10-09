import { describe, it, expect } from 'vitest';
import {
  TemplateManager,
  AgentFactory,
  BusinessAgentInstance,
  DepartmentAdapter,
  DEFAULT_DEPARTMENTS,
  DEFAULT_TEMPLATES,
  registerDefaultTemplates,
  createDefaultTemplateManager
} from '../index.js';
import type { BusinessAgentTemplate } from '../index.js';

describe('business-agent-factory', () => {
  describe('template registration', () => {
    it('exposes 35 built-in templates with unique ids', () => {
      expect(DEFAULT_TEMPLATES).toHaveLength(35);

      const ids = DEFAULT_TEMPLATES.map(t => t.id);
      expect(new Set(ids).size).toBe(35);
      expect(ids).toContain('sales-rep');
      expect(ids).toContain('backend-dev');
    });

    it('every template has the full BusinessAgentTemplate shape', () => {
      for (const t of DEFAULT_TEMPLATES) {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.domain).toBeTruthy();
        expect(t.department).toBeTruthy();
        expect(t.capabilities.length).toBeGreaterThan(0);
        expect(Array.isArray(t.tools)).toBe(true);
        expect(t.memoryConfig.workingMemorySize).toBeGreaterThan(0);
        expect(t.memoryConfig.episodicRetentionDays).toBeGreaterThan(0);
        expect(Array.isArray(t.memoryConfig.semanticPatterns)).toBe(true);
        expect(t.promptTemplate).toBeTruthy();
        expect(Array.isArray(t.examples)).toBe(true);
        expect(Array.isArray(t.constraints)).toBe(true);
      }
    });

    it('covers the five business domains', () => {
      const domains = new Set(DEFAULT_TEMPLATES.map(t => t.domain));
      expect(domains).toEqual(
        new Set(['revenue', 'operations', 'product-delivery', 'data-intelligence', 'customer-success'])
      );
    });

    it('registers templates on a custom manager', () => {
      const manager = new TemplateManager();
      expect(manager.list()).toHaveLength(0);

      registerDefaultTemplates(manager);
      expect(manager.list()).toHaveLength(35);
      expect(manager.get('sales-rep')?.name).toBeTruthy();
    });

    it('createDefaultTemplateManager returns a pre-loaded manager', () => {
      const manager = createDefaultTemplateManager();
      expect(manager.list()).toHaveLength(35);
      expect(manager.listByDomain('revenue').length).toBeGreaterThanOrEqual(5);
      expect(manager.listByDepartment('engineering')).toHaveLength(4);
    });

    it('domain and department filters agree with the template fields', () => {
      const manager = createDefaultTemplateManager();
      for (const t of manager.listByDomain('operations')) {
        expect(t.domain).toBe('operations');
      }
      for (const t of manager.listByDepartment('engineering')) {
        expect(t.department).toBe('engineering');
      }
      expect(manager.get('does-not-exist')).toBeUndefined();
    });
  });

  describe('AgentFactory', () => {
    it('creates an agent from a registered template (async)', async () => {
      const factory = new AgentFactory(createDefaultTemplateManager());
      const instance = await factory.createAgent({ templateId: 'sales-rep' });

      expect(instance).toBeInstanceOf(BusinessAgentInstance);
      expect(instance.getTemplate().id).toBe('sales-rep');
      expect(instance.getCapabilities()).toEqual(
        DEFAULT_TEMPLATES.find(t => t.id === 'sales-rep')?.capabilities
      );
    });

    it('throws for an unknown template (sync and async)', async () => {
      const factory = new AgentFactory(createDefaultTemplateManager());

      expect(() => factory.createAgentSync({ templateId: 'ghost' })).toThrow(
        'Template not found: ghost'
      );
      await expect(factory.createAgent({ templateId: 'ghost' })).rejects.toThrow(
        'Template not found: ghost'
      );
    });

    it('merges customizations, memory overrides and tool overrides', async () => {
      const factory = new AgentFactory(createDefaultTemplateManager());
      const base = DEFAULT_TEMPLATES.find(t => t.id === 'backend-dev')!;

      const instance = await factory.createAgent({
        templateId: 'backend-dev',
        customizations: { name: 'Custom Backend Dev' },
        memoryOverrides: { workingMemorySize: 9999 },
        toolOverrides: ['deploy-staging']
      });

      const template = instance.getTemplate();
      expect(template.name).toBe('Custom Backend Dev');
      expect(template.id).toBe('backend-dev');
      expect(template.memoryConfig.workingMemorySize).toBe(9999);
      expect(template.memoryConfig.episodicRetentionDays).toBe(base.memoryConfig.episodicRetentionDays);
      expect(template.tools).toEqual([...base.tools, 'deploy-staging']);
    });

    it('does not mutate the registered template when customizing', async () => {
      const manager = createDefaultTemplateManager();
      const factory = new AgentFactory(manager);

      await factory.createAgent({
        templateId: 'qa-engineer',
        customizations: { name: 'Renamed' }
      });

      expect(manager.get('qa-engineer')?.name).not.toBe('Renamed');
    });
  });

  describe('BusinessAgentInstance', () => {
    it('executes a task and reports its identity', async () => {
      const factory = new AgentFactory(createDefaultTemplateManager());
      const instance = await factory.createAgent({ templateId: 'content-marketer' });

      const result = await instance.execute('Draft a launch blog post');

      expect(result.agentId).toBe('content-marketer');
      expect(result.task).toBe('Draft a launch blog post');
      expect(result.result).toContain('Executed by');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('keeps per-instance memory', () => {
      const factory = new AgentFactory(createDefaultTemplateManager());
      const instance = factory.createAgentSync({ templateId: 'accountant' });

      expect(instance.recall('missing')).toBeUndefined();
      instance.remember('close-date', '2026-12-31');
      expect(instance.recall('close-date')).toBe('2026-12-31');
    });
  });

  describe('DepartmentAdapter', () => {
    it('registers default departments with tools and templates', () => {
      const adapter = new DepartmentAdapter();
      for (const dept of DEFAULT_DEPARTMENTS) adapter.register(dept);

      expect(adapter.listDepartments()).toContain('engineering');
      expect(adapter.getTools('engineering')).toEqual(['github', 'jira', 'ci-cd', 'code-review', 'docs']);
      expect(adapter.getTemplates('engineering')).toEqual([
        'backend-dev',
        'frontend-dev',
        'devops',
        'qa-engineer'
      ]);
      expect(adapter.getMemorySettings('engineering')?.workingMemorySize).toBe(3000);
      expect(adapter.get('nope')).toBeUndefined();
      expect(adapter.getTemplates('nope')).toEqual([]);
    });

    it('every configured department template exists in the registry', () => {
      const ids = new Set(DEFAULT_TEMPLATES.map(t => t.id));

      for (const dept of DEFAULT_DEPARTMENTS) {
        for (const templateId of dept.templates) {
          expect(ids.has(templateId), `${dept.name} → ${templateId}`).toBe(true);
        }
      }
    });

    it('every template department appears in DEFAULT_DEPARTMENTS', () => {
      const depts = new Set(DEFAULT_DEPARTMENTS.map(d => d.name));
      for (const t of DEFAULT_TEMPLATES) {
        expect(depts.has(t.department), `${t.id} → ${t.department}`).toBe(true);
      }
    });
  });
});

// Type-level sanity: exports are structurally usable as the public API.
const _shapeCheck: BusinessAgentTemplate = DEFAULT_TEMPLATES[0]!;
void _shapeCheck;

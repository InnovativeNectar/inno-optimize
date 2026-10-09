import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  ToolDescriptor} from '../index.js';
import { 
  MCPServerRegistry, 
  ToolRouter, 
  CodemodRegistry, 
  PatternMemory,
  createBuiltinCodemods,
  ToolResult
} from '../index.js';

describe('MCP Framework', () => {
  let registry: MCPServerRegistry;
  let router: ToolRouter;
  let codemodRegistry: CodemodRegistry;
  let patternMemory: PatternMemory;

  beforeEach(() => {
    registry = new MCPServerRegistry();
    codemodRegistry = new CodemodRegistry();
    patternMemory = new PatternMemory();
    router = new ToolRouter(codemodRegistry, patternMemory);
    
    // Register built-in codemods
    for (const codemod of createBuiltinCodemods()) {
      codemodRegistry.register(codemod);
    }
  });

  describe('MCPServerRegistry', () => {
    it('should register and retrieve servers', () => {
      const server = {
        id: 'test-server',
        name: 'Test Server',
        version: '1.0.0',
        transport: 'stdio' as const,
        command: 'npx',
        args: ['test'],
        tools: [],
        resources: [],
        prompts: [],
        tier: 2 as const,
        tags: ['test'],
        capabilities: ['read'],
        destructive: false,
        healthCheck: { enabled: true, intervalMs: 30000, timeoutMs: 5000 },
        rateLimits: { requestsPerMinute: 60 }
      };

      registry.register(server);
      const retrieved = registry.get('test-server');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Server');
    });

    it('should search servers by capability', () => {
      const server1 = { ...createTestServer('server-1'), capabilities: ['read', 'write'] };
      const server2 = { ...createTestServer('server-2'), capabilities: ['read'] };
      
      registry.register(server1);
      registry.register(server2);
      
      const results = registry.search({ capabilities: ['write'], limit: 10 });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('server-1');
    });

    it('should search servers by tier', () => {
      const server1 = { ...createTestServer('server-1'), tier: 1 as const };
      const server2 = { ...createTestServer('server-2'), tier: 3 as const };
      
      registry.register(server1);
      registry.register(server2);
      
      const results = registry.search({ tier: 2, limit: 10 });
      expect(results.length).toBe(1);
      expect(results[0].tier).toBeLessThanOrEqual(2);
    });
  });

  describe('CodemodRegistry', () => {
    it('should find matching codemod for var declaration', () => {
      const code = 'var x = 1;';
      const codemod = codemodRegistry.findMatching(code);
      
      expect(codemod).toBeDefined();
      expect(codemod?.id).toBe('const-conversion');
    });

    it('should find matching codemod for console.log', () => {
      const code = 'console.log("hello");';
      const codemod = codemodRegistry.findMatching(code);
      
      expect(codemod).toBeDefined();
      expect(codemod?.id).toBe('remove-console');
    });

    it('should return null for non-matching code', () => {
      const code = 'const x = 1;';
      const codemod = codemodRegistry.findMatching(code);
      
      expect(codemod).toBeNull();
    });
  });

  describe('ToolRouter', () => {
    const mockTools: ToolDescriptor[] = [
      {
        id: 'tool-1',
        name: 'read_file',
        description: 'Read a file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { content: { type: 'string' } } },
        serverId: 'filesystem',
        tier: 1,
        capabilities: ['read'],
        destructive: false
      },
      {
        id: 'tool-2',
        name: 'write_file',
        description: 'Write a file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } },
        serverId: 'filesystem',
        tier: 2,
        capabilities: ['write'],
        destructive: false
      }
    ];

    it('should route to Tier 1 for deterministic codemod', async () => {
      const task = {
        id: 'task-1',
        type: 'refactor',
        description: 'Convert var to const',
        codeContext: 'var x = 1;',
        constraints: [],
        acceptanceCriteria: [],
        mode: 'convergent' as const
      };

      const route = await router.route(task, mockTools);
      
      expect(route.modelTier).toBe(1);
      expect(route.selectedTool.name).toBe('const-conversion');
      expect(route.reasoning).toContain('Deterministic codemod');
    });

    it('should route to Tier 3 for complex task', async () => {
      const task = {
        id: 'task-2',
        type: 'architecture',
        description: 'Design microservices architecture for e-commerce platform',
        constraints: ['scalability', 'security'],
        acceptanceCriteria: ['handles 10k RPS', 'PCI compliant'],
        mode: 'systems' as const
      };

      const route = await router.route(task, mockTools);
      
      expect(route.modelTier).toBe(3);
      expect(route.reasoning).toContain('Complex task requiring reasoning');
    });
  });

  describe('PatternMemory', () => {
    it('should store and retrieve patterns', () => {
      const pattern = {
        id: 'pattern-1',
        title: 'Test Pattern',
        description: 'A test pattern for routing',
        content: 'pattern content',
        reward: 0.9,
        mode: 'convergent',
        verdict: 'success' as const,
        loraWeights: {},
        consolidated: true,
        createdAt: new Date()
      };

      patternMemory.store(pattern);
      const retrieved = patternMemory.get('pattern-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Test Pattern');
    });
  });
});

function createTestServer(id: string) {
  return {
    id,
    name: `Test Server ${id}`,
    version: '1.0.0',
    transport: 'stdio' as const,
    command: 'npx',
    args: ['test'],
    tools: [],
    resources: [],
    prompts: [],
    tier: 2 as const,
    tags: ['test'],
    capabilities: ['read'],
    destructive: false,
    healthCheck: { enabled: true, intervalMs: 30000, timeoutMs: 5000 },
    rateLimits: { requestsPerMinute: 60 }
  };
}
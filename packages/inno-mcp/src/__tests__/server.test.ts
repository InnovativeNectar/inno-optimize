import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createInnoOptimizeServer } from '../server.js';

interface CallToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

function textOf(result: CallToolResult): string {
  const part = result.content[0];
  return part?.text ?? '';
}

function payloadOf(result: CallToolResult): unknown {
  expect(result.isError).not.toBe(true);
  return JSON.parse(textOf(result));
}

describe('inno-optimize MCP server', () => {
  let server: McpServer;
  let client: Client;

  beforeAll(async () => {
    server = await createInnoOptimizeServer({ memoryPath: ':memory:' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'inno-mcp-test', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  it('exposes the full tool surface', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();

    expect(tools.length).toBeGreaterThanOrEqual(12);
    expect(names).toContain('memory_store');
    expect(names).toContain('memory_search');
    expect(names).toContain('memory_stats');
    expect(names).toContain('intelligence_process_task');
    expect(names).toContain('ast_analyze');
    expect(names).toContain('ast_diff');
    expect(names).toContain('adr_generate');
    expect(names).toContain('business_agent_list_templates');
    expect(names).toContain('business_agent_create');
    expect(names).toContain('business_agent_execute');
    expect(names).toContain('coordination_servers');
    expect(names).toContain('optimization_templates');

    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('round-trips a memory entry through store and search', async () => {
    const stored = payloadOf(
      await client.callTool({
        name: 'memory_store',
        arguments: {
          content: 'The quick brown fox jumps over the lazy dog near the river bank',
          domain: 'testing',
          taskType: 'roundtrip',
          tags: ['fox', 'animal'],
        },
      })
    ) as { id: string; type: string };

    expect(stored.id).toMatch(/^mem-/);
    expect(stored.type).toBe('episodic');

    const searched = payloadOf(
      await client.callTool({
        name: 'memory_search',
        arguments: { query: 'quick brown fox', k: 3 },
      })
    ) as { count: number; results: Array<{ id: string; content: string; domain: string; tags: string[] }> };

    expect(searched.count).toBeGreaterThanOrEqual(1);
    const top = searched.results[0];
    expect(top?.id).toBe(stored.id);
    expect(top?.content).toContain('quick brown fox');
    expect(top?.domain).toBe('testing');
    expect(top?.tags).toContain('fox');
  });

  it('reports memory statistics', async () => {
    const stats = payloadOf(await client.callTool({ name: 'memory_stats', arguments: {} })) as {
      path: string;
      dimensions: number;
      storedInSession: number;
    };
    expect(stats.path).toBe(':memory:');
    expect(stats.dimensions).toBe(384);
    expect(stats.storedInSession).toBeGreaterThanOrEqual(1);
  });

  it('routes a task through the intelligence layer', async () => {
    const result = payloadOf(
      await client.callTool({
        name: 'intelligence_process_task',
        arguments: {
          description: 'Refactor the payment saga into two compensation steps',
          type: 'refactor',
          mode: 'convergent',
          constraints: ['keep public API stable'],
          acceptanceCriteria: ['all tests pass'],
        },
      })
    ) as {
      sona: { confidence: number; mode: string; patternId: string };
      routing: { expertId: string; confidence: number };
      pattern: { id: string } | null;
    };

    expect(result.sona.mode).toBe('convergent');
    expect(result.sona.confidence).toBeGreaterThanOrEqual(0);
    expect(result.sona.patternId).toBeTruthy();
    expect(typeof result.routing.expertId).toBe('string');
    expect(result.routing.expertId.length).toBeGreaterThan(0);
  });

  it('analyzes TypeScript source code', async () => {
    const source = [
      'export function add(a: number, b: number): number {',
      '  return a + b;',
      '}',
      'export class Greeter {',
      '  greet(name: string): string { return `hi ${name}`; }',
      '}',
      '',
    ].join('\n');

    const result = payloadOf(
      await client.callTool({
        name: 'ast_analyze',
        arguments: { filePath: 'src/demo.ts', content: source },
      })
    ) as {
      language: string;
      counts: { functions: number; classes: number; parseErrors: number };
      metrics: { linesOfCode: number };
      issues: unknown[];
      totalIssues: number;
    };

    expect(result.language).toBe('typescript');
    expect(result.counts.functions).toBeGreaterThanOrEqual(1);
    expect(result.counts.classes).toBeGreaterThanOrEqual(1);
    expect(result.counts.parseErrors).toBe(0);
    expect(result.metrics.linesOfCode).toBeGreaterThan(0);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('computes a diff between two file versions', async () => {
    const result = payloadOf(
      await client.callTool({
        name: 'ast_diff',
        arguments: {
          oldContent: 'line1\nline2\nline3',
          newContent: 'line1\nchanged\nline3',
          file: 'src/example.ts',
        },
      })
    ) as {
      file: string;
      type: string;
      affectedLines: { start: number; end: number };
      removedLines: number;
      addedLines: number;
    };

    expect(result.file).toBe('src/example.ts');
    expect(result.type).toBe('modified');
    expect(result.affectedLines.start).toBe(2);
    expect(result.addedLines).toBe(1);
    expect(result.removedLines).toBe(1);
  });

  it('generates an ADR without embedding payloads', async () => {
    const result = payloadOf(
      await client.callTool({
        name: 'adr_generate',
        arguments: {
          description: 'Introduce a vector store module for semantic memory',
          affectedFiles: ['src/stores/vector-store.ts'],
          type: 'new_module',
          impact: 'high',
        },
      })
    ) as {
      id: string;
      title: string;
      status: string;
      decision: string;
      semanticAnchors: Array<{ adrId?: string; codeLocation?: unknown; embedding?: unknown }>;
    };

    expect(result.id).toBe('ADR-001');
    expect(result.status).toBe('proposed');
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.decision.length).toBeGreaterThan(0);
    expect(result.semanticAnchors.length).toBeGreaterThanOrEqual(1);
    expect(result.semanticAnchors[0]?.embedding).toBeUndefined();
    expect(result.semanticAnchors[0]?.codeLocation).toBeDefined();
  });

  it('lists business agent templates', async () => {
    const result = payloadOf(
      await client.callTool({ name: 'business_agent_list_templates', arguments: {} })
    ) as { count: number; templates: Array<{ id: string; domain: string; department: string }> };

    expect(result.count).toBe(35);
    const ids = new Set(result.templates.map((template) => template.id));
    expect(ids.size).toBe(35);
    expect(ids.has('sales-rep')).toBe(true);

    const revenue = payloadOf(
      await client.callTool({ name: 'business_agent_list_templates', arguments: { domain: 'revenue' } })
    ) as { count: number };
    expect(revenue.count).toBeGreaterThan(0);
    expect(revenue.count).toBeLessThan(35);
  });

  it('creates and executes a business agent', async () => {
    const created = payloadOf(
      await client.callTool({
        name: 'business_agent_create',
        arguments: { templateId: 'sales-rep' },
      })
    ) as { agentId: string; name: string; capabilities: string[] };

    expect(created.agentId).toBe('agent-1');
    expect(created.capabilities.length).toBeGreaterThan(0);

    const executed = payloadOf(
      await client.callTool({
        name: 'business_agent_execute',
        arguments: { agentId: created.agentId, task: 'Qualify inbound lead Acme Corp' },
      })
    ) as { task: string; result: string };

    expect(executed.task).toBe('Qualify inbound lead Acme Corp');
    expect(executed.result).toContain('Executed by');
  });

  it('returns errors for unknown agents and templates', async () => {
    const unknownAgent = (await client.callTool({
      name: 'business_agent_execute',
      arguments: { agentId: 'agent-999', task: 'anything' },
    })) as CallToolResult;
    expect(unknownAgent.isError).toBe(true);
    expect(textOf(unknownAgent)).toContain('Unknown agent');

    const unknownTemplate = (await client.callTool({
      name: 'business_agent_create',
      arguments: { templateId: 'does-not-exist' },
    })) as CallToolResult;
    expect(unknownTemplate.isError).toBe(true);
    expect(textOf(unknownTemplate)).toContain('Template not found');
  });

  it('lists business MCP servers with tier metadata', async () => {
    const all = payloadOf(
      await client.callTool({ name: 'coordination_servers', arguments: {} })
    ) as {
      count: number;
      servers: Array<{ name: string; tier: number; toolCount: number; capabilities: string[] }>;
    };

    expect(all.count).toBeGreaterThan(0);
    expect(all.servers[0]?.tier).toBeGreaterThanOrEqual(1);

    const orders = payloadOf(
      await client.callTool({ name: 'coordination_servers', arguments: { name: 'business-orders' } })
    ) as { count: number; servers: Array<{ name: string; toolCount: number }> };

    expect(orders.count).toBe(1);
    expect(orders.servers[0]?.name).toBe('business-orders');
    expect(orders.servers[0]?.toolCount).toBeGreaterThan(0);
  });

  it('lists optimization templates with query filter', async () => {
    const all = payloadOf(
      await client.callTool({ name: 'optimization_templates', arguments: {} })
    ) as { count: number; templates: Array<{ id: string; category: string }> };

    expect(all.count).toBeGreaterThan(0);
    expect(all.templates[0]?.category).toBeTruthy();

    const filtered = payloadOf(
      await client.callTool({ name: 'optimization_templates', arguments: { query: 'business' } })
    ) as { count: number };
    expect(filtered.count).toBeGreaterThanOrEqual(0);
    expect(filtered.count).toBeLessThanOrEqual(all.count);
  });
});

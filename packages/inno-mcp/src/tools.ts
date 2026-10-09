import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ArchitecturalChange } from '@inno-optimize/agentdb';
import { ADRGenerator, type MemoryInterface } from '@inno-optimize/adr-automation';
import {
  AntiPatternDetector,
  MultiLanguageParser,
  computeDiff,
} from '@inno-optimize/ast-analysis';
import { businessServers } from '@inno-optimize/coordination';
import {
  AgentFactory,
  createDefaultTemplateManager,
  type BusinessAgentInstance,
  type BusinessAgentTemplate,
} from '@inno-optimize/business-agent-factory';
import {
  IntelligenceLayer,
  type RoutingDecision,
  type SONAAdaptation,
  type TaskContext,
} from '@inno-optimize/intelligence';
import { TemplateManager as OptimizationTemplateManager } from '@inno-optimize/optimization';
import type { MemoryService } from './memory.js';

const MAX_FILE_CHARS = 1_000_000;
const MAX_CONTENT_CHARS = 100_000;

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text', text }] };
}

function fail(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

async function handle(operation: () => unknown): Promise<ToolResult> {
  try {
    return ok(await operation());
  } catch (error) {
    return fail(error);
  }
}

function summarizeLoRA(weights: { rank: number; alpha: number; weightsA: number[][] }): {
  rank: number;
  alpha: number;
  matrices: number;
} {
  return { rank: weights.rank, alpha: weights.alpha, matrices: weights.weightsA.length };
}

function summarizeAdaptation(adaptation: SONAAdaptation): Record<string, unknown> {
  return {
    patternId: adaptation.patternId,
    confidence: adaptation.confidence,
    mode: adaptation.mode,
    extractionTimeMs: adaptation.extractionTimeMs,
    adaptedWeights: summarizeLoRA(adaptation.adaptedWeights),
  };
}

function summarizeRouting(routing: RoutingDecision): Record<string, unknown> {
  return {
    expertId: routing.expertId,
    confidence: routing.confidence,
    loadFactor: routing.loadFactor,
    routingScores: routing.routingScores,
  };
}

export function registerInnoTools(server: McpServer, memory: MemoryService): void {
  const parser = new MultiLanguageParser();
  const detector = new AntiPatternDetector();
  const intelligence = new IntelligenceLayer(memory.store);

  const templateManager = createDefaultTemplateManager();
  const agentFactory = new AgentFactory(templateManager);
  const agents = new Map<string, BusinessAgentInstance>();
  let agentCounter = 0;

  const optimizationTemplates = new OptimizationTemplateManager(memory.store);

  const adrMemory: MemoryInterface = {
    query: async (q: { query?: string; topK?: number } = {}) => {
      const hits = await memory.search(q.query ?? '', q.topK ?? 5);
      return hits.map((hit) => ({
        title: hit.content.slice(0, 140),
        type: hit.type,
        domain: hit.metadata.domain,
      }));
    },
  };
  const adrGenerator = new ADRGenerator(adrMemory, memory.embedder);
  let changeCounter = 0;

  server.registerTool(
    'memory_store',
    {
      title: 'Store memory',
      description:
        'Store a text entry in the persistent vector memory (FastStore + HNSW). Returns the assigned entry id.',
      inputSchema: {
        content: z.string().min(1).describe('Text content to store'),
        domain: z.string().optional().describe('Domain tag, e.g. "sales"'),
        taskType: z.string().optional().describe('Task type tag, e.g. "refactor"'),
        mode: z.string().optional().describe('Cognitive mode tag, e.g. "convergent"'),
        context: z.string().optional().describe('Free-form context'),
        tags: z.array(z.string()).optional().describe('Tags for filtering'),
        type: z.enum(['working', 'episodic', 'semantic']).optional().describe('Memory tier'),
      },
    },
    async (args) =>
      handle(async () => {
        if (args.content.length > MAX_CONTENT_CHARS) {
          throw new Error(`content exceeds ${MAX_CONTENT_CHARS} characters`);
        }
        return memory.add({
          content: args.content,
          domain: args.domain,
          taskType: args.taskType,
          mode: args.mode,
          context: args.context,
          tags: args.tags,
          type: args.type,
        });
      })
  );

  server.registerTool(
    'memory_search',
    {
      title: 'Search memory',
      description:
        'Semantic vector search over stored memory entries. Returns matching entries ordered by relevance.',
      inputSchema: {
        query: z.string().min(1).describe('Natural language query'),
        k: z.number().int().min(1).max(50).optional().describe('Max results (default 5)'),
      },
    },
    async (args) =>
      handle(async () => {
        const entries = await memory.search(args.query, args.k ?? 5);
        return {
          count: entries.length,
          results: entries.map((entry) => ({
            id: entry.id,
            type: entry.type,
            content: entry.content,
            domain: entry.metadata.domain,
            taskType: entry.metadata.taskType,
            tags: entry.metadata.tags,
            createdAt: entry.createdAt,
          })),
        };
      })
  );

  server.registerTool(
    'memory_stats',
    {
      title: 'Memory statistics',
      description: 'Report the active memory store path, embedding dimensions and entries stored this session.',
      inputSchema: {},
    },
    async () => handle(() => memory.stats())
  );

  server.registerTool(
    'intelligence_process_task',
    {
      title: 'Process task through intelligence layer',
      description:
        'Run a task through the SONA adaptation + MoE routing + ReasoningBank pipeline and return the routing decision.',
      inputSchema: {
        description: z.string().min(1).describe('Task description'),
        id: z.string().optional().describe('Task id (auto-generated when omitted)'),
        type: z.string().optional().describe('Task type, e.g. "refactor"'),
        mode: z
          .enum(['convergent', 'divergent', 'lateral', 'systems', 'critical'])
          .optional()
          .describe('Cognitive mode (default convergent)'),
        constraints: z.array(z.string()).optional().describe('Task constraints'),
        acceptanceCriteria: z.array(z.string()).optional().describe('Acceptance criteria'),
        codeContext: z.string().optional().describe('Optional code snippet context'),
      },
    },
    async (args) =>
      handle(async () => {
        const task: TaskContext = {
          id: args.id ?? `task-${Date.now().toString(36)}`,
          type: args.type ?? 'general',
          description: args.description,
          constraints: args.constraints ?? [],
          acceptanceCriteria: args.acceptanceCriteria ?? [],
          mode: args.mode ?? 'convergent',
          ...(args.codeContext !== undefined ? { codeContext: args.codeContext } : {}),
        };
        const result = await intelligence.processTask(task);
        return {
          sona: summarizeAdaptation(result.sonaAdaptation),
          routing: summarizeRouting(result.routing),
          pattern: result.pattern
            ? {
                id: result.pattern.id,
                title: result.pattern.title,
                reward: result.pattern.reward,
                mode: result.pattern.mode,
                verdict: result.pattern.verdict,
                consolidated: result.pattern.consolidated,
              }
            : null,
        };
      })
  );

  server.registerTool(
    'ast_analyze',
    {
      title: 'Analyze source code',
      description:
        'Parse source code with tree-sitter, compute file metrics and detect anti-patterns. Provide "content" directly or "filePath" to read from disk.',
      inputSchema: {
        filePath: z.string().min(1).describe('Path used for language detection and reporting'),
        content: z.string().optional().describe('Source code; read from filePath when omitted'),
        maxIssues: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('Max issues to return (default 50)'),
      },
    },
    async (args) =>
      handle(async () => {
        let source: string;
        if (args.content !== undefined) {
          source = args.content;
        } else {
          source = await readFile(args.filePath, 'utf8');
          if (source.length > MAX_FILE_CHARS) {
            throw new Error(`file exceeds ${MAX_FILE_CHARS} characters; pass content explicitly`);
          }
        }
        const result = await parser.parseFile(args.filePath, source);
        const issues = detector.detect(result);
        const maxIssues = args.maxIssues ?? 50;
        return {
          file: result.file,
          language: result.language,
          metrics: result.metrics,
          counts: {
            imports: result.imports.length,
            exports: result.exports.length,
            functions: result.functions.length,
            classes: result.classes.length,
            interfaces: result.interfaces.length,
            parseErrors: result.errors.length,
          },
          issues: issues.slice(0, maxIssues),
          totalIssues: issues.length,
        };
      })
  );

  server.registerTool(
    'ast_diff',
    {
      title: 'Diff two code versions',
      description:
        'Compute a line-based diff between two versions of a file and report the affected line range.',
      inputSchema: {
        oldContent: z.string().describe('Previous version of the file'),
        newContent: z.string().describe('New version of the file'),
        file: z.string().optional().describe('File path to report in the result'),
      },
    },
    async (args) =>
      handle(() => {
        const change = computeDiff(args.oldContent, args.newContent);
        const oldHunk = change.oldContent ?? '';
        const newHunk = change.newContent;
        const removedLines = oldHunk.length === 0 ? 0 : oldHunk.split('\n').length;
        const addedLines = newHunk.length === 0 ? 0 : newHunk.split('\n').length;
        return {
          file: args.file ?? change.file,
          type: change.type,
          affectedLines: change.affectedLines,
          removedLines,
          addedLines,
        };
      })
  );

  server.registerTool(
    'adr_generate',
    {
      title: 'Generate ADR',
      description:
        'Generate an Architecture Decision Record from an architectural change, anchored to relevant code locations.',
      inputSchema: {
        description: z.string().min(1).describe('What changed and why'),
        affectedFiles: z.array(z.string()).min(1).describe('Files affected by the change'),
        type: z
          .enum(['refactor', 'new_module', 'dependency_change', 'pattern_introduction'])
          .describe('Change type'),
        impact: z.enum(['low', 'medium', 'high', 'critical']).describe('Impact level'),
        lineRanges: z
          .record(z.string(), z.object({ start: z.number(), end: z.number() }))
          .optional()
          .describe('Changed line ranges keyed by file path'),
      },
    },
    async (args) =>
      handle(async () => {
        changeCounter += 1;
        const change: ArchitecturalChange = {
          id: `change-${changeCounter}-${Date.now().toString(36)}`,
          type: args.type,
          description: args.description,
          affectedFiles: args.affectedFiles,
          lineRanges: args.lineRanges ?? {},
          impact: args.impact,
          timestamp: new Date(),
        };
        const adr = await adrGenerator.generateFromChange(change);
        return {
          ...adr,
          semanticAnchors: adr.semanticAnchors.map((anchor) => ({
            adrId: anchor.adrId,
            codeLocation: anchor.codeLocation,
            relevance: anchor.relevance,
          })),
        };
      })
  );

  server.registerTool(
    'business_agent_list_templates',
    {
      title: 'List business agent templates',
      description: 'List registered business agent templates, optionally filtered by domain or department.',
      inputSchema: {
        domain: z.string().optional().describe('Filter by domain'),
        department: z.string().optional().describe('Filter by department'),
      },
    },
    async (args) =>
      handle(() => {
        let templates: BusinessAgentTemplate[];
        if (args.domain !== undefined) {
          templates = templateManager.listByDomain(args.domain);
        } else if (args.department !== undefined) {
          templates = templateManager.listByDepartment(args.department);
        } else {
          templates = templateManager.list();
        }
        return {
          count: templates.length,
          templates: templates.map((template) => ({
            id: template.id,
            name: template.name,
            description: template.description,
            domain: template.domain,
            department: template.department,
            capabilities: template.capabilities,
            toolCount: template.tools.length,
          })),
        };
      })
  );

  server.registerTool(
    'business_agent_create',
    {
      title: 'Create business agent',
      description:
        'Instantiate a business agent from a template. Returns a session-scoped agentId to use with business_agent_execute.',
      inputSchema: {
        templateId: z.string().min(1).describe('Template id from business_agent_list_templates'),
        customizations: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Partial template overrides (name, promptTemplate, constraints, ...)'),
        memoryOverrides: z
          .object({
            workingMemorySize: z.number().int().positive().optional(),
            episodicRetentionDays: z.number().int().positive().optional(),
          })
          .optional()
          .describe('Override template memory configuration'),
        toolOverrides: z
          .array(z.string())
          .optional()
          .describe('Extra tools to append to the template tool list'),
      },
    },
    async (args) =>
      handle(async () => {
        const memoryOverrides: { workingMemorySize?: number; episodicRetentionDays?: number } = {};
        if (args.memoryOverrides?.workingMemorySize !== undefined) {
          memoryOverrides.workingMemorySize = args.memoryOverrides.workingMemorySize;
        }
        if (args.memoryOverrides?.episodicRetentionDays !== undefined) {
          memoryOverrides.episodicRetentionDays = args.memoryOverrides.episodicRetentionDays;
        }

        const instance = await agentFactory.createAgent({
          templateId: args.templateId,
          ...(args.customizations !== undefined
            ? { customizations: args.customizations as Partial<BusinessAgentTemplate> }
            : {}),
          ...(Object.keys(memoryOverrides).length > 0 ? { memoryOverrides } : {}),
          ...(args.toolOverrides !== undefined ? { toolOverrides: args.toolOverrides } : {}),
        });
        agentCounter += 1;
        const agentId = `agent-${agentCounter}`;
        agents.set(agentId, instance);
        const template = instance.getTemplate();
        return {
          agentId,
          templateId: args.templateId,
          name: template.name,
          capabilities: instance.getCapabilities(),
          tools: template.tools,
        };
      })
  );

  server.registerTool(
    'business_agent_execute',
    {
      title: 'Execute business agent task',
      description: 'Execute a task with a previously created business agent instance.',
      inputSchema: {
        agentId: z.string().min(1).describe('Agent id returned by business_agent_create'),
        task: z.string().min(1).describe('Task for the agent'),
        context: z.unknown().optional().describe('Optional structured context'),
      },
    },
    async (args) =>
      handle(async () => {
        const instance = agents.get(args.agentId);
        if (!instance) {
          throw new Error(`Unknown agent: ${args.agentId}`);
        }
        return instance.execute(args.task, args.context);
      })
  );

  server.registerTool(
    'coordination_servers',
    {
      title: 'List business MCP servers',
      description:
        'List the business MCP server registry (orders, inventory, payments, CRM, ...) with tier and capability metadata.',
      inputSchema: {
        name: z.string().optional().describe('Exact server name filter'),
        capability: z.string().optional().describe('Capability filter'),
        tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe('Tier filter'),
      },
    },
    async (args) =>
      handle(() => {
        let servers = businessServers;
        if (args.name !== undefined) {
          servers = servers.filter((entry) => entry.name === args.name);
        }
        if (args.capability !== undefined) {
          servers = servers.filter((entry) => entry.capabilities.includes(args.capability as string));
        }
        if (args.tier !== undefined) {
          servers = servers.filter((entry) => entry.tier === args.tier);
        }
        return {
          count: servers.length,
          servers: servers.map((entry) => ({
            name: entry.name,
            transport: entry.transport,
            tier: entry.tier,
            command: entry.command ?? null,
            url: entry.url ?? null,
            capabilities: entry.capabilities,
            tags: entry.tags,
            destructive: entry.destructive,
            toolCount: entry.tools.length,
            tools: entry.tools.slice(0, 20).map((tool) => ({ id: tool.id, name: tool.name })),
          })),
        };
      })
  );

  server.registerTool(
    'optimization_templates',
    {
      title: 'List optimization templates',
      description:
        'List built-in optimization templates (agent, saga, mcp, pattern, workflow, configuration) with optional query/category filters.',
      inputSchema: {
        query: z.string().optional().describe('Free-text search over name, description and tags'),
        category: z
          .enum(['agent', 'saga', 'mcp', 'pattern', 'workflow', 'configuration'])
          .optional()
          .describe('Category filter'),
        limit: z.number().int().min(1).max(100).optional().describe('Max results (default 20)'),
      },
    },
    async (args) =>
      handle(() => {
        const templates =
          args.query !== undefined && args.query.length > 0
            ? optimizationTemplates.searchTemplates(args.query)
            : optimizationTemplates.listTemplates(args.category);
        const limited = templates.slice(0, args.limit ?? 20);
        return {
          count: limited.length,
          templates: limited.map((template) => ({
            id: template.id,
            name: template.name,
            version: template.version,
            description: template.description,
            category: template.category,
            tags: template.tags,
            variableCount: template.variables.length,
          })),
        };
      })
  );
}

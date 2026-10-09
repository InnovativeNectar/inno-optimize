import { EventEmitter } from 'events';

export interface MCPServerDescriptor {
  id: string;
  name: string;
  version: string;
  transport: 'stdio' | 'http' | 'sse' | 'websocket';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  tools: ToolDescriptor[];
  resources: ResourceDescriptor[];
  prompts: PromptDescriptor[];
  tier: 1 | 2 | 3;
  tags: string[];
  capabilities: string[];
  destructive: boolean;
  healthCheck: HealthCheckConfig;
  rateLimits: RateLimitConfig;
  allowedOrigins?: string[];
  requiredScopes?: string[];
}

export interface ToolDescriptor {
  id: string;
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  serverId: string;
  tier: 1 | 2 | 3;
  capabilities: string[];
  destructive: boolean;
}

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface PromptDescriptor {
  name: string;
  description: string;
  arguments: JSONSchema;
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  endpoint?: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  burst?: number;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    latencyMs: number;
    serverId: string;
    toolName: string;
  };
}

interface JsonRpcResponse {
  id?: string;
  result?: ToolResult;
}

export interface SearchQuery {
  query: string;
  capabilities?: string[];
  tags?: string[];
  tier?: 1 | 2 | 3;
  limit?: number;
}

export class MCPServerRegistry extends EventEmitter {
  private servers = new Map<string, MCPServerDescriptor>();
  private connections = new Map<string, MCPConnection>();
  
  register(server: MCPServerDescriptor): void {
    this.servers.set(server.id, server);
    this.emit('registered', server);
  }
  
  unregister(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;
    
    this.servers.delete(serverId);
    this.closeConnection(serverId);
    this.emit('unregistered', server);
    return true;
  }
  
  get(serverId: string): MCPServerDescriptor | undefined {
    return this.servers.get(serverId);
  }
  
  list(): MCPServerDescriptor[] {
    return Array.from(this.servers.values());
  }
  
  search(query: SearchQuery): MCPServerDescriptor[] {
    let results = this.list();
    
    if (query.capabilities && query.capabilities.length > 0) {
      results = results.filter(s => 
        query.capabilities!.every(c => s.capabilities.includes(c))
      );
    }
    
    if (query.tags && query.tags.length > 0) {
      results = results.filter(s => 
        query.tags!.some(t => s.tags.includes(t))
      );
    }
    
    if (query.tier) {
      results = results.filter(s => s.tier <= query.tier!);
    }
    
    // Simple text search on name/description
    if (query.query) {
      const q = query.query.toLowerCase();
      results = results.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.tools.some(t => t.description.toLowerCase().includes(q))
      );
    }
    
    return results.slice(0, query.limit || 20);
  }
  
  async getConnection(serverId: string): Promise<MCPConnection> {
    if (this.connections.has(serverId)) {
      const conn = this.connections.get(serverId)!;
      if (conn.isConnected()) return conn;
    }
    
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server not found: ${serverId}`);
    
    const connection = await this.createConnection(server);
    this.connections.set(serverId, connection);
    return connection;
  }
  
  private async createConnection(server: MCPServerDescriptor): Promise<MCPConnection> {
    switch (server.transport) {
      case 'stdio':
        return new StdioConnection(server);
      case 'http':
        return new HttpConnection(server);
      case 'sse':
        return new SSEConnection(server);
      case 'websocket':
        return new WebSocketConnection(server);
      default:
        throw new Error('Unsupported transport: ' + String(server.transport));
    }
  }
  
  closeConnection(serverId: string): void {
    const conn = this.connections.get(serverId);
    if (conn) {
      conn.close();
      this.connections.delete(serverId);
    }
  }
  
  closeAll(): void {
    for (const [id] of this.connections) {
      this.closeConnection(id);
    }
  }
}

export abstract class MCPConnection extends EventEmitter {
  protected server: MCPServerDescriptor;
  protected connected = false;
  
  constructor(server: MCPServerDescriptor) {
    super();
    this.server = server;
  }
  
  abstract connect(): Promise<void>;
  abstract close(): void;
  abstract callTool(name: string, args: unknown): Promise<ToolResult>;
  abstract listTools(): Promise<ToolDescriptor[]>;
  abstract listResources(): Promise<ResourceDescriptor[]>;
  abstract listPrompts(): Promise<PromptDescriptor[]>;
  abstract readResource(uri: string): Promise<unknown>;
  
  isConnected(): boolean {
    return this.connected;
  }
}

class StdioConnection extends MCPConnection {
  private process?: { kill(): void };
  
  async connect(): Promise<void> {
    // Spawn stdio process
    this.connected = true;
  }
  
  close(): void {
    if (this.process) this.process.kill();
    this.connected = false;
  }
  
  async callTool(_name: string, _args: unknown): Promise<ToolResult> {
    // Send JSON-RPC request via stdin
    return { success: true, data: {} };
  }
  
  async listTools(): Promise<ToolDescriptor[]> {
    return this.server.tools;
  }
  
  async listResources(): Promise<ResourceDescriptor[]> {
    return this.server.resources;
  }
  
  async listPrompts(): Promise<PromptDescriptor[]> {
    return this.server.prompts;
  }
  
  async readResource(_uri: string): Promise<unknown> {
    return { contents: [] };
  }
}

class HttpConnection extends MCPConnection {
  async connect(): Promise<void> {
    this.connected = true;
  }
  
  close(): void {
    this.connected = false;
  }
  
  async callTool(name: string, args: unknown): Promise<ToolResult> {
    const response = await fetch(`${this.server.url}/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.server.headers
      },
      body: JSON.stringify({ name, arguments: args })
    });
    
    return (await response.json()) as ToolResult;
  }
  
  async listTools(): Promise<ToolDescriptor[]> {
    const response = await fetch(`${this.server.url}/tools/list`, {
      headers: this.server.headers ?? {}
    });
    return (await response.json()) as ToolDescriptor[];
  }
  
  async listResources(): Promise<ResourceDescriptor[]> {
    const response = await fetch(`${this.server.url}/resources/list`, {
      headers: this.server.headers ?? {}
    });
    return (await response.json()) as ResourceDescriptor[];
  }
  
  async listPrompts(): Promise<PromptDescriptor[]> {
    return this.server.prompts;
  }
  
  async readResource(uri: string): Promise<unknown> {
    const response = await fetch(`${this.server.url}/resources/read?uri=${encodeURIComponent(uri)}`, {
      headers: this.server.headers ?? {}
    });
    return (await response.json()) as unknown;
  }
}

class SSEConnection extends MCPConnection {
  private eventSource: EventSource | null = null;
  
  async connect(): Promise<void> {
    this.eventSource = new EventSource(this.server.url!);
    this.eventSource.onmessage = (event: MessageEvent<string>) => {
      this.emit('message', JSON.parse(event.data));
    };
    this.connected = true;
  }
  
  close(): void {
    if (this.eventSource) this.eventSource.close();
    this.connected = false;
  }
  
  async callTool(_name: string, _args: unknown): Promise<ToolResult> {
    // SSE is typically for streaming, use HTTP for calls
    return { success: false, error: 'Use HTTP for tool calls' };
  }
  
  async listTools(): Promise<ToolDescriptor[]> {
    return this.server.tools;
  }
  
  async listResources(): Promise<ResourceDescriptor[]> {
    return this.server.resources;
  }
  
  async listPrompts(): Promise<PromptDescriptor[]> {
    return this.server.prompts;
  }
  
  async readResource(_uri: string): Promise<unknown> {
    return { contents: [] };
  }
}

class WebSocketConnection extends MCPConnection {
  private ws: WebSocket | null = null;
  
  async connect(): Promise<void> {
    this.ws = new WebSocket(this.server.url!);
    this.ws.onmessage = (event: MessageEvent<string>) => {
      this.emit('message', JSON.parse(event.data));
    };
    await new Promise((resolve, reject) => {
      this.ws!.onopen = resolve;
      this.ws!.onerror = reject;
    });
    this.connected = true;
  }
  
  close(): void {
    if (this.ws) this.ws.close();
    this.connected = false;
  }
  
  async callTool(name: string, args: unknown): Promise<ToolResult> {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      this.ws!.send(JSON.stringify({ id, method: 'tools/call', params: { name, arguments: args } }));
      
      const handler = (event: MessageEvent<string>) => {
        const msg = JSON.parse(event.data) as JsonRpcResponse;
        if (msg.id === id) {
          this.ws!.removeEventListener('message', handler);
          resolve(msg.result as ToolResult);
        }
      };
      this.ws!.addEventListener('message', handler);
    });
  }
  
  async listTools(): Promise<ToolDescriptor[]> {
    return this.server.tools;
  }
  
  async listResources(): Promise<ResourceDescriptor[]> {
    return this.server.resources;
  }
  
  async listPrompts(): Promise<PromptDescriptor[]> {
    return this.server.prompts;
  }
  
  async readResource(_uri: string): Promise<unknown> {
    return { contents: [] };
  }
}
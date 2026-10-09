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
    enum?: any[];
    default?: any;
}
export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: {
        latencyMs: number;
        serverId: string;
        toolName: string;
    };
}
export interface SearchQuery {
    query: string;
    capabilities?: string[];
    tags?: string[];
    tier?: 1 | 2 | 3;
    limit?: number;
}
export declare class MCPServerRegistry extends EventEmitter {
    private servers;
    private connections;
    register(server: MCPServerDescriptor): void;
    unregister(serverId: string): boolean;
    get(serverId: string): MCPServerDescriptor | undefined;
    list(): MCPServerDescriptor[];
    search(query: SearchQuery): MCPServerDescriptor[];
    getConnection(serverId: string): Promise<MCPConnection>;
    private createConnection;
    closeConnection(serverId: string): void;
    closeAll(): void;
}
export declare abstract class MCPConnection extends EventEmitter {
    protected server: MCPServerDescriptor;
    protected connected: boolean;
    constructor(server: MCPServerDescriptor);
    abstract connect(): Promise<void>;
    abstract close(): void;
    abstract callTool(name: string, args: any): Promise<ToolResult>;
    abstract listTools(): Promise<ToolDescriptor[]>;
    abstract listResources(): Promise<ResourceDescriptor[]>;
    abstract listPrompts(): Promise<PromptDescriptor[]>;
    abstract readResource(uri: string): Promise<any>;
    isConnected(): boolean;
}
//# sourceMappingURL=server.d.ts.map
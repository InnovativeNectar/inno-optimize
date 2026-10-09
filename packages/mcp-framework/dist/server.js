import { EventEmitter } from 'events';
export class MCPServerRegistry extends EventEmitter {
    servers = new Map();
    connections = new Map();
    register(server) {
        this.servers.set(server.id, server);
        this.emit('registered', server);
    }
    unregister(serverId) {
        const server = this.servers.get(serverId);
        if (!server)
            return false;
        this.servers.delete(serverId);
        this.closeConnection(serverId);
        this.emit('unregistered', server);
        return true;
    }
    get(serverId) {
        return this.servers.get(serverId);
    }
    list() {
        return Array.from(this.servers.values());
    }
    search(query) {
        let results = this.list();
        if (query.capabilities && query.capabilities.length > 0) {
            results = results.filter(s => query.capabilities.every(c => s.capabilities.includes(c)));
        }
        if (query.tags && query.tags.length > 0) {
            results = results.filter(s => query.tags.some(t => s.tags.includes(t)));
        }
        if (query.tier) {
            results = results.filter(s => s.tier <= query.tier);
        }
        // Simple text search on name/description
        if (query.query) {
            const q = query.query.toLowerCase();
            results = results.filter(s => s.name.toLowerCase().includes(q) ||
                s.tools.some(t => t.description.toLowerCase().includes(q)));
        }
        return results.slice(0, query.limit || 20);
    }
    async getConnection(serverId) {
        if (this.connections.has(serverId)) {
            const conn = this.connections.get(serverId);
            if (conn.isConnected())
                return conn;
        }
        const server = this.servers.get(serverId);
        if (!server)
            throw new Error(`Server not found: ${serverId}`);
        const connection = await this.createConnection(server);
        this.connections.set(serverId, connection);
        return connection;
    }
    async createConnection(server) {
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
                throw new Error(`Unsupported transport: ${server.transport}`);
        }
    }
    closeConnection(serverId) {
        const conn = this.connections.get(serverId);
        if (conn) {
            conn.close();
            this.connections.delete(serverId);
        }
    }
    closeAll() {
        for (const [id] of this.connections) {
            this.closeConnection(id);
        }
    }
}
export class MCPConnection extends EventEmitter {
    server;
    connected = false;
    constructor(server) {
        super();
        this.server = server;
    }
    isConnected() {
        return this.connected;
    }
}
class StdioConnection extends MCPConnection {
    process;
    async connect() {
        // Spawn stdio process
        this.connected = true;
    }
    close() {
        if (this.process)
            this.process.kill();
        this.connected = false;
    }
    async callTool(name, args) {
        // Send JSON-RPC request via stdin
        return { success: true, data: {} };
    }
    async listTools() {
        return this.server.tools;
    }
    async listResources() {
        return this.server.resources;
    }
    async listPrompts() {
        return this.server.prompts;
    }
    async readResource(uri) {
        return { contents: [] };
    }
}
class HttpConnection extends MCPConnection {
    async connect() {
        this.connected = true;
    }
    close() {
        this.connected = false;
    }
    async callTool(name, args) {
        const response = await fetch(`${this.server.url}/tools/call`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.server.headers
            },
            body: JSON.stringify({ name, arguments: args })
        });
        return response.json();
    }
    async listTools() {
        const response = await fetch(`${this.server.url}/tools/list`, {
            headers: this.server.headers ?? {}
        });
        return response.json();
    }
    async listResources() {
        const response = await fetch(`${this.server.url}/resources/list`, {
            headers: this.server.headers ?? {}
        });
        return response.json();
    }
    async listPrompts() {
        return this.server.prompts;
    }
    async readResource(uri) {
        const response = await fetch(`${this.server.url}/resources/read?uri=${encodeURIComponent(uri)}`, {
            headers: this.server.headers ?? {}
        });
        return response.json();
    }
}
class SSEConnection extends MCPConnection {
    eventSource = null;
    async connect() {
        this.eventSource = new EventSource(this.server.url);
        this.eventSource.onmessage = (event) => {
            this.emit('message', JSON.parse(event.data));
        };
        this.connected = true;
    }
    close() {
        if (this.eventSource)
            this.eventSource.close();
        this.connected = false;
    }
    async callTool(name, args) {
        // SSE is typically for streaming, use HTTP for calls
        return { success: false, error: 'Use HTTP for tool calls' };
    }
    async listTools() {
        return this.server.tools;
    }
    async listResources() {
        return this.server.resources;
    }
    async listPrompts() {
        return this.server.prompts;
    }
    async readResource(uri) {
        return { contents: [] };
    }
}
class WebSocketConnection extends MCPConnection {
    ws = null;
    async connect() {
        this.ws = new WebSocket(this.server.url);
        this.ws.onmessage = (event) => {
            this.emit('message', JSON.parse(event.data));
        };
        await new Promise((resolve, reject) => {
            this.ws.onopen = resolve;
            this.ws.onerror = reject;
        });
        this.connected = true;
    }
    close() {
        if (this.ws)
            this.ws.close();
        this.connected = false;
    }
    async callTool(name, args) {
        return new Promise((resolve) => {
            const id = Math.random().toString(36).slice(2);
            this.ws.send(JSON.stringify({ id, method: 'tools/call', params: { name, arguments: args } }));
            const handler = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id === id) {
                    this.ws.removeEventListener('message', handler);
                    resolve(msg.result);
                }
            };
            this.ws.addEventListener('message', handler);
        });
    }
    async listTools() {
        return this.server.tools;
    }
    async listResources() {
        return this.server.resources;
    }
    async listPrompts() {
        return this.server.prompts;
    }
    async readResource(uri) {
        return { contents: [] };
    }
}
//# sourceMappingURL=server.js.map
import { BusinessMCPServer } from '../types.js';
export declare const businessServers: BusinessMCPServer[];
export declare function getServerByName(name: string): typeof businessServers[0] | undefined;
export declare function getServersByCapability(capability: string): typeof businessServers;
export declare function getServersByTier(tier: 1 | 2 | 3): typeof businessServers;
//# sourceMappingURL=servers.d.ts.map
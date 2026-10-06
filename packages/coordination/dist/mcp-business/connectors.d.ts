import { BusinessConnector, ConnectorOperation } from '../types.js';
export declare class MockOrdersConnector implements BusinessConnector {
    id: string;
    name: string;
    type: 'orders';
    auth: {
        type: 'api_key';
        config: {};
    };
    operations: ConnectorOperation[];
    execute(operation: string, input: any): Promise<any>;
}
export declare class MockInventoryConnector implements BusinessConnector {
    id: string;
    name: string;
    type: 'inventory';
    auth: {
        type: 'api_key';
        config: {};
    };
    operations: ConnectorOperation[];
    execute(operation: string, input: any): Promise<any>;
}
export declare class MockPaymentsConnector implements BusinessConnector {
    id: string;
    name: string;
    type: 'payment';
    auth: {
        type: 'api_key';
        config: {};
    };
    operations: ConnectorOperation[];
    execute(operation: string, input: any): Promise<any>;
}
export declare class MockCRMConnector implements BusinessConnector {
    id: string;
    name: string;
    type: 'crm';
    auth: {
        type: 'api_key';
        config: {};
    };
    operations: ConnectorOperation[];
    execute(operation: string, input: any): Promise<any>;
}
export declare class ConnectorRegistry {
    private connectors;
    constructor();
    register(connector: BusinessConnector): void;
    getConnector(id: string): BusinessConnector | undefined;
    listConnectors(): BusinessConnector[];
}
export declare const connectorRegistry: ConnectorRegistry;
//# sourceMappingURL=connectors.d.ts.map
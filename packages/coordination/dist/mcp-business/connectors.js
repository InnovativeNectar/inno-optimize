export class MockOrdersConnector {
    id = 'business-orders';
    name = 'Mock Orders Connector';
    type = 'orders';
    auth = { type: 'api_key', config: {} };
    operations = [
        {
            name: 'create_order',
            description: 'Create new order',
            method: 'POST',
            path: '/orders',
            parameters: { type: 'object', properties: { customerId: { type: 'string' }, items: { type: 'array' } } },
            response: { type: 'object', properties: { orderId: { type: 'string' }, status: { type: 'string' } } },
            idempotent: false
        },
        {
            name: 'get_order',
            description: 'Get order details',
            method: 'GET',
            path: '/orders/{id}',
            parameters: { type: 'object', properties: { orderId: { type: 'string' } } },
            response: { type: 'object', properties: { orderId: { type: 'string' }, status: { type: 'string' } } },
            idempotent: true
        },
        {
            name: 'update_order_status',
            description: 'Update order status',
            method: 'PATCH',
            path: '/orders/{id}/status',
            parameters: { type: 'object', properties: { orderId: { type: 'string' }, status: { type: 'string' } } },
            response: { type: 'object', properties: { success: { type: 'boolean' } } },
            idempotent: false
        }
    ];
    async execute(operation, input) {
        switch (operation) {
            case 'create_order':
                return {
                    orderId: `order-${Date.now()}`,
                    status: 'confirmed',
                    total: input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
                    createdAt: new Date().toISOString()
                };
            case 'get_order':
                return {
                    orderId: input.orderId,
                    customerId: input.customerId,
                    status: 'confirmed',
                    total: 100,
                    createdAt: new Date().toISOString()
                };
            case 'update_order_status':
                return { success: true, orderId: input.orderId, status: input.status };
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
}
export class MockInventoryConnector {
    id = 'business-inventory';
    name = 'Mock Inventory Connector';
    type = 'inventory';
    auth = { type: 'api_key', config: {} };
    operations = [
        {
            name: 'check_stock',
            description: 'Check stock levels',
            method: 'GET',
            path: '/inventory/check',
            parameters: { type: 'object', properties: { productIds: { type: 'array' } } },
            response: { type: 'object', properties: { available: { type: 'boolean' }, stock: { type: 'array' } } },
            idempotent: true
        },
        {
            name: 'reserve_stock',
            description: 'Reserve stock',
            method: 'POST',
            path: '/inventory/reserve',
            parameters: { type: 'object', properties: { orderId: { type: 'string' }, items: { type: 'array' } } },
            response: { type: 'object', properties: { reservationId: { type: 'string' }, reserved: { type: 'boolean' } } },
            idempotent: false
        },
        {
            name: 'release_stock',
            description: 'Release reserved stock',
            method: 'POST',
            path: '/inventory/release',
            parameters: { type: 'object', properties: { reservationId: { type: 'string' } } },
            response: { type: 'object', properties: { released: { type: 'boolean' } } },
            idempotent: false
        }
    ];
    async execute(operation, input) {
        switch (operation) {
            case 'check_stock':
                return { available: true, stock: input.productIds.map((id) => ({ productId: id, quantity: 100 })) };
            case 'reserve_stock':
                return { reservationId: `res-${Date.now()}`, reserved: true, expiresAt: new Date(Date.now() + 3600000).toISOString() };
            case 'release_stock':
                return { released: true };
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
}
export class MockPaymentsConnector {
    id = 'business-payments';
    name = 'Mock Payments Connector';
    type = 'payment';
    auth = { type: 'api_key', config: {} };
    operations = [
        {
            name: 'process_payment',
            description: 'Process payment',
            method: 'POST',
            path: '/payments',
            parameters: { type: 'object', properties: { orderId: { type: 'string' }, amount: { type: 'number' }, paymentMethod: { type: 'string' } } },
            response: { type: 'object', properties: { paymentId: { type: 'string' }, status: { type: 'string' } } },
            idempotent: false
        },
        {
            name: 'refund_payment',
            description: 'Refund payment',
            method: 'POST',
            path: '/payments/refund',
            parameters: { type: 'object', properties: { paymentId: { type: 'string' }, amount: { type: 'number' } } },
            response: { type: 'object', properties: { refundId: { type: 'string' }, status: { type: 'string' } } },
            idempotent: false
        }
    ];
    async execute(operation, input) {
        switch (operation) {
            case 'process_payment':
                return {
                    paymentId: `pay-${Date.now()}`,
                    status: 'completed',
                    transactionId: `txn-${Date.now()}`,
                    processedAt: new Date().toISOString()
                };
            case 'refund_payment':
                return { refundId: `ref-${Date.now()}`, status: 'completed', amount: input.amount };
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
}
export class MockCRMConnector {
    id = 'business-crm';
    name = 'Mock CRM Connector';
    type = 'crm';
    auth = { type: 'api_key', config: {} };
    operations = [
        {
            name: 'create_lead',
            description: 'Create lead',
            method: 'POST',
            path: '/leads',
            parameters: { type: 'object', properties: { email: { type: 'string' }, firstName: { type: 'string' } } },
            response: { type: 'object', properties: { leadId: { type: 'string' } } },
            idempotent: false
        },
        {
            name: 'get_contact',
            description: 'Get contact',
            method: 'GET',
            path: '/contacts/{id}',
            parameters: { type: 'object', properties: { contactId: { type: 'string' } } },
            response: { type: 'object', properties: { contactId: { type: 'string' }, email: { type: 'string' } } },
            idempotent: true
        }
    ];
    async execute(operation, input) {
        switch (operation) {
            case 'create_lead':
                return { leadId: `lead-${Date.now()}`, status: 'new' };
            case 'get_contact':
                return { contactId: input.contactId, email: 'test@example.com', firstName: 'Test', lastName: 'User' };
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
}
export class ConnectorRegistry {
    connectors = new Map();
    constructor() {
        this.register(new MockOrdersConnector());
        this.register(new MockInventoryConnector());
        this.register(new MockPaymentsConnector());
        this.register(new MockCRMConnector());
    }
    register(connector) {
        this.connectors.set(connector.id, connector);
    }
    getConnector(id) {
        return this.connectors.get(id);
    }
    listConnectors() {
        return Array.from(this.connectors.values());
    }
}
export const connectorRegistry = new ConnectorRegistry();
//# sourceMappingURL=connectors.js.map
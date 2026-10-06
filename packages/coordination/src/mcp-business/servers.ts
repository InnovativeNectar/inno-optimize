import { 
  BusinessMCPServer, 
  ToolDescriptor, 
  ResourceDescriptor, 
  PromptDescriptor,
  JSONSchema 
} from '../types.js';

export const businessServers: BusinessMCPServer[] = [
  // Orders Server
  {
    name: 'business-orders',
    transport: 'stdio',
    command: 'npx',
    args: ['@inno/mcp-orders'],
    tools: [
      {
        id: 'orders-create',
        name: 'create_order',
        description: 'Create a new customer order',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'string', description: 'Customer ID' },
            items: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'number', minimum: 1 },
                  unitPrice: { type: 'number', minimum: 0 }
                },
                required: ['productId', 'quantity']
              }
            },
            shippingAddress: { 
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                postalCode: { type: 'string' },
                country: { type: 'string' }
              },
              required: ['street', 'city', 'state', 'postalCode', 'country']
            },
            paymentMethod: { type: 'string', enum: ['credit_card', 'paypal', 'bank_transfer', 'invoice'] },
            notes: { type: 'string' }
          },
          required: ['customerId', 'items']
        },
        outputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            status: { type: 'string' },
            total: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        serverId: 'business-orders',
        tier: 2,
        capabilities: ['write', 'business'],
        destructive: false
      },
      {
        id: 'orders-get',
        name: 'get_order',
        description: 'Retrieve order details by ID',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'string' }
          },
          required: ['orderId']
        },
        outputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            customerId: { type: 'string' },
            items: { type: 'array' },
            status: { type: 'string' },
            total: { type: 'number' },
            shippingAddress: { type: 'object' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' }
          }
        },
        serverId: 'business-orders',
        tier: 1,
        capabilities: ['read', 'business'],
        destructive: false
      },
      {
        id: 'orders-update-status',
        name: 'update_order_status',
        description: 'Update order status',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            status: { 
              type: 'string', 
              enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] 
            },
            trackingNumber: { type: 'string' },
            notes: { type: 'string' }
          },
          required: ['orderId', 'status']
        },
        outputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            status: { type: 'string' },
            updatedAt: { type: 'string' }
          }
        },
        serverId: 'business-orders',
        tier: 2,
        capabilities: ['write', 'business'],
        destructive: false
      },
      {
        id: 'orders-list',
        name: 'list_orders',
        description: 'List orders with filters',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            status: { type: 'string' },
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 }
          }
        },
        outputSchema: {
          type: 'object',
          properties: {
            orders: { type: 'array' },
            total: { type: 'number' }
          }
        },
        serverId: 'business-orders',
        tier: 1,
        capabilities: ['read', 'business'],
        destructive: false
      }
    ],
    resources: [
      { uri: 'orders://{id}', name: 'Order', description: 'Order details', mimeType: 'application/json' },
      { uri: 'orders://customer/{customerId}', name: 'Customer Orders', description: 'Orders for customer', mimeType: 'application/json' }
    ],
    prompts: [
      { name: 'order_confirmation', description: 'Generate order confirmation email', arguments: { type: 'object', properties: { orderId: { type: 'string' } } } }
    ],
    tier: 2,
    tags: ['business', 'orders', 'ecommerce'],
    capabilities: ['read', 'write', 'business'],
    destructive: false,
    rateLimits: { requestsPerMinute: 60, burst: 10 }
  },
  
  // Inventory Server
  {
    name: 'business-inventory',
    transport: 'stdio',
    command: 'npx',
    args: ['@inno/mcp-inventory'],
    tools: [
      {
        id: 'inventory-check',
        name: 'check_stock',
        description: 'Check stock levels for products',
        inputSchema: {
          type: 'object',
          properties: {
            productIds: { type: 'array', items: { type: 'string' } },
            warehouseId: { type: 'string' }
          },
          required: ['productIds']
        },
        outputSchema: {
          type: 'object',
          properties: {
            stock: { type: 'array', items: { type: 'object' } }
          }
        },
        serverId: 'business-inventory',
        tier: 1,
        capabilities: ['read', 'business'],
        destructive: false
      },
      {
        id: 'inventory-reserve',
        name: 'reserve_stock',
        description: 'Reserve stock for an order',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            items: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'number', minimum: 1 }
                },
                required: ['productId', 'quantity']
              }
            }
          },
          required: ['orderId', 'items']
        },
        outputSchema: {
          type: 'object',
          properties: {
            reservationId: { type: 'string' },
            reserved: { type: 'boolean' },
            expiresAt: { type: 'string' }
          }
        },
        serverId: 'business-inventory',
        tier: 2,
        capabilities: ['write', 'business'],
        destructive: false
      },
      {
        id: 'inventory-release',
        name: 'release_stock',
        description: 'Release reserved stock',
        inputSchema: {
          type: 'object',
          properties: {
            reservationId: { type: 'string' }
          },
          required: ['reservationId']
        },
        outputSchema: {
          type: 'object',
          properties: {
            released: { type: 'boolean' }
          }
        },
        serverId: 'business-inventory',
        tier: 2,
        capabilities: ['write', 'business'],
        destructive: false
      },
      {
        id: 'inventory-get-product',
        name: 'get_product',
        description: 'Get product details',
        inputSchema: {
          type: 'object',
          properties: {
            productId: { type: 'string' }
          },
          required: ['productId']
        },
        outputSchema: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            stock: { type: 'number' },
            category: { type: 'string' }
          }
        },
        serverId: 'business-inventory',
        tier: 1,
        capabilities: ['read', 'business'],
        destructive: false
      },
      {
        id: 'inventory-low-stock',
        name: 'list_low_stock',
        description: 'List products below threshold',
        inputSchema: {
          type: 'object',
          properties: {
            threshold: { type: 'number', default: 10 },
            warehouseId: { type: 'string' }
          }
        },
        outputSchema: {
          type: 'object',
          properties: {
            products: { type: 'array' }
          }
        },
        serverId: 'business-inventory',
        tier: 1,
        capabilities: ['read', 'business'],
        destructive: false
      }
    ],
    resources: [
      { uri: 'inventory://product/{id}', name: 'Product', description: 'Product details', mimeType: 'application/json' },
      { uri: 'inventory://warehouse/{id}', name: 'Warehouse Stock', description: 'Warehouse inventory', mimeType: 'application/json' }
    ],
    prompts: [
      { name: 'restock_alert', description: 'Generate restock alert', arguments: { type: 'object', properties: { productId: { type: 'string' } } } }
    ],
    tier: 2,
    tags: ['business', 'inventory', 'warehouse'],
    capabilities: ['read', 'write', 'business'],
    destructive: false,
    rateLimits: { requestsPerMinute: 60, burst: 10 }
  },
  
  // Payments Server
  {
    name: 'business-payments',
    transport: 'stdio',
    command: 'npx',
    args: ['@inno/mcp-payments'],
    tools: [
      {
        id: 'payments-process',
        name: 'process_payment',
        description: 'Process a payment',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            amount: { type: 'number', minimum: 0 },
            currency: { type: 'string', default: 'USD' },
            paymentMethod: { 
              type: 'string', 
              enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'stripe', 'square'] 
            },
            paymentDetails: { type: 'object' },
            idempotencyKey: { type: 'string' }
          },
          required: ['orderId', 'amount', 'paymentMethod']
        },
        outputSchema: {
          type: 'object',
          properties: {
            paymentId: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed', 'refunded'] },
            transactionId: { type: 'string' },
            processedAt: { type: 'string' }
          }
        },
        serverId: 'business-payments',
        tier: 3,
        capabilities: ['write', 'business', 'payment'],
        destructive: true
      },
      {
        id: 'payments-refund',
        name: 'refund_payment',
        description: 'Process a refund',
        inputSchema: {
          type: 'object',
          properties: {
            paymentId: { type: 'string' },
            amount: { type: 'number' },
            reason: { type: 'string' },
            idempotencyKey: { type: 'string' }
          },
          required: ['paymentId']
        },
        outputSchema: {
          type: 'object',
          properties: {
            refundId: { type: 'string' },
            status: { type: 'string' },
            amount: { type: 'number' }
          }
        },
        serverId: 'business-payments',
        tier: 3,
        capabilities: ['write', 'business', 'payment'],
        destructive: true
      },
      {
        id: 'payments-status',
        name: 'get_payment_status',
        description: 'Get payment status',
        inputSchema: {
          type: 'object',
          properties: {
            paymentId: { type: 'string' }
          },
          required: ['paymentId']
        },
        outputSchema: {
          type: 'object',
          properties: {
            paymentId: { type: 'string' },
            status: { type: 'string' },
            amount: { type: 'number' },
            createdAt: { type: 'string' }
          }
        },
        serverId: 'business-payments',
        tier: 1,
        capabilities: ['read', 'business', 'payment'],
        destructive: false
      },
      {
        id: 'payments-reconcile',
        name: 'reconcile_payments',
        description: 'Reconcile payments with gateway',
        inputSchema: {
          type: 'object',
          properties: {
            dateFrom: { type: 'string', format: 'date' },
            dateTo: { type: 'string', format: 'date' },
            gateway: { type: 'string' }
          }
        },
        outputSchema: {
          type: 'object',
          properties: {
            reconciled: { type: 'number' },
            discrepancies: { type: 'array' }
          }
        },
        serverId: 'business-payments',
        tier: 2,
        capabilities: ['read', 'write', 'business', 'payment'],
        destructive: false
      }
    ],
    resources: [
      { uri: 'payments://{id}', name: 'Payment', description: 'Payment details', mimeType: 'application/json' },
      { uri: 'payments://order/{orderId}', name: 'Order Payments', description: 'Payments for order', mimeType: 'application/json' }
    ],
    prompts: [],
    tier: 3,
    tags: ['business', 'payments', 'finance'],
    capabilities: ['read', 'write', 'business', 'payment'],
    destructive: true,
    rateLimits: { requestsPerMinute: 10, burst: 3 }
  },
  
  // CRM Server
  {
    name: 'business-crm',
    transport: 'stdio',
    command: 'npx',
    args: ['@inno/mcp-crm'],
    tools: [
      {
        id: 'crm-create-lead',
        name: 'create_lead',
        description: 'Create a new lead',
        inputSchema: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            company: { type: 'string' },
            source: { type: 'string' },
            notes: { type: 'string' }
          },
          required: ['email']
        },
        outputSchema: {
          type: 'object',
          properties: {
            leadId: { type: 'string' },
            status: { type: 'string' }
          }
        },
        serverId: 'business-crm',
        tier: 2,
        capabilities: ['write', 'business'],
        destructive: false
      },
      {
        id: 'crm-get-contact',
        name: 'get_contact',
        description: 'Get contact details',
        inputSchema: {
          type: 'object',
          properties: {
            contactId: { type: 'string' }
          },
          required: ['contactId']
        },
        outputSchema: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            company: { type: 'string' },
            status: { type: 'string' }
          }
        },
        serverId: 'business-crm',
        tier: 1,
        capabilities: ['read', 'business'],
        destructive: false
      },
      {
        id: 'crm-update-contact',
        name: 'update_contact',
        description: 'Update contact information',
        inputSchema: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            company: { type: 'string' },
            status: { type: 'string' }
          },
          required: ['contactId']
        },
        outputSchema: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            updated: { type: 'boolean' }
          }
        },
        serverId: 'business-crm',
        tier: 2,
        capabilities: ['write', 'business'],
        destructive: false
      },
      {
        id: 'crm-search',
        name: 'search_contacts',
        description: 'Search contacts',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            filters: { type: 'object' },
            limit: { type: 'number', default: 20 }
          }
        },
        outputSchema: {
          type: 'object',
          properties: {
            contacts: { type: 'array' },
            total: { type: 'number' }
          }
        },
        serverId: 'business-crm',
        tier: 1,
        capabilities: ['read', 'business'],
        destructive: false
      },
      {
        id: 'crm-log-activity',
        name: 'log_activity',
        description: 'Log sales activity',
        inputSchema: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            type: { type: 'string', enum: ['call', 'email', 'meeting', 'note', 'task'] },
            subject: { type: 'string' },
            description: { type: 'string' },
            outcome: { type: 'string' }
          },
          required: ['contactId', 'type', 'subject']
        },
        outputSchema: {
          type: 'object',
          properties: {
            activityId: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        serverId: 'business-crm',
        tier: 2,
        capabilities: ['write', 'business'],
        destructive: false
      }
    ],
    resources: [
      { uri: 'crm://contact/{id}', name: 'Contact', description: 'Contact details', mimeType: 'application/json' },
      { uri: 'crm://lead/{id}', name: 'Lead', description: 'Lead details', mimeType: 'application/json' }
    ],
    prompts: [
      { name: 'follow_up_email', description: 'Generate follow-up email', arguments: { type: 'object', properties: { contactId: { type: 'string' } } } }
    ],
    tier: 2,
    tags: ['business', 'crm', 'sales'],
    capabilities: ['read', 'write', 'business'],
    destructive: false,
    rateLimits: { requestsPerMinute: 60, burst: 10 }
  }
];

export function getServerByName(name: string): typeof businessServers[0] | undefined {
  return businessServers.find(s => s.name === name);
}

export function getServersByCapability(capability: string): typeof businessServers {
  return businessServers.filter(s => s.capabilities.includes(capability));
}

export function getServersByTier(tier: 1 | 2 | 3): typeof businessServers {
  return businessServers.filter(s => s.tier <= tier);
}
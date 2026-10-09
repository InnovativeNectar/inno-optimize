export class TemplateManager {
    memory;
    templates = new Map();
    instances = new Map();
    loadBuiltinTemplates() {
        // Agent Templates
        this.registerTemplate({
            id: 'agent-business-process',
            name: 'Business Process Agent',
            version: '1.0.0',
            description: 'Template for business workflow automation agents with saga orchestration',
            category: 'agent',
            tags: ['business', 'workflow', 'saga', 'automation'],
            content: `name: {{name}}
version: {{version}}
description: {{description}}
model: {{model}}

capabilities:
  mcp_tools:
    - orders
    - inventory
    - payments
    - crm
    - messaging
  saga_orchestration: true
  compensation_handling: true
  idempotency: true
  retry_policy:
    max_retries: {{maxRetries}}
    backoff: exponential
    base_delay_ms: {{baseDelayMs}}

memory:
  namespace: {{memoryNamespace}}
  retention_days: {{retentionDays}}
  working_cache_size: {{cacheSize}}

hooks:
  pre_execute:
    - validate_business_rules
    - check_idempotency_key
  post_execute:
    - audit_log
    - update_metrics
  on_error:
    - compensate_and_alert
    - create_incident_ticket

routing:
  default_tier: {{defaultTier}}
  tier_1_patterns:
    - order_validation
    - inventory_check
    - payment_verification
  tier_2_patterns:
    - order_processing
    - fulfillment_workflow
    - customer_notification
  tier_3_patterns:
    - exception_handling
    - complex_reconciliation
    - multi_system_coordination

sagas:
  - order-processing
  - order-cancellation
  - return-processing
  - payment-reconciliation

business_rules:
  - min_order_value: {{minOrderValue}}
  - max_order_value: {{maxOrderValue}}
  - require_payment_confirmation: {{requirePaymentConfirmation}}
  - reserve_inventory_before_payment: {{reserveInventoryFirst}}
  - notify_customer_on_status_change: {{notifyOnStatusChange}}

monitoring:
  metrics:
    - orders_processed_total
    - order_processing_duration_seconds
    - compensation_triggered_total
    - saga_failure_rate
  alerts:
    - name: high_failure_rate
      expr: rate(saga_failures[5m]) > 0.05
      severity: critical
    - name: slow_processing
      expr: histogram_quantile(0.95, order_processing_duration) > {{slowThreshold}}
      severity: warning`,
            variables: [
                { name: 'name', type: 'string', description: 'Agent name', required: true },
                { name: 'version', type: 'string', description: 'Template version', required: true, default: '1.0.0' },
                { name: 'description', type: 'string', description: 'Agent description', required: true },
                { name: 'model', type: 'string', description: 'LLM model', required: true, default: 'sonnet' },
                { name: 'maxRetries', type: 'number', description: 'Max retry attempts', required: false, default: 3 },
                { name: 'baseDelayMs', type: 'number', description: 'Base delay for retries (ms)', required: false, default: 1000 },
                { name: 'memoryNamespace', type: 'string', description: 'Memory namespace', required: false, default: 'business-processes' },
                { name: 'retentionDays', type: 'number', description: 'Memory retention (days)', required: false, default: 90 },
                { name: 'cacheSize', type: 'number', description: 'Working cache size', required: false, default: 5000 },
                { name: 'defaultTier', type: 'number', description: 'Default routing tier', required: false, default: 2 },
                { name: 'minOrderValue', type: 'number', description: 'Minimum order value', required: false, default: 0 },
                { name: 'maxOrderValue', type: 'number', description: 'Maximum order value', required: false, default: 100000 },
                { name: 'requirePaymentConfirmation', type: 'boolean', description: 'Require payment confirmation', required: false, default: true },
                { name: 'reserveInventoryFirst', type: 'boolean', description: 'Reserve inventory before payment', required: false, default: true },
                { name: 'notifyOnStatusChange', type: 'boolean', description: 'Notify customer on status change', required: false, default: true },
                { name: 'slowThreshold', type: 'number', description: 'Slow processing threshold (seconds)', required: false, default: 30 }
            ],
            metadata: {
                author: 'inno-optimize',
                createdAt: new Date('2026-01-01'),
                updatedAt: new Date('2026-01-01'),
                version: '1.0.0',
                downloads: 0,
                rating: 5,
                tags: ['business', 'workflow', 'saga'],
                compatibleVersions: ['0.1.0+']
            }
        });
        // Analytics Agent Template
        this.registerTemplate({
            id: 'agent-analytics',
            name: 'Analytics Agent',
            version: '1.0.0',
            description: 'Template for business intelligence and analytics agents',
            category: 'agent',
            tags: ['analytics', 'bi', 'ml', 'reporting'],
            content: `name: {{name}}
version: {{version}}
description: {{description}}
model: {{model}}

capabilities:
  sql_query: true
  vector_search: true
  ml_inference: true
  report_generation: true
  data_visualization: true
  mcp_tools:
    - analytics
    - data-warehouse
    - ml-platform

memory:
  namespace: {{memoryNamespace}}
  retention_days: {{retentionDays}}
  working_cache_size: {{cacheSize}}

hooks:
  pre_query:
    - check_data_freshness
    - validate_query_permissions
    - estimate_query_cost
  post_query:
    - cache_results
    - log_query_performance
    - update_data_lineage
  on_error:
    - fallback_to_cached
    - alert_data_team

routing:
  default_tier: {{defaultTier}}
  tier_1_patterns:
    - simple_aggregation
    - cached_report
    - dashboard_refresh
  tier_2_patterns:
    - ad_hoc_analysis
    - trend_detection
    - anomaly_detection
  tier_3_patterns:
    - predictive_modeling
    - complex_attribution
    - causal_inference

analytics:
  data_sources:
    - name: orders
      type: postgresql
      connection: {{ordersDbUrl}}
      tables: [orders, order_items, customers]
    - name: events
      type: clickhouse
      connection: {{eventsDbUrl}}
      tables: [events, sessions, users]
    - name: inventory
      type: mysql
      connection: {{inventoryDbUrl}}
      tables: [products, stock, warehouses]

  metrics:
    - name: revenue
      query: |
        SELECT DATE_TRUNC('day', created_at) as day, SUM(total) as revenue
        FROM orders WHERE status != 'cancelled'
        GROUP BY day ORDER BY day DESC
      refresh: hourly
    - name: conversion_rate
      query: |
        SELECT 
          COUNT(DISTINCT CASE WHEN status != 'cancelled' THEN customer_id END)::float /
          NULLIF(COUNT(DISTINCT customer_id), 0) as rate
        FROM orders
        WHERE created_at > NOW() - INTERVAL '30 days'
      refresh: daily
    - name: avg_order_value
      query: |
        SELECT AVG(total) FROM orders WHERE status != 'cancelled'
      refresh: hourly

  reports:
    - name: daily_summary
      schedule: "0 6 * * *"
      format: pdf
      recipients: [{{recipients}}]
      sections: [revenue, orders, customers, inventory]
    - name: weekly_trends
      schedule: "0 8 * * 1"
      format: html
      recipients: [{{recipients}}]
      sections: [traffic, conversion, cohorts, retention]

  ml_models:
    - name: churn_prediction
      type: classification
      features: [recency, frequency, monetary, support_tickets]
      target: churned_30d
      schedule: daily
    - name: demand_forecasting
      type: regression
      features: [historical_sales, seasonality, promotions, holidays]
      target: next_week_demand
      schedule: weekly

monitoring:
  metrics:
    - queries_executed_total
    - query_duration_seconds
    - cache_hit_rate
    - report_generation_duration
    - ml_inference_latency
  alerts:
    - name: stale_data
      expr: time_since_last_refresh > 86400
      severity: warning
    - name: query_timeout
      expr: rate(query_timeouts[5m]) > 0.01
      severity: critical
    - name: ml_drift
      expr: prediction_accuracy < {{mlAccuracyThreshold}}
      severity: warning`,
            variables: [
                { name: 'name', type: 'string', description: 'Agent name', required: true },
                { name: 'version', type: 'string', description: 'Template version', required: true, default: '1.0.0' },
                { name: 'description', type: 'string', description: 'Agent description', required: true },
                { name: 'model', type: 'string', description: 'LLM model', required: true, default: 'sonnet' },
                { name: 'memoryNamespace', type: 'string', description: 'Memory namespace', required: false, default: 'analytics' },
                { name: 'retentionDays', type: 'number', description: 'Memory retention (days)', required: false, default: 365 },
                { name: 'cacheSize', type: 'number', description: 'Working cache size', required: false, default: 10000 },
                { name: 'defaultTier', type: 'number', description: 'Default routing tier', required: false, default: 2 },
                { name: 'ordersDbUrl', type: 'string', description: 'Orders database URL', required: true },
                { name: 'eventsDbUrl', type: 'string', description: 'Events database URL', required: true },
                { name: 'inventoryDbUrl', type: 'string', description: 'Inventory database URL', required: true },
                { name: 'recipients', type: 'string', description: 'Report recipients', required: false, default: 'analytics-team,management' },
                { name: 'mlAccuracyThreshold', type: 'number', description: 'ML accuracy threshold', required: false, default: 0.7 }
            ],
            metadata: {
                author: 'inno-optimize',
                createdAt: new Date('2026-01-01'),
                updatedAt: new Date('2026-01-01'),
                version: '1.0.0',
                downloads: 0,
                rating: 5,
                tags: ['analytics', 'bi', 'ml'],
                compatibleVersions: ['0.1.0+']
            }
        });
        // Compliance Agent Template
        this.registerTemplate({
            id: 'agent-compliance',
            name: 'Compliance Agent',
            version: '1.0.0',
            description: 'Template for automated compliance monitoring agents',
            category: 'agent',
            tags: ['compliance', 'security', 'audit', 'soc2', 'gdpr', 'pci'],
            content: `name: {{name}}
version: {{version}}
description: {{description}}
model: {{model}}

capabilities:
  policy_evaluation: true
  audit_trail: true
  alert_generation: true
  remediation_suggestion: true
  evidence_collection: true
  mcp_tools:
    - audit-log
    - policy-engine
    - secrets-manager
    - vulnerability-scanner

memory:
  namespace: {{memoryNamespace}}
  retention_days: {{retentionDays}}
  working_cache_size: {{cacheSize}}

hooks:
  pre_check:
    - load_current_regulations
    - fetch_policy_definitions
    - validate_scope
  post_check:
    - generate_audit_record
    - update_compliance_dashboard
    - store_evidence
  on_violation:
    - escalate_to_security
    - create_remediation_ticket
    - notify_compliance_officer
    - initiate_automated_remediation

routing:
  default_tier: {{defaultTier}}
  tier_1_patterns: []
  tier_2_patterns:
    - policy_lookup
    - regulation_search
  tier_3_patterns:
    - compliance_assessment
    - gap_analysis
    - remediation_planning
    - audit_preparation

compliance:
  frameworks:
    - name: SOC2
      version: "2023"
      controls: [CC1-CC9, A1-A2, PI1-PI3]
      frequency: continuous
    - name: GDPR
      version: "2018"
      articles: [5, 6, 7, 12-23, 25, 30-34]
      frequency: continuous
    - name: PCI-DSS
      version: "4.0"
      requirements: [1-12]
      frequency: daily
    - name: HIPAA
      version: "2023"
      rules: [Privacy, Security, Breach Notification]
      frequency: continuous
    - name: ISO27001
      version: "2022"
      clauses: [4-10]
      frequency: weekly

  policies:
    - name: data_retention
      rule: |
        DELETE FROM user_data 
        WHERE last_activity < NOW() - INTERVAL '7 years'
        AND NOT legal_hold
      schedule: daily
      severity: critical
    - name: encryption_at_rest
      rule: |
        ALL tables MUST have encryption enabled
        CHECK: pg_tables.encrypted = true
      schedule: continuous
      severity: critical
    - name: access_control
      rule: |
        NO direct database access for applications
        ALL access via service accounts with least privilege
      schedule: continuous
      severity: high
    - name: audit_logging
      rule: |
        ALL mutating operations MUST be logged
        Logs MUST be immutable for 7 years
      schedule: continuous
      severity: critical

  checks:
    - name: secrets_scanning
      type: static_analysis
      tools: [truffleHog, git-secrets, detect-secrets]
      frequency: on_commit
      severity: critical
    - name: vulnerability_scanning
      type: container_scan
      tools: [trivy, grype, syft]
      frequency: daily
      severity: high
    - name: dependency_audit
      type: npm_audit
      frequency: weekly
      severity: medium
    - name: configuration_drift
      type: iac_scan
      tools: [checkov, tfsec, terrascan]
      frequency: daily
      severity: high
    - name: data_classification
      type: ml_classification
      model: pii-detector-v3
      frequency: continuous
      severity: high

  remediation:
    automated:
      - rotate_exposed_secrets
      - revoke_excessive_permissions
      - enable_encryption
      - quarantine_non_compliant_resources
    manual:
      - legal_review_required
      - architecture_change_needed
      - vendor_negotiation_required

monitoring:
  metrics:
    - compliance_score_overall
    - compliance_score_by_framework
    - violations_total
    - violations_by_severity
    - remediation_time_seconds
    - audit_readiness_score
  alerts:
    - name: critical_violation
      expr: violations_critical > 0
      severity: critical
      notification: immediate
    - name: compliance_score_drop
      expr: compliance_score < {{complianceThreshold}}
      severity: warning
      notification: hourly
    - name: audit_due
      expr: days_until_audit < 30
      severity: info
      notification: daily
    - name: policy_drift
      expr: policy_drift_detected > 0
      severity: high
      notification: immediate

  dashboards:
    - name: compliance_overview
      panels: [score_trend, violations_by_type, remediation_status, upcoming_audits]
    - name: framework_detail
      panels: [control_status, evidence_coverage, test_results, gaps]
    - name: remediation_tracking
      panels: [open_tickets, sla_compliance, aging, root_causes]`,
            variables: [
                { name: 'name', type: 'string', description: 'Agent name', required: true },
                { name: 'version', type: 'string', description: 'Template version', required: true, default: '1.0.0' },
                { name: 'description', type: 'string', description: 'Agent description', required: true },
                { name: 'model', type: 'string', description: 'LLM model', required: true, default: 'opus' },
                { name: 'memoryNamespace', type: 'string', description: 'Memory namespace', required: false, default: 'compliance' },
                { name: 'retentionDays', type: 'number', description: 'Memory retention (days)', required: false, default: 2555 },
                { name: 'cacheSize', type: 'number', description: 'Working cache size', required: false, default: 20000 },
                { name: 'defaultTier', type: 'number', description: 'Default routing tier', required: false, default: 3 },
                { name: 'complianceThreshold', type: 'number', description: 'Compliance score threshold', required: false, default: 90 }
            ],
            metadata: {
                author: 'inno-optimize',
                createdAt: new Date('2026-01-01'),
                updatedAt: new Date('2026-01-01'),
                version: '1.0.0',
                downloads: 0,
                rating: 5,
                tags: ['compliance', 'security', 'audit'],
                compatibleVersions: ['0.1.0+']
            }
        });
        // Saga Template
        this.registerTemplate({
            id: 'saga-order-processing',
            name: 'Order Processing Saga',
            version: '1.0.0',
            description: 'Complete order processing saga with compensation',
            category: 'saga',
            tags: ['saga', 'orders', 'payments', 'inventory', 'compensation'],
            content: `id: {{sagaId}}
name: Order Processing
version: {{version}}
steps:
  - id: validate-inventory
    name: Validate Inventory
    connector: business-inventory
    operation: check_stock
    inputMapper: (ctx) => ({ productIds: ctx.order.items.map(i => i.productId) })
    outputMapper: (result, ctx) => ({ inventoryValid: result.available })
    compensation:
      stepId: validate-inventory
      connector: business-inventory
      operation: release_stock
      inputMapper: (ctx, out) => ({ items: ctx.order.items })
    timeout: 5000
    retryPolicy:
      maxRetries: 3
      backoff: exponential
      baseDelayMs: 1000
  
  - id: process-payment
    name: Process Payment
    connector: business-payments
    operation: process_payment
    inputMapper: (ctx) => ({ 
      amount: ctx.order.total, 
      method: ctx.order.paymentMethod,
      idempotencyKey: ctx.order.id
    })
    outputMapper: (result, ctx) => ({ paymentId: result.paymentId })
    compensation:
      stepId: process-payment
      connector: business-payments
      operation: refund_payment
      inputMapper: (ctx, out) => ({ paymentId: out.paymentId, amount: ctx.order.total })
    timeout: 30000
    retryPolicy:
      maxRetries: 3
      backoff: exponential
      baseDelayMs: 2000
  
  - id: create-order
    name: Create Order Record
    connector: business-orders
    operation: create_order
    inputMapper: (ctx) => ctx.order
    outputMapper: (result, ctx) => ({ orderId: result.orderId })
    compensation:
      stepId: create-order
      connector: business-orders
      operation: cancel_order
      inputMapper: (ctx, out) => ({ orderId: out.orderId })
    timeout: 10000
  
  - id: notify-customer
    name: Notify Customer
    connector: business-messaging
    operation: send_confirmation
    inputMapper: (ctx) => ({ 
      customerId: ctx.order.customerId, 
      orderId: ctx.orderId,
      template: 'order_confirmation'
    })
    outputMapper: () => ({})
    timeout: 5000

compensation:
  strategy: backward
  steps:
    - stepId: notify-customer
      connector: business-messaging
      operation: send_cancellation
      inputMapper: (ctx, out) => ({ customerId: ctx.order.customerId, orderId: ctx.orderId })
    - stepId: create-order
      connector: business-orders
      operation: cancel_order
      inputMapper: (ctx, out) => ({ orderId: out.orderId })
    - stepId: process-payment
      connector: business-payments
      operation: refund_payment
      inputMapper: (ctx, out) => ({ paymentId: out.paymentId, amount: ctx.order.total })
    - stepId: validate-inventory
      connector: business-inventory
      operation: release_stock
      inputMapper: (ctx, out) => ({ items: ctx.order.items })

timeout: {{timeout}}
retryPolicy:
  maxRetries: 3
  backoff: exponential
  baseDelayMs: 1000
  maxDelayMs: 30000
  retryableErrors: [timeout, unavailable, rate_limit]

idempotencyKeys: [order-processing]`,
            variables: [
                { name: 'sagaId', type: 'string', description: 'Saga ID', required: true },
                { name: 'version', type: 'string', description: 'Saga version', required: true, default: '1.0.0' },
                { name: 'timeout', type: 'number', description: 'Total saga timeout (ms)', required: false, default: 60000 }
            ],
            metadata: {
                author: 'inno-optimize',
                createdAt: new Date('2026-01-01'),
                updatedAt: new Date('2026-01-01'),
                version: '1.0.0',
                downloads: 0,
                rating: 5,
                tags: ['saga', 'orders', 'payments', 'inventory'],
                compatibleVersions: ['0.1.0+']
            }
        });
    }
    constructor(memory) {
        this.memory = memory;
        this.loadBuiltinTemplates();
        this.loadFromMemory();
    }
    // Register a template
    registerTemplate(template) {
        this.templates.set(template.id, template);
    }
    // Get template by ID
    getTemplate(id) {
        return this.templates.get(id);
    }
    // List all templates
    listTemplates(category) {
        const templates = Array.from(this.templates.values());
        if (category) {
            return templates.filter(t => t.category === category);
        }
        return templates;
    }
    // Get templates by category
    getTemplatesByCategory() {
        const byCategory = new Map();
        for (const template of this.templates.values()) {
            const existing = byCategory.get(template.category) || [];
            existing.push(template);
            byCategory.set(template.category, existing);
        }
        return byCategory;
    }
    // Instantiate template with values
    instantiateTemplate(templateId, values) {
        const template = this.templates.get(templateId);
        if (!template)
            throw new Error(`Template not found: ${templateId}`);
        // Validate required variables
        for (const variable of template.variables) {
            if (variable.required && !(variable.name in values)) {
                if (variable.default !== undefined) {
                    values[variable.name] = variable.default;
                }
                else {
                    throw new Error(`Required variable missing: ${variable.name}`);
                }
            }
            // Apply defaults for optional variables
            if (!variable.required && !(variable.name in values) && variable.default !== undefined) {
                values[variable.name] = variable.default;
            }
        }
        // Render template
        let rendered = template.content;
        for (const [key, value] of Object.entries(values)) {
            const placeholder = `{{${key}}}`;
            rendered = rendered.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value));
        }
        // Apply remaining defaults
        for (const variable of template.variables) {
            const placeholder = `{{${variable.name}}}`;
            if (rendered.includes(placeholder)) {
                if (variable.default !== undefined) {
                    rendered = rendered.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(variable.default));
                }
                else if (variable.required) {
                    throw new Error(`Required variable not provided: ${variable.name}`);
                }
            }
        }
        const instanceId = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const instance = {
            id: instanceId,
            templateId: templateId,
            values,
            generatedAt: new Date(),
            outputPath: '',
            status: 'generated'
        };
        this.instances.set(instanceId, instance);
        return instance;
    }
    // Render template to string
    renderTemplate(templateId, values) {
        const template = this.templates.get(templateId);
        if (!template)
            throw new Error(`Template not found: ${templateId}`);
        let rendered = template.content;
        for (const [key, value] of Object.entries(values)) {
            const placeholder = `{{${key}}}`;
            rendered = rendered.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value));
        }
        // Apply defaults for missing variables
        for (const variable of template.variables) {
            const placeholder = `{{${variable.name}}}`;
            if (rendered.includes(placeholder)) {
                if (variable.default !== undefined) {
                    rendered = rendered.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(variable.default));
                }
            }
        }
        return rendered;
    }
    // Get template instance
    getInstance(instanceId) {
        return this.instances.get(instanceId);
    }
    // List instances
    listInstances(templateId) {
        const instances = Array.from(this.instances.values());
        if (templateId) {
            return instances.filter(i => i.templateId === templateId);
        }
        return instances;
    }
    // Save instance output
    async saveInstanceOutput(instanceId, outputPath) {
        const instance = this.instances.get(instanceId);
        if (!instance)
            throw new Error(`Instance not found: ${instanceId}`);
        instance.outputPath = outputPath;
        instance.status = 'generated';
        // Persist to memory
        await this.memory.insert([{
                id: `template-instance:${instanceId}`,
                type: 'episodic',
                tier: 2,
                content: JSON.stringify(instance),
                embedding: new Array(384).fill(0.1),
                metadata: { domain: 'templates', taskType: 'instance', mode: 'systems', context: 'template-persistence', tags: ['templates', 'optimization'] },
                provenance: { agentId: 'template-manager', sessionId: 'templates', source: 'agent', timestamp: new Date() },
                reward: 1,
                consolidated: false,
                accessCount: 0,
                lastAccessed: new Date(),
                createdAt: new Date()
            }]);
    }
    // Search templates
    searchTemplates(query) {
        const q = query.toLowerCase();
        return Array.from(this.templates.values()).filter(t => t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.tags.some(tag => tag.toLowerCase().includes(q)));
    }
    // Export template
    exportTemplate(templateId) {
        const template = this.templates.get(templateId);
        if (!template)
            throw new Error(`Template not found: ${templateId}`);
        return JSON.stringify(template, null, 2);
    }
    // Import template
    importTemplate(json) {
        const template = JSON.parse(json);
        this.registerTemplate(template);
        return template;
    }
    loadFromMemory() {
        // Load from AgentDB
    }
    getAllTemplates() {
        return Array.from(this.templates.values());
    }
    getTemplateCount() {
        return this.templates.size;
    }
}
//# sourceMappingURL=manager.js.map
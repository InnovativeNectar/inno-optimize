import { 
  RegressionAlert, 
  RegressionConfig, 
  RegressionMetric,
  RegressionAlert as RegressionAlertType
} from '../types';
import { FastStore } from '@inno-optimize/agentdb';

export class RegressionDetector {
  private memory: FastStore;
  private config: RegressionConfig;
  private baselines = new Map<string, RegressionMetric>();
  private alerts: RegressionAlert[] = [];
  private monitoring = false;
  private intervalId?: NodeJS.Timeout;
  
  constructor(memory: FastStore, config: RegressionConfig) {
    this.memory = memory;
    this.config = config;
  }
  
  async start(): Promise<void> {
    if (this.monitoring) return;
    this.monitoring = true;
    
    // Load baselines
    await this.loadBaselines();
    
    // Start monitoring
    this.intervalId = setInterval(() => {
      this.checkRegressions().catch(console.error);
    }, 60000); // Check every minute
  }
  
  async stop(): Promise<void> {
    this.monitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
  
  // Record metric value
  async recordMetric(metric: RegressionMetric): Promise<void> {
    // Update current value
    const existing = this.baselines.get(metric.name);
    if (existing) {
      existing.current = metric.current;
    } else {
      this.baselines.set(metric.name, { ...metric });
    }
    
    // Check for regression immediately
    await this.checkMetricRegression(metric);
  }
  
  // Set baseline for metric
  async setBaseline(metric: RegressionMetric): Promise<void> {
    this.baselines.set(metric.name, { ...metric, baseline: metric.current });
    await this.persistBaseline(metric.name);
  }
  
  // Get all baselines
  getBaselines(): RegressionMetric[] {
    return Array.from(this.baselines.values());
  }
  
  // Get alerts
  getAlerts(acknowledged?: boolean): RegressionAlert[] {
    if (acknowledged === undefined) return [...this.alerts];
    return this.alerts.filter(a => a.acknowledged === acknowledged);
  }
  
  // Acknowledge alert
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      await this.persistAlert(alert);
    }
  }
  
  // Get regression report
  async getReport(): Promise<{
    summary: {
      totalMetrics: number;
      regressed: number;
      improved: number;
      stable: number;
    };
    alerts: RegressionAlert[];
    trends: Array<{ metric: string; trend: 'improving' | 'stable' | 'degrading'; data: number[] }>;
  }> {
    const metrics = Array.from(this.baselines.values());
    let regressed = 0, improved = 0, stable = 0;
    
    for (const metric of metrics) {
      const deltaPercent = ((metric.current - metric.baseline) / metric.baseline) * 100;
      const threshold = metric.higherIsBetter ? -this.config.thresholds.warning : this.config.thresholds.warning;
      
      if (deltaPercent <= threshold) regressed++;
      else if (deltaPercent >= -threshold) improved++;
      else stable++;
    }
    
    return {
      summary: {
        totalMetrics: metrics.length,
        regressed,
        improved,
        stable
      },
      alerts: this.alerts.filter(a => !a.acknowledged),
      trends: [] // Would compute from history
    };
  }
  
  // Main regression check
  private async checkRegressions(): Promise<void> {
    for (const metric of this.baselines.values()) {
      await this.checkMetricRegression(metric);
    }
  }
  
  private async checkMetricRegression(metric: RegressionMetric): Promise<void> {
    if (metric.baseline === 0) return;
    
    const delta = metric.current - metric.baseline;
    const deltaPercent = (delta / metric.baseline) * 100;
    
    // Determine if regression based on direction
    const isRegression = metric.higherIsBetter 
      ? deltaPercent <= -this.config.thresholds.warning
      : deltaPercent >= this.config.thresholds.warning;
    
    const isCritical = metric.higherIsBetter
      ? deltaPercent <= -this.config.thresholds.critical
      : deltaPercent >= this.config.thresholds.critical;
    
    if (isRegression) {
      const severity = isCritical ? 'critical' : 'warning';
      
      // Check if alert already exists
      const existingAlert = this.alerts.find(a => 
        a.metric === metric.name && !a.acknowledged
      );
      
      if (!existingAlert) {
        const alert: RegressionAlert = {
          id: `regression-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          metric: metric.name,
          baseline: metric.baseline,
          current: metric.current,
          delta,
          deltaPercent,
          severity,
          detectedAt: new Date(),
          commitRange: await this.getRecentCommitRange(),
          affectedComponents: await this.getAffectedComponents(metric.name),
          suggestedAction: this.generateSuggestedAction(metric, deltaPercent),
          acknowledged: false
        };
        
        this.alerts.push(alert);
        await this.persistAlert(alert);
        
        // Auto-alert if configured
        if (this.config.autoAlert) {
          await this.sendAlert(alert);
        }
      } else {
        // Update existing alert
        existingAlert.current = metric.current;
        existingAlert.delta = delta;
        existingAlert.deltaPercent = deltaPercent;
        existingAlert.severity = severity;
        existingAlert.detectedAt = new Date();
        await this.persistAlert(existingAlert);
      }
    } else {
      // Metric improved or stable - resolve any existing alert
      const existingAlert = this.alerts.find(a => 
        a.metric === metric.name && !a.acknowledged
      );
      if (existingAlert) {
        existingAlert.acknowledged = true;
        await this.persistAlert(existingAlert);
      }
    }
  }
  
  private async getRecentCommitRange(): Promise<string> {
    // Would get from git
    return 'HEAD~10..HEAD';
  }
  
  private async getAffectedComponents(metricName: string): Promise<string[]> {
    // Map metric to components
    const mapping: Record<string, string[]> = {
      'hnsw_search_latency': ['agentdb', 'hnsw'],
      'batch_insert_latency': ['agentdb', 'quantization'],
      'mcp_response_p95': ['mcp-framework', 'connectors'],
      'swarm_consensus_latency': ['coordination', 'consensus'],
      'architecture_score': ['ast-analysis', 'scorer'],
      'memory_usage': ['agentdb', 'cache'],
      'error_rate': ['all']
    };
    return mapping[metricName] || ['unknown'];
  }
  
  private generateSuggestedAction(metric: RegressionMetric, deltaPercent: number): string {
    const actions: Record<string, string> = {
      'hnsw_search_latency': 'Check HNSW index fragmentation, consider reindexing or increasing efSearch',
      'batch_insert_latency': 'Review quantization level, consider batch size optimization',
      'mcp_response_p95': 'Check connector health, review rate limits, consider connection pooling',
      'swarm_consensus_latency': 'Check network latency, review consensus config, consider reducing maxAgents',
      'architecture_score': 'Run architecture analysis, address new anti-patterns or debt items',
      'memory_usage': 'Check for memory leaks, review cache eviction, consider compaction',
      'error_rate': 'Review recent deployments, check error logs, verify circuit breakers'
    };
    return actions[metric.name] || 'Investigate recent changes and review system health';
  }
  
  private async loadBaselines(): Promise<void> {
    // Load from AgentDB
  }
  
  private async persistBaseline(name: string): Promise<void> {
    const metric = this.baselines.get(name);
    if (!metric) return;
    
    await this.memory.insert([{
      id: `baseline:${name}`,
      type: 'semantic',
      tier: 3,
      content: JSON.stringify(metric),
      embedding: new Array(384).fill(0.1),
      metadata: { domain: 'regression', taskType: 'baseline' },
      provenance: { agentId: 'regression-detector', sessionId: 'regression', source: 'system', timestamp: new Date() },
      reward: 1,
      consolidated: true,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date()
    }]);
  }
  
  private async persistAlert(alert: RegressionAlert): Promise<void> {
    await this.memory.insert([{
      id: `alert:${alert.id}`,
      type: 'episodic',
      tier: 2,
      content: JSON.stringify(alert),
      embedding: new Array(384).fill(0.1),
      metadata: { domain: 'regression', taskType: 'alert' },
      provenance: { agentId: 'regression-detector', sessionId: 'regression', source: 'system', timestamp: new Date() },
      reward: 0,
      consolidated: false,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: alert.detectedAt
    }]);
  }
  
  private async sendAlert(alert: RegressionAlert): Promise<void> {
    // Would integrate with notification system
    console.log(`REGRESSION ALERT: ${alert.metric} ${alert.deltaPercent.toFixed(1)}% (${alert.severity})`);
  }
  
  getConfig(): RegressionConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<RegressionConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

export function createDefaultRegressionConfig(): RegressionConfig {
  return {
    metrics: [
      { name: 'hnsw_search_latency', baseline: 0.8, current: 0.8, unit: 'ms', higherIsBetter: false, category: 'latency' },
      { name: 'batch_insert_latency', baseline: 1.2, current: 1.2, unit: 'ms', higherIsBetter: false, category: 'latency' },
      { name: 'mcp_response_p95', baseline: 250, current: 250, unit: 'ms', higherIsBetter: false, category: 'latency' },
      { name: 'swarm_consensus_latency', baseline: 30, current: 30, unit: 'ms', higherIsBetter: false, category: 'latency' },
      { name: 'architecture_score', baseline: 75, current: 75, unit: 'score', higherIsBetter: true, category: 'quality' },
      { name: 'memory_usage', baseline: 500, current: 500, unit: 'MB', higherIsBetter: false, category: 'memory' },
      { name: 'error_rate', baseline: 0.01, current: 0.01, unit: '%', higherIsBetter: false, category: 'quality' }
    ],
    thresholds: {
      warning: 5,    // 5%
      critical: 10   // 10%
    },
    lookbackWindow: 10,
    statisticalTest: 'mann-whitney',
    minSamples: 30,
    autoAlert: true
  };
}
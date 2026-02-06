/**
 * Azure Application Insights Integration
 * 
 * This module sets up Azure Application Insights for centralized logging and monitoring.
 * It integrates with Winston logger to automatically forward structured logs to Azure.
 * 
 * Features:
 * - Automatic log forwarding to Azure Application Insights
 * - Configurable sampling (50-100%) for cost control
 * - 1-day retention recommended (configured in Azure Portal)
 * - Request correlation and distributed tracing
 * - Performance and dependency tracking
 * 
 * Setup:
 * 1. Set AZURE_APP_INSIGHTS_CONNECTION_STRING environment variable
 * 2. Configure 1-day retention in Azure Portal (Settings → Data Retention)
 * 3. Logs automatically flow to Application Insights
 * 
 * See docs/AZURE_APP_INSIGHTS.md for detailed setup instructions.
 */

import { setup, defaultClient, Contracts, TelemetryClient } from 'applicationinsights';

let appInsightsConfigured = false;
let client: TelemetryClient | null = null;

/**
 * Initialize Azure Application Insights
 * Call this once at application startup, before creating the Winston logger
 * 
 * @returns TelemetryClient if successfully initialized, null otherwise
 */
export function initializeAppInsights(): TelemetryClient | null {
  const connectionString = process.env.AZURE_APP_INSIGHTS_CONNECTION_STRING;
  
  if (!connectionString) {
    return null;
  }
  
  if (appInsightsConfigured) {
    return client;
  }
  
  try {
    // Initialize Application Insights
    setup(connectionString)
      .setAutoDependencyCorrelation(true)  // Correlate requests and dependencies
      .setAutoCollectRequests(true)        // Auto-collect HTTP requests
      .setAutoCollectPerformance(true, true)  // Collect performance counters
      .setAutoCollectExceptions(true)      // Auto-collect unhandled exceptions
      .setAutoCollectDependencies(true)    // Auto-collect dependencies (DB, HTTP, etc.)
      .setAutoCollectConsole(false)        // Don't auto-collect console (we use Winston)
      .setSendLiveMetrics(false)           // Disable live metrics (not needed, reduces bandwidth)
      .start();
    
    client = defaultClient;
    appInsightsConfigured = true;
    
    // Configure sampling to reduce costs
    // 100% in production for complete visibility, 50% in other environments
    const isProduction = process.env.NODE_ENV === 'production';
    const samplingPercentage = isProduction ? 100 : 50;
    
    if (client?.config) {
      client.config.samplingPercentage = samplingPercentage;
    }
    
    // Log success (only in non-production to avoid circular logging)
    if (!isProduction) {
      console.log(`✅ Azure Application Insights initialized (${samplingPercentage}% sampling)`);
      console.log('   Logs will be sent to Azure with 1-day retention (configure in Portal)');
    }
    
    return client;
  } catch (error) {
    console.error('❌ Failed to initialize Azure Application Insights:', error);
    return null;
  }
}

/**
 * Get the Application Insights client if initialized
 * @returns TelemetryClient or null if not configured
 */
export function getAppInsightsClient(): TelemetryClient | null {
  return client;
}

/**
 * Check if Application Insights is configured and active
 * @returns true if App Insights is sending telemetry
 */
export function isAppInsightsEnabled(): boolean {
  return appInsightsConfigured && client !== null;
}

/**
 * Flush any pending telemetry to Azure
 * Call this before application shutdown to ensure all logs are sent
 * 
 * @param callback Optional callback to call when flush completes
 */
export function flushAppInsights(callback?: () => void): void {
  if (client) {
    client.flush();
    // Application Insights flush is synchronous in newer versions
    // Wait a moment for buffers to flush
    setTimeout(() => {
      if (callback) {
        callback();
      }
    }, 100);
  } else if (callback) {
    // If no client, just call the callback immediately
    callback();
  }
}

/**
 * Manually track a custom event in Application Insights
 * Use this for important business events (member created, event started, etc.)
 * 
 * @param name Event name
 * @param properties Event properties/metadata
 */
export function trackEvent(name: string, properties?: Record<string, string>): void {
  if (client) {
    client.trackEvent({
      name,
      properties,
    });
  }
}

/**
 * Manually track a custom metric in Application Insights
 * Use this for performance metrics, counters, etc.
 * 
 * @param name Metric name
 * @param value Metric value
 * @param properties Optional metadata
 */
export function trackMetric(name: string, value: number, properties?: Record<string, string>): void {
  if (client) {
    client.trackMetric({
      name,
      value,
      properties,
    });
  }
}

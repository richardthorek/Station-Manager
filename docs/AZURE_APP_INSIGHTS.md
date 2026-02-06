# Azure Application Insights Configuration Guide

## Overview

Azure Application Insights is now integrated with the RFS Station Manager for centralized, structured logging. This guide explains how to configure it with short retention (1 day) for cost optimization.

## Why 1-Day Retention?

**Cost Benefits:**
- Application Insights charges based on data ingestion and retention
- 1-day retention is ideal for real-time monitoring and debugging
- Significantly reduces costs compared to 30-90 day retention
- Logs older than 1 day are automatically purged

**Use Cases for Short Retention:**
- Real-time error monitoring and alerting
- Active debugging of production issues
- Performance monitoring and trending
- Immediate incident response

**When to Use Longer Retention:**
- Compliance requirements
- Long-term trend analysis
- Audit trails
- Historical performance comparison

## Setup Instructions

### 1. Create Application Insights Resource

```bash
# Using Azure CLI
az monitor app-insights component create \
  --app rfs-station-manager \
  --location australiaeast \
  --resource-group <your-resource-group> \
  --application-type Node.JS
```

Or via Azure Portal:
1. Navigate to Azure Portal → Create a resource
2. Search for "Application Insights"
3. Select your resource group and region
4. Set Application Type to "Node.js"
5. Click "Create"

### 2. Configure 1-Day Retention

**Via Azure Portal:**

1. Navigate to your Application Insights resource
2. Go to **Settings** → **Usage and estimated costs**
3. Click **Data Retention**
4. Set retention to **1 day** (minimum allowed)
5. Click **Apply**

**Via Azure CLI:**

```bash
az monitor app-insights component update \
  --app rfs-station-manager \
  --resource-group <your-resource-group> \
  --retention-time 1
```

**Important Notes:**
- 1 day is the minimum retention period for Application Insights
- You cannot set retention below 1 day
- This affects all telemetry types (logs, traces, metrics)
- Data is automatically deleted after 24 hours

### 3. Get Connection String

**Via Azure Portal:**
1. Navigate to your Application Insights resource
2. Click **Overview**
3. Copy the **Connection String** (not Instrumentation Key)
4. Format: `InstrumentationKey=xxx;IngestionEndpoint=https://xxx`

**Via Azure CLI:**

```bash
az monitor app-insights component show \
  --app rfs-station-manager \
  --resource-group <your-resource-group> \
  --query connectionString -o tsv
```

### 4. Configure Environment Variable

Add to your `.env` file:

```bash
# Azure Application Insights (optional)
AZURE_APP_INSIGHTS_CONNECTION_STRING="InstrumentationKey=xxx;IngestionEndpoint=https://xxx"
```

**Azure App Service Configuration:**
1. Go to your App Service
2. Navigate to **Settings** → **Configuration**
3. Click **+ New application setting**
4. Name: `AZURE_APP_INSIGHTS_CONNECTION_STRING`
5. Value: Your connection string
6. Click **OK** and **Save**

### 5. Verify Integration

Start your server and look for this message:

```
✅ Azure Application Insights logging enabled
```

Check Azure Portal:
1. Navigate to Application Insights
2. Go to **Monitoring** → **Logs**
3. Run query: `traces | order by timestamp desc | take 10`
4. You should see logs appearing within 1-2 minutes

## Configuration Options

### Current Configuration

The logger is configured with:

```typescript
{
  connectionString: process.env.AZURE_APP_INSIGHTS_CONNECTION_STRING,
  samplingPercentage: 100, // 100% in production, 50% in development
}
```

### Sampling Configuration

**What is Sampling?**
- Sampling reduces the volume of telemetry sent to Application Insights
- Helps reduce costs while maintaining statistical accuracy
- Currently set to 100% (all logs) in production

**To Reduce Costs Further:**

Edit `backend/src/services/logger.ts`:

```typescript
samplingPercentage: 50, // Only send 50% of logs
```

Recommended sampling rates:
- **100%**: Critical production systems, active debugging
- **50%**: Normal production operations
- **10-25%**: High-volume systems with cost constraints

### Disable in Development

To disable App Insights in development, simply don't set the environment variable:

```bash
# .env.local (not committed)
# AZURE_APP_INSIGHTS_CONNECTION_STRING=  # Commented out
```

## Querying Logs in Azure

### Basic Queries

**Recent errors:**
```kusto
traces
| where severityLevel >= 3  // Error level and above
| order by timestamp desc
| take 50
```

**Logs from last hour:**
```kusto
traces
| where timestamp > ago(1h)
| order by timestamp desc
```

**Logs with request ID:**
```kusto
traces
| where customDimensions.requestId != ""
| project timestamp, message, requestId=customDimensions.requestId
| order by timestamp desc
```

**Performance metrics:**
```kusto
traces
| where message == "Performance metric"
| project timestamp, operation=customDimensions.operation, durationMs=customDimensions.durationMs
| summarize avg(durationMs), max(durationMs), min(durationMs) by operation
```

**Error rate over time:**
```kusto
traces
| where severityLevel >= 3
| summarize count() by bin(timestamp, 5m)
| render timechart
```

### Log Levels in Application Insights

Winston levels map to Application Insights severity:

| Winston Level | App Insights Severity | Value |
|--------------|----------------------|-------|
| error | Error | 3 |
| warn | Warning | 2 |
| info | Information | 1 |
| debug | Verbose | 0 |

## Setting Up Alerts (Optional)

### Create Alert for High Error Rate

1. Navigate to Application Insights
2. Go to **Monitoring** → **Alerts**
3. Click **+ Create** → **Alert rule**
4. Select your resource
5. Add condition:
   - Signal: "Custom log search"
   - Query: `traces | where severityLevel >= 3 | summarize count()`
   - Alert logic: Count > 10 (in 5 minutes)
6. Add action group (email, SMS, etc.)
7. Set severity and name
8. Click **Create alert rule**

### Recommended Alerts

**High Error Rate:**
- Query: Error count > 10 in 5 minutes
- Action: Email to on-call team

**Service Unavailable:**
- Query: No logs received in 5 minutes
- Action: SMS alert

**Performance Degradation:**
- Query: Average response time > 1000ms
- Action: Email notification

## Cost Estimation

### With 1-Day Retention

Assuming moderate traffic (100 requests/hour):

**Data Ingestion:**
- ~500KB per hour
- ~12MB per day
- ~360MB per month

**Estimated Monthly Cost:**
- Data ingestion: $2-3 USD
- Data retention (1 day): $0 (minimal)
- **Total: $2-5 USD/month**

### Cost Reduction Tips

1. **Use Sampling**: 50% sampling = 50% cost reduction
2. **Filter Logs**: Only send error/warn in production
3. **Short Retention**: Keep at 1 day unless required
4. **Log Selectively**: Don't log debug-level in production
5. **Set Budget Alerts**: Get notified if costs increase

## Monitoring Cost

1. Navigate to Application Insights
2. Go to **Settings** → **Usage and estimated costs**
3. View daily ingestion volume
4. Set daily cap (optional): Limits data ingestion to prevent runaway costs

## Troubleshooting

### No Logs Appearing

**Check Connection String:**
```bash
echo $AZURE_APP_INSIGHTS_CONNECTION_STRING
```

**Check Server Logs:**
```bash
# Look for this message
✅ Azure Application Insights logging enabled

# Or this error
❌ Failed to initialize Azure Application Insights transport
```

**Verify Network Access:**
- Ensure firewall allows HTTPS to `*.applicationinsights.azure.com`
- Check App Service outbound connectivity

**Check Sampling:**
- With 50% sampling, you'll only see ~50% of logs
- Increase to 100% for troubleshooting

### Logs Delayed

**Normal Delay:**
- 1-2 minutes typical latency
- Up to 5 minutes during high load

**Check Ingestion Status:**
1. Navigate to Application Insights
2. Go to **Monitoring** → **Metrics**
3. Select metric: "Server requests"
4. View recent data

### High Costs

**Immediate Actions:**
1. Check data ingestion volume in portal
2. Enable sampling (50% or lower)
3. Set daily cap to prevent overages
4. Review log levels (disable debug in production)

**Long-term Solutions:**
1. Implement log filtering
2. Use structured logging selectively
3. Consider alternative solutions for high-volume systems

## Disabling Application Insights

To disable completely:

1. Remove or comment out environment variable:
```bash
# AZURE_APP_INSIGHTS_CONNECTION_STRING=
```

2. Restart application

3. Verify in logs:
```
# Should NOT see this message
✅ Azure Application Insights logging enabled
```

## Best Practices

1. **Use 1-Day Retention** for cost optimization
2. **Enable Sampling** (50-100%) based on needs
3. **Set Up Alerts** for critical errors
4. **Monitor Costs** weekly
5. **Query Regularly** to ensure data is flowing
6. **Use Structured Metadata** for better filtering
7. **Include Request IDs** for request tracing
8. **Test in Development** before production deployment

## Related Documentation

- [Azure Application Insights Documentation](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)
- [Kusto Query Language (KQL) Reference](https://learn.microsoft.com/en-us/azure/data-explorer/kusto/query/)
- [LOGGING.md](./LOGGING.md) - Application logging guide
- [AS_BUILT.md](./AS_BUILT.md) - System architecture

## Support

For issues with Application Insights:
1. Check Azure Service Health
2. Review Application Insights documentation
3. Contact Azure Support if needed
4. Open GitHub issue for integration-specific problems

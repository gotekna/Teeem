# Xero API Integration Analysis for TEEEM

## Executive Summary

**Critical Finding**: Based on your current $10/month Xero plan and 209 suppliers, the two-way contact sync is **well within API limits** if implemented correctly. The risk of exceeding limits is minimal with proper optimization strategies.

## Current Situation

### TEEEM Data Volume
- **209 Suppliers** (confirmed in production)
- **5,285 Price Book Items**
- **3,626 Price History Records**

### Xero API Limits (Confirmed for 2025)
- **60 calls per minute** (rolling 60-second window)
- **5,000 calls per day** (rolling 24-hour window)
- **5 concurrent requests** maximum
- **10,000 calls per minute** app-wide across all organizations
- **3.5MB maximum payload** size per request

**Important**: These limits are the same for ALL Xero plans - no difference between pricing tiers.

## API Usage Calculation for Contact Sync

### Initial Bulk Sync (One-Time)
**Scenario**: Syncing all 209 suppliers as contacts to Xero

**With Batch Operations (Recommended)**:
- Xero supports up to 50 contacts per API call
- Required calls: 209 ÷ 50 = **5 API calls**
- Time to complete: < 10 seconds
- Daily limit usage: **0.1%**

**Without Batching (Not Recommended)**:
- Required calls: 209 (one per contact)
- Time to complete: 4 minutes (respecting rate limit)
- Daily limit usage: **4.2%**

### Daily Sync Operations

**Pessimistic Scenario** (10% of suppliers updated daily):
- 21 suppliers modified daily
- With batching: 1-2 API calls
- Without batching: 21 API calls
- Daily limit usage: **0.04% - 0.42%**

**Realistic Scenario** (5% of suppliers updated daily):
- 10 suppliers modified daily
- With batching: 1 API call
- Without batching: 10 API calls
- Daily limit usage: **0.02% - 0.2%**

**High Activity Scenario** (25% of suppliers updated daily):
- 52 suppliers modified daily
- With batching: 2-3 API calls
- Without batching: 52 API calls
- Daily limit usage: **0.06% - 1.04%**

### Two-Way Sync with Webhooks

**Xero → TEEEM (Using Webhooks)**:
- **Zero polling API calls** - webhooks push changes to you
- Only requires API calls for fetching full contact details when needed
- Estimated: 5-10 API calls per day for detail fetching

**TEEEM → Xero (Push on Change)**:
- Only sync when TEEEM data changes
- Batch multiple changes within a time window (e.g., every 5 minutes)
- Estimated: 10-20 API calls per day

**Total Daily API Usage with Optimal Implementation**:
- **15-30 API calls per day**
- **0.3% - 0.6% of daily limit**
- **Well under the per-minute limit**

## Optimization Strategies

### 1. Implement Webhooks (Highest Priority)
- **60% reduction in API traffic** compared to polling
- Zero API calls for monitoring changes
- Real-time updates without constant checking
- Webhook events available for: Contact Creation, Modification, Deletion

### 2. Batch Operations
- Always batch contact updates (up to 50 per call)
- Queue changes and sync every 5-15 minutes
- Combine create/update operations in single requests

### 3. Smart Sync Logic
```
Initial Sync:
- Batch all 209 suppliers into ~5 API calls
- Run during off-peak hours if concerned

Daily Operations:
- Use webhooks to receive Xero changes
- Queue TEEEM changes for batch processing
- Only sync actual changes (delta sync)
- Use If-Modified-Since header for polling (if needed)
```

### 4. Implement Caching
- Cache Xero contact IDs locally
- Store last sync timestamps
- Track sync status for each supplier

### 5. Error Handling
- Implement exponential backoff for 429 errors
- Respect Retry-After headers
- Log all API calls for monitoring

## Risk Assessment

### Low Risk Factors ✅
- Small dataset (209 suppliers)
- Generous daily limit (5,000 calls)
- Batch operations available
- Webhooks eliminate polling needs

### Potential Risk Factors ⚠️
- If other integrations also use the API
- If sync frequency is too aggressive
- If batching is not implemented
- If error retry logic is too aggressive

### Risk Mitigation
1. **Monitor API Usage**: Track daily consumption in your app
2. **Set Alerts**: Notify when approaching 80% of limits
3. **Implement Circuit Breaker**: Stop syncing if approaching limits
4. **Use Webhooks**: Eliminate unnecessary polling
5. **Batch Everything**: Never sync contacts individually

## Implementation Recommendations

### Phase 1: Basic Sync (Week 1)
1. Implement batch contact creation/update
2. Add API call tracking and logging
3. Build one-way sync (TEEEM → Xero)
4. Test with subset of suppliers

### Phase 2: Webhook Integration (Week 2)
1. Set up webhook endpoint
2. Implement HMAC-SHA256 validation
3. Process contact events
4. Add two-way sync logic

### Phase 3: Optimization (Week 3)
1. Add intelligent batching queue
2. Implement caching layer
3. Add sync status dashboard
4. Set up monitoring and alerts

## Cost-Benefit Analysis

### Current Costs
- Xero subscription: $10/month (promotional) or $20/month (standard)
- API access: Included (no per-call charges)

### Benefits
- Automated contact sync eliminates manual data entry
- Real-time data consistency
- Reduced human error
- Time savings: ~2-4 hours/week

### ROI
- API usage will consume < 1% of available limits
- No need for plan upgrade based on API usage
- Significant operational efficiency gains

## Conclusion

**Your two-way contact sync is completely feasible within your current Xero plan limits.**

With 209 suppliers and proper implementation:
- You'll use **less than 1% of your daily API limit**
- Webhooks will eliminate most API calls
- Batch operations make sync extremely efficient
- No risk of hitting rate limits with recommended approach

### Key Success Factors
1. **Use webhooks** - This is critical for efficiency
2. **Always batch operations** - Never sync contacts one at a time
3. **Implement proper error handling** - Respect rate limits
4. **Monitor usage** - Track API consumption

### Next Steps
1. Verify your Xero plan includes API access (contact Xero if unclear)
2. Register for webhook access in Xero Developer Portal
3. Start with Phase 1 basic batch sync
4. Add webhooks to eliminate polling
5. Monitor and optimize based on actual usage

## Technical Resources

### Xero Developer Documentation
- [API Rate Limits](https://developer.xero.com/documentation/guides/oauth2/limits/)
- [Webhooks Overview](https://developer.xero.com/documentation/guides/webhooks/overview/)
- [Contacts API](https://developer.xero.com/documentation/api/accounting/contacts)

### Implementation Libraries
- Ruby: `xero-ruby` gem
- Webhook validation: HMAC-SHA256
- Batch size: 50 contacts per request
- Payload limit: 3.5MB per request

---

*Analysis Date: November 5, 2025*
*Based on: Xero API v2.0, 209 TEEEM suppliers*
*Prepared for: TEEEM Xero Integration Planning*
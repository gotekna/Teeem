# Xero Sync Status Architecture - Masterpiece Plan

## Current State Analysis

Three explore agents analyzed the entire Xero sync ecosystem and found **SSoT violations** that prevent this from being a masterpiece.

---

## SSoT Violations Found

### Violation #1: Dual Ownership of XeroSyncStatus Updates

**Problem:** Both Jobs AND Services update XeroSyncStatus for the same sync types.

| Sync Type | Job Updates | Service Updates | Violation |
|-----------|-------------|-----------------|-----------|
| invoices | XeroInvoiceSyncJob | ExternalInvoiceSyncService | ⚠️ DUAL |
| contacts | XeroContactSyncJob | XeroContactSyncService | ⚠️ DUAL |
| bank_transactions | XeroBankTransactionSyncJob | - | ✅ Single |
| attachments | XeroAttachmentSyncJob | - | ✅ Single |
| payments | - | XeroPaymentSyncService | ✅ Single |

**Impact:** Confusing ownership, race conditions possible, harder to debug.

### Violation #2: Inconsistent Method Usage

**Problem:** XeroBankTransactionSyncJob bypasses the standard helper methods.

```ruby
# ❌ Current (XeroBankTransactionSyncJob)
status = XeroSyncStatus.find_or_initialize_by(sync_type: "bank_transactions", tenant_id: nil)
status.update!(last_synced_at: Time.current, next_sync_at: 6.hours.from_now, ...)

# ✅ Standard pattern (all other jobs)
XeroSyncStatus.complete_sync!("invoices", tenant_id: tenant_id, records_synced: count)
```

**Impact:** Breaks consistency, harder to refactor, misses validation.

### Violation #3: Missing tenant_id in Attachment Sync

**Problem:** XeroAttachmentSyncJob never passes tenant_id to status updates.

```ruby
# ❌ Current
XeroSyncStatus.complete_sync!("attachments", records_synced: attachments_processed)

# ✅ Should be
XeroSyncStatus.complete_sync!("attachments", tenant_id: tenant_id, records_synced: count)
```

**Impact:** Self-heal can't detect stale attachment syncs per-tenant.

---

## Masterpiece Architecture

### Principle: Clear Ownership

```
┌─────────────────────────────────────────────────────────────────┐
│                    JOBS = STATUS OWNERS                          │
│  - Start sync status when job begins                            │
│  - Complete/fail sync status when job ends                      │
│  - Handle global + per-tenant status updates                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SERVICES = PURE BUSINESS LOGIC                   │
│  - Fetch data from Xero API                                     │
│  - Transform and save records                                   │
│  - Return success/failure + counts                              │
│  - NO XeroSyncStatus updates (that's the job's responsibility)  │
└─────────────────────────────────────────────────────────────────┘
```

### Target State

| Component | Responsibility | Updates XeroSyncStatus? |
|-----------|----------------|------------------------|
| XeroInvoiceSyncJob | Orchestrate invoice sync | ✅ Yes (global + per-tenant) |
| XeroContactSyncJob | Orchestrate contact sync | ✅ Yes (global + per-tenant) |
| XeroBankTransactionSyncJob | Orchestrate bank sync | ✅ Yes (global + per-tenant) |
| XeroAttachmentSyncJob | Orchestrate attachment sync | ✅ Yes (global + per-tenant) |
| XeroPaymentSyncJob | Orchestrate payment sync | ✅ Yes (global + per-tenant) |
| ExternalInvoiceSyncService | Business logic only | ❌ No |
| XeroContactSyncService | Business logic only | ❌ No |
| XeroPaymentSyncService | Business logic only | ❌ No |

---

## Implementation Steps

### Step 1: Standardize XeroBankTransactionSyncJob (10 min)

Replace raw `update!` calls with standard helper methods:

```ruby
# backend/app/jobs/xero_bank_transaction_sync_job.rb

def update_sync_status(result, tenant_id = nil)
  # Use standard helper methods instead of raw update!
  if result[:errors].empty?
    XeroSyncStatus.complete_sync!(
      "bank_transactions",
      tenant_id: nil,  # Global
      records_synced: result[:created] + result[:updated],
      next_sync_at: 6.hours.from_now
    )

    if tenant_id.present?
      XeroSyncStatus.complete_sync!(
        "bank_transactions",
        tenant_id: tenant_id,
        records_synced: result[:created] + result[:updated],
        next_sync_at: 6.hours.from_now
      )
    end
  else
    XeroSyncStatus.fail_sync!(
      "bank_transactions",
      tenant_id: nil,
      error: result[:errors].first
    )

    if tenant_id.present?
      XeroSyncStatus.fail_sync!(
        "bank_transactions",
        tenant_id: tenant_id,
        error: result[:errors].first
      )
    end
  end
end
```

### Step 2: Fix XeroAttachmentSyncJob tenant_id (5 min)

Add tenant_id to status updates:

```ruby
# backend/app/jobs/xero_attachment_sync_job.rb

# Change from:
XeroSyncStatus.complete_sync!("attachments", records_synced: attachments_processed)

# To:
XeroSyncStatus.complete_sync!(
  "attachments",
  tenant_id: tenant_id,  # Add per-tenant
  records_synced: attachments_processed,
  next_sync_at: 6.hours.from_now
)
```

### Step 3: Remove Service-Level Status Updates (15 min)

Remove XeroSyncStatus calls from services - let jobs handle it:

**ExternalInvoiceSyncService:**
- Remove `XeroSyncStatus.complete_sync!` from `sync_tenant`
- Remove `XeroSyncStatus.fail_sync!` from exception handlers
- Return result hash with counts for job to use

**XeroContactSyncService:**
- Remove `XeroSyncStatus.complete_sync!` from `sync_tenant`
- Remove `XeroSyncStatus.fail_sync!` from exception handlers
- Return result hash with counts for job to use

### Step 4: Ensure Jobs Update Per-Tenant Status (10 min)

Verify each job updates both global AND per-tenant status after calling its service:

```ruby
# Pattern for all sync jobs
def perform
  XeroCredential.active.each do |credential|
    tenant_id = credential.tenant_id

    XeroSyncStatus.start_sync!("invoices", tenant_id: tenant_id)

    begin
      result = ExternalInvoiceSyncService.new.sync_tenant(tenant_id)

      XeroSyncStatus.complete_sync!(
        "invoices",
        tenant_id: tenant_id,
        records_synced: result[:synced],
        next_sync_at: 30.minutes.from_now
      )
    rescue => e
      XeroSyncStatus.fail_sync!("invoices", tenant_id: tenant_id, error: e.message)
    end
  end

  # Update global status at end
  XeroSyncStatus.complete_sync!("invoices", tenant_id: nil, next_sync_at: 30.minutes.from_now)
end
```

---

## Verification Checklist

After implementation, verify:

- [ ] All 5 sync jobs use `XeroSyncStatus.complete_sync!` (not raw `update!`)
- [ ] All jobs pass `tenant_id` for per-tenant status
- [ ] No services update XeroSyncStatus directly
- [ ] Self-heal in XeroHealthMonitorJob can detect stale syncs for all types
- [ ] Health dashboard shows accurate per-tenant status

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/app/jobs/xero_bank_transaction_sync_job.rb` | Use helper methods instead of raw update! |
| `backend/app/jobs/xero_attachment_sync_job.rb` | Add tenant_id to status updates |
| `backend/app/services/external_invoice_sync_service.rb` | Remove XeroSyncStatus calls |
| `backend/app/services/xero_contact_sync_service.rb` | Remove XeroSyncStatus calls |
| `backend/app/jobs/xero_invoice_sync_job.rb` | Add per-tenant status updates |
| `backend/app/jobs/xero_contact_sync_job.rb` | Ensure per-tenant status updates |

---

## Risk Assessment

**Low Risk Changes:**
- Standardizing method usage (same behavior, cleaner code)
- Adding tenant_id to attachment sync (additive)

**Medium Risk Changes:**
- Removing service-level status updates (requires job-level updates to compensate)

**Mitigation:**
- Make changes incrementally
- Test each job individually after change
- Monitor health dashboard for any regression

---

## Success Criteria

A "masterpiece" Xero sync status system:

1. **Single Ownership:** Jobs own all XeroSyncStatus updates
2. **Consistent Patterns:** All jobs use the same helper methods
3. **Per-Tenant Tracking:** Every sync type tracks status per-tenant
4. **Self-Healing Works:** Health monitor can detect and fix stale syncs
5. **Clean Separation:** Services are pure business logic, no status concerns

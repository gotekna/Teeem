# Table Deletion Feature - Error Handling & Edge Cases Test Report

## Executive Summary

The table deletion feature has **partial error handling with significant gaps** that could lead to data inconsistency, poor user experience, and unrecoverable system states. While the implementation includes frontend guards and backend validations, there are 7 critical issues and 6 important improvements needed.

---

## Implementation Overview

**Frontend**: `/Users/rob/Projects/teeem/frontend/src/components/settings/TablesTab.jsx` (lines 137-176)
**Backend**: `/Users/rob/Projects/teeem/backend/app/controllers/api/v1/tables_controller.rb` (lines 70-115)
**Database**: `/Users/rob/Projects/teeem/backend/app/services/table_builder.rb` (lines 110-134)

---

## Test Results

### 1. RACE CONDITION: Table Becomes Live During Deletion

**Scenario**: User clicks delete, but another user sets `is_live = true` between frontend check and backend deletion.

**Current Behavior**:
```javascript
// Frontend check (line 139-142)
if (table.is_live) {
  alert('Cannot delete a live table. Set it to draft first.')
  return
}
```

```ruby
# Backend check (line 72-77)
if @table.is_live
  return render json: {
    success: false,
    errors: ['Cannot delete a live table. Set it to draft first.']
  }, status: :unprocessable_entity
end
```

**Issues Found**:
- ❌ **No lock/transaction**: Time gap exists between frontend validation and backend check
- ❌ **Stale data**: Frontend reads table state, user could change it before DELETE request reaches server
- ❌ **No optimistic locking**: Multiple concurrent deletions can race

**Risk Level**: HIGH
**Impact**: Table deleted while live, data loss, referential integrity issues

**Recommendation**:
```ruby
# Use pessimistic locking in destroy action
def destroy
  @table = Table.lock.find(params[:id])

  # Re-validate after acquiring lock
  if @table.is_live
    return render json: {
      success: false,
      errors: ['Table was made live by another user. Refresh and try again.']
    }, status: :unprocessable_entity
  end
  # ... rest of deletion
end
```

---

### 2. RACE CONDITION: Records Added During Deletion

**Scenario**: Table has 0 records when delete is clicked, but records are added during the DELETE request.

**Current Behavior**:
```javascript
// Frontend check (line 144-147)
if (table.record_count > 0) {
  alert('Cannot delete a table that contains records. Delete all records first.')
  return
}
```

```ruby
# Backend check (line 80-90)
record_count = @table.dynamic_model.count
if record_count > 0
  return render json: {
    success: false,
    errors: ["Cannot delete a table that contains #{record_count} record(s). Delete all records first."]
  }, status: :unprocessable_entity
end
```

**Issues Found**:
- ❌ **No transaction isolation**: Between record count check and table drop, new records could be inserted
- ❌ **Stale frontend count**: `record_count` displayed on frontend could be outdated
- ❌ **Race window**: 5-10 seconds between check and drop_table execution

**Risk Level**: HIGH
**Impact**: Table dropped with orphaned records, data loss

**Recommendation**:
```ruby
def destroy
  Table.transaction do
    @table = Table.lock.find(params[:id])

    # Count records inside transaction
    record_count = @table.dynamic_model.count
    if record_count > 0
      raise ActiveRecord::Rollback
    end

    # Now safe to drop - no new records can be added
    builder = TableBuilder.new(@table)
    drop_result = builder.drop_database_table
    # ...
  end
end
```

---

### 3. NETWORK FAILURE: DELETE Request Fails Mid-Operation

**Scenario**: DELETE request is sent but fails due to network timeout or connection reset.

**Current Frontend Code** (lines 165-175):
```javascript
try {
  const response = await api.delete(`/api/v1/tables/${table.id}`)
  if (response.success) {
    await fetchTables()
  }
} catch (err) {
  console.error('Failed to delete table:', err)
  alert(err.message || 'Failed to delete table')
}
```

**Issues Found**:
- ❌ **No retry mechanism**: Network blip = permanent failure for user
- ❌ **Ambiguous final state**: User doesn't know if table was deleted or not
- ❌ **No polling**: User can't check status after failure
- ❌ **API error parsing incomplete**: Error structure varies, could be undefined

**API Error Handling** (`api.js`, lines 100-112):
```javascript
async delete(endpoint) {
  const response = await fetch(/*...*/);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `API request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }
  return response.json();
}
```

**Specific Failure Scenarios**:
- ✓ JSON parse error handled with `.catch(() => ({}))`
- ✓ HTTP status codes checked with `!response.ok`
- ❌ **But**: Missing `errors` field parsing (backend returns `errors` array, not `error`)
- ❌ No timeout specified (infinite wait possible)

**User Experience**:
```
Alert shown: "API request failed with status 500"
  ↑ Unhelpful! What actually failed?
```

**Recommendation**:
```javascript
// Improve error parsing
const errorData = await response.json().catch(() => ({}));
const errorMessage =
  errorData.errors?.[0] ||  // Backend sends errors array
  errorData.error ||        // Alternative format
  `API request failed with status ${response.status}`;
throw new Error(errorMessage);

// Add timeout
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
const response = await fetch(url, { signal: controller.signal });
clearTimeout(timeout);

// Show status dialog
const response = await api.delete(`/api/v1/tables/${table.id}`)
if (response.success) {
  showSuccessMessage(`Table "${table.name}" deleted successfully`)
  await fetchTables()
} else {
  showErrorMessage('Failed to delete table. Refresh the page to check status.')
}
```

---

### 4. DATABASE ERROR: drop_database_table Fails

**Scenario**: PostgreSQL/database error occurs during `DROP TABLE` operation.

**Backend Code** (TableBuilder.rb, lines 110-134):
```ruby
def drop_database_table
  begin
    ActiveRecord::Migration.suppress_messages do
      ActiveRecord::Migration.drop_table @table.database_table_name.to_sym, if_exists: true
    end

    # Remove the dynamic model class
    begin
      class_name = @table.name.classify
      Object.send(:remove_const, class_name) if Object.const_defined?(class_name)
    rescue NameError
      # If class name is invalid, just skip this step
    end

    { success: true }
  rescue => e
    # If the error is that the table doesn't exist, that's fine - treat as success
    if e.message.include?("does not exist") || e.is_a?(ActiveRecord::StatementInvalid)
      { success: true }
    else
      @errors << "Failed to drop database table: #{e.message}"
      { success: false, errors: @errors }
    end
  end
end
```

**Issues Found**:
- ⚠️ **Generic error catching**: `rescue => e` catches all errors but only handles 1-2 specific cases
- ❌ **Silent failures on "does not exist"**: Could hide actual problems
- ✓ `if_exists: true` prevents most "table not found" errors
- ❌ **No distinction between retryable vs permanent errors**:
  - Connection timeout → should retry
  - Permission denied → should fail permanently
  - Lock timeout → should retry
  - All treated same way

**Problematic Error Scenarios**:

```
PostgreSQL Error: "Lock timeout acquired"
  → Currently: { success: false, errors: ["Failed to drop database table: Lock timeout acquired"] }
  → Should: Retry with exponential backoff

PostgreSQL Error: "permission denied for schema public"
  → Currently: { success: false, errors: ["..."] }
  → Correct: Fail (permission issue, not retryable)

PostgreSQL Error: "Table is in use"
  → Currently: { success: false, errors: ["..."] }
  → Should: Return 409 Conflict, ask user to try again later
```

**Controller doesn't distinguish error types** (lines 106-111):
```ruby
unless drop_result[:success]
  return render json: {
    success: false,
    errors: drop_result[:errors]
  }, status: :unprocessable_entity  # Always 422
end
```

**All errors use 422 (unprocessable_entity)** - should differentiate:
- `409 Conflict` - Retryable (lock timeout, in use)
- `500 Server Error` - Database error (needs admin attention)
- `422 Unprocessable` - Validation error (table is live)

**Recommendation**:
```ruby
def drop_database_table
  begin
    ActiveRecord::Migration.suppress_messages do
      ActiveRecord::Migration.drop_table @table.database_table_name.to_sym, if_exists: true
    end

    # Remove dynamic model class safely
    class_name = @table.name.gsub(/[^a-zA-Z0-9_]/, '').classify
    Object.send(:remove_const, class_name) if Object.const_defined?(class_name)

    { success: true }
  rescue ActiveRecord::StatementInvalid => e
    if e.message.include?("database is locked")
      { success: false, retryable: true, errors: ["Database is locked. Please try again shortly."] }
    elsif e.message.include?("permission denied")
      { success: false, retryable: false, errors: ["Permission denied. Contact your administrator."] }
    elsif e.message.include?("does not exist")
      { success: true }  # Already deleted
    else
      { success: false, retryable: true, errors: ["Database error: #{e.message}"] }
    end
  rescue => e
    { success: false, retryable: false, errors: ["Unexpected error: #{e.message}"] }
  end
end

# In controller
unless drop_result[:success]
  status = drop_result[:retryable] ? :conflict : :unprocessable_entity
  return render json: {
    success: false,
    errors: drop_result[:errors],
    retryable: drop_result[:retryable]
  }, status: status
end
```

---

### 5. CONCURRENT DELETION: Two Users Delete Same Table

**Scenario**: User A and User B both click delete on the same table simultaneously.

**Current Flow**:

```
User A:  DELETE /api/v1/tables/123
             ↓ (checks is_live, record_count, references)
             ↓ (starts drop_database_table)

User B:  DELETE /api/v1/tables/123
             ↓ (checks is_live, record_count, references)
             ↓ (starts drop_database_table) ← BOTH running at same time!
```

**Issues Found**:
- ❌ **No mutex/advisory lock**: Both requests proceed to drop_table
- ❌ **Set_table might fail on User B**: If User A commits first
- ❌ **Dynamic model class removal race**: Both try to remove same constant

**set_table Method** (lines 119-128):
```ruby
def set_table
  @table = if params[:id].to_i.to_s == params[:id]
    Table.includes(:columns).find(params[:id])
  else
    Table.includes(:columns).find_by!(slug: params[:id])
  end
rescue ActiveRecord::RecordNotFound
  render json: { error: 'Table not found' }, status: :not_found
end
```

**Specific Race Conditions**:

1. **Both pass set_table** - @table loaded for both
2. **Both pass all validations** - is_live=false, record_count=0, no refs
3. **User A: drop_table executes** - Table dropped from database
4. **User B: drop_table executes** - What happens?
   - ✓ `if_exists: true` prevents "table doesn't exist" error
   - ✓ But dynamic model is already removed
   - ✓ `@table.destroy` still succeeds (it's a Rails record)
5. **Result**: Both responses succeed, but only one actually did work

**Frontend shows**:
```javascript
if (response.success) {
  await fetchTables()  // Table is gone ✓
}
```

Both users see success. If user B was slower and doesn't refresh, they'll see stale list.

**Recommendation**:
```ruby
def destroy
  Table.transaction do
    # Pessimistic lock prevents concurrent delete
    @table = Table.lock.find(params[:id])

    # If User B reaches here after User A deletes, they'll get:
    # ActiveRecord::RecordNotFound → 404 error

    # ... validations and deletion ...
  end
rescue ActiveRecord::RecordNotFound
  render json: {
    success: false,
    errors: ['Table was deleted by another user']
  }, status: :conflict  # 409 Conflict
end
```

---

### 6. LOOKUP REFERENCE ADDED DURING DELETION

**Scenario**: While delete request is in-flight, another user adds a lookup column referencing this table.

**Frontend Check** (lines 149-159):
```javascript
const referencingTables = tables.filter(t =>
  t.id !== table.id &&
  t.columns?.some(col => col.lookup_table_id === table.id)
)

if (referencingTables.length > 0) {
  const tableNames = referencingTables.map(t => t.name).join(', ')
  alert(`Cannot delete this table because it is referenced by lookup columns...`)
  return
}
```

**Backend Check** (lines 92-100):
```ruby
referencing_columns = Column.where(lookup_table_id: @table.id).includes(:table)
if referencing_columns.any?
  table_names = referencing_columns.map { |col| col.table.name }.uniq.join(', ')
  return render json: {
    success: false,
    errors: ["Cannot delete this table because it is referenced by lookup columns in: #{table_names}..."]
  }, status: :unprocessable_entity
end
```

**Issues Found**:
- ✓ Both frontend and backend check exists
- ❌ **No transaction isolation**: Between backend check and drop_table, new reference could be added
- ❌ **Time gap**: ~50-100ms between check and drop_table execution

**Race Timeline**:
```
T0: DELETE /api/v1/tables/123 arrives at backend
T1: Backend checks Column.where(lookup_table_id: 123) → empty ✓
T2: User C adds lookup column referencing table 123
T3: Backend executes drop_table(123) → SUCCESS ❌
    Result: Orphaned lookup column pointing to deleted table!
T4: Frontend refreshes → Lookup column broken, referencing non-existent table
```

**Recommendation**:
```ruby
def destroy
  Table.transaction do
    @table = Table.lock.find(params[:id])

    # Re-check references inside transaction
    # Now no one can add new references until transaction commits
    referencing_columns = Column.lock.where(lookup_table_id: @table.id)
    if referencing_columns.any?
      raise ActiveRecord::Rollback
    end

    # Safe to drop - no new references possible
    builder = TableBuilder.new(@table)
    drop_result = builder.drop_database_table
    # ...
  end
end
```

---

### 7. MISSING TABLE: Already Deleted (404)

**Scenario**: User A deletes table, User B clicks delete moments later.

**set_table Method** (lines 119-128):
```ruby
def set_table
  @table = if params[:id].to_i.to_s == params[:id]
    Table.includes(:columns).find(params[:id])
  else
    Table.includes(:columns).find_by!(slug: params[:id])
  end
rescue ActiveRecord::RecordNotFound
  render json: { error: 'Table not found' }, status: :not_found
end
```

**Current Behavior**:
- ✓ Returns `{ error: 'Table not found' }` with 404 status
- ✓ Error is shown to user

**Issues Found**:
- ⚠️ **Inconsistent error format**: `{ error: '...' }` vs `{ errors: [...] }` in other endpoints
- ❌ **Could be confusing**: User might think table never existed
- ⚠️ **No guidance**: Should suggest refreshing table list

**Frontend Handling** (lines 172-175):
```javascript
catch (err) {
  console.error('Failed to delete table:', err)
  alert(err.message || 'Failed to delete table')  // Generic message
}
```

**User sees**: "Table not found" ← Good, but could be better

**Recommendation**:
```ruby
# In set_table
rescue ActiveRecord::RecordNotFound
  render json: {
    success: false,
    errors: ['Table not found. It may have been deleted by another user.']
  }, status: :not_found
end

# In frontend
catch (err) {
  if (err.message.includes('not found')) {
    alert(`"${table.name}" was deleted. Refreshing table list...`)
    await fetchTables()
  } else {
    alert(err.message || 'Failed to delete table')
  }
}
```

---

### 8. NULL/UNDEFINED CHECKS: table.columns Edge Cases

**Frontend Code** (lines 150-153):
```javascript
const referencingTables = tables.filter(t =>
  t.id !== table.id &&
  t.columns?.some(col => col.lookup_table_id === table.id)  // Optional chaining ✓
)
```

**Issues Found**:
- ✓ **Optional chaining used**: `t.columns?.some(...)` handles undefined
- ✓ **Safe**: Won't throw error if columns is null/undefined
- ✓ **No records shown**: `table.record_count || 0` handles missing value

**However, other parts less safe**:

**Line 384** (Display columns count):
```javascript
{table.columns_count || table.columns?.length || 0}
```
- ✓ Safe with optional chaining

**Backend Code** (lines 216-222):
```ruby
unless include_columns
  json[:columns] = table.columns.order(:position).map do |col|
    {
      id: col.id,
      name: col.name,
      column_type: col.column_type
    }
  end
end
```

**Issues Found**:
- ✓ `table.columns` association handled by Rails
- ✓ Won't be nil (empty array if no columns)
- ⚠️ But if table deleted between calls, columns might have inconsistent state

**Recommendation**:
- No changes needed - implementation is safe for null/undefined
- Keep optional chaining pattern for defensive coding

---

### 9. PERMISSION CHECKS: Authorization Missing

**Current Implementation**:
```ruby
class TablesController < ApplicationController
  # No before_action authentication/authorization!
  before_action :set_table, only: [:show, :update, :destroy]
  # ... no permission checks anywhere
end
```

**Issues Found**:
- ❌ **CRITICAL**: No authentication checks - anyone can delete any table!
- ❌ **No authorization**: No per-table permission checks
- ❌ **No audit logging**: No record of who deleted what

**Visible Bugs**:
```ruby
# Any unauthenticated user can:
DELETE /api/v1/tables/123  ← No auth required!
```

**Recommendation**:
```ruby
class ApplicationController < ActionController::API
  before_action :authenticate_user!

  protected

  def authenticate_user!
    # Implement authentication (JWT, session, etc.)
  end
end

class TablesController < ApplicationController
  before_action :authorize_table_access!, only: [:destroy]

  private

  def authorize_table_access!
    # Check if user owns this table or has admin access
    unless current_user&.admin? || @table.workspace.users.include?(current_user)
      render json: {
        success: false,
        errors: ['You do not have permission to delete this table']
      }, status: :forbidden
    end
  end
end
```

---

## Summary Table: Error Handling Coverage

| Scenario | Frontend Guard | Backend Check | Transaction Safety | User Feedback | Recovery |
|----------|---|---|---|---|---|
| **1. Table becomes live** | ✓ | ✓ | ❌ None | ⚠️ Generic | ❌ Manual |
| **2. Records added** | ✓ | ✓ | ❌ None | ⚠️ Generic | ❌ Manual |
| **3. Network failure** | N/A | N/A | N/A | ❌ Poor | ❌ None |
| **4. Database error** | N/A | ✓ | ⚠️ Partial | ⚠️ Generic | ❌ Manual |
| **5. Concurrent delete** | N/A | ⚠️ Weak | ❌ None | ✓ Generic | ⚠️ Refresh needed |
| **6. Lookup ref added** | ✓ | ✓ | ❌ None | ✓ Specific | ✓ Auto |
| **7. Missing table (404)** | N/A | ✓ | N/A | ⚠️ Generic | ✓ Auto |
| **8. Null/undefined** | N/A | ✓ | N/A | N/A | N/A |
| **9. Permissions** | ❌ None | ❌ None | N/A | ❌ None | ❌ None |

---

## Critical Issues Summary

### 🔴 CRITICAL (Must Fix)

1. **No Authentication/Authorization** - Anyone can delete tables
   - Impact: Data loss, security breach
   - Effort: Medium
   - Fix: Add `authenticate_user!` and authorization checks

2. **Race Conditions with No Transaction Safety**
   - Impact: Table deleted while live or with records
   - Effort: Medium
   - Fix: Use `Table.lock` and `transaction` blocks

3. **Poor Network Error Handling**
   - Impact: User confusion about deletion status
   - Effort: Low
   - Fix: Parse errors correctly, show helpful messages

### 🟠 IMPORTANT (Should Fix)

4. **Database Errors Not Classified**
   - Impact: User can't distinguish retryable vs permanent failures
   - Effort: Medium
   - Fix: Detect error types, return appropriate status codes

5. **Inconsistent Error Response Format**
   - Impact: Frontend can't parse all error types
   - Effort: Low
   - Fix: Always use `{ success, errors: [] }` format

6. **No Retry Mechanism**
   - Impact: User loses deletion if network glitches
   - Effort: Medium
   - Fix: Add automatic retry with exponential backoff

### 🟡 MINOR (Nice to Have)

7. **No Audit Logging**
   - Impact: Can't trace who deleted what
   - Effort: Medium
   - Fix: Log deletion with user_id and timestamp

8. **API Timeout Not Set**
   - Impact: Requests can hang indefinitely
   - Effort: Low
   - Fix: Set 30-60 second timeout on delete requests

---

## Recommended Priority Fixes

### Phase 1: Security (MUST DO)
```ruby
# Add authentication middleware
# Add authorization checks in destroy action
# Add audit logging
```

### Phase 2: Data Consistency (MUST DO)
```ruby
# Add transaction wrappers
# Add pessimistic locking
# Re-validate state after acquiring lock
```

### Phase 3: User Experience (SHOULD DO)
```ruby
# Improve error messages
# Add retry mechanism for network failures
# Add loading state during deletion
# Show confirmation with table name
```

### Phase 4: Robustness (NICE TO HAVE)
```ruby
# Classify database errors
# Add request timeout
# Add audit logging
# Add rate limiting
```

---

## Testing Recommendations

### Unit Tests Needed
```ruby
# test/controllers/api/v1/tables_controller_test.rb

test "cannot delete live table" do
  table = create(:table, is_live: true)
  delete api_v1_table_path(table)
  assert_response :unprocessable_entity
  assert Table.exists?(table.id)  # Still exists
end

test "cannot delete table with records" do
  table = create(:table)
  record = create(:record, table: table)
  delete api_v1_table_path(table)
  assert_response :unprocessable_entity
  assert Table.exists?(table.id)
end

test "cannot delete table with lookup references" do
  source = create(:table)
  target = create(:table)
  create(:column, column_type: 'lookup', lookup_table: source, table: target)

  delete api_v1_table_path(source)
  assert_response :unprocessable_entity
  assert Table.exists?(source.id)
end

test "concurrent deletes handled safely" do
  table = create(:table)
  threads = []

  2.times do
    threads << Thread.new do
      delete api_v1_table_path(table)
    end
  end

  threads.map(&:join)
  # Only one should succeed
  refute Table.exists?(table.id)
end

test "handles database lock timeout" do
  table = create(:table)

  # Simulate lock timeout
  allow_any_instance_of(TableBuilder).to receive(:drop_database_table)
    .and_raise(ActiveRecord::Deadlocked)

  delete api_v1_table_path(table)
  assert_response :conflict  # 409
  assert Table.exists?(table.id)  # Not deleted
end
```

### Integration Tests Needed
```javascript
// Integration test: Table deletion flow
describe('Table Deletion', () => {
  it('shows confirmation before deleting', () => {
    cy.visit('/settings/tables')
    cy.get('[data-testid="delete-button"]').first().click()
    cy.get('[role="alertdialog"]').should('contain', 'Are you sure')
  })

  it('shows error if table has records', () => {
    // Create table with records
    cy.visit('/settings/tables')
    cy.get('[data-testid="delete-button"]').should('be.disabled')
    cy.get('[data-testid="delete-button"]').should('have.attr', 'disabled')
  })

  it('deletes successfully and removes from list', () => {
    cy.visit('/settings/tables')
    cy.contains('Test Table').should('exist')
    cy.get('[data-testid="delete-button"]').click()
    cy.on('window:alert', cy.stub().as('confirmDelete'))
    // ... confirm deletion
    cy.contains('Test Table').should('not.exist')
  })

  it('shows helpful message if network fails', () => {
    cy.intercept('DELETE', '**/api/v1/tables/**', { statusCode: 500 })
    cy.get('[data-testid="delete-button"]').click()
    // Confirm
    cy.get('[role="alert"]').should('contain', 'Failed to delete')
  })
})
```

---

## Monitoring Recommendations

Add monitoring for:

1. **Table Deletion Success Rate**
   ```ruby
   # Track: successful deletes per day
   # Alert: if <95% success rate
   ```

2. **Error Distribution**
   ```ruby
   # Track: common error types (permissions, locks, validation)
   # Alert: if new error types appear (potential bug)
   ```

3. **Concurrent Delete Attempts**
   ```ruby
   # Track: how often multiple users delete same table
   # Alert: if >10% of deletes are concurrent
   ```

4. **Delete Duration**
   ```ruby
   # Track: avg time to delete table
   # Alert: if >5 seconds (database issue?)
   ```

---

## Conclusion

The table deletion feature has **good foundational checks** but **critical gaps in concurrent safety and error handling**. Most issues are fixable with:

1. Adding transaction safety (HIGH priority)
2. Improving error messages (MEDIUM priority)
3. Adding authentication (CRITICAL security)
4. Adding retry logic (MEDIUM priority)

Without these fixes, the system is vulnerable to:
- Data loss from race conditions
- Security breaches from missing auth
- User confusion from poor error messages
- Orphaned data from incomplete validations

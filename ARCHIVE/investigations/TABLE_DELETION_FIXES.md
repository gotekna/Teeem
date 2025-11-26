# Table Deletion Feature - Quick Fix Guide

## Priority 1: Security (CRITICAL)

### Issue: No Authentication/Authorization

**File**: `/Users/rob/Projects/teeem/backend/app/controllers/api/v1/tables_controller.rb`

**Current Code**:
```ruby
class TablesController < ApplicationController
  # No authentication!
  before_action :set_table, only: [:show, :update, :destroy]
end
```

**Fix**:
```ruby
class ApplicationController < ActionController::API
  before_action :authenticate_user!

  protected

  def authenticate_user!
    # Implement your auth logic here
    # (JWT, session, etc.)
  end

  def current_user
    @current_user ||= User.from_token(request.headers['Authorization']&.split(' ')&.last)
  end
end

class TablesController < ApplicationController
  before_action :set_table, only: [:show, :update, :destroy]
  before_action :authorize_table_access!, only: [:destroy]

  private

  def authorize_table_access!
    unless current_user&.can_delete_table?(@table)
      render json: {
        success: false,
        errors: ['You do not have permission to delete this table']
      }, status: :forbidden
    end
  end
end
```

---

## Priority 2: Race Conditions (CRITICAL)

### Issue: Table can be deleted while live or with records

**File**: `/Users/rob/Projects/teeem/backend/app/controllers/api/v1/tables_controller.rb`

**Current Code**:
```ruby
def destroy
  if @table.is_live
    return render json: {
      success: false,
      errors: ['Cannot delete a live table. Set it to draft first.']
    }, status: :unprocessable_entity
  end

  record_count = @table.dynamic_model.count
  if record_count > 0
    return render json: {
      success: false,
      errors: ["Cannot delete a table that contains #{record_count} record(s)..."]
    }, status: :unprocessable_entity
  end

  # ... delete logic (no transaction!)
end
```

**Fix**:
```ruby
def destroy
  begin
    Table.transaction do
      # Pessimistic lock prevents concurrent modifications
      @table = Table.lock.find(params[:id])

      # Re-validate inside transaction
      if @table.is_live
        raise DeleteError.new('Cannot delete a live table. Set it to draft first.')
      end

      # Check record count inside transaction
      record_count = @table.dynamic_model.count
      if record_count > 0
        raise DeleteError.new("Cannot delete table with #{record_count} record(s).")
      end

      # Check references inside transaction
      referencing = Column.lock.where(lookup_table_id: @table.id)
      if referencing.any?
        table_names = referencing.map { |c| c.table.name }.uniq.join(', ')
        raise DeleteError.new("Referenced by lookup columns in: #{table_names}")
      end

      # Now safe to drop - no concurrent changes possible
      builder = TableBuilder.new(@table)
      drop_result = builder.drop_database_table

      unless drop_result[:success]
        raise DeleteError.new(drop_result[:errors]&.first || 'Database error')
      end

      # Confirm deletion
      @table.destroy!
      { success: true }
    end
  rescue DeleteError => e
    render json: {
      success: false,
      errors: [e.message]
    }, status: :unprocessable_entity
  rescue ActiveRecord::Deadlocked => e
    # Database is locked - ask user to retry
    render json: {
      success: false,
      errors: ['Database is busy. Please try again.'],
      retryable: true
    }, status: :conflict
  rescue ActiveRecord::RecordNotFound
    # Another user deleted it first
    render json: {
      success: false,
      errors: ['Table was already deleted by another user.']
    }, status: :conflict
  rescue => e
    Rails.logger.error "Table deletion error: #{e.class} - #{e.message}"
    render json: {
      success: false,
      errors: ['An unexpected error occurred. Please try again.']
    }, status: :internal_server_error
  end

  private

  class DeleteError < StandardError; end
end
```

**Add to `config/initializers/errors.rb`**:
```ruby
class DeleteError < StandardError
end
```

---

## Priority 3: Database Error Classification

### Issue: Can't distinguish retryable from permanent errors

**File**: `/Users/rob/Projects/teeem/backend/app/services/table_builder.rb`

**Current Code**:
```ruby
def drop_database_table
  begin
    ActiveRecord::Migration.suppress_messages do
      ActiveRecord::Migration.drop_table @table.database_table_name.to_sym, if_exists: true
    end

    begin
      class_name = @table.name.classify
      Object.send(:remove_const, class_name) if Object.const_defined?(class_name)
    rescue NameError
      # ignore
    end

    { success: true }
  rescue => e
    if e.message.include?("does not exist")
      { success: true }
    else
      @errors << "Failed to drop database table: #{e.message}"
      { success: false, errors: @errors }
    end
  end
end
```

**Fix**:
```ruby
def drop_database_table
  begin
    ActiveRecord::Migration.suppress_messages do
      ActiveRecord::Migration.drop_table @table.database_table_name.to_sym, if_exists: true
    end

    # Safely remove dynamic model class
    class_name = @table.name.gsub(/[^a-zA-Z0-9_]/, '').classify
    Object.send(:remove_const, class_name) if Object.const_defined?(class_name)

    { success: true }
  rescue ActiveRecord::StatementInvalid => e
    # Database errors - determine if retryable
    if e.message.match?(/lock|timeout|deadlock|in use/i)
      {
        success: false,
        retryable: true,
        errors: ['Database is busy. Please try again shortly.'],
        error_type: :database_busy
      }
    elsif e.message.match?(/permission|access denied/i)
      {
        success: false,
        retryable: false,
        errors: ['Permission denied. Contact your administrator.'],
        error_type: :permission_denied
      }
    elsif e.message.match?(/does not exist|unknown table/i)
      # Table already deleted - treat as success
      { success: true, already_deleted: true }
    else
      {
        success: false,
        retryable: false,
        errors: ["Database error: #{e.message}"],
        error_type: :database_error
      }
    end
  rescue NameError => e
    # Class removal failed - not critical
    Rails.logger.warn "Failed to remove dynamic class: #{e.message}"
    { success: true }
  rescue => e
    Rails.logger.error "Unexpected error dropping table: #{e.class} - #{e.message}"
    {
      success: false,
      retryable: false,
      errors: ['Unexpected error occurred'],
      error_type: :unexpected_error
    }
  end
end
```

---

## Priority 4: API Error Consistency

### Issue: Inconsistent error response formats

**File**: `/Users/rob/Projects/teeem/backend/app/controllers/api/v1/tables_controller.rb`

**Current Code**:
```ruby
# Different formats in different places
rescue ActiveRecord::RecordNotFound
  render json: { error: 'Table not found' }, status: :not_found
end

# vs.

render json: {
  success: false,
  errors: drop_result[:errors]
}, status: :unprocessable_entity
```

**Fix**:
```ruby
private

def render_error(message, status = :unprocessable_entity)
  render json: {
    success: false,
    errors: [message]
  }, status: status
end

def render_errors(messages, status = :unprocessable_entity)
  render json: {
    success: false,
    errors: Array(messages)
  }, status: status
end

# Usage in destroy:
rescue ActiveRecord::RecordNotFound
  render_error('Table not found', :not_found)
end

# In set_table:
rescue ActiveRecord::RecordNotFound
  render_error('Table not found', :not_found)
end
```

---

## Priority 5: Frontend Error Handling

### Issue: Poor network error messages and no retry

**File**: `/Users/rob/Projects/teeem/frontend/src/api.js`

**Current Code**:
```javascript
async delete(endpoint) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `API request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }
  return response.json();
}
```

**Fix**:
```javascript
async delete(endpoint, { timeout = 30000, maxRetries = 0 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.errors?.[0] ||
          errorData.error ||
          `API request failed with status ${response.status}`;

        lastError = new Error(errorMessage);
        lastError.status = response.status;

        // Retry on conflict (409) or server error (5xx)
        if (response.status === 409 || (response.status >= 500 && attempt < maxRetries)) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }

      return response.json();
    } catch (err) {
      lastError = err;

      if (err.name === 'AbortError') {
        lastError = new Error('Request timeout. Please check your connection.');
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError;
}
```

---

## Priority 6: Frontend UI Improvements

### Issue: No loading state, generic alerts

**File**: `/Users/rob/Projects/teeem/frontend/src/components/settings/TablesTab.jsx`

**Current Code**:
```javascript
const handleDeleteTable = async (table) => {
  // ... checks ...
  if (!confirm(`Are you sure...`)) {
    return
  }

  try {
    const response = await api.delete(`/api/v1/tables/${table.id}`)
    if (response.success) {
      await fetchTables()
    }
  } catch (err) {
    console.error('Failed to delete table:', err)
    alert(err.message || 'Failed to delete table')
  }
}
```

**Fix**:
```javascript
const [deleting, setDeleting] = useState(null) // Track which table is deleting
const [deleteError, setDeleteError] = useState(null)

const handleDeleteTable = async (table) => {
  // Validation checks
  if (table.is_live) {
    setDeleteError('Cannot delete a live table. Set it to draft first.')
    return
  }

  if (table.record_count > 0) {
    setDeleteError('Cannot delete a table that contains records.')
    return
  }

  const referencingTables = tables.filter(t =>
    t.id !== table.id &&
    t.columns?.some(col => col.lookup_table_id === table.id)
  )

  if (referencingTables.length > 0) {
    const tableNames = referencingTables.map(t => t.name).join(', ')
    setDeleteError(`Referenced by lookup columns in: ${tableNames}`)
    return
  }

  // Confirmation with helpful message
  const confirmed = window.confirm(
    `Delete table "${table.name}"?\n\n` +
    `This table has ${table.columns_count || 0} columns and ` +
    `${table.record_count || 0} records.\n\n` +
    `This action cannot be undone.`
  )

  if (!confirmed) {
    return
  }

  try {
    setDeleting(table.id)
    setDeleteError(null)

    const response = await api.delete(`/api/v1/tables/${table.id}`, {
      maxRetries: 2, // Retry up to 2 times
      timeout: 30000
    })

    if (response.success) {
      // Success feedback
      console.log(`Table "${table.name}" deleted successfully`)
      await fetchTables()
      // Optional: Show success toast
    } else {
      const message = response.errors?.[0] || 'Failed to delete table'
      setDeleteError(message)
    }
  } catch (err) {
    console.error('Failed to delete table:', err)

    if (err.name === 'AbortError') {
      setDeleteError('Request timeout. Please try again.')
    } else if (err.message.includes('deleted by another user')) {
      setDeleteError('Table was already deleted by another user.')
      setTimeout(() => fetchTables(), 1000)
    } else if (err.message.includes('busy')) {
      setDeleteError('Database is busy. Please try again shortly.')
    } else {
      setDeleteError(err.message || 'Failed to delete table. Please try again.')
    }
  } finally {
    setDeleting(null)
  }
}

// In JSX - Update delete button
{!table.is_live && (table.record_count === 0 || !table.record_count) && (
  <button
    onClick={(e) => {
      e.stopPropagation()
      handleDeleteTable(table)
    }}
    disabled={deleting === table.id}
    className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
    title={deleting === table.id ? 'Deleting...' : 'Delete table'}
  >
    {deleting === table.id ? (
      <div className="animate-spin">⌛</div>
    ) : (
      <TrashIcon className="h-5 w-5" />
    )}
  </button>
)}

// Add error display
{deleteError && (
  <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/10 p-4">
    <p className="text-sm text-red-800 dark:text-red-400">{deleteError}</p>
    <button
      onClick={() => setDeleteError(null)}
      className="mt-2 text-sm text-red-600 hover:text-red-900 underline"
    >
      Dismiss
    </button>
  </div>
)}
```

---

## Priority 7: Add Audit Logging

### New File: Add Audit Logging

**File**: `/Users/rob/Projects/teeem/backend/app/models/audit_log.rb`

```ruby
class AuditLog < ApplicationRecord
  belongs_to :user
  belongs_to :table, optional: true

  ACTIONS = {
    table_deleted: 'table_deleted',
    table_created: 'table_created',
    column_added: 'column_added',
    column_removed: 'column_removed'
  }.freeze

  validates :action, inclusion: { in: ACTIONS.values }

  scope :recent, -> { order(created_at: :desc) }
  scope :by_action, ->(action) { where(action: action) }
  scope :by_user, ->(user) { where(user_id: user.id) }
end
```

**File**: `/Users/rob/Projects/teeem/backend/app/controllers/api/v1/tables_controller.rb`

```ruby
def destroy
  begin
    Table.transaction do
      @table = Table.lock.find(params[:id])

      # ... validation ...

      # Log deletion
      AuditLog.create!(
        user_id: current_user.id,
        table_id: @table.id,
        action: 'table_deleted',
        details: {
          table_name: @table.name,
          database_table_name: @table.database_table_name,
          columns_count: @table.columns.count,
          was_live: @table.is_live
        }
      )

      # ... deletion logic ...
    end
  rescue => e
    # Log failed attempt
    AuditLog.create!(
      user_id: current_user.id,
      table_id: params[:id],
      action: 'table_delete_failed',
      details: { error: e.message }
    )
    # ... error handling ...
  end
end
```

---

## Testing Guide

### Add Tests

**File**: `/Users/rob/Projects/teeem/backend/test/controllers/api/v1/tables_controller_test.rb`

```ruby
require 'test_helper'

class Api::V1::TablesControllerTest < ActionDispatch::IntegrationTest
  def setup
    @user = create(:user)
    @table = create(:table, user: @user)
    sign_in @user
  end

  test 'cannot delete live table' do
    @table.update(is_live: true)
    delete api_v1_table_path(@table)
    assert_response :unprocessable_entity
    assert Table.exists?(@table.id)
  end

  test 'cannot delete table with records' do
    create(:record, table: @table)
    delete api_v1_table_path(@table)
    assert_response :unprocessable_entity
    assert Table.exists?(@table.id)
  end

  test 'cannot delete table with lookup references' do
    other_table = create(:table)
    create(:column, column_type: 'lookup', lookup_table: @table, table: other_table)

    delete api_v1_table_path(@table)
    assert_response :unprocessable_entity
    assert Table.exists?(@table.id)
  end

  test 'deletes table successfully' do
    delete api_v1_table_path(@table)
    assert_response :ok
    assert_not Table.exists?(@table.id)
  end

  test 'returns 404 if table not found' do
    delete api_v1_table_path(0)
    assert_response :not_found
  end

  test 'returns 409 if deleted by another user' do
    # Simulate concurrent deletion
    thread = Thread.new do
      other_user = create(:user)
      # First request deletes the table
      ActAs.current_user = other_user
      delete api_v1_table_path(@table)
    end

    thread.join

    # Second request tries to delete same table
    delete api_v1_table_path(@table)
    assert_response :conflict
  end
end
```

---

## Implementation Roadmap

```
Phase 1: SECURITY (Week 1)
  [ ] Add authentication middleware
  [ ] Add authorization checks
  [ ] Add audit logging
  Priority: CRITICAL

Phase 2: RACE CONDITIONS (Week 2)
  [ ] Add transaction wrappers
  [ ] Add pessimistic locking
  [ ] Re-validate state after lock
  [ ] Add FK constraint for references
  Priority: CRITICAL

Phase 3: ERROR HANDLING (Week 2)
  [ ] Classify database errors
  [ ] Fix API error format consistency
  [ ] Improve frontend error messages
  [ ] Add retry logic
  Priority: HIGH

Phase 4: UX IMPROVEMENTS (Week 3)
  [ ] Add loading state on delete button
  [ ] Improve confirmation dialog
  [ ] Show success message
  [ ] Add request timeout
  Priority: MEDIUM

Phase 5: MONITORING (Week 3)
  [ ] Add delete success metrics
  [ ] Add error distribution tracking
  [ ] Add delete duration tracking
  [ ] Add alerts for high error rates
  Priority: MEDIUM
```

---

## Verification Checklist

After implementing fixes:

- [ ] All tests pass
- [ ] No unhandled promise rejections
- [ ] No console errors during normal deletion
- [ ] Auth prevents unauthorized deletion
- [ ] Error messages are helpful and specific
- [ ] Loading state shows during deletion
- [ ] Concurrent deletes handled safely
- [ ] Network retry works
- [ ] Lookup references prevent deletion
- [ ] Audit log records all deletions
- [ ] 404 when table doesn't exist
- [ ] 409 when deleted by another user
- [ ] Performance: Delete <1 second for small table
- [ ] Dark mode styles applied to error messages
- [ ] Mobile responsive confirmation dialog

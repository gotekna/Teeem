# TEEEM Gold Standard Search Infrastructure

## Vision
A unified, lightning-fast search system across all TEEEM data:
- **Global search bar** - Search everything from one place
- **Type filtering** - Emails, Documents, Jobs, Contacts, Tasks
- **Millisecond results** - PostgreSQL GIN indexes
- **100% accurate** - Exact keyword matching with stemming

---

## Audit: Current State

| Table | tsvector Column | GIN Index | Status |
|-------|-----------------|-----------|--------|
| `email_warehouse` | ✅ `searchable` | ❌ MISSING | Slow! |
| `pricebook` | ✅ `searchable_text` | ✅ `idx_pricebook_search` | ✅ Done |
| `corporate_company_documents` | ❌ None | ❌ None | Broken |
| `jobs` | ❌ None | ❌ None | Not searchable |
| `contacts` | ❌ None | ❌ None | Not searchable (includes suppliers!) |
| `sm_tasks` | ❌ None | ❌ None | Not searchable |
| `purchase_orders` | ❌ None | ❌ None | Not searchable |

**Note:** Suppliers are stored as contacts (no separate table).

---

## Architecture

### 1. Searchable Concern (SSoT)
```ruby
# app/models/concerns/searchable.rb
module Searchable
  extend ActiveSupport::Concern

  included do
    scope :search_text, ->(query) {
      where("searchable @@ plainto_tsquery('english', ?)", query)
    }
  end

  class_methods do
    # Define which columns to include in search
    def searchable_columns(*columns)
      @searchable_columns = columns
    end

    def get_searchable_columns
      @searchable_columns || [:name]
    end
  end
end
```

### 2. Model Integration Pattern
```ruby
# Example: Job model
class Job < ApplicationRecord
  include Searchable
  searchable_columns :name, :address, :client_name, :description
end
```

### 3. Global Search Service
```ruby
# app/services/global_search_service.rb
class GlobalSearchService
  SEARCHABLE_TYPES = {
    'emails' => EmailWarehouse,
    'documents' => CorporateCompanyDocument,
    'jobs' => Job,
    'contacts' => Contact,
    'tasks' => SmTask
  }.freeze

  def search(query, types: nil, limit: 20)
    types ||= SEARCHABLE_TYPES.keys
    results = {}

    types.each do |type|
      model = SEARCHABLE_TYPES[type]
      results[type] = model.search_text(query).limit(limit) if model
    end

    results
  end
end
```

### 4. Global Search Endpoint
```ruby
# GET /api/v1/search?q=invoice&types=emails,documents
class Api::V1::SearchController < ApplicationController
  def index
    service = GlobalSearchService.new
    results = service.search(
      params[:q],
      types: params[:types]&.split(','),
      limit: params[:limit] || 20
    )

    render json: { success: true, results: results }
  end
end
```

---

## Migration Plan

### Migration 1: Add tsvector columns + indexes
```ruby
# db/migrate/xxx_add_search_infrastructure.rb
class AddSearchInfrastructure < ActiveRecord::Migration[7.0]
  def up
    # 1. Email warehouse - add missing GIN index
    add_index :email_warehouse, :searchable, using: :gin,
      name: 'idx_email_warehouse_searchable_gin'

    # 2. Documents
    add_column :corporate_company_documents, :searchable, :tsvector
    add_index :corporate_company_documents, :searchable, using: :gin,
      name: 'idx_documents_searchable_gin'

    # 3. Jobs
    add_column :jobs, :searchable, :tsvector
    add_index :jobs, :searchable, using: :gin,
      name: 'idx_jobs_searchable_gin'

    # 4. Contacts
    add_column :contacts, :searchable, :tsvector
    add_index :contacts, :searchable, using: :gin,
      name: 'idx_contacts_searchable_gin'

    # 5. Tasks
    add_column :sm_tasks, :searchable, :tsvector
    add_index :sm_tasks, :searchable, using: :gin,
      name: 'idx_sm_tasks_searchable_gin'

    # 6. Purchase Orders
    add_column :purchase_orders, :searchable, :tsvector
    add_index :purchase_orders, :searchable, using: :gin,
      name: 'idx_purchase_orders_searchable_gin'
  end
end
```

### Migration 2: Add triggers for auto-update
```ruby
# db/migrate/xxx_add_search_triggers.rb
class AddSearchTriggers < ActiveRecord::Migration[7.0]
  def up
    # Generic trigger function
    execute <<-SQL
      CREATE OR REPLACE FUNCTION update_searchable() RETURNS trigger AS $$
      BEGIN
        NEW.searchable := to_tsvector('english',
          regexp_replace(
            array_to_string(ARRAY[
              NEW.name::text,
              NEW.description::text
            ], ' '),
            '[^a-zA-Z0-9\\s]', '', 'g'
          )
        );
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    SQL

    # Per-table triggers with specific columns
    add_search_trigger(:corporate_company_documents,
      ['file_name', 'display_name', 'description', 'folder'])
    add_search_trigger(:jobs,
      ['name', 'address', 'client_name', 'description'])
    add_search_trigger(:contacts,
      ['first_name', 'last_name', 'email', 'company_name', 'phone'])
    add_search_trigger(:sm_tasks,
      ['name', 'description'])
    add_search_trigger(:purchase_orders,
      ['po_number', 'description', 'notes'])
  end

  private

  def add_search_trigger(table, columns)
    cols = columns.map { |c| "coalesce(NEW.#{c}::text, '')" }.join(" || ' ' || ")

    execute <<-SQL
      CREATE OR REPLACE FUNCTION #{table}_searchable_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.searchable := to_tsvector('english', #{cols});
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS #{table}_searchable_update ON #{table};
      CREATE TRIGGER #{table}_searchable_update
      BEFORE INSERT OR UPDATE ON #{table}
      FOR EACH ROW EXECUTE FUNCTION #{table}_searchable_trigger();
    SQL
  end
end
```

### Migration 3: Backfill existing data
```ruby
# db/migrate/xxx_backfill_searchable_data.rb
class BackfillSearchableData < ActiveRecord::Migration[7.0]
  def up
    # Backfill in batches to avoid lock
    backfill_table(:corporate_company_documents)
    backfill_table(:jobs)
    backfill_table(:contacts)
    backfill_table(:sm_tasks)
    backfill_table(:purchase_orders)
  end

  private

  def backfill_table(table)
    execute "UPDATE #{table} SET updated_at = updated_at"  # Triggers will fire
  end
end
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `app/models/concerns/searchable.rb` | CREATE | SSoT concern |
| `app/services/global_search_service.rb` | CREATE | Unified search |
| `app/controllers/api/v1/search_controller.rb` | CREATE | Global endpoint |
| `config/routes.rb` | MODIFY | Add search route |
| `db/migrate/xxx_*.rb` | CREATE | 3 migrations |
| Model files | MODIFY | Include Searchable |
| `documents_controller.rb` | MODIFY | Add search filter |
| `AttachmentPicker.tsx` | MODIFY | Use global search |

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. Create Searchable concern
2. Create migrations
3. Run migrations + backfill
4. Add GlobalSearchService

### Phase 2: API + Integration (Week 2)
1. Create SearchController
2. Update existing controllers to use search
3. Fix AttachmentPicker (emails + documents)

### Phase 3: Global Search UI (Week 3)
1. Add global search bar to header
2. Search results dropdown
3. Type filtering UI

---

## Performance Expectations

| Table | Rows | Search Time (with GIN) |
|-------|------|------------------------|
| email_warehouse | 63k | < 10ms |
| documents | ~5k | < 5ms |
| jobs | ~2k | < 5ms |
| contacts | ~10k | < 5ms |
| tasks | ~5k | < 5ms |

**Total global search:** < 50ms for all types combined

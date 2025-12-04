# Backend Migration Required - NewJobModal Enhancement

## Overview
The frontend NewJobModal has been enhanced to collect additional fields. A database migration is required to persist this new data.

## Migration Code

Create a new migration:

```bash
cd backend
bin/rails generate migration AddEnhancedFieldsToConstructions
```

Edit the migration file:

```ruby
class AddEnhancedFieldsToConstructions < ActiveRecord::Migration[8.0]
  def change
    # Client relationship
    add_column :constructions, :client_id, :integer
    add_column :constructions, :client_name, :string
    add_column :constructions, :client_email, :string
    add_column :constructions, :client_phone, :string

    # Lead tracking
    add_column :constructions, :lead_source, :string

    # Document availability
    add_column :constructions, :has_plans, :boolean, default: false
    add_column :constructions, :has_engineering, :boolean, default: false
    add_column :constructions, :has_soil_report, :boolean, default: false
    add_column :constructions, :has_energy_report, :boolean, default: false

    # Land status
    add_column :constructions, :land_status, :string

    # Add index for foreign key
    add_index :constructions, :client_id

    # Add foreign key constraint
    add_foreign_key :constructions, :contacts, column: :client_id
  end
end
```

Run the migration:

```bash
bin/rails db:migrate
```

## Controller Update

Update `/Users/jakebaird/teeem/backend/app/controllers/api/v1/constructions_controller.rb`:

```ruby
def construction_params
  params.require(:construction).permit(
    # Existing params
    :title,
    :location,
    :contract_value,
    :start_date,
    :end_date,
    :site_supervisor_name,
    :site_supervisor_email,
    :site_supervisor_phone,
    :stage,
    :status,
    :ted_number,
    :certifier_job_no,

    # NEW PARAMS
    :client_id,
    :client_name,
    :client_email,
    :client_phone,
    :lead_source,
    :has_plans,
    :has_engineering,
    :has_soil_report,
    :has_energy_report,
    :land_status
  )
end
```

## Model Update (Optional)

Add validations and associations to `/Users/jakebaird/teeem/backend/app/models/construction.rb`:

```ruby
class Construction < ApplicationRecord
  # Existing code...

  # NEW: Association with contacts
  belongs_to :client, class_name: 'Contact', foreign_key: 'client_id', optional: true

  # NEW: Validations
  validates :lead_source, inclusion: {
    in: ['Referral', 'Website', 'Social Media', 'Email Campaign', 'Walk-in', 'Past Client', 'Other'],
    allow_nil: true
  }

  validates :land_status, inclusion: {
    in: ['Registered', 'Not Yet Registered', 'Unconditional', 'Settled', 'Under Contract'],
    allow_nil: true
  }

  # NEW: Helper method to check if all documents available
  def all_documents_available?
    has_plans && has_engineering && has_soil_report && has_energy_report
  end
end
```

## Data Flow

### Frontend Submission
When creating a new job, the frontend sends:

```json
{
  "construction": {
    "title": "Residential Build - 123 Main Street",
    "location": "123 Main Street, Sydney NSW 2000",
    "client_id": 45,
    "client_name": "John Smith",
    "client_email": "john@example.com",
    "client_phone": "0412345678",
    "lead_source": "Referral",
    "contract_value": "450000.00",
    "start_date": "2025-02-01",
    "end_date": "2025-08-31",
    "site_supervisor_name": "Andrew Clement",
    "stage": "Planning",
    "status": "Active",
    "has_plans": true,
    "has_engineering": false,
    "has_soil_report": true,
    "has_energy_report": false,
    "land_status": "Registered"
  }
}
```

### Current Backend Endpoint
**POST** `/api/v1/constructions`

Currently handles: title, location, contract_value, start_date, site_supervisor_name, stage, status

After migration, it will also handle all the new fields listed above.

## Testing After Migration

1. **Local Testing:**
   ```bash
   bin/rails db:migrate
   bin/rails server
   ```

2. **Test the endpoint with curl:**
   ```bash
   curl -X POST http://localhost:3001/api/v1/constructions \
     -H "Content-Type: application/json" \
     -d '{
       "construction": {
         "title": "Test Job",
         "location": "123 Test St",
         "client_id": 1,
         "lead_source": "Website",
         "has_plans": true,
         "land_status": "Registered"
       }
     }'
   ```

3. **Verify in Rails console:**
   ```ruby
   Construction.last
   # Should show all new fields populated
   ```

## Heroku Deployment

```bash
# Push migration to Heroku
git add .
git commit -m "Add enhanced fields to constructions table"
git push heroku main

# Run migration on Heroku
heroku run rails db:migrate

# Verify
heroku run rails console
> Construction.column_names
```

## Rollback Plan

If issues arise:

```bash
# Local
bin/rails db:rollback

# Heroku
heroku run rails db:rollback
```

## Notes

- The `client_id` foreign key references the `contacts` table
- All new fields are optional (nullable) to maintain backward compatibility
- Boolean fields default to `false`
- Frontend validates required fields before submission (title, location, client_id, site_supervisor_name, status)

## Priority

**HIGH** - The frontend is already collecting this data. Without the migration, new fields will be silently dropped on submission.

## Estimated Time

- Migration creation: 5 minutes
- Testing: 10 minutes
- Deployment: 5 minutes
- **Total: ~20 minutes**

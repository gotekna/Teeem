# Implementation Plan: Job Stages with Cascading Dependencies

## Overview
Add a third-level hierarchy to Jobs with cascading dependencies:
- **Job Type** (e.g., "House", "Kitchen")
- → **Job Status** (e.g., "Active Job", "Drafting Req")
- → **Job Stage** (e.g., "Deposit", "Slab", "Frame")

## Requirements Summary
1. Create new Job Stages entity (similar to Job Types and Job Statuses)
2. Implement cascading dependencies:
   - Job Type determines which Statuses are available
   - Job Type + Status determines which Stages are available
3. Stages are sequential (must progress in order)
4. Display Stages in Jobs list, detail view, and cascade sort order
5. Migrate existing jobs to support Stages
6. UI for configuring dependencies (which Statuses for each Type, which Stages for each Type+Status)

## Current Architecture Analysis

### Existing Tables
- `job_types`: id, name, position, is_active
- `job_statuses`: id, name, position, is_active, color
- `jobs`: includes `job_type_id`, `job_status_id`, and old string fields `status` and `stage`

### Existing Patterns
- Simple CRUD controllers for JobTypes and JobStatuses
- Reorder endpoint for drag-and-drop positioning
- Frontend uses `SortableList` component (reusable)
- Cascade sort configuration stored in `company_settings.job_cascade_sort`
- Many-to-many relationships use `has_many :through` pattern

---

## Phase 1: Database Schema

### 1.1 Create `job_stages` Table
```ruby
# Migration: CreateJobStages
create_table :job_stages do |t|
  t.string :name, null: false
  t.integer :position, default: 0
  t.boolean :is_active, default: true
  t.string :color  # For UI badge color
  t.timestamps
end

add_index :job_stages, :position
add_index :job_stages, :is_active
```

**Pattern:** Follows exact same structure as `job_types` and `job_statuses`

### 1.2 Create `job_type_statuses` Junction Table
Purpose: Define which Statuses are valid for each Type

```ruby
# Migration: CreateJobTypeStatuses
create_table :job_type_statuses do |t|
  t.references :job_type, null: false, foreign_key: true
  t.references :job_status, null: false, foreign_key: true
  t.integer :position, default: 0  # Order within the type
  t.timestamps
end

add_index :job_type_statuses, [:job_type_id, :job_status_id], unique: true
add_index :job_type_statuses, :position
```

### 1.3 Create `job_status_stages` Junction Table
Purpose: Define which Stages are valid for each Type+Status combination

```ruby
# Migration: CreateJobStatusStages
create_table :job_status_stages do |t|
  t.references :job_type, null: false, foreign_key: true      # For context
  t.references :job_status, null: false, foreign_key: true
  t.references :job_stage, null: false, foreign_key: true
  t.integer :position, default: 0  # Sequential order
  t.boolean :is_required, default: false  # Must pass through this stage
  t.timestamps
end

add_index :job_status_stages, [:job_type_id, :job_status_id, :job_stage_id],
  unique: true, name: 'index_job_status_stages_on_type_status_stage'
add_index :job_status_stages, :position
```

**Note:** Including `job_type_id` allows different Types to have different Stages for the same Status

### 1.4 Add `job_stage_id` to Jobs
```ruby
# Migration: AddJobStageToJobs
add_reference :jobs, :job_stage, foreign_key: true, null: true
add_index :jobs, :job_stage_id
```

### 1.5 Model Associations

**JobType:**
```ruby
class JobType < ApplicationRecord
  has_many :jobs
  has_many :job_type_statuses, dependent: :destroy
  has_many :statuses, through: :job_type_statuses, source: :job_status
  has_many :job_status_stages, dependent: :destroy

  validates :name, presence: true, uniqueness: true
  default_scope { order(:position) }
  scope :active, -> { where(is_active: true) }
end
```

**JobStatus:**
```ruby
class JobStatus < ApplicationRecord
  has_many :jobs
  has_many :job_type_statuses, dependent: :destroy
  has_many :job_types, through: :job_type_statuses
  has_many :job_status_stages, dependent: :destroy
  has_many :stages, through: :job_status_stages, source: :job_stage

  validates :name, presence: true, uniqueness: true
  default_scope { order(:position) }
  scope :active, -> { where(is_active: true) }
end
```

**JobStage (NEW):**
```ruby
class JobStage < ApplicationRecord
  has_many :jobs
  has_many :job_status_stages, dependent: :destroy
  has_many :job_statuses, through: :job_status_stages

  validates :name, presence: true, uniqueness: true
  default_scope { order(:position) }
  scope :active, -> { where(is_active: true) }
end
```

**JobTypeStatus (NEW):**
```ruby
class JobTypeStatus < ApplicationRecord
  belongs_to :job_type
  belongs_to :job_status

  validates :job_type_id, uniqueness: { scope: :job_status_id }
  default_scope { order(:position) }
end
```

**JobStatusStage (NEW):**
```ruby
class JobStatusStage < ApplicationRecord
  belongs_to :job_type
  belongs_to :job_status
  belongs_to :job_stage

  validates :job_stage_id, uniqueness: { scope: [:job_type_id, :job_status_id] }
  default_scope { order(:position) }

  # Get next stage in sequence
  def next_stage
    JobStatusStage.where(
      job_type_id: job_type_id,
      job_status_id: job_status_id
    ).where('position > ?', position).first
  end

  # Get previous stage in sequence
  def previous_stage
    JobStatusStage.where(
      job_type_id: job_type_id,
      job_status_id: job_status_id
    ).where('position < ?', position).order(position: :desc).first
  end
end
```

**Job:**
```ruby
class Job < ApplicationRecord
  belongs_to :job_type, optional: true
  belongs_to :job_status, optional: true
  belongs_to :job_stage, optional: true  # NEW

  # Validate stage is valid for current type+status
  validate :stage_must_be_valid_for_type_and_status

  private

  def stage_must_be_valid_for_type_and_status
    return if job_stage_id.nil?
    return if job_type_id.nil? || job_status_id.nil?

    valid_stage = JobStatusStage.exists?(
      job_type_id: job_type_id,
      job_status_id: job_status_id,
      job_stage_id: job_stage_id
    )

    unless valid_stage
      errors.add(:job_stage, "is not valid for this job type and status")
    end
  end
end
```

---

## Phase 2: Backend API

### 2.1 JobStagesController (NEW)
Pattern: Copy from JobTypesController/JobStatusesController

**File:** `backend/app/controllers/api/v1/job_stages_controller.rb`

```ruby
module Api
  module V1
    class JobStagesController < ApplicationController
      before_action :set_job_stage, only: [:show, :update, :destroy]

      # GET /api/v1/job_stages
      # Optional params: ?job_type_id=X&job_status_id=Y (for filtering)
      def index
        if params[:job_type_id] && params[:job_status_id]
          # Get stages for specific type+status combo
          @job_stages = JobStatusStage
            .where(job_type_id: params[:job_type_id], job_status_id: params[:job_status_id])
            .includes(:job_stage)
            .order(:position)
            .map(&:job_stage)
        else
          # Get all stages
          @job_stages = JobStage.unscoped.order(:position)
        end

        render json: {
          success: true,
          job_stages: @job_stages.map { |js| job_stage_json(js) }
        }
      end

      # POST /api/v1/job_stages
      def create
        position = job_stage_params[:position] || (JobStage.unscoped.maximum(:position) || 0) + 1
        @job_stage = JobStage.new(job_stage_params.merge(position: position))

        if @job_stage.save
          render json: {
            success: true,
            job_stage: job_stage_json(@job_stage)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @job_stage.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/job_stages/:id
      def update
        if @job_stage.update(job_stage_params)
          render json: {
            success: true,
            job_stage: job_stage_json(@job_stage)
          }
        else
          render json: {
            success: false,
            errors: @job_stage.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/job_stages/:id
      def destroy
        @job_stage.destroy
        render json: { success: true }
      end

      # POST /api/v1/job_stages/reorder
      def reorder
        params[:job_stage_ids].each_with_index do |id, index|
          JobStage.where(id: id).update_all(position: index)
        end

        render json: {
          success: true,
          job_stages: JobStage.unscoped.order(:position).map { |js| job_stage_json(js) }
        }
      end

      private

      def set_job_stage
        @job_stage = JobStage.find(params[:id])
      end

      def job_stage_params
        params.require(:job_stage).permit(:name, :position, :is_active, :color)
      end

      def job_stage_json(job_stage)
        {
          id: job_stage.id,
          name: job_stage.name,
          position: job_stage.position,
          is_active: job_stage.is_active,
          color: job_stage.color,
          jobs_count: job_stage.jobs.count,
          created_at: job_stage.created_at,
          updated_at: job_stage.updated_at
        }
      end
    end
  end
end
```

### 2.2 JobTypeStatusesController (NEW)
Manages which Statuses are available for each Type

**File:** `backend/app/controllers/api/v1/job_type_statuses_controller.rb`

```ruby
module Api
  module V1
    class JobTypeStatusesController < ApplicationController
      # GET /api/v1/job_types/:job_type_id/statuses
      def index
        job_type = JobType.find(params[:job_type_id])
        statuses = job_type.job_type_statuses.includes(:job_status).order(:position)

        render json: {
          success: true,
          job_type: { id: job_type.id, name: job_type.name },
          statuses: statuses.map do |jts|
            {
              id: jts.job_status.id,
              name: jts.job_status.name,
              color: jts.job_status.color,
              position: jts.position,
              job_type_status_id: jts.id
            }
          end
        }
      end

      # POST /api/v1/job_types/:job_type_id/statuses
      # Params: { job_status_id: X }
      def create
        job_type = JobType.find(params[:job_type_id])
        position = job_type.job_type_statuses.maximum(:position) || 0 + 1

        jts = job_type.job_type_statuses.create!(
          job_status_id: params[:job_status_id],
          position: position
        )

        render json: {
          success: true,
          job_type_status: {
            id: jts.id,
            job_type_id: jts.job_type_id,
            job_status_id: jts.job_status_id,
            position: jts.position
          }
        }, status: :created
      end

      # DELETE /api/v1/job_type_statuses/:id
      def destroy
        jts = JobTypeStatus.find(params[:id])
        jts.destroy
        render json: { success: true }
      end

      # POST /api/v1/job_types/:job_type_id/statuses/reorder
      # Params: { job_type_status_ids: [1, 2, 3] }
      def reorder
        params[:job_type_status_ids].each_with_index do |id, index|
          JobTypeStatus.where(id: id).update_all(position: index)
        end

        render json: { success: true }
      end
    end
  end
end
```

### 2.3 JobStatusStagesController (NEW)
Manages which Stages are available for each Type+Status combo

**File:** `backend/app/controllers/api/v1/job_status_stages_controller.rb`

```ruby
module Api
  module V1
    class JobStatusStagesController < ApplicationController
      # GET /api/v1/job_types/:job_type_id/statuses/:job_status_id/stages
      def index
        stages = JobStatusStage
          .where(job_type_id: params[:job_type_id], job_status_id: params[:job_status_id])
          .includes(:job_stage)
          .order(:position)

        render json: {
          success: true,
          job_type_id: params[:job_type_id],
          job_status_id: params[:job_status_id],
          stages: stages.map do |jss|
            {
              id: jss.job_stage.id,
              name: jss.job_stage.name,
              color: jss.job_stage.color,
              position: jss.position,
              is_required: jss.is_required,
              job_status_stage_id: jss.id
            }
          end
        }
      end

      # POST /api/v1/job_types/:job_type_id/statuses/:job_status_id/stages
      # Params: { job_stage_id: X, is_required: true }
      def create
        position = JobStatusStage
          .where(job_type_id: params[:job_type_id], job_status_id: params[:job_status_id])
          .maximum(:position) || 0 + 1

        jss = JobStatusStage.create!(
          job_type_id: params[:job_type_id],
          job_status_id: params[:job_status_id],
          job_stage_id: params[:job_stage_id],
          is_required: params[:is_required] || false,
          position: position
        )

        render json: {
          success: true,
          job_status_stage: {
            id: jss.id,
            job_type_id: jss.job_type_id,
            job_status_id: jss.job_status_id,
            job_stage_id: jss.job_stage_id,
            position: jss.position,
            is_required: jss.is_required
          }
        }, status: :created
      end

      # DELETE /api/v1/job_status_stages/:id
      def destroy
        jss = JobStatusStage.find(params[:id])
        jss.destroy
        render json: { success: true }
      end

      # POST /api/v1/job_types/:job_type_id/statuses/:job_status_id/stages/reorder
      # Params: { job_status_stage_ids: [1, 2, 3] }
      def reorder
        params[:job_status_stage_ids].each_with_index do |id, index|
          JobStatusStage.where(id: id).update_all(position: index)
        end

        render json: { success: true }
      end
    end
  end
end
```

### 2.4 Update JobsController
Add `job_stage` to includes and json responses

```ruby
# In index action
@jobs = Job.includes(:job_type, :job_status, :job_stage).all

# In job_params
def job_params
  params.require(:job).permit(
    # ... existing params
    :job_type_id,
    :job_status_id,
    :job_stage_id  # NEW
  )
end

# Update JSON serialization to include job_stage
```

### 2.5 Routes
Add to `config/routes.rb`:

```ruby
namespace :api do
  namespace :v1 do
    resources :job_types do
      post 'reorder', on: :collection
      resources :statuses, controller: 'job_type_statuses', only: [:index, :create] do
        post 'reorder', on: :collection
      end
    end

    resources :job_statuses do
      post 'reorder', on: :collection
    end

    resources :job_stages do
      post 'reorder', on: :collection
    end

    resources :job_type_statuses, only: [:destroy]

    # Nested route for stages within type+status
    get 'job_types/:job_type_id/statuses/:job_status_id/stages',
      to: 'job_status_stages#index'
    post 'job_types/:job_type_id/statuses/:job_status_id/stages',
      to: 'job_status_stages#create'
    post 'job_types/:job_type_id/statuses/:job_status_id/stages/reorder',
      to: 'job_status_stages#reorder'
    delete 'job_status_stages/:id', to: 'job_status_stages#destroy'
  end
end
```

---

## Phase 3: Frontend UI

### 3.1 Add Job Stages to JobSetupTab
**File:** `frontend/src/components/settings/JobSetupTab.jsx`

Add a third `SortableList` for Job Stages (same pattern as Types and Statuses):

```jsx
// State
const [jobStages, setJobStages] = useState([])

// Load data
const loadData = async () => {
  const [typesRes, statusesRes, stagesRes] = await Promise.all([
    api.get('/api/v1/job_types'),
    api.get('/api/v1/job_statuses'),
    api.get('/api/v1/job_stages')  // NEW
  ])
  setJobTypes(typesRes.job_types || [])
  setJobStatuses(statusesRes.job_statuses || [])
  setJobStages(stagesRes.job_stages || [])  // NEW
}

// Handlers (same pattern as Types and Statuses)
const handleReorderStages = async (ids) => { /* ... */ }
const handleUpdateStage = async (id, data) => { /* ... */ }
const handleDeleteStage = async (id) => { /* ... */ }
const handleCreateStage = async (data) => { /* ... */ }

// JSX - Add third column
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
  {/* Job Types */}
  <SortableList {...} />

  {/* Job Statuses */}
  <SortableList {...} />

  {/* Job Stages - NEW */}
  <SortableList
    items={jobStages}
    onReorder={handleReorderStages}
    onUpdate={handleUpdateStage}
    onDelete={handleDeleteStage}
    onCreate={handleCreateStage}
    title="Job Stages"
    description="Sub-steps within statuses (Deposit, Slab, Frame, etc.)"
    colorField={true}
  />
</div>
```

### 3.2 Update Cascade Sort Config
Add "Job Stage" as a third sortable field

```jsx
const [items, setItems] = useState(config || [
  { key: 'job_type', label: 'Job Type', enabled: true },
  { key: 'job_status', label: 'Job Status', enabled: true },
  { key: 'job_stage', label: 'Job Stage', enabled: false }  // NEW - default off
])
```

### 3.3 NEW Component: DependencyConfigTab
Create UI for configuring Type→Status and Status→Stage relationships

**File:** `frontend/src/components/settings/DependencyConfigTab.jsx`

This will be a new tab in Settings with:
- **Left Panel:** List of Job Types
- **Middle Panel:** When a Type is selected, show its Statuses (with add/remove/reorder)
- **Right Panel:** When a Type+Status is selected, show its Stages (with add/remove/reorder)

Wireframe:
```
┌─────────────────┬──────────────────┬──────────────────┐
│ Job Types       │ Statuses         │ Stages           │
├─────────────────┼──────────────────┼──────────────────┤
│ ▸ House *       │ ☑ Enquiry        │ ☑ Deposit        │
│   Duplex        │ ☑ Land           │ ☑ Slab           │
│   Townhouse     │ ☑ Active Job *   │ ☑ Frame          │
│   Kitchen       │ ☑ Handover       │ ☑ Lockup         │
│                 │ ☐ Certification  │ ☐ Fixtures       │
│                 │ [+ Add Status]   │ [+ Add Stage]    │
└─────────────────┴──────────────────┴──────────────────┘

* = Selected
☑ = Enabled for this Type/Status
☐ = Available but not enabled
```

### 3.4 Update Jobs List Grouping
**File:** `frontend/src/components/layout/AppLayout.jsx`

Add stage grouping logic:

```jsx
// Add stage-only grouping
if (cascadeConfig[0]?.key === 'job_stage' && cascadeConfig[0]?.enabled) {
  const byStage = {}
  jobs.forEach(job => {
    const stageName = job.job_stage?.name || 'No Stage'
    if (!byStage[stageName]) byStage[stageName] = []
    byStage[stageName].push(job)
  })
  return byStage
}

// Update type+status+stage grouping
const byTypeStatusStage = {}
jobs.forEach(job => {
  const typeName = job.job_type?.name || 'No Type'
  const statusName = job.job_status?.name || 'No Status'
  const stageName = job.job_stage?.name || 'No Stage'

  if (!byTypeStatusStage[typeName]) {
    byTypeStatusStage[typeName] = {}
  }
  if (!byTypeStatusStage[typeName][statusName]) {
    byTypeStatusStage[typeName][statusName] = {}
  }
  if (!byTypeStatusStage[typeName][statusName][stageName]) {
    byTypeStatusStage[typeName][statusName][stageName] = []
  }
  byTypeStatusStage[typeName][statusName][stageName].push(job)
})
```

### 3.5 Cascading Dropdowns for Job Create/Edit
When creating or editing a job, dropdowns cascade:

```jsx
// Pseudo-code for Job form
<select value={jobTypeId} onChange={handleTypeChange}>
  {allJobTypes.map(...)}
</select>

<select value={jobStatusId} onChange={handleStatusChange}>
  {filteredStatuses.map(...)}  {/* Filtered by jobTypeId */}
</select>

<select value={jobStageId} onChange={handleStageChange}>
  {filteredStages.map(...)}  {/* Filtered by jobTypeId + jobStatusId */}
</select>

// When Type changes, clear Status and Stage
// When Status changes, clear Stage
```

### 3.6 Update Job Display
Show stage badge in job lists:

```jsx
{job.job_stage && (
  <span
    className={`w-2 h-2 rounded-sm ${getStageColorClass(job.job_stage.color)} flex-shrink-0`}
    title={job.job_stage.name}
  />
)}
```

---

## Phase 4: Migration & Data Strategy

### 4.1 Seed Default Stages
Create rake task to seed common stages:

**File:** `backend/lib/tasks/job_stages.rake`

```ruby
namespace :job_stages do
  desc "Seed default job stages"
  task seed_defaults: :environment do
    stages = [
      { name: 'Deposit', color: 'blue', position: 1 },
      { name: 'Slab', color: 'indigo', position: 2 },
      { name: 'Frame', color: 'purple', position: 3 },
      { name: 'Lockup', color: 'green', position: 4 },
      { name: 'Fixtures', color: 'teal', position: 5 },
      { name: 'Completion', color: 'slate', position: 6 }
    ]

    stages.each do |stage_data|
      JobStage.find_or_create_by!(name: stage_data[:name]) do |stage|
        stage.color = stage_data[:color]
        stage.position = stage_data[:position]
      end
    end

    puts "Seeded #{stages.count} job stages"
  end
end
```

### 4.2 Default Relationships Setup
Create rake task to set up default Type→Status→Stage relationships:

```ruby
namespace :job_stages do
  desc "Set up default relationships for all types to all statuses to all stages"
  task setup_defaults: :environment do
    # Link all types to all statuses
    JobType.find_each do |job_type|
      JobStatus.find_each.with_index do |job_status, index|
        JobTypeStatus.find_or_create_by!(
          job_type: job_type,
          job_status: job_status
        ) do |jts|
          jts.position = index
        end
      end
    end

    # Link all type+status combos to all stages (for "Active Job" status only)
    active_status = JobStatus.find_by(name: 'Active Job')
    if active_status
      JobType.find_each do |job_type|
        JobStage.find_each.with_index do |job_stage, index|
          JobStatusStage.find_or_create_by!(
            job_type: job_type,
            job_status: active_status,
            job_stage: job_stage
          ) do |jss|
            jss.position = index
          end
        end
      end
    end

    puts "Set up default relationships"
  end
end
```

### 4.3 Migration from Old `stage` Field (Optional)
If you want to preserve existing stage data:

```ruby
namespace :job_stages do
  desc "Migrate old string stage field to job_stage_id"
  task migrate_old_stages: :environment do
    Job.where.not(stage: nil).find_each do |job|
      # Try to find or create a stage matching the old string
      stage = JobStage.find_or_create_by!(name: job.stage) do |s|
        s.color = 'gray'
        s.position = JobStage.maximum(:position).to_i + 1
      end

      # Update job to use the new stage
      job.update_column(:job_stage_id, stage.id)
    end

    puts "Migrated #{Job.where.not(stage: nil).count} jobs"
  end
end
```

### 4.4 Handling Jobs Without Stages
Jobs can have `job_stage_id = nil` initially. This is acceptable and means "no stage assigned yet". The UI should handle this gracefully:

- Show "No Stage" in listings
- Allow filtering by "No Stage"
- When editing, allow selecting a stage (if Type+Status has stages configured)

---

## Phase 5: Implementation Steps

### Step 1: Database Migrations (Backend)
1. ✅ Create migration: `CreateJobStages`
2. ✅ Create migration: `CreateJobTypeStatuses`
3. ✅ Create migration: `CreateJobStatusStages`
4. ✅ Create migration: `AddJobStageToJobs`
5. ✅ Run migrations
6. ✅ Update models with associations and validations

### Step 2: Backend API (Backend)
1. ✅ Create `JobStage` model with validations
2. ✅ Create `JobTypeStatus` model
3. ✅ Create `JobStatusStage` model with sequential helpers
4. ✅ Create `JobStagesController` (CRUD + reorder)
5. ✅ Create `JobTypeStatusesController`
6. ✅ Create `JobStatusStagesController`
7. ✅ Update `JobsController` to include `job_stage`
8. ✅ Add routes
9. ✅ Test all endpoints with curl/Postman

### Step 3: Seed Data (Backend)
1. ✅ Run `rails job_stages:seed_defaults` to create stages
2. ✅ Run `rails job_stages:setup_defaults` to create relationships
3. ✅ (Optional) Run `rails job_stages:migrate_old_stages` if preserving old data

### Step 4: Frontend - Basic Setup (Frontend)
1. ✅ Add Job Stages `SortableList` to `JobSetupTab`
2. ✅ Update cascade sort config to include `job_stage` option
3. ✅ Add stage color utility functions (same as status colors)
4. ✅ Test creating/editing/reordering stages

### Step 5: Frontend - Dependency Configuration (Frontend)
1. ✅ Create `DependencyConfigTab` component
2. ✅ Implement three-panel UI (Type → Status → Stage)
3. ✅ Add to Settings page as new tab
4. ✅ Test configuring relationships

### Step 6: Frontend - Job Display (Frontend)
1. ✅ Update `AppLayout` jobs grouping to support stage
2. ✅ Add stage badges to job list items
3. ✅ Update job detail view to show stage
4. ✅ Test cascade grouping (Type only, Status only, Stage only, Type+Status, Type+Status+Stage)

### Step 7: Frontend - Job Create/Edit (Frontend)
1. ✅ Add cascading dropdown logic to Job form
2. ✅ Implement filtering: Type → filters Statuses → filters Stages
3. ✅ Add validation messages if invalid combo selected
4. ✅ Test creating job with full Type → Status → Stage selection

### Step 8: Sequential Stage Progression (Optional Enhancement)
If you want strict sequential progression (can't skip stages):

1. ✅ Add `can_advance_to_stage?` method on Job model
2. ✅ Add validation to prevent skipping stages
3. ✅ Create UI buttons "Advance to Next Stage" instead of dropdown
4. ✅ Track stage history (optional: create `job_stage_transitions` table)

### Step 9: Documentation & Trinity
1. ✅ Document in Trinity (Teacher section: How to configure job stages)
2. ✅ Add to User Manual
3. ✅ Create video/guide for users on configuring dependencies

### Step 10: Testing & Deployment
1. ✅ Test all scenarios:
   - Creating stages
   - Configuring Type → Status relationships
   - Configuring Status → Stage relationships
   - Creating jobs with full cascade
   - Grouping jobs by different fields
   - Edge cases (no type, no status, no stage)
2. ✅ Deploy to staging
3. ✅ User acceptance testing
4. ✅ Deploy to production

---

## Technical Considerations

### 1. Performance
- Add database indexes on all foreign keys (already in migration plan)
- Use `includes(:job_type, :job_status, :job_stage)` to avoid N+1 queries
- Consider caching cascade config in company settings

### 2. Validation
- Prevent deleting Types/Statuses/Stages that are in use by jobs
- Validate stage is valid for current type+status combo
- Handle orphaned relationships when types/statuses are deleted

### 3. UI/UX
- Clear visual hierarchy: Type → Status → Stage
- Color coding consistency (Types: blue, Statuses: varied, Stages: varied)
- Loading states for cascading dropdowns
- Empty states ("No stages configured for this status")

### 4. Backwards Compatibility
- Old `stage` string field can remain for historical data
- New jobs use `job_stage_id` foreign key
- Migration script can convert old data if needed

### 5. Future Enhancements
- Stage duration tracking (how long in each stage)
- Stage completion checklist (must complete X before advancing)
- Automatic stage progression based on events
- Stage-specific permissions (who can advance stages)
- Stage history/audit log

---

## Open Questions for User

1. **Default Relationships:** Should all Types be linked to all Statuses by default? Or start with no relationships and manually configure?

2. **Required Stages:** Should some stages be mandatory (must pass through) vs optional?

3. **Stage Progression UI:**
   - Option A: Dropdown (can jump to any valid stage)
   - Option B: "Next Stage" button only (strict sequential)
   - Option C: Hybrid (can jump within certain rules)

4. **Migration:** Do you want to preserve data from the old `stage` string field, or start fresh?

5. **Permissions:** Should stage advancement require specific permissions? (e.g., only Project Managers can advance to "Completion")

6. **Naming:** Are "Deposit", "Slab", "Frame", etc. good defaults? Any others needed?

7. **Other Statuses:** You mentioned "Active Job" has stages. Should other statuses also have default stages? Examples:
   - "Drafting Req" → "Initial Design", "Revisions", "Final Plans"
   - "Certification" → "Submitted", "Under Review", "Approved"

---

## Summary

This plan implements a comprehensive three-level hierarchy for Jobs with full cascading dependencies. The architecture follows existing patterns in the codebase (SortableList, CRUD controllers, has_many :through) to ensure consistency.

**Key Features:**
- ✅ Job Type → Job Status → Job Stage cascade
- ✅ Configurable relationships (which Statuses for each Type, which Stages for each Status)
- ✅ Sequential stage progression support
- ✅ Reusable UI components (SortableList)
- ✅ Display in jobs list, detail view, and cascade sort
- ✅ Migration path from old string-based `stage` field

**Estimated Effort:**
- Database & Models: 2-3 hours
- Backend API: 4-5 hours
- Frontend UI (basic): 3-4 hours
- Frontend UI (dependency config): 4-5 hours
- Testing & refinement: 3-4 hours
- **Total: ~20-24 hours**

Ready to begin implementation once you've reviewed and approved this plan!

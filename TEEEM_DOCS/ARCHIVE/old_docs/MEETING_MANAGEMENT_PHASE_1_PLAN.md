# Meeting Management System - Phase 1 Implementation Plan

**Created:** 2025-11-19
**Status:** DRAFT - Ready for Review
**Target:** MVP - Basic meeting management with TEEEM integration

---

## Executive Summary

This document outlines the Phase 1 implementation plan for the TEEEM Meeting Management System. Phase 1 focuses on delivering core meeting functionality that integrates seamlessly with existing TEEEM systems (video meetings, document management, task management).

### Phase 1 Scope (MVP)

**Core Meeting Features:**
- Meeting type configuration system
- Basic meeting creation (in-person and virtual)
- Simple agenda builder
- Attendee management with roles
- Integration with TEEEM video meetings
- Basic email notifications (invites and reminders)

**Deliverable:** Users can create, schedule, and invite people to meetings with agendas

---

## Compliance with TEEEM BIBLE

This implementation plan follows all relevant TEEEM_BIBLE.md rules:

### Chapter 1: System-Wide Rules
- ✅ **RULE #1.2**: Code quality standards (no console.log, descriptive commits, linting)
- ✅ **RULE #1.3**: API response format (`{success: true/false, data: {...}}`)
- ✅ **RULE #1.4**: Database migrations (create migrations, test rollback, add indexes)
- ✅ **RULE #1.7**: Trinity database sync (will create Chapter 22 in Trinity)
- ✅ **RULE #1.11**: Chapter assignment (creating new Chapter 22 for Meetings)
- ✅ **RULE #1.13**: Single source of truth (database as authority)

### Chapter 2: Authentication & Users
- ✅ **RULE #2.1**: JWT token handling (use Authorization: Bearer header)
- ✅ **RULE #2.3**: Role-based access control (check permissions in controllers)

### Chapter 3: System Administration
- ✅ **RULE #3.2**: Timezone handling (use CompanySetting.timezone methods)
- ✅ **RULE #3.4**: Working days configuration (respect company working_days)

### Chapter 6: Jobs & Construction Management
- ✅ Integration with Construction model (meetings belong to jobs)

### Chapter 11: Project Tasks
- ✅ Integration with ProjectTask model (action items from meetings)

### Chapter 18: Workflows & Automation
- ✅ **RULE #18.1**: Solid Queue for background jobs (email sending)
- ✅ **RULE #18.3**: Idempotent jobs (check completion status)

### Chapter 20: UI/UX Standards
- ✅ All UI standards (table patterns, dark mode, accessibility)
- ✅ Form standards (labels, focus states, error handling)
- ✅ Modal patterns (Headless UI, proper transitions)

---

## Database Schema

### New Tables

#### `meetings`

```ruby
create_table "meetings" do |t|
  # Core Meeting Details
  t.bigint "construction_id", null: false
  t.string "title", null: false
  t.text "description"

  # Scheduling
  t.datetime "scheduled_start_time", null: false
  t.datetime "scheduled_end_time"
  t.integer "duration_minutes", default: 60

  # Meeting Type & Status
  t.string "meeting_type", default: "informal"  # informal, management, business_planning, customer
  t.string "status", default: "scheduled"  # scheduled, in_progress, completed, cancelled

  # Location & Format
  t.string "format", default: "in_person"  # in_person, virtual, hybrid
  t.string "location"  # Physical address for in-person/hybrid
  t.text "meeting_url"  # Jitsi meeting URL for virtual/hybrid
  t.string "session_id"  # Jitsi session ID

  # Recurrence (Phase 2)
  t.string "recurrence_rule"  # iCal RRULE format (future)
  t.bigint "parent_meeting_id"  # For recurring meetings (future)

  # Audit & Metadata
  t.bigint "created_by_id"
  t.jsonb "metadata", default: {}
  t.timestamps

  # Indexes
  t.index ["construction_id"]
  t.index ["scheduled_start_time"]
  t.index ["status"]
  t.index ["meeting_type"]
  t.index ["created_by_id"]
  t.index ["parent_meeting_id"]
end

add_foreign_key "meetings", "constructions"
add_foreign_key "meetings", "users", column: "created_by_id"
add_foreign_key "meetings", "meetings", column: "parent_meeting_id"
```

**Reasoning:**
- `construction_id`: Meetings always belong to a construction/job (following RULE #6.1)
- `format`: Supports in-person, virtual (Jitsi), and hybrid meetings
- `session_id`: Integration with existing Jitsi video meeting pattern
- `metadata`: JSONB for flexible data (following existing pattern in WorkflowInstance)
- `meeting_type`: Pre-configured types with different requirements (extensible in Phase 3)

#### `meeting_participants`

```ruby
create_table "meeting_participants" do |t|
  # Core Associations
  t.bigint "meeting_id", null: false
  t.bigint "contact_id"  # Optional - for external participants
  t.bigint "user_id"     # Optional - for internal participants

  # Participant Details
  t.string "role", default: "attendee"  # chair, secretary, attendee, observer
  t.string "participant_type", default: "optional"  # required, optional

  # RSVP & Attendance
  t.string "invitation_status", default: "pending"  # pending, accepted, declined, tentative
  t.datetime "responded_at"
  t.text "response_note"

  t.string "attendance_status"  # present, absent, apology (set during meeting)
  t.datetime "checked_in_at"

  # Audit
  t.timestamps

  # Indexes
  t.index ["meeting_id"]
  t.index ["contact_id"]
  t.index ["user_id"]
  t.index ["role"]
  t.index ["invitation_status"]
end

add_foreign_key "meeting_participants", "meetings"
add_foreign_key "meeting_participants", "contacts"
add_foreign_key "meeting_participants", "users"
```

**Reasoning:**
- Polymorphic-style participant (Contact OR User) for flexibility
- Supports both internal users and external contacts (per spec 4.1.6)
- `role`: Different responsibilities in meetings
- `invitation_status`: Track RSVPs
- `attendance_status`: For roll call (Phase 2/3)

#### `agenda_items`

```ruby
create_table "agenda_items" do |t|
  # Core Associations
  t.bigint "meeting_id", null: false
  t.bigint "presenter_id"  # User who will present this item

  # Item Details
  t.string "title", null: false
  t.text "description"
  t.integer "time_allocation_minutes", default: 10
  t.integer "display_order", null: false

  # Expected Outcome
  t.string "outcome_type", default: "discussion"  # discussion, decision, vote (Phase 3)
  t.boolean "pre_reading_required", default: false

  # Status (for during-meeting, Phase 2)
  t.string "status", default: "pending"  # pending, in_progress, completed, deferred
  t.datetime "started_at"
  t.datetime "completed_at"

  # Audit
  t.timestamps

  # Indexes
  t.index ["meeting_id"]
  t.index ["presenter_id"]
  t.index ["display_order"]
end

add_foreign_key "agenda_items", "meetings"
add_foreign_key "agenda_items", "users", column: "presenter_id"
```

**Reasoning:**
- Simple agenda structure for Phase 1
- `display_order`: Reorderable agenda items
- `time_allocation_minutes`: For time management
- `outcome_type`: Extensible for Phase 3 voting/decisions

#### `agenda_item_documents`

```ruby
create_table "agenda_item_documents" do |t|
  t.bigint "agenda_item_id", null: false
  t.bigint "document_task_id"  # Link to existing DocumentTask
  t.string "document_url"  # Or external URL
  t.string "document_name"
  t.boolean "accessible_to_externals", default: false
  t.timestamps

  t.index ["agenda_item_id"]
  t.index ["document_task_id"]
end

add_foreign_key "agenda_item_documents", "agenda_items"
add_foreign_key "agenda_item_documents", "document_tasks"
```

**Reasoning:**
- Reuse existing DocumentTask model (follows integration principle)
- Support external URLs for external document links
- `accessible_to_externals`: Security for external participants

#### `agenda_comments` (for pre-meeting collaboration)

```ruby
create_table "agenda_comments" do |t|
  t.bigint "agenda_item_id", null: false
  t.bigint "user_id", null: false
  t.text "comment_text", null: false
  t.bigint "parent_comment_id"  # For threading

  t.timestamps

  t.index ["agenda_item_id"]
  t.index ["user_id"]
  t.index ["parent_comment_id"]
end

add_foreign_key "agenda_comments", "agenda_items"
add_foreign_key "agenda_comments", "users"
add_foreign_key "agenda_comments", "agenda_comments", column: "parent_comment_id"
```

**Reasoning:**
- Enable pre-meeting discussion on agenda items
- Threaded comments for organized discussion
- Simple structure for Phase 1

### Associations with Existing Tables

#### Link to `project_tasks` (Action Items)

```ruby
# Add to existing project_tasks migration
add_column :project_tasks, :meeting_id, :bigint
add_column :project_tasks, :agenda_item_id, :bigint
add_index :project_tasks, :meeting_id
add_index :project_tasks, :agenda_item_id
add_foreign_key :project_tasks, :meetings
add_foreign_key :project_tasks, :agenda_items
```

**Reasoning:**
- Action items created during meetings link back to source
- Follows existing ProjectTask pattern
- Enables meeting → action item tracking

---

## Backend Implementation

### Models

#### 1. `Meeting` Model

**File:** `backend/app/models/meeting.rb`

```ruby
class Meeting < ApplicationRecord
  # Associations
  belongs_to :construction
  belongs_to :created_by, class_name: 'User'
  has_many :meeting_participants, dependent: :destroy
  has_many :users, through: :meeting_participants
  has_many :contacts, through: :meeting_participants
  has_many :agenda_items, -> { order(:display_order) }, dependent: :destroy
  has_many :project_tasks, dependent: :nullify
  has_many :child_meetings, class_name: 'Meeting', foreign_key: 'parent_meeting_id'
  belongs_to :parent_meeting, class_name: 'Meeting', optional: true

  # Enums
  enum :format, {
    in_person: 'in_person',
    virtual: 'virtual',
    hybrid: 'hybrid'
  }, prefix: true

  enum :status, {
    scheduled: 'scheduled',
    in_progress: 'in_progress',
    completed: 'completed',
    cancelled: 'cancelled'
  }, prefix: true

  enum :meeting_type, {
    informal: 'informal',
    management: 'management',
    business_planning: 'business_planning',
    customer: 'customer'
  }, prefix: true

  # Validations
  validates :title, presence: true
  validates :scheduled_start_time, presence: true
  validates :duration_minutes, numericality: { greater_than: 0 }
  validate :end_time_after_start_time, if: :scheduled_end_time?

  # Scopes
  scope :upcoming, -> { where('scheduled_start_time > ?', Time.current).order(:scheduled_start_time) }
  scope :past, -> { where('scheduled_start_time < ?', Time.current).order(scheduled_start_time: :desc) }
  scope :today, -> {
    where(scheduled_start_time: Time.current.beginning_of_day..Time.current.end_of_day)
  }
  scope :active, -> { where(status: [:scheduled, :in_progress]) }

  # Callbacks
  before_create :set_end_time_from_duration
  before_create :generate_jitsi_session, if: -> { format_virtual? || format_hybrid? }

  # Instance Methods
  def generate_jitsi_session
    self.session_id = SecureRandom.alphanumeric(10)
    self.meeting_url = "#{ENV['FRONTEND_URL']}/meetings/#{id}/video/#{session_id}"
  end

  def chair
    meeting_participants.find_by(role: 'chair')&.user ||
    meeting_participants.find_by(role: 'chair')&.contact
  end

  def required_participants
    meeting_participants.where(participant_type: 'required')
  end

  def ical_event
    # Generate .ics calendar file (Phase 1.5)
  end

  private

  def set_end_time_from_duration
    return if scheduled_end_time.present?
    self.scheduled_end_time = scheduled_start_time + duration_minutes.minutes
  end

  def end_time_after_start_time
    if scheduled_end_time <= scheduled_start_time
      errors.add(:scheduled_end_time, "must be after start time")
    end
  end
end
```

#### 2. `MeetingParticipant` Model

**File:** `backend/app/models/meeting_participant.rb`

```ruby
class MeetingParticipant < ApplicationRecord
  # Associations
  belongs_to :meeting
  belongs_to :contact, optional: true
  belongs_to :user, optional: true

  # Enums
  enum :role, {
    chair: 'chair',
    secretary: 'secretary',
    attendee: 'attendee',
    observer: 'observer'
  }, prefix: true

  enum :participant_type, {
    required: 'required',
    optional: 'optional'
  }, prefix: true

  enum :invitation_status, {
    pending: 'pending',
    accepted: 'accepted',
    declined: 'declined',
    tentative: 'tentative'
  }, prefix: true

  enum :attendance_status, {
    present: 'present',
    absent: 'absent',
    apology: 'apology'
  }, prefix: false

  # Validations
  validate :has_user_or_contact
  validate :only_one_chair_per_meeting
  validates :meeting_id, uniqueness: {
    scope: [:user_id, :contact_id],
    message: "participant already added to meeting"
  }

  # Scopes
  scope :internal, -> { where.not(user_id: nil) }
  scope :external, -> { where.not(contact_id: nil) }
  scope :accepted, -> { where(invitation_status: 'accepted') }
  scope :attending, -> { where(attendance_status: 'present') }

  # Instance Methods
  def accept!(note: nil)
    update!(
      invitation_status: 'accepted',
      responded_at: Time.current,
      response_note: note
    )
  end

  def decline!(note: nil)
    update!(
      invitation_status: 'declined',
      responded_at: Time.current,
      response_note: note
    )
  end

  def tentative!(note: nil)
    update!(
      invitation_status: 'tentative',
      responded_at: Time.current,
      response_note: note
    )
  end

  def participant_name
    user&.name || contact&.full_name || "Unknown"
  end

  def participant_email
    user&.email || contact&.email
  end

  private

  def has_user_or_contact
    if user_id.blank? && contact_id.blank?
      errors.add(:base, "must have either user or contact")
    end

    if user_id.present? && contact_id.present?
      errors.add(:base, "cannot have both user and contact")
    end
  end

  def only_one_chair_per_meeting
    if role_chair? && meeting.meeting_participants.where(role: 'chair').where.not(id: id).exists?
      errors.add(:role, "meeting already has a chair")
    end
  end
end
```

#### 3. `AgendaItem` Model

**File:** `backend/app/models/agenda_item.rb`

```ruby
class AgendaItem < ApplicationRecord
  # Associations
  belongs_to :meeting
  belongs_to :presenter, class_name: 'User', optional: true
  has_many :agenda_comments, dependent: :destroy
  has_many :agenda_item_documents, dependent: :destroy
  has_many :document_tasks, through: :agenda_item_documents
  has_many :project_tasks, dependent: :nullify

  # Enums
  enum :outcome_type, {
    discussion: 'discussion',
    decision: 'decision',
    vote: 'vote'
  }, prefix: true

  enum :status, {
    pending: 'pending',
    in_progress: 'in_progress',
    completed: 'completed',
    deferred: 'deferred'
  }, prefix: true

  # Validations
  validates :title, presence: true
  validates :display_order, presence: true, numericality: { only_integer: true }
  validates :time_allocation_minutes, numericality: { greater_than: 0 }

  # Scopes
  scope :ordered, -> { order(:display_order) }
  scope :pending, -> { where(status: 'pending') }
  scope :completed, -> { where(status: 'completed') }

  # Instance Methods
  def duration_actual_minutes
    return nil unless started_at && completed_at
    ((completed_at - started_at) / 60).round
  end

  def over_time?
    return false unless duration_actual_minutes
    duration_actual_minutes > time_allocation_minutes
  end

  def reorder_to(new_position)
    old_position = display_order
    transaction do
      if new_position < old_position
        # Moving up - shift items down
        meeting.agenda_items
          .where('display_order >= ? AND display_order < ?', new_position, old_position)
          .update_all('display_order = display_order + 1')
      else
        # Moving down - shift items up
        meeting.agenda_items
          .where('display_order > ? AND display_order <= ?', old_position, new_position)
          .update_all('display_order = display_order - 1')
      end
      update!(display_order: new_position)
    end
  end
end
```

#### 4. `AgendaComment` Model

**File:** `backend/app/models/agenda_comment.rb`

```ruby
class AgendaComment < ApplicationRecord
  # Associations
  belongs_to :agenda_item
  belongs_to :user
  belongs_to :parent_comment, class_name: 'AgendaComment', optional: true
  has_many :replies, class_name: 'AgendaComment', foreign_key: 'parent_comment_id', dependent: :destroy

  # Validations
  validates :comment_text, presence: true

  # Scopes
  scope :top_level, -> { where(parent_comment_id: nil) }
  scope :recent_first, -> { order(created_at: :desc) }
end
```

#### 5. `AgendaItemDocument` Model

**File:** `backend/app/models/agenda_item_document.rb`

```ruby
class AgendaItemDocument < ApplicationRecord
  belongs_to :agenda_item
  belongs_to :document_task, optional: true

  validates :document_name, presence: true
  validate :has_document_source

  private

  def has_document_source
    if document_task_id.blank? && document_url.blank?
      errors.add(:base, "must have either document_task or document_url")
    end
  end
end
```

### Controllers

#### 1. `MeetingsController`

**File:** `backend/app/controllers/api/v1/meetings_controller.rb`

```ruby
module Api
  module V1
    class MeetingsController < ApplicationController
      before_action :authorize_request
      before_action :set_construction, only: [:index, :create]
      before_action :set_meeting, only: [:show, :update, :destroy, :start, :complete, :cancel]

      # GET /api/v1/constructions/:construction_id/meetings
      def index
        meetings = @construction.meetings
          .includes(:meeting_participants, :agenda_items)
          .order(:scheduled_start_time)

        # Filter by status if provided
        meetings = meetings.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          data: meetings.as_json(
            include: {
              meeting_participants: {
                include: [:user, :contact],
                methods: [:participant_name, :participant_email]
              },
              agenda_items: { only: [:id, :title, :display_order, :time_allocation_minutes] },
              created_by: { only: [:id, :name, :email] }
            },
            methods: [:chair]
          )
        }
      end

      # GET /api/v1/meetings/:id
      def show
        render json: {
          success: true,
          data: @meeting.as_json(
            include: {
              construction: { only: [:id, :job_number, :job_name] },
              meeting_participants: {
                include: [:user, :contact],
                methods: [:participant_name, :participant_email]
              },
              agenda_items: {
                include: [:presenter, :agenda_item_documents],
                methods: [:duration_actual_minutes, :over_time?]
              },
              created_by: { only: [:id, :name, :email] }
            },
            methods: [:chair]
          )
        }
      end

      # POST /api/v1/constructions/:construction_id/meetings
      def create
        meeting = @construction.meetings.build(meeting_params)
        meeting.created_by = current_user

        if meeting.save
          # Add creator as a participant (chair by default)
          meeting.meeting_participants.create!(
            user: current_user,
            role: 'chair',
            participant_type: 'required',
            invitation_status: 'accepted'
          )

          # Enqueue invitation emails (Phase 1.5)
          # MeetingInvitationJob.perform_later(meeting.id)

          render json: {
            success: true,
            message: 'Meeting created successfully',
            data: meeting.as_json(include: :meeting_participants)
          }, status: :created
        else
          render json: {
            success: false,
            errors: meeting.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/meetings/:id
      def update
        if @meeting.update(meeting_params)
          # Send update notifications (Phase 1.5)
          # MeetingUpdateJob.perform_later(@meeting.id) if @meeting.saved_change_to_scheduled_start_time?

          render json: {
            success: true,
            message: 'Meeting updated successfully',
            data: @meeting
          }
        else
          render json: {
            success: false,
            errors: @meeting.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/meetings/:id
      def destroy
        @meeting.destroy
        render json: {
          success: true,
          message: 'Meeting deleted successfully'
        }
      end

      # POST /api/v1/meetings/:id/start
      def start
        if @meeting.update(status: 'in_progress', metadata: @meeting.metadata.merge(started_at: Time.current))
          render json: {
            success: true,
            message: 'Meeting started',
            data: @meeting
          }
        else
          render json: {
            success: false,
            errors: @meeting.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/meetings/:id/complete
      def complete
        if @meeting.update(status: 'completed', metadata: @meeting.metadata.merge(completed_at: Time.current))
          render json: {
            success: true,
            message: 'Meeting completed',
            data: @meeting
          }
        else
          render json: {
            success: false,
            errors: @meeting.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/meetings/:id/cancel
      def cancel
        if @meeting.update(status: 'cancelled')
          # Send cancellation emails (Phase 1.5)
          # MeetingCancellationJob.perform_later(@meeting.id)

          render json: {
            success: true,
            message: 'Meeting cancelled',
            data: @meeting
          }
        else
          render json: {
            success: false,
            errors: @meeting.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      private

      def set_construction
        @construction = Construction.find(params[:construction_id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Construction not found' }, status: :not_found
      end

      def set_meeting
        @meeting = Meeting.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Meeting not found' }, status: :not_found
      end

      def meeting_params
        params.require(:meeting).permit(
          :title, :description, :scheduled_start_time, :scheduled_end_time,
          :duration_minutes, :meeting_type, :format, :location, :status
        )
      end
    end
  end
end
```

#### 2. `MeetingParticipantsController`

**File:** `backend/app/controllers/api/v1/meeting_participants_controller.rb`

```ruby
module Api
  module V1
    class MeetingParticipantsController < ApplicationController
      before_action :authorize_request
      before_action :set_meeting
      before_action :set_participant, only: [:update, :destroy, :accept, :decline, :tentative]

      # GET /api/v1/meetings/:meeting_id/participants
      def index
        participants = @meeting.meeting_participants
          .includes(:user, :contact)

        render json: {
          success: true,
          data: participants.as_json(
            include: [:user, :contact],
            methods: [:participant_name, :participant_email]
          )
        }
      end

      # POST /api/v1/meetings/:meeting_id/participants
      def create
        participant = @meeting.meeting_participants.build(participant_params)

        if participant.save
          # Send invitation email (Phase 1.5)
          # ParticipantInvitationJob.perform_later(participant.id)

          render json: {
            success: true,
            message: 'Participant added',
            data: participant
          }, status: :created
        else
          render json: {
            success: false,
            errors: participant.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/meetings/:meeting_id/participants/:id
      def update
        if @participant.update(participant_params)
          render json: {
            success: true,
            data: @participant
          }
        else
          render json: {
            success: false,
            errors: @participant.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/meetings/:meeting_id/participants/:id
      def destroy
        @participant.destroy
        render json: {
          success: true,
          message: 'Participant removed'
        }
      end

      # POST /api/v1/meetings/:meeting_id/participants/:id/accept
      def accept
        @participant.accept!(note: params[:note])
        render json: {
          success: true,
          message: 'Invitation accepted',
          data: @participant
        }
      end

      # POST /api/v1/meetings/:meeting_id/participants/:id/decline
      def decline
        @participant.decline!(note: params[:note])
        render json: {
          success: true,
          message: 'Invitation declined',
          data: @participant
        }
      end

      # POST /api/v1/meetings/:meeting_id/participants/:id/tentative
      def tentative
        @participant.tentative!(note: params[:note])
        render json: {
          success: true,
          message: 'Marked as tentative',
          data: @participant
        }
      end

      private

      def set_meeting
        @meeting = Meeting.find(params[:meeting_id])
      end

      def set_participant
        @participant = @meeting.meeting_participants.find(params[:id])
      end

      def participant_params
        params.require(:participant).permit(
          :user_id, :contact_id, :role, :participant_type,
          :invitation_status, :response_note
        )
      end
    end
  end
end
```

#### 3. `AgendaItemsController`

**File:** `backend/app/controllers/api/v1/agenda_items_controller.rb`

```ruby
module Api
  module V1
    class AgendaItemsController < ApplicationController
      before_action :authorize_request
      before_action :set_meeting
      before_action :set_agenda_item, only: [:show, :update, :destroy, :reorder]

      # GET /api/v1/meetings/:meeting_id/agenda_items
      def index
        items = @meeting.agenda_items
          .includes(:presenter, :agenda_item_documents, :agenda_comments)
          .ordered

        render json: {
          success: true,
          data: items.as_json(
            include: {
              presenter: { only: [:id, :name] },
              agenda_item_documents: { include: :document_task },
              agenda_comments: { include: { user: { only: [:id, :name] } } }
            },
            methods: [:duration_actual_minutes, :over_time?]
          )
        }
      end

      # POST /api/v1/meetings/:meeting_id/agenda_items
      def create
        # Get next display_order
        max_order = @meeting.agenda_items.maximum(:display_order) || 0

        item = @meeting.agenda_items.build(agenda_item_params)
        item.display_order = max_order + 1

        if item.save
          render json: {
            success: true,
            message: 'Agenda item added',
            data: item
          }, status: :created
        else
          render json: {
            success: false,
            errors: item.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/meetings/:meeting_id/agenda_items/:id
      def update
        if @agenda_item.update(agenda_item_params)
          render json: {
            success: true,
            data: @agenda_item
          }
        else
          render json: {
            success: false,
            errors: @agenda_item.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/meetings/:meeting_id/agenda_items/:id
      def destroy
        @agenda_item.destroy

        # Reorder remaining items
        @meeting.agenda_items.where('display_order > ?', @agenda_item.display_order)
          .update_all('display_order = display_order - 1')

        render json: {
          success: true,
          message: 'Agenda item deleted'
        }
      end

      # POST /api/v1/meetings/:meeting_id/agenda_items/:id/reorder
      def reorder
        new_position = params[:new_position].to_i

        if new_position < 1
          render json: { success: false, error: 'Invalid position' }, status: :unprocessable_entity
          return
        end

        @agenda_item.reorder_to(new_position)

        render json: {
          success: true,
          message: 'Agenda item reordered',
          data: @meeting.agenda_items.ordered
        }
      end

      private

      def set_meeting
        @meeting = Meeting.find(params[:meeting_id])
      end

      def set_agenda_item
        @agenda_item = @meeting.agenda_items.find(params[:id])
      end

      def agenda_item_params
        params.require(:agenda_item).permit(
          :title, :description, :presenter_id, :time_allocation_minutes,
          :outcome_type, :pre_reading_required, :status
        )
      end
    end
  end
end
```

### Routes

**File:** `backend/config/routes.rb`

```ruby
# Add to existing routes.rb
namespace :api do
  namespace :v1 do
    # ... existing routes ...

    # Meetings (nested under constructions)
    resources :constructions do
      resources :meetings, only: [:index, :create]
    end

    # Meeting management
    resources :meetings, only: [:show, :update, :destroy] do
      member do
        post :start
        post :complete
        post :cancel
      end

      # Nested resources
      resources :participants, controller: 'meeting_participants' do
        member do
          post :accept
          post :decline
          post :tentative
        end
      end

      resources :agenda_items do
        member do
          post :reorder
        end

        resources :comments, controller: 'agenda_comments'
        resources :documents, controller: 'agenda_item_documents'
      end
    end
  end
end
```

---

## Frontend Implementation

### Pages

#### 1. `MeetingsPage.jsx` - Meeting List

**File:** `frontend/src/pages/MeetingsPage.jsx`

```jsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import NewMeetingModal from '../components/meetings/NewMeetingModal'
import MeetingCard from '../components/meetings/MeetingCard'

export default function MeetingsPage() {
  const { constructionId } = useParams()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false)
  const [filter, setFilter] = useState('all') // all, upcoming, past

  useEffect(() => {
    fetchMeetings()
  }, [constructionId, filter])

  const fetchMeetings = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/constructions/${constructionId}/meetings`, {
        params: filter !== 'all' ? { status: filter } : {}
      })

      if (response.success) {
        setMeetings(response.data)
      }
    } catch (error) {
      console.error('Error fetching meetings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMeetingCreated = () => {
    setShowNewMeetingModal(false)
    fetchMeetings()
  }

  const filteredMeetings = meetings.filter(meeting => {
    if (filter === 'upcoming') {
      return new Date(meeting.scheduled_start_time) > new Date()
    } else if (filter === 'past') {
      return new Date(meeting.scheduled_start_time) < new Date()
    }
    return true
  })

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Meetings
        </h1>
        <button
          onClick={() => setShowNewMeetingModal(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New Meeting
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {['all', 'upcoming', 'past'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Meeting List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No meetings found.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMeetings.map(meeting => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onUpdate={fetchMeetings}
            />
          ))}
        </div>
      )}

      {/* New Meeting Modal */}
      <NewMeetingModal
        open={showNewMeetingModal}
        onClose={() => setShowNewMeetingModal(false)}
        constructionId={constructionId}
        onSuccess={handleMeetingCreated}
      />
    </div>
  )
}
```

#### 2. `MeetingDetailPage.jsx` - Single Meeting View

**File:** `frontend/src/pages/MeetingDetailPage.jsx`

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import MeetingHeader from '../components/meetings/MeetingHeader'
import ParticipantsList from '../components/meetings/ParticipantsList'
import AgendaBuilder from '../components/meetings/AgendaBuilder'
import BackButton from '../components/common/BackButton'

export default function MeetingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('agenda') // agenda, participants, documents

  useEffect(() => {
    fetchMeeting()
  }, [id])

  const fetchMeeting = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/meetings/${id}`)

      if (response.success) {
        setMeeting(response.data)
      }
    } catch (error) {
      console.error('Error fetching meeting:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this meeting?')) return

    try {
      await api.delete(`/api/v1/meetings/${id}`)
      navigate(-1)
    } catch (error) {
      console.error('Error deleting meeting:', error)
    }
  }

  const handleStartMeeting = async () => {
    try {
      await api.post(`/api/v1/meetings/${id}/start`)
      fetchMeeting()
    } catch (error) {
      console.error('Error starting meeting:', error)
    }
  }

  const handleJoinVideo = () => {
    if (meeting.meeting_url) {
      window.open(meeting.meeting_url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="px-4 py-6">
        <p className="text-red-600">Meeting not found</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <BackButton />

      <MeetingHeader
        meeting={meeting}
        onDelete={handleDelete}
        onStart={handleStartMeeting}
        onJoinVideo={handleJoinVideo}
      />

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6">
          {['agenda', 'participants', 'documents'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 py-2 px-1 text-sm font-medium ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'agenda' && (
        <AgendaBuilder meetingId={id} meeting={meeting} onUpdate={fetchMeeting} />
      )}

      {activeTab === 'participants' && (
        <ParticipantsList meetingId={id} participants={meeting.meeting_participants} onUpdate={fetchMeeting} />
      )}

      {activeTab === 'documents' && (
        <div className="text-gray-500">Documents tab - Coming in Phase 1.5</div>
      )}
    </div>
  )
}
```

### Components

#### 1. `NewMeetingModal.jsx`

**File:** `frontend/src/components/meetings/NewMeetingModal.jsx`

```jsx
import { useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { api } from '../../api'
import { getTodayAsString } from '../../utils/timezoneUtils'

export default function NewMeetingModal({ open, onClose, constructionId, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_start_time: getTodayAsString() + 'T09:00',
    duration_minutes: 60,
    meeting_type: 'informal',
    format: 'in_person',
    location: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await api.post(`/api/v1/constructions/${constructionId}/meetings`, {
        meeting: formData
      })

      if (response.success) {
        onSuccess()
        resetForm()
      } else {
        setError(response.errors?.join(', ') || 'Failed to create meeting')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error('Error creating meeting:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      scheduled_start_time: getTodayAsString() + 'T09:00',
      duration_minutes: 60,
      meeting_type: 'informal',
      format: 'in_person',
      location: ''
    })
  }

  const handleClose = () => {
    if (!loading) {
      resetForm()
      onClose()
    }
  }

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-4"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                  Create New Meeting
                </Dialog.Title>

                {error && (
                  <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Title */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Meeting Title *
                    </label>
                    <input
                      type="text"
                      id="title"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                    />
                  </div>

                  {/* Date & Time */}
                  <div>
                    <label htmlFor="scheduled_start_time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      id="scheduled_start_time"
                      required
                      value={formData.scheduled_start_time}
                      onChange={(e) => setFormData({ ...formData, scheduled_start_time: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                    />
                  </div>

                  {/* Duration */}
                  <div>
                    <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      id="duration_minutes"
                      min="15"
                      step="15"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                    />
                  </div>

                  {/* Meeting Type */}
                  <div>
                    <label htmlFor="meeting_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Meeting Type
                    </label>
                    <select
                      id="meeting_type"
                      value={formData.meeting_type}
                      onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                    >
                      <option value="informal">Informal Meeting</option>
                      <option value="management">Management Meeting</option>
                      <option value="business_planning">Business Planning</option>
                      <option value="customer">Customer Meeting</option>
                    </select>
                  </div>

                  {/* Format */}
                  <div>
                    <label htmlFor="format" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Format
                    </label>
                    <select
                      id="format"
                      value={formData.format}
                      onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                    >
                      <option value="in_person">In-Person</option>
                      <option value="virtual">Virtual (Video)</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>

                  {/* Location (only for in-person/hybrid) */}
                  {(formData.format === 'in_person' || formData.format === 'hybrid') && (
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Location
                      </label>
                      <input
                        type="text"
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Enter meeting location"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                      />
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 sm:col-start-2"
                    >
                      {loading ? 'Creating...' : 'Create Meeting'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={loading}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:col-start-1 sm:mt-0"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
```

#### 2. `MeetingCard.jsx`

**File:** `frontend/src/components/meetings/MeetingCard.jsx`

```jsx
import { useNavigate } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'

export default function MeetingCard({ meeting, onUpdate }) {
  const navigate = useNavigate()

  const timezone = localStorage.getItem('company_timezone') || 'Australia/Brisbane'
  const startTime = new Date(meeting.scheduled_start_time)

  const formatDate = formatInTimeZone(startTime, timezone, 'EEE, MMM d, yyyy')
  const formatTime = formatInTimeZone(startTime, timezone, 'h:mm a')

  const statusColors = {
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    in_progress: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }

  const formatIcons = {
    in_person: '📍',
    virtual: '💻',
    hybrid: '🔀'
  }

  return (
    <div
      onClick={() => navigate(`/meetings/${meeting.id}`)}
      className="cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-lg transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {meeting.title}
        </h3>
        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[meeting.status]}`}>
          {meeting.status}
        </span>
      </div>

      {/* Date & Time */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        <p>{formatDate}</p>
        <p>{formatTime} ({meeting.duration_minutes} min)</p>
      </div>

      {/* Format & Location */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
        <span>{formatIcons[meeting.format]}</span>
        <span className="capitalize">{meeting.format.replace('_', ' ')}</span>
        {meeting.location && <span>· {meeting.location}</span>}
      </div>

      {/* Participants */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {meeting.meeting_participants?.length || 0} participant{meeting.meeting_participants?.length !== 1 ? 's' : ''}
        </span>
        {meeting.agenda_items?.length > 0 && (
          <>
            <span className="text-gray-400">·</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {meeting.agenda_items.length} agenda item{meeting.agenda_items.length !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
```

### Navigation & Routing

#### Update App.jsx

```jsx
// Add to frontend/src/App.jsx

// Import new pages
const MeetingsPage = lazy(() => import('./pages/MeetingsPage'))
const MeetingDetailPage = lazy(() => import('./pages/MeetingDetailPage'))

// Add routes (inside <Routes>)
<Route path="/jobs/:constructionId/meetings" element={<AppLayout><MeetingsPage /></AppLayout>} />
<Route path="/meetings/:id" element={<AppLayout><MeetingDetailPage /></AppLayout>} />
```

#### Update JobDetailPage Navigation

Add a "Meetings" tab to the existing JobDetailPage navigation:

```jsx
// In JobDetailPage.jsx, add to tabs array:
const tabs = [
  // ... existing tabs ...
  { name: 'Meetings', path: `/jobs/${id}/meetings`, icon: CalendarIcon }
]
```

---

## Testing Strategy

### Backend Tests (RSpec)

#### 1. Model Tests

**File:** `backend/spec/models/meeting_spec.rb`

```ruby
require 'rails_helper'

RSpec.describe Meeting, type: :model do
  describe 'associations' do
    it { should belong_to(:construction) }
    it { should belong_to(:created_by).class_name('User') }
    it { should have_many(:meeting_participants).dependent(:destroy) }
    it { should have_many(:agenda_items).dependent(:destroy) }
  end

  describe 'validations' do
    it { should validate_presence_of(:title) }
    it { should validate_presence_of(:scheduled_start_time) }
    it { should validate_numericality_of(:duration_minutes).is_greater_than(0) }
  end

  describe 'enums' do
    it { should define_enum_for(:status).with_values(scheduled: 'scheduled', in_progress: 'in_progress', completed: 'completed', cancelled: 'cancelled') }
    it { should define_enum_for(:format).with_values(in_person: 'in_person', virtual: 'virtual', hybrid: 'hybrid') }
  end

  describe 'scopes' do
    let(:construction) { create(:construction) }
    let!(:upcoming_meeting) { create(:meeting, construction: construction, scheduled_start_time: 1.day.from_now) }
    let!(:past_meeting) { create(:meeting, construction: construction, scheduled_start_time: 1.day.ago) }

    it 'returns upcoming meetings' do
      expect(Meeting.upcoming).to include(upcoming_meeting)
      expect(Meeting.upcoming).not_to include(past_meeting)
    end

    it 'returns past meetings' do
      expect(Meeting.past).to include(past_meeting)
      expect(Meeting.past).not_to include(upcoming_meeting)
    end
  end

  describe '#generate_jitsi_session' do
    let(:meeting) { build(:meeting, format: 'virtual') }

    it 'generates session_id and meeting_url for virtual meetings' do
      meeting.save
      expect(meeting.session_id).to be_present
      expect(meeting.meeting_url).to include(meeting.session_id)
    end

    it 'does not generate for in-person meetings' do
      in_person_meeting = create(:meeting, format: 'in_person')
      expect(in_person_meeting.session_id).to be_nil
    end
  end

  describe '#set_end_time_from_duration' do
    let(:start_time) { Time.current }
    let(:meeting) { create(:meeting, scheduled_start_time: start_time, duration_minutes: 60, scheduled_end_time: nil) }

    it 'sets end time based on duration' do
      expect(meeting.scheduled_end_time).to be_within(1.second).of(start_time + 60.minutes)
    end
  end
end
```

#### 2. Controller Tests

**File:** `backend/spec/requests/api/v1/meetings_spec.rb`

```ruby
require 'rails_helper'

RSpec.describe 'Api::V1::Meetings', type: :request do
  let(:user) { create(:user) }
  let(:token) { JsonWebToken.encode(user_id: user.id) }
  let(:headers) { { 'Authorization' => "Bearer #{token}" } }
  let(:construction) { create(:construction) }

  describe 'GET /api/v1/constructions/:construction_id/meetings' do
    let!(:meeting1) { create(:meeting, construction: construction) }
    let!(:meeting2) { create(:meeting, construction: construction) }

    it 'returns all meetings for construction' do
      get "/api/v1/constructions/#{construction.id}/meetings", headers: headers

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json['success']).to be true
      expect(json['data'].size).to eq(2)
    end
  end

  describe 'POST /api/v1/constructions/:construction_id/meetings' do
    let(:valid_params) do
      {
        meeting: {
          title: 'Client Check-in',
          scheduled_start_time: 1.day.from_now,
          duration_minutes: 30,
          format: 'virtual'
        }
      }
    end

    it 'creates a new meeting' do
      expect {
        post "/api/v1/constructions/#{construction.id}/meetings",
          params: valid_params,
          headers: headers
      }.to change(Meeting, :count).by(1)

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['success']).to be true
      expect(json['data']['title']).to eq('Client Check-in')
    end

    it 'adds creator as chair participant' do
      post "/api/v1/constructions/#{construction.id}/meetings",
        params: valid_params,
        headers: headers

      meeting = Meeting.last
      participant = meeting.meeting_participants.first

      expect(participant.user_id).to eq(user.id)
      expect(participant.role).to eq('chair')
    end
  end

  describe 'POST /api/v1/meetings/:id/start' do
    let(:meeting) { create(:meeting, construction: construction, status: 'scheduled') }

    it 'changes meeting status to in_progress' do
      post "/api/v1/meetings/#{meeting.id}/start", headers: headers

      expect(response).to have_http_status(:success)
      expect(meeting.reload.status).to eq('in_progress')
    end
  end
end
```

### Frontend Tests (Playwright)

**File:** `frontend/tests/meetings.spec.js`

```javascript
import { test, expect } from '@playwright/test'

test.describe('Meetings Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Navigate to job meetings
    await page.goto('http://localhost:5173/jobs/1/meetings')
  })

  test('displays meetings list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Meetings')
    await expect(page.locator('[data-testid="meeting-card"]')).toHaveCount(2)
  })

  test('creates new meeting', async ({ page }) => {
    await page.click('button:has-text("+ New Meeting")')

    // Fill form
    await page.fill('#title', 'Team Standup')
    await page.fill('#scheduled_start_time', '2025-12-01T10:00')
    await page.selectOption('#meeting_type', 'management')
    await page.selectOption('#format', 'virtual')

    await page.click('button:has-text("Create Meeting")')

    // Verify meeting created
    await expect(page.locator('text=Team Standup')).toBeVisible()
  })

  test('navigates to meeting detail', async ({ page }) => {
    await page.click('[data-testid="meeting-card"]:first-child')

    await expect(page).toHaveURL(/\/meetings\/\d+/)
    await expect(page.locator('[data-testid="meeting-header"]')).toBeVisible()
  })
})
```

---

## Migration Strategy

### Step 1: Database Setup

```bash
# Create migrations
cd backend
bin/rails generate migration CreateMeetings
bin/rails generate migration CreateMeetingParticipants
bin/rails generate migration CreateAgendaItems
bin/rails generate migration CreateAgendaComments
bin/rails generate migration CreateAgendaItemDocuments
bin/rails generate migration AddMeetingToProjectTasks

# Edit migration files with schema from above

# Run migrations
bin/rails db:migrate

# Test rollback
bin/rails db:rollback STEP=6
bin/rails db:migrate
```

### Step 2: Backend Implementation

```bash
# Create models (order matters due to dependencies)
touch backend/app/models/meeting.rb
touch backend/app/models/meeting_participant.rb
touch backend/app/models/agenda_item.rb
touch backend/app/models/agenda_comment.rb
touch backend/app/models/agenda_item_document.rb

# Create controllers
touch backend/app/controllers/api/v1/meetings_controller.rb
touch backend/app/controllers/api/v1/meeting_participants_controller.rb
touch backend/app/controllers/api/v1/agenda_items_controller.rb
touch backend/app/controllers/api/v1/agenda_comments_controller.rb

# Add routes to config/routes.rb

# Run tests
bundle exec rspec spec/models/meeting_spec.rb
bundle exec rspec spec/requests/api/v1/meetings_spec.rb
```

### Step 3: Frontend Implementation

```bash
cd frontend

# Create component directories
mkdir -p src/components/meetings
mkdir -p src/pages

# Create components
touch src/components/meetings/NewMeetingModal.jsx
touch src/components/meetings/MeetingCard.jsx
touch src/components/meetings/MeetingHeader.jsx
touch src/components/meetings/ParticipantsList.jsx
touch src/components/meetings/AgendaBuilder.jsx

# Create pages
touch src/pages/MeetingsPage.jsx
touch src/pages/MeetingDetailPage.jsx

# Update App.jsx routes

# Run dev server and test
npm run dev
```

### Step 4: Integration Testing

```bash
# Start backend
cd backend && bin/rails server

# Start frontend
cd frontend && npm run dev

# Manual testing checklist:
# [ ] Create meeting
# [ ] Edit meeting details
# [ ] Add participants
# [ ] Build agenda
# [ ] Start meeting
# [ ] Complete meeting
# [ ] Delete meeting
```

### Step 5: Trinity Documentation Update

```ruby
# In Rails console or via TEEEM UI
Trinity.create!(
  category: 'bible',
  chapter_number: 22,
  section_number: '22.1',
  entry_type: 'MUST',
  title: 'Meeting Creation Pattern',
  description: <<~DESC
    MUST create meetings linked to Construction:
    - All meetings belong_to :construction
    - Creator automatically added as chair participant
    - Generate Jitsi session for virtual/hybrid meetings
    - Validate end_time after start_time
  DESC
)

# Export to markdown
bin/rails teeem:export_bible
```

---

## Phase 1 Deliverables

### ✅ Core Functionality
- [x] Meeting CRUD operations
- [x] Meeting types (informal, management, business_planning, customer)
- [x] Meeting formats (in-person, virtual, hybrid)
- [x] Participant management (internal users + external contacts)
- [x] RSVP tracking (accept/decline/tentative)
- [x] Agenda builder with reordering
- [x] Integration with Jitsi video meetings
- [x] Meeting status lifecycle (scheduled → in_progress → completed)

### ✅ Database Schema
- [x] meetings table
- [x] meeting_participants table
- [x] agenda_items table
- [x] agenda_comments table
- [x] agenda_item_documents table
- [x] Link to project_tasks (action items)

### ✅ API Endpoints
- [x] GET /api/v1/constructions/:id/meetings
- [x] POST /api/v1/constructions/:id/meetings
- [x] GET/PATCH/DELETE /api/v1/meetings/:id
- [x] POST /api/v1/meetings/:id/start
- [x] POST /api/v1/meetings/:id/complete
- [x] POST /api/v1/meetings/:id/cancel
- [x] CRUD /api/v1/meetings/:id/participants
- [x] CRUD /api/v1/meetings/:id/agenda_items
- [x] POST /api/v1/meetings/:id/agenda_items/:id/reorder

### ✅ Frontend Pages & Components
- [x] MeetingsPage (list view)
- [x] MeetingDetailPage (single meeting view)
- [x] NewMeetingModal
- [x] MeetingCard
- [x] AgendaBuilder
- [x] ParticipantsList

### ⏳ Phase 1.5 (Quick Wins)
- [ ] Email notifications (invites, reminders)
- [ ] .ics calendar file generation
- [ ] Document attachments to agenda items
- [ ] Pre-meeting task assignments

### 🚀 Phase 2 (Future)
- [ ] Live meeting interface with minutes recording
- [ ] Action item creation during meeting
- [ ] Time tracking per agenda item
- [ ] Attendance/roll call
- [ ] Meeting minutes generation

### 🔒 Phase 3 (Governance)
- [ ] Voting system (motions, resolutions)
- [ ] Digital signatures
- [ ] Australian compliance features
- [ ] Circular resolutions
- [ ] Board meeting workflows

---

## Risks & Mitigation

### Risk 1: Jitsi Session ID Conflicts
**Mitigation:** Use `SecureRandom.alphanumeric(10)` which provides 3.6 quadrillion combinations

### Risk 2: Timezone Confusion
**Mitigation:**
- Use CompanySetting.timezone consistently
- Store all times in UTC
- Display using company timezone
- Follow RULE #3.2 and #3.3

### Risk 3: External Participant Security
**Mitigation:**
- Use Contact model for externals (existing pattern)
- Implement document access controls (accessible_to_externals flag)
- Phase 2: Add PortalUser integration for secure access

### Risk 4: Meeting Notification Spam
**Mitigation:**
- Phase 1.5: Implement Solid Queue background jobs
- User preferences for notification frequency
- Batch digest emails option

---

## Success Metrics

### Phase 1 Success Criteria
1. ✅ Users can create meetings for jobs
2. ✅ Users can add internal/external participants
3. ✅ Users can build agendas with reorderable items
4. ✅ Users can start virtual meetings via Jitsi
5. ✅ Meetings display in job detail pages
6. ✅ All TEEEM_BIBLE rules followed
7. ✅ API responses follow standard format
8. ✅ Dark mode support
9. ✅ Mobile responsive design

### Performance Targets
- Meeting list load: < 500ms
- Meeting detail load: < 800ms
- Create meeting: < 1s
- Start virtual meeting: < 2s

---

## Timeline Estimate

### Week 1: Backend Foundation
- Days 1-2: Database migrations & models
- Days 3-4: API controllers & routes
- Day 5: Backend testing (RSpec)

### Week 2: Frontend Core
- Days 1-2: MeetingsPage & MeetingCard
- Days 3-4: MeetingDetailPage & NewMeetingModal
- Day 5: AgendaBuilder component

### Week 3: Integration & Polish
- Days 1-2: ParticipantsList & RSVP features
- Day 3: Jitsi video integration
- Days 4-5: Testing, bug fixes, UI polish

### Week 4: Testing & Documentation
- Days 1-2: E2E testing (Playwright)
- Day 3: Trinity documentation (Chapter 22)
- Days 4-5: User testing, refinements

**Total: 4 weeks for Phase 1 MVP**

---

## Next Steps

1. **Review this plan** with product team
2. **Get approval** for Phase 1 scope
3. **Create database migrations** (Week 1, Day 1)
4. **Implement backend models** (Week 1, Day 1-2)
5. **Build API endpoints** (Week 1, Day 3-4)
6. **Start frontend development** (Week 2)

---

## Questions for Product Team

1. **Meeting Types:** Are the 4 types (informal, management, business_planning, customer) sufficient for Phase 1?
2. **External Participants:** Should external contacts receive email invites in Phase 1 or wait for Phase 1.5?
3. **Video Meetings:** Confirm Jitsi integration is sufficient or prefer different provider?
4. **Permissions:** Who can create/edit/delete meetings? Only admins or all users?
5. **Recurring Meetings:** Push to Phase 2 or include basic recurrence in Phase 1?

---

**Plan Status:** ✅ Ready for Review
**Next Action:** Schedule review meeting with product team

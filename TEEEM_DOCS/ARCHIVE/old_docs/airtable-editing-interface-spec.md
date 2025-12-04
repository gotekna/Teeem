# Airtable-Style Editing Interface Specification

**Project:** TEEEM Master Schedule - Editable Interface  
**Approach:** Hybrid in-line + modal editing with real-time collaboration  
**Team:** 5 users, full edit permissions  
**Date:** November 4, 2025  

---

## 🎯 Overview

### Design Philosophy
Create an Airtable-inspired editing experience where users can directly manipulate schedule data with intelligent validation, auto-recalculation warnings, and seamless real-time collaboration.

### Key Features
- **Hybrid Editing:** Simple fields edit in-line, complex fields use focused modals
- **Smart Validation:** Dependency conflict warnings with auto-recalculation previews
- **Full History:** Track all changes with undo/redo capability
- **Bulk Operations:** Multi-select with batch editing
- **Custom Fields:** Project-specific columns for flexibility
- **Real-time Sync:** All edits broadcast instantly to team

---

## 🎨 User Interface Design

### Main Schedule Table (Airtable-style)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Project: Residential Build #2024-001                    [+ Add Task]     │
├─────────────────────────────────────────────────────────────────────────┤
│ ☐ │ Task Name              │ Start    │ End      │ Days │ Status    │ Assigned │ Custom Field │
├───┼─────────────────────────┼──────────┼──────────┼──────┼───────────┼──────────┼──────────────┤
│ ☐ │ CREATE - Contract       │ Nov 1 ▼  │ Nov 1    │  1   │ Complete ▼│ Sophie ▼ │ [Edit...]    │
│ ☐ │ GET - Finance Approval  │ Nov 2 ▼  │ Nov 22   │ 21   │ Progress ▼│ Sophie ▼ │ [Edit...]    │
│ ☐ │ [Edit Task Name...]     │ Nov 23 ▼ │ Nov 27   │  5   │ Not Startd│ Jake ▼   │ [Edit...]    │
├───┼─────────────────────────┼──────────┼──────────┼──────┼───────────┼──────────┼──────────────┤
│   │ Dependencies: 2 tasks ↗ │ Supplier: Acme Corp │ Notes: Weather delay risk high   │ [📎 3 files] │
└─────────────────────────────────────────────────────────────────────────┘
```

### Editing Behavior by Field Type

#### In-line Editing (Simple Fields)
- **Text Fields:** Task names, supplier names, notes
- **Dates:** Date pickers with calendar dropdown
- **Dropdowns:** Status, assigned user, categories
- **Numbers:** Duration, progress percentage

#### Modal Editing (Complex Fields)
- **Dependencies:** Visual dependency builder
- **Custom Fields:** Rich text editor or specialized inputs
- **Bulk Operations:** Multi-task selection interface
- **History:** Change log viewer

---

## 🔧 Technical Implementation

### Database Schema Enhancements

#### Add Change Tracking
```sql
-- Track all changes for history/undo
CREATE TABLE schedule_changes (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id),
  task_id BIGINT REFERENCES project_tasks(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  change_type VARCHAR(50) NOT NULL, -- field_update, task_created, dependency_added, etc.
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  change_batch_id UUID, -- Group related changes
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add custom fields support
CREATE TABLE custom_fields (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id),
  field_name VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) NOT NULL, -- text, number, date, select, multi_select
  field_options JSONB, -- For select/multi_select options
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Store custom field values
CREATE TABLE custom_field_values (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES project_tasks(id),
  custom_field_id BIGINT NOT NULL REFERENCES custom_fields(id),
  value TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(task_id, custom_field_id)
);

-- Add row locking for edit conflicts (simple approach)
ALTER TABLE project_tasks ADD COLUMN locked_by_user_id BIGINT REFERENCES users(id);
ALTER TABLE project_tasks ADD COLUMN locked_at TIMESTAMP;
```

#### Enhanced Project Tasks
```sql
-- Add fields for better editing experience
ALTER TABLE project_tasks ADD COLUMN display_order INTEGER DEFAULT 0;
ALTER TABLE project_tasks ADD COLUMN is_custom BOOLEAN DEFAULT false;
ALTER TABLE project_tasks ADD COLUMN created_by_user_id BIGINT REFERENCES users(id);
ALTER TABLE project_tasks ADD COLUMN last_edited_by_user_id BIGINT REFERENCES users(id);
ALTER TABLE project_tasks ADD COLUMN last_edited_at TIMESTAMP;

-- Indexes for performance
CREATE INDEX idx_schedule_changes_project_task ON schedule_changes(project_id, task_id);
CREATE INDEX idx_schedule_changes_batch ON schedule_changes(change_batch_id);
CREATE INDEX idx_custom_field_values_task ON custom_field_values(task_id);
```

### Backend Services

#### Change Tracking Service
```ruby
# app/services/schedule/change_tracker_service.rb
module Schedule
  class ChangeTrackerService
    def initialize(user, batch_id = nil)
      @user = user
      @batch_id = batch_id || SecureRandom.uuid
    end
    
    def track_field_change(task, field_name, old_value, new_value)
      return if old_value == new_value
      
      ScheduleChange.create!(
        project_id: task.project_id,
        task_id: task.id,
        user_id: @user.id,
        change_type: 'field_update',
        field_name: field_name,
        old_value: old_value&.to_s,
        new_value: new_value&.to_s,
        change_batch_id: @batch_id
      )
    end
    
    def track_task_creation(task)
      ScheduleChange.create!(
        project_id: task.project_id,
        task_id: task.id,
        user_id: @user.id,
        change_type: 'task_created',
        change_batch_id: @batch_id
      )
    end
    
    def track_dependency_change(dependency, action)
      ScheduleChange.create!(
        project_id: dependency.successor_task.project_id,
        task_id: dependency.successor_task_id,
        user_id: @user.id,
        change_type: "dependency_#{action}",
        old_value: dependency.predecessor_task.name,
        change_batch_id: @batch_id
      )
    end
  end
end
```

#### Smart Update Service
```ruby
# app/services/schedule/smart_update_service.rb
module Schedule
  class SmartUpdateService
    def initialize(task, user)
      @task = task
      @user = user
      @change_tracker = ChangeTrackerService.new(user)
    end
    
    def update_field(field_name, new_value)
      old_value = @task.send(field_name)
      
      # Check for conflicts and calculate impacts
      impact_analysis = analyze_update_impact(field_name, new_value)
      
      if impact_analysis[:has_conflicts]
        return {
          success: false,
          conflicts: impact_analysis[:conflicts],
          auto_updates: impact_analysis[:auto_updates],
          requires_confirmation: true
        }
      end
      
      # Apply the update
      apply_update(field_name, old_value, new_value)
      
      # Apply auto-calculated changes
      apply_auto_updates(impact_analysis[:auto_updates])
      
      # Broadcast changes
      broadcast_changes
      
      {
        success: true,
        task: @task.reload,
        auto_updates: impact_analysis[:auto_updates]
      }
    end
    
    def force_update_with_confirmation(field_name, new_value, confirmed_auto_updates)
      old_value = @task.send(field_name)
      
      ActiveRecord::Base.transaction do
        apply_update(field_name, old_value, new_value)
        apply_confirmed_auto_updates(confirmed_auto_updates)
      end
      
      broadcast_changes
      
      { success: true, task: @task.reload }
    end
    
    private
    
    def analyze_update_impact(field_name, new_value)
      case field_name
      when 'planned_start_date', 'planned_end_date', 'duration_days'
        analyze_date_change_impact(field_name, new_value)
      when 'status'
        analyze_status_change_impact(new_value)
      else
        { has_conflicts: false, conflicts: [], auto_updates: [] }
      end
    end
    
    def analyze_date_change_impact(field_name, new_value)
      # Calculate new task timeline
      new_start, new_end = calculate_new_dates(field_name, new_value)
      
      # Check predecessor constraints
      predecessor_conflicts = check_predecessor_conflicts(new_start)
      
      # Calculate successor updates needed
      successor_updates = calculate_successor_updates(new_end)
      
      {
        has_conflicts: predecessor_conflicts.any?,
        conflicts: predecessor_conflicts,
        auto_updates: successor_updates
      }
    end
    
    def check_predecessor_conflicts(new_start_date)
      conflicts = []
      
      @task.predecessor_tasks.each do |pred|
        dependency = pred.successor_dependencies.find_by(successor_task: @task)
        required_start = calculate_successor_start_date(pred, dependency)
        
        if new_start_date < required_start
          conflicts << {
            type: 'predecessor_constraint',
            message: "Cannot start before #{pred.name} finishes",
            predecessor_task: pred.name,
            required_start: required_start,
            attempted_start: new_start_date
          }
        end
      end
      
      conflicts
    end
    
    def calculate_successor_updates(new_end_date)
      updates = []
      
      @task.successor_tasks.each do |succ|
        dependency = @task.successor_dependencies.find_by(successor_task: succ)
        new_successor_start = calculate_successor_start_date(@task, dependency, new_end_date)
        
        if new_successor_start != succ.planned_start_date
          duration = succ.duration_days
          updates << {
            task_id: succ.id,
            task_name: succ.name,
            field: 'planned_start_date',
            old_value: succ.planned_start_date,
            new_value: new_successor_start,
            cascaded_end_date: new_successor_start + (duration - 1).days
          }
        end
      end
      
      updates
    end
    
    def apply_update(field_name, old_value, new_value)
      @task.update!(field_name => new_value)
      @change_tracker.track_field_change(@task, field_name, old_value, new_value)
      
      # Update audit fields
      @task.update!(
        last_edited_by_user_id: @user.id,
        last_edited_at: Time.current
      )
    end
    
    def apply_auto_updates(auto_updates)
      auto_updates.each do |update|
        task = ProjectTask.find(update[:task_id])
        old_value = task.send(update[:field])
        
        task.update!(update[:field] => update[:new_value])
        @change_tracker.track_field_change(task, update[:field], old_value, update[:new_value])
      end
    end
    
    def broadcast_changes
      ActionCable.server.broadcast(
        "schedule_project_#{@task.project_id}",
        {
          type: 'task_field_updated',
          task_id: @task.id,
          task: serialize_task(@task),
          updated_by: @user.name,
          timestamp: Time.current.iso8601
        }
      )
    end
  end
end
```

#### Custom Fields Service
```ruby
# app/services/schedule/custom_fields_service.rb
module Schedule
  class CustomFieldsService
    def initialize(project)
      @project = project
    end
    
    def create_field(field_params)
      field = @project.custom_fields.build(field_params)
      
      if field.save
        # Add default values for existing tasks if required
        add_default_values_to_existing_tasks(field) if field.is_required?
        { success: true, field: field }
      else
        { success: false, errors: field.errors }
      end
    end
    
    def update_field_value(task, custom_field, value)
      field_value = CustomFieldValue.find_or_initialize_by(
        task: task,
        custom_field: custom_field
      )
      
      old_value = field_value.value
      field_value.value = value
      
      if field_value.save
        # Track the change
        ChangeTrackerService.new(current_user).track_field_change(
          task, 
          "custom_#{custom_field.field_name}", 
          old_value, 
          value
        )
        
        { success: true }
      else
        { success: false, errors: field_value.errors }
      end
    end
    
    def get_task_custom_values(task)
      task.custom_field_values.includes(:custom_field).map do |cfv|
        {
          field_id: cfv.custom_field.id,
          field_name: cfv.custom_field.field_name,
          field_type: cfv.custom_field.field_type,
          value: cfv.value
        }
      end
    end
    
    private
    
    def add_default_values_to_existing_tasks(field)
      @project.project_tasks.find_each do |task|
        CustomFieldValue.create!(
          task: task,
          custom_field: field,
          value: default_value_for_type(field.field_type)
        )
      end
    end
    
    def default_value_for_type(field_type)
      case field_type
      when 'text' then ''
      when 'number' then '0'
      when 'date' then Date.current.to_s
      when 'select' then nil
      else ''
      end
    end
  end
end
```

### API Controllers

#### Enhanced Project Tasks Controller
```ruby
# app/controllers/api/v1/project_tasks_controller.rb (additions)
class Api::V1::ProjectTasksController < ApplicationController
  # ... existing code ...
  
  def update_field
    result = Schedule::SmartUpdateService.new(@task, current_user)
                                        .update_field(params[:field_name], params[:value])
    
    if result[:requires_confirmation]
      render json: {
        requires_confirmation: true,
        conflicts: result[:conflicts],
        auto_updates: result[:auto_updates]
      }
    elsif result[:success]
      render json: {
        success: true,
        task: serialize_task_with_custom_fields(@task),
        auto_updates: result[:auto_updates]
      }
    else
      render json: { success: false, errors: result[:errors] }, status: :unprocessable_entity
    end
  end
  
  def confirm_update
    result = Schedule::SmartUpdateService.new(@task, current_user)
                                        .force_update_with_confirmation(
                                          params[:field_name],
                                          params[:value],
                                          params[:confirmed_auto_updates]
                                        )
    
    if result[:success]
      render json: {
        success: true,
        task: serialize_task_with_custom_fields(@task)
      }
    else
      render json: { success: false, errors: result[:errors] }, status: :unprocessable_entity
    end
  end
  
  def bulk_update
    task_ids = params[:task_ids]
    updates = params[:updates] # { field_name: value, ... }
    
    results = []
    errors = []
    
    ProjectTask.where(id: task_ids, project: @project).find_each do |task|
      updates.each do |field_name, value|
        result = Schedule::SmartUpdateService.new(task, current_user)
                                           .update_field(field_name, value)
        if result[:success]
          results << { task_id: task.id, field: field_name, success: true }
        else
          errors << { task_id: task.id, field: field_name, errors: result[:errors] }
        end
      end
    end
    
    render json: {
      success: errors.empty?,
      results: results,
      errors: errors
    }
  end
  
  def history
    changes = ScheduleChange.where(task_id: @task.id)
                           .includes(:user)
                           .order(created_at: :desc)
                           .limit(50)
    
    render json: {
      changes: changes.map { |change| serialize_change(change) }
    }
  end
  
  def lock_task
    if @task.locked_by_user_id.present? && @task.locked_by_user_id != current_user.id
      render json: { 
        success: false, 
        error: "Task is locked by #{@task.locked_by_user.name}" 
      }, status: :conflict
    else
      @task.update!(
        locked_by_user_id: current_user.id,
        locked_at: Time.current
      )
      
      render json: { success: true }
    end
  end
  
  def unlock_task
    @task.update!(locked_by_user_id: nil, locked_at: nil)
    render json: { success: true }
  end
  
  private
  
  def serialize_task_with_custom_fields(task)
    base_task = serialize_task(task)
    custom_values = Schedule::CustomFieldsService.new(@project)
                                                .get_task_custom_values(task)
    
    base_task.merge(
      custom_fields: custom_values,
      locked_by: task.locked_by_user&.name,
      last_edited_by: task.last_edited_by_user&.name,
      last_edited_at: task.last_edited_at
    )
  end
  
  def serialize_change(change)
    {
      id: change.id,
      user_name: change.user.name,
      change_type: change.change_type,
      field_name: change.field_name,
      old_value: change.old_value,
      new_value: change.new_value,
      created_at: change.created_at
    }
  end
end
```

#### Custom Fields Controller
```ruby
# app/controllers/api/v1/custom_fields_controller.rb
class Api::V1::CustomFieldsController < ApplicationController
  before_action :set_project
  before_action :set_custom_field, only: [:show, :update, :destroy]
  
  def index
    fields = @project.custom_fields.order(:display_order)
    render json: {
      custom_fields: fields.map { |field| serialize_custom_field(field) }
    }
  end
  
  def create
    result = Schedule::CustomFieldsService.new(@project)
                                         .create_field(custom_field_params)
    
    if result[:success]
      render json: {
        success: true,
        custom_field: serialize_custom_field(result[:field])
      }, status: :created
    else
      render json: { 
        success: false, 
        errors: result[:errors] 
      }, status: :unprocessable_entity
    end
  end
  
  def update
    if @custom_field.update(custom_field_params)
      render json: {
        success: true,
        custom_field: serialize_custom_field(@custom_field)
      }
    else
      render json: { 
        success: false, 
        errors: @custom_field.errors 
      }, status: :unprocessable_entity
    end
  end
  
  def destroy
    @custom_field.destroy
    render json: { success: true }
  end
  
  def update_value
    task = @project.project_tasks.find(params[:task_id])
    custom_field = @project.custom_fields.find(params[:custom_field_id])
    
    result = Schedule::CustomFieldsService.new(@project)
                                         .update_field_value(task, custom_field, params[:value])
    
    if result[:success]
      render json: { success: true }
    else
      render json: { 
        success: false, 
        errors: result[:errors] 
      }, status: :unprocessable_entity
    end
  end
  
  private
  
  def set_project
    @project = Project.find(params[:project_id])
  end
  
  def set_custom_field
    @custom_field = @project.custom_fields.find(params[:id])
  end
  
  def custom_field_params
    params.require(:custom_field).permit(
      :field_name, :field_type, :is_required, :display_order,
      field_options: {}
    )
  end
  
  def serialize_custom_field(field)
    {
      id: field.id,
      field_name: field.field_name,
      field_type: field.field_type,
      field_options: field.field_options,
      is_required: field.is_required,
      display_order: field.display_order
    }
  end
end
```

---

## 🎨 Frontend React Components

### Main Schedule Table Component

```jsx
// components/schedule/EditableScheduleTable.jsx
import React, { useState, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const EditableScheduleTable = ({ projectId }) => {
  const dispatch = useDispatch();
  const { tasks, customFields, loading } = useSelector(state => state.schedule);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null);
  
  const handleCellEdit = useCallback(async (taskId, fieldName, value) => {
    const result = await dispatch(updateTaskField({ taskId, fieldName, value }));
    
    if (result.payload.requires_confirmation) {
      // Show confirmation modal
      setShowConflictModal({
        taskId,
        fieldName,
        value,
        conflicts: result.payload.conflicts,
        autoUpdates: result.payload.auto_updates
      });
    }
  }, [dispatch]);
  
  const handleBulkEdit = useCallback(async (updates) => {
    await dispatch(bulkUpdateTasks({
      taskIds: Array.from(selectedTasks),
      updates
    }));
  }, [dispatch, selectedTasks]);
  
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="schedule-table-container">
        {/* Table Header */}
        <div className="table-header">
          <div className="bulk-actions">
            {selectedTasks.size > 0 && (
              <BulkEditToolbar 
                selectedCount={selectedTasks.size}
                onBulkEdit={handleBulkEdit}
              />
            )}
          </div>
          <button 
            className="add-task-btn"
            onClick={() => setShowAddTaskModal(true)}
          >
            + Add Task
          </button>
        </div>
        
        {/* Scrollable Table */}
        <div className="table-scroll-container">
          <table className="schedule-table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={handleSelectAll} /></th>
                <th>Task Name</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Assigned</th>
                {customFields.map(field => (
                  <th key={field.id}>{field.field_name}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <EditableTaskRow
                  key={task.id}
                  task={task}
                  customFields={customFields}
                  isSelected={selectedTasks.has(task.id)}
                  onSelect={(selected) => handleTaskSelection(task.id, selected)}
                  onCellEdit={handleCellEdit}
                  editingCell={editingCell}
                  setEditingCell={setEditingCell}
                />
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Conflict Resolution Modal */}
        {showConflictModal && (
          <ConflictResolutionModal
            {...showConflictModal}
            onConfirm={handleConfirmUpdate}
            onCancel={() => setShowConflictModal(null)}
          />
        )}
      </div>
    </DndProvider>
  );
};

// Individual editable row component
const EditableTaskRow = ({ 
  task, 
  customFields, 
  isSelected, 
  onSelect, 
  onCellEdit,
  editingCell,
  setEditingCell 
}) => {
  const [, drag] = useDrag({
    type: 'task',
    item: { id: task.id, name: task.name }
  });
  
  const [, drop] = useDrop({
    accept: 'task',
    hover: (draggedItem) => {
      // Handle row reordering
    }
  });
  
  return (
    <tr 
      ref={(node) => drag(drop(node))}
      className={`task-row ${isSelected ? 'selected' : ''} ${task.is_critical_path ? 'critical-path' : ''}`}
    >
      <td>
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
        />
      </td>
      
      {/* Task Name - Always editable */}
      <td>
        <EditableCell
          value={task.name}
          type="text"
          isEditing={editingCell === `${task.id}-name`}
          onEdit={() => setEditingCell(`${task.id}-name`)}
          onSave={(value) => {
            onCellEdit(task.id, 'name', value);
            setEditingCell(null);
          }}
          onCancel={() => setEditingCell(null)}
        />
      </td>
      
      {/* Start Date */}
      <td>
        <EditableCell
          value={task.planned_start_date}
          type="date"
          isEditing={editingCell === `${task.id}-start_date`}
          onEdit={() => setEditingCell(`${task.id}-start_date`)}
          onSave={(value) => {
            onCellEdit(task.id, 'planned_start_date', value);
            setEditingCell(null);
          }}
          onCancel={() => setEditingCell(null)}
        />
      </td>
      
      {/* End Date */}
      <td>
        <EditableCell
          value={task.planned_end_date}
          type="date"
          isEditing={editingCell === `${task.id}-end_date`}
          onEdit={() => setEditingCell(`${task.id}-end_date`)}
          onSave={(value) => {
            onCellEdit(task.id, 'planned_end_date', value);
            setEditingCell(null);
          }}
          onCancel={() => setEditingCell(null)}
        />
      </td>
      
      {/* Duration */}
      <td>
        <EditableCell
          value={task.duration_days}
          type="number"
          isEditing={editingCell === `${task.id}-duration`}
          onEdit={() => setEditingCell(`${task.id}-duration`)}
          onSave={(value) => {
            onCellEdit(task.id, 'duration_days', parseInt(value));
            setEditingCell(null);
          }}
          onCancel={() => setEditingCell(null)}
        />
      </td>
      
      {/* Status Dropdown */}
      <td>
        <StatusDropdown
          value={task.status}
          onChange={(value) => onCellEdit(task.id, 'status', value)}
        />
      </td>
      
      {/* Assigned User Dropdown */}
      <td>
        <UserDropdown
          value={task.assigned_to_id}
          onChange={(value) => onCellEdit(task.id, 'assigned_to_id', value)}
        />
      </td>
      
      {/* Custom Fields */}
      {customFields.map(field => (
        <td key={field.id}>
          <CustomFieldCell
            task={task}
            customField={field}
            onEdit={onCellEdit}
          />
        </td>
      ))}
      
      {/* Actions */}
      <td>
        <div className="task-actions">
          <button onClick={() => openDependencyModal(task)}>🔗</button>
          <button onClick={() => openHistoryModal(task)}>📋</button>
          <button onClick={() => deleteTask(task.id)}>🗑️</button>
        </div>
      </td>
    </tr>
  );
};
```

### Editable Cell Component

```jsx
// components/schedule/EditableCell.jsx
import React, { useState, useRef, useEffect } from 'react';

const EditableCell = ({ 
  value, 
  type = 'text', 
  isEditing, 
  onEdit, 
  onSave, 
  onCancel,
  options = [] // For select types
}) => {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef();
  
  useEffect(() => {
    if (isEditing) {
      setEditValue(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, value]);
  
  const handleSubmit = () => {
    if (editValue !== value) {
      onSave(editValue);
    } else {
      onCancel();
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };
  
  if (!isEditing) {
    return (
      <div 
        className="editable-cell-display"
        onClick={onEdit}
        onDoubleClick={onEdit}
      >
        {formatDisplayValue(value, type)}
      </div>
    );
  }
  
  const renderInput = () => {
    switch (type) {
      case 'date':
        return (
          <input
            ref={inputRef}
            type="date"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            className="editable-input date-input"
          />
        );
        
      case 'number':
        return (
          <input
            ref={inputRef}
            type="number"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            className="editable-input number-input"
          />
        );
        
      case 'select':
        return (
          <select
            ref={inputRef}
            value={editValue || ''}
            onChange={(e) => {
              setEditValue(e.target.value);
              setTimeout(handleSubmit, 0); // Auto-submit on select
            }}
            onBlur={handleSubmit}
            className="editable-input select-input"
          >
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
        
      default:
        return (
          <input
            ref={inputRef}
            type="text"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            className="editable-input text-input"
          />
        );
    }
  };
  
  return (
    <div className="editable-cell-editing">
      {renderInput()}
    </div>
  );
};

const formatDisplayValue = (value, type) => {
  if (!value) return '-';
  
  switch (type) {
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'number':
      return value.toString();
    default:
      return value;
  }
};

export default EditableCell;
```

### Conflict Resolution Modal

```jsx
// components/schedule/ConflictResolutionModal.jsx
import React from 'react';
import { Dialog } from '@headlessui/react';

const ConflictResolutionModal = ({
  taskId,
  fieldName,
  value,
  conflicts,
  autoUpdates,
  onConfirm,
  onCancel
}) => {
  return (
    <Dialog open={true} onClose={onCancel} className="conflict-modal">
      <div className="modal-backdrop">
        <Dialog.Panel className="modal-panel">
          <Dialog.Title className="modal-title">
            Schedule Conflict Detected
          </Dialog.Title>
          
          <div className="modal-content">
            <div className="conflicts-section">
              <h3>⚠️ Conflicts Found:</h3>
              {conflicts.map((conflict, index) => (
                <div key={index} className="conflict-item">
                  <div className="conflict-type">{conflict.type}</div>
                  <div className="conflict-message">{conflict.message}</div>
                  {conflict.predecessor_task && (
                    <div className="conflict-details">
                      Predecessor: {conflict.predecessor_task}
                      <br />
                      Required start: {conflict.required_start}
                      <br />
                      Attempted start: {conflict.attempted_start}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="auto-updates-section">
              <h3>🔄 The following tasks will be automatically updated:</h3>
              {autoUpdates.length === 0 ? (
                <p>No other tasks will be affected.</p>
              ) : (
                <div className="auto-updates-list">
                  {autoUpdates.map((update, index) => (
                    <div key={index} className="auto-update-item">
                      <div className="task-name">{update.task_name}</div>
                      <div className="update-details">
                        {update.field}: {formatDate(update.old_value)} → {formatDate(update.new_value)}
                        {update.cascaded_end_date && (
                          <div className="cascaded">
                            End date: {formatDate(update.cascaded_end_date)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="modal-actions">
            <button 
              onClick={onCancel}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              onClick={() => onConfirm(fieldName, value, autoUpdates)}
              className="btn-primary"
            >
              Continue with Updates
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

export default ConflictResolutionModal;
```

### Bulk Edit Toolbar

```jsx
// components/schedule/BulkEditToolbar.jsx
import React, { useState } from 'react';

const BulkEditToolbar = ({ selectedCount, onBulkEdit }) => {
  const [bulkField, setBulkField] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  
  const handleBulkUpdate = () => {
    if (!bulkField || bulkValue === '') return;
    
    onBulkEdit({ [bulkField]: bulkValue });
    setBulkField('');
    setBulkValue('');
  };
  
  const bulkEditOptions = [
    { value: 'status', label: 'Status' },
    { value: 'assigned_to_id', label: 'Assigned To' },
    { value: 'category', label: 'Category' },
    { value: 'supplier_name', label: 'Supplier' }
  ];
  
  return (
    <div className="bulk-edit-toolbar">
      <span className="selected-count">
        {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected
      </span>
      
      <div className="bulk-edit-controls">
        <select 
          value={bulkField}
          onChange={(e) => setBulkField(e.target.value)}
          className="bulk-field-select"
        >
          <option value="">Select field to edit...</option>
          {bulkEditOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {bulkField && (
          <input
            type="text"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder="New value..."
            className="bulk-value-input"
          />
        )}
        
        <button 
          onClick={handleBulkUpdate}
          disabled={!bulkField || bulkValue === ''}
          className="bulk-update-btn"
        >
          Update All
        </button>
      </div>
      
      <div className="bulk-actions">
        <button className="bulk-action-btn">Shift Dates</button>
        <button className="bulk-action-btn">Change Category</button>
        <button className="bulk-action-btn danger">Delete</button>
      </div>
    </div>
  );
};

export default BulkEditToolbar;
```

---

## 🔄 Real-time Collaboration

### Enhanced ActionCable Channel

```ruby
# app/channels/schedule_channel.rb
class ScheduleChannel < ApplicationCable::Channel
  def subscribed
    stream_from "schedule_project_#{params[:project_id]}"
    
    # Send current online users
    broadcast_user_joined
  end
  
  def unsubscribed
    broadcast_user_left
  end
  
  def lock_task(data)
    task = ProjectTask.find(data['task_id'])
    
    if task.locked_by_user_id.present? && task.locked_by_user_id != current_user.id
      transmit({
        type: 'lock_failed',
        task_id: task.id,
        locked_by: task.locked_by_user.name
      })
    else
      task.update!(
        locked_by_user_id: current_user.id,
        locked_at: Time.current
      )
      
      ActionCable.server.broadcast(
        "schedule_project_#{params[:project_id]}",
        {
          type: 'task_locked',
          task_id: task.id,
          locked_by: current_user.name
        }
      )
    end
  end
  
  def unlock_task(data)
    task = ProjectTask.find(data['task_id'])
    task.update!(locked_by_user_id: nil, locked_at: nil)
    
    ActionCable.server.broadcast(
      "schedule_project_#{params[:project_id]}",
      {
        type: 'task_unlocked',
        task_id: task.id
      }
    )
  end
  
  private
  
  def broadcast_user_joined
    ActionCable.server.broadcast(
      "schedule_project_#{params[:project_id]}",
      {
        type: 'user_joined',
        user: current_user.name
      }
    )
  end
  
  def broadcast_user_left
    ActionCable.server.broadcast(
      "schedule_project_#{params[:project_id]}",
      {
        type: 'user_left',
        user: current_user.name
      }
    )
  end
end
```

### Frontend Real-time Integration

```javascript
// hooks/useRealTimeSchedule.js
import { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { createConsumer } from '@rails/actioncable';

export const useRealTimeSchedule = (projectId) => {
  const dispatch = useDispatch();
  
  useEffect(() => {
    const cable = createConsumer();
    const subscription = cable.subscriptions.create(
      { channel: "ScheduleChannel", project_id: projectId },
      {
        connected: () => {
          console.log('Connected to schedule channel');
          dispatch({ type: 'schedule/REALTIME_CONNECTED' });
        },
        
        disconnected: () => {
          console.log('Disconnected from schedule channel');
          dispatch({ type: 'schedule/REALTIME_DISCONNECTED' });
        },
        
        received: (data) => {
          handleRealtimeUpdate(data);
        }
      }
    );
    
    const handleRealtimeUpdate = (data) => {
      switch (data.type) {
        case 'task_field_updated':
          dispatch({
            type: 'schedule/TASK_UPDATED_REALTIME',
            payload: {
              taskId: data.task_id,
              task: data.task,
              updatedBy: data.updated_by
            }
          });
          
          // Show notification if updated by someone else
          if (data.updated_by !== getCurrentUserName()) {
            showToast(`${data.updated_by} updated task: ${data.task.name}`);
          }
          break;
          
        case 'task_locked':
          dispatch({
            type: 'schedule/TASK_LOCKED',
            payload: {
              taskId: data.task_id,
              lockedBy: data.locked_by
            }
          });
          break;
          
        case 'task_unlocked':
          dispatch({
            type: 'schedule/TASK_UNLOCKED',
            payload: { taskId: data.task_id }
          });
          break;
          
        case 'user_joined':
        case 'user_left':
          dispatch({
            type: 'schedule/USER_PRESENCE_CHANGED',
            payload: data
          });
          break;
      }
    };
    
    return () => subscription.unsubscribe();
  }, [projectId, dispatch]);
  
  const lockTask = useCallback((taskId) => {
    // Implementation for locking tasks
  }, []);
  
  const unlockTask = useCallback((taskId) => {
    // Implementation for unlocking tasks
  }, []);
  
  return { lockTask, unlockTask };
};
```

---

## 📱 Mobile-Responsive Design

### CSS Grid Layout

```scss
// styles/schedule-table.scss
.schedule-table-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  
  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    
    @media (max-width: 768px) {
      flex-direction: column;
      gap: 1rem;
    }
  }
  
  .table-scroll-container {
    flex: 1;
    overflow: auto;
    
    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      
      th, td {
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        text-align: left;
        
        @media (max-width: 768px) {
          padding: 0.25rem;
          font-size: 0.875rem;
        }
      }
      
      .task-row {
        &:hover {
          background-color: #f9fafb;
        }
        
        &.selected {
          background-color: #eff6ff;
        }
        
        &.critical-path {
          border-left: 4px solid #dc2626;
        }
        
        &.locked {
          background-color: #fef3c7;
        }
      }
    }
  }
}

// Mobile-specific table layout
@media (max-width: 768px) {
  .schedule-table {
    // Hide less important columns on mobile
    th:nth-child(n+6),
    td:nth-child(n+6) {
      display: none;
    }
    
    // Make task names wrap
    .task-name-cell {
      min-width: 120px;
      word-wrap: break-word;
    }
  }
  
  // Mobile task detail sidebar
  .mobile-task-detail {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-top: 1px solid #e5e7eb;
    max-height: 50vh;
    overflow-y: auto;
    transform: translateY(100%);
    transition: transform 0.3s ease;
    
    &.open {
      transform: translateY(0);
    }
  }
}

// Editable cell styles
.editable-cell-display {
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  
  &:hover {
    background-color: #f3f4f6;
  }
}

.editable-cell-editing {
  .editable-input {
    width: 100%;
    border: 2px solid #3b82f6;
    border-radius: 0.25rem;
    padding: 0.25rem;
    font-size: inherit;
    
    &:focus {
      outline: none;
      border-color: #1d4ed8;
    }
  }
}
```

---

## 🧪 Testing Strategy

### Backend Testing

```ruby
# spec/services/schedule/smart_update_service_spec.rb
RSpec.describe Schedule::SmartUpdateService do
  let(:project) { create(:project) }
  let(:user) { create(:user) }
  let(:task1) { create(:project_task, project: project, planned_start_date: Date.current) }
  let(:task2) { create(:project_task, project: project, planned_start_date: Date.current + 5.days) }
  let(:dependency) { create(:task_dependency, predecessor_task: task1, successor_task: task2) }
  
  before { dependency } # Create the dependency
  
  describe '#update_field' do
    context 'when updating a date that affects successors' do
      it 'returns auto-update information' do
        service = described_class.new(task1, user)
        new_end_date = Date.current + 10.days
        
        result = service.update_field('planned_end_date', new_end_date)
        
        expect(result[:auto_updates]).to include(
          hash_including(
            task_id: task2.id,
            field: 'planned_start_date'
          )
        )
      end
    end
    
    context 'when creating a conflict' do
      it 'returns conflict information' do
        service = described_class.new(task2, user)
        conflict_date = task1.planned_start_date - 1.day
        
        result = service.update_field('planned_start_date', conflict_date)
        
        expect(result[:requires_confirmation]).to be true
        expect(result[:conflicts]).to include(
          hash_including(type: 'predecessor_constraint')
        )
      end
    end
  end
end

# spec/controllers/api/v1/project_tasks_controller_spec.rb
RSpec.describe Api::V1::ProjectTasksController do
  let(:user) { create(:user) }
  let(:project) { create(:project, project_manager: user) }
  let(:task) { create(:project_task, project: project) }
  
  before { sign_in user }
  
  describe 'PATCH #update_field' do
    it 'updates a simple field successfully' do
      patch :update_field, params: {
        project_id: project.id,
        id: task.id,
        field_name: 'name',
        value: 'Updated Task Name'
      }
      
      expect(response).to have_http_status(:ok)
      expect(json_response['success']).to be true
      expect(task.reload.name).to eq('Updated Task Name')
    end
    
    it 'returns confirmation requirement for conflicting updates' do
      # Setup dependency that would conflict
      predecessor = create(:project_task, project: project)
      create(:task_dependency, predecessor_task: predecessor, successor_task: task)
      
      patch :update_field, params: {
        project_id: project.id,
        id: task.id,
        field_name: 'planned_start_date',
        value: predecessor.planned_start_date - 1.day
      }
      
      expect(response).to have_http_status(:ok)
      expect(json_response['requires_confirmation']).to be true
    end
  end
  
  describe 'POST #bulk_update' do
    it 'updates multiple tasks' do
      task2 = create(:project_task, project: project)
      
      post :bulk_update, params: {
        project_id: project.id,
        task_ids: [task.id, task2.id],
        updates: { status: 'in_progress' }
      }
      
      expect(response).to have_http_status(:ok)
      expect(task.reload.status).to eq('in_progress')
      expect(task2.reload.status).to eq('in_progress')
    end
  end
end
```

### Frontend Testing

```javascript
// components/__tests__/EditableCell.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditableCell from '../EditableCell';

describe('EditableCell', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnEdit = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('displays value in read-only mode', () => {
    render(
      <EditableCell
        value="Test Value"
        isEditing={false}
        onEdit={mockOnEdit}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText('Test Value')).toBeInTheDocument();
  });
  
  it('switches to edit mode on click', () => {
    render(
      <EditableCell
        value="Test Value"
        isEditing={false}
        onEdit={mockOnEdit}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    fireEvent.click(screen.getByText('Test Value'));
    expect(mockOnEdit).toHaveBeenCalled();
  });
  
  it('saves on Enter key', async () => {
    render(
      <EditableCell
        value="Original"
        isEditing={true}
        onEdit={mockOnEdit}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    const input = screen.getByDisplayValue('Original');
    fireEvent.change(input, { target: { value: 'Modified' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockOnSave).toHaveBeenCalledWith('Modified');
  });
  
  it('cancels on Escape key', () => {
    render(
      <EditableCell
        value="Original"
        isEditing={true}
        onEdit={mockOnEdit}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );
    
    const input = screen.getByDisplayValue('Original');
    fireEvent.keyDown(input, { key: 'Escape' });
    
    expect(mockOnCancel).toHaveBeenCalled();
  });
});

// Real-time updates test
describe('Real-time Schedule Updates', () => {
  it('receives and processes task updates', async () => {
    const mockDispatch = jest.fn();
    const mockConsumer = {
      subscriptions: {
        create: jest.fn((params, callbacks) => {
          // Simulate receiving an update
          setTimeout(() => {
            callbacks.received({
              type: 'task_field_updated',
              task_id: 1,
              task: { id: 1, name: 'Updated Task' },
              updated_by: 'Other User'
            });
          }, 100);
          
          return { unsubscribe: jest.fn() };
        })
      }
    };
    
    // Mock the cable consumer
    jest.mock('@rails/actioncable', () => ({
      createConsumer: () => mockConsumer
    }));
    
    const { useRealTimeSchedule } = require('../hooks/useRealTimeSchedule');
    
    // Test would verify the hook processes real-time updates correctly
  });
});
```

---

## 📋 Implementation Timeline

### Week 1: Database & Backend Foundation
- [ ] Create database migrations for change tracking and custom fields
- [ ] Implement change tracking service
- [ ] Build smart update service with conflict detection
- [ ] Add custom fields service
- [ ] Write comprehensive backend tests

### Week 2: API Enhancement
- [ ] Enhance project tasks controller with field update endpoints
- [ ] Add custom fields controller
- [ ] Implement bulk update functionality
- [ ] Add history and locking endpoints
- [ ] Test all API endpoints

### Week 3: Core Frontend Components
- [ ] Build EditableCell component with different input types
- [ ] Create EditableScheduleTable with in-line editing
- [ ] Implement ConflictResolutionModal
- [ ] Add BulkEditToolbar with multi-select
- [ ] Test individual components

### Week 4: Real-time & Advanced Features
- [ ] Enhance ActionCable channel for real-time editing
- [ ] Implement row locking for edit conflicts
- [ ] Add custom fields UI management
- [ ] Build change history viewer
- [ ] Test real-time functionality

### Week 5: Polish & Mobile
- [ ] Mobile-responsive design implementation
- [ ] Performance optimization for large datasets
- [ ] Keyboard navigation and accessibility
- [ ] Advanced bulk operations (date shifting, etc.)
- [ ] End-to-end testing

### Total Timeline: 5 weeks

This Airtable-style editing system transforms your static schedule into a collaborative, real-time editing environment perfect for your 5-person team!

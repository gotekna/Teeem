# Master Schedule - Claude Code Implementation Spec

**Project:** TEEEM Master Schedule Module  
**Team:** Small (5 internal users, max 8 concurrent jobs)  
**Implementation:** Claude Code + Web-first + Real-time  
**Date:** November 4, 2025  

---

## 🎯 Implementation Overview

### Simplified Scope for Small Team
- **Users:** 5 internal users only (no supplier login)
- **Projects:** Maximum 8 concurrent jobs
- **Interface:** Web-first, mobile responsive (native mobile later)
- **Real-time:** Required for collaboration
- **Customization:** Minimal initially, but build provisions for future

### Core Workflow
```
Purchase Orders (TEEEM) → Auto-Generate Schedule → Gantt Chart → Progress Tracking
```

---

## 📊 Database Schema (Simplified)

### Core Tables

```sql
-- Projects (simplified for small team)
CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  project_code VARCHAR(100) UNIQUE,
  description TEXT,
  start_date DATE,
  planned_end_date DATE,
  actual_end_date DATE,
  status VARCHAR(50) DEFAULT 'planning', -- planning, active, complete, on_hold
  client_name VARCHAR(255),
  site_address TEXT,
  project_manager_id BIGINT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Task templates (from NDIS example)
CREATE TABLE task_templates (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  task_type VARCHAR(100) NOT NULL, -- ORDER, DO, GET, CLAIM, CERTIFICATE, PHOTO, FIT
  category VARCHAR(100) NOT NULL, -- ADMIN, CARPENTER, ELECTRICAL, PLUMBER, etc.
  default_duration_days INTEGER NOT NULL DEFAULT 1,
  sequence_order INTEGER DEFAULT 0,
  predecessor_template_codes TEXT[], -- Array of template codes this depends on
  description TEXT,
  is_milestone BOOLEAN DEFAULT false,
  requires_photo BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Project tasks (actual instances)
CREATE TABLE project_tasks (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_template_id BIGINT REFERENCES task_templates(id),
  purchase_order_id BIGINT REFERENCES purchase_orders(id),
  
  -- Task details
  name VARCHAR(255) NOT NULL,
  task_type VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  task_code VARCHAR(100), -- For dependency references (e.g., "SLAB_POUR")
  
  -- Status and progress
  status VARCHAR(50) DEFAULT 'not_started', -- not_started, in_progress, complete, on_hold
  progress_percentage INTEGER DEFAULT 0,
  
  -- Scheduling
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  duration_days INTEGER NOT NULL DEFAULT 1,
  
  -- Assignment (internal only)
  assigned_to_id BIGINT REFERENCES users(id),
  supplier_name VARCHAR(255), -- Simple text field, no login required
  
  -- Flags
  is_milestone BOOLEAN DEFAULT false,
  is_critical_path BOOLEAN DEFAULT false,
  
  -- Notes
  notes TEXT,
  completion_notes TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Task dependencies (critical for construction sequence)
CREATE TABLE task_dependencies (
  id BIGSERIAL PRIMARY KEY,
  successor_task_id BIGINT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  predecessor_task_id BIGINT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) DEFAULT 'finish_to_start',
  lag_days INTEGER DEFAULT 0, -- Can be negative for overlap
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(successor_task_id, predecessor_task_id),
  CHECK (successor_task_id != predecessor_task_id)
);

-- Task updates (progress tracking)
CREATE TABLE task_updates (
  id BIGSERIAL PRIMARY KEY,
  project_task_id BIGINT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  status_before VARCHAR(50),
  status_after VARCHAR(50),
  progress_before INTEGER,
  progress_after INTEGER,
  notes TEXT,
  photo_urls TEXT[],
  update_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add schedule fields to existing purchase_orders
ALTER TABLE purchase_orders 
ADD COLUMN required_on_site_date DATE,
ADD COLUMN creates_schedule_tasks BOOLEAN DEFAULT true,
ADD COLUMN task_category VARCHAR(100);
```

---

## 🔧 NDIS Dependency System Implementation

### Dependency Patterns from NDIS Template

Based on your template analysis, here are the key dependency patterns:

```ruby
# Standard Construction Sequence Dependencies
CONSTRUCTION_DEPENDENCIES = {
  # Foundation Phase
  "CONTRACT_CREATE" => [],
  "FINANCE_APPROVAL" => ["CONTRACT_CREATE"],
  "DEPOSIT_CLAIM" => ["FINANCE_APPROVAL"],
  "SOIL_TEST_ORDER" => ["DEPOSIT_CLAIM"],
  "SURVEY_ORDER" => ["DEPOSIT_CLAIM"],
  "WORKING_DRAWINGS" => ["SOIL_TEST_ORDER", "SURVEY_ORDER"],
  
  # Site Preparation
  "SITE_CUT" => ["WORKING_DRAWINGS"],
  "SURVEYOR_SETOUT" => ["SITE_CUT"],
  "DRAINS_UNDERGROUND" => ["SURVEYOR_SETOUT"],
  "ELECTRICAL_UNDERGROUND" => ["DRAINS_UNDERGROUND"],
  "POWER_TO_SITE" => ["ELECTRICAL_UNDERGROUND"],
  
  # Slab Phase
  "SLAB_CONCRETE" => ["DRAINS_UNDERGROUND", "ELECTRICAL_UNDERGROUND", "POWER_TO_SITE"],
  "TERMITE_PENETRATIONS" => ["SLAB_CONCRETE"],
  "SLAB_PHOTO" => ["SLAB_CONCRETE"],
  "WATERPROOF_SLAB" => ["SLAB_CONCRETE"],
  "SLAB_CLAIM" => ["SLAB_CONCRETE"],
  
  # Frame Phase  
  "FRAME_HARDWARE" => ["SLAB_CONCRETE"],
  "FRAME_MATERIAL" => ["SLAB_CONCRETE"],
  "FRAME_CARPENTER" => ["SLAB_CONCRETE", "FRAME_HARDWARE", "FRAME_MATERIAL"],
  "TERMITE_PERIMETER" => ["FRAME_CARPENTER"],
  "ROOF_TRUSSES" => ["FRAME_CARPENTER"],
  "CRANE_TRUSSES" => ["ROOF_TRUSSES"],
  "STEEL_POSTS" => ["ROOF_TRUSSES"],
  "FRAME_PHOTO" => ["FRAME_CARPENTER"],
  "FRAME_INSPECTION" => ["FRAME_CARPENTER"],
  
  # Roof Phase
  "FASCIA_GUTTER_ROOF" => ["FRAME_CARPENTER", "STEEL_POSTS"],
  "EXTERNAL_DOORS" => ["FASCIA_GUTTER_ROOF"],
  "WINDOWS" => ["FASCIA_GUTTER_ROOF"],
  "EXTERNAL_HANDLES" => ["EXTERNAL_DOORS"],
  "INSTALL_WINDOWS_DOORS" => ["FRAME_CARPENTER", "STEEL_POSTS", "WINDOWS", "EXTERNAL_DOORS"],
  
  # Services Rough-In
  "MIXER_BODIES" => ["INSTALL_WINDOWS_DOORS"],
  "WINDOW_ACTUATORS" => ["WINDOWS", "INSTALL_WINDOWS_DOORS"],
  "WALL_INSULATION" => ["INSTALL_WINDOWS_DOORS"],
  "SOLAR_ROUGH_IN" => ["FASCIA_GUTTER_ROOF"],
  "AIRCON_ROUGH_IN" => ["FASCIA_GUTTER_ROOF"],
  "ELECTRICAL_PREWIRE" => ["FASCIA_GUTTER_ROOF"],
  "PLUMBER_ROUGH_IN" => ["FASCIA_GUTTER_ROOF"],
  
  # Internal Fit-Out
  "PLASTERBOARD" => ["ELECTRICAL_PREWIRE", "PLUMBER_ROUGH_IN", "WALL_INSULATION"],
  "INTERNAL_FIXOUT" => ["PLASTERBOARD"],
  "GARAGE_DOORS" => ["PLASTERBOARD"],
  "KITCHEN" => ["INTERNAL_FIXOUT"],
  "WATERPROOFER" => ["INTERNAL_FIXOUT"],
  "TILES" => ["WATERPROOFER"],
  "TILER" => ["TILES", "WATERPROOFER"],
  
  # Painting & Finishes
  "PAINTER_INTERNAL" => ["TILER"],
  "PAINTER_EXTERNAL" => ["PAINTER_INTERNAL"],
  
  # Final Phase
  "HOT_WATER_SYSTEM" => ["PAINTER_INTERNAL"],
  "PLUMBER_FITOFF" => ["PAINTER_INTERNAL", "PAINTER_EXTERNAL"],
  "ELECTRICIAN_FITOFF" => ["PAINTER_INTERNAL", "PAINTER_EXTERNAL"],
  "FINAL_INSPECTION" => ["PLUMBER_FITOFF", "ELECTRICIAN_FITOFF"],
  "PRACTICAL_COMPLETION" => ["FINAL_INSPECTION"]
}
```

### Lag Time Patterns

```ruby
# Common lag patterns from NDIS template
LAG_PATTERNS = {
  # Inspections happen after completion
  "SLAB_INSPECTION" => { after: "SLAB_CONCRETE", lag: 10 }, # +10 days
  "FRAME_INSPECTION" => { after: "FRAME_CARPENTER", lag: 5 }, # +5 days
  
  # Materials ordered before needed
  "FRAME_HARDWARE" => { before: "FRAME_CARPENTER", lag: -1 }, # -1 day (overlap)
  "MIXER_BODIES" => { before: "PLUMBER_ROUGH_IN", lag: -1 },
  
  # Certificates issued after work completion
  "CERTIFICATE_SLAB" => { after: "SLAB_CONCRETE", lag: 10 },
  "CERTIFICATE_FRAME" => { after: "FRAME_CARPENTER", lag: 10 },
  "CERTIFICATE_WATERPROOF" => { after: "WATERPROOFER", lag: 5 }
}
```

---

## 🎨 Frontend Components (React + Real-time)

### Component Structure

```
src/components/schedule/
├── ScheduleDashboard.jsx          # Main dashboard for 8 projects
├── ProjectSchedule.jsx            # Individual project Gantt view
├── TaskList.jsx                   # Simple task list view
├── TaskDetailPanel.jsx            # Task details sidebar
├── StatusUpdater.jsx              # Quick status updates
├── DependencyVisualizer.jsx       # Show task dependencies
└── RealTimeSync.jsx               # WebSocket connection manager
```

### Key Features for Small Team

```jsx
// Simple dashboard showing all 8 projects
const ScheduleDashboard = () => {
  const projects = useSelector(state => state.schedule.projects);
  
  return (
    <div className="dashboard-grid">
      {projects.map(project => (
        <ProjectCard 
          key={project.id}
          project={project}
          showQuickStats={true}
          showCriticalPath={true}
        />
      ))}
    </div>
  );
};

// Real-time Gantt chart
const ProjectSchedule = ({ projectId }) => {
  const { tasks, dependencies } = useRealTimeSchedule(projectId);
  
  return (
    <div className="schedule-layout">
      <GanttChart 
        tasks={tasks}
        dependencies={dependencies}
        showCriticalPath={true}
        allowDragDrop={true}
        onTaskUpdate={handleTaskUpdate}
      />
      <TaskDetailPanel />
    </div>
  );
};

// Real-time hook
const useRealTimeSchedule = (projectId) => {
  const [tasks, setTasks] = useState({});
  const [dependencies, setDependencies] = useState({});
  
  useEffect(() => {
    const cable = createConsumer();
    const subscription = cable.subscriptions.create(
      { channel: "ScheduleChannel", project_id: projectId },
      {
        received: (data) => {
          if (data.type === 'task_updated') {
            setTasks(prev => ({
              ...prev,
              [data.task.id]: data.task
            }));
          }
        }
      }
    );
    
    return () => subscription.unsubscribe();
  }, [projectId]);
  
  return { tasks, dependencies };
};
```

---

## 🚀 Implementation Priority (Small Team)

### Phase 1: Core Foundation (3-4 weeks)
**Must Have:**
- [ ] Database schema and migrations
- [ ] Purchase Order → Task generation
- [ ] Basic Gantt chart view
- [ ] NDIS template seeding
- [ ] Dependency establishment

### Phase 2: Interaction (2-3 weeks)
**Must Have:**
- [ ] Task status updates
- [ ] Real-time sync (ActionCable)
- [ ] Critical path calculation
- [ ] Progress tracking

### Phase 3: Polish (2 weeks)
**Nice to Have:**
- [ ] Drag-and-drop rescheduling
- [ ] Photo uploads
- [ ] Simple reporting
- [ ] Mobile responsive design

**Total: 7-9 weeks** (vs original 19 weeks)

---

## ⚙️ Claude Code Implementation Tasks

### Task 1: Database Setup
```bash
# Create migration files
rails generate migration CreateProjects
rails generate migration CreateTaskTemplates  
rails generate migration CreateProjectTasks
rails generate migration CreateTaskDependencies
rails generate migration CreateTaskUpdates
rails generate migration AddScheduleFieldsToPurchaseOrders
```

### Task 2: Seed NDIS Templates
```ruby
# db/seeds/task_templates.rb
# Pre-populate all 150+ NDIS tasks with dependencies
```

### Task 3: Core Services
```ruby
# app/services/schedule/
generator_service.rb     # PO → Tasks
dependency_service.rb    # Establish dependencies  
critical_path_service.rb # Calculate critical path
timeline_service.rb      # Calculate dates
```

### Task 4: API Controllers
```ruby
# app/controllers/api/v1/
projects_controller.rb
project_tasks_controller.rb
gantt_controller.rb
task_updates_controller.rb
```

### Task 5: React Frontend
```jsx
// Basic Gantt chart with dhtmlxGantt
// Real-time updates with ActionCable
// Simple responsive design
```

---

## 🔄 Real-Time Architecture (Small Team)

### ActionCable Channels

```ruby
# app/channels/schedule_channel.rb
class ScheduleChannel < ApplicationCable::Channel
  def subscribed
    stream_from "schedule_project_#{params[:project_id]}"
  end
  
  def update_task_status(data)
    # Handle real-time status updates
    task = ProjectTask.find(data['task_id'])
    task.update!(status: data['status'])
    
    # Broadcast to all subscribers
    ActionCable.server.broadcast(
      "schedule_project_#{task.project_id}",
      {
        type: 'task_updated',
        task: task.as_json,
        updated_by: current_user.name
      }
    )
  end
end
```

### Frontend WebSocket

```javascript
// Real-time connection for 5 users
const scheduleConnection = createConsumer();

scheduleConnection.subscriptions.create(
  { channel: "ScheduleChannel", project_id: projectId },
  {
    received: (data) => {
      switch(data.type) {
        case 'task_updated':
          dispatch(updateTaskRealTime(data.task));
          showNotification(`${data.updated_by} updated ${data.task.name}`);
          break;
      }
    }
  }
);
```

---

## 📋 Customization Provisions (Future-Proofing)

### Template Customization System

```ruby
# app/models/task_template.rb
class TaskTemplate < ApplicationRecord
  # Standard templates (non-editable)
  scope :standard, -> { where(is_standard: true) }
  
  # Custom templates (user-created)
  scope :custom, -> { where(is_standard: false) }
  
  # Allow custom dependency rules
  def custom_predecessor_rules
    JSON.parse(custom_dependencies || '[]')
  end
end

# Future: Template builder UI
# Future: Conditional dependencies based on project type
# Future: Duration estimation based on historical data
```

### Project Type Variations

```ruby
# Add to projects table for future
ALTER TABLE projects ADD COLUMN project_type VARCHAR(100) DEFAULT 'residential';
ALTER TABLE projects ADD COLUMN custom_template_set_id BIGINT;

# Future project types:
# - residential, commercial, ndis, renovation, etc.
# - Each type has different task templates and sequences
```

---

## 🎯 Success Metrics (Small Team)

### Must Achieve
- [ ] Generate schedule from POs in <30 seconds
- [ ] Real-time updates visible to all 5 users instantly
- [ ] Support 8 concurrent projects without performance issues
- [ ] Mobile responsive (tablet/phone usable)
- [ ] 95% uptime

### Nice to Have
- [ ] Critical path automatically calculated
- [ ] Photo upload and storage working
- [ ] Basic progress reporting
- [ ] Drag-and-drop rescheduling

---

This simplified spec focuses on your immediate needs while building in provisions for future growth. The dependency system captures the full NDIS complexity but implements it in a scalable way.

Ready for Claude Code implementation!

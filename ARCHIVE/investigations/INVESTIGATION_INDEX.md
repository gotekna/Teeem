# TEEEM Task Management System - Investigation Documentation Index

## Overview

This directory contains comprehensive documentation of the TEEEM application's task management, Gantt chart, and user assignment features.

**Investigation Date:** November 6, 2025
**Status:** Complete and documented
**Scope:** 40+ files analyzed, 8 models, 13 components, 3 controllers

---

## Documentation Files

### 1. TASK_MANAGEMENT_ARCHITECTURE.md (29KB, 926 lines)
**The complete deep-dive reference document**

Contains:
- Executive summary of both task systems
- Detailed breakdown of all 8 models:
  - ProjectTask (main model, 20+ methods)
  - ScheduleTask (supplier scheduling)
  - TaskTemplate (reusable templates)
  - TaskDependency (relationships & validation)
  - TaskUpdate (change history)
  - User, Project, Construction (containers)
- Gantt chart implementation (backend + frontend)
- User assignment system analysis
- Project/schedule management architecture
- Schedule generation service (350 lines analyzed)
- Complete feature inventory:
  - What's working (25+ features)
  - What needs development (15+ items)
- API contracts and responses
- Database relationships diagram
- 10+ prioritized recommendations
- Statistics and key numbers

**When to Use:** For deep understanding of architecture, planning new features, or understanding how things work

**Search:** Use your editor's search function for specific topics (e.g., "ProjectTask", "Gantt", "critical path")

---

### 2. TASK_MANAGEMENT_QUICK_REFERENCE.md (7.4KB, 289 lines)
**The quick lookup guide**

Contains:
- Two task systems at a glance
- Key file locations (organized by type)
- All API endpoints listed
- Task status states (4 states)
- Task properties reference table
- User assignment limitations and workarounds
- Dependency types with explanations
- Gantt chart features summary
- Data flow diagram
- Common operations with examples
- What's missing and priority levels
- Performance notes
- Testing checklist

**When to Use:** For quick lookups during development, API endpoint reference, or file locations

**Most Useful For:** Developers making changes, quick reference during coding

---

### 3. INVESTIGATION_INDEX.md (This File)
**Navigation guide for all documentation**

---

## Key Discoveries Summary

### System Architecture
```
Two distinct task systems:
1. ProjectTask - Detailed project planning with dependencies
2. ScheduleTask - Supplier delivery tracking

Each with independent Gantt visualization
Integrated with purchase orders and templates
Proper hierarchy: Construction → Project → Tasks
```

### What's Working
- Task creation/editing/deletion
- Status tracking (4 states)
- Task dependencies (4 types)
- Circular dependency prevention
- Critical path identification
- Gantt charts (3 zoom levels)
- Inline table editing
- Excel schedule import
- Purchase order integration

### What Needs Work
- Dynamic user fetching (currently hardcoded)
- User roles/permissions
- Backward pass algorithm
- Task comments/notifications
- Resource workload tracking
- Multi-project portfolio

---

## File Locations Quick Reference

### Backend Models
All in `/Users/jakebaird/teeem/backend/app/models/`

| File | Purpose |
|------|---------|
| `project_task.rb` | Main task model with 20+ methods |
| `schedule_task.rb` | Supplier delivery schedule |
| `task_template.rb` | Standard task templates |
| `task_dependency.rb` | Task relationships with validation |
| `task_update.rb` | Change history tracking |
| `project.rb` | Master schedule container |
| `construction.rb` | Job/project container |
| `user.rb` | User accounts |

### Backend Controllers
All in `/Users/jakebaird/teeem/backend/app/controllers/api/v1/`

| File | Routes |
|------|--------|
| `project_tasks_controller.rb` | CRUD + inline updates |
| `schedule_tasks_controller.rb` | Schedule + import + match |
| `projects_controller.rb` | Project + Gantt data |

### Frontend Components
All in `/Users/jakebaird/teeem/frontend/src/components/`

| Location | Component | Purpose |
|----------|-----------|---------|
| `gantt/` | GanttChart.jsx | Main Gantt visualization |
| `gantt/` | TaskTable.jsx | Inline editing table |
| `gantt/` | TaskRow.jsx | Individual task bar |
| `gantt/` | GanttHeader.jsx | Date headers |
| `gantt/` | GanttGrid.jsx | Background grid |
| `schedule-master/` | ScheduleMasterTab.jsx | Schedule management UI |
| `schedule-master/` | ScheduleGanttChart.jsx | Supplier Gantt view |
| `schedule-master/` | ScheduleImporter.jsx | Excel upload |
| `schedule-master/` | TaskMatchModal.jsx | PO matching dialog |

### Frontend Pages
All in `/Users/jakebaird/teeem/frontend/src/pages/`

| File | Purpose |
|------|---------|
| `MasterSchedulePage.jsx` | Full schedule view with toggle |
| `JobDetailPage.jsx` | Job detail with "Schedule Master" tab |

### Database Migrations
All in `/Users/jakebaird/teeem/backend/db/migrate/`

| File | Table |
|------|-------|
| `20251104053317_create_task_templates.rb` | task_templates |
| `20251104053318_create_project_tasks.rb` | project_tasks |
| `20251104053320_create_task_dependencies.rb` | task_dependencies |
| `20251104053321_create_task_updates.rb` | task_updates |
| `20251105051002_create_schedule_tasks.rb` | schedule_tasks |

### Backend Services
| File | Purpose |
|------|---------|
| `/backend/app/services/schedule/generator_service.rb` | Auto-generate schedule from templates & POs |

---

## API Endpoints Quick Reference

### ProjectTasks Endpoints
```
GET    /api/v1/projects/:project_id/tasks             List all
POST   /api/v1/projects/:project_id/tasks             Create
GET    /api/v1/projects/:project_id/tasks/:id         Get one
PATCH  /api/v1/projects/:project_id/tasks/:id         Update
DELETE /api/v1/projects/:project_id/tasks/:id         Delete
GET    /api/v1/projects/:id/gantt                     Get Gantt data
```

### ScheduleTasks Endpoints
```
GET    /api/v1/constructions/:id/schedule_tasks                 List all
POST   /api/v1/constructions/:id/schedule_tasks/import          Import Excel
GET    /api/v1/constructions/:id/schedule_tasks/gantt_data      Get Gantt
PATCH  /api/v1/schedule_tasks/:id/match_po                      Match to PO
DELETE /api/v1/schedule_tasks/:id/unmatch_po                    Unmatch from PO
```

---

## Database Schema Overview

### Core Task Tables
- **project_tasks** - 15 columns, 3 indexes
  - References: project, task_template, purchase_order, user (assigned_to)
  - Relationships: dependencies, updates

- **schedule_tasks** - 16 columns, 3 indexes
  - References: construction, purchase_order
  - Special fields: JSONB predecessors array

- **task_templates** - 8 columns, 3 indexes
  - References: none
  - Integer array: predecessor_template_codes

- **task_dependencies** - 4 columns, 2 indexes
  - References: project_tasks (twice - successor & predecessor)
  - Unique constraint on (successor, predecessor) pair

- **task_updates** - 7 columns, 1 index
  - References: project_task, user
  - Text array: photo_urls

---

## How to Use This Documentation

### For Understanding the System
1. Start with TASK_MANAGEMENT_ARCHITECTURE.md Section 1
2. Read the executive summary for context
3. Review the two task systems explanation
4. Check the data relationships diagram

### For Development
1. Use TASK_MANAGEMENT_QUICK_REFERENCE.md for quick lookups
2. Reference file locations when navigating code
3. Check API endpoints section for REST contracts
4. Use common operations section for examples

### For Adding Features
1. Check "What's Missing" sections in both docs
2. Review recommendations in Architecture doc
3. Identify related files using location reference
4. Check API contracts before implementing

### For Bug Fixes
1. Find the relevant model in file locations
2. Check properties and relationships in Architecture doc
3. Review validations and methods
4. Check controller implementation

### For Performance Optimization
1. See "Performance Notes" in Quick Reference
2. Review database indexes section
3. Check caching patterns in models
4. Consider pagination needs

---

## Architecture Highlights

### Strengths
- Clean separation: ProjectTask (planning) vs ScheduleTask (delivery)
- Proper data relationships with foreign keys
- Validation at model level (circular dependency prevention)
- Dependency tracking with 4 relationship types
- Timeline calculation with forward pass algorithm
- Professional React frontend with Tailwind CSS
- PostgreSQL backend with strategic indexes

### Limitations
- Team members hardcoded in frontend
- User model basic (no roles/permissions)
- Float calculation not implemented
- No collaboration features
- Limited to single-project view

### Ready For Production
- Basic to intermediate project scheduling
- Task management with dependencies
- Gantt visualization
- Excel import
- Purchase order integration

### Needs Development
- User management automation
- Advanced algorithms (backward pass)
- Collaboration features
- Resource management
- Portfolio-level scheduling

---

## Key Statistics

| Category | Count |
|----------|-------|
| Task-related models | 8 |
| Frontend components | 13 |
| API controllers | 3 |
| Database tables | 5 |
| API endpoints | 11 |
| Task states | 4 |
| Dependency types | 4 |
| Trade categories | 20+ |
| Lines of documentation | 1,200+ |
| Files analyzed | 40+ |

---

## Quick Start for New Developers

1. **Understand the Models:**
   - Read TASK_MANAGEMENT_ARCHITECTURE.md sections 1.1-1.6
   - Focus on ProjectTask first, then ScheduleTask

2. **See the Frontend:**
   - Look at MasterSchedulePage.jsx in frontend/src/pages/
   - Study GanttChart.jsx and TaskTable.jsx components

3. **Test the API:**
   - Use the endpoints from Quick Reference
   - Test CRUD operations on tasks
   - Try dependency creation (will test circular prevention)

4. **Understand the Data Flow:**
   - Review the "Data Flow" section in Quick Reference
   - See how schedule generation works in generator_service.rb

5. **Plan Your Feature:**
   - Check "What's Missing" section
   - Review recommendations
   - Find related files using location reference

---

## Common Questions Answered

**Q: Where are tasks stored?**
A: Two systems - ProjectTask table (project planning) and ScheduleTask table (supplier delivery). See TASK_MANAGEMENT_ARCHITECTURE.md sections 1.1 and 1.2.

**Q: How do dependencies work?**
A: TaskDependency model (4 types: FS, SS, FF, SF) with circular prevention. See Architecture section 1.4.

**Q: How is the Gantt chart created?**
A: Backend API returns task data, React components render grid/bars. See Architecture section 2.

**Q: How are users assigned?**
A: Frontend has hardcoded team members. Backend ready but needs dynamic fetching. See Architecture section 3.

**Q: What needs to be built next?**
A: Dynamic user fetching, backward pass, notifications, comments. See Architecture section 10 for recommendations.

---

## Document Versions

- **Investigation Date:** November 6, 2025
- **Investigation Scope:** Full architectural analysis
- **Documentation Level:** Professional/Production-ready
- **Target Audience:** Development team, product managers, architects

---

## Contact & Support

For questions about this investigation:
- Check the relevant documentation file first
- Use search function (Ctrl+F / Cmd+F) in your editor
- Review the file locations and examples
- Consult the "Common Questions" section above

---

**Last Updated:** November 6, 2025
**Status:** Complete and verified
**Files:** 2 comprehensive documents ready for reference

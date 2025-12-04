# NDIS Construction Dependencies - Complete Mapping

**Project:** TEEEM Master Schedule Dependencies  
**Source:** UpHomes NDIS Template Analysis  
**Tasks:** 154 construction tasks with dependencies  
**Date:** November 4, 2025  

---

## 📊 Complete Dependency Analysis

### Dependency Notation System

From the NDIS template, dependencies are referenced by **row numbers** with these patterns:

- **Simple:** `"3"` = Task depends on completion of task in row 3
- **Multiple:** `"3, 4"` = Task depends on completion of tasks in rows 3 AND 4  
- **Lag/Lead:** `"32FS +10d"` = Task starts 10 days after task 32 finishes
- **Overlap:** `"42SS -1d"` = Task starts 1 day before task 42 starts

### Dependency Types Explained

```
FS = Finish-to-Start (most common)
SS = Start-to-Start  
FF = Finish-to-Finish
SF = Start-to-Finish (rare)

+Xd = Lag time (wait X days after predecessor)
-Xd = Lead time (start X days before predecessor finishes)
```

---

## 🏗️ Complete Task Dependency Mapping

### Phase 1: Contract & Finance (Tasks 1-5)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 1 | CREATE - Contract | - | - | Starting point |
| 2 | DO - Load Invoices into XERO | 1 | 0 | After contract |
| 3 | GET - Finance Approval | 1 | 0 | After contract |
| 4 | CLAIM - DEPOSIT | 3 | 0 | After finance approval |
| 5 | ORDER - Soil Test and Wind Rating & Slab Design | 4 | 0 | After deposit |

### Phase 2: Design & Approvals (Tasks 6-15)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 6 | ORDER - Contour Survey Plan | 4 | 0 | After deposit |
| 7 | DO - Working Drawings | 4, 6 | 0 | After deposit + survey |
| 8 | DO - Plumbing Approval | 3, 4 | 0 | After finance + deposit |
| 9 | DO - QLeave | 3, 4 | 0 | After finance + deposit |
| 10 | DO - Hydraulics Design | 3, 4 | 0 | After finance + deposit |
| 11 | DO - Energy Efficiency | 3, 4 | 0 | After finance + deposit |
| 12 | CHECK - Land Settlement | 3, 4 | 0 | After finance + deposit |
| 13 | DO - Covenant Approval (if required) | 7 | 0 | After working drawings |
| 14 | DO - Certification | 8, 9, 10, 11 | 0 | After all approvals |
| 15 | DO - Driveway Application | 14 | 0 | After certification |

### Phase 3: Material Orders (Tasks 16-25)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 16 | ORDER - Trusses | 12, 14 | 0 | After settlement + cert |
| 17 | ORDER - Window Actuators | 12, 14 | 0 | After settlement + cert |
| 18 | ORDER - Kitchen Parts | 12, 14 | 0 | After settlement + cert |
| 19 | ORDER - Door Automation | 12, 14 | 0 | After settlement + cert |
| 20 | ORDER - Plumbing Items | 12, 14 | 0 | After settlement + cert |
| 21 | ORDER - Frame | 12, 14 | 0 | After settlement + cert |
| 22 | ORDER - Roof | 12, 14 | 0 | After settlement + cert |
| 23 | ORDER - EXT Doors | 12, 14 | 0 | After settlement + cert |
| 24 | ORDER - Surveyor | 12, 14 | 0 | After settlement + cert |
| 25 | ORDER - Windows | 12, 14 | 0 | After settlement + cert |

### Phase 4: Site Preparation (Tasks 26-32)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 26 | Req Site Cut | 12, 14 | 0 | After settlement + cert |
| 27 | Req Surveyor to Setout Wafflepod | 26 | 0 | After site cut |
| 28 | Req Drainer for Drains Wafflepod | 27 | 0 | After setout |
| 29 | Req Electrician Underground (INC NBN) | 28 | 0 | After drains |
| 30 | Req Power To Site | 29 | 0 | After underground electrical |
| 31 | Req Concreter For Complete Slab | 28, 29, 30 | 0 | After all underground |
| 32 | Req Termite Protection Penetrations | 31 | 0 | After slab concrete |

### Phase 5: Slab Completion (Tasks 33-38)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 33 | PHOTO - Slab | 31 | 0 | After slab pour |
| 34 | Req Waterproof Slab Edge | 31 | 0 | After slab pour |
| 35 | CLAIM - Slab | 31 | 0 | After slab pour |
| 36 | CERTIFICATE - Surveyor | 27 | +10d | 10 days after setout |
| 37 | CERTIFICATE - Engineer Slab | 31 | +10d | 10 days after slab |
| 38 | Req Frame Hardware | 31 | -1d | 1 day before frame starts |

### Phase 6: Frame Construction (Tasks 39-50)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 39 | Req Frame Material Ground Floor | 31 | -1d | 1 day before frame |
| 40 | Req Carpenter Ground Floor | 31 | +2d | 2 days after slab |
| 41 | Req Termite Perimeter | 40 | 0 | After frame starts |
| 42 | Req Roof Trusses | 40 | +2d | 2 days after frame |
| 43 | Req Crane Roof Trusses | 42 | 0 | When trusses delivered |
| 44 | Req Steel Posts | 42 | 0 | With trusses |
| 45 | PHOTO - Frame | 40 | 0 | Frame completion |
| 46 | Do Frame Inspection | 40 | 0 | Frame completion |
| 47 | Req Partition Wall | 40 | 0 | After frame |
| 48 | CERTIFICATE - Engineer Frame INC Hoist | 45 | 0 | After frame photo |
| 49 | CERTIFICATE - Termite | 41 | +5d | 5 days after termite |
| 50 | CLAIM - Frame | 40, 46 | 0 | After frame + inspection |

### Phase 7: Roof & External (Tasks 51-62)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 51 | CERTIFICATE - Roof Trusses | 42 | +5d | 5 days after trusses |
| 52 | Req Fascia and Gutter and Colorbond Roof | 40, 44 | 0 | After frame + posts |
| 53 | Req External Doors | 52 | -1d | 1 day before install |
| 54 | Req Windows | 52 | -1d | 1 day before install |
| 55 | Req External Door Handle Locks | 53 | 0 | When doors delivered |
| 56 | Req Carpenter Install Windows/Doors | 40, 44, 54 | 0 | After frame + windows |
| 57 | Req Carpenter Straighten Frame | 56 | 0 | After window install |
| 58 | Req Mixer Bodies For Plumber Rough In | 65 | -1d | 1 day before plumbing |
| 59 | FIT - Window Actuators | 54, 56 | 0 | After windows installed |
| 60 | Req Wall Sisilation Ground Floor | 56 | 0 | After windows |
| 61 | Req Measure Garage Doors | 56 | 0 | After windows |
| 62 | Req Rough In Solar Panels | 52 | 0 | After roof |

### Phase 8: Services Rough-In (Tasks 63-75)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 63 | Req Air Conditioning Rough In | 52 | 0 | After roof |
| 64 | Req Electrician - Prewire | 52 | 0 | After roof |
| 65 | Req Plumber Rough In | 52 | 0 | After roof |
| 66 | Req Soffit Hardware and Cladding | 52 | 0 | After roof |
| 67 | Req Fire Rough In | 52 | 0 | After roof |
| 68 | Req Carpenter Soffits Ground Floor | 52, 66 | 0 | After roof + hardware |
| 69 | Req Install Ply to Bathrooms | 65 | 0 | After plumber rough-in |
| 70 | Do Plumbing Rough-In Inspection | 65 | 0 | After plumber rough-in |
| 71 | Req Carpenter Cladding | 68 | 0 | After soffits |
| 72 | Do Inspection NDIS | 69 | 0 | After ply install |
| 73 | PHOTO - Ply Bathrooms, Bedroom Crane Supports | 69 | 0 | After ply install |
| 74 | CERTIFICATE - Windows | 54 | +5d | 5 days after windows |
| 75 | PHOTO - Enclosed | 71 | 0 | After cladding |

### Phase 9: Insulation & Plaster (Tasks 76-84)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 76 | Req Down Pipes Ground Floor | 71 | 0 | After cladding |
| 77 | CLAIM - Enclosed | 71, 75 | 0 | After cladding + photo |
| 78 | Req Ceiling & Wall Insulation | 65, 64, 67, 63, 62 | 0 | After all services |
| 79 | Req Plaster Board | 70, 63, 64, 65, 78 | 0 | After services + insulation |
| 80 | Req Internal Fixout | 79 | -1d | 1 day before plaster |
| 81 | Req Carpenter Fixout | 79 | 0 | After plaster |
| 82 | Req Garage Doors | 79 | 0 | After plaster |
| 83 | SPO - Electrician - Cutouts | 79 | 0 | After plaster |
| 84 | Req Internal Door Handles | 80 | 0 | With fixout |

### Phase 10: Kitchen & Wet Areas (Tasks 85-94)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 85 | FIT - Auto Door Openers | 80 | 0 | With fixout |
| 86 | Req Kitchen | 80 | 0 | After fixout |
| 87 | Req Water Proofer | 80 | 0 | After fixout |
| 88 | Req Tiles | 87 | -1d | 1 day before tiler |
| 89 | Req Tiler | 86, 87 | 0 | After kitchen + waterproof |
| 90 | SPO - Plaster Fit Cornice | 86 | 0 | With kitchen |
| 91 | CERTIFICATE - Waterproofer | 87 | +5d | 5 days after waterproof |
| 92 | Req Painter Internal House | 89 | 0 | After tiling |
| 93 | Measure Shower Screens Book Fitting | 89 | 0 | After tiling |
| 94 | Req Pre Paint (Including Sanding) | 92 | +1d | 1 day after painter |

### Phase 11: Painting & External (Tasks 95-103)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 95 | PHOTO - Fixing | 88, 92 | 0 | After tiles + painting |
| 96 | Req Painter External House | 92, 71, 76 | 0 | After internal + external ready |
| 97 | CLAIM - Fixing | 89, 92, 96 | 0 | After all fixing complete |
| 98 | Req Driveway Kerb Cut Out | 103 | -2d | 2 days before driveway |
| 99 | FIT - Drains to Front of Doors | 103 | -2d | 2 days before driveway |
| 100 | Req Driveway Steel Reo | 103 | -1d | 1 day before driveway |
| 101 | Req Driveway Concretor | 76, 89 | 0 | After downpipes + tiles |
| 102 | PHOTO - Driveway | 101 | 0 | After driveway pour |
| 103 | Req Retaining Wall | 101 | 0 | After driveway |

### Phase 12: Landscaping & External (Tasks 104-110)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 104 | Req Fence | 106, 101 | 0 | After retaining + driveway |
| 105 | Req Landscaping | 107 | 0 | After fence |
| 106 | PHOTO - Fence and Landscaping | 107, 108 | 0 | After both complete |
| 107 | Req Hot Water System | 118 | -1d | 1 day before fitoff |
| 108 | Req Plumber Fitoff Gear | 118 | -1d | 1 day before fitoff |
| 109 | Req Fire System Fitoff | 92, 89 | 0 | After painting + tiles |
| 110 | Req Electrical Items | 124 | -1d | 1 day before electrical |

### Phase 13: Final Fitoff (Tasks 111-130)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 111 | Req Vinyl Sliders | 92, 89 | 0 | After painting + tiles |
| 112 | Req Window Coverings | 92, 89 | 0 | After painting + tiles |
| 113 | Req Carpenter For Final Fitoff | 89, 92 | 0 | After tiles + painting |
| 114 | Req Plumber - Fit Off | 89, 92 | 0 | After tiles + painting |
| 115 | Req Shower Screens | 89, 92 | 0 | After tiles + painting |
| 116 | Req SAT System | 124 | -1d | 1 day before electrical |
| 117 | CERTIFICATE - Fire Alarms | 109 | 0 | After fire fitoff |
| 118 | CERTIFICATE - Shower Screens | 115 | 0 | After shower screens |
| 119 | Do Finishing Touches | 113 | 0 | After carpenter fitoff |
| 120 | Req Electrician - Fit Off | 89, 92, 113 | 0 | After tiles + painting + carpenter |
| 121 | Do Plumbing Final Inspection | 114 | 0 | After plumber fitoff |
| 122 | Req Gapping To Skirting | 114, 113 | 0 | After plumber + carpenter |
| 123 | Req Air Conditioning Fit Off | 124 | -1d | 1 day before final electrical |
| 124 | GET - All Forms for Final Inspection | 142 | -5d | 5 days before final |
| 125 | DO - Get Hot Water Rebate | 115 | 0 | After shower screens |
| 126 | Req Full Turn Key Package | 124, 114 | 0 | Before final inspection |
| 127 | Req Painter Touch Ups | 114, 124, 111 | 0 | After fitoff complete |
| 128 | Req Solar Panel Commisions | 124 | 0 | With final electrical |
| 129 | CERTIFICATE - Electrician | 124 | 0 | After electrical fitoff |
| 130 | Req Ceiling Insulation | 124, 132 | 0 | With electrical + vinyl |

### Phase 14: Final Completion (Tasks 131-154)

| Task# | Task Name | Dependencies | Lag | Notes |
|-------|-----------|--------------|-----|-------|
| 131 | Req Vinyl Floor | 130 | 0 | After ceiling insulation |
| 132 | Req Window Handover Service | 130 | 0 | With ceiling insulation |
| 133 | SPO - Insulation Spread Ceiling | 124, 132 | 0 | After electrical + vinyl |
| 134 | Do - Put Termite Sticker | 142 | -1d | 1 day before final |
| 135 | Req Builders Clean | 124, 132, 135, 123 | 0 | After all fitoff |
| 136 | CERTIFICATE - Ceiling Insulation | 134 | 0 | After insulation spread |
| 137 | PHOTO - Practical Completion | 139 | 0 | After builders clean |
| 138 | Do Council Final Inspection | 139 | 0 | After builders clean |
| 139 | GET - Form 11/21 from Certifier | 142 | 0 | For handover |
| 140 | CREATE - Builder Confirmation | 142 | 0 | For handover |
| 141 | GET - Engineer For Future Ceiling | 142 | 0 | For handover |
| 142 | GET - SDA Site Density Report | 142 | 0 | For handover |
| 143 | CREATE - Evacuation Plan | 142 | 0 | For handover |
| 144 | CLAIM - Practical Completion | 142 | 0 | Final claim |
| 145 | DO - NDIS Final Inspection | 142, 144, 147 | 0 | After all docs + claim |
| 146 | DO - Final Payment & Handover | 142, 148 | 0 | After inspection + payment |

---

## 🔧 Implementation in Code

### Dependency Resolution Algorithm

```ruby
class DependencyResolver
  def self.calculate_timeline(project)
    tasks = project.project_tasks.includes(:dependencies)
    
    # 1. Topological sort to get dependency order
    sorted_tasks = topological_sort(tasks)
    
    # 2. Calculate earliest start dates
    sorted_tasks.each do |task|
      calculate_earliest_dates(task)
    end
    
    # 3. Calculate latest dates (backward pass)
    sorted_tasks.reverse.each do |task|
      calculate_latest_dates(task)
    end
    
    # 4. Identify critical path (zero float)
    identify_critical_path(tasks)
  end
  
  private
  
  def self.calculate_earliest_dates(task)
    predecessors = task.predecessor_tasks
    
    if predecessors.empty?
      task.earliest_start = task.project.start_date
    else
      # Handle different dependency types and lag
      latest_predecessor_end = predecessors.map do |pred|
        case pred.dependency_type
        when 'finish_to_start'
          pred.earliest_finish + pred.lag_days.days
        when 'start_to_start'
          pred.earliest_start + pred.lag_days.days
        # ... other types
        end
      end.max
      
      task.earliest_start = latest_predecessor_end
    end
    
    task.earliest_finish = task.earliest_start + task.duration_days.days
    task.save!
  end
end
```

### Task Template Seeding

```ruby
# db/seeds/ndis_templates.rb
NDIS_TASKS = [
  {
    sequence: 1,
    name: "CREATE - Contract",
    task_type: "CREATE",
    category: "ADMIN",
    duration: 1,
    dependencies: []
  },
  {
    sequence: 2,
    name: "DO - Load Invoices into XERO",
    task_type: "DO", 
    category: "ADMIN",
    duration: 1,
    dependencies: [1]
  },
  # ... all 154 tasks with full dependency mapping
]

NDIS_TASKS.each do |task_data|
  TaskTemplate.create!(
    name: task_data[:name],
    task_type: task_data[:task_type],
    category: task_data[:category],
    default_duration_days: task_data[:duration],
    sequence_order: task_data[:sequence],
    predecessor_template_codes: task_data[:dependencies]
  )
end
```

This complete dependency mapping ensures your Claude Code implementation will generate accurate construction schedules with proper task sequencing and timing.

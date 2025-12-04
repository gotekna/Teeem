# Master Schedule - Claude Code Implementation Steps

**Project:** TEEEM Master Schedule  
**Approach:** Step-by-step implementation guide  
**Timeline:** 7-9 weeks for small team  
**Date:** November 4, 2025  

---

## 🎯 Implementation Overview

### What We're Building
Auto-generate construction schedules from Purchase Orders using the NDIS template with 154 tasks and complex dependencies. Real-time collaboration for 5 internal users managing max 8 projects.

### Key Requirements
- **Small Team:** 5 internal users, no supplier login needed
- **Scale:** Max 8 concurrent projects
- **Real-time:** WebSocket updates for collaboration
- **Web-first:** Responsive design, mobile later
- **Dependencies:** Full NDIS construction sequence with lag/lead times

---

## 📋 Step-by-Step Implementation

### Step 1: Database Schema & Models (Week 1)

#### 1.1 Create Migration Files
```bash
rails generate migration CreateProjects
rails generate migration CreateTaskTemplates  
rails generate migration CreateProjectTasks
rails generate migration CreateTaskDependencies
rails generate migration CreateTaskUpdates
rails generate migration AddScheduleFieldsToPurchaseOrders
```

#### 1.2 Database Schema Implementation

**Projects Table:**
```ruby
# db/migrate/xxx_create_projects.rb
class CreateProjects < ActiveRecord::Migration[8.0]
  def change
    create_table :projects do |t|
      t.string :name, null: false
      t.string :project_code, index: { unique: true }
      t.text :description
      t.date :start_date
      t.date :planned_end_date
      t.date :actual_end_date
      t.string :status, default: 'planning'
      t.string :client_name
      t.text :site_address
      t.references :project_manager, null: false, foreign_key: { to_table: :users }
      
      t.timestamps
    end
    
    add_index :projects, :status
    add_index :projects, [:start_date, :planned_end_date]
  end
end
```

**Task Templates Table:**
```ruby
# db/migrate/xxx_create_task_templates.rb
class CreateTaskTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :task_templates do |t|
      t.string :name, null: false
      t.string :task_type, null: false # ORDER, DO, GET, CLAIM, etc.
      t.string :category, null: false # ADMIN, CARPENTER, ELECTRICAL, etc.
      t.integer :default_duration_days, default: 1
      t.integer :sequence_order, default: 0
      t.text :predecessor_template_codes, array: true, default: []
      t.text :description
      t.boolean :is_milestone, default: false
      t.boolean :requires_photo, default: false
      t.boolean :is_standard, default: true
      
      t.timestamps
    end
    
    add_index :task_templates, :task_type
    add_index :task_templates, :category
    add_index :task_templates, :sequence_order
  end
end
```

**Project Tasks Table:**
```ruby
# db/migrate/xxx_create_project_tasks.rb
class CreateProjectTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :project_tasks do |t|
      t.references :project, null: false, foreign_key: true
      t.references :task_template, foreign_key: true
      t.references :purchase_order, foreign_key: true
      
      t.string :name, null: false
      t.string :task_type, null: false
      t.string :category, null: false
      t.string :task_code # For dependency references
      
      t.string :status, default: 'not_started'
      t.integer :progress_percentage, default: 0
      
      t.date :planned_start_date
      t.date :planned_end_date
      t.date :actual_start_date
      t.date :actual_end_date
      t.integer :duration_days, default: 1
      
      t.references :assigned_to, foreign_key: { to_table: :users }
      t.string :supplier_name
      
      t.boolean :is_milestone, default: false
      t.boolean :is_critical_path, default: false
      
      t.text :notes
      t.text :completion_notes
      
      t.timestamps
    end
    
    add_index :project_tasks, [:project_id, :status]
    add_index :project_tasks, [:planned_start_date, :planned_end_date]
    add_index :project_tasks, :is_critical_path
  end
end
```

**Task Dependencies Table:**
```ruby
# db/migrate/xxx_create_task_dependencies.rb
class CreateTaskDependencies < ActiveRecord::Migration[8.0]
  def change
    create_table :task_dependencies do |t|
      t.references :successor_task, null: false, foreign_key: { to_table: :project_tasks }
      t.references :predecessor_task, null: false, foreign_key: { to_table: :project_tasks }
      t.string :dependency_type, default: 'finish_to_start'
      t.integer :lag_days, default: 0
      
      t.timestamps
    end
    
    add_index :task_dependencies, :successor_task_id
    add_index :task_dependencies, :predecessor_task_id
    add_index :task_dependencies, [:successor_task_id, :predecessor_task_id], 
              name: 'index_unique_task_dependency', unique: true
  end
end
```

**Purchase Orders Enhancement:**
```ruby
# db/migrate/xxx_add_schedule_fields_to_purchase_orders.rb
class AddScheduleFieldsToPurchaseOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :purchase_orders, :required_on_site_date, :date
    add_column :purchase_orders, :creates_schedule_tasks, :boolean, default: true
    add_column :purchase_orders, :task_category, :string
    add_column :purchase_orders, :supplier_name, :string
    
    add_index :purchase_orders, :required_on_site_date
    add_index :purchase_orders, :creates_schedule_tasks
  end
end
```

#### 1.3 Model Implementation

**Project Model:**
```ruby
# app/models/project.rb
class Project < ApplicationRecord
  belongs_to :project_manager, class_name: 'User'
  has_many :project_tasks, dependent: :destroy
  has_many :purchase_orders # Existing relationship
  
  validates :name, presence: true
  validates :project_code, presence: true, uniqueness: true
  validates :status, inclusion: { in: %w[planning active complete on_hold] }
  
  scope :active, -> { where(status: ['planning', 'active']) }
  
  def progress_percentage
    return 0 if project_tasks.empty?
    
    Rails.cache.fetch("project:#{id}:progress", expires_in: 5.minutes) do
      (project_tasks.sum(:progress_percentage) / project_tasks.count.to_f).round
    end
  end
  
  def days_remaining
    return nil unless planned_end_date
    (planned_end_date - Date.current).to_i
  end
  
  def on_schedule?
    return true unless planned_end_date
    critical_path_end = project_tasks.where(is_critical_path: true)
                                   .maximum(:planned_end_date)
    critical_path_end.nil? || critical_path_end <= planned_end_date
  end
end
```

**Task Template Model:**
```ruby
# app/models/task_template.rb
class TaskTemplate < ApplicationRecord
  validates :name, presence: true
  validates :task_type, presence: true
  validates :category, presence: true
  validates :default_duration_days, presence: true, numericality: { greater_than: 0 }
  
  scope :standard, -> { where(is_standard: true) }
  scope :by_sequence, -> { order(:sequence_order, :id) }
  scope :by_category, ->(category) { where(category: category) }
  
  def predecessor_templates
    return [] if predecessor_template_codes.blank?
    
    TaskTemplate.where(sequence_order: predecessor_template_codes)
  end
end
```

**Project Task Model:**
```ruby
# app/models/project_task.rb
class ProjectTask < ApplicationRecord
  belongs_to :project
  belongs_to :task_template, optional: true
  belongs_to :purchase_order, optional: true
  belongs_to :assigned_to, class_name: 'User', optional: true
  
  has_many :successor_dependencies, class_name: 'TaskDependency', 
           foreign_key: 'predecessor_task_id', dependent: :destroy
  has_many :predecessor_dependencies, class_name: 'TaskDependency', 
           foreign_key: 'successor_task_id', dependent: :destroy
  
  has_many :successor_tasks, through: :successor_dependencies
  has_many :predecessor_tasks, through: :predecessor_dependencies
  
  has_many :task_updates, dependent: :destroy
  
  validates :name, presence: true
  validates :status, inclusion: { in: %w[not_started in_progress complete on_hold] }
  validates :progress_percentage, inclusion: { in: 0..100 }
  validates :duration_days, presence: true, numericality: { greater_than: 0 }
  
  scope :by_status, ->(status) { where(status: status) }
  scope :critical_path, -> { where(is_critical_path: true) }
  scope :overdue, -> { where('planned_end_date < ? AND status != ?', Date.current, 'complete') }
  scope :upcoming, -> { where('planned_start_date <= ? AND status = ?', 1.week.from_now, 'not_started') }
  
  before_save :update_actual_dates
  
  private
  
  def update_actual_dates
    case status
    when 'in_progress'
      self.actual_start_date ||= Date.current
    when 'complete'
      self.actual_start_date ||= Date.current
      self.actual_end_date = Date.current
      self.progress_percentage = 100
    end
  end
end
```

**Task Dependency Model:**
```ruby
# app/models/task_dependency.rb
class TaskDependency < ApplicationRecord
  belongs_to :successor_task, class_name: 'ProjectTask'
  belongs_to :predecessor_task, class_name: 'ProjectTask'
  
  validates :dependency_type, inclusion: { 
    in: %w[finish_to_start start_to_start finish_to_finish start_to_finish] 
  }
  validates :successor_task_id, uniqueness: { scope: :predecessor_task_id }
  
  validate :no_circular_dependencies
  validate :same_project_tasks
  
  private
  
  def no_circular_dependencies
    return unless successor_task && predecessor_task
    
    if creates_circular_dependency?
      errors.add(:base, 'Cannot create circular dependency')
    end
  end
  
  def same_project_tasks
    return unless successor_task && predecessor_task
    
    if successor_task.project_id != predecessor_task.project_id
      errors.add(:base, 'Tasks must be in the same project')
    end
  end
  
  def creates_circular_dependency?
    # Simple check - more sophisticated algorithm needed for production
    successor_task.id == predecessor_task.id ||
    successor_task.predecessor_tasks.include?(predecessor_task)
  end
end
```

---

### Step 2: NDIS Template Seeding (Week 1)

#### 2.1 Create Seed Data File

```ruby
# db/seeds/ndis_task_templates.rb
class NdisTaskTemplateSeeder
  NDIS_TASKS = [
    { seq: 1, name: "CREATE - Contract", type: "CREATE", category: "ADMIN", duration: 1, deps: [] },
    { seq: 2, name: "DO - Load Invoices into XERO", type: "DO", category: "ADMIN", duration: 1, deps: [1] },
    { seq: 3, name: "GET - Finance Approval", type: "GET", category: "ADMIN", duration: 21, deps: [1] },
    { seq: 4, name: "CLAIM - DEPOSIT", type: "CLAIM", category: "ADMIN", duration: 5, deps: [3] },
    { seq: 5, name: "ORDER - Soil Test and Wind Rating & Slab Design", type: "ORDER", category: "ADMIN", duration: 5, deps: [4] },
    # ... Continue with all 154 tasks from the dependency mapping
    { seq: 154, name: "DO - Final Payment & Handover", type: "DO", category: "ADMIN", duration: 1, deps: [142, 151] }
  ].freeze
  
  def self.seed!
    puts "Seeding NDIS Task Templates..."
    
    NDIS_TASKS.each do |task_data|
      template = TaskTemplate.find_or_create_by(
        sequence_order: task_data[:seq],
        name: task_data[:name]
      ) do |t|
        t.task_type = task_data[:type]
        t.category = task_data[:category]
        t.default_duration_days = task_data[:duration]
        t.predecessor_template_codes = task_data[:deps]
        t.is_standard = true
        t.is_milestone = milestone?(task_data[:name])
        t.requires_photo = photo_required?(task_data[:name])
      end
      
      print "."
    end
    
    puts "\nSeeded #{NDIS_TASKS.count} NDIS task templates"
  end
  
  private
  
  def self.milestone?(name)
    name.include?('CLAIM') || name.include?('CERTIFICATE') || name.include?('INSPECTION')
  end
  
  def self.photo_required?(name)
    name.include?('PHOTO') || name.include?('INSPECTION')
  end
end

# Add to db/seeds.rb
NdisTaskTemplateSeeder.seed!
```

#### 2.2 Run Seeding

```bash
rails db:seed
```

---

### Step 3: Core Services (Week 2)

#### 3.1 Schedule Generator Service

```ruby
# app/services/schedule/generator_service.rb
module Schedule
  class GeneratorService
    def initialize(project, purchase_orders = [])
      @project = project
      @purchase_orders = purchase_orders.select(&:creates_schedule_tasks?)
    end
    
    def generate!
      ActiveRecord::Base.transaction do
        clear_existing_tasks
        create_tasks_from_templates
        create_tasks_from_purchase_orders
        establish_dependencies
        calculate_timeline
        identify_critical_path
      end
      
      Result.new(success: true, project: @project.reload)
    rescue => error
      Result.new(success: false, errors: [error.message])
    end
    
    private
    
    def clear_existing_tasks
      @project.project_tasks.destroy_all
    end
    
    def create_tasks_from_templates
      TaskTemplate.standard.by_sequence.each do |template|
        next if skip_template?(template)
        
        ProjectTask.create!(
          project: @project,
          task_template: template,
          name: template.name,
          task_type: template.task_type,
          category: template.category,
          task_code: "TASK_#{template.sequence_order}",
          duration_days: template.default_duration_days,
          is_milestone: template.is_milestone,
          requires_photo: template.requires_photo
        )
      end
    end
    
    def create_tasks_from_purchase_orders
      @purchase_orders.each do |po|
        # Find or create task for this PO
        template = find_template_for_po(po)
        next unless template
        
        task = @project.project_tasks.find_by(task_template: template)
        if task
          # Update existing template task with PO details
          task.update!(
            purchase_order: po,
            supplier_name: po.supplier_name,
            planned_start_date: po.required_on_site_date,
            notes: "Generated from PO ##{po.id}"
          )
        else
          # Create new task for PO
          ProjectTask.create!(
            project: @project,
            purchase_order: po,
            name: "ORDER - #{po.description}",
            task_type: "ORDER",
            category: po.task_category || "MATERIALS",
            supplier_name: po.supplier_name,
            duration_days: 1,
            planned_start_date: po.required_on_site_date
          )
        end
      end
    end
    
    def establish_dependencies
      DependencyService.new(@project).establish_from_templates!
    end
    
    def calculate_timeline
      TimelineService.new(@project).calculate!
    end
    
    def identify_critical_path
      CriticalPathService.new(@project).calculate!
    end
    
    def skip_template?(template)
      # Skip if no materials/services needed for this project type
      false # For now, include all tasks
    end
    
    def find_template_for_po(po)
      # Map PO categories to task templates
      category_mapping = {
        'ELECTRICAL' => 'ORDER - Electrical Items',
        'PLUMBING' => 'ORDER - Plumbing Items',
        'FRAMING' => 'ORDER - Frame',
        'ROOFING' => 'ORDER - Roof'
      }
      
      template_name = category_mapping[po.task_category]
      TaskTemplate.find_by(name: template_name) if template_name
    end
  end
  
  class Result
    attr_reader :success, :errors, :project
    
    def initialize(success:, errors: [], project: nil)
      @success = success
      @errors = errors
      @project = project
    end
    
    def success?
      @success
    end
  end
end
```

#### 3.2 Dependency Service

```ruby
# app/services/schedule/dependency_service.rb
module Schedule
  class DependencyService
    def initialize(project)
      @project = project
    end
    
    def establish_from_templates!
      tasks_by_sequence = @project.project_tasks
                                 .joins(:task_template)
                                 .index_by { |task| task.task_template.sequence_order }
      
      @project.project_tasks.joins(:task_template).each do |task|
        template = task.task_template
        next if template.predecessor_template_codes.blank?
        
        template.predecessor_template_codes.each do |predecessor_seq|
          predecessor_task = tasks_by_sequence[predecessor_seq.to_i]
          next unless predecessor_task
          
          create_dependency(predecessor_task, task)
        end
      end
    end
    
    private
    
    def create_dependency(predecessor, successor)
      TaskDependency.find_or_create_by(
        predecessor_task: predecessor,
        successor_task: successor
      ) do |dep|
        dep.dependency_type = 'finish_to_start'
        dep.lag_days = calculate_lag(predecessor, successor)
      end
    end
    
    def calculate_lag(predecessor, successor)
      # Extract lag from task names or use defaults
      case 
      when successor.name.include?('CERTIFICATE')
        # Certificates typically issued 5-10 days after work
        successor.name.include?('Slab') ? 10 : 5
      when successor.name.include?('INSPECTION')
        # Inspections happen shortly after work
        2
      when predecessor.name.include?('ORDER') && successor.name.include?('Req')
        # Materials ordered 1 day before needed
        -1
      else
        0
      end
    end
  end
end
```

#### 3.3 Timeline Calculation Service

```ruby
# app/services/schedule/timeline_service.rb
module Schedule
  class TimelineService
    def initialize(project)
      @project = project
    end
    
    def calculate!
      # Forward pass - calculate earliest dates
      calculate_forward_pass
      
      # Backward pass - calculate latest dates
      calculate_backward_pass
      
      # Update project end date
      update_project_end_date
    end
    
    private
    
    def calculate_forward_pass
      sorted_tasks = topological_sort(@project.project_tasks.includes(:predecessor_dependencies))
      
      sorted_tasks.each do |task|
        predecessors = task.predecessor_tasks.includes(:successor_dependencies)
        
        if predecessors.empty?
          # Start task - use project start date or PO required date
          task.planned_start_date = task.purchase_order&.required_on_site_date || 
                                   @project.start_date || 
                                   Date.current
        else
          # Calculate based on predecessors
          latest_predecessor_end = predecessors.map do |pred|
            dependency = pred.successor_dependencies.find_by(successor_task: task)
            calculate_successor_start_date(pred, dependency)
          end.max
          
          task.planned_start_date = latest_predecessor_end
        end
        
        task.planned_end_date = task.planned_start_date + (task.duration_days - 1).days
        task.save!
      end
    end
    
    def calculate_backward_pass
      project_end = @project.project_tasks.maximum(:planned_end_date)
      @project.update!(planned_end_date: project_end)
      
      # For now, skip backward pass - can add later for optimization
    end
    
    def calculate_successor_start_date(predecessor, dependency)
      case dependency.dependency_type
      when 'finish_to_start'
        predecessor.planned_end_date + (dependency.lag_days + 1).days
      when 'start_to_start'
        predecessor.planned_start_date + dependency.lag_days.days
      else
        predecessor.planned_end_date + 1.day
      end
    end
    
    def topological_sort(tasks)
      # Simple topological sort
      sorted = []
      temp_mark = Set.new
      perm_mark = Set.new
      
      tasks.each do |task|
        visit(task, sorted, temp_mark, perm_mark) unless perm_mark.include?(task.id)
      end
      
      sorted.reverse
    end
    
    def visit(task, sorted, temp_mark, perm_mark)
      return if perm_mark.include?(task.id)
      
      if temp_mark.include?(task.id)
        raise "Circular dependency detected"
      end
      
      temp_mark.add(task.id)
      
      task.predecessor_tasks.each do |pred|
        visit(pred, sorted, temp_mark, perm_mark)
      end
      
      temp_mark.delete(task.id)
      perm_mark.add(task.id)
      sorted << task
    end
    
    def update_project_end_date
      latest_end = @project.project_tasks.maximum(:planned_end_date)
      @project.update!(planned_end_date: latest_end) if latest_end
    end
  end
end
```

#### 3.4 Critical Path Service

```ruby
# app/services/schedule/critical_path_service.rb
module Schedule
  class CriticalPathService
    def initialize(project)
      @project = project
    end
    
    def calculate!
      # Reset all critical path flags
      @project.project_tasks.update_all(is_critical_path: false)
      
      # Find the longest path through the network
      end_tasks = @project.project_tasks.joins(:successor_dependencies)
                         .where(task_dependencies: { id: nil })
      
      if end_tasks.empty?
        end_tasks = [@project.project_tasks.order(:planned_end_date).last]
      end
      
      end_tasks.each do |end_task|
        mark_critical_path(end_task)
      end
    end
    
    private
    
    def mark_critical_path(task)
      return if task.nil? || task.is_critical_path?
      
      task.update!(is_critical_path: true)
      
      # Find the predecessor that determines this task's start date
      critical_predecessor = task.predecessor_tasks.min_by do |pred|
        dependency = pred.successor_dependencies.find_by(successor_task: task)
        calculate_successor_start_date(pred, dependency)
      end
      
      mark_critical_path(critical_predecessor) if critical_predecessor
    end
    
    def calculate_successor_start_date(predecessor, dependency)
      case dependency.dependency_type
      when 'finish_to_start'
        predecessor.planned_end_date + (dependency.lag_days + 1).days
      when 'start_to_start'
        predecessor.planned_start_date + dependency.lag_days.days
      else
        predecessor.planned_end_date + 1.day
      end
    end
  end
end
```

---

### Step 4: API Controllers (Week 3)

#### 4.1 Projects Controller

```ruby
# app/controllers/api/v1/projects_controller.rb
class Api::V1::ProjectsController < ApplicationController
  before_action :set_project, only: [:show, :update, :destroy, :generate_schedule]
  
  def index
    @projects = Project.includes(:project_manager, :project_tasks)
                      .order(:created_at)
                      .limit(10) # Max 8 + some buffer
    
    render json: {
      projects: @projects.map { |project| serialize_project_summary(project) }
    }
  end
  
  def show
    render json: serialize_project_detail(@project)
  end
  
  def create
    @project = Project.new(project_params)
    @project.project_manager = current_user
    
    if @project.save
      render json: serialize_project_detail(@project), status: :created
    else
      render json: { errors: @project.errors }, status: :unprocessable_entity
    end
  end
  
  def generate_schedule
    purchase_orders = @project.purchase_orders.where(creates_schedule_tasks: true)
    
    result = Schedule::GeneratorService.new(@project, purchase_orders).generate!
    
    if result.success?
      render json: {
        success: true,
        message: 'Schedule generated successfully',
        project: serialize_project_detail(result.project)
      }
    else
      render json: { 
        success: false, 
        errors: result.errors 
      }, status: :unprocessable_entity
    end
  end
  
  private
  
  def set_project
    @project = Project.find(params[:id])
  end
  
  def project_params
    params.require(:project).permit(
      :name, :project_code, :description, :start_date, 
      :client_name, :site_address
    )
  end
  
  def serialize_project_summary(project)
    {
      id: project.id,
      name: project.name,
      project_code: project.project_code,
      status: project.status,
      progress_percentage: project.progress_percentage,
      start_date: project.start_date,
      planned_end_date: project.planned_end_date,
      days_remaining: project.days_remaining,
      on_schedule: project.on_schedule?,
      task_counts: {
        total: project.project_tasks.count,
        completed: project.project_tasks.where(status: 'complete').count,
        overdue: project.project_tasks.overdue.count
      }
    }
  end
  
  def serialize_project_detail(project)
    serialize_project_summary(project).merge(
      description: project.description,
      client_name: project.client_name,
      site_address: project.site_address,
      project_manager: {
        id: project.project_manager.id,
        name: project.project_manager.name
      }
    )
  end
end
```

#### 4.2 Project Tasks Controller

```ruby
# app/controllers/api/v1/project_tasks_controller.rb
class Api::V1::ProjectTasksController < ApplicationController
  before_action :set_project
  before_action :set_task, only: [:show, :update, :update_status]
  
  def index
    @tasks = @project.project_tasks.includes(:assigned_to, :purchase_order)
    
    # Apply filters
    @tasks = @tasks.where(status: params[:status]) if params[:status].present?
    @tasks = @tasks.where(category: params[:category]) if params[:category].present?
    @tasks = @tasks.where(is_critical_path: true) if params[:critical_path] == 'true'
    
    render json: {
      tasks: @tasks.map { |task| serialize_task(task) }
    }
  end
  
  def show
    render json: serialize_task_detail(@task)
  end
  
  def update_status
    result = Tasks::UpdateService.new(@task, current_user).update_status!(
      status: params[:status],
      progress: params[:progress],
      notes: params[:notes]
    )
    
    if result.success?
      # Broadcast real-time update
      ActionCable.server.broadcast(
        "schedule_project_#{@project.id}",
        {
          type: 'task_status_updated',
          task: serialize_task(@task.reload),
          updated_by: current_user.name
        }
      )
      
      render json: {
        success: true,
        task: serialize_task_detail(@task)
      }
    else
      render json: { 
        success: false,
        errors: result.errors 
      }, status: :unprocessable_entity
    end
  end
  
  private
  
  def set_project
    @project = Project.find(params[:project_id])
  end
  
  def set_task
    @task = @project.project_tasks.find(params[:id])
  end
  
  def serialize_task(task)
    {
      id: task.id,
      name: task.name,
      status: task.status,
      progress_percentage: task.progress_percentage,
      planned_start_date: task.planned_start_date,
      planned_end_date: task.planned_end_date,
      duration_days: task.duration_days,
      category: task.category,
      task_type: task.task_type,
      is_milestone: task.is_milestone,
      is_critical_path: task.is_critical_path,
      supplier_name: task.supplier_name,
      assigned_to: task.assigned_to&.name
    }
  end
  
  def serialize_task_detail(task)
    serialize_task(task).merge(
      description: task.notes,
      actual_start_date: task.actual_start_date,
      actual_end_date: task.actual_end_date,
      completion_notes: task.completion_notes,
      purchase_order: task.purchase_order ? {
        id: task.purchase_order.id,
        description: task.purchase_order.description
      } : nil,
      dependencies: {
        predecessors: task.predecessor_tasks.map { |t| { id: t.id, name: t.name } },
        successors: task.successor_tasks.map { |t| { id: t.id, name: t.name } }
      }
    )
  end
end
```

Continue to Week 4-7 implementation steps in the next response...

This gives you a solid foundation for the first 3 weeks of implementation. Would you like me to continue with the remaining steps (Frontend React components, Real-time ActionCable, and Testing)?

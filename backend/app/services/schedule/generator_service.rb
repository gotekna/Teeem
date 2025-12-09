# frozen_string_literal: true

module Schedule
  # Generates a complete construction schedule from purchase orders
  # Maps POs to NDIS task templates and creates project tasks with dependencies
  class GeneratorService
    attr_reader :project, :errors

    def initialize(project)
      @project = project
      @errors = []
    end

    # Main entry point - generates complete schedule
    # Returns true if successful, false otherwise
    def generate!
      validate_project!

      ActiveRecord::Base.transaction do
        # Step 1: Instantiate all NDIS task templates as project tasks
        create_project_tasks_from_templates

        # Step 2: Map purchase orders to specific tasks
        map_purchase_orders_to_tasks

        # Step 3: Establish task dependencies
        create_task_dependencies

        # Step 4: Calculate timeline (forward pass)
        calculate_timeline

        # Step 5: Identify critical path
        identify_critical_path

        # Step 6: Update project status
        @project.update!(
          status: "active",
          generated_at: Time.current
        )
      end

      true
    rescue StandardError => e
      @errors << e.message
      Rails.logger.error("Schedule generation failed: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      false
    end

    private

    def validate_project!
      raise "Project must have a construction" unless @project.construction.present?
      raise "Project must have purchase orders" if @project.purchase_orders.empty?
      raise "No NDIS templates found" if TaskTemplate.count.zero?
    end

    # Creates project task instances from all NDIS templates
    def create_project_tasks_from_templates
      Rails.logger.info("Creating #{TaskTemplate.count} project tasks from templates...")

      TaskTemplate.order(:sequence_order).find_each do |template|
        @project.project_tasks.create!(
          name: template.name,
          task_template: template,
          task_type: template.task_type,
          category: template.category,
          duration_days: template.default_duration_days,
          status: "not_started",
          sequence_order: template.sequence_order
        )
      end

      Rails.logger.info("✓ Created #{@project.project_tasks.count} project tasks")
    end

    # Maps purchase orders to tasks based on category and task type
    def map_purchase_orders_to_tasks
      Rails.logger.info("Mapping #{@project.purchase_orders.for_schedule.count} purchase orders to tasks...")

      mapped_count = 0

      @project.purchase_orders.for_schedule.each do |po|
        # Find matching task based on PO category
        matching_tasks = find_matching_tasks_for_po(po)

        if matching_tasks.any?
          # Link PO to the first matching task
          task = matching_tasks.first
          task.update!(
            purchase_order: po,
            required_on_site_date: po.required_on_site_date
          )
          mapped_count += 1
        else
          Rails.logger.warn("No matching task found for PO #{po.purchase_order_number} (#{po.task_category})")
        end
      end

      Rails.logger.info("✓ Mapped #{mapped_count} purchase orders to tasks")
    end

    # Finds tasks that match a purchase order's category
    def find_matching_tasks_for_po(po)
      # Map PO categories to task categories and types
      category_mapping = {
        "CONCRETE" => { categories: [ "CONCRETE" ], types: [ "DO", "ORDER" ] },
        "CARPENTER" => { categories: [ "CARPENTER" ], types: [ "DO", "ORDER" ] },
        "PLUMBER" => { categories: [ "PLUMBER" ], types: [ "DO", "ORDER" ] },
        "ELECTRICAL" => { categories: [ "ELECTRICAL" ], types: [ "DO", "ORDER" ] },
        "PAINTER" => { categories: [ "PAINTER" ], types: [ "DO", "ORDER" ] },
        "PLASTERER" => { categories: [ "PLASTERER" ], types: [ "DO", "ORDER" ] },
        "TILER" => { categories: [ "TILER" ], types: [ "DO", "ORDER" ] },
        "ROOFING" => { categories: [ "ROOFING" ], types: [ "DO", "ORDER" ] },
        "KITCHEN" => { categories: [ "KITCHEN" ], types: [ "DO", "ORDER" ] },
        "MATERIALS" => { categories: [ "MATERIALS" ], types: [ "ORDER" ] },
        "SURVEYOR" => { categories: [ "SURVEYOR" ], types: [ "DO", "ORDER" ] },
        "SITE_PREP" => { categories: [ "SITE_PREP" ], types: [ "DO" ] },
        "TERMITE" => { categories: [ "TERMITE" ], types: [ "DO" ] },
        "WATERPROOF" => { categories: [ "WATERPROOF" ], types: [ "DO" ] },
        "AIRCON" => { categories: [ "AIRCON" ], types: [ "DO" ] },
        "FENCING" => { categories: [ "FENCING" ], types: [ "DO" ] },
        "LANDSCAPING" => { categories: [ "LANDSCAPING" ], types: [ "DO" ] },
        "CLEANING" => { categories: [ "CLEANING" ], types: [ "DO" ] },
        "ADMIN" => { categories: [ "ADMIN" ], types: [ "DO", "GET", "CREATE", "CHECK" ] }
      }

      mapping = category_mapping[po.task_category] || { categories: [ po.task_category ], types: [ "DO", "ORDER" ] }

      # Find tasks that haven't been mapped yet and match the category/type
      @project.project_tasks
        .where(purchase_order_id: nil)
        .where(category: mapping[:categories])
        .where(task_type: mapping[:types])
        .order(:sequence_order)
    end

    # Creates task dependencies based on template predecessor codes
    def create_task_dependencies
      Rails.logger.info("Creating task dependencies...")

      dependency_count = 0

      @project.project_tasks.includes(:task_template).each do |task|
        next unless task.task_template.present?
        next if task.task_template.predecessor_template_codes.empty?

        # For each predecessor code, find the corresponding task and create dependency
        task.task_template.predecessor_template_codes.each do |pred_code|
          # Note: In NDIS template, sequence numbers are IDs, not execution order
          # Dependencies determine execution order, so we allow "forward references"

          predecessor_task = @project.project_tasks.find_by(sequence_order: pred_code)

          if predecessor_task
            begin
              TaskDependency.create!(
                successor_task: task,
                predecessor_task: predecessor_task,
                dependency_type: "finish_to_start",
                lag_days: 0
              )
              dependency_count += 1
            rescue ActiveRecord::RecordInvalid => e
              Rails.logger.error("Failed to create dependency: Task #{task.sequence_order} → #{pred_code}")
              Rails.logger.error("  Error: #{e.message}")
              raise
            end
          else
            Rails.logger.warn("Predecessor task #{pred_code} not found for task #{task.sequence_order}")
          end
        end
      end

      Rails.logger.info("✓ Created #{dependency_count} task dependencies")
    end

    # Calculates timeline using forward pass algorithm
    def calculate_timeline
      Rails.logger.info("Calculating timeline with forward pass...")

      # Sort tasks in topological order (dependencies first)
      sorted_tasks = topological_sort

      # Calculate earliest start/finish dates
      sorted_tasks.each do |task|
        calculate_earliest_dates(task)
      end

      Rails.logger.info("✓ Timeline calculated")
    end

    # Topological sort of tasks based on dependencies
    def topological_sort
      tasks = @project.project_tasks.includes(:predecessor_tasks, :successor_tasks).to_a
      sorted = []
      visited = Set.new
      temp_mark = Set.new

      # DFS visit function
      visit = lambda do |task|
        return if visited.include?(task.id)
        raise "Circular dependency detected at task #{task.sequence_order}" if temp_mark.include?(task.id)

        temp_mark.add(task.id)

        # Visit all predecessors first
        task.predecessor_tasks.each do |pred|
          visit.call(pred)
        end

        temp_mark.delete(task.id)
        visited.add(task.id)
        sorted << task
      end

      # Visit all tasks
      tasks.each { |task| visit.call(task) unless visited.include?(task.id) }

      sorted
    end

    # Calculates earliest start and finish dates for a task
    def calculate_earliest_dates(task)
      predecessor_deps = task.predecessor_dependencies.includes(:predecessor_task)

      if predecessor_deps.empty?
        # No predecessors - can start at project start date
        # RULE #9.3: Use company timezone, not server timezone
        task.planned_start_date = @project.start_date || CorporateCompanySetting.today
      else
        # Calculate based on predecessors
        earliest_start = predecessor_deps.map do |dep|
          pred = dep.predecessor_task

          # Skip if predecessor doesn't have dates yet
          next unless pred.planned_end_date.present? && pred.planned_start_date.present?

          case dep.dependency_type
          when "finish_to_start"
            # This task starts after predecessor finishes
            pred.planned_end_date + dep.lag_days.days
          when "start_to_start"
            # This task starts relative to when predecessor starts
            pred.planned_start_date + dep.lag_days.days
          when "finish_to_finish"
            # This task finishes when predecessor finishes
            pred.planned_end_date + dep.lag_days.days - task.duration_days.days
          when "start_to_finish"
            # This task finishes when predecessor starts (rare)
            pred.planned_start_date + dep.lag_days.days - task.duration_days.days
          else
            pred.planned_end_date
          end
        end.compact.max

        # RULE #9.3: Use company timezone, not server timezone
        task.planned_start_date = earliest_start || @project.start_date || CorporateCompanySetting.today
      end

      # Calculate end date based on duration
      task.planned_end_date = task.planned_start_date + task.duration_days.days
      task.save!
    rescue StandardError => e
      Rails.logger.error("Failed to calculate dates for task #{task.sequence_order}: #{e.message}")
      raise
    end

    # Identifies critical path tasks (those with zero float)
    def identify_critical_path
      Rails.logger.info("Identifying critical path...")

      # For now, mark all tasks with dependencies as potentially critical
      # Full critical path calculation requires backward pass (latest dates)
      # This is a simplified version - we'll enhance this later

      critical_count = 0
      longest_path_tasks = find_longest_path

      longest_path_tasks.each do |task|
        task.update!(is_critical_path: true)
        critical_count += 1
      end

      Rails.logger.info("✓ Identified #{critical_count} critical path tasks")
    end

    # Finds the longest path through the network (critical path)
    def find_longest_path
      tasks = @project.project_tasks.includes(:predecessor_tasks, :successor_tasks).to_a

      # Calculate longest path to each task
      longest_paths = {}

      # Sort tasks topologically
      sorted_tasks = topological_sort

      sorted_tasks.each do |task|
        predecessors = task.predecessor_tasks

        if predecessors.empty?
          longest_paths[task.id] = task.duration_days
        else
          max_predecessor_path = predecessors.map { |pred| longest_paths[pred.id] || 0 }.max
          longest_paths[task.id] = max_predecessor_path + task.duration_days
        end
      end

      # Find the maximum path length
      max_path_length = longest_paths.values.max

      # Return tasks that are on the longest path
      tasks.select { |task| longest_paths[task.id] == max_path_length }
    end
  end
end

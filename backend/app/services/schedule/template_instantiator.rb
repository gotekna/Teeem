# Service to instantiate a schedule template into project tasks for a job
# This creates all tasks from the template and handles:
# - Task creation with proper sequencing
# - Dependency setup (predecessors)
# - Auto-PO generation for tasks marked with create_po_on_job_start
# - Initial date calculations based on project start date

module Schedule
  class TemplateInstantiator
    attr_reader :project, :template, :errors

    def initialize(project:, template:)
      @project = project
      @template = template
      @errors = []
      @created_tasks = {}  # Maps template_row_id => created ProjectTask
    end

    def call
      ActiveRecord::Base.transaction do
        # Step 1: Create all tasks from template rows
        create_tasks_from_template

        # Step 2: Set up dependencies between tasks
        setup_task_dependencies

        # Step 3: Calculate initial dates using forward pass
        calculate_task_dates

        # Step 4: Create purchase orders for tasks marked for auto-PO
        create_auto_purchase_orders

        # Step 5: Update project dates
        update_project_dates

        return { success: true, tasks: @created_tasks.values }
      end
    rescue StandardError => e
      @errors << e.message
      Rails.logger.error("ScheduleTemplateInstantiator failed: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      { success: false, errors: @errors }
    end

    private

    def create_tasks_from_template
      template_rows = template.schedule_template_rows.in_sequence

      template_rows.each do |row|
        task = create_task_from_row(row)
        @created_tasks[row.id] = task
      end

      Rails.logger.info("Created #{@created_tasks.count} tasks from template #{template.name}")
    end

    def create_task_from_row(row)
      task = ProjectTask.create!(
        project: project,
        schedule_template_row: row,
        name: row.name,
        task_type: determine_task_type(row),
        category: determine_category(row),
        status: "not_started",
        progress_percentage: 0,
        duration_days: 1,  # Default, can be overridden
        sequence_order: row.sequence_order,
        supplier_name: row.supplier&.name,
        tags: row.tag_list,
        critical_po: row.critical_po,
        requires_supervisor_check: row.require_supervisor_check,
        auto_complete_predecessors: row.auto_complete_predecessors,
        notes: build_task_notes(row)
      )

      # Create checklist items from templates if supervisor check is required
      if row.require_supervisor_check && row.supervisor_checklist_template_ids.present?
        create_checklist_items_for_task(task, row)
      end

      task
    end

    def determine_task_type(row)
      # Try to infer task type from tags or supplier
      return "construction" if row.supplier.present?
      return "milestone" if row.tag_list.include?("milestone")
      "general"
    end

    def determine_category(row)
      # Use supplier's trade category or first tag as category
      return row.supplier.trade_categories&.first if row.supplier&.trade_categories&.any?
      row.tag_list.first || "general"
    end

    def build_task_notes(row)
      notes = []
      notes << "Auto-generated from template: #{template.name}"
      notes << "Requires PO" if row.po_required
      notes << "Critical PO" if row.critical_po
      notes << "Photo required" if row.require_photo
      notes << "Certificate required (#{row.cert_lag_days} days after completion)" if row.require_certificate
      notes << "Supervisor check required" if row.require_supervisor_check
      notes << "Auto-complete predecessors enabled" if row.auto_complete_predecessors
      notes << "Has #{row.subtask_count} subtasks" if row.has_subtasks
      notes.join(". ")
    end

    def setup_task_dependencies
      template.schedule_template_rows.each do |row|
        next if row.predecessor_task_ids.empty?

        task = @created_tasks[row.id]
        next unless task

        row.predecessor_task_ids.each do |pred_data|
          create_dependency(task, pred_data)
        end
      end

      Rails.logger.info("Set up dependencies for #{@created_tasks.count} tasks")
    end

    def create_dependency(task, pred_data)
      # pred_data format: { id: 2, type: "FS", lag: 3 }
      # or legacy format: just an integer (template row sequence order)

      if pred_data.is_a?(Hash)
        pred_row_id = pred_data["id"] || pred_data[:id]
        dep_type = pred_data["type"] || pred_data[:type] || "FS"
        lag_days = pred_data["lag"] || pred_data[:lag] || 0
      else
        # Legacy: pred_data is template row id
        pred_row_id = pred_data
        dep_type = "FS"
        lag_days = 0
      end

      predecessor_task = @created_tasks[pred_row_id]
      return unless predecessor_task

      TaskDependency.create!(
        predecessor_task: predecessor_task,
        successor_task: task,
        dependency_type: dep_type,
        lag_days: lag_days
      )
    end

    def calculate_task_dates
      # Use project start date or today if not set
      # RULE #9.3: Use company timezone, not server timezone
      project_start = project.start_date || CorporateCompanySetting.today

      # Forward pass: calculate earliest start/end dates
      @created_tasks.values.sort_by(&:sequence_order).each do |task|
        earliest_start = calculate_earliest_start(task, project_start)

        task.update!(
          planned_start_date: earliest_start,
          planned_end_date: earliest_start + task.duration_days.days
        )
      end

      Rails.logger.info("Calculated dates for all tasks starting from #{project_start}")
    end

    def calculate_earliest_start(task, project_start)
      # If no predecessors, start at project start
      return project_start if task.predecessor_tasks.empty?

      # Calculate based on predecessors
      max_date = project_start

      task.predecessor_dependencies.includes(:predecessor_task).each do |dep|
        pred = dep.predecessor_task
        pred_date = case dep.dependency_type
        when "FS"  # Finish-to-Start
                      pred.planned_end_date
        when "SS"  # Start-to-Start
                      pred.planned_start_date
        when "FF"  # Finish-to-Finish (rare for start calc)
                      pred.planned_end_date - task.duration_days.days
        when "SF"  # Start-to-Finish (rare)
                      pred.planned_start_date
        else
                      pred.planned_end_date
        end

        # Apply lag
        pred_date += dep.lag_days.days if pred_date && dep.lag_days

        max_date = pred_date if pred_date && pred_date > max_date
      end

      max_date
    end

    def create_auto_purchase_orders
      auto_po_tasks = @created_tasks.values.select do |task|
        row = task.schedule_template_row
        row.create_po_on_job_start && row.po_required && row.supplier.present?
      end

      auto_po_tasks.each do |task|
        create_purchase_order_for_task(task)
      end

      Rails.logger.info("Created #{auto_po_tasks.count} auto-generated purchase orders")
    end

    def create_purchase_order_for_task(task)
      row = task.schedule_template_row

      po = PurchaseOrder.create!(
        project: project,
        supplier: row.supplier,
        status: "draft",
        required_on_site_date: task.planned_start_date,
        notes: "Auto-generated for task: #{task.name}",
        critical: row.critical_po
      )

      # Add pricebook items to the PO if specified in template
      if row.price_book_item_ids.any?
        row.price_book_items.each do |item|
          po.purchase_order_items.create!(
            pricebook_item: item,
            quantity: 1,  # Default quantity
            unit_price: item.sell_price || 0,
            description: item.description
          )
        end
      end

      # Link PO to task
      task.update!(purchase_order: po)

      Rails.logger.info("Created PO ##{po.id} for task #{task.name}")
    rescue StandardError => e
      Rails.logger.error("Failed to create PO for task #{task.name}: #{e.message}")
      @errors << "PO creation failed for #{task.name}: #{e.message}"
    end

    def update_project_dates
      earliest_task = @created_tasks.values.min_by(&:planned_start_date)
      latest_task = @created_tasks.values.max_by(&:planned_end_date)

      if earliest_task && latest_task
        project.update!(
          start_date: earliest_task.planned_start_date,
          end_date: latest_task.planned_end_date
        )
      end
    end

    def create_checklist_items_for_task(task, row)
      # Load the supervisor checklist templates
      templates = SupervisorChecklistTemplate.where(id: row.supervisor_checklist_template_ids)

      templates.each_with_index do |template, index|
        task.project_task_checklist_items.create!(
          name: template.name,
          description: template.description,
          category: template.category,
          response_type: template.response_type,
          sequence_order: index,
          is_completed: false
        )
      end

      Rails.logger.info("Created #{templates.count} checklist items for task #{task.name}")
    rescue StandardError => e
      Rails.logger.error("Failed to create checklist items for task #{task.name}: #{e.message}")
      @errors << "Checklist creation failed for #{task.name}: #{e.message}"
    end
  end
end

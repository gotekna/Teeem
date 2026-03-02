# frozen_string_literal: true

# CustomQuoteApplyService - Applies a CustomQuoteTemplate to a job
#
# Resolves SmScheduleMaster → SmTask for the target job.
# Seeds budget_amount from BOQ/Databuild if available.
# Creates default supplier assignments from template.
#
class CustomQuoteApplyService
  class << self
    # Apply a template to a job, creating a CustomQuote with resolved tasks
    #
    # @param template [CustomQuoteTemplate]
    # @param job [Job]
    # @param user [User]
    # @param name [String] optional name override
    # @return [CustomQuote]
    def apply!(template:, job:, user:, name: nil)
      quote_name = name || "#{template.name} - #{job.name}"

      # Build lookup: sm_schedule_master_id → SmTask for this job
      job_tasks = SmTask.where(job_id: job.id).where.not(sm_schedule_master_id: nil)
      task_by_master_id = job_tasks.index_by(&:sm_schedule_master_id)

      ActiveRecord::Base.transaction do
        custom_quote = CustomQuote.create!(
          job: job,
          custom_quote_template: template,
          name: quote_name,
          status: 'draft',
          created_by: user
        )

        # Clone tree from template, resolving SmTasks
        template.root_lines.includes(:children).each do |template_cc|
          cc_line = custom_quote.lines.create!(
            parent_id: nil,
            cost_centre_id: template_cc.effective_cost_centre_id,
            sm_schedule_master_id: template_cc.sm_schedule_master_id,
            sm_task_id: resolve_task(template_cc, task_by_master_id),
            name: template_cc.effective_name,
            quote_level: template_cc.quote_level,
            position: template_cc.position,
            tender_description: template_cc.effective_tender_description,
            po_description: template_cc.effective_po_description,
            rfq_instructions: template_cc.effective_rfq_instructions,
            document_type_ids: template_cc.document_type_ids,
            budget_amount: template_cc.effective_budget_amount || lookup_budget(job, template_cc.effective_cost_centre_id)
          )

          # Create default suppliers for CC line (if quote_level == 'cost_centre')
          if template_cc.quote_level == 'cost_centre'
            create_default_suppliers!(cc_line, template_cc.effective_default_supplier_ids)
          end

          template_cc.children.order(:position).each do |template_po|
            po_line = custom_quote.lines.create!(
              parent_id: cc_line.id,
              cost_centre_id: template_po.effective_cost_centre_id,
              sm_schedule_master_id: template_po.sm_schedule_master_id,
              sm_task_id: resolve_task(template_po, task_by_master_id),
              name: template_po.effective_name,
              quote_level: 'po',
              position: template_po.position,
              tender_description: template_po.effective_tender_description,
              po_description: template_po.effective_po_description,
              rfq_instructions: template_po.effective_rfq_instructions,
              document_type_ids: template_po.document_type_ids,
              budget_amount: template_po.effective_budget_amount
            )

            # Create default suppliers for PO line (if parent quote_level == 'po')
            if template_cc.quote_level == 'po'
              create_default_suppliers!(po_line, template_po.effective_default_supplier_ids)
            end
          end
        end

        custom_quote
      end
    end

    # Populate a custom quote from the job's existing Schedule Master tasks
    #
    # Groups tasks by cost centre, creating a CC → PO tree.
    # Tasks with no cost centre go under an "Unassigned" group.
    #
    # @param job [Job]
    # @param user [User]
    # @param name [String] optional name override
    # @return [CustomQuote]
    def populate_from_job_tasks!(job:, user:, name: nil)
      quote_name = name || "Schedule Master Quote - #{job.name}"

      # Fetch SmTasks for this job that require purchase orders
      job_tasks = SmTask.where(job_id: job.id)
                        .where.not(sm_schedule_master_id: nil)
                        .where(po_required: true)
                        .includes(:cost_centre_ref, :sm_schedule_master)
                        .order(:cost_centre, :task_number)

      # Group by cost_centre (integer FK column)
      grouped = job_tasks.group_by(&:cost_centre)

      ActiveRecord::Base.transaction do
        custom_quote = CustomQuote.create!(
          job: job,
          name: quote_name,
          status: 'draft',
          created_by: user
        )

        position = 0

        # Process tasks WITH a cost centre first (sorted by CC code)
        cc_ids = grouped.keys.compact
        cost_centres = CostCentre.where(id: cc_ids).index_by(&:id)
        sorted_cc_ids = cc_ids.sort_by { |id| cost_centres[id]&.code || "" }

        sorted_cc_ids.each do |cc_id|
          tasks = grouped[cc_id]
          cc = cost_centres[cc_id]
          cc_name = cc ? "#{cc.code} - #{cc.name}" : "Cost Centre #{cc_id}"

          cc_line = custom_quote.lines.create!(
            parent_id: nil,
            cost_centre_id: cc_id,
            name: cc_name,
            quote_level: 'po',
            position: position,
            budget_amount: lookup_budget(job, cc_id)
          )
          position += 1

          tasks.each_with_index do |task, task_pos|
            custom_quote.lines.create!(
              parent_id: cc_line.id,
              cost_centre_id: cc_id,
              sm_schedule_master_id: task.sm_schedule_master_id,
              sm_task_id: task.id,
              name: task.name,
              quote_level: 'po',
              position: task_pos
            )
          end
        end

        # Process tasks with NO cost centre (nil key)
        unassigned_tasks = grouped[nil]
        if unassigned_tasks.present?
          cc_line = custom_quote.lines.create!(
            parent_id: nil,
            cost_centre_id: nil,
            name: "Unassigned",
            quote_level: 'po',
            position: position
          )

          unassigned_tasks.each_with_index do |task, task_pos|
            custom_quote.lines.create!(
              parent_id: cc_line.id,
              sm_schedule_master_id: task.sm_schedule_master_id,
              sm_task_id: task.id,
              name: task.name,
              quote_level: 'po',
              position: task_pos
            )
          end
        end

        custom_quote
      end
    end

    # Populate a custom quote directly from a PO Template Pack
    #
    # Groups pack items by cost centre (via SmScheduleMaster), creating CC → PO tree.
    # Also resolves SmTask references if the job has Schedule Master tasks.
    #
    # @param pack [PoTemplatePack]
    # @param job [Job]
    # @param user [User]
    # @param name [String] optional name override
    # @return [CustomQuote]
    def populate_from_pack!(pack:, job:, user:, name: nil)
      quote_name = name || "#{pack.name} - #{job.name}"

      items = pack.po_template_items
                  .includes(:sm_schedule_master, :supplier)
                  .order(:position)

      # Build task lookup for resolving SM tasks to job-specific tasks
      job_tasks = SmTask.where(job_id: job.id).where.not(sm_schedule_master_id: nil)
      task_by_master_id = job_tasks.index_by(&:sm_schedule_master_id)

      # Group by cost centre (via SM schedule master)
      grouped = items.group_by { |item| item.sm_schedule_master&.cost_centre }

      ActiveRecord::Base.transaction do
        custom_quote = CustomQuote.create!(
          job: job,
          name: quote_name,
          status: 'draft',
          created_by: user
        )

        position = 0

        # Process items WITH a cost centre first (sorted by CC code)
        cc_ids = grouped.keys.compact
        cost_centres = CostCentre.where(id: cc_ids).index_by(&:id)
        sorted_cc_ids = cc_ids.sort_by { |id| cost_centres[id]&.code || "" }

        sorted_cc_ids.each do |cc_id|
          pack_items = grouped[cc_id]
          cc = cost_centres[cc_id]
          cc_name = cc ? "#{cc.code} - #{cc.name}" : "Cost Centre #{cc_id}"

          cc_line = custom_quote.lines.create!(
            parent_id: nil,
            cost_centre_id: cc_id,
            name: cc_name,
            quote_level: 'po',
            position: position,
            budget_amount: lookup_budget(job, cc_id)
          )
          position += 1

          pack_items.each_with_index do |item, po_idx|
            po_line = custom_quote.lines.create!(
              parent_id: cc_line.id,
              cost_centre_id: cc_id,
              sm_schedule_master_id: item.sm_schedule_master_id,
              sm_task_id: item.sm_schedule_master_id ? task_by_master_id[item.sm_schedule_master_id]&.id : nil,
              name: item.effective_name,
              quote_level: 'po',
              position: po_idx,
              po_description: item.effective_notes
            )

            # Create default supplier if specified (SSoT: effective_supplier_id delegates to SM)
            if item.effective_supplier_id
              create_default_suppliers!(po_line, [item.effective_supplier_id])
            end
          end
        end

        # Process items with NO cost centre (nil key)
        unassigned_items = grouped[nil]
        if unassigned_items.present?
          cc_line = custom_quote.lines.create!(
            parent_id: nil,
            cost_centre_id: nil,
            name: "Unassigned",
            quote_level: 'po',
            position: position
          )

          unassigned_items.each_with_index do |item, po_idx|
            po_line = custom_quote.lines.create!(
              parent_id: cc_line.id,
              sm_schedule_master_id: item.sm_schedule_master_id,
              sm_task_id: item.sm_schedule_master_id ? task_by_master_id[item.sm_schedule_master_id]&.id : nil,
              name: item.effective_name,
              quote_level: 'po',
              position: po_idx,
              po_description: item.effective_notes
            )

            if item.effective_supplier_id
              create_default_suppliers!(po_line, [item.effective_supplier_id])
            end
          end
        end

        custom_quote
      end
    end

    private

    def resolve_task(template_line, task_by_master_id)
      return nil unless template_line.sm_schedule_master_id
      task_by_master_id[template_line.sm_schedule_master_id]&.id
    end

    def lookup_budget(job, cost_centre_id)
      return nil unless cost_centre_id
      # Future: Look up from BOQ/Databuild for the job + cost centre
      nil
    end

    def create_default_suppliers!(line, supplier_ids)
      return if supplier_ids.blank?

      Array(supplier_ids).compact.each do |supplier_id|
        contact = Contact.find_by(id: supplier_id)
        next unless contact

        line.suppliers.create!(
          supplier: contact,
          contact_email: contact.email,
          status: 'draft'
        )
      end
    end
  end
end

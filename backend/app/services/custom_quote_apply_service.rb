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
            cost_centre_id: template_cc.cost_centre_id,
            sm_schedule_master_id: template_cc.sm_schedule_master_id,
            sm_task_id: resolve_task(template_cc, task_by_master_id),
            name: template_cc.name,
            quote_level: template_cc.quote_level,
            position: template_cc.position,
            tender_description: template_cc.tender_description,
            po_description: template_cc.po_description,
            rfq_instructions: template_cc.default_instructions,
            budget_amount: lookup_budget(job, template_cc.cost_centre_id)
          )

          # Create default suppliers for CC line (if quote_level == 'cost_centre')
          if template_cc.quote_level == 'cost_centre'
            create_default_suppliers!(cc_line, template_cc.default_supplier_ids)
          end

          template_cc.children.order(:position).each do |template_po|
            po_line = custom_quote.lines.create!(
              parent_id: cc_line.id,
              cost_centre_id: template_po.cost_centre_id,
              sm_schedule_master_id: template_po.sm_schedule_master_id,
              sm_task_id: resolve_task(template_po, task_by_master_id),
              name: template_po.name,
              quote_level: 'po',
              position: template_po.position,
              tender_description: template_po.tender_description,
              po_description: template_po.po_description,
              rfq_instructions: template_po.default_instructions
            )

            # Create default suppliers for PO line (if parent quote_level == 'po')
            if template_cc.quote_level == 'po'
              create_default_suppliers!(po_line, template_po.default_supplier_ids)
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

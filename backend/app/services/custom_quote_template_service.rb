# frozen_string_literal: true

# CustomQuoteTemplateService - CRUD operations for custom quote templates
#
# Handles:
# - Create/update/delete templates
# - Populate template from a PO Template Pack
# - Save a job's custom quote structure back as a template
#
class CustomQuoteTemplateService
  class << self
    # Populate a template's lines from a PO Template Pack
    # Groups pack items by cost_centre_id to build the CC → PO tree.
    #
    # @param template [CustomQuoteTemplate]
    # @return [CustomQuoteTemplate]
    def populate_from_pack!(template)
      pack = template.po_template_pack
      return template unless pack

      items = pack.po_template_items
                  .includes(:sm_schedule_master, :cost_centre, :supplier)
                  .order(:position)

      # Group by cost_centre_id to build CC → PO tree
      grouped = items.group_by(&:cost_centre_id)

      ActiveRecord::Base.transaction do
        grouped.each_with_index do |(cost_centre_id, pack_items), cc_idx|
          cost_centre = CostCentre.find_by(id: cost_centre_id)
          cc_name = cost_centre&.name || "Cost Centre #{cc_idx + 1}"

          # Create CC parent line
          cc_line = template.lines.create!(
            parent_id: nil,
            cost_centre_id: cost_centre_id,
            name: cc_name,
            quote_level: 'po',
            position: cc_idx
          )

          # Create PO child lines from pack items (uses effective_* for SSoT delegation)
          pack_items.each_with_index do |item, po_idx|
            next unless item.sm_schedule_master_id

            supplier_ids = item.effective_supplier_id ? [item.effective_supplier_id] : []

            cc_line.children.create!(
              custom_quote_template: template,
              sm_schedule_master_id: item.sm_schedule_master_id,
              name: item.effective_name || "PO Task #{po_idx + 1}",
              quote_level: 'po',
              position: po_idx,
              po_description: item.effective_notes,
              default_supplier_ids: supplier_ids
            )
          end
        end
      end

      template.reload
    end

    # Save a job's CustomQuote structure as a reusable template
    #
    # @param custom_quote [CustomQuote] - The job-level quote to save
    # @param name [String] - Template name
    # @param user [User] - Who is saving
    # @return [CustomQuoteTemplate]
    def save_from_job!(custom_quote, name:, user:)
      ActiveRecord::Base.transaction do
        template = CustomQuoteTemplate.create!(
          name: name,
          description: "Saved from #{custom_quote.job.name}",
          created_by: user,
          updated_by: user
        )

        # Clone the tree structure
        custom_quote.root_lines.each do |cc_line|
          saved_cc = template.lines.create!(
            parent_id: nil,
            cost_centre_id: cc_line.cost_centre_id,
            sm_schedule_master_id: cc_line.sm_schedule_master_id,
            name: cc_line.name,
            quote_level: cc_line.quote_level,
            position: cc_line.position,
            tender_description: cc_line.tender_description,
            po_description: cc_line.po_description,
            default_instructions: cc_line.rfq_instructions,
            default_supplier_ids: cc_line.suppliers.pluck(:supplier_id),
            document_type_ids: cc_line.document_type_ids,
            budget_amount: cc_line.budget_amount
          )

          cc_line.children.order(:position).each do |po_line|
            template.lines.create!(
              parent_id: saved_cc.id,
              cost_centre_id: po_line.cost_centre_id,
              sm_schedule_master_id: po_line.sm_schedule_master_id,
              name: po_line.name,
              quote_level: 'po',
              position: po_line.position,
              tender_description: po_line.tender_description,
              po_description: po_line.po_description,
              default_instructions: po_line.rfq_instructions,
              default_supplier_ids: po_line.suppliers.pluck(:supplier_id),
              document_type_ids: po_line.document_type_ids,
              budget_amount: po_line.budget_amount
            )
          end
        end

        template
      end
    end

    # Overwrite an existing template with the current job quote structure
    #
    # @param custom_quote [CustomQuote] - The job-level quote
    # @param template [CustomQuoteTemplate] - The template to overwrite
    # @param user [User] - Who is saving
    # @return [CustomQuoteTemplate]
    def overwrite_from_job!(custom_quote, template:, user:)
      ActiveRecord::Base.transaction do
        # Clear existing template lines
        template.lines.destroy_all
        template.update!(updated_by: user)

        # Clone the tree structure (same logic as save_from_job!)
        custom_quote.root_lines.each do |cc_line|
          saved_cc = template.lines.create!(
            parent_id: nil,
            cost_centre_id: cc_line.cost_centre_id,
            sm_schedule_master_id: cc_line.sm_schedule_master_id,
            name: cc_line.name,
            quote_level: cc_line.quote_level,
            position: cc_line.position,
            tender_description: cc_line.tender_description,
            po_description: cc_line.po_description,
            default_instructions: cc_line.rfq_instructions,
            default_supplier_ids: cc_line.suppliers.pluck(:supplier_id),
            document_type_ids: cc_line.document_type_ids,
            budget_amount: cc_line.budget_amount
          )

          cc_line.children.order(:position).each do |po_line|
            template.lines.create!(
              parent_id: saved_cc.id,
              cost_centre_id: po_line.cost_centre_id,
              sm_schedule_master_id: po_line.sm_schedule_master_id,
              name: po_line.name,
              quote_level: 'po',
              position: po_line.position,
              tender_description: po_line.tender_description,
              po_description: po_line.po_description,
              default_instructions: po_line.rfq_instructions,
              default_supplier_ids: po_line.suppliers.pluck(:supplier_id),
              document_type_ids: po_line.document_type_ids,
              budget_amount: po_line.budget_amount
            )
          end
        end

        template.reload
      end
    end
  end
end

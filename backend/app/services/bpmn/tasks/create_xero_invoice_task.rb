module Bpmn
  module Tasks
    class CreateXeroInvoiceTask < BaseTask
      def execute
        log_info("Creating Xero invoice")

        # Resolve invoice details from config/variables
        contact_id = resolve_contact_id
        line_items = resolve_line_items
        reference = get_config("reference", interpolate_value: true)
        due_date = calculate_due_date

        raise "No contact_id specified" if contact_id.blank?
        raise "No line items specified" if line_items.blank?

        # Find the Xero credential for the organization
        org = @subject.try(:organization) || Organization.current
        xero_credential = org&.xero_credential

        raise "No Xero connection found" unless xero_credential&.connected?

        # Create invoice via Xero API
        xero_client = XeroApiClient.new(xero_credential)
        invoice = xero_client.create_invoice(
          contact_id: contact_id,
          line_items: line_items,
          reference: reference,
          due_date: due_date,
          status: @config["status"] || "DRAFT"
        )

        # Store invoice reference
        if @config["store_as_variable"]
          set_variable(@config["store_as_variable"], {
            invoice_id: invoice["InvoiceID"],
            invoice_number: invoice["InvoiceNumber"],
            total: invoice["Total"],
            created_at: Time.current.iso8601
          })
        end

        {
          invoice_id: invoice["InvoiceID"],
          invoice_number: invoice["InvoiceNumber"],
          total: invoice["Total"],
          status: invoice["Status"],
          created_at: Time.current.iso8601
        }
      end

      private

      def resolve_contact_id
        case @config["contact_type"]
        when "static"
          @config["contact_id"]
        when "variable"
          @variables[@config["contact_variable"]]
        when "subject_field"
          @subject.try(@config["contact_field"])&.try(:xero_contact_id)
        else
          @config["contact_id"]
        end
      end

      def resolve_line_items
        items = @config["line_items"] || []

        items.map do |item|
          {
            description: interpolate(item["description"]),
            quantity: item["quantity"] || 1,
            unit_amount: resolve_amount(item["unit_amount"]),
            account_code: item["account_code"],
            tax_type: item["tax_type"]
          }
        end
      end

      def resolve_amount(amount_config)
        if amount_config.is_a?(Hash)
          case amount_config["type"]
          when "variable"
            @variables[amount_config["value"]].to_f
          when "subject_field"
            @subject.try(amount_config["field"]).to_f
          else
            amount_config["value"].to_f
          end
        else
          amount_config.to_f
        end
      end

      def calculate_due_date
        days = @config["due_days"] || 14
        (Date.current + days.days).to_s
      end
    end
  end
end

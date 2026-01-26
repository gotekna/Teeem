# frozen_string_literal: true

# Service to generate Excel import templates for customer onboarding
#
# Usage:
#   # Generate all templates as ZIP
#   zip_data = TemplateGeneratorService.generate_all_templates(tenant)
#
#   # Generate single template
#   xlsx_data = TemplateGeneratorService.generate_template(:contacts, tenant)
#
class TemplateGeneratorService
  TEMPLATE_CONFIGS = {
    contact_types: {
      filename: "01_contact_types.xlsx",
      headers: %w[name code description active],
      description: "Contact type classifications",
      required: %w[name]
    },
    contacts: {
      filename: "10_contacts.xlsx",
      headers: %w[first_name last_name email phone mobile company type address city state postcode notes abn],
      description: "Your clients, suppliers, and staff contacts",
      required: %w[first_name last_name]
    },
    companies: {
      filename: "11_companies.xlsx",
      headers: %w[name abn address phone email website notes],
      description: "Company records",
      required: %w[name]
    },
    users: {
      filename: "12_users.xlsx",
      headers: %w[email first_name last_name role phone position],
      description: "Staff user accounts (admin, manager, user)",
      required: %w[email first_name last_name role]
    },
    suppliers: {
      filename: "20_suppliers.xlsx",
      headers: %w[name abn contact_name email phone address payment_terms notes],
      description: "Your suppliers and vendors",
      required: %w[name]
    },
    pricebook_categories: {
      filename: "21_pricebook_categories.xlsx",
      headers: %w[name description position],
      description: "Categories for organizing pricebook items",
      required: %w[name]
    },
    pricebook_items: {
      filename: "22_pricebook_items.xlsx",
      headers: %w[code name description unit cost_price sell_price category supplier active],
      description: "Your materials and pricing",
      required: %w[code name unit cost_price]
    },
    price_histories: {
      filename: "23_price_histories.xlsx",
      headers: %w[pricebook_code effective_date cost_price sell_price supplier notes],
      description: "Historical price changes",
      required: %w[pricebook_code effective_date cost_price]
    },
    job_types: {
      filename: "30_job_types.xlsx",
      headers: %w[name code description color icon position active],
      description: "Job type classifications (e.g., New Build, Renovation)",
      required: %w[name]
    },
    job_statuses: {
      filename: "31_job_statuses.xlsx",
      headers: %w[name code color position active],
      description: "Job status options (e.g., Active, On Hold, Complete)",
      required: %w[name]
    },
    job_stages: {
      filename: "32_job_stages.xlsx",
      headers: %w[name code description position active],
      description: "Construction stages (e.g., Slab, Frame, Lock-up)",
      required: %w[name]
    },
    jobs: {
      filename: "40_jobs.xlsx",
      headers: %w[job_code name address suburb city state postcode type status stage client_contact client_email contract_value start_date estimated_completion notes],
      description: "Your current and past jobs",
      required: %w[job_code address]
    },
    job_contacts: {
      filename: "41_job_contacts.xlsx",
      headers: %w[job_code contact_email role notes],
      description: "Link contacts to jobs",
      required: %w[job_code contact_email]
    },
    trades: {
      filename: "50_trades.xlsx",
      headers: %w[name trade_type contact_name phone email abn license_number address notes active],
      description: "Your trades and subcontractors",
      required: %w[name trade_type]
    },
    assets: {
      filename: "60_assets.xlsx",
      headers: %w[name code category purchase_date purchase_price location notes],
      description: "Company assets and equipment",
      required: %w[name]
    }
  }.freeze

  class << self
    def generate_all_templates(tenant)
      require "zip"

      stringio = Zip::OutputStream.write_buffer do |zip|
        TEMPLATE_CONFIGS.each do |type, config|
          xlsx_data = generate_template(type, tenant)
          zip.put_next_entry(config[:filename])
          zip.write(xlsx_data)
        end

        # Add README
        zip.put_next_entry("README.txt")
        zip.write(generate_readme)
      end

      stringio.rewind
      stringio.read
    end

    def generate_template(type, tenant)
      config = TEMPLATE_CONFIGS[type.to_sym]
      raise ArgumentError, "Unknown template type: #{type}" unless config

      require "caxlsx"

      package = Axlsx::Package.new
      workbook = package.workbook

      # Add styles
      header_style = workbook.styles.add_style(
        bg_color: "4472C4",
        fg_color: "FFFFFF",
        b: true,
        border: { style: :thin, color: "000000" }
      )

      required_style = workbook.styles.add_style(
        bg_color: "FFC000",
        fg_color: "000000",
        b: true,
        border: { style: :thin, color: "000000" }
      )

      # Create data sheet
      workbook.add_worksheet(name: "Data") do |sheet|
        # Header row with required columns highlighted
        header_row = config[:headers].map do |h|
          config[:required]&.include?(h) ? "#{h} *" : h
        end

        styles = config[:headers].map do |h|
          config[:required]&.include?(h) ? required_style : header_style
        end

        sheet.add_row header_row, style: styles

        # Add sample data for configuration tables (pre-filled from tenant templates)
        if %i[job_types job_statuses job_stages contact_types].include?(type.to_sym)
          add_sample_config_data(sheet, type, tenant)
        end
      end

      # Create instructions sheet
      workbook.add_worksheet(name: "Instructions") do |sheet|
        sheet.add_row ["TEEEM Import Template: #{type.to_s.humanize}"]
        sheet.add_row []
        sheet.add_row ["Description:", config[:description]]
        sheet.add_row []
        sheet.add_row ["Required Fields (marked with *):", config[:required]&.join(", ") || "None"]
        sheet.add_row []
        sheet.add_row ["Column Descriptions:"]

        config[:headers].each do |header|
          required = config[:required]&.include?(header) ? " (REQUIRED)" : ""
          sheet.add_row ["  #{header}#{required}"]
        end
      end

      package.to_stream.read
    end

    private

    def add_sample_config_data(sheet, type, tenant)
      case type.to_sym
      when :job_types
        tenant.job_types.each do |jt|
          sheet.add_row [jt.name, jt.code, jt.description, jt.color, jt.icon, jt.position, jt.is_active]
        end
      when :job_statuses
        tenant.job_statuses.each do |js|
          sheet.add_row [js.name, js.code, js.color, js.position, js.respond_to?(:is_active) ? js.is_active : true]
        end
      when :job_stages
        tenant.job_stages.each do |js|
          sheet.add_row [js.name, js.code, js.description, js.position, js.respond_to?(:is_active) ? js.is_active : true]
        end
      when :contact_types
        tenant.contact_types.each do |ct|
          sheet.add_row [ct.name, ct.code, ct.description, ct.respond_to?(:is_active) ? ct.is_active : true]
        end
      end
    rescue StandardError
      # If tenant associations fail, just leave empty
    end

    def generate_readme
      <<~README
        TEEEM Import Templates
        ======================

        These templates help you import your existing data into TEEEM.

        IMPORT ORDER (dependencies matter):
        1. Contact Types (01_contact_types.xlsx) - Optional, customize contact categories
        2. Contacts (10_contacts.xlsx) - Your clients, suppliers, contacts
        3. Companies (11_companies.xlsx) - Company records
        4. Users (12_users.xlsx) - Staff user accounts

        5. Suppliers (20_suppliers.xlsx) - Optional, your vendors
        6. Pricebook Categories (21_pricebook_categories.xlsx) - Optional, organize pricebook
        7. Pricebook Items (22_pricebook_items.xlsx) - Your materials/pricing

        8. Job Types/Statuses/Stages (30-32) - Optional, customize from templates
        9. Jobs (40_jobs.xlsx) - Your projects
        10. Job Contacts (41_job_contacts.xlsx) - Link contacts to jobs

        11. Trades (50_trades.xlsx) - Your subcontractors
        12. Assets (60_assets.xlsx) - Optional, company equipment

        TIPS:
        - Required fields are marked with * in column headers
        - Keep the header row exactly as provided
        - Dates should be in YYYY-MM-DD format
        - Currency values without $ signs (e.g., 1500.00)
        - Boolean fields: true/false, yes/no, or 1/0

        HELP:
        Contact support@teeem.com.au if you need assistance.
      README
    end
  end
end

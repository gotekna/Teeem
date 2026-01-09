namespace :corporate do
  desc "Check if Foundation columns match Rails model columns for corporate entities"
  task check_schema: :environment do
    puts "Checking Corporate schema sync...\n\n"

    # Corporate models mapped to their Foundation slugs
    corporate_mappings = {
      "Company" => "company",
      "Asset" => "asset",
      "CompanyDirector" => "company-director",
      "CompanyDocument" => "company-document",
      "CompanySetting" => "company-setting",
      "CompanyActivity" => "company-activity",
      "CompanyComplianceItem" => "company-compliance-item",
      "CompanyShareholding" => "company-shareholding",
      "CompanyLoan" => "company-loan",
      "CompanyMinute" => "company-minute",
      "CompanyXeroAccount" => "company-xero-account",
      "CompanyXeroConnection" => "company-xero-connection",
      "AssetInsurance" => "asset-insurance",
      "AssetServiceHistory" => "asset-service-history"
    }

    # System columns that don't need Foundation definitions
    system_columns = %w[id created_at updated_at encrypted_password reset_password_token]

    total_issues = 0
    models_checked = 0
    models_skipped = 0

    corporate_mappings.each do |model_name, foundation_slug|
      begin
        model_class = model_name.constantize
      rescue NameError
        puts "  Skipping #{model_name} (model not found)"
        models_skipped += 1
        next
      end

      foundation = Foundation.find_by(slug: foundation_slug)

      puts "=== #{model_name} ==="

      if foundation.nil?
        puts "  Foundation '#{foundation_slug}' not found"
        puts "  Rails model columns: #{model_class.column_names.sort.join(', ')}"
        puts "  Action: Create Foundation with slug '#{foundation_slug}' or verify slug is correct"
        puts ""
        total_issues += 1
        next
      end

      models_checked += 1

      # Get Rails model columns (excluding system columns)
      rails_columns = model_class.column_names - system_columns

      # Get Foundation column definitions
      foundation_columns = foundation.columns.pluck(:column_name)

      # Find differences
      missing_in_foundation = rails_columns - foundation_columns
      missing_in_model = foundation_columns - rails_columns - %w[actions] # 'actions' is UI-only

      if missing_in_foundation.empty? && missing_in_model.empty?
        puts "  All columns in sync"
      else
        if missing_in_foundation.any?
          puts "  Missing in Foundation (exists in Rails model):"
          missing_in_foundation.each do |col|
            db_col = model_class.columns_hash[col]
            col_type = infer_column_type_for_corporate(db_col)
            puts "    - #{col} (#{db_col.type} -> #{col_type})"
          end
          total_issues += missing_in_foundation.count
        end

        if missing_in_model.any?
          puts "  Missing in Rails model (exists in Foundation):"
          missing_in_model.each do |col|
            puts "    - #{col}"
          end
          total_issues += missing_in_model.count
        end
      end
      puts ""
    end

    puts "\n" + "=" * 50
    puts "Summary:"
    puts "  Models checked: #{models_checked}"
    puts "  Models skipped: #{models_skipped}"
    puts "  Total issues: #{total_issues}"

    if total_issues == 0
      puts "\n  All corporate schemas are in sync!"
    else
      puts "\n  Run 'rails corporate:sync_schema' to fix Foundation definitions."
    end
  end

  desc "Sync Foundation columns to match Rails model columns for corporate entities"
  task sync_schema: :environment do
    puts "Syncing Corporate schema...\n\n"

    corporate_mappings = {
      "Company" => "company",
      "Asset" => "asset",
      "CompanyDirector" => "company-director",
      "CompanyDocument" => "company-document",
      "CompanySetting" => "company-setting",
      "CompanyActivity" => "company-activity",
      "CompanyComplianceItem" => "company-compliance-item",
      "CompanyShareholding" => "company-shareholding",
      "CompanyLoan" => "company-loan",
      "CompanyMinute" => "company-minute",
      "CompanyXeroAccount" => "company-xero-account",
      "CompanyXeroConnection" => "company-xero-connection",
      "AssetInsurance" => "asset-insurance",
      "AssetServiceHistory" => "asset-service-history"
    }

    system_columns = %w[id created_at updated_at encrypted_password reset_password_token]

    stats = { added: 0, removed: 0, skipped: 0 }

    corporate_mappings.each do |model_name, foundation_slug|
      begin
        model_class = model_name.constantize
      rescue NameError
        puts "  Skipping #{model_name} (model not found)"
        stats[:skipped] += 1
        next
      end

      foundation = Foundation.find_by(slug: foundation_slug)

      unless foundation
        puts "  Skipping #{model_name} - Foundation '#{foundation_slug}' not found"
        stats[:skipped] += 1
        next
      end

      puts "=== #{model_name} (Foundation: #{foundation.name}) ==="

      rails_columns = model_class.column_names - system_columns
      foundation_columns = foundation.columns.pluck(:column_name)

      # Add missing columns to Foundation
      missing_in_foundation = rails_columns - foundation_columns

      missing_in_foundation.each do |col_name|
        db_col = model_class.columns_hash[col_name]
        col_type = infer_column_type_for_corporate(db_col)
        display_name = col_name.titleize.gsub(/\bId\b/, "ID")

        puts "    Adding: #{col_name} (#{col_type})"

        foundation.columns.create!(
          name: display_name,
          column_name: col_name,
          column_type: col_type,
          position: foundation.columns.maximum(:position).to_i + 1,
          visible: !col_name.end_with?("_id"), # Hide foreign keys by default
          editable: !%w[id created_at updated_at].include?(col_name)
        )
        stats[:added] += 1
      end

      # Remove stale Foundation columns (not in Rails model)
      stale_columns = foundation_columns - rails_columns - %w[actions]

      stale_columns.each do |col_name|
        col = foundation.columns.find_by(column_name: col_name)
        if col
          puts "    Removing stale: #{col_name}"
          col.destroy
          stats[:removed] += 1
        end
      end

      puts "" if missing_in_foundation.any? || stale_columns.any?
    end

    puts "\n" + "=" * 50
    puts "Sync complete!"
    puts "  Columns added: #{stats[:added]}"
    puts "  Columns removed: #{stats[:removed]}"
    puts "  Models skipped: #{stats[:skipped]}"
  end

  desc "Create missing Foundation records for corporate models"
  task create_foundations: :environment do
    puts "Creating missing Corporate Foundations...\n\n"

    # Corporate models and their Foundation configuration
    corporate_foundations = {
      "Company" => {
        slug: "company",
        name: "Companies",
        singular_name: "Company",
        plural_name: "Companies",
        icon: "building-2",
        feature: "corporate",
        description: "Company records for corporate management"
      },
      "Asset" => {
        slug: "asset",
        name: "Assets",
        singular_name: "Asset",
        plural_name: "Assets",
        icon: "package",
        feature: "corporate",
        description: "Company assets including vehicles, equipment, and property"
      },
      "CompanyDirector" => {
        slug: "company-director",
        name: "Company Directors",
        singular_name: "Company Director",
        plural_name: "Company Directors",
        icon: "user",
        feature: "corporate",
        description: "Directors and officers of companies"
      },
      "CompanyDocument" => {
        slug: "company-document",
        name: "Company Documents",
        singular_name: "Company Document",
        plural_name: "Company Documents",
        icon: "file-text",
        feature: "corporate",
        description: "Corporate documents and records"
      },
      "CompanySetting" => {
        slug: "company-setting",
        name: "Company Settings",
        singular_name: "Company Setting",
        plural_name: "Company Settings",
        icon: "settings",
        feature: "corporate",
        description: "Company-specific settings and configuration"
      },
      "CompanyActivity" => {
        slug: "company-activity",
        name: "Company Activities",
        singular_name: "Company Activity",
        plural_name: "Company Activities",
        icon: "activity",
        feature: "corporate",
        description: "Activity log for companies"
      },
      "CompanyComplianceItem" => {
        slug: "company-compliance-item",
        name: "Compliance Items",
        singular_name: "Compliance Item",
        plural_name: "Compliance Items",
        icon: "check-circle",
        feature: "corporate",
        description: "Compliance tracking for companies"
      },
      "CompanyShareholding" => {
        slug: "company-shareholding",
        name: "Shareholdings",
        singular_name: "Shareholding",
        plural_name: "Shareholdings",
        icon: "pie-chart",
        feature: "corporate",
        description: "Company share ownership records"
      },
      "CompanyLoan" => {
        slug: "company-loan",
        name: "Company Loans",
        singular_name: "Company Loan",
        plural_name: "Company Loans",
        icon: "dollar-sign",
        feature: "corporate",
        description: "Intercompany loans and borrowings"
      },
      "CompanyMinute" => {
        slug: "company-minute",
        name: "Company Minutes",
        singular_name: "Company Minute",
        plural_name: "Company Minutes",
        icon: "file-text",
        feature: "corporate",
        description: "Meeting minutes and resolutions"
      },
      "CompanyXeroAccount" => {
        slug: "company-xero-account",
        name: "Xero Accounts",
        singular_name: "Xero Account",
        plural_name: "Xero Accounts",
        icon: "credit-card",
        feature: "corporate",
        description: "Xero account mappings for companies"
      },
      "CompanyXeroConnection" => {
        slug: "company-xero-connection",
        name: "Xero Connections",
        singular_name: "Xero Connection",
        plural_name: "Xero Connections",
        icon: "link",
        feature: "corporate",
        description: "Xero integration connections"
      },
      "AssetInsurance" => {
        slug: "asset-insurance",
        name: "Asset Insurance",
        singular_name: "Asset Insurance",
        plural_name: "Asset Insurance Records",
        icon: "shield",
        feature: "corporate",
        description: "Insurance records for assets"
      },
      "AssetServiceHistory" => {
        slug: "asset-service-history",
        name: "Asset Service History",
        singular_name: "Service Record",
        plural_name: "Service Records",
        icon: "wrench",
        feature: "corporate",
        description: "Service and maintenance history for assets"
      }
    }

    created = 0
    skipped = 0

    corporate_foundations.each do |model_name, config|
      existing = Foundation.find_by(slug: config[:slug])

      if existing
        puts "  Exists: #{config[:name]} (ID: #{existing.id})"
        skipped += 1
        next
      end

      begin
        model_class = model_name.constantize
      rescue NameError
        puts "  Skipping #{model_name} (model class not found)"
        skipped += 1
        next
      end

      puts "  Creating: #{config[:name]}..."

      foundation = Foundation.create!(
        name: config[:name],
        slug: config[:slug],
        singular_name: config[:singular_name],
        plural_name: config[:plural_name],
        icon: config[:icon],
        feature: config[:feature],
        description: config[:description],
        table_type: "system",
        model_class: model_name,
        database_table_name: model_class.table_name,
        is_live: true,
        searchable: true
      )

      puts "    Created with ID: #{foundation.id}"
      created += 1
    end

    puts "\n" + "=" * 50
    puts "Complete!"
    puts "  Created: #{created}"
    puts "  Skipped (already exist): #{skipped}"

    if created > 0
      puts "\nRun 'rails corporate:sync_schema' to add column definitions."
    end
  end

  desc "Full corporate setup: create foundations, sync schema"
  task setup: :environment do
    puts "Running full Corporate setup...\n\n"
    Rake::Task["corporate:create_foundations"].invoke
    puts "\n"
    Rake::Task["corporate:sync_schema"].invoke
  end

  desc "Show corporate Foundation IDs for frontend config"
  task show_ids: :environment do
    puts "Corporate Foundation IDs:\n\n"

    corporate_slugs = %w[
      company asset company-director company-document company-setting
      company-activity company-compliance-item company-shareholding
      company-loan company-minute company-xero-account company-xero-connection
      asset-insurance asset-service-history
    ]

    puts "For frontend config.ts:\n"
    puts "export const CORPORATE_TABLE_IDS = {"

    corporate_slugs.each do |slug|
      foundation = Foundation.find_by(slug: slug)
      const_name = slug.upcase.gsub("-", "_")
      if foundation
        puts "  #{const_name}: #{foundation.id},"
      else
        puts "  // #{const_name}: null, // Not found - run 'rails corporate:create_foundations'"
      end
    end

    puts "} as const;"
  end
end

# Helper method for inferring column types
def infer_column_type_for_corporate(db_col)
  return "single_line_text" unless db_col

  case db_col.type
  when :string
    col_name = db_col.name.downcase
    if col_name.include?("email")
      "email"
    elsif col_name.include?("phone") || col_name.include?("mobile") || col_name.include?("fax")
      "phone"
    elsif col_name.include?("url") || col_name.include?("link") || col_name.include?("website")
      "url"
    elsif col_name.include?("abn")
      "abn"
    elsif col_name.include?("acn")
      "acn"
    elsif col_name.include?("tfn")
      "tfn"
    elsif col_name.include?("bsb")
      "bsb"
    elsif col_name.include?("status")
      "status"
    elsif col_name == "slug"
      "slug"
    else
      "single_line_text"
    end
  when :text
    col_name = db_col.name.downcase
    if col_name.include?("address")
      "address"
    else
      "multiple_lines_text"
    end
  when :integer, :bigint
    col_name = db_col.name
    if col_name.end_with?("_id")
      "lookup" # Foreign key relationship
    elsif col_name.include?("year")
      "whole_number"
    else
      "whole_number"
    end
  when :decimal, :float
    col_name = db_col.name.downcase
    if col_name.include?("percent") || col_name.include?("rate") || col_name.include?("ratio")
      "percentage"
    elsif col_name.include?("price") || col_name.include?("cost") || col_name.include?("value") ||
          col_name.include?("amount") || col_name.include?("balance") || col_name.include?("total")
      "currency"
    else
      "decimal_number"
    end
  when :boolean
    "boolean"
  when :date
    "date"
  when :datetime, :timestamp
    "date"
  when :json, :jsonb
    "json"
  else
    "single_line_text"
  end
end

# frozen_string_literal: true

# Service to import customer data from Excel files during onboarding
#
# Usage:
#   service = DataImportService.new(tenant, files)
#   result = service.import!
#   # => { success: true, counts: { contacts: 50, jobs: 10 }, errors: [] }
#
#   # Validate without importing
#   result = service.validate_only!
#
class DataImportService
  # Order matters - dependencies must be imported first
  IMPORT_ORDER = %i[
    contact_types
    contacts
    companies
    users
    suppliers
    pricebook_categories
    pricebook_items
    price_histories
    job_types
    job_statuses
    job_stages
    jobs
    job_contacts
    trades
    assets
  ].freeze

  attr_reader :tenant, :files, :errors, :counts

  def initialize(tenant, files)
    @tenant = tenant
    @files = files.with_indifferent_access
    @errors = []
    @counts = {}
  end

  def import!
    ActsAsTenant.with_tenant(@tenant) do
      ActiveRecord::Base.transaction do
        IMPORT_ORDER.each do |table|
          next unless @files[table].present?

          import_table(table, @files[table])
        end

        raise ActiveRecord::Rollback if @errors.any?
      end
    end

    {
      success: @errors.empty?,
      counts: @counts,
      errors: @errors
    }
  end

  def validate_only!
    @errors = []
    @counts = {}

    IMPORT_ORDER.each do |table|
      next unless @files[table].present?

      validate_table(table, @files[table])
    end

    {
      valid: @errors.empty?,
      would_import: @counts,
      errors: @errors
    }
  end

  private

  def import_table(table, file)
    importer_class = importer_for(table)
    return unless importer_class

    importer = importer_class.new(@tenant, file)
    result = importer.import!

    @counts[table] = result[:count]

    if result[:errors].any?
      @errors.concat(result[:errors].map { |e| "[#{table}] #{e}" })
    end

    Rails.logger.info "[DataImport] #{table}: #{result[:count]} imported, #{result[:skipped]} skipped"
  rescue StandardError => e
    @errors << "[#{table}] Import failed: #{e.message}"
    Rails.logger.error "[DataImport] #{table} failed: #{e.message}\n#{e.backtrace.first(3).join("\n")}"
  end

  def validate_table(table, file)
    importer_class = importer_for(table)
    return unless importer_class

    # Count rows in file without actually importing
    importer = importer_class.new(@tenant, file)

    begin
      row_count = count_rows(file)
      @counts[table] = row_count
    rescue StandardError => e
      @errors << "[#{table}] Validation failed: #{e.message}"
    end
  end

  def count_rows(file)
    file_path = case file
                when String then file
                when ActionDispatch::Http::UploadedFile then file.tempfile.path
                else raise ArgumentError, "Unknown file type"
                end

    case File.extname(file_path).downcase
    when ".csv"
      require "csv"
      CSV.read(file_path, headers: true).count
    when ".xlsx", ".xls"
      require "roo"
      xlsx = Roo::Spreadsheet.open(file_path)
      xlsx.last_row - 1 # Subtract header row
    else
      0
    end
  end

  def importer_for(table)
    class_name = "Importers::#{table.to_s.camelize}Importer"
    class_name.constantize
  rescue NameError
    Rails.logger.warn "[DataImport] No importer found for #{table}"
    nil
  end
end

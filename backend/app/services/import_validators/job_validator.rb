# frozen_string_literal: true

module ImportValidators
  # JobValidator - Validates job import data
  #
  # Validates jobs for import, checking:
  # - Required address fields
  # - Lot number or street number requirement
  # - Postcode/state format
  # - Lookup validations (job_type, job_status, client)
  # - Duplicate detection
  #
  class JobValidator < BaseValidator
    REQUIRED_COLUMNS = %w[street_name suburb state postcode].freeze

    OPTIONAL_COLUMNS = %w[
      job_code lot_number street_number street_type
      job_type job_status client_name
      contract_price start_date
    ].freeze

    def initialize(rows, options = {})
      super
      @existing_job_codes = Job.pluck(:job_code)
      @job_types = JobType.pluck(:name)
      @job_statuses = JobStatus.pluck(:name)
      @contacts = Contact.pluck(:display_name, :id).to_h
    end

    protected

    def validate_row(row, row_number)
      # Required fields
      validate_required(row, row_number, 'street_name', row['street_name'])
      validate_required(row, row_number, 'suburb', row['suburb'])
      validate_required(row, row_number, 'state', row['state'])
      validate_required(row, row_number, 'postcode', row['postcode'])

      # Either lot_number or street_number required
      lot_number = row['lot_number']
      street_number = row['street_number']
      if lot_number.blank? && street_number.blank?
        add_error(row_number, 'Either lot_number or street_number is required')
      end

      # Validate postcode and state format
      validate_postcode(row, row_number, 'postcode', row['postcode'])
      validate_state(row, row_number, 'state', row['state'])

      # Validate date
      validate_date(row, row_number, 'start_date', row['start_date'])

      # Validate currency
      validate_currency(row, row_number, 'contract_price', row['contract_price'])

      # Validate lookups
      job_type = row['job_type']
      if job_type.present?
        validate_lookup(row, row_number, 'job_type', job_type, @job_types, auto_create: options[:auto_create_lookups])
      end

      job_status = row['job_status']
      if job_status.present?
        validate_lookup(row, row_number, 'job_status', job_status, @job_statuses, auto_create: options[:auto_create_lookups])
      end

      # Validate client reference
      client_name = row['client_name']
      if client_name.present? && !@contacts.key?(client_name)
        add_warning(row_number, "Client not found: #{client_name}. Contact will need to be linked manually.", column: 'client_name', value: client_name)
      end

      # Check for duplicate job code
      job_code = row['job_code']
      if job_code.present? && @existing_job_codes.include?(job_code)
        add_error(row_number, "Job code already exists: #{job_code}", column: 'job_code', value: job_code)
      end
    end

    def preview_row(row, row_number)
      # Generate address preview
      address_parts = []
      if row['lot_number'].present?
        street_num = row['street_number'].present? ? " (#{row['street_number']})" : ''
        address_parts << "Lot #{row['lot_number']}#{street_num}"
      elsif row['street_number'].present?
        address_parts << row['street_number']
      end
      address_parts << row['street_name']
      address_parts << row['street_type'] if row['street_type'].present?
      address_parts << row['suburb']
      address_parts << row['postcode']
      address_parts << row['state']&.upcase

      {
        row: row_number,
        job_code: row['job_code'] || '(auto)',
        address: address_parts.compact.join(' '),
        job_type: row['job_type'] || 'Default',
        job_status: row['job_status'] || 'Active',
        client: row['client_name'],
        contract_price: row['contract_price'],
        status: row_status(row, row_number),
        errors: row_errors(row_number),
        warnings: row_warnings(row_number),
        action: determine_action(row)
      }
    end

    private

    def determine_action(row)
      job_code = row['job_code']
      if job_code.present? && @existing_job_codes.include?(job_code)
        options[:update_existing] ? 'update' : 'skip'
      else
        'create'
      end
    end
  end
end

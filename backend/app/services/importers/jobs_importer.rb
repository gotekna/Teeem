# frozen_string_literal: true

module Importers
  class JobsImporter < BaseImporter
    def import!
      spreadsheet.each_with_index do |row, idx|
        row_number = idx + 2

        job = build_job(row)

        if job.save
          @count += 1
        else
          add_error(row_number, job.errors.full_messages.join(", "))
        end
      end

      result
    end

    private

    def build_job(row)
      Job.new(
        company_group: @tenant,
        job_code: normalize_value(row["job_code"]),
        name: normalize_value(row["name"]) || normalize_value(row["address"]),
        address: normalize_value(row["address"]),
        suburb: normalize_value(row["suburb"]),
        city: normalize_value(row["city"]),
        state: normalize_value(row["state"]),
        postcode: normalize_value(row["postcode"]),
        job_type: find_lookup(JobType, row["type"]),
        job_status: find_lookup(JobStatus, row["status"]),
        job_stage: find_lookup(JobStage, row["stage"]),
        client_contact: find_client_contact(row["client_contact"] || row["client_email"]),
        contract_value: parse_decimal(row["contract_value"]),
        start_date: parse_date(row["start_date"]),
        estimated_completion: parse_date(row["estimated_completion"]),
        actual_completion: parse_date(row["actual_completion"]),
        notes: normalize_value(row["notes"])
      )
    end

    def find_client_contact(identifier)
      return nil if identifier.blank?

      # Try to find by email first, then by name
      Contact.find_by(email: identifier.to_s.strip) ||
        Contact.where("CONCAT(first_name, ' ', last_name) ILIKE ?", identifier.to_s.strip).first
    end
  end
end

module Api
  module V1
    class ContactEmploymentsController < ApplicationController
      # POST /api/v1/contacts/extract_employees
      # Extract employees from accounts@ email addresses
      def extract_employees
        employments_created = 0
        companies_created = 0
        employees_processed = []
        employers_found = []

        # Find person contacts with accounts@ emails (excluding generic "Accounts Team")
        person_accounts = Contact.where('email ILIKE ?', 'accounts@%')
                                .where(entity_type: 'person')
                                .where.not(full_name: ['Accounts Team', 'accounts team', '', nil])
                                .where(deleted: [false, nil])

        person_accounts.each do |person|
          # Extract company name from email domain
          domain = person.email.split('@').last
          company_domain = domain.split('.').first
          company_name = company_domain.titleize

          # Find or create the company contact
          company = Contact.where(entity_type: ['company', 'trust', 'sole_trader'])
                          .where('company_name_or_trust ILIKE ? OR full_name ILIKE ?',
                                 "%#{company_name}%", "%#{company_name}%")
                          .first

          if company.nil?
            # Create the company
            company = Contact.create!(
              full_name: company_name,
              company_name_or_trust: company_name,
              entity_type: 'company',
              email: person.email, # Use the accounts@ email for the company
              is_team_contact: false
            )
            companies_created += 1
          end

          employers_found << company.id unless employers_found.include?(company.id)

          # Create employment record (many-to-many relationship)
          employment = ContactEmployment.find_or_initialize_by(
            employee_id: person.id,
            employer_id: company.id
          )

          if employment.new_record?
            employment.assign_attributes(
              role: 'Accounts', # Inferred from accounts@ email
              work_email: person.email,
              is_active: true,
              is_primary: person.employers.empty? # Set as primary if it's their first employer
            )
            employment.save!
            employments_created += 1
          end

          employees_processed << person.id unless employees_processed.include?(person.id)
        end

        render json: {
          success: true,
          employments_created: employments_created,
          companies_created: companies_created,
          total_employees: employees_processed.length,
          total_employers: employers_found.length,
          message: "Successfully extracted #{employments_created} employment relationships"
        }
      rescue StandardError => e
        Rails.logger.error("Employee extraction error: #{e.message}")
        Rails.logger.error(e.backtrace.first(10).join("\n"))
        render json: {
          success: false,
          error: "Failed to extract employees: #{e.message}"
        }, status: :internal_server_error
      end
    end
  end
end

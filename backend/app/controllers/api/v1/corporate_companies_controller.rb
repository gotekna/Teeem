module Api
  module V1
    class CorporateCompaniesController < ApplicationController
      before_action :set_company, only: [ :show, :update, :destroy, :directors, :add_director,
                                         :update_director, :remove_director, :compliance_items,
                                         :activities, :documents, :assets, :hierarchy, :shareholders,
                                         :investments, :trust_roles, :data_stats, :warehouse_health, :health ]

      # GET /api/v1/companies
      # By default, only shows companies linked to a corporate group (have company_group_id)
      # Use include_unlinked=true to show all companies
      def index
        @companies = CorporateCompany.includes(:corporate_company_directors, :corporate_company_xero_connection).all

        # By default, only show companies linked to corporate (have company_group_id)
        # Unless include_unlinked=true is passed
        unless params[:include_unlinked] == "true"
          @companies = @companies.where.not(company_group_id: nil)
        end

        # Filtering
        @companies = @companies.by_group(params[:group]) if params[:group].present?
        @companies = @companies.where(status: params[:status]) if params[:status].present?
        @companies = @companies.where(company_group_id: params[:company_group_id]) if params[:company_group_id].present?
        @companies = @companies.where(consolidation_parent_id: params[:consolidation_parent_id]) if params[:consolidation_parent_id].present?
        @companies = @companies.where(entity_type: params[:entity_type]) if params[:entity_type].present?

        # Search
        if params[:search].present?
          @companies = @companies.where(
            "name ILIKE ? OR acn ILIKE ? OR abn ILIKE ?",
            "%#{params[:search]}%",
            "%#{params[:search]}%",
            "%#{params[:search]}%"
          )
        end

        # Sorting
        sort_by = params[:sort_by] || "name"
        sort_order = params[:sort_order] || "asc"
        @companies = @companies.order("#{sort_by} #{sort_order}")

        # Return all columns - no column limiting
        render json: {
          success: true,
          companies: @companies.as_json(
            include: {
              current_directors: {},
              corporate_company_xero_connection: {}
            },
            methods: [ :formatted_acn, :formatted_abn, :has_xero_connection? ]
          ),
          total: @companies.count
        }
      end

      # GET /api/v1/companies/:id
      def show
        company_json = @company.as_json(
          include: {
            bank_accounts: { methods: [ :display_name, :masked_account_number ] },
            # Note: active_assets removed - assets table not yet migrated
            pending_compliance_items: { methods: [ :days_until_due ] },
            corporate_company_xero_connection: {},
            consolidation_parent: {},
            contact: {} # Include contact with ABN verification fields
          },
          methods: [ :formatted_acn, :formatted_abn, :has_xero_connection?, :sharepoint_folder_url ]
          # Note: total_asset_value removed - depends on assets table
        )

        # Serialize current directors separately (corporate_company_directors returns CorporateCompanyDirector objects)
        company_json["current_directors"] = @company.corporate_company_directors.current.includes(:contact).map do |director|
          director.as_json(
            include: { contact: {} },
            methods: [ :formatted_position ]
          )
        end

        render json: { success: true, company: company_json }
      end

      # POST /api/v1/companies
      def create
        @company = CorporateCompany.new(company_params)

        if @company.save
          render json: {
            success: true,
            message: "Company created successfully",
            company: @company.as_json(methods: [ :formatted_acn, :formatted_abn ])
          }, status: :created
        else
          render json: {
            success: false,
            errors: @company.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/companies/create_from_contact
      # Creates a CorporateCompany from an existing Contact
      # This is the SSoT for "Add Existing" functionality
      def create_from_contact
        contact = Contact.find(params[:contact_id])

        # Check if a CorporateCompany already exists for this contact
        existing = CorporateCompany.find_by(contact_id: contact.id)
        if existing
          # Just update the company_group_id if it already exists
          existing.update!(company_group_id: params[:company_group_id])
          return render json: {
            success: true,
            message: "Company already exists - updated group assignment",
            company: existing.as_json(methods: [ :formatted_acn, :formatted_abn ])
          }
        end

        # Create new CorporateCompany from Contact data
        @company = CorporateCompany.new(
          contact_id: contact.id,
          name: contact.display_name,
          abn: contact.abn,
          acn: contact.acn,
          entity_type: contact.entity_type&.capitalize || "Company",
          company_group_id: params[:company_group_id],
          status: "active"
        )

        if @company.save
          # Also update the contact's company_group_id for consistency
          contact.update(company_group_id: params[:company_group_id])

          render json: {
            success: true,
            message: "Company created successfully from contact",
            company: @company.as_json(methods: [ :formatted_acn, :formatted_abn ])
          }, status: :created
        else
          render json: {
            success: false,
            errors: @company.errors.full_messages
          }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end

      # PATCH/PUT /api/v1/companies/:id
      def update
        if @company.update(company_params)
          render json: {
            success: true,
            message: "Company updated successfully",
            company: @company.as_json(methods: [ :formatted_acn, :formatted_abn ])
          }
        else
          render json: {
            success: false,
            errors: @company.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/companies/:id
      def destroy
        @company.destroy
        render json: {
          success: true,
          message: "Company deleted successfully"
        }
      end

      # GET /api/v1/companies/:id/directors
      def directors
        directors = @company.corporate_company_directors.includes(:contact).order(appointment_date: :desc)

        render json: {
          success: true,
          directors: directors.as_json(
            include: {
              contact: {
                methods: [ :display_name ]
              }
            },
            methods: [ :formatted_position, :active_duration ]
          )
        }
      end

      # POST /api/v1/companies/:id/add_director
      def add_director
        contact = Contact.find(params[:contact_id])

        director = @company.corporate_company_directors.build(
          contact: contact,
          position: params[:position],
          appointment_date: params[:appointment_date] || Date.today,
          is_current: true
        )

        if director.save
          render json: {
            success: true,
            message: "Director added successfully",
            director: director.as_json(
              include: { contact: {} },
              methods: [ :formatted_position ]
            )
          }, status: :created
        else
          render json: {
            success: false,
            errors: director.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/companies/:id/directors/:director_id
      def update_director
        director = @company.corporate_company_directors.find(params[:director_id])

        if director.update(director_params)
          render json: {
            success: true,
            message: "Director updated successfully",
            director: director.as_json(
              include: { contact: {} },
              methods: [ :formatted_position ]
            )
          }
        else
          render json: {
            success: false,
            errors: director.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/companies/:id/directors/:director_id
      def remove_director
        director = @company.corporate_company_directors.find(params[:director_id])

        if director.update(resignation_date: params[:resignation_date] || Date.today, is_current: false)
          render json: {
            success: true,
            message: "Director removed successfully"
          }
        else
          render json: {
            success: false,
            errors: director.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/companies/:id/compliance_items
      def compliance_items
        items = @company.corporate_company_compliance_items.order(:due_date)

        # Filter by status
        items = items.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          compliance_items: items.as_json(methods: [ :days_until_due, :formatted_compliance_type ])
        }
      end

      # GET /api/v1/companies/:id/activities
      def activities
        activities = @company.corporate_company_activities
          .includes(:user)
          .order(created_at: :desc)
          .limit(params[:limit]&.to_i || 50)

        render json: {
          success: true,
          activities: activities.as_json(
            methods: [ :formatted_activity_type, :performed_by_name, :time_ago ]
          )
        }
      end

      # GET /api/v1/companies/:id/documents
      def documents
        documents = @company.corporate_company_documents.order(created_at: :desc)

        # Filter by type
        documents = documents.by_type(params[:document_type]) if params[:document_type].present?

        render json: {
          success: true,
          documents: documents.as_json(methods: [ :formatted_document_type, :file_size_mb ])
        }
      end

      # GET /api/v1/companies/:id/assets
      def assets
        assets = @company.assets.includes(:asset_insurance).order(created_at: :desc)

        # Filter by type and status
        assets = assets.by_type(params[:asset_type]) if params[:asset_type].present?
        assets = assets.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          assets: assets.as_json(
            include: {
              asset_insurance: { methods: [ :days_until_renewal ] }
            },
            methods: [ :display_name, :needs_attention? ]
          )
        }
      end

      # GET /api/v1/companies/:id/hierarchy
      # Returns this company's position in the ownership hierarchy
      def hierarchy
        render json: {
          success: true,
          data: {
            company: {
              id: @company.id,
              name: @company.name,
              code: @company.code,
              is_trustee: @company.is_trustee,
              trust_name: @company.trust_name
            },
            parent: @company.parent_company ? serialize_company_brief(@company.parent_company) : nil,
            ancestors: @company.ancestors.map { |c| serialize_company_brief(c) },
            subsidiaries: @company.subsidiaries.order(:name).map { |c| serialize_company_brief(c) },
            descendants_count: @company.descendants.count,
            hierarchy_level: @company.hierarchy_level,
            is_root: @company.parent_company_id.nil?,
            root_company: @company.root_company != @company ? serialize_company_brief(@company.root_company) : nil
          }
        }
      end

      # GET /api/v1/companies/:id/shareholders
      # Returns all shareholders of this company
      def shareholders
        shareholdings = @company.corporate_company_shareholdings.includes(:shareholder)

        render json: {
          success: true,
          data: {
            total_shares: @company.shares_on_issue,
            shareholdings: shareholdings.map do |sh|
              {
                id: sh.id,
                shareholder_type: sh.shareholder_type,
                shareholder_id: sh.shareholder_id,
                shareholder_name: sh.shareholder_name,
                number_of_shares: sh.number_of_shares,
                percentage: sh.percentage_of_total,
                share_class: sh.share_class,
                beneficially_held: sh.beneficially_held,
                beneficial_owner: sh.beneficial_owner,
                acquisition_date: sh.acquisition_date,
                certificate_number: sh.certificate_number,
                consideration_paid: sh.consideration_paid
              }
            end
          }
        }
      end

      # GET /api/v1/companies/:id/investments
      # Returns companies that this company owns shares in
      def investments
        investments = @company.investments.includes(:corporate_company)

        render json: {
          success: true,
          data: {
            investments: investments.map do |inv|
              {
                id: inv.id,
                company_id: inv.company_id,
                company_name: inv.company&.name,
                company_acn: inv.company&.acn,
                number_of_shares: inv.number_of_shares,
                percentage: inv.percentage_of_total,
                share_class: inv.share_class,
                acquisition_date: inv.acquisition_date,
                consideration_paid: inv.consideration_paid
              }
            end,
            total_investments: investments.count
          }
        }
      end

      # GET /api/v1/companies/:id/trust_roles
      # Returns trustee, beneficiaries, and appointor for a trust entity
      # Works for both Trust entities AND Corporate Trustee entities
      def trust_roles
        # Determine if this is a Trust/Superfund or a Corporate Trustee
        is_trust = @company.entity_type.in?([ "Trust", "Superfund" ])
        is_trustee_company = @company.is_trustee && @company.trust_name.present?

        if !is_trust && !is_trustee_company
          return render json: {
            success: false,
            error: "This company is not a trust or corporate trustee"
          }, status: :unprocessable_entity
        end

        # For a Trust entity, find the corporate trustee
        # For a Corporate Trustee, find the trust it manages
        if is_trust
          trust = @company
          corporate_trustee = CorporateCompany.find_by(trust_name: @company.name, is_trustee: true)
        else
          corporate_trustee = @company
          trust = CorporateCompany.find_by(name: @company.trust_name)
        end

        # Get trust roles from ContactCorporateGroupMemberships
        trust_group_id = trust&.company_group_id || @company.company_group_id
        memberships = ContactCorporateGroupMembership
          .where(company_group_id: trust_group_id, membership_type: [ "beneficiary", "appointor", "trustee" ])
          .includes(:contact)

        beneficiaries = memberships.select { |m| m.membership_type == "beneficiary" }
        appointors = memberships.select { |m| m.membership_type == "appointor" }

        # Also check ContactRelationships for trust roles
        contact_relationships = ContactRelationship
          .trust_roles
          .includes(:contact, :related_contact)

        render json: {
          success: true,
          data: {
            trust: trust ? serialize_trust_brief(trust) : nil,
            corporate_trustee: corporate_trustee ? serialize_company_brief(corporate_trustee) : nil,
            beneficiaries: beneficiaries.map { |m| serialize_membership_contact(m) },
            appointors: appointors.map { |m| serialize_membership_contact(m) },
            contact_relationships: contact_relationships.map { |cr| serialize_contact_relationship(cr) }
          }
        }
      end

      # POST /api/v1/companies/import
      def import
        # Handle Excel import (to be implemented with CompanyImportService)
        if params[:file].blank?
          return render json: { success: false, error: "No file provided" }, status: :unprocessable_entity
        end

        # This will be implemented later with the CompanyImportService
        render json: {
          success: true,
          message: "Import functionality coming soon"
        }
      end

      # POST /api/v1/companies/reload
      def reload
        file_path = ENV["CORPORATE_FILE_PATH"] || "/Users/robertharder/Library/CloudStorage/OneDrive-Tekna/Accounts - Internal/Corporate File/Corporate File.xlsx"

        unless File.exist?(file_path)
          return render json: { success: false, error: "Corporate File not found" }, status: :unprocessable_entity
        end

        service = CompanyImportService.new(file_path)
        result = service.reload_all

        render json: {
          success: true,
          message: "Company data reloaded from spreadsheet",
          result: result
        }
      rescue StandardError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/companies/health_report
      def health_report
        report = CompanyImportService.health_report

        summary = {
          total: report.count,
          excellent: report.count { |r| r[:health_status] == "excellent" },
          good: report.count { |r| r[:health_status] == "good" },
          needs_attention: report.count { |r| r[:health_status] == "needs_attention" },
          critical: report.count { |r| r[:health_status] == "critical" },
          average_score: report.any? ? (report.sum { |r| r[:health_score] } / report.count.to_f).round(1) : 0
        }

        render json: {
          success: true,
          summary: summary,
          companies: report
        }
      end

      # GET /api/v1/companies/:id/health
      # Returns health score for a single company (fast endpoint - loads only one company)
      def health
        health_data = CompanyImportService.company_health(@company.id)

        if health_data
          render json: {
            success: true,
            health: health_data
          }
        else
          render json: { success: false, error: "Could not calculate health" }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/companies/:id/data_stats
      # Returns data warehouse statistics for a company
      def data_stats
        # Document statistics
        documents = @company.corporate_company_documents
        doc_stats = {
          total_documents: documents.count,
          by_source: documents.group(:source).count,
          by_folder: documents.group(:folder).count,
          by_document_type: documents.group(:document_type).count,
          by_ai_status: documents.group(:ai_verification_status).count,
          with_files: documents.where.not(file_url: [ nil, "" ]).count,
          verified: documents.where(ai_verification_status: "verified").count,
          needs_review: documents.where(ai_verification_status: %w[mismatch needs_review pending]).count,
          latest_upload: documents.maximum(:created_at),
          oldest_document: documents.minimum(:document_date),
          newest_document: documents.maximum(:document_date),
          financial_years: documents.pluck(:financial_years).flatten.compact.uniq.sort.reverse.first(5),
          total_file_size: documents.sum(:file_size) || 0
        }

        # Document types breakdown
        doc_type_stats = documents
          .joins("LEFT JOIN document_types ON document_types.name = corporate_company_documents.document_type")
          .select("corporate_company_documents.document_type, document_types.abbreviation, COUNT(*) as count")
          .group("corporate_company_documents.document_type, document_types.abbreviation")
          .map { |d| { type: d.document_type, abbreviation: d.abbreviation, count: d.count } }

        # OneDrive sync status
        onedrive_docs = documents.where(source: "onedrive")
        onedrive_stats = {
          total: onedrive_docs.count,
          last_synced: onedrive_docs.maximum(:synced_at),
          by_folder: onedrive_docs.group(:folder).count
        }

        # Xero connection stats - SSoT: Use XeroConnectionHealth
        xero_connection = @company.corporate_company_xero_connection
        xero_stats = if xero_connection
          health = xero_connection.health_status
          {
            connected: health.connected,
            tenant_name: xero_connection.xero_tenant_name,
            last_sync: xero_connection.last_sync_at,
            status: health.display_status
          }
        else
          { connected: false }
        end

        # SharePoint folder path
        sharepoint_stats = {
          folder_url: @company.sharepoint_folder_url,
          has_folder: @company.sharepoint_folder_url.present?
        }

        # File types (CAD/BIM from job_documents if this company has associated jobs)
        # For now, just company documents file breakdown
        file_extensions = documents.where.not(file_url: nil)
          .pluck(:title)
          .map { |t| File.extname(t.to_s).downcase }
          .compact
          .reject(&:empty?)
          .tally
          .sort_by { |_, count| -count }
          .first(10)
          .to_h

        render json: {
          success: true,
          data: {
            company: {
              id: @company.id,
              name: @company.name,
              code: @company.code
            },
            documents: doc_stats,
            document_types: doc_type_stats,
            onedrive: onedrive_stats,
            xero: xero_stats,
            sharepoint: sharepoint_stats,
            file_extensions: file_extensions,
            last_updated: Time.current
          }
        }
      end

      # GET /api/v1/companies/:id/warehouse_health
      # Returns data warehouse health checks for a company
      def warehouse_health
        checks = []

        # 1. Documents Health Check
        documents = @company.corporate_company_documents
        total_docs = documents.count
        verified_docs = documents.where(ai_verification_status: "verified").count
        doc_rate = total_docs > 0 ? (verified_docs.to_f / total_docs * 100).round(1) : 0

        checks << {
          id: "documents_verified",
          name: "Document Verification",
          category: "documents",
          description: "Documents verified by AI",
          value: verified_docs,
          total: total_docs,
          percentage: doc_rate,
          status: doc_rate >= 90 ? "pass" : doc_rate >= 70 ? "warning" : "fail",
          action: doc_rate < 90 ? "Run AI verification on pending documents" : nil
        }

        # 2. Documents with Files
        docs_with_files = documents.where.not(file_url: [ nil, "" ]).count
        file_rate = total_docs > 0 ? (docs_with_files.to_f / total_docs * 100).round(1) : 100

        checks << {
          id: "documents_stored",
          name: "Documents Stored",
          category: "documents",
          description: "Documents with files in cloud storage",
          value: docs_with_files,
          total: total_docs,
          percentage: file_rate,
          status: file_rate >= 95 ? "pass" : file_rate >= 80 ? "warning" : "fail",
          action: file_rate < 95 ? "Upload missing document files" : nil
        }

        # 3. SharePoint/OneDrive Connection
        has_sharepoint = @company.sharepoint_folder_url.present?
        onedrive_docs = documents.where(source: "onedrive").count

        checks << {
          id: "sharepoint_connected",
          name: "SharePoint Connected",
          category: "integrations",
          description: "Company folder linked to SharePoint",
          value: has_sharepoint ? 1 : 0,
          total: 1,
          percentage: has_sharepoint ? 100 : 0,
          status: has_sharepoint ? "pass" : "fail",
          action: has_sharepoint ? nil : "Connect company to SharePoint folder",
          extra: { synced_documents: onedrive_docs }
        }

        # 4. Xero Connection - SSoT: Use connected? which delegates to XeroConnectionHealth
        xero = @company.corporate_company_xero_connection
        xero_connected = xero&.connected?
        xero_last_sync = xero&.last_sync_at
        xero_stale = xero_last_sync.nil? || xero_last_sync < 24.hours.ago

        checks << {
          id: "xero_connected",
          name: "Xero Connected",
          category: "integrations",
          description: "Company linked to Xero accounting",
          value: xero_connected ? 1 : 0,
          total: 1,
          percentage: xero_connected ? 100 : 0,
          status: xero_connected ? (xero_stale ? "warning" : "pass") : "fail",
          action: xero_connected ? (xero_stale ? "Refresh Xero sync" : nil) : "Connect company to Xero",
          extra: { tenant_name: xero&.xero_tenant_name, last_sync: xero_last_sync }
        }

        # 5. Contacts Linked
        contacts = @company.contacts
        total_contacts = contacts.count
        contacts_with_email = contacts.where.not(email: [ nil, "" ]).count
        contacts_with_phone = contacts.where.not(phone: [ nil, "" ]).or(contacts.where.not(mobile: [ nil, "" ])).count
        contact_complete_rate = total_contacts > 0 ? ((contacts_with_email + contacts_with_phone).to_f / (total_contacts * 2) * 100).round(1) : 100

        checks << {
          id: "contacts_complete",
          name: "Contact Information",
          category: "contacts",
          description: "Contacts with email and phone",
          value: [ contacts_with_email, contacts_with_phone ].min,
          total: total_contacts,
          percentage: contact_complete_rate,
          status: contact_complete_rate >= 80 ? "pass" : contact_complete_rate >= 50 ? "warning" : "fail",
          action: contact_complete_rate < 80 ? "Complete missing contact details" : nil,
          extra: { with_email: contacts_with_email, with_phone: contacts_with_phone }
        }

        # 6. Emails Linked (check if any emails reference this company)
        # Email linking is done through contacts associated with this company
        company_contact_emails = contacts.pluck(:email).compact.reject(&:empty?)
        linked_emails = company_contact_emails.any? ?
          EmailWarehouse.where("from_email IN (?) OR to_emails && ARRAY[?]::text[]",
                               company_contact_emails, company_contact_emails).count : 0

        checks << {
          id: "emails_linked",
          name: "Emails Linked",
          category: "emails",
          description: "Emails linked via company contacts",
          value: linked_emails,
          total: nil,
          percentage: nil,
          status: linked_emails > 0 ? "pass" : "info",
          action: linked_emails == 0 ? "Add contact emails to capture correspondence" : nil
        }

        # 7. Document Types Coverage
        expected_types = %w[ASIC ATO Bank Financial\ Statements Company\ Tax\ Return]
        doc_types_present = documents.pluck(:document_type).compact.uniq
        types_found = expected_types.count { |t| doc_types_present.include?(t) }
        type_coverage = (types_found.to_f / expected_types.count * 100).round(1)

        checks << {
          id: "document_types",
          name: "Document Types Coverage",
          category: "documents",
          description: "Core document types present",
          value: types_found,
          total: expected_types.count,
          percentage: type_coverage,
          status: type_coverage >= 80 ? "pass" : type_coverage >= 40 ? "warning" : "info",
          action: type_coverage < 80 ? "Upload missing document types: #{(expected_types - doc_types_present).join(', ')}" : nil,
          extra: { present: doc_types_present & expected_types, missing: expected_types - doc_types_present }
        }

        # 8. Bank Accounts (if applicable)
        bank_accounts = @company.bank_accounts
        has_bank = bank_accounts.count > 0
        bank_with_feeds = bank_accounts.where(has_bank_feed: true).count if has_bank

        if has_bank
          checks << {
            id: "bank_feeds",
            name: "Bank Feed Connected",
            category: "integrations",
            description: "Bank accounts with live feeds",
            value: bank_with_feeds || 0,
            total: bank_accounts.count,
            percentage: (bank_with_feeds.to_f / bank_accounts.count * 100).round(1),
            status: bank_with_feeds == bank_accounts.count ? "pass" : bank_with_feeds > 0 ? "warning" : "info",
            action: bank_with_feeds < bank_accounts.count ? "Connect bank feeds for remaining accounts" : nil
          }
        end

        # Calculate overall health score
        scored_checks = checks.select { |c| c[:percentage].present? }
        overall_score = scored_checks.any? ?
          (scored_checks.sum { |c| c[:percentage] } / scored_checks.count).round(1) : 100

        # Summary by status
        summary = {
          total_checks: checks.count,
          passing: checks.count { |c| c[:status] == "pass" },
          warnings: checks.count { |c| c[:status] == "warning" },
          failing: checks.count { |c| c[:status] == "fail" },
          info: checks.count { |c| c[:status] == "info" },
          overall_score: overall_score,
          health_status: overall_score >= 80 ? "healthy" : overall_score >= 50 ? "needs_attention" : "critical"
        }

        render json: {
          success: true,
          company: {
            id: @company.id,
            name: @company.name,
            code: @company.code
          },
          summary: summary,
          checks: checks,
          last_updated: Time.current
        }
      end

      # GET /api/v1/companies/xero_setup_overview
      # Returns Xero setup progress for all companies (admin overview)
      # Uses only local database queries - no Xero API calls for performance
      def xero_setup_overview
        companies = CorporateCompany
          .includes(:corporate_company_xero_connection, :bank_accounts)
          .order(:name)

        # Pre-fetch contact link counts by tenant_id for efficiency
        tenant_ids = companies
          .filter_map { |c| c.corporate_company_xero_connection&.xero_tenant_id }
          .compact

        contacts_by_tenant = ContactExternalLink
          .where(provider: "xero", sync_enabled: true, external_tenant_id: tenant_ids)
          .group(:external_tenant_id)
          .count

        render json: {
          success: true,
          companies: companies.map do |company|
            connection = company.corporate_company_xero_connection
            connected = connection&.connected? || false
            tenant_id = connection&.xero_tenant_id

            # Count bank accounts linked to Xero
            bank_accounts_linked = company.bank_accounts.where.not(xero_account_id: nil).count

            # Count contacts synced (from pre-fetched data)
            contacts_synced = tenant_id ? (contacts_by_tenant[tenant_id] || 0) : 0

            # Calculate setup progress (0-4 steps)
            # Steps: 1. Connected, 2. Has tenant, 3. Bank accounts linked, 4. Contacts synced
            steps_complete = 0
            steps_complete += 1 if connected
            steps_complete += 1 if tenant_id.present?
            steps_complete += 1 if bank_accounts_linked > 0
            steps_complete += 1 if contacts_synced > 0

            {
              id: company.id,
              name: company.name,
              entity_type: company.entity_type,
              connected: connected,
              xero_tenant_name: connection&.xero_tenant_name,
              xero_tenant_id: tenant_id,
              last_sync_at: connection&.last_sync_at,
              bank_accounts_linked: bank_accounts_linked,
              contacts_synced: contacts_synced,
              steps_complete: steps_complete,
              steps_total: 4,
              setup_progress: connected ? (steps_complete.to_f / 4 * 100).round : 0
            }
          end,
          summary: {
            total: companies.count,
            connected: companies.count { |c| c.corporate_company_xero_connection&.connected? },
            with_bank_accounts: companies.count { |c| c.bank_accounts.where.not(xero_account_id: nil).exists? },
            with_contacts: contacts_by_tenant.values.count { |v| v > 0 }
          }
        }
      end

      # GET /api/v1/companies/asic_logins
      # Returns all companies' ASIC login credentials for table view
      # Only shows entity_type = Company (excludes Person, Trust, Superfund)
      def asic_logins
        @companies = CorporateCompany.where(entity_type: [ "Company", "company" ]).order(:name)

        # Filter by company group
        if params[:company_group_id].present?
          @companies = @companies.where(company_group_id: params[:company_group_id])
        end

        # Only include companies with ASIC credentials
        if params[:with_credentials] == "true"
          @companies = @companies.where.not(asic_username: [ nil, "" ])
        end

        render json: {
          success: true,
          companies: @companies.map do |company|
            {
              id: company.id,
              name: company.name,
              acn: company.acn,
              formatted_acn: company.formatted_acn,
              company_group_id: company.company_group_id,
              company_group_name: company.corporate_group&.name,
              corporate_key: company.corporate_key,
              asic_username: company.asic_username,
              asic_password: company.encrypted_asic_password,
              recovery_question: company.recovery_question,
              recovery_answer: company.encrypted_recovery_answer,
              has_credentials: company.asic_username.present?
            }
          end,
          total: @companies.count
        }
      end

      private

      def set_company
        @company = CorporateCompany.find_by_slug_or_id(params[:id])
        unless @company
          render json: { success: false, error: "Company not found" }, status: :not_found
        end
      end

      def company_params
        params.require(:company).permit(
          :name, :company_group, :code, :acn, :abn, :tfn, :date_incorporated, :purpose, :status,
          :registered_office_address, :principal_place_of_business, :is_trustee, :trust_name,
          :corporate_key, :asic_username, :encrypted_asic_password, :recovery_question,
          :encrypted_recovery_answer, :review_date, :gst_registration_status, :accounting_method,
          :shares_on_issue, :carry_forward_losses, :franking_balance, :amount_owing, :entity_type,
          :bank_name, :bank_bsb, :bank_account_number, :bank_account_name, :bank_start_date, :bank_end_date,
          :consolidation_parent_id, :company_group_id, :parent_company_id, :business_names,
          metadata: {},
          previous_names: []
        )
      end

      def director_params
        params.permit(:position, :appointment_date, :resignation_date, :notes)
      end

      def serialize_company_brief(company)
        {
          id: company.id,
          name: company.name,
          code: company.code,
          acn: company.acn,
          is_trustee: company.is_trustee,
          trust_name: company.trust_name
        }
      end

      def serialize_trust_brief(company)
        {
          id: company.id,
          name: company.name,
          entity_type: company.entity_type,
          status: company.status,
          company_group_id: company.company_group_id,
          date_incorporated: company.date_incorporated
        }
      end

      def serialize_membership_contact(membership)
        {
          membership_id: membership.id,
          contact_id: membership.contact_id,
          contact_name: membership.contact&.display_name,
          contact_email: membership.contact&.email,
          contact_entity_type: membership.contact&.entity_type,
          membership_type: membership.membership_type,
          beneficiary_type: membership.beneficiary_type,
          class_description: membership.class_description,
          can_view_confidential: membership.can_view_confidential,
          is_active: membership.is_active
        }
      end

      def serialize_contact_relationship(relationship)
        {
          id: relationship.id,
          contact_id: relationship.contact_id,
          contact_name: relationship.contact&.display_name,
          related_contact_id: relationship.related_contact_id,
          related_contact_name: relationship.related_contact&.display_name,
          relationship_type: relationship.relationship_type,
          ownership_percentage: relationship.ownership_percentage,
          start_date: relationship.start_date,
          end_date: relationship.end_date,
          is_current: relationship.is_current
        }
      end
    end
  end
end

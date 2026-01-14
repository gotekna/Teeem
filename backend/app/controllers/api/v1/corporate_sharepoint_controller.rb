module Api
  module V1
    # RENAMED: CorporateOnedriveController → CorporateSharepointController
    # SSoT: Uses DocumentProviderAware for provider-agnostic storage when possible
    class CorporateSharepointController < ApplicationController
      include DocumentProviderAware

      skip_before_action :authorize_request, only: [ :import_documents ]
      before_action :verify_import_token, only: [ :import_documents ]
      before_action :set_credential, except: [ :import_documents ]

      # GET /api/v1/corporate_onedrive/status
      # Check if OneDrive is connected and corporate folder exists
      def status
        unless @credential
          return render json: {
            connected: false,
            error: "SharePoint not connected. Please connect via Settings > Integrations."
          }
        end

        service = CorporateOnedriveService.new(@credential, folder_path: params[:folder_path])
        preview = service.preview

        render json: {
          connected: true,
          corporate_folder: service.folder_path,
          folder_exists: preview[:success],
          error: preview[:error],
          company_folders: preview[:total_folders],
          matched_companies: preview[:matched_folders],
          total_documents: preview[:total_documents]
        }
      end

      # GET /api/v1/corporate_onedrive/preview
      # Preview what documents would be scanned
      def preview
        unless @credential
          return render json: { success: false, error: "SharePoint not connected" }
        end

        service = CorporateOnedriveService.new(@credential, folder_path: params[:folder_path])
        result = service.preview

        render json: result
      end

      # POST /api/v1/corporate_onedrive/scan
      # Scan all companies and link documents
      def scan
        unless @credential
          return render json: { success: false, error: "SharePoint not connected" }
        end

        service = CorporateOnedriveService.new(@credential, folder_path: params[:folder_path])
        result = service.scan_all

        render json: result
      end

      # POST /api/v1/corporate_onedrive/scan_company
      # Scan a specific company's folder
      def scan_company
        unless @credential
          return render json: { success: false, error: "SharePoint not connected" }
        end

        company = CorporateCompany.find(params[:company_id])
        service = CorporateOnedriveService.new(@credential, folder_path: params[:folder_path])
        result = service.scan_company(company)

        render json: result
      end

      # POST /api/v1/corporate_onedrive/import_documents
      # Import document metadata from JSON
      def import_documents
        docs = params[:documents]
        unless docs.is_a?(Array)
          return render json: { success: false, error: "documents must be an array" }
        end

        imported = 0
        errors = []

        docs.each do |doc|
          company = CorporateCompany.find_by(name: doc[:company_name])
          unless company
            errors << "Company not found: #{doc[:company_name]}"
            next
          end

          company_doc = CorporateCompanyDocument.find_or_initialize_by(
            company: company,
            title: doc[:title]
          )

          company_doc.assign_attributes(
            document_type: doc[:document_type],
            document_date: doc[:document_date],
            storage_type: doc[:storage_type],
            description: doc[:description],
            expected_sharepoint_path: doc[:expected_sharepoint_path],
            register_folder: doc[:register_folder]
          )

          if company_doc.save
            imported += 1
          else
            errors << "#{doc[:title]}: #{company_doc.errors.full_messages.join(', ')}"
          end
        end

        render json: {
          success: true,
          imported: imported,
          errors: errors,
          total_documents: CorporateCompanyDocument.count
        }
      end

      # GET /api/v1/corporate_onedrive/browse
      # Browse storage folders (provider-agnostic)
      # SSoT: Uses DocumentProviderAware for provider-agnostic folder listing
      def browse
        begin
          setup_default_provider!
        rescue DocumentProviders::NotConnectedError => e
          return render json: { success: false, error: "Storage not connected: #{e.message}" }
        end

        path = params[:path] || ""
        folder_path = path.blank? ? "/" : "/#{path}"

        begin
          items = list_folder_in_provider(folder_path, folders_only: true)

          render json: {
            success: true,
            path: path,
            provider: current_provider_type.to_s,
            folders: items.map { |f| { name: f[:name], id: f[:id] } }
          }
        rescue DocumentProviders::Error => e
          render json: { success: false, error: e.message }
        end
      end

      private

      def set_credential
        @credential = MicrosoftCredential.sharepoint_credential
      end

      def verify_import_token
        import_token = ENV["CORPORATE_IMPORT_TOKEN"] || "teeem-import-2024"
        provided_token = params[:token] || request.headers["X-Import-Token"]

        unless provided_token == import_token
          render json: { success: false, error: "Invalid import token" }, status: :unauthorized
        end
      end
    end
  end
end

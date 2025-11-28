module Api
  module V1
    class CorporateOnedriveController < ApplicationController
      before_action :set_credential

      # GET /api/v1/corporate_onedrive/status
      # Check if OneDrive is connected and corporate folder exists
      def status
        unless @credential
          return render json: {
            connected: false,
            error: "OneDrive not connected. Please connect via Settings > Integrations."
          }
        end

        service = CorporateOnedriveService.new(@credential)
        preview = service.preview

        render json: {
          connected: true,
          corporate_folder: CorporateOnedriveService::CORPORATE_ROOT_FOLDER,
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
          return render json: { success: false, error: "OneDrive not connected" }
        end

        service = CorporateOnedriveService.new(@credential)
        result = service.preview

        render json: result
      end

      # POST /api/v1/corporate_onedrive/scan
      # Scan all companies and link documents
      def scan
        unless @credential
          return render json: { success: false, error: "OneDrive not connected" }
        end

        service = CorporateOnedriveService.new(@credential)
        result = service.scan_all

        render json: result
      end

      # POST /api/v1/corporate_onedrive/scan_company
      # Scan a specific company's folder
      def scan_company
        unless @credential
          return render json: { success: false, error: "OneDrive not connected" }
        end

        company = Company.find(params[:company_id])
        service = CorporateOnedriveService.new(@credential)
        result = service.scan_company(company)

        render json: result
      end

      private

      def set_credential
        @credential = OrganizationOneDriveCredential.active_credential
      end
    end
  end
end

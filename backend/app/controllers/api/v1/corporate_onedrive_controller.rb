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
          return render json: { success: false, error: "OneDrive not connected" }
        end

        service = CorporateOnedriveService.new(@credential, folder_path: params[:folder_path])
        result = service.preview

        render json: result
      end

      # POST /api/v1/corporate_onedrive/scan
      # Scan all companies and link documents
      def scan
        unless @credential
          return render json: { success: false, error: "OneDrive not connected" }
        end

        service = CorporateOnedriveService.new(@credential, folder_path: params[:folder_path])
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
        service = CorporateOnedriveService.new(@credential, folder_path: params[:folder_path])
        result = service.scan_company(company)

        render json: result
      end

      # GET /api/v1/corporate_onedrive/browse
      # Browse OneDrive folders
      def browse
        unless @credential
          return render json: { success: false, error: "OneDrive not connected" }
        end

        client = MicrosoftGraphClient.new(@credential)
        path = params[:path] || ""

        if path.blank?
          response = client.get("/me/drive/root/children")
        else
          encoded_path = path.split('/').map { |p| CGI.escape(p) }.join('/')
          response = client.get("/me/drive/root:/#{encoded_path}:/children")
        end

        folders = (response['value'] || []).select { |item| item['folder'] }

        render json: {
          success: true,
          path: path,
          folders: folders.map { |f| { name: f['name'], id: f['id'] } }
        }
      rescue MicrosoftGraphClient::APIError => e
        render json: { success: false, error: e.message }
      end

      private

      def set_credential
        @credential = OrganizationOneDriveCredential.active_credential
      end
    end
  end
end

module Api
  module V1
    class AsicController < ApplicationController
      # GET /api/v1/asic/lookup_abn?abn=12345678901
      def lookup_abn
        abn = params[:abn]

        if abn.blank?
          return render json: { success: false, error: "ABN is required" }, status: :bad_request
        end

        service = AsicLookupService.new
        result = service.lookup_by_abn(abn)

        if result[:success]
          render json: result
        else
          render json: result, status: :unprocessable_entity
        end
      end

      # GET /api/v1/asic/lookup_acn?acn=123456789
      def lookup_acn
        acn = params[:acn]

        if acn.blank?
          return render json: { success: false, error: "ACN is required" }, status: :bad_request
        end

        service = AsicLookupService.new
        result = service.lookup_by_acn(acn)

        if result[:success]
          render json: result
        else
          render json: result, status: :unprocessable_entity
        end
      end

      # GET /api/v1/asic/search?name=company+name&state=NSW&postcode=2000
      def search
        name = params[:name]

        if name.blank?
          return render json: { success: false, error: "Name is required" }, status: :bad_request
        end

        service = AsicLookupService.new
        result = service.search_by_name(name, state: params[:state], postcode: params[:postcode])

        if result[:success]
          render json: result
        else
          render json: result, status: :unprocessable_entity
        end
      end

      # GET /api/v1/asic/validate_abn?abn=12345678901
      def validate_abn
        abn = params[:abn]

        if abn.blank?
          return render json: { success: false, error: "ABN is required" }, status: :bad_request
        end

        valid = AsicLookupService.valid_abn?(abn)
        render json: { success: true, valid: valid, abn: abn }
      end

      # GET /api/v1/asic/validate_acn?acn=123456789
      def validate_acn
        acn = params[:acn]

        if acn.blank?
          return render json: { success: false, error: "ACN is required" }, status: :bad_request
        end

        valid = AsicLookupService.valid_acn?(acn)
        render json: { success: true, valid: valid, acn: acn }
      end

      # POST /api/v1/asic/auto_populate
      # Takes ABN or ACN and returns data formatted for company form
      def auto_populate
        abn = params[:abn]
        acn = params[:acn]

        if abn.blank? && acn.blank?
          return render json: { success: false, error: "ABN or ACN is required" }, status: :bad_request
        end

        service = AsicLookupService.new

        # Try ABN first, then ACN
        if abn.present?
          result = service.lookup_by_abn(abn)
        else
          result = service.lookup_by_acn(acn)
        end

        unless result[:success]
          return render json: result, status: :unprocessable_entity
        end

        # Format data for company form
        data = result[:data]

        form_data = {
          name: data[:name],
          abn: data[:abn]&.gsub(/\s/, ""),
          acn: data[:acn]&.gsub(/\s/, ""),
          entity_type: map_entity_type(data[:entity_type_code]),
          gst_registration_status: data[:gst_registered] ? "registered" : "not_registered",
          gst_registration_date: data[:gst_effective_from],
          registered_address: data[:registered_address] || data[:main_business_location],
          trading_names: data[:trading_names]&.map { |t| t[:name] }&.compact&.join(", "),
          status: data[:status] == "ACT" ? "active" : "inactive",
          raw_data: data
        }

        render json: { success: true, form_data: form_data }
      end

      private

      def map_entity_type(code)
        # Map ABR entity type codes to our entity types
        case code
        when "PRV" then "proprietary_limited"
        when "PUB" then "public"
        when "OIE" then "other"
        when "TRT" then "trust"
        when "IND" then "sole_trader"
        when "PTR" then "partnership"
        else "other"
        end
      end
    end
  end
end

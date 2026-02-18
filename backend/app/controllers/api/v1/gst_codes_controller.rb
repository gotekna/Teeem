module Api
  module V1
    class GstCodesController < ApplicationController
      before_action :set_gst_code, only: [:update, :destroy]

      # GET /api/v1/gst_codes
      def index
        codes = GstCode.ordered

        # Optionally filter by active only (default: all)
        codes = codes.active if params[:active] == "true"

        render json: {
          success: true,
          gst_codes: codes.map { |gc| gst_code_json(gc) }
        }
      end

      # POST /api/v1/gst_codes
      def create
        gst_code = GstCode.new(gst_code_params)

        if gst_code.save
          render json: {
            success: true,
            gst_code: gst_code_json(gst_code),
            message: "GST code '#{gst_code.code}' created successfully"
          }, status: :created
        else
          render_validation_errors(gst_code)
        end
      end

      # PUT /api/v1/gst_codes/:id
      def update
        if @gst_code.update(gst_code_params)
          render json: {
            success: true,
            gst_code: gst_code_json(@gst_code),
            message: "GST code '#{@gst_code.code}' updated successfully"
          }
        else
          render_validation_errors(@gst_code)
        end
      end

      # DELETE /api/v1/gst_codes/:id
      def destroy
        @gst_code.update!(active: false)

        render json: {
          success: true,
          message: "GST code '#{@gst_code.code}' deactivated"
        }
      end

      # POST /api/v1/gst_codes/sync_from_xero
      # Fetches tax rates from Xero and upserts into gst_codes table
      def sync_from_xero
        client = XeroApiClient.new
        result = client.get_tax_rates

        unless result[:success]
          render_error("Failed to fetch tax rates from Xero: #{result[:error]}", status: :unprocessable_entity)
          return
        end

        xero_rates = result[:tax_rates]
        created = []
        updated = []

        xero_rates.each do |xero_rate|
          tax_type = xero_rate.tax_type  # e.g. "INPUT", "OUTPUT", "INPUT2"
          rate_pct = xero_rate.rate.to_f / 100.0  # Xero returns 10.0 → we store 0.10
          xero_name = xero_rate.name

          # Find existing GstCode that already maps this Xero tax type
          existing = GstCode.where("xero_tax_types LIKE ?", "%#{tax_type}%").first

          if existing
            # Update rate if Xero's rate differs
            if existing.rate.to_f != rate_pct
              existing.update!(rate: rate_pct)
              updated << { code: existing.code, tax_type: tax_type, rate: rate_pct }
            end
          else
            # Create a new GstCode for this unmapped Xero tax type
            gst_code = GstCode.create!(
              code: xero_name,
              name: "#{xero_name} (#{xero_rate.rate}%)",
              rate: rate_pct,
              xero_tax_types: tax_type,
              active: true,
              position: GstCode.maximum(:position).to_i + 1
            )
            created << { code: gst_code.code, tax_type: tax_type, rate: rate_pct }
          end
        end

        render json: {
          success: true,
          xero_rates_fetched: xero_rates.length,
          created: created,
          updated: updated,
          message: "Synced #{created.length} new, #{updated.length} updated from #{xero_rates.length} Xero tax rates"
        }
      rescue XeroApiClient::AuthenticationError => e
        render_error("Not authenticated with Xero: #{e.message}", status: :unauthorized)
      rescue StandardError => e
        Rails.logger.error("[GstCodes] Xero sync failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
        render_error("Xero sync failed: #{e.message}", status: :internal_server_error)
      end

      private

      def set_gst_code
        @gst_code = GstCode.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render_error("GST code not found", status: :not_found)
      end

      def gst_code_params
        params.require(:gst_code).permit(:code, :name, :rate, :xero_tax_types, :active, :position)
      end

      def gst_code_json(gc)
        {
          id: gc.id,
          code: gc.code,
          name: gc.name,
          rate: gc.rate.to_f,
          xero_tax_types: gc.xero_tax_types,
          active: gc.active,
          position: gc.position,
          created_at: gc.created_at,
          updated_at: gc.updated_at
        }
      end
    end
  end
end

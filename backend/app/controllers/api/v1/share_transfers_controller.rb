module Api
  module V1
    class ShareTransfersController < ApplicationController
      before_action :set_company
      before_action :set_share_transfer, only: [ :show, :update, :destroy ]

      # GET /api/v1/companies/:company_id/share_transfers
      def index
        @transfers = @company.share_transfers
                             .includes(:from_shareholder, :to_shareholder)
                             .order(transfer_date: :desc)

        # Filter by shareholder
        if params[:shareholder_id].present?
          @transfers = @transfers.where(
            "from_shareholder_id = ? OR to_shareholder_id = ?",
            params[:shareholder_id],
            params[:shareholder_id]
          )
        end

        # Filter by date range
        if params[:from_date].present?
          @transfers = @transfers.where("transfer_date >= ?", params[:from_date])
        end
        if params[:to_date].present?
          @transfers = @transfers.where("transfer_date <= ?", params[:to_date])
        end

        render json: {
          success: true,
          data: @transfers.map { |t| serialize_transfer(t) }
        }
      end

      # GET /api/v1/companies/:company_id/share_transfers/:id
      def show
        render json: {
          success: true,
          data: serialize_transfer(@share_transfer, include_details: true)
        }
      end

      # POST /api/v1/companies/:company_id/share_transfers
      def create
        @share_transfer = @company.share_transfers.new(share_transfer_params)

        if @share_transfer.save
          render json: {
            success: true,
            data: serialize_transfer(@share_transfer)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @share_transfer.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/companies/:company_id/share_transfers/:id
      def update
        if @share_transfer.update(share_transfer_params)
          render json: {
            success: true,
            data: serialize_transfer(@share_transfer)
          }
        else
          render json: {
            success: false,
            errors: @share_transfer.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/companies/:company_id/share_transfers/:id
      def destroy
        @share_transfer.destroy
        render json: { success: true }
      end

      private

      def set_company
        @company = Corporate.find(params[:company_id])
      end

      def set_share_transfer
        @share_transfer = @company.share_transfers.find(params[:id])
      end

      def share_transfer_params
        params.require(:share_transfer).permit(
          :from_shareholder_id,
          :to_shareholder_id,
          :share_class,
          :number_of_shares,
          :consideration,
          :transfer_date,
          :document_reference,
          :notes
        )
      end

      def serialize_transfer(transfer, include_details: false)
        data = {
          id: transfer.id,
          company_id: transfer.company_id,
          from_shareholder_id: transfer.from_shareholder_id,
          from_shareholder_name: transfer.from_shareholder&.display_name,
          to_shareholder_id: transfer.to_shareholder_id,
          to_shareholder_name: transfer.to_shareholder.display_name,
          share_class: transfer.share_class,
          number_of_shares: transfer.number_of_shares,
          consideration: transfer.consideration,
          transfer_date: transfer.transfer_date,
          document_reference: transfer.document_reference,
          notes: transfer.notes,
          created_at: transfer.created_at,
          updated_at: transfer.updated_at
        }

        if include_details
          data[:from_shareholder] = transfer.from_shareholder ? {
            id: transfer.from_shareholder.id,
            display_name: transfer.from_shareholder.display_name,
            entity_type: transfer.from_shareholder.entity_type
          } : nil

          data[:to_shareholder] = {
            id: transfer.to_shareholder.id,
            display_name: transfer.to_shareholder.display_name,
            entity_type: transfer.to_shareholder.entity_type
          }
        end

        data
      end
    end
  end
end

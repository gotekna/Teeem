module Api
  module V1
    class CorporateShareholdingsController < ApplicationController
      before_action :set_company
      before_action :set_shareholding, only: [ :show, :update, :destroy ]

      # GET /api/v1/companies/:company_id/shareholdings
      def index
        @shareholdings = @company.corporate_shareholdings
                                 .includes(:shareholder)
                                 .order(:share_class, :created_at)

        render json: {
          success: true,
          shareholdings: @shareholdings.map { |s| serialize_shareholding(s) },
          summary: shareholding_summary
        }
      end

      # GET /api/v1/companies/:company_id/shareholdings/:id
      def show
        render json: {
          success: true,
          data: serialize_shareholding(@shareholding, include_details: true)
        }
      end

      # POST /api/v1/companies/:company_id/shareholdings
      def create
        @shareholding = @company.corporate_shareholdings.new(shareholding_params)

        if @shareholding.save
          render json: {
            success: true,
            data: serialize_shareholding(@shareholding)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @shareholding.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/companies/:company_id/shareholdings/:id
      def update
        if @shareholding.update(shareholding_params)
          render json: {
            success: true,
            data: serialize_shareholding(@shareholding)
          }
        else
          render json: {
            success: false,
            errors: @shareholding.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/companies/:company_id/shareholdings/:id
      def destroy
        @shareholding.destroy
        render json: { success: true }
      end

      # POST /api/v1/companies/:company_id/shareholdings/transfer
      # Transfer shares between shareholders
      def transfer
        from_shareholding = @company.corporate_shareholdings.find(params[:from_shareholding_id])
        to_shareholder = Contact.find(params[:to_shareholder_id])
        shares_to_transfer = params[:number_of_shares].to_i
        consideration = params[:consideration].to_f
        transfer_date = params[:transfer_date] || Date.current

        if shares_to_transfer > from_shareholding.number_of_shares
          return render json: {
            success: false,
            errors: [ "Cannot transfer more shares than available (#{from_shareholding.number_of_shares})" ]
          }, status: :unprocessable_entity
        end

        ActiveRecord::Base.transaction do
          # Create share transfer record
          transfer = @company.share_transfers.create!(
            from_shareholder: from_shareholding.shareholder,
            to_shareholder: to_shareholder,
            share_class: from_shareholding.share_class,
            number_of_shares: shares_to_transfer,
            consideration: consideration,
            transfer_date: transfer_date,
            notes: params[:notes]
          )

          # Update from shareholding
          if shares_to_transfer == from_shareholding.number_of_shares
            from_shareholding.destroy
          else
            from_shareholding.update!(
              number_of_shares: from_shareholding.number_of_shares - shares_to_transfer
            )
          end

          # Find or create to shareholding
          to_shareholding = @company.corporate_shareholdings.find_or_initialize_by(
            shareholder: to_shareholder,
            share_class: from_shareholding.share_class
          )
          to_shareholding.number_of_shares = (to_shareholding.number_of_shares || 0) + shares_to_transfer
          to_shareholding.acquired_date ||= transfer_date
          to_shareholding.save!

          render json: {
            success: true,
            data: {
              transfer: serialize_transfer(transfer),
              from_shareholding: from_shareholding.destroyed? ? nil : serialize_shareholding(from_shareholding.reload),
              to_shareholding: serialize_shareholding(to_shareholding)
            }
          }
        end
      rescue ActiveRecord::RecordInvalid => e
        render json: {
          success: false,
          errors: [ e.message ]
        }, status: :unprocessable_entity
      end

      private

      def set_company
        @company = Corporate.find(params[:company_id])
      end

      def set_shareholding
        @shareholding = @company.corporate_shareholdings.find(params[:id])
      end

      def shareholding_params
        params.require(:company_shareholding).permit(
          :shareholder_id,
          :share_class,
          :number_of_shares,
          :beneficially_held,
          :beneficial_owner,
          :acquired_date,
          :notes
        )
      end

      def serialize_shareholding(shareholding, include_details: false)
        shareholder = shareholding.shareholder
        shareholder_name = DisplayValueResolver.resolve(shareholder)

        data = {
          id: shareholding.id,
          company_id: shareholding.company_id,
          shareholder_id: shareholding.shareholder_id,
          shareholder_type: shareholding.shareholder_type,
          shareholder_name: shareholder_name,
          shareholder_entity_type: shareholder&.entity_type,
          share_class: shareholding.share_class,
          number_of_shares: shareholding.number_of_shares,
          percentage: calculate_percentage(shareholding),
          beneficially_held: shareholding.beneficially_held,
          beneficial_owner: shareholding.beneficial_owner,
          acquired_date: shareholding.acquired_date,
          notes: shareholding.notes,
          created_at: shareholding.created_at,
          updated_at: shareholding.updated_at,
          # Include shareholder object for frontend compatibility
          shareholder: shareholder ? {
            id: shareholder.id,
            display_name: shareholder.respond_to?(:display_name) ? shareholder.display_name : nil,
            name: shareholder.respond_to?(:name) ? shareholder.name : nil,
            entity_type: shareholder.respond_to?(:entity_type) ? shareholder.entity_type : nil
          } : nil
        }

        if include_details && shareholder
          data[:shareholder][:email] = shareholder.email if shareholder.respond_to?(:email)
        end

        data
      end

      def serialize_transfer(transfer)
        {
          id: transfer.id,
          from_shareholder_name: transfer.from_shareholder&.display_name,
          to_shareholder_name: transfer.to_shareholder.display_name,
          share_class: transfer.share_class,
          number_of_shares: transfer.number_of_shares,
          consideration: transfer.consideration,
          transfer_date: transfer.transfer_date
        }
      end

      def calculate_percentage(shareholding)
        total = @company.corporate_shareholdings
                        .where(share_class: shareholding.share_class)
                        .sum(:number_of_shares)
        return 0 if total.zero?
        ((shareholding.number_of_shares.to_f / total) * 100).round(2)
      end

      def shareholding_summary
        {
          total_shares: @company.corporate_shareholdings.sum(:number_of_shares),
          shareholders_count: @company.corporate_shareholdings.distinct.count(:shareholder_id),
          by_class: @company.corporate_shareholdings
                            .group(:share_class)
                            .sum(:number_of_shares)
        }
      end
    end
  end
end

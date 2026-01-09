module Api
  module V1
    class ShareholdingsController < ApplicationController
      # GET /api/v1/shareholdings
      # Returns all shareholdings across all companies
      def index
        @shareholdings = CorporateCompanyShareholding
                          .includes(:corporate_company, :shareholder)
                          .order(created_at: :desc)

        render json: {
          success: true,
          shareholdings: @shareholdings.map { |s| serialize_shareholding(s) }
        }
      end

      private

      def serialize_shareholding(shareholding)
        shareholder = shareholding.shareholder
        company = shareholding.company

        {
          id: shareholding.id,
          company_id: shareholding.company_id,
          company_name: company&.name || company&.display_name,
          shareholder_id: shareholding.shareholder_id,
          shareholder_type: shareholding.shareholder_type,
          shareholder_name: shareholder ? DisplayValueResolver.resolve(shareholder) : "Unknown",
          shareholder_entity_type: shareholder&.entity_type,
          share_class: shareholding.share_class,
          number_of_shares: shareholding.number_of_shares,
          percentage: calculate_percentage(shareholding),
          beneficially_held: shareholding.beneficially_held,
          beneficial_owner: shareholding.beneficial_owner,
          acquired_date: shareholding.acquired_date,
          notes: shareholding.notes,
          created_at: shareholding.created_at,
          updated_at: shareholding.updated_at
        }
      end

      def calculate_percentage(shareholding)
        return 0 unless shareholding.company

        total = shareholding.company.corporate_company_shareholdings
                            .where(share_class: shareholding.share_class)
                            .sum(:number_of_shares)
        return 0 if total.zero?
        ((shareholding.number_of_shares.to_f / total) * 100).round(2)
      end
    end
  end
end

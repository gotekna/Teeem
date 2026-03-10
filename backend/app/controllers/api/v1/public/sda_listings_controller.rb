module Api
  module V1
    module Public
      class SdaListingsController < ApplicationController
        # No authentication required — public API
        skip_before_action :authorize_request
        skip_before_action :set_tenant

        # GET /api/v1/public/sda_listings
        def index
          properties = Property.publicly_listed
                               .includes(:tenant)
                               .order(updated_at: :desc)

          # Filters
          properties = properties.where(sda_category: params[:category]) if params[:category].present?
          properties = properties.where(sda_building_type: params[:buildingType]) if params[:buildingType].present?
          properties = properties.where(public_listing_type: params[:listingType]) if params[:listingType].present?
          properties = properties.where(bedrooms: params[:bedrooms]) if params[:bedrooms].present?
          properties = properties.where(state: params[:state]) if params[:state].present?

          if params[:suburb].present?
            properties = properties.where("suburb ILIKE ?", "%#{params[:suburb]}%")
          end

          if params[:postcode].present?
            properties = properties.where(postcode: params[:postcode])
          end

          # Pagination
          page = (params[:page] || 1).to_i
          per_page = [(params[:perPage] || 12).to_i, 50].min
          total = properties.count
          properties = properties.offset((page - 1) * per_page).limit(per_page)

          render json: {
            success: true,
            data: {
              listings: properties.map(&:public_listing_json),
              pagination: {
                page: page,
                perPage: per_page,
                total: total,
                totalPages: (total.to_f / per_page).ceil
              }
            }
          }
        end

        # GET /api/v1/public/sda_listings/featured
        def featured
          properties = Property.publicly_listed
                               .includes(:tenant)
                               .order(updated_at: :desc)
                               .limit(6)

          render json: {
            success: true,
            data: properties.map(&:public_listing_json)
          }
        end

        # GET /api/v1/public/sda_listings/filters
        def filters
          listed = Property.publicly_listed

          render json: {
            success: true,
            data: {
              categories: listed.distinct.pluck(:sda_category).compact.sort,
              buildingTypes: listed.distinct.pluck(:sda_building_type).compact.sort,
              states: listed.distinct.pluck(:state).compact.sort,
              suburbs: listed.distinct.pluck(:suburb).compact.sort,
              bedroomOptions: listed.distinct.pluck(:bedrooms).compact.sort,
              listingTypes: listed.distinct.pluck(:public_listing_type).compact.sort
            }
          }
        end

        # GET /api/v1/public/sda_listings/:slug
        def show
          property = Property.publicly_listed.find_by!(public_slug: params[:slug])

          render json: {
            success: true,
            data: property.public_listing_json
          }
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Listing not found" }, status: :not_found
        end

        # POST /api/v1/public/sda_listings/:slug/enquire
        def enquire
          property = Property.publicly_listed.find_by!(public_slug: params[:slug])

          if SdaEnquiry.rate_limited?(request.remote_ip)
            return render json: { success: false, error: "Too many enquiries. Please try again later." }, status: :too_many_requests
          end

          enquiry = property.sda_enquiries.new(enquiry_params)
          enquiry.ip_address = request.remote_ip
          enquiry.enquiry_type = property.public_listing_type == "for_sale" ? "purchase" : "vacancy"

          if enquiry.save
            render json: { success: true, data: { message: "Enquiry submitted successfully" } }, status: :created
          else
            render json: { success: false, error: enquiry.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Listing not found" }, status: :not_found
        end

        private

        def enquiry_params
          params.require(:enquiry).permit(:name, :email, :phone, :message, :ndis_number)
        end
      end
    end
  end
end

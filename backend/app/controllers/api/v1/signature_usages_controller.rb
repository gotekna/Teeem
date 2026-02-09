module Api
  module V1
    class SignatureUsagesController < ApplicationController
      before_action :set_user, only: [:user_history]

      # GET /api/v1/signature_usages
      # Admin view: All signature usages (digital signature register)
      def index
        @signature_usages = SignatureUsage.includes(:user, :document_type, :job)
                                          .recent

        # Filter by user
        if params[:user_id].present?
          @signature_usages = @signature_usages.for_user(params[:user_id])
        end

        # Filter by certificate type
        if params[:certificate_type].present?
          @signature_usages = @signature_usages.by_certificate_type(params[:certificate_type])
        end

        # Filter by job
        if params[:job_id].present?
          @signature_usages = @signature_usages.for_job(params[:job_id])
        end

        # Filter by date range
        if params[:start_date].present? && params[:end_date].present?
          @signature_usages = @signature_usages.in_date_range(
            Date.parse(params[:start_date]).beginning_of_day,
            Date.parse(params[:end_date]).end_of_day
          )
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i.clamp(1, 100)

        total_count = @signature_usages.count
        @signature_usages = @signature_usages.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          data: @signature_usages.map { |usage| serialize_signature_usage(usage) },
          pagination: {
            current_page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          },
          summary: {
            total_signatures: total_count,
            by_certificate_type: SignatureUsage.group(:certificate_type).count,
            unique_signers: SignatureUsage.distinct.count(:user_id)
          }
        }
      end

      # GET /api/v1/signature_usages/my_history
      # Current user's signature history
      def my_history
        @signature_usages = current_user.signature_usages
                                        .includes(:document_type, :job)
                                        .recent

        # Filter by certificate type
        if params[:certificate_type].present?
          @signature_usages = @signature_usages.by_certificate_type(params[:certificate_type])
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 20).to_i.clamp(1, 100)

        total_count = @signature_usages.count
        @signature_usages = @signature_usages.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          data: @signature_usages.map { |usage| serialize_signature_usage(usage) },
          pagination: {
            current_page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/users/:user_id/signature_usages
      # Specific user's signature history (admin view)
      def user_history
        @signature_usages = @user.signature_usages
                                 .includes(:document_type, :job)
                                 .recent

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 20).to_i.clamp(1, 100)

        total_count = @signature_usages.count
        @signature_usages = @signature_usages.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          data: @signature_usages.map { |usage| serialize_signature_usage(usage) },
          user: {
            id: @user.id,
            name: @user.name,
            email: @user.email,
            signature_count: total_count
          },
          pagination: {
            current_page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/signature_usages/certificate_types
      # Available certificate types for filtering
      def certificate_types
        types = SignatureUsage.distinct.pluck(:certificate_type).compact

        render json: {
          success: true,
          data: types.map do |type|
            {
              value: type,
              label: SignatureUsage.new(certificate_type: type).certificate_type_display,
              count: SignatureUsage.by_certificate_type(type).count
            }
          end
        }
      end

      private

      def set_user
        @user = User.find(params[:user_id])
      end

      def serialize_signature_usage(usage)
        {
          id: usage.id,
          signed_at: usage.signed_at,
          signed_at_formatted: usage.signed_at_formatted,
          certificate_type: usage.certificate_type,
          certificate_type_display: usage.certificate_type_display,
          document_name: usage.document_name,
          purpose: usage.purpose,
          user: usage.user ? {
            id: usage.user.id,
            name: usage.user.name,
            email: usage.user.email
          } : nil,
          document_type: usage.document_type ? {
            id: usage.document_type.id,
            name: usage.document_type.name,
            uiName: usage.document_type.ui_name
          } : nil,
          job: usage.job ? {
            id: usage.job.id,
            job_code: usage.job.job_code,
            name: usage.job.name,
            address: usage.job.street_address
          } : nil,
          created_at: usage.created_at
        }
      end
    end
  end
end

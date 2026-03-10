# frozen_string_literal: true

module Api
  module V1
    module Sda
      class AgreementsController < ApplicationController
        before_action :set_agreement, only: [:show, :update, :destroy]

        # GET /api/v1/sda/agreements
        # Filterable by: property_id, contact_id, status, agreement_type
        def index
          agreements = SdaAgreement
            .includes(:property, :tenancy, :contact, :created_by_user)
            .order(created_at: :desc)

          agreements = apply_filters(agreements)

          render_success(serialize_list(agreements))
        end

        # GET /api/v1/sda/agreements/:id
        def show
          render_success(serialize_detail(@agreement))
        end

        # POST /api/v1/sda/agreements
        def create
          agreement = SdaAgreement.new(agreement_params)
          agreement.created_by_user = current_user if current_user

          if agreement.save
            render_success(serialize_detail(agreement), status: :created)
          else
            render_validation_errors(agreement)
          end
        end

        # PATCH /api/v1/sda/agreements/:id
        def update
          if @agreement.update(agreement_params)
            render_success(serialize_detail(@agreement))
          else
            render_validation_errors(@agreement)
          end
        end

        # DELETE /api/v1/sda/agreements/:id
        def destroy
          @agreement.destroy
          render_success
        end

        # GET /api/v1/sda/agreements/expiring_soon
        # Returns active agreements with end_date within 30 days
        def expiring_soon
          agreements = SdaAgreement
            .includes(:property, :tenancy, :contact)
            .expiring_soon(30)
            .order(:end_date)

          rows = agreements.map do |a|
            serialize_list([a]).first.merge(daysUntilExpiry: a.days_until_expiry)
          end

          render_success(rows)
        end

        private

        def set_agreement
          @agreement = SdaAgreement.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_error("Agreement not found", status: :not_found)
        end

        def agreement_params
          params.require(:sda_agreement).permit(
            :property_id,
            :tenancy_id,
            :contact_id,
            :agreement_type,
            :agreement_number,
            :status,
            :start_date,
            :end_date,
            :signed_date,
            :renewal_reminder_date,
            :sda_design_category,
            :sda_building_type,
            :agreed_weekly_rate,
            :agreed_participant_contribution,
            :special_conditions,
            :house_rules,
            :document_blob_id
          )
        end

        def apply_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.where(contact_id: params[:contact_id])   if params[:contact_id].present?
          scope = scope.where(status: params[:status])           if params[:status].present?
          scope = scope.by_type(params[:agreement_type])         if params[:agreement_type].present?
          scope
        end

        def serialize_list(agreements)
          agreements.map do |a|
            {
              id: a.id,
              agreementType: a.agreement_type,
              agreementNumber: a.agreement_number,
              status: a.status,
              startDate: a.start_date,
              endDate: a.end_date,
              signedDate: a.signed_date,
              renewalReminderDate: a.renewal_reminder_date,
              sdaDesignCategory: a.sda_design_category,
              sdaBuildingType: a.sda_building_type,
              agreedWeeklyRate: a.agreed_weekly_rate,
              agreedParticipantContribution: a.agreed_participant_contribution,
              property: a.property && { id: a.property.id, name: a.property.name, streetAddress: a.property.street_address },
              contact: a.contact && { id: a.contact.id, displayName: a.contact.display_name },
              tenancyId: a.tenancy_id,
              createdAt: a.created_at
            }
          end
        end

        def serialize_detail(agreement)
          serialize_list([agreement]).first.merge(
            specialConditions: agreement.special_conditions,
            houseRules: agreement.house_rules,
            documentBlobId: agreement.document_blob_id,
            createdByUser: agreement.created_by_user && {
              id: agreement.created_by_user.id,
              displayName: agreement.created_by_user.display_name
            },
            updatedAt: agreement.updated_at
          )
        end
      end
    end
  end
end

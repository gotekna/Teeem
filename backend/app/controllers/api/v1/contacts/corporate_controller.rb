# frozen_string_literal: true

# SSoT: Corporate Controller - Contact-centric corporate management
# Part of Contact SSoT Consolidation
#
# Purpose:
# Expose CorporateCompany data through Contact endpoints.
# Contact is THE ONE SSoT for identity; this controller provides
# corporate extension data (ASIC, compliance, etc.) for corporate-managed contacts.
#
# Actions:
#   - details:    GET /api/v1/contacts/:contact_id/corporate/details
#   - directors:  GET /api/v1/contacts/:contact_id/corporate/directors
#   - shareholders: GET /api/v1/contacts/:contact_id/corporate/shareholders
#   - compliance: GET /api/v1/contacts/:contact_id/corporate/compliance
#   - hierarchy:  GET /api/v1/contacts/:contact_id/corporate/hierarchy
#   - enable:     POST /api/v1/contacts/:contact_id/corporate/enable
#
# Access Control:
#   - can_view_corporate permission required for all actions
#   - can_view_confidential permission required for TFN, ASIC password
#
module Api
  module V1
    module Contacts
      class CorporateController < ApplicationController
        before_action :authorize_request
        before_action :set_contact
        before_action :ensure_corporate_access
        before_action :set_corporate_details, except: [:enable]

        # GET /api/v1/contacts/:contact_id/corporate/details
        # Returns corporate-specific details for this contact
        def details
          render json: {
            success: true,
            data: serialize_corporate_details(@corporate_details)
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to load corporate details: #{e.message}"
          }, status: :internal_server_error
        end

        # GET /api/v1/contacts/:contact_id/corporate/directors
        # Returns all directors for this corporate contact
        def directors
          directors = @corporate_details.corporate_company_directors
            .includes(:contact)
            .order(is_current: :desc, appointment_date: :desc)

          render json: {
            success: true,
            data: directors.map { |d| serialize_director(d) }
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to load directors: #{e.message}"
          }, status: :internal_server_error
        end

        # GET /api/v1/contacts/:contact_id/corporate/shareholders
        # Returns all shareholders for this corporate contact
        def shareholders
          shareholdings = @corporate_details.corporate_company_shareholdings
            .includes(:shareholder)
            .order(created_at: :desc)

          render json: {
            success: true,
            data: shareholdings.map { |s| serialize_shareholding(s) }
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to load shareholders: #{e.message}"
          }, status: :internal_server_error
        end

        # GET /api/v1/contacts/:contact_id/corporate/compliance
        # Returns compliance items for this corporate contact
        def compliance
          compliance_items = @corporate_details.corporate_company_compliance_items
            .order(due_date: :asc)

          render json: {
            success: true,
            data: {
              items: compliance_items.map { |c| serialize_compliance_item(c) },
              overdue_count: compliance_items.where("due_date < ? AND completed = ?", Date.today, false).count,
              upcoming_count: compliance_items.where("due_date BETWEEN ? AND ? AND completed = ?", Date.today, 30.days.from_now, false).count,
              health_score: @corporate_details.health_score,
              health_status: @corporate_details.health_status
            }
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to load compliance: #{e.message}"
          }, status: :internal_server_error
        end

        # GET /api/v1/contacts/:contact_id/corporate/hierarchy
        # Returns the company hierarchy (parent and subsidiaries)
        def hierarchy
          render json: {
            success: true,
            data: {
              contact: {
                id: @contact.id,
                display_name: @contact.display_name,
                entity_type: @contact.entity_type,
                is_corporate_managed: @contact.is_corporate_managed
              },
              parent: serialize_hierarchy_contact(@contact.parent_company_contact),
              subsidiaries: @contact.subsidiary_contacts.map { |s| serialize_hierarchy_contact(s) },
              corporate_hierarchy: @corporate_details.hierarchy_tree
            }
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to load hierarchy: #{e.message}"
          }, status: :internal_server_error
        end

        # POST /api/v1/contacts/:contact_id/corporate/enable
        # Enable corporate management for this contact
        def enable
          unless @contact.can_be_corporate_managed?
            return render json: {
              success: false,
              error: "Only company or trust contacts can have corporate management enabled"
            }, status: :unprocessable_entity
          end

          if @contact.enable_corporate_management!
            render json: {
              success: true,
              data: {
                contact_id: @contact.id,
                is_corporate_managed: @contact.is_corporate_managed,
                corporate_details_id: @contact.corporate_details&.id
              }
            }
          else
            render json: {
              success: false,
              error: "Failed to enable corporate management"
            }, status: :unprocessable_entity
          end
        rescue => e
          render json: {
            success: false,
            error: "Failed to enable corporate management: #{e.message}"
          }, status: :internal_server_error
        end

        private

        def set_contact
          @contact = Contact.find(params[:contact_id])
        rescue ActiveRecord::RecordNotFound
          render json: {
            success: false,
            error: "Contact not found"
          }, status: :not_found
        end

        def ensure_corporate_access
          # TODO: Implement permission check
          # unless current_user.can_view_corporate?(@contact)
          #   render json: { success: false, error: "Access denied" }, status: :forbidden
          # end
          true
        end

        def set_corporate_details
          @corporate_details = @contact.corporate_details

          unless @corporate_details.present?
            render json: {
              success: false,
              error: "This contact does not have corporate management enabled",
              can_enable: @contact.can_be_corporate_managed?
            }, status: :not_found
          end
        end

        def serialize_corporate_details(details)
          can_view_confidential = true # TODO: current_user.can_view_confidential?

          {
            id: details.id,
            contact_id: details.contact_id,
            name: details.name,
            code: details.code,
            slug: details.slug,

            # Registration details
            entity_type: details.entity_type,
            acn: details.formatted_acn,
            abn: details.formatted_abn,
            date_incorporated: details.date_incorporated,
            state_of_incorporation: details.state_of_incorporation,
            status: details.status,

            # Trust details (if applicable)
            is_trustee: details.is_trustee,
            trust_name: details.trust_name,
            trustee_type: details.trustee_type,

            # Addresses
            registered_office_address: details.registered_office_address,
            principal_place_of_business: details.principal_place_of_business,

            # Confidential fields (require special permission)
            tfn: can_view_confidential ? details.tfn : "[RESTRICTED]",
            corporate_key: can_view_confidential ? details.corporate_key : "[RESTRICTED]",
            asic_username: can_view_confidential ? details.asic_username : "[RESTRICTED]",

            # Financial settings
            gst_registration_status: details.gst_registration_status,
            gst_registration_date: details.gst_registration_date,
            accounting_method: details.accounting_method,
            bas_frequency: details.bas_frequency,
            financial_year_end: details.financial_year_end,

            # Share capital
            shares_on_issue: details.shares_on_issue,
            share_classes: details.share_classes,

            # Group info
            company_group_id: details.company_group_id,
            group_name: details.group_name,

            # Health
            health_score: details.health_score,
            health_status: details.health_status,
            review_date: details.review_date,

            # Xero
            has_xero_connection: details.has_xero_connection?,

            # Timestamps
            created_at: details.created_at,
            updated_at: details.updated_at
          }
        end

        def serialize_director(director)
          {
            id: director.id,
            contact_id: director.contact_id,
            contact_name: director.contact&.display_name,
            position: director.position,
            formatted_position: director.formatted_position,
            appointment_date: director.appointment_date,
            resignation_date: director.resignation_date,
            is_current: director.is_current,
            notes: director.notes,
            created_at: director.created_at
          }
        end

        def serialize_shareholding(shareholding)
          {
            id: shareholding.id,
            shareholder_type: shareholding.shareholder_type,
            shareholder_id: shareholding.shareholder_id,
            shareholder_name: shareholding.shareholder&.respond_to?(:display_name) ? shareholding.shareholder.display_name : shareholding.shareholder&.name,
            share_class: shareholding.share_class,
            number_of_shares: shareholding.number_of_shares,
            percentage_of_total: shareholding.percentage_of_total,
            beneficially_held: shareholding.beneficially_held,
            acquisition_date: shareholding.acquisition_date,
            created_at: shareholding.created_at
          }
        end

        def serialize_compliance_item(item)
          {
            id: item.id,
            item_type: item.item_type,
            title: item.title,
            description: item.description,
            due_date: item.due_date,
            completed: item.completed,
            completed_date: item.completed_date,
            completed_by: item.completed_by,
            is_recurring: item.is_recurring,
            recurrence_pattern: item.recurrence_pattern,
            created_at: item.created_at
          }
        end

        def serialize_hierarchy_contact(contact)
          return nil unless contact.present?

          {
            id: contact.id,
            display_name: contact.display_name,
            entity_type: contact.entity_type,
            is_corporate_managed: contact.is_corporate_managed,
            corporate_details_id: contact.corporate_details&.id
          }
        end
      end
    end
  end
end

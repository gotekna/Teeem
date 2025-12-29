# frozen_string_literal: true

# SSoT: Relationships Controller - Extracted from contacts_controller.rb
# Part of ADR-001: Contacts Controller Decomposition
#
# Note: This is DIFFERENT from Api::V1::ContactRelationshipsController which handles
# CRUD operations on ContactRelationship records. This controller handles
# relationship-related operations on contacts.
#
# Actions:
#   - case_relationships: GET /api/v1/contacts/relationships/:contact_id/cases
#   - coworkers: GET /api/v1/contacts/relationships/:contact_id/coworkers
#   - reorder_employees: POST /api/v1/contacts/relationships/:contact_id/reorder_employees
#   - reorder_companies: POST /api/v1/contacts/relationships/:contact_id/reorder_companies
#
module Api
  module V1
    module Contacts
      class RelationshipsController < ApplicationController
        before_action :authorize_request
        before_action :set_contact

        # GET /api/v1/contacts/relationships/:contact_id/cases
        # Returns all cases this contact has been involved in with relationship details
        def case_relationships
          relationships = @contact.case_relationships

          render json: {
            success: true,
            data: relationships,
            total_count: relationships.length
          }
        rescue => e
          Rails.logger.error("Case relationships error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to load case relationships: #{e.message}"
          }, status: :internal_server_error
        end

        # GET /api/v1/contacts/relationships/:contact_id/coworkers
        # Returns other people who work at the same company(ies) as this contact
        # For person contacts: finds people at the same company via employee_of relationships
        # For company contacts: finds all employees/directors/shareholders of this company
        def coworkers
          coworkers_data = []

          if @contact.entity_type == "person" || @contact.entity_type == "sole_trader"
            # Get all companies this person works at
            company_ids = @contact.outgoing_relationships
              .active
              .where(relationship_type: %w[employee_of director_of shareholder_of])
              .pluck(:related_contact_id)

            # Find other people at these companies
            if company_ids.any?
              coworkers = Contact.joins(:outgoing_relationships)
                .where(contact_relationships: {
                  related_contact_id: company_ids,
                  relationship_type: %w[employee_of director_of shareholder_of],
                  is_active: true
                })
                .where.not(id: @contact.id)
                .where(entity_type: %w[person sole_trader])
                .distinct
                .includes(:outgoing_relationships)

              coworkers_data = coworkers.map do |coworker|
                # Get their roles at the shared companies
                shared_roles = coworker.outgoing_relationships
                  .active
                  .where(related_contact_id: company_ids)
                  .includes(:related_contact)
                  .map do |rel|
                    {
                      company_id: rel.related_contact_id,
                      company_name: rel.related_contact&.display_name,
                      role: rel.relationship_type.gsub("_of", "").gsub("_", " ").titleize
                    }
                  end

                {
                  id: coworker.id,
                  display_name: coworker.display_name,
                  email: coworker.email,
                  mobile_phone: coworker.mobile_phone,
                  entity_type: coworker.entity_type,
                  company_roles: shared_roles
                }
              end
            end
          else
            # This is a company - find all people associated with it
            coworkers = Contact.joins(:outgoing_relationships)
              .where(contact_relationships: {
                related_contact_id: @contact.id,
                relationship_type: %w[employee_of director_of shareholder_of],
                is_active: true
              })
              .where(entity_type: %w[person sole_trader])
              .distinct
              .includes(:outgoing_relationships)

            coworkers_data = coworkers.map do |person|
              # Get their role at this company
              roles = person.outgoing_relationships
                .active
                .where(related_contact_id: @contact.id)
                .pluck(:relationship_type)
                .map { |rt| rt.gsub("_of", "").gsub("_", " ").titleize }

              {
                id: person.id,
                display_name: person.display_name,
                email: person.email,
                mobile_phone: person.mobile_phone,
                entity_type: person.entity_type,
                roles: roles
              }
            end
          end

          render json: {
            success: true,
            data: coworkers_data,
            total_count: coworkers_data.length
          }
        rescue => e
          Rails.logger.error("Coworkers error: #{e.message}")
          render json: {
            success: false,
            error: "Failed to load coworkers: #{e.message}"
          }, status: :internal_server_error
        end

        # POST /api/v1/contacts/relationships/:contact_id/reorder_employees
        # Updates the display_order of employees for a company contact
        # Expects: { employee_ids: [123, 456, 789] } (in desired order)
        def reorder_employees
          unless @contact.entity_type == "company" || @contact.entity_type == "trust"
            return render json: {
              success: false,
              error: "Only company or trust contacts can have employees"
            }, status: :unprocessable_entity
          end

          employee_ids = params[:employee_ids]
          unless employee_ids.respond_to?(:each)
            return render json: {
              success: false,
              error: "employee_ids must be an array"
            }, status: :unprocessable_entity
          end

          # Update display_order for each employee relationship
          ActiveRecord::Base.transaction do
            employee_ids.each_with_index do |employee_id, index|
              relationship = @contact.incoming_relationships
                .active
                .where(relationship_type: "employee_of")
                .find_by(source_contact_id: employee_id)

              if relationship
                relationship.update!(display_order: index)
              end
            end
          end

          render json: {
            success: true,
            message: "Employee order updated successfully"
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to reorder employees: #{e.message}"
          }, status: :internal_server_error
        end

        # POST /api/v1/contacts/relationships/:contact_id/reorder_companies
        # Updates the display_order of companies for a person contact
        # Expects: { company_ids: [123, 456, 789] } (in desired order)
        def reorder_companies
          unless @contact.entity_type == "person"
            return render json: {
              success: false,
              error: "Only person contacts can have ordered companies"
            }, status: :unprocessable_entity
          end

          company_ids = params[:company_ids]
          unless company_ids.respond_to?(:each)
            return render json: {
              success: false,
              error: "company_ids must be an array"
            }, status: :unprocessable_entity
          end

          # Update display_order for each company relationship (outgoing from person)
          ActiveRecord::Base.transaction do
            company_ids.each_with_index do |company_id, index|
              # Find outgoing relationship from this person to the company
              relationship = @contact.outgoing_relationships
                .active
                .find_by(related_contact_id: company_id)

              if relationship
                relationship.update!(display_order: index)
              end
            end
          end

          # Update primary_company_id to be the first company in the list
          if company_ids.any? && @contact.primary_company_id != company_ids.first
            @contact.update!(primary_company_id: company_ids.first)
          end

          render json: {
            success: true,
            message: "Company order updated successfully"
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to reorder companies: #{e.message}"
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
      end
    end
  end
end

# frozen_string_literal: true

# SSoT: Corporate Structure Controller - Extracted from contacts_controller.rb
# Part of ADR-001: Contacts Controller Decomposition
#
# Actions:
#   - company_group_memberships: GET /api/v1/contacts/corporate_structure/:contact_id/memberships
#   - directorships: GET /api/v1/contacts/corporate_structure/:contact_id/directorships
#   - shareholdings: GET /api/v1/contacts/corporate_structure/:contact_id/shareholdings
#   - trust_roles: GET /api/v1/contacts/corporate_structure/:contact_id/trust_roles
#   - ownership_chain: GET /api/v1/contacts/corporate_structure/:contact_id/ownership_chain
#
module Api
  module V1
    module Contacts
      class CorporateStructureController < ApplicationController
        before_action :authorize_request
        before_action :set_contact

        # GET /api/v1/contacts/corporate_structure/:contact_id/memberships
        # Returns all company group memberships for this contact
        def company_group_memberships
          memberships = @contact.company_group_memberships.includes(:company_group, :corporate)

          render json: {
            success: true,
            data: memberships.map { |m| serialize_membership(m) }
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to load memberships: #{e.message}"
          }, status: :internal_server_error
        end

        # GET /api/v1/contacts/corporate_structure/:contact_id/directorships
        # Returns all directorships for this contact (from CorporateDirector table)
        def directorships
          directorships = @contact.corporate_directorships
            .includes(corporate: :company_group)
            .order(is_current: :desc, appointment_date: :desc)

          render json: {
            success: true,
            data: directorships.map do |d|
              {
                id: d.id,
                company_id: d.company_id,
                company_name: d.corporate&.name,
                company_acn: d.corporate&.acn,
                company_abn: d.corporate&.abn,
                company_status: d.corporate&.status,
                company_entity_type: d.corporate&.entity_type,
                company_group_id: d.corporate&.company_group_id,
                company_group_name: d.corporate&.company_group&.name,
                position: d.position,
                formatted_position: d.formatted_position,
                appointment_date: d.appointment_date,
                resignation_date: d.resignation_date,
                is_current: d.is_current,
                contact_id: d.contact_id,
                created_at: d.created_at,
                updated_at: d.updated_at
              }
            end
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to load directorships: #{e.message}"
          }, status: :internal_server_error
        end

        # GET /api/v1/contacts/corporate_structure/:contact_id/shareholdings
        # Returns all shareholdings for this contact (from CorporateShareholding table)
        def shareholdings
          shareholdings = @contact.corporate_shareholdings
            .includes(corporate: :company_group)
            .order(created_at: :desc)

          render json: {
            success: true,
            data: shareholdings.map do |s|
              {
                id: s.id,
                company_id: s.company_id,
                company_name: s.corporate&.name,
                company_acn: s.corporate&.acn,
                company_abn: s.corporate&.abn,
                company_status: s.corporate&.status,
                company_entity_type: s.corporate&.entity_type,
                company_group_id: s.corporate&.company_group_id,
                company_group_name: s.corporate&.company_group&.name,
                share_class: s.share_class,
                number_of_shares: s.number_of_shares,
                percentage_of_total: s.percentage_of_total,
                beneficially_held: s.beneficially_held,
                acquisition_date: s.acquisition_date,
                disposal_date: s.disposal_date,
                consideration_paid: s.consideration_paid,
                created_at: s.created_at,
                updated_at: s.updated_at
              }
            end
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to load shareholdings: #{e.message}"
          }, status: :internal_server_error
        end

        # GET /api/v1/contacts/corporate_structure/:contact_id/trust_roles
        # Returns all trust-related roles for this contact (trustee, beneficiary, appointor)
        def trust_roles
          # Get trustee roles (where this contact is trustee of a trust)
          trustee_roles = @contact.outgoing_relationships
            .where(relationship_type: "trustee_of")
            .includes(:related_contact)
            .map do |rel|
              {
                id: rel.id,
                role_type: "trustee",
                trust_id: rel.related_contact_id,
                trust_name: rel.related_contact&.display_name,
                trust_entity_type: rel.related_contact&.entity_type,
                start_date: rel.start_date,
                end_date: rel.end_date,
                is_active: rel.is_active,
                notes: rel.context
              }
            end

          # Get beneficiary roles
          beneficiary_roles = @contact.outgoing_relationships
            .where(relationship_type: "beneficiary_of")
            .includes(:related_contact)
            .map do |rel|
              {
                id: rel.id,
                role_type: "beneficiary",
                trust_id: rel.related_contact_id,
                trust_name: rel.related_contact&.display_name,
                trust_entity_type: rel.related_contact&.entity_type,
                ownership_percentage: rel.ownership_percentage,
                start_date: rel.start_date,
                end_date: rel.end_date,
                is_active: rel.is_active,
                notes: rel.context
              }
            end

          # Get appointor roles
          appointor_roles = @contact.outgoing_relationships
            .where(relationship_type: "appointor_of")
            .includes(:related_contact)
            .map do |rel|
              {
                id: rel.id,
                role_type: "appointor",
                trust_id: rel.related_contact_id,
                trust_name: rel.related_contact&.display_name,
                trust_entity_type: rel.related_contact&.entity_type,
                start_date: rel.start_date,
                end_date: rel.end_date,
                is_active: rel.is_active,
                notes: rel.context
              }
            end

          render json: {
            success: true,
            data: {
              trustee_roles: trustee_roles,
              beneficiary_roles: beneficiary_roles,
              appointor_roles: appointor_roles,
              total_count: trustee_roles.length + beneficiary_roles.length + appointor_roles.length
            }
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to load trust roles: #{e.message}"
          }, status: :internal_server_error
        end

        # GET /api/v1/contacts/corporate_structure/:contact_id/ownership_chain
        # Returns the full ownership chain showing what companies this person owns
        # and what those companies own (including trusts)
        def ownership_chain
          # Get direct shareholdings for this contact
          direct_holdings = @contact.corporate_shareholdings
            .includes(corporate: [:company_group])
            .where("number_of_shares > 0")

          chain = direct_holdings.map do |holding|
            percentage = holding.percentage_of_total
            next nil if percentage <= 0
            build_ownership_node(holding.corporate, percentage)
          end.compact

          render json: {
            success: true,
            data: chain
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to load ownership chain: #{e.message}"
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

        def serialize_membership(membership)
          {
            id: membership.id,
            contact_id: membership.contact_id,
            company_group_id: membership.company_group_id,
            company_group_name: membership.company_group&.name,
            membership_type: membership.membership_type,
            company_id: membership.company_id,
            company_name: membership.corporate&.name,
            can_view_confidential: membership.can_view_confidential,
            can_edit: membership.can_edit,
            is_active: membership.is_active
          }
        end

        # Build ownership node recursively for ownership_chain endpoint
        def build_ownership_node(company, percentage, visited = Set.new)
          return nil if company.nil? || visited.include?(company.id)
          visited.add(company.id)

          # Get companies this company owns shares in
          child_holdings = CorporateShareholding
            .where(shareholder_type: "Company", shareholder_id: company.id)
            .where("number_of_shares > 0")
            .includes(corporate: [:company_group])

          children = child_holdings.map do |holding|
            child_percentage = holding.percentage_of_total
            next nil if child_percentage <= 0
            build_ownership_node(holding.corporate, child_percentage, visited)
          end.compact

          # Check if this company is a trustee
          trust_entity = nil
          if company.is_trustee && company.trust_name.present?
            trust_entity = Corporate.where(entity_type: ["Trust", "Superfund"]).find_by(name: company.trust_name)
          end

          {
            company_id: company.id,
            company_name: company.name,
            percentage: percentage,
            entity_type: company.entity_type,
            is_trustee: company.is_trustee,
            trust_name: company.trust_name,
            trust_id: trust_entity&.id,
            trust_entity_type: trust_entity&.entity_type,
            children: children
          }
        end
      end
    end
  end
end

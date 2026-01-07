module Api
  module V1
    class ContactRelationshipsController < ApplicationController
      before_action :set_contact
      before_action :set_relationship, only: [ :show, :update, :destroy ]

      # GET /api/v1/contacts/:contact_id/relationships
      def index
        # Get both outgoing and incoming relationships
        outgoing = @contact.outgoing_relationships.includes(:related_contact)
        incoming = @contact.incoming_relationships.includes(:source_contact)

        render json: {
          success: true,
          relationships: {
            outgoing: outgoing.map { |rel| serialize_relationship(rel, "outgoing") },
            incoming: incoming.map { |rel| serialize_relationship(rel, "incoming") }
          },
          relationship_types: ContactRelationship::RELATIONSHIP_TYPES,
          relationship_types_metadata: ContactRelationship.relationship_types_with_metadata,
          valid_types_for_entity: ContactRelationship.valid_types_for(
            source_entity_type: @contact.entity_type,
            target_entity_type: nil # Will be filtered on frontend based on target selection
          )
        }
      end

      # GET /api/v1/contacts/:contact_id/relationships/:id
      def show
        render json: {
          success: true,
          relationship: serialize_relationship(@relationship)
        }
      end

      # POST /api/v1/contacts/:contact_id/relationships
      def create
        @relationship = @contact.outgoing_relationships.build(relationship_params)

        if @relationship.save
          render json: {
            success: true,
            relationship: serialize_relationship(@relationship)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @relationship.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/contacts/:contact_id/relationships/:id
      def update
        if @relationship.update(relationship_params)
          render json: {
            success: true,
            relationship: serialize_relationship(@relationship)
          }
        else
          render json: {
            success: false,
            errors: @relationship.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/contacts/:contact_id/relationships/:id
      def destroy
        @relationship.destroy
        render json: { success: true }
      end

      # GET /api/v1/contacts/:contact_id/relationships/summary
      def summary
        # Return a summary of all relationships for search results
        render json: {
          success: true,
          summary: @contact.relationship_summary,
          companies: @contact.all_companies.map { |c| { id: c.id, name: c.display_name } },
          employees: @contact.employees.map { |e| { id: e.id, name: e.display_name } }
        }
      end

      private

      def set_contact
        @contact = Contact.find(params[:contact_id])
      end

      def set_relationship
        @relationship = @contact.outgoing_relationships.find_by(id: params[:id]) ||
                        @contact.incoming_relationships.find_by(id: params[:id])

        unless @relationship
          render json: {
            success: false,
            errors: [ "Relationship not found" ]
          }, status: :not_found
        end
      end

      def relationship_params
        params.require(:contact_relationship).permit(
          :related_contact_id,
          :relationship_type,
          :ownership_percentage,
          :start_date,
          :end_date,
          :is_active,
          :notes,
          :role_in_relationship,
          :context,
          metadata: {},
          role_ids: []  # Multi-role support - array of ContactType IDs
        )
      end

      def serialize_relationship(relationship, direction = nil)
        # Determine the "other" contact based on perspective
        other_contact = if direction == "incoming"
          relationship.source_contact
        else
          relationship.related_contact
        end

        {
          id: relationship.id,
          source_contact_id: relationship.source_contact_id,
          related_contact_id: relationship.related_contact_id,
          relationship_type: relationship.relationship_type,
          relationship_type_label: relationship.relationship_type.humanize.titleize,
          direction: direction,
          ownership_percentage: relationship.ownership_percentage,
          start_date: relationship.start_date,
          end_date: relationship.end_date,
          is_active: relationship.is_active,
          notes: relationship.notes,
          role_in_relationship: relationship.role_in_relationship,
          role_ids: relationship.role_ids || [],
          role_names: relationship.role_names,
          roles: relationship.roles_with_details,
          context: relationship.context,
          created_at: relationship.created_at,
          updated_at: relationship.updated_at,
          other_contact: {
            id: other_contact&.id,
            name: other_contact&.display_name,
            entity_type: other_contact&.entity_type,
            email: other_contact&.email,
            phone: other_contact&.primary_phone,
            roles: other_contact&.roles
          },
          related_contact: {
            id: relationship.related_contact&.id,
            display_name: relationship.related_contact&.display_name,
            email: relationship.related_contact&.email,
            phone: relationship.related_contact&.primary_phone,
            roles: relationship.related_contact&.roles
          }
        }
      end
    end
  end
end

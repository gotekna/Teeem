module Api
  module V1
    class BeneficiariesController < ApplicationController
      # GET /api/v1/beneficiaries
      # Returns all trust beneficiaries (contacts with beneficiary_of relationship to a trust)
      def index
        # Find all beneficiary_of relationships
        @relationships = ContactRelationship
                          .where(relationship_type: "beneficiary_of")
                          .includes(:source_contact, :target_contact)
                          .order(created_at: :desc)

        render json: {
          success: true,
          beneficiaries: @relationships.map { |r| serialize_beneficiary(r) }
        }
      end

      private

      def serialize_beneficiary(relationship)
        beneficiary = relationship.source_contact # The beneficiary
        trust = relationship.target_contact # The trust they're a beneficiary of

        {
          id: relationship.id,
          beneficiary_id: beneficiary&.id,
          beneficiary_name: beneficiary ? DisplayValueResolver.resolve(beneficiary) : "Unknown",
          beneficiary_entity_type: beneficiary&.entity_type,
          trust_id: trust&.id,
          trust_name: trust ? DisplayValueResolver.resolve(trust) : "Unknown",
          beneficiary_type: relationship.metadata&.dig("beneficiary_type"),
          percentage: relationship.metadata&.dig("percentage"),
          notes: relationship.notes,
          created_at: relationship.created_at,
          updated_at: relationship.updated_at
        }
      end
    end
  end
end

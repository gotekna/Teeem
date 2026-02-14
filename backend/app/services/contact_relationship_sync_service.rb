# frozen_string_literal: true

# Service: Sync primary_company_id → employee_of ContactRelationship
# SSoT: ContactRelationship is THE ONE for employment, primary_company_id is legacy
# This keeps the two systems in sync during the migration period
class ContactRelationshipSyncService
  # Sync primary_company_id to employee_of relationship
  # @param contact [Contact] Contact whose primary_company_id changed
  # @return [Boolean] true if sync succeeded
  def self.call(contact)
    new(contact).call
  end

  def initialize(contact)
    @contact = contact
  end

  def call
    # Prevent infinite loop with ContactRelationship callback
    return false if Thread.current[:syncing_primary_company_relationship]

    Thread.current[:syncing_primary_company_relationship] = true

    if @contact.primary_company_id.present?
      sync_primary_company_present
    else
      sync_primary_company_removed
    end

    true
  rescue StandardError => e
    Rails.logger.error("ContactRelationshipSyncService: Contact##{@contact.id} failed - #{e.message}")
    false
  ensure
    Thread.current[:syncing_primary_company_relationship] = false
  end

  private

  def sync_primary_company_present
    # Create or activate employee_of relationship
    relationship = @contact.outgoing_relationships.find_or_initialize_by(
      related_contact_id: @contact.primary_company_id,
      relationship_type: "employee_of"
    )
    relationship.is_active = true
    relationship.start_date ||= Date.today
    relationship.save!

    Rails.logger.info("ContactRelationshipSyncService: Contact##{@contact.id} employee_of relationship synced to Contact##{@contact.primary_company_id}")
  end

  def sync_primary_company_removed
    # Deactivate any existing employee_of relationships (primary company was cleared)
    updated = @contact.outgoing_relationships
      .where(relationship_type: "employee_of", is_active: true)
      .update_all(is_active: false, end_date: Date.today)

    if updated > 0
      Rails.logger.info("ContactRelationshipSyncService: Contact##{@contact.id} deactivated #{updated} employee_of relationship(s)")
    end
  end
end

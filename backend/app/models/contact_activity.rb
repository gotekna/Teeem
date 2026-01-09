class ContactActivity < ApplicationRecord
  belongs_to :contact
  belongs_to :performed_by, polymorphic: true, optional: true

  # Validations
  validates :activity_type, presence: true
  validates :occurred_at, presence: true

  # Scopes
  scope :recent, -> { order(occurred_at: :desc) }
  scope :by_type, ->(type) { where(activity_type: type) }

  # Activity types
  ACTIVITY_TYPES = %w[
    created
    updated
    synced_from_xero
    synced_to_xero
    purchase_order_created
    supplier_linked
    contact_merged
  ].freeze

  # Helper to create activity from Xero sync
  def self.log_xero_sync(contact:, action:, changes: {}, xero_data: {})
    create!(
      contact: contact,
      activity_type: "synced_from_xero",
      description: generate_sync_description(action, changes),
      metadata: {
        action: action,
        changes: changes,
        xero_contact_id: xero_data["ContactID"],
        xero_name: xero_data["Name"],
        synced_at: Time.current
      },
      performed_by: nil, # System action
      occurred_at: Time.current
    )
  end

  private

  def self.generate_sync_description(action, changes)
    case action
    when "created"
      "Contact created from Xero"
    when "updated"
      field_names = changes.keys.map { |k| k.to_s.humanize }.join(", ")
      "Synced from Xero: updated #{field_names}"
    when "matched"
      "Matched with existing Xero contact"
    else
      "Synced from Xero"
    end
  end
end

# frozen_string_literal: true

# Move hardcoded constants from models into tenant-configurable JSONB columns.
# Each column has a sensible default matching the previous hardcoded values.
# Models read from TenantSetting with DEFAULT_ constant fallback.
class AddConfigurableConstantsToTenantSettings < ActiveRecord::Migration[7.1]
  def change
    # Contact model constants
    add_column :tenant_settings, :contact_roles, :jsonb,
      default: ["Employee", "sales", "land_agent", "Director", "Company_Secretary", "Public_Officer", "CEO", "GM", "Owner"],
      comment: "Valid contact roles for job assignments"

    add_column :tenant_settings, :contact_entity_types, :jsonb,
      default: ["person", "company", "trust", "sole_trader", "price_only"],
      comment: "Valid contact entity types"

    add_column :tenant_settings, :contact_employment_statuses, :jsonb,
      default: ["active", "contractor", "inactive"],
      comment: "Valid contact employment statuses"

    # EmailTemplate categories
    add_column :tenant_settings, :email_template_categories, :jsonb,
      default: {
        "quick_reply" => "Quick Reply",
        "formal" => "Formal",
        "follow_up" => "Follow-up",
        "meeting" => "Meeting",
        "quote" => "Quote/Proposal",
        "invoice" => "Invoice",
        "other" => "Other"
      },
      comment: "Email template categories (key => display label)"

    # ContactRelationship type metadata
    add_column :tenant_settings, :relationship_type_metadata, :jsonb,
      default: nil,
      comment: "Custom relationship types (overrides ContactRelationship defaults)"

    # EmailUserState display config
    add_column :tenant_settings, :email_star_colors, :jsonb,
      default: {
        "red" => { "hex" => "#EF4444", "label" => "Red" },
        "orange" => { "hex" => "#F97316", "label" => "Orange" },
        "yellow" => { "hex" => "#EAB308", "label" => "Yellow" },
        "green" => { "hex" => "#22C55E", "label" => "Green" },
        "blue" => { "hex" => "#3B82F6", "label" => "Blue" },
        "purple" => { "hex" => "#A855F7", "label" => "Purple" }
      },
      comment: "Star color options for email states"

    add_column :tenant_settings, :email_priority_levels, :jsonb,
      default: {
        "high" => { "label" => "High", "icon" => "alert-circle" },
        "normal" => { "label" => "Normal", "icon" => "minus" },
        "low" => { "label" => "Low", "icon" => "arrow-down" }
      },
      comment: "Email priority levels with display metadata"
  end
end

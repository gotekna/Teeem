class AddReviewFieldsToContactExternalLinks < ActiveRecord::Migration[8.0]
  def change
    add_column :contact_external_links, :needs_review, :boolean, default: false, null: false
    add_column :contact_external_links, :match_type, :string
    add_column :contact_external_links, :match_confidence, :decimal, precision: 5, scale: 4
    add_column :contact_external_links, :reviewed_at, :datetime
    add_column :contact_external_links, :reviewed_by, :string

    add_index :contact_external_links, :needs_review, where: "needs_review = true", name: "idx_contact_external_links_needs_review"
  end
end

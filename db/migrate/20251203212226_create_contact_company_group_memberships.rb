class CreateContactCompanyGroupMemberships < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_company_group_memberships do |t|
      t.references :contact, null: false, foreign_key: true
      t.references :company_group, null: false, foreign_key: true

      # Role in this group
      t.string :membership_type  # director, shareholder, beneficiary, trustee, family_member, advisor, company_entity, trust_entity

      # Security - what can they see in this group?
      t.boolean :can_view_confidential, default: false
      t.boolean :can_edit, default: false

      # For companies/trusts - link to Company record
      t.references :company, foreign_key: true  # If this contact IS a company in the group

      t.boolean :is_active, default: true

      t.timestamps
    end

    add_index :contact_company_group_memberships, [ :contact_id, :company_group_id ], unique: true, name: 'idx_contact_company_group_unique'
  end
end

class FixContactCompanyGroupMembershipIndex < ActiveRecord::Migration[8.0]
  def change
    # Remove the old unique index that only had contact_id + company_group_id
    # A person can be both director AND shareholder in the same group
    remove_index :contact_company_group_memberships, name: 'idx_contact_company_group_unique', if_exists: true

    # Add new unique index that includes membership_type
    # This allows same contact to have multiple roles in same group
    add_index :contact_company_group_memberships,
              [ :contact_id, :company_group_id, :membership_type ],
              unique: true,
              name: 'idx_contact_group_membership_unique'
  end
end

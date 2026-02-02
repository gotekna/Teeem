# frozen_string_literal: true

# Link Organization to CorporateCompany for credential isolation
#
# Organizations exist for credential isolation within a Tenant.
# Each Organization can optionally link to a CorporateCompany.
# This enables companies to have their own Microsoft/S3 credentials.
#
# Data mapping:
#   Organization: Tekna (id=1)        → CorporateCompany: Tekna Pty Ltd (id=1)
#   Organization: 100xBestLife (id=2) → CorporateCompany: Gen2612 Pty Ltd (id=7)
#   Organization: Homes of Hope (id=3) → CorporateCompany: Homes of Hope (id=35)
#   Organization: Love Your World (id=4) → CorporateCompany: Love Your World Ltd (id=37)
#
class LinkOrganizationToCorporateCompany < ActiveRecord::Migration[8.0]
  def up
    add_column :organizations, :corporate_id, :bigint
    add_index :organizations, :corporate_id
    add_foreign_key :organizations, :corporate_companies

    # Link existing organizations to their corresponding companies
    # Tekna org (id=1) → Tekna Pty Ltd (id=1)
    execute "UPDATE organizations SET corporate_company_id = 1 WHERE id = 1"

    # 100xBestLife org (id=2) → Gen2612 Pty Ltd (id=7)
    execute "UPDATE organizations SET corporate_company_id = 7 WHERE id = 2"

    # Homes of Hope org (id=3) → Homes of Hope (id=35)
    execute "UPDATE organizations SET corporate_company_id = 35 WHERE id = 3"

    # Love Your World org (id=4) → Love Your World Ltd (id=37)
    execute "UPDATE organizations SET corporate_company_id = 37 WHERE id = 4"
  end

  def down
    remove_foreign_key :organizations, :corporate_companies
    remove_index :organizations, :corporate_id
    remove_column :organizations, :corporate_id
  end
end

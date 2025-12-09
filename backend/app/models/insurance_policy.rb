class InsurancePolicy < ApplicationRecord
  belongs_to :corporate_company, foreign_key: "company_id"
end

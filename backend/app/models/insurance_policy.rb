class InsurancePolicy < ApplicationRecord
  belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
end

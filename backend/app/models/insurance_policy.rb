class InsurancePolicy < ApplicationRecord
  belongs_to :corporate, foreign_key: "company_id"
end

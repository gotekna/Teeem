class SignatureUsage < ApplicationRecord
  belongs_to :user
  belongs_to :document_type
  belongs_to :job
  belongs_to :job_document
end

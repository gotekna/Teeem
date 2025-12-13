class DocumentActivity < ApplicationRecord
  # Note: class_name needed because table was renamed from company_documents to corporate_company_documents
  belongs_to :company_document, class_name: "CorporateCompanyDocument"
  belongs_to :user, optional: true

  # Action types
  ACTIONS = %w[renamed moved validated ai_verified created deleted updated].freeze

  validates :action, presence: true, inclusion: { in: ACTIONS }

  scope :recent, -> { order(created_at: :desc) }
  scope :by_action, ->(action) { where(action: action) }

  # Helper to create activity log entries
  def self.log(document:, user:, action:, old_values: {}, new_values: {}, notes: nil)
    create!(
      company_document: document,
      user: user,
      action: action,
      old_values: old_values,
      new_values: new_values,
      notes: notes
    )
  end

  # Human-readable description of the activity
  def description
    case action
    when "renamed"
      "Renamed from '#{old_values['title']}' to '#{new_values['title']}'"
    when "moved"
      parts = []
      parts << "company #{old_values['company_id']} → #{new_values['company_id']}" if old_values["company_id"] != new_values["company_id"]
      parts << "folder #{old_values['folder']} → #{new_values['folder']}" if old_values["folder"] != new_values["folder"]
      "Moved: #{parts.join(', ')}"
    when "validated"
      "Document naming validated"
    when "ai_verified"
      "AI verification completed"
    when "created"
      "Document created"
    when "deleted"
      "Document deleted"
    when "updated"
      "Document updated"
    else
      action.humanize
    end
  end
end

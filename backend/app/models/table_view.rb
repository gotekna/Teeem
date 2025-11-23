class TableView < ApplicationRecord
  belongs_to :user
  belongs_to :table, optional: true  # optional because table_id might reference dynamic tables

  validates :name, presence: true
  validates :user_id, presence: true

  # Ensure only one default view per user per table
  validates :is_default, uniqueness: { scope: [:user_id, :table_id] }, if: :is_default?

  # Serialize JSON fields
  attribute :filters, :json, default: {}
  attribute :columns, :json, default: []
  attribute :sort_order, :json, default: {}

  # Scopes
  scope :for_user, ->(user_id) { where(user_id: user_id) }
  scope :for_table, ->(table_id) { where(table_id: table_id) }
  scope :defaults, -> { where(is_default: true) }

  # Before validating, if this view is being set as default, unset all other defaults for this user/table
  # This must run before validation so the uniqueness check passes
  before_validation :unset_other_defaults, if: :is_default?

  private

  def unset_other_defaults
    TableView.where(user_id: user_id, table_id: table_id, is_default: true)
             .where.not(id: id)
             .update_all(is_default: false)
  end
end

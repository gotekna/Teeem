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

  # GOLD STANDARD RULE: display_order = 0 is always the default view
  # The first view in the list (position 0) is the default view for that table
  after_save :ensure_first_view_is_default

  # Before validating, if this view is being set as default, unset all other defaults for this user/table
  # This must run before validation so the uniqueness check passes
  before_validation :unset_other_defaults, if: :is_default?

  # Before saving, deduplicate column order to prevent React duplicate key errors
  before_save :deduplicate_column_order

  private

  def deduplicate_column_order
    return unless columns.is_a?(Hash) && columns['order'].is_a?(Array)

    # Remove duplicate columns while preserving order
    original_order = columns['order']
    deduped_order = original_order.uniq

    # Only update if there were duplicates
    if original_order.length != deduped_order.length
      Rails.logger.warn "[TableView] Removed duplicate columns from view '#{name}': #{original_order - deduped_order}"
      columns['order'] = deduped_order
    end
  end

  def unset_other_defaults
    TableView.where(user_id: user_id, table_id: table_id, is_default: true)
             .where.not(id: id)
             .update_all(is_default: false)
  end

  # GOLD STANDARD RULE: Ensure display_order = 0 is always the default view
  # This runs after save to maintain consistency
  def ensure_first_view_is_default
    return unless user_id && table_id

    # Find the view with display_order = 0 for this user/table
    first_view = TableView.where(user_id: user_id, table_id: table_id)
                          .order(display_order: :asc)
                          .first

    if first_view
      # The first view (lowest display_order) should be the default
      if first_view.id == self.id && display_order == 0 && !is_default
        # This view is at position 0 but not default - fix it
        update_column(:is_default, true)
      elsif first_view.id != self.id && first_view.display_order == 0 && !first_view.is_default
        # Another view is at position 0 but not default - fix it
        first_view.update_column(:is_default, true)
      end

      # Ensure all other views are not default
      TableView.where(user_id: user_id, table_id: table_id)
               .where.not(id: first_view.id)
               .where(is_default: true)
               .update_all(is_default: false)
    end
  end
end

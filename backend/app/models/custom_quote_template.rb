# frozen_string_literal: true

# CustomQuoteTemplate - Reusable template for cost-centre-level quoting
#
# Templates define a CC → PO tree structure with default suppliers.
# Can be seeded from a PoTemplatePack or built from scratch.
# Applied to a job to create a CustomQuote with resolved SmTasks.
#
# SSoT: Template structure lives here; job-level data in CustomQuote.
#
class CustomQuoteTemplate < ApplicationRecord
  acts_as_tenant :tenant, has_global_records: true
  include ConfigSyncable
  include GlobalConfigRecord

  # Associations
  belongs_to :po_template_pack, optional: true
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true
  has_many :lines, class_name: "CustomQuoteTemplateLine",
           dependent: :destroy
  has_many :root_lines, -> { where(parent_id: nil).order(:position) },
           class_name: "CustomQuoteTemplateLine"
  has_many :custom_quotes, dependent: :nullify

  # Nested attributes for template builder UI
  accepts_nested_attributes_for :lines, allow_destroy: true

  # Validations
  validates :name, presence: true, length: { maximum: 100 },
                   uniqueness: { scope: :tenant_id, case_sensitive: false }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position, :name) }

  # Tree structure as nested JSON
  def as_tree
    root_lines.includes(:children).map(&:as_tree_node)
  end

  def line_count
    lines.count
  end
end

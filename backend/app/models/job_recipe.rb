class JobRecipe < ApplicationRecord
  # Associations
  belongs_to :job
  belongs_to :recipe
  belongs_to :applied_by, class_name: "User", optional: true

  # Validations
  validates :job_id, presence: true
  validates :recipe_id, presence: true, uniqueness: { scope: :job_id, message: "has already been applied to this job" }
  validates :quantity_multiplier, numericality: { greater_than: 0 }, allow_nil: true
  validates :status, inclusion: { in: %w[applied po_generated archived] }

  # Scopes
  scope :active, -> { where.not(status: 'archived') }
  scope :applied, -> { where(status: 'applied') }
  scope :with_po, -> { where(status: 'po_generated') }

  # Callbacks
  before_create :set_defaults
  after_create :calculate_total

  # Calculate the total for this applied recipe using job's quantity variables
  def calculate_total
    return unless recipe

    # Get job's quantity variables as a hash
    variables = job.quantity_variables_hash

    # Calculate using the recipe's formula engine
    total = recipe.calculate_with_variables(variables, quantity_multiplier || 1.0)
    update_column(:applied_total, total)
    total
  end

  # Recalculate when variables change
  def recalculate!
    calculate_total
  end

  # Generate purchase orders from this applied recipe
  def generate_purchase_orders!(user: nil)
    return if status == 'po_generated'

    # Get calculated line items from recipe
    variables = job.quantity_variables_hash
    line_items = recipe.calculate_line_items(variables, quantity_multiplier || 1.0)

    # Group by supplier
    items_by_supplier = line_items.group_by { |item| item[:supplier_id] || recipe.default_supplier_id }

    created_pos = []

    items_by_supplier.each do |supplier_id, items|
      po = job.purchase_orders.create!(
        supplier_id: supplier_id,
        description: "Generated from Recipe: #{recipe.name}",
        status: 'draft',
        created_by_id: user&.id
      )

      items.each do |item|
        po.line_items.create!(
          description: item[:description],
          quantity: item[:quantity],
          unit_price: item[:unit_price],
          total_amount: item[:total]
        )
      end

      # Calculate totals
      po.update!(
        sub_total: po.line_items.sum(:total_amount),
        total: po.line_items.sum(:total_amount)
      )

      created_pos << po
    end

    # Mark as PO generated
    update!(status: 'po_generated')

    created_pos
  end

  private

  def set_defaults
    self.applied_at ||= Time.current
    self.status ||= 'applied'
    self.quantity_multiplier ||= 1.0
  end
end

# frozen_string_literal: true

# QuoteTemplate - Reusable templates for RFQ workflows
#
# Each template defines which SM Trades to quote and which suppliers to request
# quotes from. Templates can be applied to a job, which creates QuoteTracker
# rows for each trade × supplier combination.
#
# SSoT: Foundation slug = 'quote-templates'
# SSoT: Settings > Operations > Quote Templates
#
# Pattern follows: PoTemplatePack (parent template with nested children)
#
class QuoteTemplate < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true
  has_many :quote_template_trades, -> { order(:position) }, dependent: :destroy
  has_many :quote_trackers, dependent: :nullify

  accepts_nested_attributes_for :quote_template_trades, allow_destroy: true

  # Validations
  validates :name, presence: true, length: { maximum: 100 },
                   uniqueness: { scope: :tenant_id, case_sensitive: false }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position, :name) }

  def trade_count
    quote_template_trades.size
  end

  def supplier_count
    quote_template_trades.sum { |t| t.quote_template_trade_suppliers.size }
  end

  # Apply this template to a job, creating QuoteTracker rows for each trade × supplier
  def apply_to_job!(job, created_by:)
    rows_created = []

    ActiveRecord::Base.transaction do
      quote_template_trades.includes(quote_template_trade_suppliers: [:supplier, :contact_person]).each do |template_trade|
        template_trade.quote_template_trade_suppliers.each do |template_supplier|
          # Find contact person's email if available
          contact_email = template_supplier.contact_person&.email

          tracker = QuoteTracker.create!(
            job: job,
            sm_trade: template_trade.sm_trade,
            supplier: template_supplier.supplier,
            contact: template_supplier.contact_person,
            contact_email: contact_email,
            quote_request_instructions: template_trade.default_instructions,
            quote_template: self,
            status: 'draft'
          )
          rows_created << tracker
        end
      end
    end

    rows_created
  end
end

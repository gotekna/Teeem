class GstCode < ApplicationRecord
  acts_as_tenant :tenant, has_global_records: true
  include GlobalConfigRecord

  # Validations
  validates :code, presence: true, uniqueness: { scope: :tenant_id }
  validates :name, presence: true
  validates :rate, presence: true, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1 }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:position, :code) }

  # Returns the tax rate for a given code string
  # Raises if code is blank or not found — fail fast, no silent defaults
  def self.rate_for(code)
    raise ArgumentError, "GST code cannot be blank" if code.blank?

    record = active.find_by(code: code)
    raise ActiveRecord::RecordNotFound, "No active GstCode found for '#{code}' (tenant: #{ActsAsTenant.current_tenant&.id})" unless record

    record.rate.to_f
  end

  # Maps a Xero TaxType string to our GST code
  # Raises if no matching code found — misconfigured xero_tax_types should be caught immediately
  def self.for_xero_tax_type(xero_type)
    raise ArgumentError, "Xero tax type cannot be blank" if xero_type.blank?

    record = active.where("xero_tax_types LIKE ?", "%#{xero_type}%").first
    raise ActiveRecord::RecordNotFound, "No active GstCode maps to Xero tax type '#{xero_type}' (tenant: #{ActsAsTenant.current_tenant&.id})" unless record

    record.code
  end

  # Returns options for dropdown selects: [{ value: "GST", label: "GST 10%" }]
  def self.code_options
    active.ordered.map { |gc| { value: gc.code, label: gc.name, rate: gc.rate.to_f } }
  end

  # Seed the 3 default codes for a new tenant
  def self.seed_defaults!(tenant)
    [
      { code: "GST", name: "GST 10%", rate: 0.10, xero_tax_types: "INPUT,OUTPUT", position: 0 },
      { code: "GST Free", name: "GST Free 0%", rate: 0.00, xero_tax_types: "INPUT2,OUTPUT2,BASEXCLUDED,EXEMPTINPUT,EXEMPTOUTPUT,NONE", position: 1 },
      { code: "Input Taxed", name: "Input Taxed 0%", rate: 0.00, xero_tax_types: "INPUTTAXED", position: 2 },
    ].each do |attrs|
      find_or_create_by!(tenant: tenant, code: attrs[:code]) do |gc|
        gc.assign_attributes(attrs.except(:code))
      end
    end
  end
end

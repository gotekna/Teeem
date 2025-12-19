# frozen_string_literal: true

# Configuration for AI processing pipeline per service
# Users can adjust these settings in Admin > System > AI Processing
class AiServiceConfig < ApplicationRecord
  SERVICE_TYPES = {
    "plan_identification" => { display: "Plan Identification", default_threshold: 80, ocr_enabled: true },
    "document_verification" => { display: "Document Verification", default_threshold: 74, ocr_enabled: true },
    "invoice_parsing" => { display: "Invoice Parsing", default_threshold: 0, ai_always: true, ocr_enabled: false },
    "email_extraction" => { display: "Email Processing", default_threshold: 85, ocr_enabled: true },
    "asic_extract" => { display: "ASIC Extract", default_threshold: 90, ocr_enabled: true }
  }.freeze

  AI_MODELS = %w[sonnet haiku opus].freeze

  validates :service_type, presence: true, uniqueness: true
  validates :display_name, presence: true
  validates :ai_threshold, numericality: { in: 0..100 }
  validates :ai_model, inclusion: { in: AI_MODELS }

  scope :active, -> { where(active: true) }

  # Get config for a service, creating default if needed
  def self.for(service_type)
    find_by(service_type: service_type) || create_default!(service_type)
  end

  # Create default config for a service type
  def self.create_default!(service_type)
    defaults = SERVICE_TYPES[service_type] || {}
    create!(
      service_type: service_type,
      display_name: defaults[:display] || service_type.titleize,
      ocr_enabled: defaults.fetch(:ocr_enabled, true),
      ai_threshold: defaults[:default_threshold] || 80,
      ai_always: defaults[:ai_always] || false,
      ai_model: "sonnet"
    )
  end

  # Seed all default configs
  def self.seed_defaults!
    SERVICE_TYPES.each_key do |service_type|
      self.for(service_type)
    end
  end

  # Should AI be called based on confidence?
  def should_call_ai?(confidence)
    ai_always? || confidence < ai_threshold
  end

  # Human-readable description of when AI is called
  def ai_trigger_description
    if ai_always?
      "Always"
    else
      "Below #{ai_threshold}%"
    end
  end
end

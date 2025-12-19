# frozen_string_literal: true

class SeedAiServiceConfigs < ActiveRecord::Migration[8.0]
  def up
    # Seed default AI service configurations
    configs = [
      {
        service_type: "plan_identification",
        display_name: "Plan Identification",
        ocr_enabled: true,
        ai_threshold: 80,
        ai_model: "sonnet",
        ai_always: false
      },
      {
        service_type: "document_verification",
        display_name: "Document Verification",
        ocr_enabled: true,
        ai_threshold: 74,
        ai_model: "sonnet",
        ai_always: false
      },
      {
        service_type: "invoice_parsing",
        display_name: "Invoice Parsing",
        ocr_enabled: false,
        ai_threshold: 0,
        ai_model: "sonnet",
        ai_always: true
      },
      {
        service_type: "email_extraction",
        display_name: "Email Processing",
        ocr_enabled: true,
        ai_threshold: 85,
        ai_model: "haiku",
        ai_always: false
      },
      {
        service_type: "asic_extract",
        display_name: "ASIC Extract",
        ocr_enabled: true,
        ai_threshold: 90,
        ai_model: "haiku",
        ai_always: false
      }
    ]

    configs.each do |config|
      execute <<-SQL
        INSERT INTO ai_service_configs (service_type, display_name, ocr_enabled, ai_threshold, ai_model, ai_always, active, extra_config, created_at, updated_at)
        VALUES ('#{config[:service_type]}', '#{config[:display_name]}', #{config[:ocr_enabled]}, #{config[:ai_threshold]}, '#{config[:ai_model]}', #{config[:ai_always]}, true, '{}', NOW(), NOW())
        ON CONFLICT (service_type) DO NOTHING
      SQL
    end
  end

  def down
    execute "DELETE FROM ai_service_configs WHERE service_type IN ('plan_identification', 'document_verification', 'invoice_parsing', 'email_extraction', 'asic_extract')"
  end
end

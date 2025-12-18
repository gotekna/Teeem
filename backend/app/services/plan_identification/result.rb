# frozen_string_literal: true

module PlanIdentification
  # Result object returned by PlanIdentificationService
  # Contains all identification data and audit information
  class Result
    attr_accessor :plan_type, :plan_category, :job_plan_tab,
                  :confidence, :status, :audit_record,
                  :display_name, :short_name,
                  :sheet_number, :sheet_name, :sheet_date, :sheet_issue,
                  :match_reason, :ai_invoked

    def initialize(attrs = {})
      attrs.each do |key, value|
        send("#{key}=", value) if respond_to?("#{key}=")
      end
      @confidence ||= 0
      @status ||= "unknown"
      @ai_invoked ||= false
    end

    def success?
      plan_type.present? || display_name.present?
    end

    def needs_review?
      confidence < 80
    end

    def auto_assigned?
      confidence >= 60
    end

    def to_h
      {
        plan_type_id: plan_type&.id,
        plan_type_name: plan_type&.name,
        plan_category_id: plan_category&.id,
        job_plan_tab_id: job_plan_tab&.id,
        confidence: confidence,
        status: status,
        display_name: display_name,
        short_name: short_name,
        sheet_number: sheet_number,
        sheet_name: sheet_name,
        sheet_date: sheet_date,
        sheet_issue: sheet_issue,
        match_reason: match_reason,
        ai_invoked: ai_invoked
      }
    end
  end
end

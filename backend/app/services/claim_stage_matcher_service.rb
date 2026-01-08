# frozen_string_literal: true

# Service to match Xero invoices to claim stages
class ClaimStageMatcherService
  def initialize(job)
    @job = job
  end

  # Auto-match all unmatched stages to available invoices
  # Returns hash with results: { matched: [], unmatched: [], errors: [] }
  def auto_match_all
    result = { matched: [], unmatched: [], errors: [] }

    unmatched_stages = @job.job_claim_stages.unmatched.ordered
    available_invoices = unmatched_invoices

    unmatched_stages.each do |stage|
      matched_invoice = find_matching_invoice(stage, available_invoices)

      if matched_invoice
        begin
          stage.match_to_invoice!(matched_invoice, auto: true)
          available_invoices.delete(matched_invoice)
          result[:matched] << {
            stage_id: stage.id,
            stage_name: stage.name,
            invoice_id: matched_invoice.id,
            invoice_number: matched_invoice.invoice_number
          }
        rescue StandardError => e
          result[:errors] << {
            stage_id: stage.id,
            stage_name: stage.name,
            error: e.message
          }
        end
      else
        result[:unmatched] << {
          stage_id: stage.id,
          stage_name: stage.name
        }
      end
    end

    result
  end

  # Manually match a stage to an invoice
  def manual_match(stage, invoice)
    raise ArgumentError, "Stage does not belong to this job" unless stage.job_id == @job.id
    raise ArgumentError, "Invoice does not belong to this job" unless invoice.job_id == @job.id
    raise ArgumentError, "Invoice is already matched to another stage" if invoice_already_matched?(invoice, stage)

    stage.match_to_invoice!(invoice, auto: false)
    stage
  end

  # Remove match from a stage
  def unmatch(stage)
    raise ArgumentError, "Stage does not belong to this job" unless stage.job_id == @job.id

    stage.unmatch!
    stage
  end

  # Get available invoices that can be matched
  def available_invoices
    unmatched_invoices
  end

  # Sync payment info from Xero for all matched stages
  def sync_payments!
    @job.job_claim_stages.matched.includes(:external_invoice).each do |stage|
      next unless stage.external_invoice.present?

      # Refresh invoice data from Xero first
      stage.external_invoice.refresh_from_xero! if stage.external_invoice.respond_to?(:refresh_from_xero!)

      # Sync payment info
      stage.sync_payment_from_invoice
      stage.save! if stage.changed?
    end
  end

  private

  # Get job's invoices that aren't matched to any stage
  def unmatched_invoices
    matched_invoice_ids = @job.job_claim_stages.where.not(external_invoice_id: nil).pluck(:external_invoice_id)

    # Get sales invoices for this job (customer invoices, not supplier bills)
    # SSoT: Accept both Xero type "ACCREC" and TEEEM type "sales_invoice"
    @job.external_invoices
        .where(invoice_type: ["ACCREC", "sales_invoice"])
        .where.not(id: matched_invoice_ids)
        .order(:created_at)
  end

  # Find an invoice that matches the stage based on pattern matching
  def find_matching_invoice(stage, invoices)
    # Priority 1: Try J{job_number}-{sequence} pattern if sequence is set
    # SSoT: This is the preferred matching method
    if stage.claim_sequence_number.present?
      sequence_pattern = build_sequence_pattern(stage.claim_sequence_number)
      match = invoices.find { |inv| description_matches?(inv, sequence_pattern) }
      return match if match
    end

    # Priority 2: Try template pattern
    template = stage.claim_stage_template
    if template&.invoice_match_pattern.present?
      regex = template.match_pattern_regex
      if regex
        match = invoices.find do |inv|
          description_matches?(inv, regex)
        end
        return match if match
      end
    end

    # Priority 3: Fall back to stage name matching
    stage_name_regex = build_name_regex(stage.name)
    invoices.find do |inv|
      description_matches?(inv, stage_name_regex)
    end
  end

  # Build pattern for J{job_number}-{sequence} format
  # Matches: J201-1, j201-1, J201 - 1, J0201-1, etc.
  def build_sequence_pattern(sequence_number)
    job_number = @job.job_number || @job.id
    # Strip leading zeros for matching (J0201 -> 201, then match J201 or J0201)
    job_num_stripped = job_number.to_s.gsub(/^0+/, "")
    # Pattern matches with or without leading zeros: J201-1 or J0201-1
    Regexp.new("J0*#{Regexp.escape(job_num_stripped)}\\s*-\\s*#{sequence_number}", Regexp::IGNORECASE)
  end

  # Check if invoice fields match regex
  def description_matches?(invoice, regex)
    fields_to_check = [
      invoice.reference,
      invoice.invoice_number
    ]

    # Also check line item descriptions (stored in line_items JSONB)
    if invoice.line_items.is_a?(Array)
      invoice.line_items.each do |item|
        fields_to_check << item["Description"] if item["Description"].present?
        fields_to_check << item["description"] if item["description"].present?
      end
    end

    fields_to_check.compact.any? { |field| field.to_s.match?(regex) }
  end

  # Build a regex from stage name for matching
  def build_name_regex(name)
    # Extract key words from stage name
    words = name.downcase.split(/\s+/).reject { |w| w.length < 3 }

    # Create pattern that matches any of the words
    pattern = words.map { |w| Regexp.escape(w) }.join("|")

    Regexp.new(pattern, Regexp::IGNORECASE)
  rescue RegexpError
    Regexp.new(Regexp.escape(name), Regexp::IGNORECASE)
  end

  # Check if invoice is already matched to a different stage
  def invoice_already_matched?(invoice, exclude_stage = nil)
    query = @job.job_claim_stages.where(external_invoice_id: invoice.id)
    query = query.where.not(id: exclude_stage.id) if exclude_stage&.persisted?
    query.exists?
  end
end

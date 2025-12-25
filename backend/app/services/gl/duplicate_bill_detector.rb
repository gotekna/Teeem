# frozen_string_literal: true

module Gl
  # Detects potential duplicate bills/invoices to prevent double-payments
  #
  # Detection strategies:
  # 1. Exact match - Same supplier + same invoice number
  # 2. Amount match - Same supplier + same amount within date range
  # 3. Reference match - Same supplier + similar reference pattern
  #
  # Each potential duplicate is scored with confidence (0-100)
  #
  class DuplicateBillDetector
    # Detection thresholds
    EXACT_MATCH_CONFIDENCE = 100
    AMOUNT_DATE_CONFIDENCE = 85
    REFERENCE_MATCH_CONFIDENCE = 75
    FUZZY_MATCH_CONFIDENCE = 60

    # Date range for amount matching (days)
    AMOUNT_DATE_RANGE = 14

    # Minimum score to flag as potential duplicate
    MIN_DUPLICATE_SCORE = 60

    attr_reader :company, :results

    def initialize(company = nil)
      @company = company
      @results = []
    end

    # Scan all bills for duplicates
    #
    # @param options [Hash] Filtering options
    # @option options [String] :tenant_id Filter by Xero tenant
    # @option options [Date] :from_date Only check bills after this date
    # @option options [Date] :to_date Only check bills before this date
    # @option options [Integer] :limit Max bills to check
    # @return [Hash] Scan results with duplicates grouped
    def scan_all(options = {})
      @results = []

      scope = base_scope(options)

      # Group bills by contact for efficient checking
      bills_by_contact = scope.group_by(&:contact_id)

      bills_by_contact.each do |contact_id, bills|
        next if bills.count < 2

        # Check each pair within the contact group
        bills.each_with_index do |bill, idx|
          (idx + 1...bills.count).each do |j|
            other_bill = bills[j]
            score = calculate_duplicate_score(bill, other_bill)

            if score >= MIN_DUPLICATE_SCORE
              @results << {
                bill1: bill_summary(bill),
                bill2: bill_summary(other_bill),
                score: score,
                match_type: determine_match_type(bill, other_bill),
                reasoning: build_reasoning(bill, other_bill, score)
              }
            end
          end
        end
      end

      # Sort by score descending
      @results.sort_by! { |r| -r[:score] }

      # Group results
      {
        total_bills_scanned: scope.count,
        total_contacts_with_bills: bills_by_contact.keys.compact.count,
        potential_duplicates: @results.count,
        duplicates: @results,
        scanned_at: Time.current
      }
    end

    # Check a specific bill for duplicates
    #
    # @param bill [ExternalInvoice] The bill to check
    # @return [Array<Hash>] List of potential duplicates with scores
    def check_bill(bill)
      return [] unless bill.bill?

      duplicates = []

      # Find other bills from same supplier
      other_bills = ExternalInvoice.bills
                                   .where(contact_id: bill.contact_id)
                                   .where.not(id: bill.id)
                                   .active

      other_bills.each do |other|
        score = calculate_duplicate_score(bill, other)

        if score >= MIN_DUPLICATE_SCORE
          duplicates << {
            duplicate_bill: bill_summary(other),
            score: score,
            match_type: determine_match_type(bill, other),
            reasoning: build_reasoning(bill, other, score)
          }
        end
      end

      duplicates.sort_by { |d| -d[:score] }
    end

    # Check a bill before saving (for real-time duplicate warning)
    #
    # @param bill_data [Hash] Bill data to check
    # @return [Array<Hash>] Potential duplicates
    def check_before_save(bill_data)
      return [] unless bill_data[:contact_id]

      duplicates = []

      # Find similar bills
      scope = ExternalInvoice.bills
                             .where(contact_id: bill_data[:contact_id])
                             .active

      # Exclude current bill if it has an ID (update case)
      scope = scope.where.not(id: bill_data[:id]) if bill_data[:id]

      scope.find_each do |existing|
        score = calculate_score_from_data(bill_data, existing)

        if score >= MIN_DUPLICATE_SCORE
          duplicates << {
            existing_bill: bill_summary(existing),
            score: score,
            match_type: determine_match_type_from_data(bill_data, existing),
            warning: build_warning(bill_data, existing, score)
          }
        end
      end

      duplicates.sort_by { |d| -d[:score] }
    end

    # Mark a duplicate pair as reviewed (not actually a duplicate)
    #
    # @param bill1_id [Integer] First bill ID
    # @param bill2_id [Integer] Second bill ID
    # @param reviewed_by [User] User who reviewed
    # @param notes [String] Review notes
    def mark_reviewed(bill1_id, bill2_id, reviewed_by:, notes: nil)
      review = Gl::DuplicateBillReview.find_or_initialize_by(
        bill1_id: [bill1_id, bill2_id].min,
        bill2_id: [bill1_id, bill2_id].max
      )

      review.update!(
        status: "not_duplicate",
        reviewed_by: reviewed_by,
        reviewed_at: Time.current,
        notes: notes
      )

      review
    end

    # Mark as confirmed duplicate and take action
    #
    # @param keep_id [Integer] Bill ID to keep
    # @param void_id [Integer] Bill ID to void/delete
    # @param reviewed_by [User] User who reviewed
    # @param action [String] Action taken: void, delete, or link
    def confirm_duplicate(keep_id, void_id, reviewed_by:, action: "void")
      review = Gl::DuplicateBillReview.find_or_initialize_by(
        bill1_id: [keep_id, void_id].min,
        bill2_id: [keep_id, void_id].max
      )

      review.update!(
        status: "confirmed_duplicate",
        reviewed_by: reviewed_by,
        reviewed_at: Time.current,
        action_taken: action,
        kept_bill_id: keep_id,
        voided_bill_id: void_id
      )

      # Take action on the duplicate
      duplicate_bill = ExternalInvoice.find(void_id)
      case action
      when "void"
        duplicate_bill.update!(status: "voided", sync_enabled: false)
      when "delete"
        duplicate_bill.update!(status: "deleted", sync_enabled: false)
      when "link"
        # Just link them - don't change status
        # Useful for legitimate re-bills
      end

      review
    end

    private

    def base_scope(options)
      scope = ExternalInvoice.bills.active.where.not(contact_id: nil)

      scope = scope.where(tenant_id: options[:tenant_id]) if options[:tenant_id]
      scope = scope.where("invoice_date >= ?", options[:from_date]) if options[:from_date]
      scope = scope.where("invoice_date <= ?", options[:to_date]) if options[:to_date]
      scope = scope.limit(options[:limit]) if options[:limit]

      scope.includes(:contact).order(invoice_date: :desc)
    end

    def calculate_duplicate_score(bill1, bill2)
      score = 0

      # Strategy 1: Exact invoice number match (100 points)
      if same_invoice_number?(bill1, bill2)
        return EXACT_MATCH_CONFIDENCE
      end

      # Strategy 2: Amount + date match (up to 85 points)
      if same_amount?(bill1, bill2)
        score += 50

        # Date proximity bonus
        date_diff = (bill1.invoice_date - bill2.invoice_date).abs.to_i rescue 365
        if date_diff == 0
          score += 35  # Same date
        elsif date_diff <= 3
          score += 25
        elsif date_diff <= AMOUNT_DATE_RANGE
          score += 15
        end
      end

      # Strategy 3: Reference similarity (up to 20 points)
      ref_similarity = reference_similarity(bill1, bill2)
      score += (ref_similarity * 20).to_i

      # Strategy 4: Description similarity (up to 10 points)
      desc_similarity = description_similarity(bill1, bill2)
      score += (desc_similarity * 10).to_i

      # Cap at 95 for non-exact matches
      [score, 95].min
    end

    def calculate_score_from_data(bill_data, existing)
      score = 0

      # Invoice number match
      if bill_data[:invoice_number].present? &&
         existing.invoice_number.present? &&
         normalize_invoice_number(bill_data[:invoice_number]) ==
           normalize_invoice_number(existing.invoice_number)
        return EXACT_MATCH_CONFIDENCE
      end

      # Amount match
      if same_amount_value?(bill_data[:total].to_d, existing.total.to_d)
        score += 50

        if bill_data[:invoice_date].present? && existing.invoice_date.present?
          date_diff = (bill_data[:invoice_date].to_date - existing.invoice_date).abs.to_i rescue 365
          if date_diff == 0
            score += 35
          elsif date_diff <= 3
            score += 25
          elsif date_diff <= AMOUNT_DATE_RANGE
            score += 15
          end
        end
      end

      [score, 95].min
    end

    def same_invoice_number?(bill1, bill2)
      return false unless bill1.invoice_number.present? && bill2.invoice_number.present?
      normalize_invoice_number(bill1.invoice_number) ==
        normalize_invoice_number(bill2.invoice_number)
    end

    def normalize_invoice_number(num)
      num.to_s.downcase.gsub(/[^a-z0-9]/, "")
    end

    def same_amount?(bill1, bill2)
      same_amount_value?(bill1.total.to_d, bill2.total.to_d)
    end

    def same_amount_value?(amount1, amount2)
      return false unless amount1 && amount2
      # Allow for small rounding differences (1 cent)
      (amount1 - amount2).abs < 0.01
    end

    def reference_similarity(bill1, bill2)
      ref1 = bill1.reference.to_s.downcase.strip
      ref2 = bill2.reference.to_s.downcase.strip

      return 0 if ref1.blank? || ref2.blank?
      return 1.0 if ref1 == ref2

      # Jaccard similarity on words
      words1 = ref1.split(/\s+/).to_set
      words2 = ref2.split(/\s+/).to_set

      return 0 if words1.empty? || words2.empty?

      intersection = (words1 & words2).size
      union = (words1 | words2).size

      intersection.to_f / union
    end

    def description_similarity(bill1, bill2)
      desc1 = bill1.description.to_s.downcase.strip
      desc2 = bill2.description.to_s.downcase.strip

      return 0 if desc1.blank? || desc2.blank?
      return 1.0 if desc1 == desc2

      # Jaccard similarity on words
      words1 = desc1.split(/\s+/).to_set
      words2 = desc2.split(/\s+/).to_set

      return 0 if words1.empty? || words2.empty?

      intersection = (words1 & words2).size
      union = (words1 | words2).size

      intersection.to_f / union
    end

    def determine_match_type(bill1, bill2)
      if same_invoice_number?(bill1, bill2)
        "exact_invoice_number"
      elsif same_amount?(bill1, bill2)
        "same_amount"
      else
        "fuzzy"
      end
    end

    def determine_match_type_from_data(bill_data, existing)
      if bill_data[:invoice_number].present? &&
         normalize_invoice_number(bill_data[:invoice_number]) ==
           normalize_invoice_number(existing.invoice_number)
        "exact_invoice_number"
      elsif same_amount_value?(bill_data[:total].to_d, existing.total.to_d)
        "same_amount"
      else
        "fuzzy"
      end
    end

    def build_reasoning(bill1, bill2, score)
      reasons = []

      if same_invoice_number?(bill1, bill2)
        reasons << "Same invoice number '#{bill1.invoice_number}'"
      end

      if same_amount?(bill1, bill2)
        reasons << "Same amount ($#{bill1.total})"

        date_diff = (bill1.invoice_date - bill2.invoice_date).abs.to_i rescue nil
        if date_diff
          if date_diff == 0
            reasons << "Same date"
          elsif date_diff <= 7
            reasons << "Dates #{date_diff} days apart"
          end
        end
      end

      ref_sim = reference_similarity(bill1, bill2)
      if ref_sim > 0.5
        reasons << "Similar reference (#{(ref_sim * 100).round}% match)"
      end

      reasons.join("; ")
    end

    def build_warning(bill_data, existing, score)
      if score >= 100
        "EXACT DUPLICATE: Invoice #{existing.invoice_number} already exists for this supplier"
      elsif score >= 85
        "HIGH RISK: Very similar bill exists - Invoice #{existing.invoice_number}, " \
        "Amount: $#{existing.total}, Date: #{existing.invoice_date}"
      else
        "POTENTIAL DUPLICATE: Review existing bill #{existing.invoice_number}"
      end
    end

    def bill_summary(bill)
      {
        id: bill.id,
        invoice_number: bill.invoice_number,
        contact_id: bill.contact_id,
        contact_name: bill.contact&.display_name || bill.contact_name,
        total: bill.total.to_f,
        invoice_date: bill.invoice_date,
        due_date: bill.due_date,
        status: bill.status,
        reference: bill.reference,
        description: bill.description,
        source: bill.source,
        created_at: bill.created_at
      }
    end
  end
end

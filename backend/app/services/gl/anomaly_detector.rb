# frozen_string_literal: true

module Gl
  # Detects anomalous transactions that deviate from normal patterns
  # Uses statistical analysis to flag unusual activity
  #
  # SSoT: This is THE anomaly detection service for GL transactions
  #
  class AnomalyDetector
    # Anomaly score thresholds
    HIGH_ANOMALY_THRESHOLD = 80
    MEDIUM_ANOMALY_THRESHOLD = 50

    # Statistical thresholds
    ZSCORE_THRESHOLD = 2.5  # 2.5 standard deviations from mean
    MIN_HISTORY_FOR_STATS = 10

    # Detection types
    ANOMALY_TYPES = %w[
      unusual_amount
      unusual_timing
      unusual_frequency
      unusual_vendor
      unusual_category
      duplicate_pattern
      round_number
    ].freeze

    def initialize(corporate)
      @company = corporate
    end

    # Scan all recent transactions for anomalies
    def scan_transactions(days: 30, limit: 100)
      transactions = recent_transactions(days)
      anomalies = []

      transactions.each do |txn|
        result = analyze_transaction(txn)
        next unless result[:is_anomaly]

        anomalies << result
      end

      anomalies.sort_by { |a| -a[:anomaly_score] }.first(limit)
    end

    # Analyze a specific transaction
    def analyze_transaction(transaction)
      checks = []
      total_score = 0

      # Check 1: Unusual amount
      amount_check = check_unusual_amount(transaction)
      checks << amount_check
      total_score += amount_check[:score]

      # Check 2: Unusual timing
      timing_check = check_unusual_timing(transaction)
      checks << timing_check
      total_score += timing_check[:score]

      # Check 3: Round number pattern
      round_check = check_round_number(transaction)
      checks << round_check
      total_score += round_check[:score]

      # Check 4: Unusual vendor/category combination
      category_check = check_unusual_category(transaction)
      checks << category_check
      total_score += category_check[:score]

      # Check 5: Unusual frequency
      frequency_check = check_unusual_frequency(transaction)
      checks << frequency_check
      total_score += frequency_check[:score]

      # Check 6: Duplicate pattern
      duplicate_check = check_duplicate_pattern(transaction)
      checks << duplicate_check
      total_score += duplicate_check[:score]

      # Normalize score (max possible is ~200 from all checks)
      normalized_score = [[(total_score * 0.5).round, 0].max, 100].min

      {
        transaction: transaction_json(transaction),
        anomaly_score: normalized_score,
        anomaly_level: anomaly_level(normalized_score),
        is_anomaly: normalized_score >= MEDIUM_ANOMALY_THRESHOLD,
        checks: checks.select { |c| c[:score] > 0 },
        primary_reason: checks.max_by { |c| c[:score] }&.dig(:reason)
      }
    end

    # Get summary statistics
    def summary_stats
      last_30_days = scan_transactions(days: 30, limit: 1000)

      {
        total_anomalies: last_30_days.count,
        high_severity: last_30_days.count { |a| a[:anomaly_level] == "high" },
        medium_severity: last_30_days.count { |a| a[:anomaly_level] == "medium" },
        by_type: count_by_type(last_30_days),
        total_amount: last_30_days.sum { |a| a[:transaction][:amount].to_f.abs }
      }
    end

    # Get trend of anomalies over time
    def trend(weeks: 8)
      weeks.times.map do |i|
        start_date = (i + 1).weeks.ago.beginning_of_week
        end_date = start_date.end_of_week

        transactions = transactions_in_range(start_date, end_date)
        anomaly_count = transactions.count { |t| analyze_transaction(t)[:is_anomaly] }

        {
          week: start_date.strftime("%Y-W%W"),
          start_date: start_date.to_date,
          total_transactions: transactions.count,
          anomalies: anomaly_count,
          anomaly_rate: transactions.count > 0 ? (anomaly_count.to_f / transactions.count * 100).round(1) : 0
        }
      end.reverse
    end

    private

    def check_unusual_amount(transaction)
      amount = transaction_amount(transaction).abs
      account = transaction.try(:gl_account) || transaction.try(:account)

      return { type: "unusual_amount", score: 0, reason: nil } unless account

      # Get historical amounts for this account
      history = account_amount_history(account)
      return { type: "unusual_amount", score: 0, reason: nil } if history.count < MIN_HISTORY_FOR_STATS

      mean = history.sum / history.count.to_f
      variance = history.map { |h| (h - mean) ** 2 }.sum / history.count.to_f
      std_dev = Math.sqrt(variance)

      return { type: "unusual_amount", score: 0, reason: nil } if std_dev.zero?

      z_score = (amount - mean).abs / std_dev

      if z_score > ZSCORE_THRESHOLD * 2
        { type: "unusual_amount", score: 40, reason: "Amount #{format_currency(amount)} is extremely unusual (#{z_score.round(1)}σ from mean)" }
      elsif z_score > ZSCORE_THRESHOLD
        { type: "unusual_amount", score: 25, reason: "Amount #{format_currency(amount)} is unusual (#{z_score.round(1)}σ from mean)" }
      else
        { type: "unusual_amount", score: 0, reason: nil }
      end
    end

    def check_unusual_timing(transaction)
      date = transaction_date(transaction)
      return { type: "unusual_timing", score: 0, reason: nil } unless date

      # Weekend transactions
      if date.saturday? || date.sunday?
        return { type: "unusual_timing", score: 30, reason: "Transaction on weekend (#{date.strftime('%A')})" }
      end

      # Late night transactions (if we have time data)
      if transaction.try(:created_at)&.hour
        hour = transaction.created_at.hour
        if hour >= 22 || hour <= 5
          return { type: "unusual_timing", score: 25, reason: "Transaction at unusual hour (#{hour}:00)" }
        end
      end

      # Holiday check (simplified - just checks for common dates)
      if holiday?(date)
        return { type: "unusual_timing", score: 20, reason: "Transaction on public holiday" }
      end

      { type: "unusual_timing", score: 0, reason: nil }
    end

    def check_round_number(transaction)
      amount = transaction_amount(transaction).abs

      # Very round numbers (multiples of 1000 over $5k) are suspicious
      if amount >= 5000 && (amount % 1000).zero?
        { type: "round_number", score: 20, reason: "Suspiciously round amount #{format_currency(amount)}" }
      elsif amount >= 1000 && (amount % 500).zero? && (amount % 100).zero?
        { type: "round_number", score: 10, reason: "Round amount #{format_currency(amount)}" }
      else
        { type: "round_number", score: 0, reason: nil }
      end
    end

    def check_unusual_category(transaction)
      account = transaction.try(:gl_account) || transaction.try(:account)
      contact = transaction.try(:contact)

      return { type: "unusual_category", score: 0, reason: nil } unless account && contact

      # Check if this contact typically uses this account
      history = contact_account_history(contact, account)

      if history.count.zero?
        # Never seen this contact use this account before
        total_contact_txns = contact_transaction_count(contact)
        if total_contact_txns >= 5
          return { type: "unusual_category", score: 30, reason: "First transaction to account '#{account.try(:name)}' for this contact" }
        end
      end

      { type: "unusual_category", score: 0, reason: nil }
    end

    def check_unusual_frequency(transaction)
      contact = transaction.try(:contact)
      return { type: "unusual_frequency", score: 0, reason: nil } unless contact

      date = transaction_date(transaction)
      return { type: "unusual_frequency", score: 0, reason: nil } unless date

      # Check for multiple transactions on same day
      same_day_count = same_day_transactions_count(contact, date)

      if same_day_count >= 5
        { type: "unusual_frequency", score: 35, reason: "#{same_day_count} transactions with same contact on one day" }
      elsif same_day_count >= 3
        { type: "unusual_frequency", score: 20, reason: "#{same_day_count} transactions with same contact on one day" }
      else
        { type: "unusual_frequency", score: 0, reason: nil }
      end
    end

    def check_duplicate_pattern(transaction)
      # Look for potential duplicates (same amount, same contact, within 7 days)
      contact = transaction.try(:contact)
      amount = transaction_amount(transaction)
      date = transaction_date(transaction)

      return { type: "duplicate_pattern", score: 0, reason: nil } unless contact && amount && date

      similar_count = similar_transactions_count(contact, amount, date, 7)

      if similar_count >= 3
        { type: "duplicate_pattern", score: 40, reason: "Possible duplicate: #{similar_count} similar transactions in 7 days" }
      elsif similar_count >= 2
        { type: "duplicate_pattern", score: 25, reason: "Possible duplicate: #{similar_count} similar transactions in 7 days" }
      else
        { type: "duplicate_pattern", score: 0, reason: nil }
      end
    end

    def recent_transactions(days)
      start_date = days.days.ago.to_date

      # Get journal entry lines (most detailed)
      JournalEntry
        .where(corporate: @company)
        .where("entry_date >= ?", start_date)
        .includes(:lines, :contact)
        .flat_map(&:lines)
    rescue StandardError
      []
    end

    def transactions_in_range(start_date, end_date)
      JournalEntry
        .where(corporate: @company)
        .where(entry_date: start_date..end_date)
        .includes(:lines, :contact)
        .flat_map(&:lines)
    rescue StandardError
      []
    end

    def account_amount_history(account)
      LedgerLine
        .where(gl_account: account)
        .where("entry_date >= ?", 365.days.ago)
        .limit(100)
        .pluck(:debit, :credit)
        .map { |d, c| (d || 0) + (c || 0) }
    rescue StandardError
      []
    end

    def contact_account_history(contact, account)
      JournalEntry
        .where(corporate: @company, contact: contact)
        .joins(:lines)
        .where(journal_entry_lines: { gl_account_id: account.id })
        .limit(10)
    rescue StandardError
      []
    end

    def contact_transaction_count(contact)
      JournalEntry.where(corporate: @company, contact: contact).count
    rescue StandardError
      0
    end

    def same_day_transactions_count(contact, date)
      JournalEntry
        .where(corporate: @company, contact: contact, entry_date: date)
        .count
    rescue StandardError
      0
    end

    def similar_transactions_count(contact, amount, date, days)
      start_date = date - days.days
      end_date = date + days.days
      tolerance = amount.abs * 0.01 # 1% tolerance

      JournalEntry
        .where(corporate: @company, contact: contact)
        .where(entry_date: start_date..end_date)
        .joins(:lines)
        .where("ABS(journal_entry_lines.debit + journal_entry_lines.credit - ?) <= ?", amount.abs, tolerance)
        .distinct
        .count
    rescue StandardError
      0
    end

    def transaction_amount(transaction)
      (transaction.try(:debit) || 0) + (transaction.try(:credit) || 0)
    end

    def transaction_date(transaction)
      transaction.try(:entry_date) ||
        transaction.try(:journal_entry)&.entry_date ||
        transaction.try(:created_at)&.to_date
    end

    def holiday?(date)
      # Simplified Australian public holidays (major ones)
      month_day = date.strftime("%m-%d")
      holidays = %w[01-01 01-26 04-25 12-25 12-26]
      holidays.include?(month_day)
    end

    def anomaly_level(score)
      if score >= HIGH_ANOMALY_THRESHOLD
        "high"
      elsif score >= MEDIUM_ANOMALY_THRESHOLD
        "medium"
      else
        "low"
      end
    end

    def count_by_type(anomalies)
      counts = Hash.new(0)

      anomalies.each do |anomaly|
        anomaly[:checks].each do |check|
          counts[check[:type]] += 1 if check[:score] > 0
        end
      end

      counts
    end

    def format_currency(amount)
      "$#{amount.round(2).to_s(:delimited)}"
    rescue StandardError
      "$#{amount.round(2)}"
    end

    def transaction_json(transaction)
      {
        id: transaction.id,
        type: transaction.class.name,
        amount: transaction_amount(transaction),
        date: transaction_date(transaction),
        account_name: transaction.try(:gl_account)&.name || transaction.try(:account)&.name,
        account_code: transaction.try(:gl_account)&.code || transaction.try(:account)&.code,
        description: transaction.try(:description) || transaction.try(:memo),
        contact_name: transaction.try(:journal_entry)&.contact&.display_name
      }
    end
  end
end

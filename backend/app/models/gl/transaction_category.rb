# frozen_string_literal: true

module Gl
  # Categories for AI transaction categorization
  class TransactionCategory < ApplicationRecord
    self.table_name = "gl_transaction_categories"

    CATEGORY_TYPES = %w[expense revenue asset liability].freeze

    belongs_to :corporate_company
    belongs_to :default_account, class_name: "Gl::Account", optional: true
    belongs_to :default_tax_rate, class_name: "Gl::TaxRate", optional: true

    has_many :predictions, class_name: "Gl::CategorizationPrediction",
                           foreign_key: :predicted_category_id, dependent: :nullify

    validates :name, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :category_type, inclusion: { in: CATEGORY_TYPES }, allow_blank: true
    validates :confidence_threshold, numericality: { greater_than: 0, less_than_or_equal_to: 1 }

    scope :active, -> { where(active: true) }
    scope :for_type, ->(type) { where(category_type: type) }
    scope :popular, -> { order(usage_count: :desc) }

    # Match transaction against this category
    def match_score(transaction_text)
      text = transaction_text.to_s.downcase
      score = 0.0

      # Check keywords
      matched_keywords = keywords.count { |kw| text.include?(kw.downcase) }
      score += matched_keywords * 0.1 if keywords.present?

      # Check patterns (regex)
      patterns.each do |pattern|
        score += 0.2 if text.match?(Regexp.new(pattern, Regexp::IGNORECASE))
      rescue RegexpError
        next
      end

      [score, 1.0].min
    end

    # Train category with new keywords
    def learn_from_transaction!(transaction_text)
      # Extract significant words (> 3 chars, not numbers)
      words = transaction_text.to_s.split(/\s+/).select do |word|
        word.length > 3 && !word.match?(/^\d+$/)
      end

      # Add unique words not already in keywords
      new_keywords = words.map(&:downcase) - keywords.map(&:downcase)
      update!(keywords: (keywords + new_keywords.first(5)).uniq.last(20))

      increment!(:usage_count)
    end

    # Seed common categories
    def self.seed_common!(company)
      common = [
        { name: "Office Supplies", category_type: "expense", keywords: %w[staples office supplies stationery paper pens] },
        { name: "Utilities", category_type: "expense", keywords: %w[electricity gas water internet phone telstra optus] },
        { name: "Rent", category_type: "expense", keywords: %w[rent lease property landlord commercial] },
        { name: "Insurance", category_type: "expense", keywords: %w[insurance premium policy cover workers public] },
        { name: "Travel", category_type: "expense", keywords: %w[uber taxi flight qantas virgin hotel airbnb fuel petrol] },
        { name: "Meals & Entertainment", category_type: "expense", keywords: %w[restaurant cafe lunch dinner uber eats doordash] },
        { name: "Software & Subscriptions", category_type: "expense", keywords: %w[subscription software saas microsoft adobe xero] },
        { name: "Professional Services", category_type: "expense", keywords: %w[accountant lawyer consultant contractor] },
        { name: "Bank Fees", category_type: "expense", keywords: %w[bank fee charge interest merchant eftpos] },
        { name: "Wages & Salaries", category_type: "expense", keywords: %w[wages salary payroll super superannuation] },
        { name: "Sales Revenue", category_type: "revenue", keywords: %w[payment received invoice paid customer deposit] },
        { name: "Interest Income", category_type: "revenue", keywords: %w[interest earned savings term deposit] }
      ]

      common.each do |cat|
        find_or_create_by!(corporate_company: company, name: cat[:name]) do |c|
          c.category_type = cat[:category_type]
          c.keywords = cat[:keywords]
        end
      end
    end
  end
end

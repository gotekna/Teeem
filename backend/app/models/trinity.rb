# frozen_string_literal: true

class Trinity < ApplicationRecord
  # Table renamed from trinity to trinities (Rails convention)

  # Constants
  ENTRY_TYPES = %w[
    bug architecture test performance dev_note common_issue
    component feature util hook integration optimization dropdown_md
    MUST NEVER ALWAYS PROTECTED CONFIG rule REFERENCE
  ].freeze

  LEXICON_TYPES = %w[bug architecture test performance dev_note common_issue].freeze
  TEACHER_TYPES = %w[component feature util hook integration optimization dropdown_md].freeze
  BIBLE_TYPES = %w[MUST NEVER ALWAYS PROTECTED CONFIG rule REFERENCE].freeze

  CATEGORIES = %w[bible teacher lexicon].freeze

  STATUSES = %w[open fixed by_design wont_fix monitoring].freeze
  SEVERITIES = %w[critical high medium low].freeze
  DIFFICULTIES = %w[beginner intermediate advanced].freeze

  # Validations
  validates :chapter_number, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 1, less_than_or_equal_to: 21 }
  validates :chapter_name, presence: true
  validates :title, presence: true
  validates :entry_type, inclusion: { in: ENTRY_TYPES }
  validates :category, inclusion: { in: CATEGORIES }

  # Section number optional, but must be formatted if present
  # Accepts: B01.001, L01.002, T01.003 (category prefix + padded numbers, 3-digit format)
  # Also accepts: B01.01, L01.02, T01.03 (2-digit format for backward compatibility)
  # Legacy: 19.1, 19.11A (for backward compatibility during migration)
  # TEMP-XXXXX (temporary during renumbering)
  validates :section_number, format: { with: /\A([BTL]\d{2}\.\d{2,3}|\d+\.\d+[A-Z]?|TEMP-\d+)\z/, message: "must be in format BXX.YYY, LXX.YYY, TXX.YYY or legacy X.Y" }, allow_nil: true
  # Section number must be unique within chapter + category combination
  validates :section_number, uniqueness: { scope: [ :chapter_number, :category ], message: "already exists in this chapter for this category" }, allow_nil: true

  # Bug-specific validations (only when entry_type = 'bug')
  validates :status, inclusion: { in: STATUSES }, if: -> { entry_type == "bug" }
  validates :severity, inclusion: { in: SEVERITIES }, if: -> { entry_type == "bug" }

  # Teacher-specific validations
  validates :difficulty, inclusion: { in: DIFFICULTIES }, allow_nil: true

  # Callbacks
  before_save :update_search_text
  before_save :update_dense_index

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_chapter, ->(chapter) { where(chapter_number: chapter) }
  scope :by_section, ->(section) { where(section_number: section) }
  scope :by_type, ->(type) { where(entry_type: type) }
  scope :by_status, ->(status) { where(status: status) }
  scope :by_severity, ->(severity) { where(severity: severity) }
  scope :by_difficulty, ->(difficulty) { where(difficulty: difficulty) }
  scope :ordered, -> { order(:chapter_number, :section_number, :created_at) }

  # Category scopes
  scope :bible_entries, -> { where(category: "bible") }
  scope :lexicon_entries, -> { where(category: "lexicon") }
  scope :teacher_entries, -> { where(category: "teacher") }

  # Convenience scopes - Lexicon
  scope :bugs, -> { where(entry_type: "bug") }
  scope :architecture, -> { where(entry_type: "architecture") }
  scope :tests, -> { where(entry_type: "test") }
  scope :performance, -> { where(entry_type: "performance") }
  scope :dev_notes, -> { where(entry_type: "dev_note") }
  scope :common_issues, -> { where(entry_type: "common_issue") }

  # Convenience scopes - Teacher
  scope :components, -> { where(entry_type: "component") }
  scope :features, -> { where(entry_type: "feature") }
  scope :utils, -> { where(entry_type: "util") }
  scope :hooks, -> { where(entry_type: "hook") }
  scope :integrations, -> { where(entry_type: "integration") }
  scope :optimizations, -> { where(entry_type: "optimization") }

  # Combined scopes
  scope :open_bugs, -> { bugs.where(status: "open") }
  scope :fixed_bugs, -> { bugs.where(status: "fixed") }
  scope :critical_bugs, -> { bugs.where(severity: "critical") }

  # Search
  def self.search(query)
    return all if query.blank?

    where("search_text ILIKE ?", "%#{sanitize_sql_like(query)}%")
      .or(where("title ILIKE ?", "%#{sanitize_sql_like(query)}%"))
  end

  # Helper methods
  def bible_entry?
    category == "bible"
  end

  def lexicon_entry?
    category == "lexicon"
  end

  def teacher_entry?
    category == "teacher"
  end

  # Display methods
  def type_emoji
    case entry_type
    # Bible types
    when "MUST"
      "✅"
    when "NEVER"
      "❌"
    when "ALWAYS"
      "🔄"
    when "PROTECTED"
      "🔒"
    when "CONFIG"
      "⚙️"
    when "rule"
      "📖"
    when "REFERENCE"
      "📚"
    # Lexicon types
    when "bug"
      "🐛"
    when "architecture"
      "🏗️"
    when "test"
      "📊"
    when "performance"
      "📈"
    when "dev_note"
      "🎓"
    when "common_issue"
      "🔍"
    # Teacher types
    when "component"
      "🧩"
    when "feature"
      "✨"
    when "util"
      "🔧"
    when "hook"
      "🪝"
    when "integration"
      "🔌"
    when "optimization"
      "⚡"
    when "dropdown_md"
      "📋"
    else
      "📝"
    end
  end

  def status_emoji
    return nil unless entry_type == "bug"

    case status
    when "open"
      "🔴"
    when "fixed"
      "✅"
    when "by_design"
      "⚠️"
    when "wont_fix"
      "🚫"
    when "monitoring"
      "🔄"
    else
      "❓"
    end
  end

  def severity_emoji
    return nil unless entry_type == "bug"

    case severity
    when "critical"
      "🔴"
    when "high"
      "🟠"
    when "medium"
      "🟡"
    when "low"
      "🟢"
    else
      "⚪"
    end
  end

  def difficulty_emoji
    return nil unless difficulty.present?

    case difficulty
    when "beginner"
      "🟢"
    when "intermediate"
      "🟡"
    when "advanced"
      "🔴"
    else
      "⚪"
    end
  end

  def status_display
    return nil unless entry_type == "bug" && status.present?
    "#{status_emoji} #{status.upcase}"
  end

  def severity_display
    return nil unless entry_type == "bug" && severity.present?
    "#{severity_emoji} #{severity.capitalize}"
  end

  def difficulty_display
    return nil unless difficulty.present?
    "#{difficulty_emoji} #{difficulty.capitalize}"
  end

  def type_display
    "#{type_emoji} #{entry_type.titleize}"
  end

  def section_display
    return nil unless section_number.present?

    # Strip category prefix for display (B01.01 → 01.01)
    display_number = section_number.sub(/^[BTL]/, "")

    bible_entry? ? "RULE ##{display_number}" : "§#{display_number}"
  end

  def full_title
    if section_number.present?
      # Strip category prefix for display (B01.01 → 01.01)
      display_number = section_number.sub(/^[BTL]/, "")

      if bible_entry?
        "RULE ##{display_number}: #{title}"
      else
        "§#{display_number}: #{title}"
      end
    else
      title
    end
  end

  private

  def update_search_text
    self.search_text = [
      title,
      component,
      entry_type,
      # Lexicon fields
      scenario,
      root_cause,
      solution,
      prevention,
      # Teacher fields
      summary,
      code_example,
      common_mistakes,
      testing_strategy,
      related_rules,
      # Universal fields
      description,
      details,
      examples,
      recommendations
    ].compact.join(" ")
  end

  def update_dense_index
    # Create ultra-lean index: lowercase, no spaces, no formatting
    tokens = []

    # Section number (no dots): b0109
    tokens << section_number.downcase.gsub(".", "") if section_number.present?

    # Title (no spaces): sectionnumberscategoryprefix
    tokens << title.downcase.gsub(/[^a-z0-9]/, "") if title.present?

    # Type: must
    tokens << entry_type.downcase if entry_type.present?

    # Category: bible
    tokens << category if category.present?

    # Component: table
    tokens << component.downcase if component.present?

    # Extract key terms from content (remove formatting, common words)
    content_text = [
      description,
      details,
      summary,
      scenario,
      solution,
      code_example
    ].compact.join(" ")

    # Remove formatting and extract meaningful words (3+ chars)
    key_terms = content_text
      .downcase
      .gsub(/[*#\-_`]/, "") # Remove markdown
      .gsub(/must|never|always|should|will|can|use|add|set|get/, "") # Remove common words
      .scan(/\b[a-z]{3,}\b/) # Extract words 3+ chars
      .uniq
      .first(20) # Limit to 20 most unique terms

    tokens.concat(key_terms)

    # Join with spaces for simple text search
    self.dense_index = tokens.join(" ")
  end
end

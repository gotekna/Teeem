# frozen_string_literal: true

class ImplementationPattern < ApplicationRecord
  # Constants
  COMPLEXITY_LEVELS = %w[simple medium complex].freeze

  # Validations
  validates :chapter_number, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
  validates :chapter_name, presence: true
  validates :section_number, presence: true, uniqueness: { scope: :chapter_number }
  validates :pattern_title, presence: true
  validates :complexity, inclusion: { in: COMPLEXITY_LEVELS }

  # Callbacks
  before_save :update_search_text

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_chapter, ->(chapter) { where(chapter_number: chapter) }
  scope :by_complexity, ->(complexity) { where(complexity: complexity) }
  scope :by_language, ->(language) { where("? = ANY(languages)", language) }
  scope :by_tag, ->(tag) { where("? = ANY(tags)", tag) }
  scope :ordered, -> { order(:chapter_number, :section_number) }

  # Convenience scopes
  scope :simple, -> { where(complexity: "simple") }
  scope :medium, -> { where(complexity: "medium") }
  scope :complex, -> { where(complexity: "complex") }

  # Search
  def self.search(query)
    return all if query.blank?

    where("search_text ILIKE ?", "%#{sanitize_sql_like(query)}%")
      .or(where("pattern_title ILIKE ?", "%#{sanitize_sql_like(query)}%"))
  end

  # Display methods
  def complexity_emoji
    case complexity
    when "simple"
      "🟢"
    when "medium"
      "🟡"
    when "complex"
      "🔴"
    else
      "⚪"
    end
  end

  def complexity_display
    "#{complexity_emoji} #{complexity.capitalize}"
  end

  def section_display
    "§#{section_number}"
  end

  def full_title
    "#{section_display} #{pattern_title}"
  end

  # Export to markdown format
  def to_markdown
    sections = []

    sections << "## #{section_display} #{pattern_title}"
    sections << ""

    if bible_rule_reference.present?
      sections << "> **Cross-Reference:** #{bible_rule_reference}"
      sections << ""
    end

    if quick_start.present?
      sections << "### Quick Start"
      sections << ""
      sections << quick_start
      sections << ""
    end

    if full_implementation.present?
      sections << "### Full Implementation"
      sections << ""
      sections << full_implementation
      sections << ""
    end

    if architecture.present?
      sections << "### Architecture"
      sections << ""
      sections << architecture
      sections << ""
    end

    if common_mistakes.present?
      sections << "### Common Mistakes"
      sections << ""
      sections << common_mistakes
      sections << ""
    end

    if testing.present?
      sections << "### Testing"
      sections << ""
      sections << testing
      sections << ""
    end

    if migration_guide.present?
      sections << "### Migration Guide"
      sections << ""
      sections << migration_guide
      sections << ""
    end

    if integration.present?
      sections << "### Integration"
      sections << ""
      sections << integration
      sections << ""
    end

    if code_examples.present? && code_examples.any?
      sections << "### Code Examples"
      sections << ""
      code_examples.each do |example|
        sections << "**#{example['description']}**" if example["description"].present?
        sections << ""
        sections << "```#{example['language']}"
        sections << example["code"]
        sections << "```"
        sections << ""
      end
    end

    if notes.present?
      sections << "### Notes"
      sections << ""
      sections << notes
      sections << ""
    end

    # Metadata footer
    metadata_parts = []
    metadata_parts << "**Complexity:** #{complexity_display}" if complexity.present?
    metadata_parts << "**Languages:** #{languages.join(', ')}" if languages.present? && languages.any?
    metadata_parts << "**Tags:** #{tags.join(', ')}" if tags.present? && tags.any?

    if metadata_parts.any?
      sections << "---"
      sections << metadata_parts.join(" | ")
      sections << ""
    end

    sections.join("\n")
  end

  private

  def update_search_text
    self.search_text = [
      pattern_title,
      chapter_name,
      section_number,
      bible_rule_reference,
      quick_start,
      full_implementation,
      architecture,
      common_mistakes,
      testing,
      migration_guide,
      integration,
      notes,
      languages&.join(" "),
      tags&.join(" ")
    ].compact.join(" ")
  end
end

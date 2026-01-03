# frozen_string_literal: true

# NotebookPage - Individual pages with rich text content
#
# Features:
# - Tiptap/HTML rich text content
# - Content metadata (word count, etc.)
# - Author and edit tracking
# - Pinning
# - Soft delete via archived_at
#
class NotebookPage < ApplicationRecord
  # Associations
  belongs_to :section, class_name: "NotebookSection"
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :last_edited_by, class_name: "User", optional: true

  has_one :notebook, through: :section
  has_many :attachments, class_name: "NotebookPageAttachment", foreign_key: "page_id", dependent: :destroy

  # Validations
  validates :title, presence: true, length: { maximum: 255 }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Scopes
  scope :active, -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  scope :ordered, -> { order(position: :asc) }
  scope :pinned, -> { where(is_pinned: true) }
  scope :recent, -> { order(updated_at: :desc) }

  # Callbacks
  before_create :set_position
  before_save :update_content_metadata

  # Soft delete
  def archive!
    update!(archived_at: Time.current)
  end

  def restore!
    update!(archived_at: nil)
  end

  def archived?
    archived_at.present?
  end

  # Toggle pin status
  def toggle_pin!
    update!(is_pinned: !is_pinned)
  end

  # Word count from content
  def word_count
    content_metadata&.dig("word_count") || 0
  end

  # Character count
  def char_count
    content_metadata&.dig("char_count") || 0
  end

  # Plain text preview
  def preview(length = 200)
    return "" if content.blank?

    # Strip HTML tags and get plain text
    plain = ActionController::Base.helpers.strip_tags(content)
    plain.truncate(length)
  end

  # Move to different section
  def move_to_section(new_section)
    return if section_id == new_section.id

    transaction do
      # Update positions in old section
      section.pages.where("position > ?", position)
             .update_all("position = position - 1")

      # Set position in new section
      new_position = (new_section.pages.maximum(:position) || -1) + 1
      update!(section: new_section, position: new_position)
    end
  end

  # Move to new position within section
  def move_to(new_position)
    return if position == new_position

    transaction do
      if new_position > position
        section.pages.where("position > ? AND position <= ?", position, new_position)
               .update_all("position = position - 1")
      else
        section.pages.where("position >= ? AND position < ?", new_position, position)
               .update_all("position = position + 1")
      end
      update!(position: new_position)
    end
  end

  private

  def set_position
    self.position ||= (section.pages.maximum(:position) || -1) + 1
  end

  def update_content_metadata
    return unless content_changed?

    plain = ActionController::Base.helpers.strip_tags(content.to_s)
    self.content_metadata = {
      "word_count" => plain.split.size,
      "char_count" => plain.length,
      "updated_at" => Time.current.iso8601
    }
  end
end

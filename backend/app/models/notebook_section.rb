# frozen_string_literal: true

# NotebookSection - Sections within a notebook
#
# Features:
# - Ordered list within notebook
# - Contains pages
# - Soft delete via archived_at
#
class NotebookSection < ApplicationRecord
  # Associations
  belongs_to :notebook

  has_many :pages, class_name: "NotebookPage", foreign_key: "section_id", dependent: :destroy

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Scopes
  scope :active, -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  scope :ordered, -> { order(position: :asc) }

  # Callbacks
  before_create :set_position

  # Soft delete
  def archive!
    update!(archived_at: Time.current)
    pages.update_all(archived_at: Time.current)
  end

  def restore!
    update!(archived_at: nil)
  end

  def archived?
    archived_at.present?
  end

  # Page count
  def page_count
    pages.active.count
  end

  # Move to new position
  def move_to(new_position)
    return if position == new_position

    transaction do
      if new_position > position
        # Moving down: shift items between old and new position up
        notebook.sections.where("position > ? AND position <= ?", position, new_position)
                .update_all("position = position - 1")
      else
        # Moving up: shift items between new and old position down
        notebook.sections.where("position >= ? AND position < ?", new_position, position)
                .update_all("position = position + 1")
      end
      update!(position: new_position)
    end
  end

  private

  def set_position
    self.position ||= (notebook.sections.maximum(:position) || -1) + 1
  end
end

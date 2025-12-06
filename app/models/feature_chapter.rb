class FeatureChapter < ApplicationRecord
  has_many :feature_trackers, dependent: :restrict_with_error

  validates :chapter_number, presence: true, uniqueness: true
  validates :name, presence: true

  default_scope { order(:sort_order, :chapter_number) }

  def display_name
    "Ch #{chapter_number}: #{name}"
  end

  def as_json(options = {})
    super(options).merge(
      "display_name" => display_name
    )
  end
end

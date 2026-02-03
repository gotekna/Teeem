class Version < ApplicationRecord
  validates :current_version, presence: true, numericality: { only_integer: true, greater_than: 0 }

  def self.current
    first_or_create!(current_version: 101)
  end

  def self.increment!
    version = current
    version.update!(current_version: version.current_version + 1)
    version.current_version
  end

  def self.current_version_string
    v = current.current_version
    major = v / 100
    minor = v % 100
    "#{major}.#{minor}"
  end
end

# Configurable revision sequences
# e.g., Letters: A, B, C... or Numbers: 1, 2, 3...
class RevisionFormat < ApplicationRecord
  validates :name, presence: true

  scope :default_format, -> { find_by(is_default: true) || first }

  # Parse the JSON sequence array
  def sequence_array
    return [] if sequence.blank?
    JSON.parse(sequence)
  rescue JSON::ParserError
    []
  end

  # Get the next revision in sequence
  def next_revision(current = nil)
    seq = sequence_array
    return seq.first if current.blank? || seq.empty?

    current_index = seq.index(current.to_s.upcase)
    return seq.first if current_index.nil?

    seq[current_index + 1] || generate_extended_revision(current)
  end

  private

  # For letter sequences, extend beyond Z with AA, AB, etc.
  def generate_extended_revision(current)
    if current.match?(/^[A-Z]+$/)
      current.next
    else
      (current.to_i + 1).to_s
    end
  end

  # Seed default formats
  def self.seed_defaults!
    find_or_create_by!(name: 'Letters') do |f|
      f.sequence = ('A'..'Z').to_a.to_json
      f.is_default = true
    end

    find_or_create_by!(name: 'Numbers') do |f|
      f.sequence = (1..99).map(&:to_s).to_json
      f.is_default = false
    end
  end
end

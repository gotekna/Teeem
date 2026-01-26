# frozen_string_literal: true

# User's custom dictionary words that should not be flagged as spelling errors
#
# Each user can add words to their personal dictionary (company names,
# technical terms, etc.) and they will be excluded from spell check.
#
class UserDictionaryWord < ApplicationRecord
  belongs_to :user

  validates :word, presence: true, length: { minimum: 1, maximum: 100 }
  validates :word, uniqueness: { scope: :user_id, case_sensitive: false }

  # Normalize word before saving (lowercase, strip whitespace)
  before_validation :normalize_word

  # Get all words for a user as an array of strings
  def self.words_for_user(user)
    where(user: user).pluck(:word)
  end

  private

  def normalize_word
    self.word = word.to_s.strip.downcase if word.present?
  end
end

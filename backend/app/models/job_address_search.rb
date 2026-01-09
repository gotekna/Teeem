# JobAddressSearch - Indexed search terms for fast email-to-job matching
#
# Part of 6-month email performance masterpiece plan
# Enables SQL-based trigram matching instead of loading all jobs into memory
#
# Term Types:
# - 'full_address': Complete address (e.g., "32 mcilwraith street auchenflower")
# - 'street_name': Extracted street name (e.g., "mcilwraith")
# - 'title': Job title if different from name
# - 'job_number': Job number for exact matching
#
# Usage:
#   # Find jobs matching a subject line using trigram similarity
#   JobAddressSearch.matching_subject("Re: 32 Mcilwraith Street quote")
#
class JobAddressSearch < ApplicationRecord
  belongs_to :job

  validates :search_term, presence: true
  validates :term_type, presence: true, inclusion: {
    in: %w[full_address street_name title job_number suburb]
  }

  # Scope: Find search terms similar to given text using trigram matching
  # Returns jobs with similarity score, ordered by best match
  scope :matching_text, ->(text) {
    return none if text.blank?

    text_lower = text.to_s.downcase.strip
    # Guard: pg_trgm similarity requires non-empty string with 3+ chars
    return none if text_lower.blank? || text_lower.length < 3

    # Use Arel.sql with properly quoted parameter to avoid binding issues
    sanitized_text = ActiveRecord::Base.connection.quote(text_lower)
    where("search_term % ?", text_lower)
      .select(Arel.sql("job_address_searches.*, similarity(search_term, #{sanitized_text}) as match_score"))
      .order("match_score DESC")
  }

  # Scope: Find exact matches (for job numbers)
  scope :exact_match, ->(text) {
    return none if text.blank?
    where(search_term: text.downcase.strip)
  }

  # Class method: Find matching jobs for an email subject
  # Returns array of { job:, match_type:, confidence: }
  def self.find_jobs_matching_subject(subject)
    return [] if subject.blank?

    subject_lower = subject.downcase

    matches = []

    # 1. Check for explicit job ID patterns first (highest confidence)
    job_id_matches = extract_job_ids_from_text(subject)
    if job_id_matches.any?
      jobs = Job.where(id: job_id_matches)
      jobs.each do |job|
        matches << {
          job: job,
          match_type: 'explicit_job_id',
          confidence: 1.0,
          reason: "Explicit job ID found in subject"
        }
      end
    end

    # 2. Check for job number matches (high confidence)
    job_number_matches = where(term_type: 'job_number')
      .where("? ILIKE '%' || search_term || '%'", subject_lower)
      .includes(:job)

    job_number_matches.each do |search|
      matches << {
        job: search.job,
        match_type: 'job_number_match',
        confidence: 0.95,
        reason: "Job number '#{search.search_term}' found in subject"
      }
    end

    # 3. Trigram similarity matching for addresses (medium-high confidence)
    # Only search if subject is long enough to be meaningful
    if subject_lower.length >= 10
      address_matches = matching_text(subject_lower)
        .where(term_type: %w[full_address street_name title])
        .includes(:job)
        .limit(10)

      address_matches.each do |search|
        next if search.match_score < 0.3  # Minimum similarity threshold

        confidence = case search.term_type
        when 'full_address' then search.match_score * 0.9
        when 'street_name' then search.match_score * 0.75
        when 'title' then search.match_score * 0.7
        else search.match_score * 0.5
        end

        matches << {
          job: search.job,
          match_type: "#{search.term_type}_match",
          confidence: confidence,
          reason: "#{search.term_type.humanize} '#{search.search_term}' matches subject (#{(search.match_score * 100).to_i}% similarity)"
        }
      end
    end

    # Deduplicate by job ID, keeping highest confidence match
    matches
      .group_by { |m| m[:job].id }
      .map { |_job_id, job_matches| job_matches.max_by { |m| m[:confidence] } }
      .sort_by { |m| -m[:confidence] }
  end

  # Extract explicit job IDs from text
  # Patterns: id:20, id.20, id;20, #20, job:20, job.20, [20], (job 20)
  JOB_ID_PATTERN = /(?:id|job)[:.\-;]\s*(\d+)|#(\d+)|\[(\d+)\]|\(job\s*(\d+)\)/i

  def self.extract_job_ids_from_text(text)
    return [] if text.blank?

    text.scan(JOB_ID_PATTERN).flatten.compact.map(&:to_i).select(&:positive?).uniq
  end
end

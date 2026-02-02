# frozen_string_literal: true

module Gl
  # Group of potential duplicate records
  class DuplicateGroup < ApplicationRecord
    self.table_name = "gl_duplicate_groups"

    ENTITY_TYPES = %w[invoice bill payment contact vendor].freeze
    STATUSES = %w[pending reviewed resolved].freeze
    RESOLUTIONS = %w[keep_first keep_last merge none_duplicate].freeze

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :reviewed_by, class_name: "User", optional: true

    has_many :members, class_name: "Gl::DuplicateMember", foreign_key: :duplicate_group_id, dependent: :destroy

    validates :entity_type, presence: true, inclusion: { in: ENTITY_TYPES }
    validates :status, inclusion: { in: STATUSES }
    validates :resolution, inclusion: { in: RESOLUTIONS }, allow_blank: true

    scope :pending, -> { where(status: "pending") }
    scope :for_entity, ->(entity) { where(entity_type: entity) }
    scope :recent, -> { order(created_at: :desc) }

    # Review and mark as not duplicate
    def mark_not_duplicate!(user)
      update!(
        status: "resolved",
        resolution: "none_duplicate",
        reviewed_by: user,
        reviewed_at: Time.current
      )
    end

    # Resolve by keeping first
    def keep_first!(user)
      resolve!("keep_first", user)
    end

    # Resolve by keeping last
    def keep_last!(user)
      resolve!("keep_last", user)
    end

    # Resolve by merging
    def merge!(user)
      resolve!("merge", user)
    end

    # Scan for duplicates
    def self.scan!(company, entity_type)
      model = entity_model(entity_type)
      return [] unless model

      records = model.where(corporate_company: company)
      groups = []

      # Group by potential duplicate keys
      candidates = find_duplicate_candidates(records, entity_type)

      candidates.each do |key, records_group|
        next if records_group.size < 2

        # Calculate similarity
        similarity = calculate_similarity(records_group, entity_type)
        next if similarity < 0.7

        group = create!(
          corporate_company: company,
          entity_type: entity_type,
          similarity_score: similarity,
          matching_fields: key[:fields]
        )

        records_group.each_with_index do |record, index|
          group.members.create!(
            duplicable: record,
            is_primary: index.zero?
          )
        end

        groups << group
      end

      groups
    end

    private

    def resolve!(resolution_type, user)
      transaction do
        update!(
          status: "resolved",
          resolution: resolution_type,
          reviewed_by: user,
          reviewed_at: Time.current
        )

        case resolution_type
        when "keep_first"
          members.order(:id).first&.update!(is_retained: true)
        when "keep_last"
          members.order(:id).last&.update!(is_retained: true)
        when "merge"
          merge_records!
        end
      end
    end

    def merge_records!
      # Merge into first record, mark it as retained
      primary = members.where(is_primary: true).first&.duplicable
      return unless primary

      members.where.not(id: primary.id).find_each do |member|
        merge_into_primary!(primary, member.duplicable)
      end

      members.where(is_primary: true).update_all(is_retained: true)
    end

    def merge_into_primary!(primary, duplicate)
      # Override in subclass for specific merge logic
      # Default: just mark primary as retained
    end

    def self.entity_model(entity_type)
      case entity_type
      when "invoice", "bill" then Gl::Invoice
      when "payment" then Gl::Payment
      when "contact", "vendor" then Contact
      else nil
      end
    end

    def self.find_duplicate_candidates(records, entity_type)
      case entity_type
      when "invoice", "bill"
        # Group by contact + amount + date
        records.group_by do |r|
          {
            fields: %w[contact_id total date],
            values: [r.contact_id, r.total&.to_f&.round(2), r.date]
          }
        end
      when "payment"
        # Group by contact + amount + date
        records.group_by do |r|
          {
            fields: %w[contact_id amount date],
            values: [r.try(:contact_id), r.amount&.to_f&.round(2), r.date]
          }
        end
      when "contact", "vendor"
        # Group by name similarity or email
        records.group_by do |r|
          {
            fields: %w[email],
            values: [r.email&.downcase&.strip]
          }
        end.select { |k, _| k[:values].first.present? }
      else
        {}
      end
    end

    def self.calculate_similarity(records, entity_type)
      return 0 if records.size < 2

      first = records.first
      rest = records[1..]

      similarities = rest.map do |record|
        calculate_pair_similarity(first, record, entity_type)
      end

      similarities.sum / similarities.size
    end

    def self.calculate_pair_similarity(a, b, entity_type)
      score = 0.0
      weight = 0.0

      case entity_type
      when "invoice", "bill"
        score += 0.3 if a.contact_id == b.contact_id
        score += 0.3 if a.total == b.total
        score += 0.2 if a.date == b.date
        score += 0.2 if similar_string?(a.reference, b.reference)
        weight = 1.0
      when "contact"
        score += 0.4 if similar_string?(a.name, b.name)
        score += 0.3 if a.email&.downcase == b.email&.downcase
        score += 0.2 if a.phone&.gsub(/\D/, "") == b.phone&.gsub(/\D/, "")
        weight = 0.9
      else
        weight = 1.0
      end

      weight.positive? ? score / weight : 0
    end

    def self.similar_string?(a, b)
      return true if a == b
      return false if a.blank? || b.blank?

      # Simple Levenshtein-ish similarity
      a_clean = a.to_s.downcase.gsub(/\s+/, " ").strip
      b_clean = b.to_s.downcase.gsub(/\s+/, " ").strip

      a_clean == b_clean || (a_clean.include?(b_clean) || b_clean.include?(a_clean))
    end
  end
end

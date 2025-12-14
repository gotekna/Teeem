# frozen_string_literal: true

# Generic merge service that works for ANY model
# Uses Rails reflection to automatically handle relationships
#
# Usage:
#   GenericMergeService.new(primary_record, secondary_records, ModelClass).merge!
#
class GenericMergeService
  attr_reader :primary, :secondaries, :model_class, :merged_count

  def initialize(primary, secondaries, model_class)
    @primary = primary
    @secondaries = Array(secondaries)
    @model_class = model_class
    @merged_count = 0
  end

  def merge!
    return primary if secondaries.empty?

    ActiveRecord::Base.transaction do
      secondaries.each do |secondary|
        next if secondary.id == primary.id

        transfer_associations(secondary)
        fill_blank_fields(secondary)
        secondary.destroy!
        @merged_count += 1
      end

      primary.save!
    end

    primary
  end

  private

  # Transfer all has_many relationships from secondary to primary
  # Uses Rails reflection to automatically discover associations
  def transfer_associations(secondary)
    model_class.reflect_on_all_associations(:has_many).each do |reflection|
      # Skip if this would cause errors (e.g., restrict_with_error)
      next if reflection.options[:dependent] == :restrict_with_error

      # Skip through associations (they're handled via the source association)
      next if reflection.options[:through]

      foreign_key = reflection.foreign_key

      begin
        # Use savepoint to isolate failures - prevents PG::InFailedSqlTransaction
        ActiveRecord::Base.transaction(requires_new: true) do
          # Update all related records to point to primary
          secondary.send(reflection.name).update_all(foreign_key => primary.id)
        end
      rescue StandardError => e
        Rails.logger.warn "GenericMergeService: Could not transfer #{reflection.name}: #{e.message}"
      end
    end

    # Also handle has_one associations
    model_class.reflect_on_all_associations(:has_one).each do |reflection|
      next if reflection.options[:dependent] == :restrict_with_error
      next if reflection.options[:through]

      foreign_key = reflection.foreign_key

      begin
        # Use savepoint to isolate failures - prevents PG::InFailedSqlTransaction
        ActiveRecord::Base.transaction(requires_new: true) do
          related = secondary.send(reflection.name)
          if related.present? && primary.send(reflection.name).blank?
            related.update(foreign_key => primary.id)
          end
        end
      rescue StandardError => e
        Rails.logger.warn "GenericMergeService: Could not transfer #{reflection.name}: #{e.message}"
      end
    end
  end

  # Fill blank fields on primary with values from secondary
  def fill_blank_fields(secondary)
    primary.attributes.each_key do |attr|
      # Skip system columns
      next if %w[id created_at updated_at].include?(attr)

      # Only fill if primary is blank and secondary has a value
      next if primary[attr].present?
      next if secondary[attr].blank?

      primary[attr] = secondary[attr]
    end
  end
end

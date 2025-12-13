class Foundation < ApplicationRecord
  has_many :columns, foreign_key: :foundation_id, dependent: :destroy

  RESERVED_NAMES = %w[user users table tables column columns record records foundation foundations].freeze

  validates :name, presence: true
  validates :database_table_name, presence: true, uniqueness: true
  validates :slug, presence: true, uniqueness: true
  validate :name_not_reserved

  before_validation :generate_database_table_name, if: -> { database_table_name.blank? }
  before_validation :generate_slug, if: -> { slug.blank? || name_changed? }
  after_create :add_system_columns

  # Get the dynamically created ActiveRecord model for this foundation
  def dynamic_model
    return @dynamic_model if @dynamic_model

    foundation_columns = columns.includes(:lookup_foundation) # Eager load for performance

    # For system foundations with a model_class defined, use the existing Rails model
    if table_type == "system" && model_class.present?
      begin
        @dynamic_model = model_class.constantize
        return @dynamic_model
      rescue NameError => e
        Rails.logger.error "Failed to find model class #{model_class} for system foundation #{id}: #{e.message}"
        # Fall through to dynamic model creation
      end
    end

    # Generate a valid class name from the foundation name
    # Classify will handle spaces and special characters
    class_name = name.gsub(/[^a-zA-Z0-9_]/, "").classify
    table_name = database_table_name

    # Check if class already exists and is an ActiveRecord model
    begin
      if Object.const_defined?(class_name)
        existing_class = Object.const_get(class_name)
        # Only use existing class if it's an ActiveRecord model
        if existing_class.respond_to?(:ancestors) && existing_class.ancestors.include?(ActiveRecord::Base)
          @dynamic_model = existing_class
        else
          # Existing class is not an AR model (e.g., ActiveJob module), create a namespaced one
          @dynamic_model = Object.const_set("#{class_name}Table", Class.new(ApplicationRecord) do
            self.table_name = table_name
          end)
        end
      else
        # Create the dynamic model class
        @dynamic_model = Object.const_set(class_name, Class.new(ApplicationRecord) do
          self.table_name = table_name
        end)
      end
    rescue NameError => e
      # If we can't create the constant, create a generic class
      # This shouldn't happen with our sanitization, but just in case
      Rails.logger.error "Failed to create dynamic model for foundation #{id}: #{e.message}"
      @dynamic_model = Class.new(ApplicationRecord) do
        self.table_name = table_name
      end
    end

    # Add belongs_to associations for lookup columns
    add_lookup_associations(foundation_columns)

    @dynamic_model
  end

  # Reload the dynamic model (useful after adding columns or relationships)
  def reload_dynamic_model
    # Use the same sanitization as dynamic_model
    class_name = name.gsub(/[^a-zA-Z0-9_]/, "").classify
    # Only try to remove the constant if it's a valid constant name
    begin
      Object.send(:remove_const, class_name) if Object.const_defined?(class_name)
    rescue NameError
      # If class name is invalid, just skip this step
    end
    @dynamic_model = nil
    dynamic_model
  end

  private

  def name_not_reserved
    return if allow_reserved_name
    if name.present? && RESERVED_NAMES.include?(name.downcase)
      errors.add(:name, "cannot be a reserved name (#{RESERVED_NAMES.join(', ')})")
    end
  end

  def generate_database_table_name
    # Generate a safe database table name from the name field
    # e.g., "My Contacts" => "my_contacts_abc123"
    base_name = name.parameterize(separator: "_")
    # Add a random suffix to avoid collisions
    random_suffix = SecureRandom.hex(4)
    self.database_table_name = "user_#{base_name}_#{random_suffix}"
  end

  def generate_slug
    # Use database_table_name as the slug (already URL-safe with underscores)
    # This ensures clean URLs like /tables/42/purchase_orders instead of /tables/42/Purchase%20Orders
    self.slug = database_table_name
  end

  def add_lookup_associations(foundation_columns)
    # Add belongs_to associations for each lookup column
    foundation_columns.where(column_type: "lookup").each do |col|
      next unless col.lookup_foundation

      association_name = col.column_name.to_sym
      target_class_name = col.lookup_foundation.name.gsub(/[^a-zA-Z0-9_]/, "").classify

      # Skip if association already defined
      next if @dynamic_model.reflect_on_association(association_name)

      begin
        @dynamic_model.belongs_to association_name,
                                  class_name: target_class_name,
                                  foreign_key: col.column_name,
                                  optional: !col.required,
                                  primary_key: :id
      rescue => e
        Rails.logger.error "Failed to add belongs_to association for #{association_name}: #{e.message}"
      end
    end
  end

  private

  # Automatically add system columns (id, created_at, updated_at) when foundation is created
  def add_system_columns
    system_columns = [
      { name: "ID", column_name: "id", column_type: "whole_number", column_group: "System", searchable: false, position: 0 },
      { name: "Created At", column_name: "created_at", column_type: "date_and_time", column_group: "System", searchable: false, position: 998 },
      { name: "Updated At", column_name: "updated_at", column_type: "date_and_time", column_group: "System", searchable: false, position: 999 }
    ]

    system_columns.each do |attrs|
      columns.create(attrs)
    end

    Rails.logger.info "Added system columns to Foundation ##{id} (#{name})"
  end
end

class Table < ApplicationRecord
  has_many :columns, dependent: :destroy

  RESERVED_NAMES = %w[user users table tables column columns record records].freeze

  validates :name, presence: true
  validates :database_table_name, presence: true, uniqueness: true
  validates :slug, presence: true, uniqueness: true
  validate :name_not_reserved

  before_validation :generate_database_table_name, if: -> { database_table_name.blank? }
  before_validation :generate_slug, if: -> { slug.blank? || name_changed? }

  # Get the dynamically created ActiveRecord model for this table
  def dynamic_model
    return @dynamic_model if @dynamic_model

    table_columns = columns.includes(:lookup_table) # Eager load for performance

    # For system tables with a model_class defined, use the existing Rails model
    if table_type == 'system' && model_class.present?
      begin
        @dynamic_model = model_class.constantize
        return @dynamic_model
      rescue NameError => e
        Rails.logger.error "Failed to find model class #{model_class} for system table #{id}: #{e.message}"
        # Fall through to dynamic model creation
      end
    end

    # Generate a valid class name from the table name
    # Classify will handle spaces and special characters
    class_name = name.gsub(/[^a-zA-Z0-9_]/, '').classify
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
      Rails.logger.error "Failed to create dynamic model for table #{id}: #{e.message}"
      @dynamic_model = Class.new(ApplicationRecord) do
        self.table_name = table_name
      end
    end

    # Add belongs_to associations for lookup columns
    add_lookup_associations(table_columns)

    @dynamic_model
  end

  # Reload the dynamic model (useful after adding columns or relationships)
  def reload_dynamic_model
    # Use the same sanitization as dynamic_model
    class_name = name.gsub(/[^a-zA-Z0-9_]/, '').classify
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
    if name.present? && RESERVED_NAMES.include?(name.downcase)
      errors.add(:name, "cannot be a reserved name (#{RESERVED_NAMES.join(', ')})")
    end
  end

  def generate_database_table_name
    # Generate a safe database table name from the name field
    # e.g., "My Contacts" => "my_contacts_abc123"
    base_name = name.parameterize(separator: '_')
    # Add a random suffix to avoid collisions
    random_suffix = SecureRandom.hex(4)
    self.database_table_name = "user_#{base_name}_#{random_suffix}"
  end

  def generate_slug
    # Generate a URL-friendly slug from the name field
    # e.g., "Price History" => "price-history"
    base_slug = name.parameterize
    slug_candidate = base_slug
    counter = 1

    # Ensure uniqueness
    while Table.where(slug: slug_candidate).where.not(id: id).exists?
      slug_candidate = "#{base_slug}-#{counter}"
      counter += 1
    end

    self.slug = slug_candidate
  end

  def add_lookup_associations(table_columns)
    # Add belongs_to associations for each lookup column
    table_columns.where(column_type: 'lookup').each do |col|
      next unless col.lookup_table

      association_name = col.column_name.to_sym
      target_class_name = col.lookup_table.name.gsub(/[^a-zA-Z0-9_]/, '').classify

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
end

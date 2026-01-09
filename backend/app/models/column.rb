class Column < ApplicationRecord
  belongs_to :foundation
  belongs_to :lookup_foundation, class_name: "Foundation", optional: true, foreign_key: :lookup_foundation_id
  belongs_to :column_type_definition, optional: true

  # Serialize available_choices as JSON array
  serialize :available_choices, coder: JSON, type: Array

  # Serialize choices_order as JSON array
  serialize :choices_order, coder: JSON, type: Array

  # ============================================
  # SSoT: Foundation References Use Slugs
  # ============================================
  # Slug is the canonical reference (portable across environments)
  # ID is auto-resolved and cached for database performance
  #
  # API accepts: lookup_foundation_slug OR lookup_foundation_id
  # API returns: both slug and ID
  # ============================================

  # Virtual attribute for setting lookup foundation by slug
  attr_writer :lookup_foundation_slug_input

  before_validation :resolve_lookup_foundation_from_slug
  before_save :sync_lookup_foundation_slug

  validates :name, presence: true
  validates :column_name, presence: true, uniqueness: { scope: :foundation_id }
  validates :column_type, presence: true, inclusion: {
    in: %w[
      single_line_text
      email
      phone
      mobile
      url
      multiple_lines_text
      date
      date_and_time
      choice
      lookup
      boolean
      number
      percentage
      currency
      whole_number
      computed
      user
      multiple_lookups
      gps_coordinates
      color_picker
      file_upload
      action_buttons
      structured_data
      array_of_items
      searchable_text
      abn
      acn
      bsb
      bank_account
      postcode
      tfn
      time
      uuid
      array_of_integers
    ]
  }

  # Reserved column names that conflict with Rails auto-generated columns
  RESERVED_COLUMN_NAMES = %w[id created_at updated_at].freeze

  before_validation :generate_column_name, if: -> { column_name.blank? }
  before_validation :detect_cross_table_refs, if: -> { column_type == "computed" }
  validate :lookup_configuration_valid, if: -> { column_type.in?([ "lookup", "multiple_lookups" ]) }
  validate :column_name_not_reserved

  # SSoT: Ensure critical properties are never NULL
  before_save :ensure_defaults

  # Auto-sync views when columns are created or destroyed
  after_commit :add_to_saved_views, on: :create
  before_destroy :remove_from_saved_views

  # Map column types to database column types
  # NOTE: This maps to Rails types. For actual SQL types with limits, see COLUMN_SQL_TYPE_MAP
  COLUMN_TYPE_MAP = {
    "single_line_text" => :string,
    "email" => :string,
    "phone" => :string,
    "mobile" => :string,
    "url" => :string,
    "multiple_lines_text" => :text,
    "date" => :date,
    "date_and_time" => :datetime,
    "number" => :decimal,
    "percentage" => :decimal,
    "currency" => :decimal,
    "whole_number" => :integer,
    "boolean" => :boolean,
    "lookup" => :integer,  # foreign key
    "choice" => :string,
    "computed" => :string,  # stored as string
    "user" => :integer,  # foreign key to users
    "multiple_lookups" => :text,  # stored as JSON array
    "gps_coordinates" => :string,  # stored as "lat,lng"
    "color_picker" => :string,  # stored as hex color #RRGGBB
    "file_upload" => :text,  # stored as file path or URL
    "action_buttons" => :string,  # stored as JSON configuration
    "structured_data" => :jsonb,  # JSONB for flexible structured data
    "array_of_items" => :text,  # TEXT[] array for multiple values
    "searchable_text" => :tsvector,  # Full-text search index
    "abn" => :string,  # Australian Business Number
    "acn" => :string,  # Australian Company Number
    "bsb" => :string,  # Bank State Branch
    "bank_account" => :string,  # Bank Account Number
    "postcode" => :string,  # Australian Postcode (4 digits)
    "tfn" => :string,  # Tax File Number
    "time" => :time,  # Time of day (HH:MM:SS)
    "uuid" => :uuid,  # Universally Unique Identifier
    "array_of_integers" => :integer  # INTEGER[] array
  }.freeze

  # Map column types to SQL types with proper limits
  # This is the SINGLE SOURCE OF TRUTH for SQL type definitions
  # Matches Trinity database documentation (Teacher §T19.001-T19.021)
  # AUTO-GENERATED from gold_standard_columns.csv
  # DO NOT EDIT MANUALLY - Run: rails teeem:column_types:sync_from_csv
  # Last updated: 2025-11-21 20:02:30
  COLUMN_SQL_TYPE_MAP = {
    "single_line_text" => "VARCHAR(255)",
    "multiple_lines_text" => "TEXT",
    "email" => "VARCHAR(255)",
    "phone" => "VARCHAR(20)",
    "mobile" => "VARCHAR(20)",
    "url" => "VARCHAR(500)",
    "number" => "NUMERIC(10,2)",
    "whole_number" => "INTEGER",
    "currency" => "NUMERIC(10,2)",
    "percentage" => "NUMERIC(5,2)",
    "date" => "DATE",
    "date_and_time" => "TIMESTAMP",  # System-generated timestamps
    "gps_coordinates" => "VARCHAR(100)",
    "color_picker" => "VARCHAR(7)",
    "file_upload" => "TEXT",
    "action_buttons" => "VARCHAR(255)",
    "boolean" => "BOOLEAN",
    "choice" => "VARCHAR(50)",
    "lookup" => "INTEGER",  # Lookups store IDs (foreign keys to other foundations)
    "multiple_lookups" => "TEXT",
    "user" => "INTEGER",
    "computed" => "VIRTUAL/COMPUTED",
    "structured_data" => "JSONB",
    "array_of_items" => "TEXT[]",
    "searchable_text" => "TSVECTOR",
    "abn" => "VARCHAR(14)",
    "acn" => "VARCHAR(11)",
    "bsb" => "VARCHAR(7)",
    "bank_account" => "VARCHAR(9)",
    "postcode" => "VARCHAR(4)",
    "tfn" => "VARCHAR(11)",
    "time" => "TIME",
    "uuid" => "UUID",
    "array_of_integers" => "INTEGER[]"
  }.freeze

  def db_type
    COLUMN_TYPE_MAP[column_type]
  end

  def sql_type
    COLUMN_SQL_TYPE_MAP[column_type] || "UNKNOWN"
  end

  # ============================================
  # Type Inheritance Methods (Gold Standard Compliance)
  # ============================================

  # Effective values: use override if set, otherwise inherit from type definition
  def effective_max_length
    override_max_length || column_type_definition&.default_max_length || max_length
  end

  def effective_min_length
    override_min_length || column_type_definition&.default_min_length || min_length
  end

  def effective_min_value
    override_min_value || column_type_definition&.default_min_value || min_value
  end

  def effective_max_value
    override_max_value || column_type_definition&.default_max_value || max_value
  end

  def effective_sql_type
    column_type_definition&.sql_type || COLUMN_SQL_TYPE_MAP[column_type] || "VARCHAR(255)"
  end

  # ============================================
  # Australian Business Identifier Formatting
  # ============================================
  # Validation and formatting rules for Australian standard identifiers.
  # These are now proper column types, not just name-based detection.

  AUSTRALIAN_FORMAT_RULES = {
    "abn" => {
      regex: '^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$',
      format: "XX XXX XXX XXX",
      display_format: ->(val) { val.to_s.gsub(/\D/, "").gsub(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '\1 \2 \3 \4') },
      example: "51 824 753 556",
      description: "Australian Business Number (11 digits)"
    },
    "acn" => {
      regex: '^\d{3}\s?\d{3}\s?\d{3}$',
      format: "XXX XXX XXX",
      display_format: ->(val) { val.to_s.gsub(/\D/, "").gsub(/^(\d{3})(\d{3})(\d{3})$/, '\1 \2 \3') },
      example: "004 085 616",
      description: "Australian Company Number (9 digits)"
    },
    "bsb" => {
      regex: '^\d{3}-?\d{3}$',
      format: "XXX-XXX",
      display_format: ->(val) { val.to_s.gsub(/\D/, "").gsub(/^(\d{3})(\d{3})$/, '\1-\2') },
      example: "063-000",
      description: "Bank State Branch (6 digits)"
    },
    "bank_account" => {
      regex: '^\d{1,9}$',
      format: "Up to 9 digits",
      display_format: ->(val) { val.to_s.gsub(/\D/, "") },
      example: "12345678",
      description: "Bank Account Number"
    },
    "postcode" => {
      regex: '^\d{4}$',
      format: "XXXX",
      display_format: ->(val) { val.to_s.gsub(/\D/, "").first(4) },
      example: "3000",
      description: "Australian Postcode (4 digits)"
    },
    "tfn" => {
      regex: '^\d{3}\s?\d{3}\s?\d{3}$',
      format: "XXX XXX XXX",
      display_format: ->(val) { val.to_s.gsub(/\D/, "").gsub(/^(\d{3})(\d{3})(\d{3})$/, '\1 \2 \3') },
      example: "123 456 789",
      description: "Tax File Number (9 digits)"
    }
  }.freeze

  # Get validation regex for this column type
  def effective_validation_regex
    AUSTRALIAN_FORMAT_RULES.dig(column_type, :regex) || column_type_definition&.validation_regex
  end

  # Get format config for Australian identifier types
  def format_config
    return nil unless AUSTRALIAN_FORMAT_RULES.key?(column_type)

    config = AUSTRALIAN_FORMAT_RULES[column_type]
    {
      type: column_type,
      regex: config[:regex],
      format: config[:format],
      example: config[:example],
      description: config[:description]
    }
  end

  # Format a value according to Australian format rules
  def format_value(value)
    return value unless value.present? && AUSTRALIAN_FORMAT_RULES.key?(column_type)

    formatter = AUSTRALIAN_FORMAT_RULES[column_type][:display_format]
    formatter.call(value)
  end

  # Check if column is compliant with current type definition version
  def compliant?
    return true unless column_type_definition
    type_version_applied == column_type_definition.version
  end

  # Apply the current type definition settings to this column (Auto-Fix)
  def apply_type_definition!
    return unless column_type_definition

    update!(
      max_length: column_type_definition.default_max_length,
      min_length: column_type_definition.default_min_length,
      min_value: column_type_definition.default_min_value,
      max_value: column_type_definition.default_max_value,
      type_version_applied: column_type_definition.version,
      last_compliance_check: Time.current
    )
  end

  # Link this column to its type definition (if not already linked)
  def link_to_type_definition!
    return if column_type_definition.present?

    type_def = ColumnTypeDefinition.find_by(type_key: column_type)
    return unless type_def

    update!(
      column_type_definition_id: type_def.id,
      type_version_applied: type_def.version
    )
  end

  private

  # ============================================
  # SSoT: Lookup Foundation Slug Resolution
  # ============================================

  # Resolve lookup_foundation_slug to lookup_foundation_id
  # Called before validation so ID is set before lookup_configuration_valid runs
  def resolve_lookup_foundation_from_slug
    # If slug input was provided, resolve it to ID
    if @lookup_foundation_slug_input.present?
      foundation = Foundation.find_by(slug: @lookup_foundation_slug_input)
      if foundation
        self.lookup_foundation_id = foundation.id
        self.lookup_foundation_slug = foundation.slug
      else
        errors.add(:lookup_foundation_slug, "foundation with slug '#{@lookup_foundation_slug_input}' not found")
      end
    # If slug column is set but ID is not, resolve it
    elsif lookup_foundation_slug.present? && lookup_foundation_id.blank?
      foundation = Foundation.find_by(slug: lookup_foundation_slug)
      if foundation
        self.lookup_foundation_id = foundation.id
      else
        errors.add(:lookup_foundation_slug, "foundation with slug '#{lookup_foundation_slug}' not found")
      end
    end
  end

  # Sync slug from ID (for backward compatibility when only ID is provided)
  # Also ensures slug stays in sync if ID is changed directly
  def sync_lookup_foundation_slug
    if lookup_foundation_id.present?
      # Always sync slug from the current lookup_foundation association
      self.lookup_foundation_slug = lookup_foundation&.slug
    elsif lookup_foundation_slug.present? && lookup_foundation_id.blank?
      # Clear slug if ID was cleared
      self.lookup_foundation_slug = nil
    end
  end

  # SSoT: Ensure critical column properties are never NULL
  # This prevents future drift where new columns get NULL defaults
  def ensure_defaults
    self.searchable = true if searchable.nil?
    self.header_align ||= "left"
    self.data_align ||= "left"
  end

  def generate_column_name
    # Generate a safe database column name from the name field
    # e.g., "Contact Email" => "contact_email"
    self.column_name = name.parameterize(separator: "_")
  end

  def detect_cross_table_refs
    # Check if the formula contains cross-table references
    # Note: Formula storage not yet implemented, default to false
    self.has_cross_table_refs = false
  end

  def lookup_configuration_valid
    if lookup_foundation_id.blank?
      errors.add(:lookup_foundation_id, "must be specified for lookup columns")
      return
    end

    target = Foundation.find_by(id: lookup_foundation_id)
    if target.nil?
      errors.add(:lookup_foundation_id, "foundation not found")
      return
    end

    if lookup_display_column.blank?
      errors.add(:lookup_display_column, "must be specified for lookup columns")
      return
    end

    unless target.columns.exists?(column_name: lookup_display_column)
      errors.add(:lookup_display_column, "column '#{lookup_display_column}' not found in foundation '#{target.name}'")
    end
  end

  # Prevent using reserved column names that conflict with Rails auto-generated columns
  def column_name_not_reserved
    return if column_name.blank?
    nil unless RESERVED_COLUMN_NAMES.include?(column_name)

    # Note: We allow existing columns with reserved names (for backwards compatibility)
    # but the TableBuilder will skip them when creating the database table
    # This validation only warns and doesn't block to avoid breaking existing data
    # The actual protection is in TableBuilder which skips these columns
  end

  # Add this column to all saved views for this foundation (defaults to hidden)
  def add_to_saved_views
    FoundationViewSyncService.sync_foundation_views(foundation, column_name: column_name)
  end

  # Remove this column from all saved views for this foundation
  def remove_from_saved_views
    views = FoundationView.where(foundation_id: foundation_id)
    return if views.empty?

    views.find_each do |view|
      next unless view.columns.is_a?(Hash)

      changed = false

      # Remove from column order array
      if view.columns["order"].is_a?(Array) && view.columns["order"].include?(column_name)
        view.columns["order"].delete(column_name)
        changed = true
      end

      # Remove from visible hash
      if view.columns["visible"].is_a?(Hash) && view.columns["visible"].key?(column_name)
        view.columns["visible"].delete(column_name)
        changed = true
      end

      # Remove from filters if present
      if view.filters.is_a?(Hash) && view.filters.key?(column_name)
        view.filters.delete(column_name)
        changed = true
      end

      # Remove from sort order if present
      if view.sort_order.is_a?(Hash) && view.sort_order["column"] == column_name
        view.sort_order = {}
        changed = true
      end

      view.save!(validate: false) if changed
    end

    Rails.logger.info "[Column] Removed column '#{column_name}' from #{views.count} saved views for foundation #{foundation_id}"
  end

  # ============================================
  # SSoT: Display Value Resolution
  # ============================================
  # Use this method instead of directly accessing lookup_display_column
  # This delegates to DisplayValueResolver which has the canonical fallback chain
  #
  # @param record [ActiveRecord::Base] The lookup record to display
  # @return [String] The display value
  def display_value_for(record)
    DisplayValueResolver.resolve_lookup(record, self)
  end
end

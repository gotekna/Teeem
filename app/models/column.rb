class Column < ApplicationRecord
  belongs_to :table
  belongs_to :lookup_table, class_name: 'Table', optional: true, foreign_key: :lookup_table_id

  validates :name, presence: true
  validates :column_name, presence: true, uniqueness: { scope: :table_id }
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
    ]
  }

  before_validation :generate_column_name, if: -> { column_name.blank? }
  before_validation :detect_cross_table_refs, if: -> { column_type == 'computed' }
  validate :lookup_configuration_valid, if: -> { column_type.in?(['lookup', 'multiple_lookups']) }

  # Map column types to database column types
  # NOTE: This maps to Rails types. For actual SQL types with limits, see COLUMN_SQL_TYPE_MAP
  COLUMN_TYPE_MAP = {
    'single_line_text' => :string,
    'email' => :string,
    'phone' => :string,
    'mobile' => :string,
    'url' => :string,
    'multiple_lines_text' => :text,
    'date' => :date,
    'date_and_time' => :datetime,
    'number' => :decimal,
    'percentage' => :decimal,
    'currency' => :decimal,
    'whole_number' => :integer,
    'boolean' => :boolean,
    'lookup' => :integer,  # foreign key
    'choice' => :string,
    'computed' => :string,  # stored as string
    'user' => :integer,  # foreign key to users
    'multiple_lookups' => :text,  # stored as JSON array
    'gps_coordinates' => :string,  # stored as "lat,lng"
    'color_picker' => :string,  # stored as hex color #RRGGBB
    'file_upload' => :text,  # stored as file path or URL
    'action_buttons' => :string  # stored as JSON configuration
  }.freeze

  # Map column types to SQL types with proper limits
  # This is the SINGLE SOURCE OF TRUTH for SQL type definitions
  # Matches Trinity database documentation (Teacher §T19.001-T19.021)
  # AUTO-GENERATED from gold_standard_columns.csv
  # DO NOT EDIT MANUALLY - Run: rails trapid:column_types:sync_from_csv
  # Last updated: 2025-11-21 20:02:30
  COLUMN_SQL_TYPE_MAP = {
    'single_line_text' => 'VARCHAR(255)',
    'multiple_lines_text' => 'TEXT',
    'email' => 'VARCHAR(255)',
    'phone' => 'VARCHAR(20)',
    'mobile' => 'VARCHAR(20)',
    'url' => 'VARCHAR(500)',
    'number' => 'NUMERIC(10,2)',
    'whole_number' => 'INTEGER',
    'currency' => 'NUMERIC(10,2)',
    'percentage' => 'NUMERIC(5,2)',
    'date' => 'DATE',
    'date_and_time' => 'TIMESTAMP',  # System-generated timestamps
    'gps_coordinates' => 'VARCHAR(100)',
    'color_picker' => 'VARCHAR(7)',
    'file_upload' => 'TEXT',
    'action_buttons' => 'VARCHAR(255)',
    'boolean' => 'BOOLEAN',
    'choice' => 'VARCHAR(50)',
    'lookup' => 'VARCHAR(255)',
    'multiple_lookups' => 'TEXT',
    'user' => 'INTEGER',
    'computed' => 'VIRTUAL/COMPUTED'
  }.freeze

  def db_type
    COLUMN_TYPE_MAP[column_type]
  end

  def sql_type
    COLUMN_SQL_TYPE_MAP[column_type] || 'UNKNOWN'
  end

  private

  def generate_column_name
    # Generate a safe database column name from the name field
    # e.g., "Contact Email" => "contact_email"
    self.column_name = name.parameterize(separator: '_')
  end

  def detect_cross_table_refs
    # Check if the formula contains cross-table references
    formula_expression = settings&.dig('formula')
    if formula_expression.present?
      self.has_cross_table_refs = FormulaEvaluator.uses_cross_table_references?(formula_expression)
    else
      self.has_cross_table_refs = false
    end
  end

  def lookup_configuration_valid
    if lookup_table_id.blank?
      errors.add(:lookup_table_id, "must be specified for lookup columns")
      return
    end

    target = Table.find_by(id: lookup_table_id)
    if target.nil?
      errors.add(:lookup_table_id, "table not found")
      return
    end

    if lookup_display_column.blank?
      errors.add(:lookup_display_column, "must be specified for lookup columns")
      return
    end

    unless target.columns.exists?(column_name: lookup_display_column)
      errors.add(:lookup_display_column, "column '#{lookup_display_column}' not found in table '#{target.name}'")
    end
  end
end

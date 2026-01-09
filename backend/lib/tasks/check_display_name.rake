# frozen_string_literal: true

namespace :reports do
  desc "Check display_name column status"
  task check_display_name: :environment do
    puts "=== ULTRA: display_name Column Analysis ==="
    puts ""

    [487, 488, 489].each do |fid|
      f = Foundation.find(fid)
      puts "Foundation #{fid}: #{f.name}"
      puts "  Table: #{f.table_name}"

      # Check if column exists in DB
      db_cols = ActiveRecord::Base.connection.columns(f.table_name).map(&:name)
      has_db_col = db_cols.include?("display_name")
      puts "  DB column exists: #{has_db_col}"

      # Check Foundation columns
      col = f.columns.find_by(column_name: "display_name")
      if col
        puts "  Foundation col ID: #{col.id}, pos: #{col.position}, has_ui: #{col.has_ui}, hidden: #{col.hidden}"
      else
        puts "  Foundation col: MISSING - CREATING NOW..."
        col = f.columns.create!(
          column_name: "display_name",
          display_name: "Display Name",
          position: 2,
          has_ui: true,
          hidden: false,
          column_type: "text"
        )
        puts "  CREATED: ID #{col.id}"
      end
      puts ""
    end
  end
end

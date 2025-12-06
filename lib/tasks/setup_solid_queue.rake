namespace :solid_queue do
  desc "Setup Solid Queue tables if they don't exist"
  task setup: :environment do
    # Check if solid_queue_jobs table exists
    unless ActiveRecord::Base.connection.table_exists?("solid_queue_jobs")
      puts "Creating Solid Queue tables..."
      # Load the queue schema
      load Rails.root.join("db", "queue_schema.rb")
      puts "Solid Queue tables created successfully"
    else
      puts "Solid Queue tables already exist"
    end
  end
end

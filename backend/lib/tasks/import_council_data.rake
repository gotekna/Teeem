namespace :councils do
  desc "Import Australian council data from CSV"
  task import: :environment do
    require "csv"

    csv_file = Rails.root.join("db", "seeds", "australian_councils.csv")

    unless File.exist?(csv_file)
      puts "Error: #{csv_file} not found"
      puts "Please download council data and place it in db/seeds/"
      exit 1
    end

    puts "Importing council data from #{csv_file}..."

    CSV.foreach(csv_file, headers: true) do |row|
      AustralianCouncil.find_or_create_by(
        postcode: row["postcode"],
        suburb: row["suburb"]&.downcase
      ) do |council|
        council.state = row["state"]
        council.council_name = row["council_name"]
        council.council_type = row["council_type"]
        council.latitude = row["latitude"]
        council.longitude = row["longitude"]
      end
    end

    puts "Import complete. Total councils: #{AustralianCouncil.count}"
  end
end

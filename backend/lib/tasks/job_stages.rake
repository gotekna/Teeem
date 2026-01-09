namespace :job_stages do
  desc "Seed default job stages"
  task seed_defaults: :environment do
    stages = [
      { name: "Deposit", color: "blue", position: 1 },
      { name: "Slab", color: "indigo", position: 2 },
      { name: "Frame", color: "purple", position: 3 },
      { name: "Lockup", color: "green", position: 4 },
      { name: "Fixtures", color: "teal", position: 5 },
      { name: "Completion", color: "slate", position: 6 }
    ]

    stages.each do |stage_data|
      JobStage.find_or_create_by!(name: stage_data[:name]) do |stage|
        stage.color = stage_data[:color]
        stage.position = stage_data[:position]
      end
    end

    puts "Seeded #{stages.count} job stages"
  end
end

# frozen_string_literal: true

namespace :trapid do
  namespace :agents do
    desc "Migrate run history from JSON file to database (one-time migration)"
    task migrate_history: :environment do
      require 'json'

      json_path = Rails.root.join("../.claude/agents/run-history.json")

      unless File.exist?(json_path)
        puts "⚠️  No run-history.json found at #{json_path}"
        puts "Migration not needed - using database tracking only"
        exit 0
      end

      puts "🔄 Migrating run history from JSON to database..."
      puts ""

      # Read the JSON file
      json_data = JSON.parse(File.read(json_path))

      migrated = 0
      skipped = 0

      json_data['agents'].each do |agent_id, history|
        agent = AgentDefinition.find_by(agent_id: agent_id)

        if agent.nil?
          puts "⚠️  Agent '#{agent_id}' not found in database, skipping"
          skipped += 1
          next
        end

        # Only migrate if the agent has runs in JSON but database doesn't
        if history['total_runs'].to_i > 0 && agent.total_runs == 0
          last_run_time = history['last_run'] ? Time.parse(history['last_run']) : nil

          agent.update!(
            total_runs: history['total_runs'].to_i,
            successful_runs: history['successful_runs'].to_i,
            failed_runs: history['failed_runs'].to_i,
            last_run_at: last_run_time,
            last_status: history['last_status'],
            last_message: history['last_message'],
            last_run_details: history['runs']&.last
          )

          puts "✅ Migrated #{agent_id}: #{history['total_runs']} runs, last: #{last_run_time&.strftime('%Y-%m-%d %H:%M')}"
          migrated += 1
        else
          status = agent.total_runs > 0 ? "already has #{agent.total_runs} runs" : "no runs to migrate"
          puts "⏭️  Skipped #{agent_id}: #{status}"
          skipped += 1
        end
      end

      puts ""
      puts "=" * 60
      puts "📊 Migration Summary:"
      puts "  Migrated: #{migrated}"
      puts "  Skipped: #{skipped}"
      puts "=" * 60
      puts ""

      if migrated > 0
        puts "✅ Migration complete!"
        puts ""
        puts "💡 Next steps:"
        puts "  1. Verify data: bin/rails runner \"AgentDefinition.where('total_runs > 0').each { |a| puts \\\"#{a.agent_id}: #{a.total_runs} runs\\\" }\""
        puts "  2. Backup JSON: cp .claude/agents/run-history.json .claude/agents/run-history.json.backup"
        puts "  3. Remove JSON: rm .claude/agents/run-history.json"
      else
        puts "✅ No data needed migration - database is up to date"
      end
    end
  end
end

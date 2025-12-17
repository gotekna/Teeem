# frozen_string_literal: true

namespace :claim_stages do
  desc "Seed default claim stage templates for all job types"
  task seed_defaults: :environment do
    puts "Seeding default claim stage templates..."

    # Residential Build (6 stages - 100%)
    residential_stages = [
      { name: "Deposit", percentage: 5.0, sequence_order: 0, invoice_match_pattern: "deposit|dep" },
      { name: "Slab", percentage: 15.0, sequence_order: 1, invoice_match_pattern: "slab|base" },
      { name: "Frame", percentage: 20.0, sequence_order: 2, invoice_match_pattern: "frame" },
      { name: "Enclosed", percentage: 25.0, sequence_order: 3, invoice_match_pattern: "enclos|lock" },
      { name: "Fixing", percentage: 20.0, sequence_order: 4, invoice_match_pattern: "fix" },
      { name: "Practical Completion", percentage: 15.0, sequence_order: 5, invoice_match_pattern: "pc|prac|completion" }
    ]

    # Kitchen (4 stages - 100%)
    kitchen_stages = [
      { name: "Deposit", percentage: 5.0, sequence_order: 0, invoice_match_pattern: "deposit|dep" },
      { name: "Kitchen 2nd Draw", percentage: 45.0, sequence_order: 1, invoice_match_pattern: "2nd|second" },
      { name: "Kitchen 3rd Draw", percentage: 45.0, sequence_order: 2, invoice_match_pattern: "3rd|third" },
      { name: "Kitchen Final Draw", percentage: 5.0, sequence_order: 3, invoice_match_pattern: "final|complet" }
    ]

    # Standard stages for other job types (6 stages - 100%)
    standard_stages = [
      { name: "Deposit", percentage: 10.0, sequence_order: 0, invoice_match_pattern: "deposit|dep" },
      { name: "Stage 1", percentage: 20.0, sequence_order: 1, invoice_match_pattern: "stage.*1|first" },
      { name: "Stage 2", percentage: 20.0, sequence_order: 2, invoice_match_pattern: "stage.*2|second" },
      { name: "Stage 3", percentage: 20.0, sequence_order: 3, invoice_match_pattern: "stage.*3|third" },
      { name: "Stage 4", percentage: 20.0, sequence_order: 4, invoice_match_pattern: "stage.*4|fourth" },
      { name: "Final", percentage: 10.0, sequence_order: 5, invoice_match_pattern: "final|complet" }
    ]

    # Map job type names to stage configurations
    stage_configs = {
      "Residential" => residential_stages,
      "Residential Build" => residential_stages,
      "New Build" => residential_stages,
      "Kitchen" => kitchen_stages,
      "Kitchen Renovation" => kitchen_stages
    }

    created_count = 0
    skipped_count = 0

    JobType.find_each do |job_type|
      # Check if already has templates
      if job_type.claim_stage_templates.any?
        puts "  Skipping #{job_type.name} (already has #{job_type.claim_stage_templates.count} templates)"
        skipped_count += 1
        next
      end

      # Get appropriate stages for this job type
      stages = stage_configs[job_type.name] || standard_stages

      puts "  Creating #{stages.length} templates for #{job_type.name}..."

      stages.each do |stage_attrs|
        job_type.claim_stage_templates.create!(stage_attrs.merge(is_active: true))
      end

      created_count += 1
    end

    puts ""
    puts "Done! Created templates for #{created_count} job types, skipped #{skipped_count}."
  end

  desc "Show claim stage templates summary"
  task summary: :environment do
    puts "Claim Stage Templates Summary"
    puts "=" * 50

    JobType.includes(:claim_stage_templates).find_each do |job_type|
      templates = job_type.claim_stage_templates.ordered
      total = templates.sum(&:percentage)

      puts ""
      puts "#{job_type.name} (#{templates.count} stages, #{total}% total)"
      puts "-" * 40

      if templates.any?
        templates.each_with_index do |t, i|
          pattern = t.invoice_match_pattern.present? ? " [#{t.invoice_match_pattern}]" : ""
          puts "  #{i + 1}. #{t.name}: #{t.percentage}%#{pattern}"
        end
      else
        puts "  (no templates configured)"
      end
    end
  end
end

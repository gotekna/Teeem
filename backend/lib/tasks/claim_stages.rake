# frozen_string_literal: true

namespace :claim_stages do
  desc "Seed claim stage templates (HIA Residential, Kitchen Renovation, Standard)"
  task seed: :environment do
    puts "Seeding claim stage templates..."

    tenant = Tenant.first
    unless tenant
      puts "  No tenant found. Aborting."
      next
    end

    ActsAsTenant.with_tenant(tenant) do
      created = 0

      # HIA Residential (7 stages - 100%)
      created += seed_template(
        tenant: tenant,
        name: "HIA Residential",
        description: "Standard HIA 7-stage progress claim for residential builds",
        position: 1,
        lines: [
          { name: "Deposit",                percentage: 5.0,  match_keywords: "deposit,dep" },
          { name: "Site Works",             percentage: 5.0,  match_keywords: "site,siteworks" },
          { name: "Slab",                   percentage: 15.0, match_keywords: "slab,base" },
          { name: "Frame",                  percentage: 20.0, match_keywords: "frame" },
          { name: "Lock Up",                percentage: 25.0, match_keywords: "lock,lockup,enclosed" },
          { name: "Fixing",                 percentage: 20.0, match_keywords: "fix,fixing" },
          { name: "Practical Completion",   percentage: 10.0, match_keywords: "completion,pc,practical,handover" }
        ]
      )

      # Kitchen Renovation (4 stages - 100%)
      created += seed_template(
        tenant: tenant,
        name: "Kitchen Renovation",
        description: "4-stage progress claim for kitchen renovations",
        position: 2,
        lines: [
          { name: "Deposit",          percentage: 5.0,  match_keywords: "deposit,dep" },
          { name: "Kitchen 2nd Draw", percentage: 45.0, match_keywords: "2nd,second" },
          { name: "Kitchen 3rd Draw", percentage: 45.0, match_keywords: "3rd,third" },
          { name: "Kitchen Final",    percentage: 5.0,  match_keywords: "final,complet" }
        ]
      )

      # Standard (6 stages - 100%)
      created += seed_template(
        tenant: tenant,
        name: "Standard",
        description: "Generic 6-stage progress claim template",
        position: 3,
        lines: [
          { name: "Deposit",  percentage: 10.0, match_keywords: "deposit,dep" },
          { name: "Stage 1",  percentage: 20.0, match_keywords: "stage.*1,first" },
          { name: "Stage 2",  percentage: 20.0, match_keywords: "stage.*2,second" },
          { name: "Stage 3",  percentage: 20.0, match_keywords: "stage.*3,third" },
          { name: "Stage 4",  percentage: 20.0, match_keywords: "stage.*4,fourth" },
          { name: "Final",    percentage: 10.0, match_keywords: "final,complet" }
        ]
      )

      puts ""
      puts "Done! Created #{created} template(s)."
    end
  end

  desc "Show claim stage templates summary"
  task summary: :environment do
    puts "Claim Stage Templates Summary"
    puts "=" * 60

    ClaimStageTemplate.active.ordered.includes(:lines).each do |template|
      total = template.lines.sum(&:percentage)
      puts ""
      puts "#{template.name} (#{template.lines.size} stages, #{total}% total)"
      puts "-" * 50

      template.lines.ordered.each_with_index do |line, i|
        keywords = line.match_keywords.present? ? " [#{line.match_keywords}]" : ""
        puts "  #{i + 1}. #{line.name}: #{line.percentage}%#{keywords}"
      end
    end

    if ClaimStageTemplate.active.count == 0
      puts ""
      puts "  (no templates found - run rake claim_stages:seed)"
    end
  end
end

def seed_template(tenant:, name:, description:, position:, lines:)
  if ClaimStageTemplate.exists?(name: name)
    puts "  Skipping '#{name}' (already exists)"
    return 0
  end

  template = ClaimStageTemplate.create!(
    tenant: tenant,
    name: name,
    description: description,
    position: position
  )

  lines.each_with_index do |line_attrs, idx|
    template.lines.create!(
      tenant: tenant,
      name: line_attrs[:name],
      percentage: line_attrs[:percentage],
      sequence_order: idx + 1,
      match_keywords: line_attrs[:match_keywords]
    )
  end

  puts "  Created '#{name}' with #{lines.size} stages"
  1
end

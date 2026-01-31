# frozen_string_literal: true

module Api
  module V1
    class DocumentationController < ApplicationController
      skip_before_action :authorize_request, only: [ :index, :show, :search ]

      # GET /api/v1/documentation
      # Returns list of available documentation files
      def index
        docs = [
          {
            id: "bible",
            name: "Bible",
            description: "Development rules and protected patterns",
            icon: "📖",
            audience: "Developers",
            path: "TEEEM_BIBLE.md",
            chapters: 21
          },
          {
            id: "teacher",
            name: "Teacher",
            description: "Code examples and implementation guides",
            icon: "🔧",
            audience: "Developers",
            path: "TEEEM_TEACHER.md",
            chapters: 20,
            has_database: true,
            api_path: "/api/v1/documentation_entries?category=teacher"
          },
          {
            id: "lexicon",
            name: "Lexicon",
            description: "Bug history and knowledge base",
            icon: "📕",
            audience: "Developers",
            path: "TEEEM_LEXICON.md",
            chapters: 20,
            has_database: true,
            api_path: "/api/v1/documentation_entries?category=lexicon"
          },
          {
            id: "trinity",
            name: "Trinity",
            description: "Complete database table (Bible + Teacher + Lexicon)",
            icon: "✨",
            audience: "Developers",
            chapters: 21,
            has_database: true,
            api_path: "/api/v1/trinity"
          },
          {
            id: "user-manual",
            name: "User Manual",
            description: "Step-by-step user guides",
            icon: "📘",
            audience: "End Users",
            path: "TEEEM_USER_MANUAL.md",
            chapters: 26
          }
        ]

        render json: { success: true, data: docs }
      end

      # GET /api/v1/documentation/:id
      # Returns content of a specific documentation file
      def show
        doc_id = params[:id]
        chapter = params[:chapter]

        file_path = case doc_id
        when "bible"
                      Rails.root.join("..", "TEEEM_DOCS", "TEEEM_BIBLE.md")
        when "teacher"
                      Rails.root.join("..", "TEEEM_DOCS", "TEEEM_TEACHER.md")
        when "lexicon"
                      Rails.root.join("..", "TEEEM_DOCS", "TEEEM_LEXICON.md")
        when "user-manual"
                      Rails.root.join("..", "TEEEM_DOCS", "TEEEM_USER_MANUAL.md")
        else
                      return render json: { success: false, error: "Documentation not found" }, status: :not_found
        end

        # If markdown file doesn't exist and it's Bible, generate from database
        if !File.exist?(file_path) && doc_id == "bible"
          content = generate_bible_markdown
        elsif !File.exist?(file_path)
          return render json: { success: false, error: "File not found" }, status: :not_found
        else
          content = File.read(file_path)
        end

        # If chapter specified, extract that chapter only
        if chapter.present?
          content = extract_chapter(content, chapter.to_i)
        end

        render json: {
          success: true,
          data: {
            id: doc_id,
            content: content,
            chapter: chapter
          }
        }
      rescue StandardError => e
        Rails.logger.error("Documentation error: #{e.message}")
        render json: { success: false, error: "Failed to load documentation" }, status: :internal_server_error
      end

      # GET /api/v1/documentation/search?q=gantt
      # Searches across all documentation files
      def search
        query = params[:q]&.downcase

        if query.blank?
          return render json: { success: false, error: "Query parameter required" }, status: :bad_request
        end

        results = []
        docs_path = Rails.root.join("..", "TEEEM_DOCS")

        # Search in Trinity+1 files
        [ "TEEEM_BIBLE.md", "TEEEM_TEACHER.md", "TEEEM_LEXICON.md", "TEEEM_USER_MANUAL.md" ].each do |filename|
          file_path = docs_path.join(filename)
          next unless File.exist?(file_path)

          content = File.read(file_path)
          doc_type = filename.gsub("TEEEM_", "").gsub(".md", "").downcase

          # Find matching lines
          content.each_line.with_index do |line, index|
            if line.downcase.include?(query)
              results << {
                doc_type: doc_type,
                doc_name: filename.gsub("TEEEM_", "").gsub(".md", ""),
                line_number: index + 1,
                content: line.strip,
                icon: doc_type == "bible" ? "📖" : (doc_type == "lexicon" ? "📕" : "📘")
              }
            end
          end
        end

        render json: {
          success: true,
          data: {
            query: query,
            results: results.first(50), # Limit to 50 results
            total: results.count
          }
        }
      rescue StandardError => e
        Rails.logger.error("Search error: #{e.message}")
        render json: { success: false, error: "Search failed" }, status: :internal_server_error
      end

      private

      def generate_bible_markdown
        # Generate markdown content from database (matches export_bible rake task format)
        content = <<~HEADER
          # TEEEM BIBLE - Development Rules

          **Version:** 2.0.0
          **Last Updated:** #{Time.current.strftime("%Y-%m-%d %H:%M %Z")}
          **Authority Level:** ABSOLUTE
          **Audience:** Claude Code + Human Developers
          **Source of Truth:** Database table `bible_rules` (this content is auto-generated)

          ---

          ## 🔴 CRITICAL: Read This First

          ### This Document is "The Bible"

          This file is the **absolute authority** for all TEEEM development where chapters exist.

          **This Bible Contains RULES ONLY:**
          - ✅ MUST do this
          - ❌ NEVER do that
          - 🔄 ALWAYS check X before Y
          - 🔒 Protected code patterns
          - ⚙️ Configuration values that must match

          **This content is AUTO-GENERATED from the database.**

          **For IMPLEMENTATION PATTERNS (code examples, how-to guides):**
          - 🔧 See [TEEEM_TEACHER.md](TEEEM_TEACHER.md)

          **For KNOWLEDGE (how things work, bug history, why we chose X):**
          - 📕 See [TEEEM_LEXICON.md](TEEEM_LEXICON.md)

          **For USER GUIDES (how to use features):**
          - 📘 See [TEEEM_USER_MANUAL.md](TEEEM_USER_MANUAL.md)

          ---

        HEADER

        # Group rules by chapter
        (0..20).each do |chapter_num|
          rules = BibleRule.by_chapter(chapter_num).ordered
          next if rules.empty?

          chapter_name = rules.first.chapter_name

          content += <<~CHAPTER
            # Chapter #{chapter_num}: #{chapter_name}

            ┌─────────────────────────────────────────────────┐
            │ 🔧 TEACHER (HOW):     TEEEM_TEACHER.md Ch#{chapter_num}    │
            │ 📕 LEXICON (BUGS):    TEEEM_LEXICON.md Ch#{chapter_num}    │
            │ 📘 USER MANUAL (USE): TEEEM_USER_MANUAL.md Ch#{chapter_num} │
            └─────────────────────────────────────────────────┘

            **Last Updated:** #{rules.maximum(:updated_at).strftime("%Y-%m-%d %H:%M %Z")}

          CHAPTER

          rules.each do |rule|
            content += "## RULE ##{rule.rule_number}: #{rule.title}\n\n"
            content += "#{rule.type_display}\n\n" if rule.rule_type.present?
            content += "#{rule.description}\n\n"

            if rule.code_example.present?
              content += "### Code Example\n\n"
              content += "```\n#{rule.code_example}\n```\n\n"
            end

            if rule.cross_references.present?
              content += "### Cross-References\n\n"
              content += "#{rule.cross_references}\n\n"
            end

            content += "---\n\n"
          end
        end

        content
      end

      def extract_chapter(content, chapter_num)
        # Extract specific chapter from markdown
        lines = content.split("\n")
        chapter_start = nil
        chapter_end = nil

        # Find chapter start
        lines.each_with_index do |line, idx|
          if line.match?(/^# Chapter #{chapter_num}:/i)
            chapter_start = idx
            break
          end
        end

        return "Chapter #{chapter_num} not found" if chapter_start.nil?

        # Find next chapter (chapter end)
        lines[(chapter_start + 1)..-1].each_with_index do |line, idx|
          if line.match?(/^# Chapter \d+:/i)
            chapter_end = chapter_start + idx + 1
            break
          end
        end

        # If no next chapter found, take until end
        chapter_end ||= lines.length

        lines[chapter_start...chapter_end].join("\n")
      end
    end
  end
end

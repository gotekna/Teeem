# frozen_string_literal: true

module Api
  module V1
    class TrinityController < ApplicationController
      skip_before_action :authorize_request, only: [ :index, :show, :stats, :constants ]
      before_action :set_trinity_entry, only: [ :show, :update, :destroy ]

      # GET /api/v1/trinity
      # Query params:
      #   ?chapter=3
      #   ?section=19.1
      #   ?type=bug|architecture|component|feature|etc
      #   ?category=bible|lexicon|teacher (filters by category)
      #   ?status=open (only for bugs)
      #   ?severity=critical (only for bugs)
      #   ?difficulty=beginner|intermediate|advanced (only for teacher)
      #   ?search=xero sync
      def index
        @entries = Trinity.all

        # Filter by category
        if params[:category] == "bible"
          @entries = @entries.bible_entries
        elsif params[:category] == "lexicon"
          @entries = @entries.lexicon_entries
        elsif params[:category] == "teacher"
          @entries = @entries.teacher_entries
        end

        @entries = @entries.by_chapter(params[:chapter]) if params[:chapter].present?
        @entries = @entries.by_section(params[:section]) if params[:section].present?
        @entries = @entries.by_type(params[:type]) if params[:type].present?
        @entries = @entries.by_status(params[:status]) if params[:status].present?
        @entries = @entries.by_severity(params[:severity]) if params[:severity].present?
        @entries = @entries.by_difficulty(params[:difficulty]) if params[:difficulty].present?
        @entries = @entries.search(params[:search]) if params[:search].present?

        # Order by chapter and section (Bible needs all entries, not just recent 100)
        @entries = @entries.ordered

        render json: {
          success: true,
          data: @entries.map { |entry| entry_json(entry, detailed: true) },
          total: @entries.count
        }
      end

      # GET /api/v1/trinity/:id
      def show
        render json: {
          success: true,
          data: entry_json(@entry, detailed: true)
        }
      end

      # POST /api/v1/trinity
      def create
        @entry = Trinity.new(entry_params)
        @entry.created_by = current_user_identifier
        @entry.updated_by = current_user_identifier

        if @entry.save
          render json: {
            success: true,
            data: entry_json(@entry, detailed: true),
            message: "Documentation entry created successfully"
          }, status: :created
        else
          render json: {
            success: false,
            errors: @entry.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/trinity/:id
      def update
        @entry.updated_by = current_user_identifier

        if @entry.update(entry_params)
          render json: {
            success: true,
            data: entry_json(@entry, detailed: true),
            message: "Documentation entry updated successfully"
          }
        else
          render json: {
            success: false,
            errors: @entry.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/trinity/:id
      def destroy
        @entry.destroy
        render json: {
          success: true,
          message: "Documentation entry deleted successfully"
        }
      end

      # GET /api/v1/trinity/stats
      # Returns statistics about entries per chapter
      def stats
        stats = {
          total_entries: Trinity.count,
          bible_count: Trinity.bible_entries.count,
          lexicon_count: Trinity.lexicon_entries.count,
          teacher_count: Trinity.teacher_entries.count,
          by_type: Trinity.group(:entry_type).count,
          by_category: Trinity.group(:category).count,
          by_status: Trinity.group(:status).count,
          by_severity: Trinity.group(:severity).count,
          by_difficulty: Trinity.group(:difficulty).count,
          by_chapter: Trinity.group(:chapter_number, :chapter_name).count.map do |(num, name), count|
            {
              chapter_number: num,
              chapter_name: name,
              total_count: count,
              bible_count: Trinity.by_chapter(num).bible_entries.count,
              lexicon_count: Trinity.by_chapter(num).lexicon_entries.count,
              teacher_count: Trinity.by_chapter(num).teacher_entries.count,
              open_bugs_count: Trinity.by_chapter(num).open_bugs.count,
              critical_bugs_count: Trinity.by_chapter(num).critical_bugs.count
            }
          end.sort_by { |c| c[:chapter_number] }
        }

        render json: {
          success: true,
          data: stats
        }
      end

      # GET /api/v1/trinity/constants
      # Returns Trinity model constants for use in UI filters/selects
      def constants
        render json: {
          success: true,
          data: {
            entry_types: Trinity::ENTRY_TYPES,
            lexicon_types: Trinity::LEXICON_TYPES,
            teacher_types: Trinity::TEACHER_TYPES,
            bible_types: Trinity::BIBLE_TYPES,
            categories: Trinity::CATEGORIES,
            statuses: Trinity::STATUSES,
            severities: Trinity::SEVERITIES,
            difficulties: Trinity::DIFFICULTIES
          }
        }
      end

      # GET /api/v1/trinity/search?q=section+numbers
      # Fast search using dense_index
      # Query params:
      #   ?q=search query (required)
      #   ?full=true (optional - include full content in response)
      #   ?category=bible|lexicon|teacher (optional - filter by category)
      def search
        query = params[:q]

        if query.blank?
          return render json: {
            success: false,
            error: 'Query parameter "q" is required'
          }, status: :bad_request
        end

        # Search dense_index using PostgreSQL text search
        @entries = Trinity.where("dense_index ILIKE ?", "%#{query.downcase}%")

        # Optional category filter
        if params[:category].present?
          @entries = @entries.where(category: params[:category])
        end

        # Order by relevance (exact section match first, then by chapter/section)
        @entries = @entries.order(:section_number)

        # Limit results to prevent overwhelming responses
        @entries = @entries.limit(50)

        # Minimal response by default (just id, section, title)
        detailed = params[:full] == "true"

        render json: {
          success: true,
          query: query,
          count: @entries.count,
          results: @entries.map { |entry|
            if detailed
              entry_json(entry, detailed: true)
            else
              {
                id: entry.id,
                section_number: entry.section_number,
                category: entry.category,
                title: entry.title,
                chapter_number: entry.chapter_number,
                chapter_name: entry.chapter_name,
                component: entry.component,
                entry_type: entry.entry_type
              }
            end
          }
        }
      end

      # POST /api/v1/trinity/export_lexicon
      # Exports Lexicon (bug/architecture/etc) entries to TEEEM_LEXICON.md
      def export_lexicon
        result = system("cd #{Rails.root} && bundle exec rake teeem:export_lexicon")

        if result
          render json: {
            success: true,
            message: "Lexicon exported to TEEEM_LEXICON.md successfully",
            file_path: Rails.root.join("..", "TEEEM_DOCS", "TEEEM_LEXICON.md").to_s,
            total_entries: Trinity.lexicon_entries.count
          }
        else
          render json: {
            success: false,
            error: "Export failed"
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/trinity/export_teacher
      # Exports Teacher (component/feature/etc) entries to TEEEM_TEACHER.md
      def export_teacher
        result = system("cd #{Rails.root} && bundle exec rake teeem:export_teacher")

        if result
          render json: {
            success: true,
            message: "Teacher exported to TEEEM_TEACHER.md successfully",
            file_path: Rails.root.join("..", "TEEEM_DOCS", "TEEEM_TEACHER.md").to_s,
            total_entries: Trinity.teacher_entries.count
          }
        else
          render json: {
            success: false,
            error: "Export failed"
          }, status: :internal_server_error
        end
      end

      private

      def set_trinity_entry
        @entry = Trinity.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Trinity entry not found"
        }, status: :not_found
      end

      def current_user_identifier
        # Try to get user name/email from current_user (if authenticated)
        if @current_user
          @current_user.name || @current_user.email
        else
          # Fallback for unauthenticated requests (should not happen for create/update)
          "System"
        end
      end

      def entry_params
        params.require(:trinity).permit(
          :category,
          :chapter_number,
          :chapter_name,
          :section_number,
          :component,
          :title,
          :entry_type,
          # Bug-specific fields (Lexicon)
          :status,
          :severity,
          :first_reported,
          :last_occurred,
          :fixed_date,
          :scenario,
          :root_cause,
          :solution,
          :prevention,
          # Teacher-specific fields
          :difficulty,
          :summary,
          :code_example,
          :common_mistakes,
          :testing_strategy,
          :related_rules,
          # Universal fields
          :description,
          :details,
          :examples,
          :recommendations,
          :rule_reference,
          metadata: {}
        )
      end

      def entry_json(entry, detailed: false)
        base = {
          id: entry.id,
          category: entry.category,
          chapter_number: entry.chapter_number,
          chapter_name: entry.chapter_name,
          section_number: entry.section_number,
          section_display: entry.section_display,
          full_title: entry.full_title,
          component: entry.component,
          title: entry.title,
          entry_type: entry.entry_type,
          type_display: entry.type_display,
          type_emoji: entry.type_emoji,
          dense_index: entry.dense_index,
          # Lexicon fields
          status: entry.status,
          status_display: entry.status_display,
          severity: entry.severity,
          severity_display: entry.severity_display,
          first_reported: entry.first_reported,
          last_occurred: entry.last_occurred,
          fixed_date: entry.fixed_date,
          # Teacher fields
          difficulty: entry.difficulty,
          difficulty_display: entry.difficulty_display,
          summary: entry.summary,
          # Meta
          bible_entry: entry.bible_entry?,
          lexicon_entry: entry.lexicon_entry?,
          teacher_entry: entry.teacher_entry?
        }

        if detailed
          base.merge({
            # Lexicon detailed fields
            scenario: entry.scenario,
            root_cause: entry.root_cause,
            solution: entry.solution,
            prevention: entry.prevention,
            # Teacher detailed fields
            code_example: entry.code_example,
            common_mistakes: entry.common_mistakes,
            testing_strategy: entry.testing_strategy,
            related_rules: entry.related_rules,
            # Universal fields
            description: entry.description,
            details: entry.details,
            examples: entry.examples,
            recommendations: entry.recommendations,
            rule_reference: entry.rule_reference,
            metadata: entry.metadata,
            # Audit trail
            created_at: entry.created_at,
            created_by: entry.created_by,
            updated_at: entry.updated_at,
            updated_by: entry.updated_by
          })
        else
          base
        end
      end
    end
  end
end

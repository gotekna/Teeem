# frozen_string_literal: true

module Api
  module V1
    class ImplementationPatternsController < ApplicationController
      skip_before_action :authorize_request, only: [ :index, :show, :stats ]
      before_action :set_pattern, only: [ :show, :update, :destroy ]

      # GET /api/v1/implementation_patterns
      # Query params:
      #   ?chapter=3
      #   ?complexity=simple|medium|complex
      #   ?language=ruby|javascript|sql
      #   ?tag=api|authentication|security
      #   ?search=gantt
      def index
        @patterns = ImplementationPattern.all

        @patterns = @patterns.by_chapter(params[:chapter]) if params[:chapter].present?
        @patterns = @patterns.by_complexity(params[:complexity]) if params[:complexity].present?
        @patterns = @patterns.by_language(params[:language]) if params[:language].present?
        @patterns = @patterns.by_tag(params[:tag]) if params[:tag].present?
        @patterns = @patterns.search(params[:search]) if params[:search].present?

        @patterns = @patterns.ordered.limit(100)

        render json: {
          success: true,
          data: @patterns.map { |pattern| pattern_json(pattern) },
          total: @patterns.count
        }
      end

      # GET /api/v1/implementation_patterns/:id
      def show
        render json: {
          success: true,
          data: pattern_json(@pattern, detailed: true)
        }
      end

      # POST /api/v1/implementation_patterns
      def create
        @pattern = ImplementationPattern.new(pattern_params)

        if @pattern.save
          render json: {
            success: true,
            data: pattern_json(@pattern, detailed: true),
            message: "Implementation pattern created successfully"
          }, status: :created
        else
          render json: {
            success: false,
            errors: @pattern.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/implementation_patterns/:id
      def update
        if @pattern.update(pattern_params)
          render json: {
            success: true,
            data: pattern_json(@pattern, detailed: true),
            message: "Implementation pattern updated successfully"
          }
        else
          render json: {
            success: false,
            errors: @pattern.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/implementation_patterns/:id
      def destroy
        @pattern.destroy
        render json: {
          success: true,
          message: "Implementation pattern deleted successfully"
        }
      end

      # GET /api/v1/implementation_patterns/stats
      # Returns statistics about patterns per chapter
      def stats
        stats = {
          total_patterns: ImplementationPattern.count,
          by_complexity: ImplementationPattern.group(:complexity).count,
          by_chapter: ImplementationPattern.group(:chapter_number, :chapter_name).count.map do |(num, name), count|
            {
              chapter_number: num,
              chapter_name: name,
              pattern_count: count,
              simple_count: ImplementationPattern.by_chapter(num).simple.count,
              medium_count: ImplementationPattern.by_chapter(num).medium.count,
              complex_count: ImplementationPattern.by_chapter(num).complex.count
            }
          end.sort_by { |c| c[:chapter_number] },
          languages: ImplementationPattern.pluck(:languages).flatten.uniq.compact,
          tags: ImplementationPattern.pluck(:tags).flatten.uniq.compact
        }

        render json: {
          success: true,
          data: stats
        }
      end

      # POST /api/v1/implementation_patterns/export_to_markdown
      # Exports Teacher database to markdown file
      def export_to_markdown
        result = system("cd #{Rails.root} && bundle exec rake teeem:export_teacher")

        if result
          render json: {
            success: true,
            message: "Teacher exported to TEEEM_TEACHER.md successfully",
            file_path: Rails.root.join("..", "TEEEM_DOCS", "TEEEM_TEACHER.md").to_s,
            total_entries: ImplementationPattern.count
          }
        else
          render json: {
            success: false,
            error: "Export failed"
          }, status: :internal_server_error
        end
      end

      private

      def set_pattern
        @pattern = ImplementationPattern.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Implementation pattern not found"
        }, status: :not_found
      end

      def pattern_params
        params.require(:implementation_pattern).permit(
          :chapter_number,
          :chapter_name,
          :section_number,
          :pattern_title,
          :bible_rule_reference,
          :quick_start,
          :full_implementation,
          :architecture,
          :common_mistakes,
          :testing,
          :migration_guide,
          :integration,
          :notes,
          :complexity,
          languages: [],
          tags: [],
          code_examples: [ :language, :code, :description ],
          metadata: {}
        )
      end

      def pattern_json(pattern, detailed: false)
        base = {
          id: pattern.id,
          chapter_number: pattern.chapter_number,
          chapter_name: pattern.chapter_name,
          section_number: pattern.section_number,
          section_display: pattern.section_display,
          pattern_title: pattern.pattern_title,
          full_title: pattern.full_title,
          bible_rule_reference: pattern.bible_rule_reference,
          complexity: pattern.complexity,
          complexity_display: pattern.complexity_display,
          languages: pattern.languages,
          tags: pattern.tags
        }

        if detailed
          base.merge({
            quick_start: pattern.quick_start,
            full_implementation: pattern.full_implementation,
            architecture: pattern.architecture,
            common_mistakes: pattern.common_mistakes,
            testing: pattern.testing,
            migration_guide: pattern.migration_guide,
            integration: pattern.integration,
            notes: pattern.notes,
            code_examples: pattern.code_examples,
            metadata: pattern.metadata,
            created_at: pattern.created_at,
            updated_at: pattern.updated_at
          })
        else
          base
        end
      end
    end
  end
end

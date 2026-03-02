# frozen_string_literal: true

module Api
  module V1
    class ClaimStageTemplatesController < ApplicationController
      before_action :set_template, only: [:show, :update, :destroy, :apply, :duplicate]

      # GET /api/v1/claim_stage_templates
      def index
        templates = ClaimStageTemplate.active.ordered.includes(:lines)

        render json: {
          success: true,
          data: templates.map { |t| template_json(t) }
        }
      end

      # GET /api/v1/claim_stage_templates/:id
      def show
        render json: {
          success: true,
          data: template_json(@template)
        }
      end

      # POST /api/v1/claim_stage_templates
      def create
        template = ClaimStageTemplate.new(template_params)
        template.created_by = current_user

        if template.save
          render json: { success: true, data: template_json(template) }, status: :created
        else
          render_validation_errors(template)
        end
      end

      # PATCH /api/v1/claim_stage_templates/:id
      def update
        @template.updated_by = current_user

        if @template.update(template_params)
          render json: { success: true, data: template_json(@template.reload) }
        else
          render_validation_errors(@template)
        end
      end

      # DELETE /api/v1/claim_stage_templates/:id
      def destroy
        @template.update!(is_active: false)
        render json: { success: true }
      end

      # POST /api/v1/claim_stage_templates/:id/apply
      # Accepts optional `stages` param with overridden name/percentage/description per line
      # This allows users to preview and adjust template values before applying
      def apply
        job = Job.find(params[:job_id])
        clear_existing = ActiveModel::Type::Boolean.new.cast(params[:clear_existing])

        if clear_existing
          # Only clear stages that haven't been invoiced
          deletable = job.job_claim_stages.where(match_status: "unmatched", payment_status: "pending")
          deletable.destroy_all
        end

        # If caller provides overridden stages, use those instead of raw template lines
        overrides = params[:stages]
        template_lines = @template.lines.ordered.to_a

        created_stages = []
        ActiveRecord::Base.transaction do
          if overrides.present? && overrides.is_a?(Array)
            # User-adjusted stages (from preview dialog)
            overrides.each_with_index do |override, idx|
              contract_price = job.contract_price.to_d
              pct = override[:percentage].to_d
              stage = job.job_claim_stages.create!(
                name: override[:name],
                percentage: pct,
                expected_amount: (contract_price * pct / 100).round(2),
                sequence_order: idx,
                description: override[:description],
                is_custom: false,
                retainage_percentage: override[:retainage_percentage] || @template.default_retainage_pct || 0,
                match_keywords: override[:match_keywords]
              )
              created_stages << stage
            end
          else
            # Direct apply (no overrides) - use template lines as-is
            template_lines.each do |line|
              contract_price = job.contract_price.to_d
              stage = job.job_claim_stages.create!(
                name: line.name,
                percentage: line.percentage,
                expected_amount: (contract_price * line.percentage / 100).round(2),
                sequence_order: line.sequence_order,
                description: line.description,
                is_custom: false,
                retainage_percentage: line.retainage_percentage || @template.default_retainage_pct || 0,
                match_keywords: line.match_keywords
              )
              created_stages << stage
            end
          end
        end

        render json: {
          success: true,
          data: {
            stages: created_stages.map { |s| stage_json(s) },
            template_name: @template.name,
            stages_created: created_stages.size,
            contract_price: job.contract_price.to_f,
            total_percentage: @template.total_percentage.to_f
          }
        }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/claim_stage_templates/:id/duplicate
      def duplicate
        new_template = nil

        ActiveRecord::Base.transaction do
          new_template = @template.dup
          new_template.name = "#{@template.name} (Copy)"
          new_template.created_by = current_user
          new_template.save!

          @template.lines.ordered.each do |line|
            new_line = line.dup
            new_line.claim_stage_template = new_template
            new_line.save!
          end
        end

        render json: { success: true, data: template_json(new_template.reload) }, status: :created
      end

      private

      def set_template
        @template = ClaimStageTemplate.find(params[:id])
      end

      def template_params
        params.require(:claim_stage_template).permit(
          :name, :description, :is_active, :position, :default_retainage_pct,
          lines_attributes: [
            :id, :name, :percentage, :sequence_order, :description,
            :retainage_percentage, :match_keywords, :overhead_po_name, :_destroy
          ]
        )
      end

      def template_json(template)
        {
          id: template.id,
          name: template.name,
          description: template.description,
          isActive: template.is_active,
          position: template.position,
          defaultRetainagePct: template.default_retainage_pct&.to_f,
          lineCount: template.lines.size,
          totalPercentage: template.total_percentage.to_f,
          percentagesValid: template.percentages_valid?,
          syncStatus: build_sync_status(template),
          createdAt: template.created_at&.iso8601,
          updatedAt: template.updated_at&.iso8601,
          lines: template.lines.ordered.map { |line| line_json(line) }
        }
      end

      # Build sync status for a claim stage template (ConfigSync-based)
      # Checks all other tenants for matching sync_key
      def build_sync_status(template)
        return nil unless template.sync_key.present?

        # Respect per-record sync mode — if "independent", don't show sync badge
        modes = current_tenant&.tenant_setting&.config_sync_table_modes || {}
        return nil if modes["claim_stage_templates:#{template.id}"] == "independent"

        other_tenants = Tenant.where.not(id: current_tenant.id)

        synced_tenants = other_tenants.filter_map do |tenant|
          has_match = ActsAsTenant.with_tenant(tenant) do
            ClaimStageTemplate.exists?(sync_key: template.sync_key)
          end
          tenant.name if has_match
        end

        return nil if synced_tenants.empty?

        { syncedTenants: synced_tenants }
      end

      def line_json(line)
        {
          id: line.id,
          name: line.name,
          percentage: line.percentage.to_f,
          sequenceOrder: line.sequence_order,
          description: line.description,
          retainagePercentage: line.retainage_percentage&.to_f,
          matchKeywords: line.match_keywords,
          overheadPoName: line.overhead_po_name
        }
      end

      def stage_json(stage)
        {
          id: stage.id,
          name: stage.name,
          percentage: stage.percentage&.to_f,
          expected_amount: stage.expected_amount&.to_f,
          sequence_order: stage.sequence_order,
          is_custom: stage.is_custom,
          match_status: stage.match_status,
          payment_status: stage.payment_status,
          retainage_percentage: stage.retainage_percentage&.to_f
        }
      end
    end
  end
end

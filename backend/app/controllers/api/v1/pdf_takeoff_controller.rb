# frozen_string_literal: true

module Api
  module V1
    # PdfTakeoffController - API for browser-based PDF measurement takeoff
    #
    # Ultra PDF Takeoff - Bluebeam competitor built into TEEEM
    # Supports: scale calibration, count, area, linear, perimeter measurements
    #
    # Key differentiator: Pricebook → PO integration (measure → price → PO in one click)
    #
    class PdfTakeoffController < ApplicationController
      before_action :set_job_plan, only: [:show, :calibrate, :measurements, :create_measurement, :generate_po, :detect_scale, :detect_elements]
      before_action :set_docsort_item, only: [:show_docsort, :calibrate_docsort, :measurements_docsort, :create_measurement_docsort, :detect_scale_docsort, :detect_elements_docsort]
      before_action :set_job, only: [:layers, :create_layer, :update_layer, :delete_layer]

      # GET /api/v1/pdf_takeoff/plans/:job_plan_id
      # Get plan details with page scales for takeoff
      def show
        revisions = @job_plan.revisions.order(revision_date: :desc).map do |rev|
          {
            id: rev.id,
            revision: rev.revision,
            revision_date: rev.revision_date,
            is_on_issue: rev.is_on_issue,
            file_name: rev.file_name,
            download_url: rev.download_url
          }
        end

        page_scales = @job_plan.page_scales.map do |ps|
          {
            id: ps.id,
            page_number: ps.page_number,
            scale_factor: ps.scale_factor,
            scale_label: ps.display_scale,
            calibrated: ps.calibrated?,
            calibration_line: ps.line_coordinates,
            reference_length_mm: ps.reference_length_mm
          }
        end

        render json: {
          success: true,
          data: {
            job_plan: {
              id: @job_plan.id,
              display_name: @job_plan.display_name,
              job_id: @job_plan.job_id,
              job_code: @job_plan.job.job_code
            },
            current_revision: @job_plan.current_revision&.slice(:id, :revision, :file_name, :download_url),
            revisions: revisions,
            page_scales: page_scales
          }
        }
      end

      # POST /api/v1/pdf_takeoff/plans/:job_plan_id/calibrate
      # Set scale calibration for a page
      def calibrate
        page_number = params[:page_number]&.to_i || 1

        page_scale = PageScale.find_or_initialize_by(
          job_plan: @job_plan,
          page_number: page_number
        )
        page_scale.tenant = current_tenant

        success = page_scale.set_calibration(
          reference_mm: params[:reference_length_mm].to_f,
          line_start: { x: params[:line_start_x].to_f, y: params[:line_start_y].to_f },
          line_end: { x: params[:line_end_x].to_f, y: params[:line_end_y].to_f },
          canvas_width: params[:canvas_width]&.to_f,
          canvas_height: params[:canvas_height]&.to_f,
          user: current_user
        )

        if success
          render json: {
            success: true,
            data: {
              id: page_scale.id,
              page_number: page_scale.page_number,
              scale_factor: page_scale.scale_factor,
              scale_label: page_scale.display_scale,
              calibrated: true,
              calibration_line: page_scale.line_coordinates,
              reference_length_mm: page_scale.reference_length_mm
            }
          }
        else
          render json: { success: false, errors: page_scale.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/pdf_takeoff/plans/:job_plan_id/calibrate
      def clear_calibration
        page_number = params[:page_number]&.to_i || 1
        page_scale = PageScale.find_by(job_plan: @job_plan, page_number: page_number)
        if page_scale
          page_scale.update!(
            scale_factor: nil,
            reference_length_mm: nil,
            reference_length_px: nil,
            calibration_line: nil,
            calibrated_by: nil,
            calibrated_at: nil
          )
        end
        render json: { success: true }
      end

      # POST /api/v1/pdf_takeoff/plans/:job_plan_id/detect_scale
      # AI-powered scale detection from page image
      def detect_scale
        unless params[:image_base64].present?
          return render json: { success: false, error: "image_base64 is required" }, status: :unprocessable_entity
        end

        service = PdfScaleDetectionService.new
        result = service.detect_scale(
          image_base64: params[:image_base64],
          media_type: params[:media_type] || "image/png"
        )

        # Store AI detection result on the page scale if detected
        if result[:detected] && params[:page_number].present?
          page_scale = PageScale.find_or_initialize_by(
            job_plan: @job_plan,
            page_number: params[:page_number].to_i
          )
          page_scale.tenant = current_tenant
          page_scale.ai_detected_scale = result[:scale_text]
          page_scale.ai_confidence = result[:confidence]
          page_scale.save
        end

        render json: {
          success: true,
          data: result
        }
      end

      # POST /api/v1/pdf_takeoff/plans/:job_plan_id/detect_elements
      # AI-powered detection of walls, doors, windows and other architectural elements
      def detect_elements
        unless params[:image_base64].present?
          return render json: { success: false, error: "image_base64 is required" }, status: :unprocessable_entity
        end

        service = PdfElementDetectionService.new
        result = service.detect_elements(
          image_base64: params[:image_base64],
          media_type: params[:media_type] || "image/png",
          element_types: params[:element_types]
        )

        render json: {
          success: true,
          data: result
        }
      end

      # GET /api/v1/pdf_takeoff/plans/:job_plan_id/measurements
      # Get measurements for a plan (optionally filtered by page)
      def measurements
        scope = UnrealMeasurement.where(job_plan: @job_plan).from_pdf_takeoff

        scope = scope.for_page(params[:page_number].to_i) if params[:page_number].present?
        scope = scope.non_deductions unless params[:include_deductions] == "true"

        measurements = scope.includes(:takeoff_layer, :pricebook_item, :deductions).map do |m|
          measurement_json(m)
        end

        render json: {
          success: true,
          data: {
            measurements: measurements,
            summary: calculate_summary(scope)
          }
        }
      end

      # POST /api/v1/pdf_takeoff/plans/:job_plan_id/measurements
      # Create a new measurement
      def create_measurement
        measurement = UnrealMeasurement.new(measurement_params)
        measurement.job = @job_plan.job
        measurement.job_plan = @job_plan
        measurement.source = "pdf_takeoff"
        measurement.session_id ||= SecureRandom.uuid

        # Get page scale for conversion if needed
        # pixel_value and page_number come nested inside the measurement hash
        m_params = params[:measurement] || {}
        if m_params[:page_number].present? && m_params[:pixel_value].present?
          page_scale = PageScale.find_by(job_plan: @job_plan, page_number: m_params[:page_number])
          if page_scale&.calibrated?
            measurement.value = convert_measurement(
              m_params[:pixel_value].to_f,
              m_params[:measurement_type],
              page_scale
            )
          end
        end

        # Auto-assign to General layer if none specified
        if measurement.takeoff_layer_id.blank?
          measurement.takeoff_layer = TakeoffLayer.general_layer_for(@job_plan.job)
        end

        # Set display label for counts
        if measurement.measurement_type == "count" && measurement.display_label.blank?
          max_label = UnrealMeasurement.where(job_plan: @job_plan, measurement_type: "count")
                                       .from_pdf_takeoff
                                       .maximum(:display_label)&.to_i || 0
          measurement.display_label = (max_label + 1).to_s
        end

        if measurement.save
          render json: {
            success: true,
            data: measurement_json(measurement)
          }, status: :created
        else
          render json: { success: false, errors: measurement.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/pdf_takeoff/measurements/:id
      # Delete a measurement
      def delete_measurement
        measurement = UnrealMeasurement.find(params[:id])

        # Verify user has access (measurement belongs to their job or docsort_item)
        if measurement.job.present?
          unless measurement.job.accessible_by?(current_user)
            return render json: { success: false, error: "Access denied" }, status: :forbidden
          end
        elsif measurement.docsort_item.present?
          unless measurement.docsort_item.tenant_id == current_tenant.id
            return render json: { success: false, error: "Access denied" }, status: :forbidden
          end
        end

        measurement.destroy
        render json: { success: true }
      end

      # PATCH /api/v1/pdf_takeoff/measurements/:id
      # Update a measurement (primarily for pricebook assignment)
      def update_measurement
        measurement = UnrealMeasurement.find(params[:id])

        # Verify user has access
        if measurement.job.present?
          unless measurement.job.accessible_by?(current_user)
            return render json: { success: false, error: "Access denied" }, status: :forbidden
          end
        elsif measurement.docsort_item.present?
          unless measurement.docsort_item.tenant_id == current_tenant.id
            return render json: { success: false, error: "Access denied" }, status: :forbidden
          end
        end

        update_params = {}
        update_params[:pricebook_item_id] = params[:pricebook_item_id] if params.key?(:pricebook_item_id)
        update_params[:category] = params[:category] if params.key?(:category)
        update_params[:notes] = params[:notes] if params.key?(:notes)

        if measurement.update(update_params)
          render json: {
            success: true,
            data: measurement_json(measurement.reload)
          }
        else
          render json: { success: false, errors: measurement.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/pdf_takeoff/plans/:job_plan_id/generate_po
      # Generate Purchase Order(s) from measurements
      def generate_po
        job = @job_plan.job

        measurements = @job_plan.unreal_measurements
                                .from_pdf_takeoff
                                .where.not(pricebook_item_id: nil)
                                .includes(:pricebook_item)

        if measurements.empty?
          return render json: {
            success: false,
            error: "No measurements with pricebook items found"
          }, status: :unprocessable_entity
        end

        group_by = params[:group_by] || "supplier"

        ActiveRecord::Base.transaction do
          created_pos = []

          # Group by supplier or category
          grouped = if group_by == "supplier"
                      measurements.group_by { |m| m.pricebook_item&.preferred_supplier_id }
                    else
                      measurements.group_by { |m| m.category || "General" }
                    end

          grouped.each do |group_key, group_measurements|
            # Skip if no supplier (for supplier grouping)
            if group_by == "supplier" && group_key.nil?
              # Create PO without supplier
              supplier = nil
            else
              supplier = group_by == "supplier" ? Contact.find_by(id: group_key) : nil
            end

            po = PurchaseOrder.create!(
              job: job,
              tenant: current_tenant,
              supplier: supplier,
              status: "draft",
              order_date: Date.current,
              source: "pdf_takeoff",
              notes: "Generated from PDF Takeoff - #{@job_plan.display_name}"
            )

            # Create line items
            group_measurements.each do |measurement|
              po.line_items.create!(
                pricebook_item: measurement.pricebook_item,
                description: measurement.pricebook_item&.name || measurement.category,
                quantity: measurement.net_value,
                unit: measurement.unit,
                unit_price: measurement.pricebook_item&.current_price || 0,
                total_price: measurement.net_line_total || 0,
                notes: "Measurement ID: #{measurement.id}"
              )

              # Mark measurement as converted to PO
              measurement.update!(purchase_order_id: po.id)
            end

            created_pos << {
              id: po.id,
              supplier_name: supplier&.name || "No Supplier",
              line_items_count: group_measurements.count,
              total: group_measurements.sum { |m| m.net_line_total || 0 }
            }
          end

          render json: {
            success: true,
            data: {
              purchase_orders: created_pos,
              total_pos: created_pos.count,
              total_measurements: measurements.count
            }
          }
        end
      rescue StandardError => e
        Rails.logger.error "[PdfTakeoff] Generate PO failed: #{e.message}"
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # =============================================================================
      # DocSort Standalone Takeoff (Feb 2026)
      # =============================================================================

      # GET /api/v1/pdf_takeoff/docsort/:docsort_item_id
      # Get docsort item details with page scales for standalone takeoff
      def show_docsort
        page_scales = @docsort_item.page_scales.map do |ps|
          {
            id: ps.id,
            page_number: ps.page_number,
            scale_factor: ps.scale_factor,
            scale_label: ps.display_scale,
            calibrated: ps.calibrated?,
            calibration_line: ps.line_coordinates,
            reference_length_mm: ps.reference_length_mm
          }
        end

        # Get download URL with graceful error handling for storage provider issues
        download_url = begin
          @docsort_item.download_url
        rescue StandardError => e
          Rails.logger.error "[PdfTakeoff] Failed to get download_url for DocsortItem #{@docsort_item.id}: #{e.message}"
          nil
        end

        # Note: download_url may be nil if storage provider is disconnected
        # Frontend handles this gracefully (shows PDF loading area without content)

        render json: {
          success: true,
          data: {
            docsort_item: {
              id: @docsort_item.id,
              display_name: @docsort_item.display_name,
              document_type: @docsort_item.document_type,
              original_filename: @docsort_item.original_filename
            },
            download_url: download_url,
            page_scales: page_scales
          }
        }
      end

      # POST /api/v1/pdf_takeoff/docsort/:docsort_item_id/calibrate
      # Set scale calibration for a page on a docsort item
      def calibrate_docsort
        page_number = params[:page_number]&.to_i || 1

        page_scale = PageScale.find_or_initialize_by(
          docsort_item: @docsort_item,
          page_number: page_number
        )
        page_scale.tenant = current_tenant

        success = page_scale.set_calibration(
          reference_mm: params[:reference_length_mm].to_f,
          line_start: { x: params[:line_start_x].to_f, y: params[:line_start_y].to_f },
          line_end: { x: params[:line_end_x].to_f, y: params[:line_end_y].to_f },
          canvas_width: params[:canvas_width]&.to_f,
          canvas_height: params[:canvas_height]&.to_f,
          user: current_user
        )

        if success
          render json: {
            success: true,
            data: {
              page_scale: {
                id: page_scale.id,
                page_number: page_scale.page_number,
                scale_factor: page_scale.scale_factor,
                scale_label: page_scale.display_scale,
                calibrated: true,
                calibration_line: page_scale.line_coordinates,
                reference_length_mm: page_scale.reference_length_mm
              }
            }
          }
        else
          render json: { success: false, errors: page_scale.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/pdf_takeoff/docsort/:docsort_item_id/calibrate
      def clear_calibration_docsort
        page_number = params[:page_number]&.to_i || 1
        page_scale = PageScale.find_by(docsort_item: @docsort_item, page_number: page_number)
        if page_scale
          page_scale.update!(
            scale_factor: nil,
            reference_length_mm: nil,
            reference_length_px: nil,
            calibration_line: nil,
            calibrated_by: nil,
            calibrated_at: nil
          )
        end
        render json: { success: true }
      end

      # POST /api/v1/pdf_takeoff/docsort/:docsort_item_id/detect_scale
      # AI-powered scale detection from page image (docsort)
      def detect_scale_docsort
        unless params[:image_base64].present?
          return render json: { success: false, error: "image_base64 is required" }, status: :unprocessable_entity
        end

        service = PdfScaleDetectionService.new
        result = service.detect_scale(
          image_base64: params[:image_base64],
          media_type: params[:media_type] || "image/png"
        )

        # Store AI detection result on the page scale if detected
        if result[:detected] && params[:page_number].present?
          page_scale = PageScale.find_or_initialize_by(
            docsort_item: @docsort_item,
            page_number: params[:page_number].to_i
          )
          page_scale.tenant = current_tenant
          page_scale.ai_detected_scale = result[:scale_text]
          page_scale.ai_confidence = result[:confidence]
          page_scale.save
        end

        render json: {
          success: true,
          data: result
        }
      end

      # POST /api/v1/pdf_takeoff/docsort/:docsort_item_id/detect_elements
      # AI-powered detection of walls, doors, windows and other architectural elements (docsort)
      def detect_elements_docsort
        unless params[:image_base64].present?
          return render json: { success: false, error: "image_base64 is required" }, status: :unprocessable_entity
        end

        service = PdfElementDetectionService.new
        result = service.detect_elements(
          image_base64: params[:image_base64],
          media_type: params[:media_type] || "image/png",
          element_types: params[:element_types]
        )

        render json: {
          success: true,
          data: result
        }
      end

      # GET /api/v1/pdf_takeoff/docsort/:docsort_item_id/measurements
      # Get measurements for a docsort item
      def measurements_docsort
        scope = @docsort_item.unreal_measurements.from_pdf_takeoff

        scope = scope.for_page(params[:page_number].to_i) if params[:page_number].present?
        scope = scope.non_deductions unless params[:include_deductions] == "true"

        measurements = scope.includes(:takeoff_layer, :pricebook_item, :deductions).map do |m|
          measurement_json(m)
        end

        render json: {
          success: true,
          data: {
            measurements: measurements,
            summary: calculate_summary(scope)
          }
        }
      end

      # POST /api/v1/pdf_takeoff/docsort/:docsort_item_id/measurements
      # Create a new measurement on a docsort item
      def create_measurement_docsort
        measurement = UnrealMeasurement.new(measurement_params)
        measurement.docsort_item = @docsort_item
        measurement.source = "pdf_takeoff"
        measurement.session_id ||= SecureRandom.uuid

        # Get page scale for conversion if needed
        # pixel_value and page_number come nested inside the measurement hash
        m_params = params[:measurement] || {}
        if m_params[:page_number].present? && m_params[:pixel_value].present?
          page_scale = PageScale.find_by(docsort_item: @docsort_item, page_number: m_params[:page_number])
          if page_scale&.calibrated?
            measurement.value = convert_measurement(
              m_params[:pixel_value].to_f,
              m_params[:measurement_type],
              page_scale
            )
          end
        end

        # Set display label for counts
        if measurement.measurement_type == "count" && measurement.display_label.blank?
          max_label = @docsort_item.unreal_measurements
                                   .where(measurement_type: "count")
                                   .from_pdf_takeoff
                                   .maximum(:display_label)&.to_i || 0
          measurement.display_label = (max_label + 1).to_s
        end

        if measurement.save
          render json: {
            success: true,
            data: {
              measurement: measurement_json(measurement),
              summary: calculate_summary(@docsort_item.unreal_measurements.from_pdf_takeoff)
            }
          }, status: :created
        else
          render json: { success: false, errors: measurement.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # =============================================================================
      # Layer Management
      # =============================================================================

      # GET /api/v1/pdf_takeoff/jobs/:job_id/layers
      def layers
        layers = @job.takeoff_layers.ordered.map do |layer|
          {
            id: layer.id,
            name: layer.name,
            color: layer.color,
            display_order: layer.display_order,
            visible: layer.visible,
            locked: layer.locked,
            measurement_count: layer.measurement_count
          }
        end

        # Create default layers if none exist
        if layers.empty?
          TakeoffLayer.create_defaults_for(@job)
          return layers # Re-fetch
        end

        render json: { success: true, data: { layers: layers } }
      end

      # POST /api/v1/pdf_takeoff/jobs/:job_id/layers
      def create_layer
        layer = @job.takeoff_layers.build(layer_params)
        layer.tenant = current_tenant

        if layer.save
          render json: {
            success: true,
            data: {
              id: layer.id,
              name: layer.name,
              color: layer.color,
              display_order: layer.display_order,
              visible: layer.visible,
              locked: layer.locked,
              measurement_count: 0
            }
          }, status: :created
        else
          render json: { success: false, errors: layer.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/pdf_takeoff/layers/:id
      def update_layer
        layer = TakeoffLayer.find(params[:id])

        if layer.update(layer_params)
          render json: { success: true, data: layer.as_json }
        else
          render json: { success: false, errors: layer.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/pdf_takeoff/layers/:id
      def delete_layer
        layer = TakeoffLayer.find(params[:id])

        # Move measurements to General layer before deleting
        if layer.measurements.any?
          general = TakeoffLayer.general_layer_for(layer.job)
          layer.measurements.update_all(takeoff_layer_id: general.id)
        end

        layer.destroy
        render json: { success: true }
      end

      private

      def set_job_plan
        @job_plan = JobPlan.find(params[:job_plan_id] || params[:id])
      end

      def set_docsort_item
        @docsort_item = DocsortItem.find(params[:docsort_item_id])
        # Verify tenant access
        unless @docsort_item.tenant_id == current_tenant.id
          render json: { success: false, error: "Access denied" }, status: :forbidden
        end
      end

      def set_job
        @job = Job.find(params[:job_id])
      end

      def measurement_params
        params.require(:measurement).permit(
          :measurement_type, :value, :unit, :category, :subcategory, :notes,
          :page_number, :takeoff_layer_id, :is_deduction, :parent_measurement_id,
          :display_label, :color, :pricebook_item_id, :session_id,
          geometry_data: {}
        )
      end

      def layer_params
        params.require(:layer).permit(:name, :color, :display_order, :visible, :locked)
      end

      def measurement_json(m)
        {
          id: m.id,
          measurement_type: m.measurement_type,
          value: m.value,
          net_value: m.net_value,
          formatted_value: m.formatted_value,
          formatted_net_value: m.formatted_net_value,
          unit: m.unit,
          category: m.category,
          page_number: m.page_number,
          display_label: m.label,
          color: m.effective_color,
          is_deduction: m.deduction?,
          parent_measurement_id: m.parent_measurement_id,
          geometry_data: m.geometry_data,
          layer: m.takeoff_layer&.slice(:id, :name, :color),
          pricebook_item: m.pricebook_item&.slice(:id, :name, :code, :current_price),
          line_total: m.line_total,
          net_line_total: m.net_line_total,
          created_at: m.created_at
        }
      end

      def calculate_summary(measurements)
        {
          total_count: measurements.count,
          by_type: {
            area: measurements.by_type("area").sum(:value).round(2),
            length: measurements.by_type("length").sum(:value).round(2),
            perimeter: measurements.by_type("perimeter").sum(:value).round(2),
            count: measurements.by_type("count").sum(:value).to_i
          },
          total_cost: measurements.with_pricebook_item.sum { |m| m.net_line_total || 0 }.round(2)
        }
      end

      def convert_measurement(pixel_value, measurement_type, page_scale)
        case measurement_type
        when "area"
          page_scale.pixel_area_to_m2(pixel_value)
        when "length", "perimeter"
          page_scale.pixel_length_to_m(pixel_value)
        when "count"
          pixel_value # Count doesn't need conversion
        else
          pixel_value
        end
      end
    end
  end
end

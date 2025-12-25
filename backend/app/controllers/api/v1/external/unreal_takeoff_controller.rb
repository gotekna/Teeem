module Api
  module V1
    module External
      class UnrealTakeoffController < ApplicationController
        skip_before_action :authorize_request
        before_action :authenticate_api_key!

        # GET /api/v1/external/unreal_takeoff/jobs/:id
        # Get job details with plan summary for Unreal 3D Takeoff
        def show_job
          job = Job.find_by(id: params[:id])

          unless job
            return render json: {
              success: false,
              error: "Job not found with ID: #{params[:id]}"
            }, status: :not_found
          end

          render json: {
            success: true,
            job: {
              id: job.id,
              name: job.name,
              title: job.title,
              job_number: job.job_number,
              contract_price: job.contract_price,
              site_address: job.site_address,
              suburb: job.suburb,
              state: job.state,
              postcode: job.postcode,
              status: job.status,
              plans_count: job.job_plans.count,
              colour_selections_count: job.job_colour_selections.count
            }
          }
        end

        # GET /api/v1/external/unreal_takeoff/plans/:job_id
        # Get all plans for a job with revision details
        def plans
          job = Job.find_by(id: params[:job_id])

          unless job
            return render json: {
              success: false,
              error: "Job not found with ID: #{params[:job_id]}"
            }, status: :not_found
          end

          plans = job.job_plans.includes(:current_revision, :plan_type).map do |plan|
            revision = plan.current_revision
            {
              id: plan.id,
              name: plan.display_name,
              plan_type: plan.plan_type&.name,
              plan_type_code: plan.plan_type&.code,
              revision: revision&.revision,
              revision_date: revision&.revision_date,
              is_on_issue: revision&.is_on_issue,
              sharepoint_file_id: revision&.sharepoint_file_id,
              sharepoint_web_url: revision&.sharepoint_web_url,
              file_name: revision&.file_name,
              file_size: revision&.file_size,
              thumbnail_base64: revision&.micro_thumbnail_base64,
              download_url: revision&.sharepoint_file_id ? "/api/v1/external/unreal_takeoff/plans/#{plan.id}/download" : nil,
              image_url: revision&.sharepoint_file_id ? "/api/v1/external/unreal_takeoff/plans/#{plan.id}/image" : nil
            }
          end

          render json: {
            success: true,
            job_id: job.id,
            job_name: job.title,
            plans_count: plans.count,
            plans: plans
          }
        end

        # GET /api/v1/external/unreal_takeoff/plans/:id/download
        # Download plan file (PDF)
        def download_plan
          plan = JobPlan.find_by(id: params[:id])

          unless plan
            return render json: {
              success: false,
              error: "Plan not found with ID: #{params[:id]}"
            }, status: :not_found
          end

          revision = plan.current_revision
          unless revision&.sharepoint_file_id
            return render json: {
              success: false,
              error: "Plan has no file attached"
            }, status: :not_found
          end

          # Redirect to the SharePoint download endpoint
          redirect_to api_v1_organization_onedrive_download_path(file_id: revision.sharepoint_file_id)
        end

        # GET /api/v1/external/unreal_takeoff/plans/:id/image
        # Get plan as PNG image (converted from PDF for UE5 texture)
        def plan_image
          plan = JobPlan.find_by(id: params[:id])

          unless plan
            return render json: {
              success: false,
              error: "Plan not found with ID: #{params[:id]}"
            }, status: :not_found
          end

          revision = plan.current_revision
          unless revision&.sharepoint_file_id
            return render json: {
              success: false,
              error: "Plan has no file attached"
            }, status: :not_found
          end

          # TODO: Implement PDF to PNG conversion service
          # For now, return the PDF download URL
          # Future: PlanImageConverterService.convert(revision)

          render json: {
            success: true,
            plan_id: plan.id,
            message: "PDF to PNG conversion not yet implemented. Use download_url for PDF.",
            download_url: "/api/v1/external/unreal_takeoff/plans/#{plan.id}/download",
            dpi: params[:dpi] || 150
          }
        end

        # GET /api/v1/external/unreal_takeoff/colours/:job_id
        # Get colour selections and available pricebook colours
        def colours
          job = Job.find_by(id: params[:job_id])

          unless job
            return render json: {
              success: false,
              error: "Job not found with ID: #{params[:job_id]}"
            }, status: :not_found
          end

          # Get job's colour selections grouped by category
          selections = job.job_colour_selections.includes(:pricebook_item).group_by(&:category_key)

          selections_data = selections.transform_values do |items|
            items.map do |sel|
              {
                id: sel.id,
                item_key: sel.item_key,
                colour_name: sel.colour_name,
                colour_code: sel.colour_code,
                colour_brand: sel.colour_brand,
                hex_value: colour_code_to_hex(sel.colour_code),
                pricebook_item_id: sel.pricebook_item_id,
                pricebook_code: sel.pricebook_item&.item_code,
                unit_price: sel.pricebook_item&.current_price&.to_f,
                notes: sel.notes
              }
            end
          end

          # Get available pricebook colours for the picker
          pricebook_colours = PricebookItem.where.not(colour: [nil, ""])
            .select(:id, :item_code, :item_name, :colour, :colour_code, :colour_brand, :current_price, :category)
            .limit(500)
            .map do |item|
              {
                id: item.id,
                item_code: item.item_code,
                item_name: item.item_name,
                colour: item.colour,
                colour_code: item.colour_code,
                colour_brand: item.colour_brand,
                hex_value: colour_code_to_hex(item.colour_code),
                current_price: item.current_price&.to_f,
                category: item.category
              }
            end

          render json: {
            success: true,
            job_id: job.id,
            colour_selections: selections_data,
            pricebook_colours: pricebook_colours,
            pricebook_colours_count: pricebook_colours.count
          }
        end

        # POST /api/v1/external/unreal_takeoff/measurements
        # Submit measurements from Unreal 3D Takeoff
        #
        # Payload:
        #   {
        #     "job_id": 46,
        #     "session_id": "uuid",
        #     "measurements": [
        #       {
        #         "plan_id": 123,
        #         "measurement_type": "area",
        #         "value": 125.5,
        #         "unit": "m2",
        #         "category": "Flooring",
        #         "subcategory": "Tiles",
        #         "pricebook_item_code": "TILGREY100",
        #         "colour_selection_id": 789,
        #         "notes": "Living room floor",
        #         "geometry_data": { "points": [...] }
        #       }
        #     ]
        #   }
        def create_measurements
          job_id = params[:job_id]
          session_id = params[:session_id] || SecureRandom.uuid
          measurements_params = params[:measurements] || []

          if job_id.blank?
            return render json: { success: false, error: "job_id is required" }, status: :unprocessable_entity
          end

          job = Job.find_by(id: job_id)
          unless job
            return render json: { success: false, error: "Job not found with ID: #{job_id}" }, status: :not_found
          end

          if measurements_params.empty?
            return render json: { success: false, error: "No measurements provided" }, status: :unprocessable_entity
          end

          ActiveRecord::Base.transaction do
            created_measurements = []

            measurements_params.each do |m|
              # Look up pricebook item by code if provided
              pricebook_item = nil
              if m[:pricebook_item_code].present?
                pricebook_item = PricebookItem.find_by(item_code: m[:pricebook_item_code])
              elsif m[:pricebook_item_id].present?
                pricebook_item = PricebookItem.find_by(id: m[:pricebook_item_id])
              end

              measurement = UnrealMeasurement.create!(
                job_id: job.id,
                job_plan_id: m[:plan_id],
                pricebook_item_id: pricebook_item&.id,
                job_colour_selection_id: m[:colour_selection_id],
                session_id: session_id,
                measurement_type: m[:measurement_type],
                value: m[:value],
                unit: m[:unit] || default_unit_for_type(m[:measurement_type]),
                category: m[:category],
                subcategory: m[:subcategory],
                notes: m[:notes],
                geometry_data: m[:geometry_data] || {}
              )

              created_measurements << {
                id: measurement.id,
                measurement_type: measurement.measurement_type,
                value: measurement.value,
                unit: measurement.unit,
                category: measurement.category,
                pricebook_item_id: measurement.pricebook_item_id,
                unit_price: pricebook_item&.current_price&.to_f,
                line_total: pricebook_item ? (measurement.value * pricebook_item.current_price.to_f) : nil
              }
            end

            Rails.logger.info "[Unreal Takeoff] Created #{created_measurements.count} measurements for job #{job.id}, session #{session_id}"

            render json: {
              success: true,
              job_id: job.id,
              session_id: session_id,
              measurements_created: created_measurements.count,
              measurements: created_measurements,
              message: "Successfully created #{created_measurements.count} measurements"
            }, status: :created
          end

        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            error: e.message,
            details: e.record&.errors&.full_messages
          }, status: :unprocessable_entity

        rescue => e
          Rails.logger.error "[Unreal Takeoff] Error creating measurements: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")

          render json: {
            success: false,
            error: "An error occurred while creating measurements",
            details: e.message
          }, status: :internal_server_error
        end

        # GET /api/v1/external/unreal_takeoff/measurements/:job_id
        # Get all measurements for a job (optionally filtered by session)
        def measurements
          job = Job.find_by(id: params[:job_id])

          unless job
            return render json: {
              success: false,
              error: "Job not found with ID: #{params[:job_id]}"
            }, status: :not_found
          end

          scope = job.unreal_measurements.includes(:pricebook_item, :job_plan, :job_colour_selection)
          scope = scope.where(session_id: params[:session_id]) if params[:session_id].present?

          measurements = scope.map do |m|
            {
              id: m.id,
              session_id: m.session_id,
              plan_id: m.job_plan_id,
              plan_name: m.job_plan&.display_name,
              measurement_type: m.measurement_type,
              value: m.value,
              unit: m.unit,
              category: m.category,
              subcategory: m.subcategory,
              pricebook_item_id: m.pricebook_item_id,
              pricebook_item_code: m.pricebook_item&.item_code,
              pricebook_item_name: m.pricebook_item&.item_name,
              unit_price: m.pricebook_item&.current_price&.to_f,
              line_total: m.pricebook_item ? (m.value * m.pricebook_item.current_price.to_f) : nil,
              colour_selection_id: m.job_colour_selection_id,
              colour_name: m.job_colour_selection&.colour_name,
              notes: m.notes,
              geometry_data: m.geometry_data,
              created_at: m.created_at
            }
          end

          # Calculate totals by category
          totals_by_category = measurements.group_by { |m| m[:category] }.transform_values do |items|
            {
              count: items.count,
              total_value: items.sum { |i| i[:line_total] || 0 }
            }
          end

          render json: {
            success: true,
            job_id: job.id,
            session_id: params[:session_id],
            measurements_count: measurements.count,
            grand_total: measurements.sum { |m| m[:line_total] || 0 },
            totals_by_category: totals_by_category,
            measurements: measurements
          }
        end

        # POST /api/v1/external/unreal_takeoff/sync_to_po
        # Create Purchase Order(s) from measurements
        #
        # Payload:
        #   {
        #     "job_id": 46,
        #     "session_id": "uuid",
        #     "group_by": "supplier"  # or "category"
        #   }
        def sync_to_po
          job_id = params[:job_id]
          session_id = params[:session_id]
          group_by = params[:group_by] || "supplier"

          if job_id.blank?
            return render json: { success: false, error: "job_id is required" }, status: :unprocessable_entity
          end

          job = Job.find_by(id: job_id)
          unless job
            return render json: { success: false, error: "Job not found with ID: #{job_id}" }, status: :not_found
          end

          scope = job.unreal_measurements.includes(:pricebook_item)
          scope = scope.where(session_id: session_id) if session_id.present?

          measurements = scope.where.not(pricebook_item_id: nil)

          if measurements.empty?
            return render json: {
              success: false,
              error: "No measurements with pricebook items found"
            }, status: :unprocessable_entity
          end

          ActiveRecord::Base.transaction do
            created_pos = []

            # Group by supplier or category
            grouped = if group_by == "supplier"
              measurements.group_by { |m| m.pricebook_item&.default_supplier_id }
            else
              measurements.group_by(&:category)
            end

            grouped.each do |group_key, group_measurements|
              # Create PO
              po = PurchaseOrder.create!(
                job_id: job.id,
                description: "3D Takeoff - #{group_by == 'supplier' ? 'Supplier' : group_key}",
                status: "draft",
                source: "unreal_takeoff",
                supplier_id: group_by == "supplier" ? group_key : nil
              )

              # Add line items
              group_measurements.each do |m|
                po.line_items.create!(
                  pricebook_item_id: m.pricebook_item_id,
                  description: m.pricebook_item.item_name,
                  quantity: m.value,
                  unit_price: m.pricebook_item.current_price || 0,
                  gst_code: m.pricebook_item.gst_code || "GST",
                  colour: m.job_colour_selection&.colour_name,
                  colour_code: m.job_colour_selection&.colour_code,
                  notes: m.notes
                )

                # Mark measurement as synced
                m.update!(synced_to_po_id: po.id, synced_at: Time.current)
              end

              po.reload
              created_pos << {
                id: po.id,
                purchase_order_number: po.purchase_order_number,
                supplier_id: po.supplier_id,
                supplier_name: po.supplier&.display_name,
                line_items_count: po.line_items.count,
                sub_total: po.sub_total,
                tax: po.tax,
                total: po.total
              }
            end

            Rails.logger.info "[Unreal Takeoff] Created #{created_pos.count} POs from measurements for job #{job.id}"

            render json: {
              success: true,
              job_id: job.id,
              session_id: session_id,
              purchase_orders_created: created_pos.count,
              purchase_orders: created_pos,
              message: "Successfully created #{created_pos.count} purchase orders"
            }, status: :created
          end

        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            error: e.message,
            details: e.record&.errors&.full_messages
          }, status: :unprocessable_entity

        rescue => e
          Rails.logger.error "[Unreal Takeoff] Error syncing to PO: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")

          render json: {
            success: false,
            error: "An error occurred while creating purchase orders",
            details: e.message
          }, status: :internal_server_error
        end

        # DELETE /api/v1/external/unreal_takeoff/sessions/:session_id
        # Delete all measurements for a session
        def delete_session
          session_id = params[:session_id]

          if session_id.blank?
            return render json: { success: false, error: "session_id is required" }, status: :unprocessable_entity
          end

          deleted_count = UnrealMeasurement.where(session_id: session_id).destroy_all.count

          render json: {
            success: true,
            session_id: session_id,
            measurements_deleted: deleted_count,
            message: "Deleted #{deleted_count} measurements"
          }
        end

        private

        def authenticate_api_key!
          api_key = request.headers["X-API-Key"]

          if api_key.blank?
            render json: {
              success: false,
              error: "API key required. Please include X-API-Key header."
            }, status: :unauthorized
            return
          end

          integration = ExternalIntegration.find_by_api_key(api_key)

          if integration.nil?
            render json: {
              success: false,
              error: "Invalid API key"
            }, status: :unauthorized
            return
          end

          # Record usage
          integration.record_usage!

          @current_integration = integration
        end

        def colour_code_to_hex(colour_code)
          return nil if colour_code.blank?

          # Common RAL to hex mappings (expand as needed)
          ral_to_hex = {
            "RAL 7022" => "#383C3A",  # Monument
            "RAL 9016" => "#F1F0EA",  # Surfmist
            "RAL 7016" => "#293133",  # Basalt
            "RAL 6008" => "#353D2F",  # Woodland Grey
            "RAL 9003" => "#F4F8F4",  # Classic Cream
          }

          ral_to_hex[colour_code] || colour_code
        end

        def default_unit_for_type(measurement_type)
          case measurement_type&.downcase
          when "area" then "m2"
          when "length" then "m"
          when "count" then "ea"
          else "ea"
          end
        end
      end
    end
  end
end

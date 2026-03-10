module Api
  module V1
    module Portal
      class PropertyDocumentsController < BaseController
        before_action :require_property_portal

        # GET /api/v1/portal/property/documents
        # Returns documents grouped by category for the portal user's properties
        def index
          properties = current_portal_user.accessible_properties
          property_ids = properties.pluck(:id)

          # Gather document types for portal display
          doc_types = DocumentType.where(scope: "property").active
            .includes(warehouse_folder_document_types: :warehouse_folder)
            .order(:name)

          # Group by folder (category)
          categories = {}
          doc_types.each do |dt|
            folder = dt.folder || "General"
            categories[folder] ||= { name: folder, document_types: [] }
            categories[folder][:document_types] << {
              id: dt.id,
              name: dt.name,
              abbreviation: dt.abbreviation,
              description: dt.description,
            }
          end

          # Gather actual documents from WarehouseDocuments linked to these properties
          documents = WarehouseDocument
            .where(linkable_type: "Property", linkable_id: property_ids)
            .includes(:storage_blob, :warehouse_folder)
            .order(created_at: :desc)
            .limit(100)

          # Also gather inspection report PDFs
          inspections_with_reports = PropertyInspection
            .where(property_id: property_ids)
            .where.not(report_blob_id: nil)
            .includes(:property, :report_blob)
            .order(completed_date: :desc)

          # Build document list
          doc_list = []

          documents.each do |doc|
            doc_list << {
              id: "wd-#{doc.id}",
              name: doc.ui_name || doc.original_filename || "Document",
              category: doc.warehouse_folder&.display_name || "General",
              document_type: doc.document_type_name,
              uploaded_at: doc.created_at,
              file_size: doc.storage_blob&.byte_size,
              content_type: doc.storage_blob&.content_type,
              download_url: doc.storage_blob&.download_url,
              property: property_name_for(doc.linkable_id, properties),
            }
          end

          inspections_with_reports.each do |inspection|
            doc_list << {
              id: "ir-#{inspection.id}",
              name: "#{inspection.inspection_type&.titleize} Inspection Report - #{inspection.completed_date&.strftime('%d/%m/%Y')}",
              category: "Inspections",
              document_type: inspection_doc_type_name(inspection),
              uploaded_at: inspection.completed_date || inspection.updated_at,
              file_size: inspection.report_blob&.byte_size,
              content_type: "application/pdf",
              download_url: inspection.report_blob&.download_url,
              property: {
                id: inspection.property_id,
                name: inspection.property&.name,
                address: inspection.property&.full_address,
              },
            }
          end

          # Sort by date desc
          doc_list.sort_by! { |d| d[:uploaded_at] || Time.at(0) }.reverse!

          render json: {
            success: true,
            data: {
              categories: categories.values,
              documents: doc_list,
              total_count: doc_list.size,
            },
          }
        end

        # GET /api/v1/portal/property/documents/:id/download
        def download
          doc_id = params[:id].to_s

          if doc_id.start_with?("ir-")
            # Inspection report
            inspection_id = doc_id.sub("ir-", "").to_i
            inspection = current_portal_user.accessible_inspections.find(inspection_id)
            blob = inspection&.report_blob
          elsif doc_id.start_with?("wd-")
            # Warehouse document
            wd_id = doc_id.sub("wd-", "").to_i
            property_ids = current_portal_user.accessible_properties.pluck(:id)
            doc = WarehouseDocument.find_by(id: wd_id, linkable_type: "Property", linkable_id: property_ids)
            blob = doc&.storage_blob
          end

          unless blob&.download_url
            render json: { success: false, error: "Document not found" }, status: :not_found
            return
          end

          render json: { success: true, data: { download_url: blob.download_url } }
        end

        private

        def require_property_portal
          unless current_portal_user&.property_portal?
            render json: { success: false, error: "Property portal access required" }, status: :forbidden
          end
        end

        def property_name_for(property_id, properties)
          prop = properties.find { |p| p.id == property_id }
          return nil unless prop
          { id: prop.id, name: prop.name, address: prop.full_address }
        end

        def inspection_doc_type_name(inspection)
          case inspection.inspection_type
          when "entry" then "Entry Report"
          when "routine" then "Routine Inspection"
          when "exit" then "Exit Report"
          when "sda" then "SDA Inspection"
          else "Inspection Report"
          end
        end

      end
    end
  end
end

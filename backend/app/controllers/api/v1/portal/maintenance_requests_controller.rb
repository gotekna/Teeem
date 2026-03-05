module Api
  module V1
    module Portal
      class MaintenanceRequestsController < BaseController
        before_action :require_property_portal

        # GET /api/v1/portal/property/maintenance
        def index
          property_ids = current_portal_user.accessible_properties.pluck(:id)
          bills = PropertyBill.where(property_id: property_ids, bill_type: "maintenance")
                    .includes(:property, :supplier_contact)
                    .order(created_at: :desc)

          render json: {
            success: true,
            data: bills.map { |b| maintenance_summary(b) },
          }
        end

        # POST /api/v1/portal/property/maintenance
        # Tenant submits a maintenance request
        def create
          property = current_portal_user.accessible_properties.find(params[:property_id])

          bill = PropertyBill.new(
            tenant_id: property.tenant_id,
            property_id: property.id,
            tenancy_id: property.active_tenancy&.id,
            bill_type: "maintenance",
            description: params[:description],
            amount: 0, # TBD by property manager
            bill_date: Date.current,
            charge_to: "owner", # Maintenance typically charged to owner
            status: "draft",
          )

          if bill.save
            # Attach photos if provided
            if params[:photos].present?
              params[:photos].each do |photo|
                blob = StorageBlob.find_or_create_for_content!(
                  content: photo.read,
                  filename: photo.original_filename,
                  content_type: photo.content_type
                )
                WarehouseDocumentCreator.create!(
                  filename: photo.original_filename,
                  source_type: "warehouse",
                  storage_blob: blob,
                  linkable: property,
                  metadata: { maintenance_request_id: bill.id, uploaded_by_portal: true }
                )
              end
            end

            render json: {
              success: true,
              message: "Maintenance request submitted",
              data: maintenance_summary(bill),
            }, status: :created
          else
            render json: { success: false, error: bill.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Property not found" }, status: :not_found
        end

        private

        def require_property_portal
          unless current_portal_user&.property_portal?
            render json: { success: false, error: "Property portal access required" }, status: :forbidden
          end
        end

        def maintenance_summary(bill)
          {
            id: bill.id,
            description: bill.description,
            amount: bill.amount,
            status: bill.status,
            bill_date: bill.bill_date,
            due_date: bill.due_date,
            charge_to: bill.charge_to,
            property: {
              id: bill.property_id,
              name: bill.property&.name,
              address: bill.property&.full_address,
            },
            supplier: bill.supplier_contact&.display_name,
            created_at: bill.created_at,
          }
        end
      end
    end
  end
end

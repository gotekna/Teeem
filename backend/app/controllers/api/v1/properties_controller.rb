module Api
  module V1
    class PropertiesController < ApplicationController
      before_action :set_property, only: [:show, :update, :destroy, :tenancies, :bills, :inspections, :contacts, :financials]

      # GET /api/v1/properties
      def index
        properties = Property.with_lookups.order(created_at: :desc)
        properties = apply_filters(properties)

        render_success(properties.as_json(include: {
          property_type: { only: [:id, :name] },
          property_status: { only: [:id, :name, :color] },
          owner_contact: { only: [:id, :display_name] }
        }))
      end

      # GET /api/v1/properties/:id
      def show
        render_success(@property.as_json(include: {
          property_type: { only: [:id, :name] },
          property_status: { only: [:id, :name, :color] },
          owner_contact: { only: [:id, :display_name, :email, :phone] },
          managing_agent_contact: { only: [:id, :display_name, :email, :phone] }
        }))
      end

      # POST /api/v1/properties
      def create
        property = Property.new(property_params)

        if property.save
          render_success(property, status: :created)
        else
          render_validation_errors(property)
        end
      end

      # PATCH /api/v1/properties/:id
      def update
        if @property.update(property_params)
          render_success(@property)
        else
          render_validation_errors(@property)
        end
      end

      # DELETE /api/v1/properties/:id
      def destroy
        @property.destroy
        render_success
      end

      # GET /api/v1/properties/:id/tenancies
      def tenancies
        tenancies = @property.tenancies.order(start_date: :desc)
        render_success(tenancies.as_json(include: {
          sda_participant_contact: { only: [:id, :display_name] }
        }))
      end

      # GET /api/v1/properties/:id/bills
      def bills
        bills = @property.property_bills
                         .includes(:tenancy, :supplier_contact)
                         .order(bill_date: :desc)
        render_success(bills.as_json(include: {
          supplier_contact: { only: [:id, :display_name] }
        }))
      end

      # GET /api/v1/properties/:id/inspections
      def inspections
        inspections = @property.property_inspections
                               .includes(:tenancy, :inspector_contact)
                               .order(scheduled_date: :desc)
        render_success(inspections.as_json(include: {
          inspector_contact: { only: [:id, :display_name] }
        }))
      end

      # GET /api/v1/properties/:id/contacts
      def contacts
        contacts = @property.property_contacts
                            .includes(:contact)
                            .active
                            .order(:role)
        render_success(contacts.as_json(include: {
          contact: { only: [:id, :display_name, :email, :phone] }
        }))
      end

      # GET /api/v1/properties/:id/financials
      def financials
        active_tenancy = @property.active_tenancy
        bills_summary = @property.property_bills.group(:charge_to).sum(:amount)

        render_success({
          weeklyRent: @property.weekly_rent_amount,
          bondAmount: @property.bond_amount,
          activeTenancy: active_tenancy&.as_json,
          sdaEnrolled: @property.sda_enrolled,
          sdaCategory: @property.sda_category,
          billsSummary: bills_summary,
          totalBills: @property.property_bills.sum(:amount),
          unpaidBills: @property.property_bills.unpaid.sum(:amount)
        })
      end

      # POST /api/v1/properties/from_job
      # Creates a property from an existing Job, copying address + client contact
      def from_job
        job = Job.find(params[:job_id])

        # Build street_address from job address components
        street_address = [job.street_number, job.street_name, job.street_type]
                          .map(&:presence).compact.join(" ")
        street_address = job.name if street_address.blank?

        # Find default property type and status
        default_type = PropertyType.find_by(name: "House")
        default_status = PropertyStatus.find_by(name: "Vacant")

        property = Property.new(
          name: job.name,
          street_address: street_address,
          suburb: job.suburb,
          state: job.state,
          postcode: job.postcode,
          property_type_id: default_type&.id,
          property_status_id: default_status&.id,
          job_id: job.id,
          description: job.description
        )

        # Copy client contact as owner
        client_jc = job.job_contacts.find_by(role: "client")
        property.owner_contact_id = client_jc&.contact_id

        if property.save
          # Copy job contacts as property contacts
          job.job_contacts.each do |jc|
            next unless jc.contact_id.present?
            role = case jc.role
                   when "client" then "owner"
                   else next # skip non-relevant job roles
                   end
            PropertyContact.create(
              property: property,
              contact_id: jc.contact_id,
              role: role,
              is_primary: jc.primary
            )
          end

          render_success(property.as_json(include: {
            property_type: { only: [:id, :name] },
            property_status: { only: [:id, :name, :color] },
            owner_contact: { only: [:id, :display_name] }
          }), status: :created)
        else
          render_validation_errors(property)
        end
      end

      # GET /api/v1/properties/for_select
      def for_select
        properties = Property.select(:id, :name, :street_address, :property_code)
                             .order(:name)
        render_success(properties.map { |p|
          { id: p.id, label: p.name.presence || p.street_address, code: p.property_code }
        })
      end

      # GET /api/v1/properties/stats
      def stats
        render_success({
          total: Property.count,
          sdaEnrolled: Property.sda.count,
          byStatus: Property.joins(:property_status).group("property_statuses.name").count,
          byType: Property.joins(:property_type).group("property_types.name").count,
          activeTenancies: Tenancy.active.count,
          upcomingInspections: PropertyInspection.upcoming.count
        })
      end

      private

      def set_property
        @property = Property.find(params[:id])
      end

      def property_params
        params.require(:property).permit(
          :name, :street_address, :suburb, :state, :postcode, :country,
          :property_type_id, :property_status_id,
          :bedrooms, :bathrooms, :parking_spaces,
          :land_area_sqm, :floor_area_sqm, :year_built, :description,
          :sda_category, :sda_enrolled, :sda_enrolment_date, :sda_dwelling_id,
          :weekly_rent_amount, :bond_amount,
          :owner_contact_id, :managing_agent_contact_id,
          :job_id
        )
      end

      def apply_filters(scope)
        scope = scope.where(property_status_id: params[:status_id]) if params[:status_id].present?
        scope = scope.where(property_type_id: params[:type_id]) if params[:type_id].present?
        scope = scope.where(sda_enrolled: true) if params[:sda_only] == "true"
        scope = scope.where(suburb: params[:suburb]) if params[:suburb].present?
        scope
      end
    end
  end
end

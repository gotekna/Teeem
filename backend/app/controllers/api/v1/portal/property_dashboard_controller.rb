module Api
  module V1
    module Portal
      class PropertyDashboardController < BaseController
        before_action :require_property_portal

        # GET /api/v1/portal/property/dashboard
        def show
          properties = current_portal_user.accessible_properties
                        .includes(:property_type, :property_status, :owner_contact,
                                  :managing_agent_contact, tenancies: [])

          # Build dashboard data based on portal type
          if current_portal_user.owner?
            render json: { success: true, data: owner_dashboard(properties) }
          else
            render json: { success: true, data: tenant_dashboard(properties) }
          end
        end

        # GET /api/v1/portal/property/payments
        def payments
          properties = current_portal_user.accessible_properties
          property = properties.first
          return render json: { success: true, data: { payments: [] } } unless property

          tenancy = property.active_tenancy
          result = { rent_payments: [], sda_payments: [], next_payment: nil }

          if tenancy
            # Get rent payment history from recurring invoice
            if tenancy.rent_recurring_invoice_id
              rent_invoices = Gl::Invoice
                .where(recurring_invoice_id: tenancy.rent_recurring_invoice_id)
                .order(invoice_date: :desc)
                .limit(50)
              result[:rent_payments] = rent_invoices.map { |inv| payment_summary(inv, "rent") }

              # Next payment due
              recurring = tenancy.rent_recurring_invoice
              if recurring&.next_generation_date
                result[:next_payment] = {
                  type: "rent",
                  amount: tenancy.weekly_rent,
                  frequency: tenancy.rent_frequency,
                  next_due: recurring.next_generation_date,
                }
              end
            end

            # Get SDA payment history from recurring invoice
            if tenancy.sda_recurring_invoice_id
              sda_invoices = Gl::Invoice
                .where(recurring_invoice_id: tenancy.sda_recurring_invoice_id)
                .order(invoice_date: :desc)
                .limit(50)
              result[:sda_payments] = sda_invoices.map { |inv| payment_summary(inv, "sda") }
            end

            result[:is_sda] = tenancy.sda?
            result[:sda_breakdown] = tenancy.sda? ? {
              sda_weekly_rate: tenancy.sda_weekly_rate,
              participant_contribution: tenancy.participant_rent_contribution,
              ndia_payment: tenancy.ndia_payment_amount,
            } : nil
          end

          render json: { success: true, data: result }
        end

        private

        def require_property_portal
          unless current_portal_user&.property_portal?
            render json: { success: false, error: "Property portal access required" }, status: :forbidden
          end
        end

        def tenant_dashboard(properties)
          property = properties.first
          return { properties: [], message: "No properties linked to your account" } unless property

          tenancy = property.active_tenancy
          upcoming_inspections = PropertyInspection
            .where(property_id: property.id, status: %w[scheduled in_progress])
            .order(:scheduled_date).limit(5)
          recent_bills = PropertyBill
            .where(property_id: property.id, charge_to: "tenant")
            .order(bill_date: :desc).limit(10)

          # Company branding from tenant settings
          settings = TenantSetting.instance

          {
            company: {
              name: settings.company_name,
              logo_url: settings.effective_logo_url,
              logo_dark: settings.logo_dark,
              phone: settings.phone,
              email: settings.email,
              website: settings.website,
            },
            property: property_summary(property),
            lease: tenancy ? lease_summary(tenancy) : nil,
            rent: tenancy ? rent_summary(tenancy, property) : nil,
            bond: tenancy ? bond_summary(tenancy) : nil,
            next_payment: tenancy ? next_payment_info(tenancy) : nil,
            recent_payments: tenancy ? recent_payment_history(tenancy, 5) : [],
            inspections: upcoming_inspections.map { |i| inspection_summary(i) },
            maintenance: recent_bills.where(bill_type: "maintenance").map { |b| bill_summary(b) },
            bills: recent_bills.map { |b| bill_summary(b) },
          }
        end

        def owner_dashboard(properties)
          property_data = properties.map do |property|
            tenancy = property.active_tenancy
            {
              property: property_summary(property),
              lease: tenancy ? lease_summary(tenancy) : nil,
              rent: tenancy ? rent_summary(tenancy, property) : nil,
              bond: tenancy ? bond_summary(tenancy) : nil,
              financials: owner_financials(property),
              valuations: property.valuation_summary,
              next_inspection: PropertyInspection
                .where(property_id: property.id, status: "scheduled")
                .order(:scheduled_date).first
                &.then { |i| inspection_summary(i) },
            }
          end

          # Portfolio summary
          total_value = properties.sum(&:effective_value)
          total_annual_rent = properties.sum(&:annual_gross_rent)
          total_annual_expenses = properties.sum(&:annual_expenses)

          {
            portfolio: {
              property_count: properties.size,
              total_value: total_value,
              total_annual_rent: total_annual_rent,
              total_annual_expenses: total_annual_expenses,
              total_net_income: total_annual_rent - total_annual_expenses,
              portfolio_yield: total_value.positive? ? (((total_annual_rent - total_annual_expenses) / total_value) * 100).round(2) : nil,
              total_unrealised_gain: properties.sum { |p| p.unrealised_capital_gain || 0 },
            },
            properties: property_data,
          }
        end

        def property_summary(property)
          {
            id: property.id,
            property_code: property.property_code,
            name: property.name,
            street_address: property.street_address,
            full_address: property.full_address,
            suburb: property.suburb,
            property_type: property.property_type&.name,
            status: property.property_status&.name,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            parking_spaces: property.parking_spaces,
            land_area_sqm: property.land_area_sqm,
            floor_area_sqm: property.floor_area_sqm,
            year_built: property.year_built,
            weekly_rent: property.weekly_rent_amount,
            owner: property.owner_contact ? {
              name: property.owner_contact.display_name,
              email: property.owner_contact.email,
              phone: property.owner_contact.phone,
            } : nil,
            manager: property.managing_agent_contact ? {
              name: property.managing_agent_contact.display_name,
              email: property.managing_agent_contact.email,
              phone: property.managing_agent_contact.phone,
            } : nil,
          }
        end

        def lease_summary(tenancy)
          {
            id: tenancy.id,
            type: tenancy.tenancy_type,
            status: tenancy.status,
            start_date: tenancy.start_date,
            end_date: tenancy.end_date,
            lease_term_months: tenancy.lease_term_months,
            days_remaining: tenancy.days_remaining,
            expired: tenancy.expired?,
            is_sda: tenancy.sda?,
          }
        end

        def rent_summary(tenancy, property)
          annual_rent = property.annual_gross_rent
          {
            weekly_rent: tenancy.weekly_rent,
            rent_frequency: tenancy.rent_frequency,
            annual_rent: annual_rent,
            # SDA breakdown
            sda: tenancy.sda? ? {
              sda_weekly_rate: tenancy.sda_weekly_rate,
              participant_contribution: tenancy.participant_rent_contribution,
              ndia_payment: tenancy.ndia_payment_amount,
            } : nil,
          }
        end

        def bond_summary(tenancy)
          {
            amount: tenancy.bond_amount,
            lodged: tenancy.bond_lodged,
            reference: tenancy.bond_reference,
          }
        end

        def owner_financials(property)
          # Expenses by type for the last 12 months
          bills = property.property_bills.where("bill_date >= ?", 1.year.ago)

          expense_by_type = bills.where(charge_to: "owner").group(:bill_type).sum(:amount)
          tenant_charges = bills.where(charge_to: "tenant").sum(:amount)
          govt_charges = bills.where(charge_to: "government_ndis").sum(:amount)

          {
            annual_gross_rent: property.annual_gross_rent,
            annual_expenses: property.annual_expenses,
            annual_net_income: property.annual_net_income,
            management_fee_pct: property.management_fee_pct,
            expense_breakdown: expense_by_type,
            tenant_charges: tenant_charges,
            government_charges: govt_charges,
            recent_bills: bills.order(bill_date: :desc).limit(20).map { |b| bill_summary(b) },
          }
        end

        def inspection_summary(inspection)
          {
            id: inspection.id,
            inspection_type: inspection.inspection_type,
            status: inspection.status,
            scheduled_date: inspection.scheduled_date,
            completed_date: inspection.completed_date,
            overall_condition: inspection.overall_condition,
            inspector: inspection.inspector_contact&.display_name,
            has_report: inspection.respond_to?(:has_report?) ? inspection.has_report? : false,
            access_token: inspection.access_token,
          }
        end

        def bill_summary(bill)
          {
            id: bill.id,
            bill_type: bill.bill_type,
            description: bill.description,
            amount: bill.amount,
            tax_amount: bill.tax_amount,
            total: bill.total_with_tax,
            bill_date: bill.bill_date,
            due_date: bill.due_date,
            charge_to: bill.charge_to,
            status: bill.status,
            supplier: bill.supplier_contact&.display_name,
          }
        end

        def payment_summary(invoice, payment_type)
          {
            id: invoice.id,
            payment_type: payment_type,
            invoice_number: invoice.invoice_number,
            amount: invoice.total,
            amount_paid: invoice.amount_paid,
            amount_due: invoice.amount_due,
            status: invoice.status,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            description: invoice.description,
          }
        end

        def next_payment_info(tenancy)
          recurring = tenancy.rent_recurring_invoice
          return nil unless recurring&.next_generation_date

          {
            type: "rent",
            amount: tenancy.weekly_rent,
            frequency: tenancy.rent_frequency,
            next_due: recurring.next_generation_date,
          }
        end

        def recent_payment_history(tenancy, limit)
          invoice_ids = [tenancy.rent_recurring_invoice_id, tenancy.sda_recurring_invoice_id].compact
          return [] if invoice_ids.empty?

          invoices = Gl::Invoice
            .where(recurring_invoice_id: invoice_ids)
            .order(invoice_date: :desc)
            .limit(limit)

          invoices.map do |inv|
            ptype = inv.recurring_invoice_id == tenancy.sda_recurring_invoice_id ? "sda" : "rent"
            payment_summary(inv, ptype)
          end
        end
      end
    end
  end
end

module Api
  module V1
    class PricebookItemsController < ApplicationController
      before_action :set_pricebook_item, only: [:show, :update, :destroy, :history, :fetch_image, :update_image, :add_price, :set_default_supplier, :delete_price_history, :update_price_history, :proxy_image]

      # GET /api/v1/pricebook
      def index
        @items = PricebookItem.includes(:supplier, :default_supplier, :price_histories).active

        # Filter by specific IDs if provided (for viewing selected items)
        if params[:ids].present?
          ids = params[:ids].split(',').map(&:to_i)
          @items = @items.where(id: ids)
        else
          # Apply search
          @items = @items.search(params[:search]) if params[:search].present?

          # Apply filters
          @items = @items.by_category(params[:category]) if params[:category].present?
          @items = @items.by_supplier(params[:supplier_id]) if params[:supplier_id].present?
          @items = @items.price_range(params[:min_price], params[:max_price])
          @items = @items.needs_pricing if params[:needs_pricing] == "true"

          # Boolean field filters
          @items = @items.where(requires_photo: params[:requires_photo] == "true") if params[:requires_photo].present?
          @items = @items.where(requires_spec: params[:requires_spec] == "true") if params[:requires_spec].present?
          @items = @items.where(photo_attached: params[:photo_attached] == "true") if params[:photo_attached].present?
          @items = @items.where(spec_attached: params[:spec_attached] == "true") if params[:spec_attached].present?
          @items = @items.where(needs_pricing_review: params[:needs_pricing_review] == "true") if params[:needs_pricing_review].present?

          # Risk level filter - use scope instead of loading all records
          @items = @items.by_risk_level(params[:risk_level]) if params[:risk_level].present?
        end

        # Sorting - Fixed SQL injection vulnerability
        if params[:sort_by].present? && !@items.is_a?(Array)
          sort_column = params[:sort_by]
          # Validate sort_direction to prevent SQL injection
          sort_direction = params[:sort_direction]&.downcase == 'desc' ? 'desc' : 'asc'

          # Map frontend column names to database columns (whitelist)
          column_mapping = {
            'item_code' => 'item_code',
            'item_name' => 'item_name',
            'category' => 'category',
            'current_price' => 'current_price',
            'supplier' => 'contacts.full_name'
          }

          db_column = column_mapping[sort_column] || 'item_code'

          # Join contacts table if sorting by supplier
          if sort_column == 'supplier'
            @items = @items.left_joins(:supplier)
            # Use Arel to safely construct the query
            @items = @items.order(Arel.sql("#{Contact.connection.quote_column_name('contacts')}.#{Contact.connection.quote_column_name('full_name')} #{sort_direction}"))
          else
            # Use Arel to safely construct the query with sanitized column name
            @items = @items.order(Arel.sql("#{PricebookItem.connection.quote_column_name(db_column)} #{sort_direction}"))
          end
        end

        # Pagination - Added DoS protection by capping limit at 20000
        # Exception: When filtering by supplier_id, allow unlimited results (for Schedule Master auto-PO)
        page = [params[:page]&.to_i || 1, 1].max # Ensure page is at least 1
        limit = (params[:limit] || params[:per_page])&.to_i || 100

        # Allow unlimited results when filtering by supplier_id
        if params[:supplier_id].present? && limit == 0
          limit = nil # No limit
        else
          limit = [[limit, 1].max, 20000].min # Cap between 1 and 20000 (for ~14500 pricebook items)
        end

        offset = (page - 1) * (limit || 0)

        total_count = @items.is_a?(Array) ? @items.count : @items.count

        # Apply pagination
        if @items.is_a?(Array)
          paginated_items = limit ? (@items[offset, limit] || []) : @items
        else
          if limit
            @items = @items.limit(limit).offset(offset)
          end
          paginated_items = @items
        end

        # Filter suppliers by category if category filter is active
        # Include suppliers from both default_supplier_id AND price_histories
        suppliers_list = if params[:category].present?
          # Get suppliers (contacts) who have items in the selected category
          # Check both as default supplier AND in price history
          default_supplier_ids = Contact.joins("INNER JOIN pricebook_items ON pricebook_items.default_supplier_id = contacts.id")
                                        .where(pricebook_items: { category: params[:category], is_active: true })
                                        .where("'supplier' = ANY(contacts.contact_types)")
                                        .distinct
                                        .pluck(:id)

          price_history_supplier_ids = Contact.joins("INNER JOIN price_histories ON price_histories.supplier_id = contacts.id")
                                              .joins("INNER JOIN pricebook_items ON pricebook_items.id = price_histories.pricebook_item_id")
                                              .where(pricebook_items: { category: params[:category], is_active: true })
                                              .where("'supplier' = ANY(contacts.contact_types)")
                                              .distinct
                                              .pluck(:id)

          # Combine both and get distinct
          combined_ids = (default_supplier_ids + price_history_supplier_ids).uniq
          Contact.where(id: combined_ids).order(:full_name).pluck(:id, :full_name)
        else
          # Get ALL suppliers (contacts) that appear in either default_supplier_id or price_histories
          default_supplier_ids = Contact.joins("INNER JOIN pricebook_items ON pricebook_items.default_supplier_id = contacts.id")
                                        .where(pricebook_items: { is_active: true })
                                        .where("'supplier' = ANY(contacts.contact_types)")
                                        .distinct
                                        .pluck(:id)

          price_history_supplier_ids = Contact.joins(:price_histories)
                                              .where("'supplier' = ANY(contacts.contact_types)")
                                              .distinct
                                              .pluck(:id)

          # Combine both and get distinct
          combined_ids = (default_supplier_ids + price_history_supplier_ids).uniq
          Contact.where(id: combined_ids).order(:full_name).pluck(:id, :full_name)
        end

        render json: {
          items: paginated_items.map { |item| item_with_risk_data(item) },
          pagination: {
            page: page,
            limit: limit,
            total_count: total_count,
            total_pages: limit ? (total_count.to_f / limit).ceil : 1
          },
          filters: {
            categories: PricebookItem.categories,
            suppliers: suppliers_list
          }
        }
      end

      # GET /api/v1/pricebook/:id
      def show
        item_json = @item.as_json(
          include: {
            supplier: { only: [:id, :full_name, :email, :mobile_phone, :office_phone, :rating] },
            default_supplier: { only: [:id, :full_name] },
            price_histories: {
              only: [:id, :old_price, :new_price, :change_reason, :created_at, :date_effective],
              include: { supplier: { only: [:id, :full_name] } }
            }
          }
        )

        # Map full_name to name for backwards compatibility
        if item_json['supplier']
          item_json['supplier']['name'] = item_json['supplier']['full_name']
        end
        if item_json['default_supplier']
          item_json['default_supplier']['name'] = item_json['default_supplier']['full_name']
        end
        item_json['price_histories']&.each do |ph|
          if ph['supplier']
            ph['supplier']['name'] = ph['supplier']['full_name']
          end
        end

        render json: item_with_risk_data(@item).merge(item_json)
      end

      # POST /api/v1/pricebook
      def create
        @item = PricebookItem.new(pricebook_item_params)

        if @item.save
          render json: @item, status: :created
        else
          render json: { errors: @item.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/pricebook/:id
      def update
        if @item.update(pricebook_item_params)
          render json: @item
        else
          render json: { errors: @item.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/pricebook/:id
      def destroy
        @item.update(is_active: false)
        head :no_content
      end

      # GET /api/v1/pricebook/:id/history
      def history
        histories = @item.price_histories.recent.includes(:supplier)
        render json: histories.as_json(include: { supplier: { only: [:id, :full_name], methods: [] } }).map { |h|
          h['supplier']['name'] = h['supplier']['full_name'] if h['supplier']
          h
        }
      end

      # PATCH /api/v1/pricebook/bulk_update
      def bulk_update
        updates = params[:updates] || []
        results = { success: [], errors: [], prices_updated: 0 }

        updates.each do |update|
          item = PricebookItem.find_by(id: update[:id])
          if item
            # Permit the attributes we want to update (excluding :id which is used for lookup)
            permitted_attrs = update.to_unsafe_h.slice(:current_price, :supplier_id, :default_supplier_id, :notes, :category, :requires_photo, :requires_spec, :photo_attached, :spec_attached, :needs_pricing_review)

            # If update_price_to_current_default is true, create/update price history for the new default supplier
            if update[:update_price_to_current_default] == true && update[:default_supplier_id].present? && item.current_price.present?
              new_supplier_id = update[:default_supplier_id]

              # Find the most recent price history for this supplier
              existing_price = PriceHistory.where(
                pricebook_item_id: item.id,
                supplier_id: new_supplier_id
              ).order(created_at: :desc).first

              # Only create a new price history if the supplier doesn't have a price, or their price is different
              if existing_price.nil? || existing_price.new_price != item.current_price
                PriceHistory.create!(
                  pricebook_item_id: item.id,
                  supplier_id: new_supplier_id,
                  old_price: existing_price&.new_price || item.current_price,
                  new_price: item.current_price,
                  date_effective: CompanySetting.today,
                  change_reason: "Updated to match current default price when setting as default supplier"
                )
                results[:prices_updated] += 1
              end
            end

            # Handle create_or_update_price flag - allows creating/updating price history with custom price
            if update[:create_or_update_price] == true && update[:default_supplier_id].present? && update[:new_price].present?
              new_supplier_id = update[:default_supplier_id]
              new_price = update[:new_price].to_f

              # Find the most recent price history for this supplier
              existing_price = PriceHistory.where(
                pricebook_item_id: item.id,
                supplier_id: new_supplier_id
              ).order(created_at: :desc).first

              # Create/update price history if needed
              if existing_price.nil?
                # No existing price - create new price history
                PriceHistory.create!(
                  pricebook_item_id: item.id,
                  supplier_id: new_supplier_id,
                  old_price: new_price, # For new entries, old and new are the same
                  new_price: new_price,
                  date_effective: CompanySetting.today,
                  change_reason: "Initial price set when assigning as default supplier"
                )
                results[:prices_updated] += 1
              elsif existing_price.new_price != new_price
                # Existing price differs - create new price history entry
                PriceHistory.create!(
                  pricebook_item_id: item.id,
                  supplier_id: new_supplier_id,
                  old_price: existing_price.new_price,
                  new_price: new_price,
                  date_effective: CompanySetting.today,
                  change_reason: "Price updated when setting as default supplier"
                )
                results[:prices_updated] += 1
              end
            end

            if item.update(permitted_attrs)
              results[:success] << item.id
            else
              results[:errors] << { id: update[:id], errors: item.errors.full_messages }
            end
          else
            results[:errors] << { id: update[:id], errors: ["Item not found"] }
          end
        end

        render json: results
      end

      # POST /api/v1/pricebook/import
      def import
        unless params[:file]
          return render json: { error: "No file provided" }, status: :unprocessable_entity
        end

        file = params[:file]
        temp_file = Tempfile.new(['pricebook_import', '.csv'])

        begin
          # Save uploaded file
          temp_file.write(file.read)
          temp_file.rewind

          # Import options
          options = {
            skip_missing_prices: params[:skip_missing_prices] == 'true',
            create_suppliers: params[:create_suppliers] != 'false',
            create_categories: params[:create_categories] != 'false',
            update_existing: params[:update_existing] == 'true'
          }

          # Run import service
          import_service = PricebookImportService.new(temp_file.path, options)
          result = import_service.import

          render json: result
        ensure
          temp_file.close
          temp_file.unlink
        end
      end

      # POST /api/v1/pricebook/preview
      def preview
        unless params[:file]
          return render json: { error: "No file provided" }, status: :unprocessable_entity
        end

        file = params[:file]
        temp_file = Tempfile.new(['pricebook_preview', '.csv'])

        begin
          temp_file.write(file.read)
          temp_file.rewind

          import_service = PricebookImportService.new(temp_file.path)
          result = import_service.preview(params[:limit]&.to_i || 10)

          render json: result
        ensure
          temp_file.close
          temp_file.unlink
        end
      end

      # POST /api/v1/pricebook/:id/fetch_image
      def fetch_image
        # Queue background job to fetch image
        FetchProductImageJob.perform_later(@item.id)

        render json: {
          success: true,
          message: "Image fetch queued for #{@item.item_name}",
          item: item_with_image_data(@item)
        }
      end

      # POST /api/v1/pricebook/:id/update_image
      def update_image
        if params[:image_url].present?
          @item.update(
            image_url: params[:image_url],
            image_source: 'manual',
            image_fetched_at: Time.current,
            image_fetch_status: 'success',
            photo_attached: true
          )

          render json: {
            success: true,
            message: "Image updated",
            item: item_with_image_data(@item)
          }
        else
          render json: { success: false, error: "image_url is required" }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/pricebook/fetch_all_images
      def fetch_all_images
        limit = params[:limit]&.to_i || 100
        supplier_id = params[:supplier_id]

        if supplier_id.present?
          # Fetch images for specific supplier
          FetchSupplierImagesJob.perform_later(supplier_id, limit)
          message = "Image fetch queued for supplier items (limit: #{limit})"
        else
          # Fetch images for all items
          FetchAllImagesJob.perform_later(limit)
          message = "Image fetch queued for all items (limit: #{limit})"
        end

        render json: {
          success: true,
          message: message,
          stats: calculate_image_stats
        }
      end

      # GET /api/v1/pricebook/image_stats
      def image_stats
        render json: calculate_image_stats
      end

      # POST /api/v1/pricebook/:id/add_price
      def add_price
        old_price = @item.current_price

        # Skip automatic price history callback since we're creating it manually
        @item.skip_price_history_callback = true
        @item.current_price = params[:price]
        @item.supplier_id = params[:supplier_id] if params[:supplier_id].present?

        # If item doesn't have a default supplier yet, set this one as default
        if @item.default_supplier_id.nil? && params[:supplier_id].present?
          @item.default_supplier_id = params[:supplier_id]
        end

        if @item.save
          # Create price history entry with LGA and date effective
          price_history = @item.price_histories.create!(
            old_price: old_price,
            new_price: params[:price],
            supplier_id: params[:supplier_id],
            lga: params[:lga],
            date_effective: params[:date_effective] || CompanySetting.today,
            change_reason: 'manual_price_update'
          )

          render json: {
            success: true,
            message: 'Price added successfully',
            item: item_with_risk_data(@item),
            price_history: {
              id: price_history.id,
              old_price: price_history.old_price,
              new_price: price_history.new_price,
              lga: price_history.lga,
              date_effective: price_history.date_effective,
              supplier: price_history.supplier ? { id: price_history.supplier.id, name: price_history.supplier.full_name } : nil,
              created_at: price_history.created_at
            }
          }
        else
          render json: { success: false, errors: @item.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/pricebook/:id/set_default_supplier
      def set_default_supplier
        supplier_id = params[:supplier_id]

        if supplier_id.blank?
          return render json: { success: false, error: 'supplier_id is required' }, status: :unprocessable_entity
        end

        @item.default_supplier_id = supplier_id

        # Find the most recent price for this supplier
        supplier_price_history = @item.price_histories
          .where(supplier_id: supplier_id)
          .order(created_at: :desc)
          .first

        # Update current_price if we found a price for this supplier
        if supplier_price_history && supplier_price_history.new_price
          @item.current_price = supplier_price_history.new_price
        end

        if @item.save
          # Reload the association to get the updated default_supplier object
          @item.reload

          render json: {
            success: true,
            message: 'Default supplier updated successfully',
            item: item_with_risk_data(@item)
          }
        else
          render json: { success: false, errors: @item.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/pricebook/:id/price_histories/:history_id
      def delete_price_history
        history_id = params[:history_id]

        if history_id.blank?
          return render json: { success: false, error: 'history_id is required' }, status: :unprocessable_entity
        end

        price_history = @item.price_histories.find_by(id: history_id)

        if price_history.nil?
          return render json: { success: false, error: 'Price history not found' }, status: :not_found
        end

        if price_history.destroy
          render json: { success: true, message: 'Price history deleted successfully' }
        else
          render json: { success: false, errors: price_history.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/pricebook/:id/price_histories/:history_id
      def update_price_history
        history_id = params[:history_id]

        if history_id.blank?
          return render json: { success: false, error: 'history_id is required' }, status: :unprocessable_entity
        end

        price_history = @item.price_histories.find_by(id: history_id)

        if price_history.nil?
          return render json: { success: false, error: 'Price history not found' }, status: :not_found
        end

        # Update the price history attributes
        update_params = {}
        update_params[:old_price] = params[:old_price] if params[:old_price].present?
        update_params[:new_price] = params[:new_price] if params[:new_price].present?
        update_params[:date_effective] = params[:date_effective] if params[:date_effective].present?
        update_params[:change_reason] = params[:change_reason] if params[:change_reason].present?
        update_params[:lga] = params[:lga] if params[:lga].present?

        if price_history.update(update_params)
          render json: { success: true, message: 'Price history updated successfully', price_history: price_history }
        else
          render json: { success: false, errors: price_history.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/pricebook/export_price_history
      def export_price_history
        supplier_id = params[:supplier_id]
        category = params[:category]
        item_ids = params[:item_ids]&.split(',')&.map(&:to_i)

        export_service = PriceHistoryExportService.new(
          supplier_id: supplier_id,
          category: category,
          item_ids: item_ids
        )

        result = export_service.export

        if result[:success]
          send_data result[:data],
            filename: result[:filename],
            type: result[:content_type],
            disposition: 'attachment'
        else
          render json: {
            success: false,
            errors: result[:errors]
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/pricebook/import_price_history
      def import_price_history
        unless params[:file]
          return render json: { success: false, error: "No file provided" }, status: :unprocessable_entity
        end

        file = params[:file]
        temp_file = Tempfile.new(['price_history_import', File.extname(file.original_filename)], binmode: true)

        begin
          # Save uploaded file in binary mode to avoid encoding issues
          temp_file.binmode
          temp_file.write(file.read)
          temp_file.rewind

          # Run import service with optional effective_date
          effective_date = params[:effective_date].present? ? Date.parse(params[:effective_date]) : nil
          import_service = PriceHistoryImportService.new(temp_file.path, effective_date: effective_date)
          result = import_service.import

          render json: result
        ensure
          temp_file.close
          temp_file.unlink
        end
      end

      # GET /api/v1/pricebook/price_health_check
      def price_health_check
        issues = []
        today = CompanySetting.today

        # Find all items with default suppliers
        items_with_defaults = PricebookItem.includes(:default_supplier, :price_histories)
          .where.not(default_supplier_id: nil)

        items_with_defaults.each do |item|
          # Find the active price for the default supplier
          active_price = item.price_histories
            .where(supplier_id: item.default_supplier_id)
            .where('date_effective <= ? OR date_effective IS NULL', today)
            .order(date_effective: :desc, created_at: :desc)
            .first

          if active_price && active_price.new_price != item.current_price
            issues << {
              item_id: item.id,
              item_code: item.item_code,
              item_name: item.item_name,
              default_supplier_id: item.default_supplier_id,
              default_supplier_name: item.default_supplier&.full_name,
              item_current_price: item.current_price,
              active_price_id: active_price.id,
              active_price_value: active_price.new_price,
              active_price_date: active_price.date_effective || active_price.created_at,
              difference: (active_price.new_price - item.current_price).round(2)
            }
          elsif !active_price && item.current_price.present?
            issues << {
              item_id: item.id,
              item_code: item.item_code,
              item_name: item.item_name,
              default_supplier_id: item.default_supplier_id,
              default_supplier_name: item.default_supplier&.full_name,
              item_current_price: item.current_price,
              active_price_id: nil,
              active_price_value: nil,
              active_price_date: nil,
              difference: nil,
              error: 'No active price found for default supplier'
            }
          end
        end

        render json: {
          total_items_checked: items_with_defaults.count,
          issues_found: issues.count,
          issues: issues
        }
      end

      # GET /api/v1/pricebook/:id/proxy_image/:file_type
      # Proxies OneDrive images through our backend to avoid CORS and expiration issues
      def proxy_image
        file_type = params[:file_type] # 'image', 'spec', or 'qr_code'

        # Get the file ID based on the file type
        file_id = case file_type
        when 'image'
          @item.image_file_id
        when 'spec'
          @item.spec_file_id
        when 'qr_code'
          @item.qr_code_file_id
        else
          return render json: { error: 'Invalid file type' }, status: :bad_request
        end

        if file_id.blank?
          return render json: { error: 'File not found' }, status: :not_found
        end

        begin
          # Get OneDrive credentials
          credential = OrganizationOneDriveCredential.first
          unless credential && credential.valid_credential?
            return render json: { error: 'OneDrive not connected' }, status: :service_unavailable
          end

          # Initialize Microsoft Graph client
          client = MicrosoftGraphClient.new(credential)

          # Get file content from OneDrive
          response = client.get_file_content(file_id)

          # Detect content type from file extension or default to image/jpeg
          content_type = case File.extname(@item.send("#{file_type}_url") || '').downcase
          when '.jpg', '.jpeg'
            'image/jpeg'
          when '.png'
            'image/png'
          when '.pdf'
            'application/pdf'
          else
            'application/octet-stream'
          end

          # Set caching headers (cache for 1 hour)
          expires_in 1.hour, public: true

          # Stream the file content
          send_data response, type: content_type, disposition: 'inline'
        rescue => e
          Rails.logger.error "Error proxying image: #{e.message}"
          render json: { error: 'Failed to fetch image' }, status: :internal_server_error
        end
      end

      private

      def calculate_image_stats
        total = PricebookItem.count
        with_images = PricebookItem.where.not(image_url: nil).count
        pending = PricebookItem.where(image_url: nil, image_fetch_status: nil).count
        fetching = PricebookItem.where(image_fetch_status: 'fetching').count
        failed = PricebookItem.where(image_fetch_status: 'failed').count

        {
          total: total,
          with_images: with_images,
          without_images: total - with_images,
          pending: pending,
          fetching: fetching,
          failed: failed,
          percentage_complete: total > 0 ? ((with_images.to_f / total) * 100).round(2) : 0
        }
      end

      def set_pricebook_item
        @item = PricebookItem.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Price book item not found" }, status: :not_found
      end

      def pricebook_item_params
        params.require(:pricebook_item).permit(
          :item_code,
          :item_name,
          :category,
          :unit_of_measure,
          :current_price,
          :supplier_id,
          :brand,
          :notes,
          :is_active,
          :needs_pricing_review
        )
      end

      def item_with_risk_data(item)
        item_json = item.as_json(include: {
          supplier: { only: [:id, :full_name] },
          default_supplier: { only: [:id, :full_name] }
        })

        # Map full_name to name for backwards compatibility
        if item_json['supplier']
          item_json['supplier']['name'] = item_json['supplier']['full_name']
        end
        if item_json['default_supplier']
          item_json['default_supplier']['name'] = item_json['default_supplier']['full_name']
        end

        item_json.merge(
          price_last_updated_at: item.price_last_updated_at,
          price_age_days: item.price_age_in_days,
          price_freshness: {
            status: item.price_freshness_status,
            label: item.price_freshness_label,
            color: item.price_freshness_color
          },
          risk: {
            score: item.risk_score,
            level: item.risk_level,
            label: item.risk_level_label,
            color: item.risk_level_color
          },
          supplier_reliability: item.supplier_reliability_score,
          price_volatility: item.price_volatility,
          image_url: item.image_url,
          qr_code_url: item.qr_code_url,
          image_fetch_status: item.image_fetch_status
        )
      end

      def item_with_image_data(item)
        item_json = item.as_json(include: { supplier: { only: [:id, :full_name] } })

        # Map full_name to name for backwards compatibility
        if item_json['supplier']
          item_json['supplier']['name'] = item_json['supplier']['full_name']
        end

        item_json.merge(
          image_url: item.image_url,
          qr_code_url: item.qr_code_url,
          image_source: item.image_source,
          image_fetched_at: item.image_fetched_at,
          image_fetch_status: item.image_fetch_status
        )
      end
    end
  end
end

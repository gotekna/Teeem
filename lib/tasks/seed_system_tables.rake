namespace :trapid do
  namespace :tables do
    desc "Seed system tables (in-memory tables) with proper IDs in the tables table"
    task seed_system: :environment do
      # System tables that were previously "in-memory" tables
      # These are Rails models that use TrapidTableView but weren't registered in the tables table
      # IMPORTANT: IDs are FIXED to match production (199-221) for consistency across environments
      system_tables = [
        {
          id: 199,  # Fixed ID - matches production
          name: 'Financial Transactions',
          slug: 'financial-transactions',
          icon: '💰',
          file_location: 'pages/FinancialPage.jsx',
          model_class: 'FinancialTransaction',
          description: 'Financial transactions ledger with double-entry accounting',
          has_saved_views: true,
          api_endpoint: '/api/v1/financial_transactions',
          database_table_name: 'financial_transactions'
        },
        # Note: Gold Standard Reference uses ID 1 (pre-existing user table converted to system)
        # It's NOT in this seed list because it already exists with the correct ID
        # The table was manually converted to system type
        # Production slug: 'gold-standard-reference'
        {
          id: 201,  # Fixed ID - matches production
          name: 'Trinity Bible',
          slug: 'trinity-bible',
          icon: '📖',
          file_location: 'pages/TrinityPage.jsx',
          model_class: 'TrinityEntry',
          description: 'Rules and standards documentation (category: bible)',
          has_saved_views: true,
          api_endpoint: '/api/v1/trinity?category=bible',
          database_table_name: 'trinity_entries'
        },
        {
          id: 202,  # Fixed ID - matches production
          name: 'Trinity Teacher',
          slug: 'trinity-teacher',
          icon: '🎓',
          file_location: 'pages/TrinityPage.jsx',
          model_class: 'TrinityEntry',
          description: 'How-to guides and implementation patterns (category: teacher)',
          has_saved_views: true,
          api_endpoint: '/api/v1/trinity?category=teacher',
          database_table_name: 'trinity_entries'
        },
        {
          id: 203,  # Fixed ID - matches production
          name: 'Trinity Lexicon',
          slug: 'trinity-lexicon',
          icon: '📚',
          file_location: 'pages/TrinityPage.jsx',
          model_class: 'TrinityEntry',
          description: 'Bug history and architecture decisions (category: lexicon)',
          has_saved_views: true,
          api_endpoint: '/api/v1/trinity?category=lexicon',
          database_table_name: 'trinity_entries'
        },
        {
          id: 204,  # Fixed ID - matches production
          name: 'Active Jobs',
          slug: 'active-jobs',
          icon: '🏗️',
          file_location: 'pages/ActiveJobsPage.jsx',
          model_class: 'Construction',
          description: 'Construction jobs management',
          has_saved_views: true,
          api_endpoint: '/api/v1/constructions',
          database_table_name: 'constructions'
        },
        {
          id: 205,  # Fixed ID - matches production
          name: 'Price Books',
          slug: 'price-books',  # Matches production (with hyphen)
          icon: '💵',
          file_location: 'pages/PriceBooksTrinityView.jsx',
          model_class: 'PricebookItem',
          description: 'Product pricing and supplier information',
          has_saved_views: true,
          api_endpoint: '/api/v1/pricebook',
          database_table_name: 'pricebook_items'
        },
        {
          id: 206,  # Fixed ID - matches production
          name: 'WHS SWMS',
          slug: 'whs-swms',
          icon: '⚠️',
          file_location: 'pages/WhsSwmsPage.jsx',
          model_class: 'WhsSwms',
          description: 'Safe Work Method Statements',
          has_saved_views: true,
          api_endpoint: '/api/v1/whs_swms',
          database_table_name: 'whs_swms'
        },
        {
          id: 207,  # Fixed ID - matches production
          name: 'WHS Action Items',
          slug: 'whs-action-items',
          icon: '📋',
          file_location: 'pages/WhsActionItemsPage.jsx',
          model_class: 'WhsActionItem',
          description: 'Workplace health and safety action tracking',
          has_saved_views: true,
          api_endpoint: '/api/v1/whs_action_items',
          database_table_name: 'whs_action_items'
        },
        {
          id: 208,  # Fixed ID - matches production
          name: 'WHS Inductions',
          slug: 'whs-inductions',
          icon: '🎓',
          file_location: 'pages/WhsInductionsPage.jsx',
          model_class: 'WhsInduction',
          description: 'Worker induction records',
          has_saved_views: true,
          api_endpoint: '/api/v1/whs_inductions',
          database_table_name: 'whs_inductions'
        },
        {
          id: 209,  # Fixed ID - matches production
          name: 'WHS Inspections',
          slug: 'whs-inspections',
          icon: '🔍',
          file_location: 'pages/WhsInspectionsPage.jsx',
          model_class: 'WhsInspection',
          description: 'Site inspection records',
          has_saved_views: true,
          api_endpoint: '/api/v1/whs_inspections',
          database_table_name: 'whs_inspections'
        },
        {
          id: 210,  # Fixed ID - matches production
          name: 'WHS Incidents',
          slug: 'whs-incidents',
          icon: '🚨',
          file_location: 'pages/WhsIncidentsPage.jsx',
          model_class: 'WhsIncident',
          description: 'Workplace incident reports',
          has_saved_views: true,
          api_endpoint: '/api/v1/whs_incidents',
          database_table_name: 'whs_incidents'
        },
        {
          id: 211,  # Fixed ID - matches production
          name: 'Contact Roles',
          slug: 'contact-roles',
          icon: '👥',
          file_location: 'components/settings/ContactRolesManagement.jsx',
          model_class: 'ContactRole',
          description: 'Contact role definitions',
          has_saved_views: false,
          api_endpoint: '/api/v1/contact_roles',
          database_table_name: 'contact_roles'
        },
        {
          id: 212,  # Fixed ID - matches production
          name: 'User Management',
          slug: 'user-management',
          icon: '👤',
          file_location: 'components/settings/UserManagementTab.jsx',
          model_class: 'User',
          description: 'System user accounts',
          has_saved_views: false,
          api_endpoint: '/api/v1/users',
          database_table_name: 'users'
        },
        {
          id: 213,  # Fixed ID - matches production
          name: 'Inspiring Quotes (Test)',
          slug: 'inspiring-quotes-test',
          icon: '✨',
          file_location: 'pages/TableStandardTest.jsx',
          model_class: 'InspiringQuote',
          description: 'Test table for TrapidTableView standard',
          has_saved_views: true,
          api_endpoint: '/api/v1/inspiring_quotes',
          database_table_name: 'inspiring_quotes'
        },
        {
          id: 214,  # Fixed ID - matches production
          name: 'Contacts',
          slug: 'contacts',
          icon: '📇',
          file_location: 'pages/ContactsPage.jsx',
          model_class: 'Contact',
          description: 'Business contacts and relationships',
          has_saved_views: true,
          api_endpoint: '/api/v1/contacts',
          database_table_name: 'contacts'
        },
        {
          id: 215,  # Fixed ID - matches production
          name: 'Suppliers',
          slug: 'suppliers',
          icon: '🏭',
          file_location: 'pages/SuppliersPage.jsx',
          model_class: 'Contact',
          description: 'Supplier contacts (filtered contacts)',
          has_saved_views: true,
          api_endpoint: '/api/v1/contacts?contact_type=supplier',
          database_table_name: 'contacts'
        },
        {
          id: 216,  # Fixed ID - matches production
          name: 'Estimates',
          slug: 'estimates',
          icon: '📊',
          file_location: 'pages/EstimatesPage.jsx',
          model_class: 'Estimate',
          description: 'Project cost estimates',
          has_saved_views: true,
          api_endpoint: '/api/v1/estimates',
          database_table_name: 'estimates'
        },
        {
          id: 217,  # Fixed ID - matches production
          name: 'Purchase Orders',
          slug: 'purchase-orders',
          icon: '📦',
          file_location: 'pages/PurchaseOrdersPage.jsx',
          model_class: 'PurchaseOrder',
          description: 'Material and service purchase orders',
          has_saved_views: true,
          api_endpoint: '/api/v1/purchase_orders',
          database_table_name: 'purchase_orders'
        },
        {
          id: 218,  # Fixed ID - matches production
          name: 'SM Tasks',
          slug: 'sm-tasks',
          icon: '📋',
          file_location: 'pages/SmGanttPage.jsx',
          model_class: 'SmTask',
          description: 'Site Management tasks for Gantt charts',
          has_saved_views: true,
          api_endpoint: '/api/v1/sm_tasks',
          database_table_name: 'sm_tasks'
        },
        {
          id: 219,  # Fixed ID - matches production
          name: 'SM Resources',
          slug: 'sm-resources',
          icon: '👷',
          file_location: 'pages/SmResourcesPage.jsx',
          model_class: 'SmResource',
          description: 'Site Management resources (workers, equipment)',
          has_saved_views: true,
          api_endpoint: '/api/v1/sm_resources',
          database_table_name: 'sm_resources'
        },
        {
          id: 220,  # Fixed ID - matches production
          name: 'SM Time Entries',
          slug: 'sm-time-entries',
          icon: '⏱️',
          file_location: 'components/sm-gantt/SmTimesheet.jsx',
          model_class: 'SmTimeEntry',
          description: 'Site Management time tracking entries',
          has_saved_views: true,
          api_endpoint: '/api/v1/sm_time_entries',
          database_table_name: 'sm_time_entries'
        },
        {
          id: 221,  # Fixed ID - matches production
          name: 'Price Histories',
          slug: 'price-histories',
          icon: '📈',
          file_location: 'components/pricebook/PriceHistoryPanel.jsx',
          model_class: 'PriceHistory',
          description: 'Historical price records for pricebook items',
          has_saved_views: false,
          api_endpoint: '/api/v1/price_histories',
          database_table_name: 'price_histories'
        }
      ]

      puts "Seeding #{system_tables.count} system tables with FIXED IDs (199-221)..."
      created = 0
      updated = 0
      skipped = 0
      id_fixed = 0

      system_tables.each do |table_data|
        fixed_id = table_data[:id]

        # First check if there's a table with wrong ID but correct slug
        existing_by_slug = Table.find_by(slug: table_data[:slug])
        existing_by_id = Table.find_by(id: fixed_id)

        if existing_by_slug && existing_by_slug.id != fixed_id
          # Table exists with wrong ID - need to delete and recreate with correct ID
          puts "  Fixing ID: #{table_data[:name]} (#{existing_by_slug.id} -> #{fixed_id})"
          existing_by_slug.destroy!
          existing_by_slug = nil
          id_fixed += 1
        end

        if existing_by_id && existing_by_id.slug != table_data[:slug]
          # Different table has our target ID - this shouldn't happen normally
          puts "  WARNING: ID #{fixed_id} is taken by #{existing_by_id.name} (slug: #{existing_by_id.slug})"
          puts "           Cannot create #{table_data[:name]} with this ID"
          next
        end

        table = existing_by_slug || existing_by_id

        if table
          # Update existing table with system fields
          updates_needed = table.table_type != 'system' ||
                          table.model_class != table_data[:model_class] ||
                          table.api_endpoint != table_data[:api_endpoint]

          if updates_needed
            table.update!(
              table_type: 'system',
              model_class: table_data[:model_class],
              api_endpoint: table_data[:api_endpoint],
              file_location: table_data[:file_location],
              has_saved_views: table_data[:has_saved_views],
              icon: table_data[:icon],
              description: table_data[:description]
            )
            updated += 1
            puts "  Updated: #{table_data[:name]} (ID: #{table.id})"
          else
            skipped += 1
            puts "  Skipped (already correct): #{table_data[:name]} (ID: #{table.id})"
          end
        else
          # Create new system table with FIXED ID
          unique_db_name = "system_#{table_data[:slug].gsub('-', '_')}"

          # Use raw SQL to insert with specific ID
          table = Table.new(
            name: table_data[:name],
            slug: table_data[:slug],
            database_table_name: unique_db_name,
            icon: table_data[:icon],
            description: table_data[:description],
            table_type: 'system',
            model_class: table_data[:model_class],
            api_endpoint: table_data[:api_endpoint],
            file_location: table_data[:file_location],
            has_saved_views: table_data[:has_saved_views],
            is_live: true
          )
          table.id = fixed_id
          table.save!

          created += 1
          puts "  Created: #{table_data[:name]} (ID: #{table.id})"
        end
      end

      # Reset the sequence to be higher than our fixed IDs
      max_id = Table.maximum(:id) || 221
      new_sequence_value = [max_id + 1, 222].max
      ActiveRecord::Base.connection.execute("SELECT setval('tables_id_seq', #{new_sequence_value}, false)")
      puts "\n  Sequence reset to: #{new_sequence_value}"

      puts "\nSummary:"
      puts "  Created: #{created}"
      puts "  Updated: #{updated}"
      puts "  ID Fixed: #{id_fixed}"
      puts "  Skipped: #{skipped}"
      puts "  Total: #{system_tables.count}"
    end

    desc "List all tables with their IDs and types"
    task list: :environment do
      puts "\n#{'=' * 80}"
      puts "All Tables in Registry"
      puts "#{'=' * 80}\n\n"

      # Group by table_type
      tables = Table.all.order(:table_type, :name)

      current_type = nil
      tables.each do |table|
        if table.table_type != current_type
          current_type = table.table_type
          puts "\n#{current_type&.upcase || 'USER'} TABLES:"
          puts "-" * 40
        end

        puts "  ID: #{table.id.to_s.ljust(5)} | #{table.icon || '📄'} #{table.name.ljust(30)} | slug: #{table.slug}"
      end

      puts "\n#{'=' * 80}"
      puts "Total: #{tables.count} tables (#{tables.where(table_type: 'system').count} system, #{tables.where(table_type: ['user', nil]).count} user)"
      puts "#{'=' * 80}\n"
    end
  end
end

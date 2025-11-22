namespace :trapid do
  namespace :tables do
    desc "Seed system tables (in-memory tables) with proper IDs in the tables table"
    task seed_system: :environment do
      # System tables that were previously "in-memory" tables
      # These are Rails models that use TrapidTableView but weren't registered in the tables table
      system_tables = [
        {
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
        {
          name: 'Gold Standard Reference',
          slug: 'gold-standard-table',
          icon: '🏆',
          file_location: 'components/settings/GoldStandardTableTab.jsx',
          model_class: 'GoldStandardItem',
          description: 'Reference table for column types - single source of truth',
          has_saved_views: true,
          api_endpoint: '/api/v1/gold_standard_items',
          database_table_name: 'gold_standard_items'
        },
        {
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
          name: 'Price Books',
          slug: 'pricebooks',
          icon: '💵',
          file_location: 'pages/PriceBooksTrinityView.jsx',
          model_class: 'PricebookItem',
          description: 'Product pricing and supplier information',
          has_saved_views: true,
          api_endpoint: '/api/v1/pricebook',
          database_table_name: 'pricebook_items'
        },
        {
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
          name: 'SM Time Entries',
          slug: 'sm-time-entries',
          icon: '⏱️',
          file_location: 'components/sm-gantt/SmTimesheet.jsx',
          model_class: 'SmTimeEntry',
          description: 'Site Management time tracking entries',
          has_saved_views: true,
          api_endpoint: '/api/v1/sm_time_entries',
          database_table_name: 'sm_time_entries'
        }
      ]

      puts "Seeding #{system_tables.count} system tables..."
      created = 0
      updated = 0
      skipped = 0

      system_tables.each do |table_data|
        # Find or create by slug (slug is unique)
        table = Table.find_by(slug: table_data[:slug])

        if table
          # Update existing table with system fields
          if table.table_type != 'system'
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
            puts "  Skipped (already system): #{table_data[:name]} (ID: #{table.id})"
          end
        else
          # Create new system table
          # For system tables that share the same underlying database table (e.g., trinity views),
          # we use slug as a unique database_table_name identifier since they're virtual views
          # Use "system_" prefix + slug to make it unique
          unique_db_name = "system_#{table_data[:slug].gsub('-', '_')}"

          table = Table.create!(
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
          created += 1
          puts "  Created: #{table_data[:name]} (ID: #{table.id})"
        end
      end

      puts "\nSummary:"
      puts "  Created: #{created}"
      puts "  Updated: #{updated}"
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

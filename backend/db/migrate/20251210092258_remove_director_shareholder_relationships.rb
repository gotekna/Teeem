class RemoveDirectorShareholderRelationships < ActiveRecord::Migration[7.1]
  def up
    # Count before deletion
    director_count = ContactRelationship.where(relationship_type: 'director_of').count
    shareholder_count = ContactRelationship.where(relationship_type: 'shareholder_of').count

    puts "=" * 80
    puts "REMOVING DUPLICATE DIRECTOR/SHAREHOLDER RELATIONSHIPS"
    puts "=" * 80
    puts "Director relationships to remove: #{director_count}"
    puts "Shareholder relationships to remove: #{shareholder_count}"
    puts "Total: #{director_count + shareholder_count}"
    puts ""
    puts "These are duplicates of data in:"
    puts "  - corporate_company_directors table"
    puts "  - corporate_company_shareholdings table"
    puts ""

    # Delete relationships (Corporate tables are the SSoT)
    ContactRelationship.where(relationship_type: [ 'director_of', 'shareholder_of' ]).delete_all

    puts "✅ Deleted #{director_count + shareholder_count} relationships"
    puts ""
    puts "Directors and shareholders are now managed ONLY via Corporate → Structure tab"
    puts "=" * 80
  end

  def down
    # Cannot restore - data was intentional duplication
    puts "Cannot restore deleted relationships - they were duplicates"
    puts "The official data exists in:"
    puts "  - corporate_company_directors table"
    puts "  - corporate_company_shareholdings table"
  end
end

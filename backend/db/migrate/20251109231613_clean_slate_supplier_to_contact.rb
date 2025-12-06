class CleanSlateSupplierToContact < ActiveRecord::Migration[8.0]
  def up
    # Clean slate approach:
    # 1. Delete ALL contacts
    # 2. Create fresh contacts from suppliers table
    # 3. Set supplier.contact_id = supplier.id for simplicity

    say_with_time "Step 1: Dropping foreign key constraints..." do
      execute "ALTER TABLE pricebook_items DROP CONSTRAINT IF EXISTS fk_rails_pricebook_items_contact"
      execute "ALTER TABLE pricebook_items DROP CONSTRAINT IF EXISTS fk_rails_pricebook_items_default_supplier"
      execute "ALTER TABLE pricebook_items DROP CONSTRAINT IF EXISTS fk_rails_0f467e00cc"
      execute "ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS fk_rails_purchase_orders_contact"
      execute "ALTER TABLE price_histories DROP CONSTRAINT IF EXISTS fk_rails_price_histories_contact"
    end

    say_with_time "Step 2: Deleting all existing contacts..." do
      execute "DELETE FROM contacts"
    end

    say_with_time "Step 3: Creating contacts from suppliers..." do
      Supplier.find_each do |supplier|
        # Create a new contact with the supplier's ID
        contact = Contact.new(id: supplier.id)
        contact.full_name = supplier.name
        contact.first_name = supplier.name.split.first
        contact.last_name = supplier.name.split[1..-1]&.join(' ')
        contact.email = supplier.email
        contact.mobile_phone = supplier.phone
        contact.address = supplier.address
        contact.notes = supplier.notes
        contact.contact_types = [ 'supplier' ]
        contact.primary_contact_type = 'supplier'
        contact.rating = supplier.rating
        contact.response_rate = supplier.response_rate
        contact.avg_response_time = supplier.avg_response_time
        contact.is_active = supplier.is_active
        contact.supplier_code = supplier.supplier_code

        contact.save!(validate: false)

        # Update supplier to point to its own ID
        supplier.update_column(:contact_id, supplier.id)
      end
    end

    say_with_time "Step 4: Re-adding foreign key constraints..." do
      execute "ALTER TABLE pricebook_items ADD CONSTRAINT fk_rails_pricebook_items_contact FOREIGN KEY (supplier_id) REFERENCES contacts(id)"
      execute "ALTER TABLE pricebook_items ADD CONSTRAINT fk_rails_pricebook_items_default_supplier FOREIGN KEY (default_supplier_id) REFERENCES contacts(id)"
      execute "ALTER TABLE purchase_orders ADD CONSTRAINT fk_rails_purchase_orders_contact FOREIGN KEY (supplier_id) REFERENCES contacts(id)"
      execute "ALTER TABLE price_histories ADD CONSTRAINT fk_rails_price_histories_contact FOREIGN KEY (supplier_id) REFERENCES contacts(id)"
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "This migration cannot be reversed safely"
  end
end

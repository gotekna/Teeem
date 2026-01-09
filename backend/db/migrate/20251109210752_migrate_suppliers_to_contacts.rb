class MigrateSuppliersToContacts < ActiveRecord::Migration[8.0]
  def up
    # This migration copies all supplier data into the contacts table
    # Suppliers that are already linked to a contact will update that contact
    # Suppliers without a contact will create a new contact

    # Temporarily disable foreign key constraints
    say_with_time "Disabling foreign key constraints..." do
      execute "ALTER TABLE pricebook_items DROP CONSTRAINT IF EXISTS fk_rails_ebdb494f92"
      execute "ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS fk_rails_1d67bb2d7b"
      execute "ALTER TABLE price_histories DROP CONSTRAINT IF EXISTS fk_rails_027e7dacb9"
    end

    say_with_time "Migrating suppliers to contacts..." do
      Supplier.find_each do |supplier|
        contact = if supplier.contact_id.present?
          # Supplier is already linked to a contact - update that contact
          Contact.find(supplier.contact_id)
        else
          # Supplier has no contact - create a new contact
          c = Contact.new
          c.full_name = supplier.name
          c.first_name = supplier.name.split.first
          c.last_name = supplier.name.split[1..-1]&.join(' ')
          c
        end

        update_contact_from_supplier(contact, supplier)

        # Update the supplier to link to this contact if not already
        supplier.update_column(:contact_id, contact.id) unless supplier.contact_id == contact.id

        # Update foreign keys to point to contact instead of supplier
        # Skip if already updated (supplier_id already equals contact_id)
        next if supplier.id == contact.id

        execute "UPDATE pricebook_items SET supplier_id = #{contact.id} WHERE supplier_id = #{supplier.id}"
        execute "UPDATE purchase_orders SET supplier_id = #{contact.id} WHERE supplier_id = #{supplier.id}"

        # For price_histories, delete ones from supplier that would create duplicates with existing contact records
        execute <<-SQL
          DELETE FROM price_histories ph1
          WHERE ph1.supplier_id = #{supplier.id}
          AND EXISTS (
            SELECT 1 FROM price_histories ph2
            WHERE ph2.supplier_id = #{contact.id}
            AND ph2.pricebook_item_id = ph1.pricebook_item_id
            AND ph2.new_price = ph1.new_price
            AND ph2.created_at = ph1.created_at
          )
        SQL

        execute "UPDATE price_histories SET supplier_id = #{contact.id} WHERE supplier_id = #{supplier.id}"
      end
    end

    # Re-add foreign key constraints pointing to contacts table
    say_with_time "Re-adding foreign key constraints to contacts table..." do
      execute "ALTER TABLE pricebook_items ADD CONSTRAINT fk_rails_pricebook_items_contact FOREIGN KEY (supplier_id) REFERENCES contacts(id)"
      execute "ALTER TABLE purchase_orders ADD CONSTRAINT fk_rails_purchase_orders_contact FOREIGN KEY (supplier_id) REFERENCES contacts(id)"
      execute "ALTER TABLE price_histories ADD CONSTRAINT fk_rails_price_histories_contact FOREIGN KEY (supplier_id) REFERENCES contacts(id)"
    end
  end

  def down
    # Rollback: Remove supplier type from contacts
    say_with_time "Rolling back supplier migration..." do
      Contact.where("'supplier' = ANY(contact_types)").find_each do |contact|
        contact.contact_types = contact.contact_types - [ 'supplier' ]
        contact.save!
      end
    end
  end

  private

  def update_contact_from_supplier(contact, supplier)
    # Add 'supplier' to contact_types if not already present
    contact.contact_types ||= []
    contact.contact_types << 'supplier' unless contact.contact_types.include?('supplier')
    contact.contact_types.uniq!

    # Set primary type if not set
    contact.primary_contact_type ||= 'supplier'

    # Copy supplier-specific fields
    contact.rating = supplier.rating
    contact.response_rate = supplier.response_rate
    contact.avg_response_time = supplier.avg_response_time
    contact.notes = supplier.notes
    contact.is_active = supplier.is_active
    contact.supplier_code = supplier.supplier_code

    # Copy contact information if not already set
    contact.email ||= supplier.email
    contact.mobile_phone ||= supplier.phone
    contact.address ||= supplier.address

    contact.save!
    contact
  end
end

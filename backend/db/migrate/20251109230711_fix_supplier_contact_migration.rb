class FixSupplierContactMigration < ActiveRecord::Migration[8.0]
  def up
    # This migration fixes the incorrect supplier-to-contact migration
    # The previous migration moved foreign keys from supplier.id -> supplier.contact_id
    # But this created orphaned contacts where contact.id == old_supplier.id
    #
    # This fix:
    # 1. Moves all foreign key references BACK to use the supplier's own ID
    # 2. Ensures supplier data lives under the supplier's ID (not a separate contact_id)
    # 3. Deletes orphaned contacts that were created as side effects

    say_with_time "Fixing supplier-contact foreign key mappings..." do
      # Temporarily disable foreign key constraints
      execute "ALTER TABLE pricebook_items DROP CONSTRAINT IF EXISTS fk_rails_pricebook_items_contact"
      execute "ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS fk_rails_purchase_orders_contact"
      execute "ALTER TABLE price_histories DROP CONSTRAINT IF EXISTS fk_rails_price_histories_contact"
      execute "ALTER TABLE pricebook_items DROP CONSTRAINT IF EXISTS fk_rails_pricebook_items_default_supplier"
      execute "ALTER TABLE pricebook_items DROP CONSTRAINT IF EXISTS fk_rails_0f467e00cc"

      # For each supplier where supplier.id != supplier.contact_id
      # Move the foreign keys BACK from contact_id to supplier.id
      Supplier.find_each do |supplier|
        next if supplier.contact_id.nil?
        next if supplier.id == supplier.contact_id

        old_contact_id = supplier.contact_id
        supplier_id = supplier.id

        # Move foreign keys from contact_id back to supplier_id
        execute "UPDATE pricebook_items SET supplier_id = #{supplier_id} WHERE supplier_id = #{old_contact_id}"
        execute "UPDATE pricebook_items SET default_supplier_id = #{supplier_id} WHERE default_supplier_id = #{old_contact_id}"
        execute "UPDATE purchase_orders SET supplier_id = #{supplier_id} WHERE supplier_id = #{old_contact_id}"

        # For price histories, we need to handle potential duplicates
        # Delete price histories from old contact that would duplicate with supplier records
        execute <<-SQL
          DELETE FROM price_histories ph1
          WHERE ph1.supplier_id = #{old_contact_id}
          AND EXISTS (
            SELECT 1 FROM price_histories ph2
            WHERE ph2.supplier_id = #{supplier_id}
            AND ph2.pricebook_item_id = ph1.pricebook_item_id
            AND ph2.new_price = ph1.new_price
            AND ph2.created_at = ph1.created_at
          )
        SQL

        execute "UPDATE price_histories SET supplier_id = #{supplier_id} WHERE supplier_id = #{old_contact_id}"

        # If a Contact exists at supplier_id that's NOT the target contact, we need to handle it
        contact_at_supplier_id = Contact.find_by(id: supplier_id)
        contact_at_old_id = Contact.find_by(id: old_contact_id)

        if contact_at_supplier_id && contact_at_old_id && contact_at_supplier_id.id != contact_at_old_id.id
          # Merge the supplier data from the old contact into the supplier ID contact
          # This preserves both the supplier data AND the existing contact at that ID

          # Add supplier to contact_types if not present
          types = contact_at_supplier_id.contact_types || []
          types << 'supplier' unless types.include?('supplier')
          contact_at_supplier_id.update_column(:contact_types, types.uniq)

          # Copy supplier-specific fields from the old contact (which has the supplier data)
          if contact_at_old_id.is_supplier?
            contact_at_supplier_id.update_columns(
              rating: contact_at_old_id.rating,
              response_rate: contact_at_old_id.response_rate,
              avg_response_time: contact_at_old_id.avg_response_time,
              is_active: contact_at_old_id.is_active,
              supplier_code: contact_at_old_id.supplier_code,
              address: contact_at_old_id.address || contact_at_supplier_id.address,
              notes: [ contact_at_supplier_id.notes, contact_at_old_id.notes ].compact.join("\n\n---\n\n")
            )
          end

          # Delete the old contact that had the supplier data
          contact_at_old_id.destroy
        elsif contact_at_old_id && !contact_at_supplier_id
          # No contact exists at supplier_id, so just move the contact to supplier_id
          # This is safe because we've already moved all foreign keys
          execute "UPDATE contacts SET id = #{supplier_id} WHERE id = #{old_contact_id}"
        end

        # Update the supplier to point to its own ID
        supplier.update_column(:contact_id, supplier_id)
      end
    end

    # Re-add foreign key constraints
    say_with_time "Re-adding foreign key constraints..." do
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

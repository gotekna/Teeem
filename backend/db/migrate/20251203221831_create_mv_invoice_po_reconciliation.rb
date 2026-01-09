# Create Materialized View for Invoice-to-PO Reconciliation
# Shows matching status between purchase orders and invoices from Xero
class CreateMvInvoicePoReconciliation < ActiveRecord::Migration[8.0]
  def up
    # ============================================
    # MV_INVOICE_PO_RECONCILIATION - Match invoices to POs
    # Shows which POs have invoices, variances, and reconciliation status
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_invoice_po_reconciliation AS
      SELECT
        po.id as purchase_order_id,
        po.purchase_order_number,
        po.job_id,
        j.title as job_title,
        po.supplier_id,
        c.full_name as supplier_name,
        po.status as po_status,
        po.payment_status,
        po.total as po_total,
        po.sub_total as po_subtotal,
        po.tax as po_tax,
        po.invoiced_amount,
        po.invoice_date,
        po.invoice_reference,
        -- Linked invoice metrics from external_invoices
        COUNT(ei.id) as invoice_count,
        COALESCE(SUM(ei.total), 0) as invoiced_total,
        COALESCE(SUM(ei.amount_paid), 0) as paid_total,
        -- Variance calculations
        po.total - COALESCE(SUM(ei.total), 0) as variance,
        CASE
          WHEN ABS(po.total - COALESCE(SUM(ei.total), 0)) < 1.0 THEN 'matched'
          WHEN COALESCE(SUM(ei.total), 0) = 0 THEN 'no_invoices'
          WHEN po.total > COALESCE(SUM(ei.total), 0) THEN 'under_invoiced'
          ELSE 'over_invoiced'
        END as reconciliation_status,
        -- Document count from company_documents (via polymorphic)
        (SELECT COUNT(*) FROM company_documents cd
         WHERE cd.documentable_type = 'PurchaseOrder' AND cd.documentable_id = po.id) as po_document_count,
        -- Dates
        po.ordered_date,
        po.required_date,
        po.received_date,
        po.created_at as po_created_at,
        -- Refresh timestamp
        NOW() as refreshed_at
      FROM purchase_orders po
      INNER JOIN jobs j ON j.id = po.job_id
      LEFT JOIN contacts c ON c.id = po.supplier_id
      LEFT JOIN external_invoices ei ON ei.job_id = po.job_id
        AND ei.contact_id = po.supplier_id
        AND ei.invoice_type = 'bill'
      GROUP BY
        po.id,
        po.purchase_order_number,
        po.job_id,
        j.title,
        po.supplier_id,
        c.full_name,
        po.status,
        po.payment_status,
        po.total,
        po.sub_total,
        po.tax,
        po.invoiced_amount,
        po.invoice_date,
        po.invoice_reference,
        po.ordered_date,
        po.required_date,
        po.received_date,
        po.created_at
      WITH DATA;

      -- Indexes for common query patterns
      CREATE UNIQUE INDEX ON mv_invoice_po_reconciliation(purchase_order_id);
      CREATE INDEX ON mv_invoice_po_reconciliation(job_id);
      CREATE INDEX ON mv_invoice_po_reconciliation(supplier_id);
      CREATE INDEX ON mv_invoice_po_reconciliation(reconciliation_status);
      CREATE INDEX ON mv_invoice_po_reconciliation(po_status);
      CREATE INDEX ON mv_invoice_po_reconciliation(payment_status);
    SQL
  end

  def down
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_invoice_po_reconciliation CASCADE"
  end
end

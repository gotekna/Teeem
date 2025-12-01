import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface Invoice {
  id: number;
  invoice_number: string | null;
  reference: string | null;
  invoice_type: string | null;
  status: string | null;
  invoice_date: string | null;
  due_date: string | null;
  subtotal: number | null;
  total_tax: number | null;
  total: number | null;
  amount_due: number | null;
  amount_paid: number | null;
  currency_code: string | null;
  contact_name: string | null;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      whereClause += ` AND invoice_type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (invoice_number ILIKE $${params.length} OR contact_name ILIKE $${params.length} OR reference ILIKE $${params.length})`;
    }

    params.push(limit, offset);

    const invoices = await query<Invoice>(`
      SELECT
        id, invoice_number, reference, invoice_type, status,
        invoice_date, due_date, subtotal, total_tax, total,
        amount_due, amount_paid, currency_code, contact_name, created_at
      FROM external_invoices
      ${whereClause}
      ORDER BY invoice_date DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    // Get total count
    const countParams = params.slice(0, -2);
    const countResult = await query<{ count: string }>(`
      SELECT COUNT(*) as count FROM external_invoices ${whereClause.replace(/LIMIT.*$/, '')}
    `, countParams.length > 0 ? countParams : undefined);

    return NextResponse.json({
      invoices,
      total: parseInt(countResult[0]?.count || '0'),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Xero invoices API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

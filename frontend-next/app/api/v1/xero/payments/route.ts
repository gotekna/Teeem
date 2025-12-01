import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface Payment {
  id: number;
  amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  xero_payment_id: string | null;
  xero_synced_at: string | null;
  purchase_order_id: number | null;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (reference_number ILIKE $${params.length} OR notes ILIKE $${params.length})`;
    }

    params.push(limit, offset);

    const payments = await query<Payment>(`
      SELECT
        id, amount, payment_date, payment_method, reference_number,
        notes, xero_payment_id, xero_synced_at, purchase_order_id, created_at
      FROM payments
      ${whereClause}
      ORDER BY payment_date DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    // Get total count
    const countParams = params.slice(0, -2);
    const countResult = await query<{ count: string }>(`
      SELECT COUNT(*) as count FROM payments ${whereClause.replace(/LIMIT.*$/, '')}
    `, countParams.length > 0 ? countParams : undefined);

    return NextResponse.json({
      payments,
      total: parseInt(countResult[0]?.count || '0'),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Xero payments API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

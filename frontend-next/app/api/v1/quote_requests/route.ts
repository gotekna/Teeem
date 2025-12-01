import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface QuoteRequest {
  id: number;
  job_id: number | null;
  title: string | null;
  description: string | null;
  trade_category: string | null;
  requested_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length} OR trade_category ILIKE $${params.length})`;
    }

    params.push(limit, offset);

    const quoteRequests = await query<QuoteRequest>(`
      SELECT
        id, job_id, title, description, trade_category,
        requested_date, budget_min, budget_max, status,
        created_at, updated_at
      FROM quote_requests
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    // Get total count
    const countParams = params.slice(0, -2);
    const countResult = await query<{ count: string }>(`
      SELECT COUNT(*) as count FROM quote_requests ${whereClause.replace(/LIMIT.*$/, '')}
    `, countParams.length > 0 ? countParams : undefined);

    return NextResponse.json({
      quote_requests: quoteRequests,
      total: parseInt(countResult[0]?.count || '0'),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Quote requests API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote requests' },
      { status: 500 }
    );
  }
}

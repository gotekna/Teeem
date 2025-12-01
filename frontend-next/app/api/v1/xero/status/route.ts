import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface XeroCredentials {
  id: number;
  tenant_name: string | null;
  tenant_type: string | null;
  expires_at: string | null;
}

export async function GET() {
  try {
    const credentials = await query<XeroCredentials>(`
      SELECT id, tenant_name, tenant_type, expires_at
      FROM xero_credentials
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    if (credentials.length === 0) {
      return NextResponse.json({
        connected: false,
        tenant_name: null,
      });
    }

    const cred = credentials[0];
    const isExpired = cred.expires_at ? new Date(cred.expires_at) < new Date() : true;

    return NextResponse.json({
      connected: !isExpired,
      tenant_name: cred.tenant_name,
      tenant_type: cred.tenant_type,
      expires_at: cred.expires_at,
    });
  } catch (error) {
    console.error('Xero status API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Xero status' },
      { status: 500 }
    );
  }
}

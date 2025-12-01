import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export async function GET() {
  try {
    // Get the first user for dev mode
    // In production, this would validate the JWT token from the Authorization header
    const users = await query<User>(`
      SELECT id, email, name, role, created_at
      FROM users
      LIMIT 1
    `);

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user: users[0] });
  } catch (error) {
    console.error('Auth me API error:', error);
    return NextResponse.json(
      { error: 'Failed to get current user' },
      { status: 500 }
    );
  }
}

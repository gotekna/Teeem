import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { User } from '@/lib/types';

export async function GET() {
  try {
    // For now, return the first user as a dev bypass
    // In production, this would validate the JWT token
    const users = await query<User>(`
      SELECT id, email, name, role, created_at
      FROM users
      WHERE id = 1
      LIMIT 1
    `);

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user: users[0] });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email (dev mode - no password check)
    const users = await query<User>(`
      SELECT id, email, name, role
      FROM users
      WHERE email = $1
      LIMIT 1
    `, [email]);

    if (users.length === 0) {
      // In dev mode, just return the first user
      const anyUser = await query<User>(`
        SELECT id, email, name, role
        FROM users
        LIMIT 1
      `);

      if (anyUser.length === 0) {
        return NextResponse.json(
          { error: 'No users found in database' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        user: anyUser[0],
        token: 'dev-token-' + anyUser[0].id,
      });
    }

    return NextResponse.json({
      user: users[0],
      token: 'dev-token-' + users[0].id,
    });
  } catch (error) {
    console.error('Auth login API error:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}

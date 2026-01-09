import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const contacts = await query(`
      SELECT
        id,
        display_name,
        first_name,
        last_name,
        email,
        office_phone,
        mobile_phone,
        website,
        abn,
        contact_types,
        rating,
        response_rate,
        created_at,
        updated_at
      FROM contacts
      WHERE deleted IS NOT TRUE
      ORDER BY display_name ASC
      LIMIT 200
    `);

    return NextResponse.json({ contacts, total: contacts.length });
  } catch (error) {
    console.error("Failed to fetch contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

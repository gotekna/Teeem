import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const items = await query(`
      SELECT
        id,
        item_code,
        item_name,
        category,
        unit_of_measure,
        current_price,
        brand,
        notes,
        is_active,
        needs_pricing_review,
        price_last_updated_at,
        image_url,
        default_supplier_id,
        requires_photo,
        requires_spec,
        spec_url,
        gst_code,
        created_at,
        updated_at
      FROM pricebook
      WHERE is_active = true
      ORDER BY item_name ASC
      LIMIT 500
    `);

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    console.error("Failed to fetch pricebook:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricebook" },
      { status: 500 }
    );
  }
}

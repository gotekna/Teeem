import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entity_type");
    const active = searchParams.get("active");

    let sql = `
      SELECT
        id,
        name,
        description,
        order_position,
        entity_types,
        active,
        created_at,
        updated_at
      FROM document_folders
      WHERE 1=1
    `;

    const params: any[] = [];

    if (entityType) {
      sql += ` AND entity_types @> $${params.length + 1}::jsonb`;
      params.push(JSON.stringify([entityType]));
    }

    if (active !== null) {
      sql += ` AND active = $${params.length + 1}`;
      params.push(active === "true");
    }

    sql += ` ORDER BY order_position ASC`;

    const folders = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: folders,
    });
  } catch (error) {
    console.error("Failed to fetch document folders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch document folders" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { folder } = await request.json();

    const result = await query(
      `
      INSERT INTO document_folders (name, description, order_position, entity_types, active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
      `,
      [
        folder.name,
        folder.description || "",
        folder.order_position || 0,
        JSON.stringify(folder.entity_types || []),
        folder.active !== false,
      ]
    );

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error("Failed to create document folder:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create document folder" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { COMPANY_TIMEZONE } from "@/lib/timezone-utils";

interface CompanySettings {
  id: number;
  company_name: string | null;
  abn: string | null;
  gst_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  timezone: string | null;
  working_days: Record<string, boolean>;
  twilio_enabled: boolean;
  job_cascade_sort: unknown | null;
}

export async function GET() {
  try {
    const settings = await queryOne<CompanySettings>(`
      SELECT
        id,
        company_name,
        abn,
        gst_number,
        email,
        phone,
        address,
        logo_url,
        timezone,
        working_days,
        twilio_enabled,
        job_cascade_sort
      FROM company_settings
      ORDER BY id
      LIMIT 1
    `);

    // SSoT: Uses COMPANY_TIMEZONE from timezone-utils.ts
    if (!settings) {
      return NextResponse.json({
        company_name: "TEEEM",
        timezone: COMPANY_TIMEZONE,
        working_days: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch company settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch company settings" },
      { status: 500 }
    );
  }
}

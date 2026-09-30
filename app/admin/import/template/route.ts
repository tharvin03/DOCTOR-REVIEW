import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { buildTemplate } from "@/lib/import";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return new NextResponse(new Uint8Array(await buildTemplate()), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="review-import-template.xlsx"',
    },
  });
}

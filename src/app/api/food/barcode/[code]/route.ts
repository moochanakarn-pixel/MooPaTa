import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_th?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
  serving_quantity?: number;
}

// Proxies Open Food Facts — a free, public, no-API-key nutrition database
// for packaged/branded products — so the client doesn't need to worry about
// CORS or hide anything (there's no secret involved, just avoiding a direct
// third-party call from the browser for consistency with the rest of the app).
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const code = params.code.replace(/[^0-9]/g, "");
  if (!code) {
    return NextResponse.json({ error: "invalid_barcode" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
      headers: { "User-Agent": "MooPaTa - https://moopata.mcnkth.com" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error("Open Food Facts lookup failed", err);
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }

  const data = (await res.json()) as { status?: number; product?: OpenFoodFactsProduct };
  if (data.status !== 1 || !data.product) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const p = data.product;
  const n = p.nutriments ?? {};
  const caloriesPer100g = n["energy-kcal_100g"];
  if (caloriesPer100g === undefined) {
    // Some products are missing structured nutriment data (photos-only
    // entries) — nothing useful to prefill, so treat it like "not found"
    // rather than handing back a food with a calorie count of zero.
    return NextResponse.json({ error: "no_nutrition_data" }, { status: 404 });
  }

  return NextResponse.json({
    name: p.product_name_th || p.product_name || `บาร์โค้ด ${code}`,
    caloriesPer100g,
    proteinPer100g: n.proteins_100g ?? 0,
    carbPer100g: n.carbohydrates_100g ?? 0,
    fatPer100g: n.fat_100g ?? 0,
    suggestedGrams: p.serving_quantity && p.serving_quantity > 0 ? p.serving_quantity : null,
    barcode: code,
  });
}

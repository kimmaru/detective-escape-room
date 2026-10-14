import { NextRequest, NextResponse } from "next/server";
import { getAllReviewsAsync, syncReviewsFromGoogleSheet } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const syncSheet = searchParams.get("syncSheet") === "true";

    if (syncSheet) {
      try {
        await syncReviewsFromGoogleSheet();
      } catch (e) {
        console.warn("Failed to sync sheet:", e);
      }
    }

    const reviews = await getAllReviewsAsync(true);
    const totalReviews = reviews.length;
    const hiddenReviews = reviews.filter((r) => r.hidden).length;

    return NextResponse.json(
      {
        success: true,
        totalReviews,
        hiddenReviews,
        reviews,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

/** Le paiement Stripe arrive au lot 2. D'ici là, la route le dit honnêtement au lieu de simuler un paiement. */
export function GET() {
  return NextResponse.json({ error: "not_implemented", message: "Le paiement n'est pas encore branché." }, { status: 501 });
}

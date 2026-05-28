import { NextRequest, NextResponse } from "next/server";

/**
 * Gating du funnel par cookie :
 *  - /ressource exige le cookie d'opt-in (sinon -> retour landing)
 *  - /merci exige le cookie de booking (sinon -> retour réservation)
 *
 * On laisse passer si l'étape précédente n'a pas posé son cookie pour ne pas
 * casser les liens partagés en démo ? Non : on protège réellement, ce qui
 * reflète un vrai funnel. Pour tester librement, passe par le parcours.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/ressource")) {
    const optin = req.cookies.get("tunnel_optin");
    if (!optin?.value) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (pathname.startsWith("/merci")) {
    const booking = req.cookies.get("tunnel_booking");
    if (!booking?.value) {
      return NextResponse.redirect(new URL("/reserver", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/ressource/:path*", "/merci/:path*"],
};

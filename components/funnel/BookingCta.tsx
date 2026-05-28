"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";

export function BookingCta({ label }: { label: string }) {
  const router = useRouter();

  function handleClick() {
    track(FUNNEL_EVENTS.BOOKING_CLICK);
    router.push("/reserver");
  }

  return (
    <button type="button" className="btn-primary" onClick={handleClick}>
      {label}
      <ArrowRight size={18} />
    </button>
  );
}

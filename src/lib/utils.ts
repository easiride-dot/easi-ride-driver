import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNLe(amount: number) {
  return new Intl.NumberFormat("en-SL", {
    style: "currency",
    currency: "SLL",
    currencyDisplay: "code",
  }).format(amount).replace("SLL", "NLe");
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-SL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Easi Ride support WhatsApp number — update this to the actual number */
export const SUPPORT_WHATSAPP = "+23278000000";

export function openWhatsApp(number: string = SUPPORT_WHATSAPP, message = "") {
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${number.replace(/\D/g, "")}?text=${encoded}`, "_blank");
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(dateStr: string) {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy HH:mm:ss");
  } catch (e) {
    return dateStr;
  }
}

export function formatTime(dateStr: string) {
  try {
    return format(parseISO(dateStr), "HH:mm:ss");
  } catch (e) {
    return dateStr;
  }
}

export function getComplianceColor(rate: number) {
  if (rate >= 90) return "text-success border-success/50 bg-success/10";
  if (rate >= 70) return "text-warning border-warning/50 bg-warning/10";
  return "text-destructive border-destructive/50 bg-destructive/10";
}

export function getComplianceHex(rate: number) {
  if (rate >= 90) return "hsl(142, 71%, 45%)"; // success
  if (rate >= 70) return "hsl(38, 92%, 50%)"; // warning
  return "hsl(348, 83%, 47%)"; // destructive
}

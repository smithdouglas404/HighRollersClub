import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatChips(amount: number | undefined): string {
  if (amount === undefined) return "0";
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + "M";
  if (amount >= 1000) return (amount / 1000).toFixed(1) + "k";
  return amount.toString();
}

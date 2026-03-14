import { format, parseISO } from 'date-fns';

export function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy HH:mm:ss');
  } catch {
    return dateStr;
  }
}

export function formatTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'HH:mm:ss');
  } catch {
    return dateStr;
  }
}

export function getComplianceColor(rate: number): string {
  if (rate >= 90) return 'text-success border-success/50 bg-success/10';
  if (rate >= 70) return 'text-warning border-warning/50 bg-warning/10';
  return 'text-destructive border-destructive/50 bg-destructive/10';
}

export function getComplianceHex(rate: number): string {
  if (rate >= 90) return 'hsl(142, 71%, 45%)';
  if (rate >= 70) return 'hsl(38, 92%, 50%)';
  return 'hsl(348, 83%, 47%)';
}

export const ppeLabelMap: Record<string, string> = {
  hard_hat: 'Hard Hat',
  safety_vest: 'Safety Vest',
  gloves: 'Gloves',
  safety_glasses: 'Safety Glasses',
  face_mask: 'Face Mask',
  safety_boots: 'Safety Boots',
};

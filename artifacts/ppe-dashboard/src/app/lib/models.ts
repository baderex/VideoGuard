export type CameraStatus = 'active' | 'inactive' | 'error';

export const CameraStatusEnum = {
  active: 'active' as CameraStatus,
  inactive: 'inactive' as CameraStatus,
  error: 'error' as CameraStatus,
} as const;

export type CameraPpeRequirementsItem =
  | 'hard_hat'
  | 'safety_vest'
  | 'gloves'
  | 'safety_glasses'
  | 'face_mask'
  | 'safety_boots';

export const CameraPpeRequirementsItem = {
  hard_hat: 'hard_hat' as CameraPpeRequirementsItem,
  safety_vest: 'safety_vest' as CameraPpeRequirementsItem,
  gloves: 'gloves' as CameraPpeRequirementsItem,
  safety_glasses: 'safety_glasses' as CameraPpeRequirementsItem,
  face_mask: 'face_mask' as CameraPpeRequirementsItem,
  safety_boots: 'safety_boots' as CameraPpeRequirementsItem,
} as const;

export interface Camera {
  id: number;
  name: string;
  location: string;
  status: CameraStatus;
  streamUrl?: string;
  ppeRequirements: CameraPpeRequirementsItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCameraRequest {
  name: string;
  location: string;
  streamUrl?: string;
  ppeRequirements: CameraPpeRequirementsItem[];
}

export interface UpdateCameraRequest {
  name?: string;
  location?: string;
  status?: CameraStatus;
  streamUrl?: string;
  ppeRequirements?: CameraPpeRequirementsItem[];
}

export interface DetectedPersonPpe {
  hard_hat: boolean;
  safety_vest: boolean;
  gloves: boolean;
  safety_glasses: boolean;
  face_mask: boolean;
  safety_boots: boolean;
}

export interface DetectedPerson {
  id: string;
  confidence: number;
  ppe: DetectedPersonPpe;
  compliant: boolean;
  missingPpe: string[];
}

export interface DetectionSnapshot {
  cameraId: number;
  timestamp: string;
  personCount: number;
  compliantCount: number;
  nonCompliantCount: number;
  complianceRate: number;
  detectedPersons: DetectedPerson[];
}

export interface LiveAnalytics {
  timestamp: string;
  totalCameras: number;
  activeCameras: number;
  totalPersonsDetected: number;
  totalCompliant: number;
  totalNonCompliant: number;
  overallComplianceRate: number;
  openAlerts: number;
  cameraSnapshots: DetectionSnapshot[];
}

export interface AnalyticsDataPoint {
  timestamp: string;
  cameraId?: number;
  personCount: number;
  compliantCount: number;
  nonCompliantCount: number;
  complianceRate: number;
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export const AlertSeverity = {
  low: 'low' as AlertSeverity,
  medium: 'medium' as AlertSeverity,
  high: 'high' as AlertSeverity,
  critical: 'critical' as AlertSeverity,
} as const;

export type AlertStatus = 'open' | 'acknowledged' | 'resolved';

export const AlertStatus = {
  open: 'open' as AlertStatus,
  acknowledged: 'acknowledged' as AlertStatus,
  resolved: 'resolved' as AlertStatus,
} as const;

export interface Alert {
  id: number;
  cameraId: number;
  cameraName: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  missingPpe?: string[];
  status: AlertStatus;
  personCount: number;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface AlertListResponse {
  alerts: Alert[];
  total: number;
  offset: number;
  limit: number;
}

export interface DailyReportTopViolationsItem {
  ppe: string;
  count: number;
}

export interface DailyReport {
  date: string;
  totalPersonDetections: number;
  uniqueViolations: number;
  averageComplianceRate: number;
  peakHour: string;
  peakPersonCount: number;
  alerts: number;
  hourlyData: AnalyticsDataPoint[];
  topViolations: DailyReportTopViolationsItem[];
}

export interface YoloStats {
  personCount: number;
  violationCount: number;
  complianceRate: number;
  timestamp: number;
}

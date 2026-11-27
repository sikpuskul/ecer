export interface MonthlyReportPoint {
  month: number;
  label: string;
  events: number;
  participants: number;
  certificatesIssued: number;
  awardsIssued: number;
}

export interface CategoryBreakdownItem {
  categoryName: string;
  eventCount: number;
  certificateCount: number;
  awardCount: number;
}

export interface EventReportRow {
  eventId: string;
  eventCode: string;
  title: string;
  categoryName: string;
  eventStartAt: string;
  lifecycleStatus: string;
  participantCount: number;
  certificateCount: number;
  awardCount: number;
}

export interface AdminReportOverview {
  year: number;
  totals: {
    events: number;
    participants: number;
    certificatesIssued: number;
    awardsIssued: number;
  };
  monthlySeries: MonthlyReportPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  topEvents: EventReportRow[];
}

export interface RetentionDryRunSummary {
  checkedAt: string;
  supersededRetentionDays: number;
  expiredSessions: number;
  expiredDownloadGrants: number;
  expiredChallenges: number;
  expiredReplays: number;
  oldSupersededRevisions: number;
}

export interface RetentionCleanupResult {
  cleanedAt: string;
  deletedSessions: number;
  deletedDownloadGrants: number;
  deletedChallenges: number;
  deletedReplays: number;
}

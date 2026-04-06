export interface Source {
  account: string;
  calendarId: string;
}

export interface CalSyncConfig {
  sources: Source[];
  destinationAccount: string;
  destinationCalendarId: string;
  syncWindowDays: number;
  blockerSummary: string;
  blockerDescription: string;
  skipAllDay: boolean;
  skipDeclined: boolean;
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export const DEFAULT_CONFIG: CalSyncConfig = {
  sources: [],
  destinationAccount: "",
  destinationCalendarId: "primary",
  syncWindowDays: 14,
  blockerSummary: "Busy",
  blockerDescription: "Automatically synced by calsync",
  skipAllDay: true,
  skipDeclined: true,
};

export const CALSYNC_SOURCE_ID_KEY = "calsyncSourceId";
export const CALSYNC_MANAGED_KEY = "calsyncManaged";

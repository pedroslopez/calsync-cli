import { calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { CalSyncConfig, CALSYNC_SOURCE_ID_KEY } from "../types";
import { getAuthenticatedClient } from "./oauth";
import * as cal from "./calendar";

type CalendarEvent = calendar_v3.Schema$Event;

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

interface SyncAction {
  type: "create" | "update" | "delete";
  compositeId: string;
  sourceEvent?: CalendarEvent;
  blockerId?: string;
}

function compositeId(accountName: string, eventId: string): string {
  return `${accountName}:${eventId}`;
}

function eventTimeKey(event: CalendarEvent): string {
  const start = event.start?.dateTime || event.start?.date || "";
  const end = event.end?.dateTime || event.end?.date || "";
  return `${start}|${end}`;
}

function isAllDay(event: CalendarEvent): boolean {
  return !!event.start?.date && !event.start?.dateTime;
}

function isDeclined(event: CalendarEvent): boolean {
  const self = event.attendees?.find((a) => a.self);
  return self?.responseStatus === "declined";
}

function shouldInclude(event: CalendarEvent, config: CalSyncConfig): boolean {
  if (event.status === "cancelled") return false;
  if (config.skipAllDay && isAllDay(event)) return false;
  if (config.skipDeclined && isDeclined(event)) return false;
  return true;
}

export async function computeSyncActions(
  config: CalSyncConfig,
  dryRun: boolean
): Promise<{ actions: SyncAction[]; destAuth: OAuth2Client }> {
  const now = new Date();
  const timeMax = new Date(now.getTime() + config.syncWindowDays * 24 * 60 * 60 * 1000);

  // Authenticate all accounts
  const destAuth = getAuthenticatedClient(config.destinationAccount);
  const sourceAuths = new Map<string, OAuth2Client>();
  for (const source of config.sources) {
    if (!sourceAuths.has(source.account)) {
      sourceAuths.set(source.account, getAuthenticatedClient(source.account));
    }
  }

  // Fetch source events from all sources
  const sourceMap = new Map<string, CalendarEvent>();
  for (const source of config.sources) {
    const auth = sourceAuths.get(source.account)!;
    const events = await cal.listEvents(auth, source.calendarId, now, timeMax);
    console.log(`\n[${source.account}] ${events.length} events found:`);
    for (const event of events) {
      const title = event.summary || "(no title)";
      const date = event.start?.dateTime || event.start?.date || "?";
      if (!event.id || !shouldInclude(event, config)) {
        const reason = !event.id
          ? "no id"
          : event.status === "cancelled"
            ? "cancelled"
            : config.skipAllDay && isAllDay(event)
              ? "all-day"
              : config.skipDeclined && isDeclined(event)
                ? "declined"
                : "filtered";
        console.log(`  - "${title}" ${date} (skipped: ${reason})`);
        continue;
      }
      console.log(`  - "${title}" ${date}`);
      const cid = compositeId(source.account, event.id);
      sourceMap.set(cid, event);
    }
  }

  // Fetch existing blockers from destination
  const blockers = await cal.listBlockers(
    destAuth,
    config.destinationCalendarId,
    now,
    timeMax
  );
  const blockerMap = new Map<string, CalendarEvent>();
  for (const blocker of blockers) {
    const srcId = blocker.extendedProperties?.private?.[CALSYNC_SOURCE_ID_KEY];
    if (srcId && blocker.id) {
      blockerMap.set(srcId, blocker);
    }
  }

  // Compute diff
  const actions: SyncAction[] = [];

  // Create or update
  for (const [cid, sourceEvent] of sourceMap) {
    const existing = blockerMap.get(cid);
    if (!existing) {
      actions.push({ type: "create", compositeId: cid, sourceEvent });
    } else if (eventTimeKey(sourceEvent) !== eventTimeKey(existing)) {
      actions.push({
        type: "update",
        compositeId: cid,
        sourceEvent,
        blockerId: existing.id!,
      });
    }
  }

  // Delete blockers whose source no longer exists
  for (const [cid, blocker] of blockerMap) {
    if (!sourceMap.has(cid)) {
      actions.push({ type: "delete", compositeId: cid, blockerId: blocker.id! });
    }
  }

  return { actions, destAuth };
}

export async function executeSync(
  config: CalSyncConfig,
  dryRun: boolean
): Promise<SyncResult> {
  const { actions, destAuth } = await computeSyncActions(config, dryRun);
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: [] };

  if (dryRun) {
    for (const action of actions) {
      const event = action.sourceEvent;
      const title = event?.summary || "(no title)";
      const time = event
        ? `${event.start?.dateTime || event.start?.date} → ${event.end?.dateTime || event.end?.date}`
        : "";
      switch (action.type) {
        case "create":
          console.log(`  [CREATE] "${title}" ${time}`);
          result.created++;
          break;
        case "update":
          console.log(`  [UPDATE] "${title}" ${time}`);
          result.updated++;
          break;
        case "delete":
          console.log(`  [DELETE] blocker ${action.blockerId} (source removed)`);
          result.deleted++;
          break;
      }
    }
    return result;
  }

  for (const action of actions) {
    try {
      switch (action.type) {
        case "create":
          await cal.createBlocker(
            destAuth,
            config.destinationCalendarId,
            action.compositeId,
            action.sourceEvent!.start!,
            action.sourceEvent!.end!,
            config.blockerSummary,
            config.blockerDescription
          );
          result.created++;
          break;
        case "update":
          await cal.updateBlocker(
            destAuth,
            config.destinationCalendarId,
            action.blockerId!,
            action.sourceEvent!.start!,
            action.sourceEvent!.end!,
            config.blockerSummary,
            config.blockerDescription
          );
          result.updated++;
          break;
        case "delete":
          await cal.deleteBlocker(
            destAuth,
            config.destinationCalendarId,
            action.blockerId!
          );
          result.deleted++;
          break;
      }
    } catch (err: any) {
      result.errors.push(`${action.type} ${action.compositeId}: ${err.message}`);
    }
  }

  return result;
}

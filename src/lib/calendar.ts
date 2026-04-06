import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { CALSYNC_MANAGED_KEY, CALSYNC_SOURCE_ID_KEY } from "../types";

type CalendarEvent = calendar_v3.Schema$Event;

export async function listEvents(
  auth: OAuth2Client,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: "v3", auth });
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
      pageToken,
    });
    if (res.data.items) {
      events.push(...res.data.items);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}

export async function listBlockers(
  auth: OAuth2Client,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: "v3", auth });
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      privateExtendedProperty: [`${CALSYNC_MANAGED_KEY}=true`],
      maxResults: 2500,
      pageToken,
    });
    if (res.data.items) {
      events.push(...res.data.items);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}

export async function createBlocker(
  auth: OAuth2Client,
  calendarId: string,
  sourceCompositeId: string,
  start: CalendarEvent["start"],
  end: CalendarEvent["end"],
  summary: string,
  description: string
): Promise<CalendarEvent> {
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      description,
      start,
      end,
      transparency: "opaque",
      extendedProperties: {
        private: {
          [CALSYNC_SOURCE_ID_KEY]: sourceCompositeId,
          [CALSYNC_MANAGED_KEY]: "true",
        },
      },
    },
  });
  return res.data;
}

export async function updateBlocker(
  auth: OAuth2Client,
  calendarId: string,
  blockerId: string,
  start: CalendarEvent["start"],
  end: CalendarEvent["end"],
  summary: string,
  description: string
): Promise<CalendarEvent> {
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.patch({
    calendarId,
    eventId: blockerId,
    requestBody: {
      summary,
      description,
      start,
      end,
    },
  });
  return res.data;
}

export async function deleteBlocker(
  auth: OAuth2Client,
  calendarId: string,
  blockerId: string
): Promise<void> {
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({ calendarId, eventId: blockerId });
}

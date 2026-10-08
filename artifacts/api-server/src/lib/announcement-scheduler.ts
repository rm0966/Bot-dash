import { and, eq, lte } from "drizzle-orm";
import { db, scheduledAnnouncementsTable } from "@workspace/db";
import { logger } from "./logger";
import { sendGuildMessage } from "./gateway-manager";

type RepeatType = "once" | "daily" | "weekly";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const weekdayNumber: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekday: weekdayNumber[values.weekday ?? ""] ?? 0,
  };
}

function localDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = getZonedParts(new Date(candidate), timeZone);
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    );
    const correction = targetAsUtc - representedAsUtc;
    if (correction === 0) break;
    candidate += correction;
  }
  return new Date(candidate);
}

function addLocalDays(parts: ZonedParts, amount: number): Pick<ZonedParts, "year" | "month" | "day"> {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

export function nextAnnouncementTime(
  after: Date,
  scheduledTime: Date,
  repeatType: Exclude<RepeatType, "once">,
  timeZone: string
): Date {
  const time = getZonedParts(scheduledTime, timeZone);
  const now = getZonedParts(after, timeZone);
  let daysToAdd = 1;

  if (repeatType === "weekly") {
    daysToAdd = (time.weekday - now.weekday + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7;
  }

  let localDate = addLocalDays(now, daysToAdd);
  let next = localDateTimeToUtc(
    localDate.year,
    localDate.month,
    localDate.day,
    time.hour,
    time.minute,
    timeZone
  );

  if (next <= after && repeatType === "weekly") {
    localDate = addLocalDays({ ...now, weekday: time.weekday }, 7);
    next = localDateTimeToUtc(
      localDate.year,
      localDate.month,
      localDate.day,
      time.hour,
      time.minute,
      timeZone
    );
  }
  return next;
}

let schedulerTimer: ReturnType<typeof setInterval> | undefined;
let tickInProgress = false;

async function runDueAnnouncements(): Promise<void> {
  if (tickInProgress) return;
  tickInProgress = true;
  try {
    const now = new Date();
    const due = await db
      .select()
      .from(scheduledAnnouncementsTable)
      .where(and(
        eq(scheduledAnnouncementsTable.isActive, true),
        lte(scheduledAnnouncementsTable.nextRunAt, now)
      ));

    for (const announcement of due) {
      try {
        await sendGuildMessage(
          announcement.guildId,
          announcement.channelId,
          announcement.content
        );
        const nextRunAt = announcement.repeatType === "once"
          ? undefined
          : nextAnnouncementTime(
              new Date(),
              announcement.nextRunAt,
              announcement.repeatType,
              announcement.timeZone
            );
        await db
          .update(scheduledAnnouncementsTable)
          .set({
            isActive: announcement.repeatType !== "once",
            lastSentAt: new Date(),
            lastError: null,
            ...(nextRunAt ? { nextRunAt } : {}),
          })
          .where(eq(scheduledAnnouncementsTable.id, announcement.id));
        logger.info(
          { guildId: announcement.guildId, announcementId: announcement.id },
          "Scheduled Discord announcement sent"
        );
      } catch (error) {
        const lastError = error instanceof Error ? error.message.slice(0, 500) : "Unknown send error";
        await db
          .update(scheduledAnnouncementsTable)
          .set({
            nextRunAt: new Date(Date.now() + 60_000),
            lastError,
          })
          .where(eq(scheduledAnnouncementsTable.id, announcement.id));
        logger.error(
          { guildId: announcement.guildId, announcementId: announcement.id, error: lastError },
          "Scheduled Discord announcement failed"
        );
      }
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Announcement scheduler tick failed"
    );
  } finally {
    tickInProgress = false;
  }
}

export function startAnnouncementScheduler(): void {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => void runDueAnnouncements(), 20_000);
  schedulerTimer.unref?.();
  void runDueAnnouncements();
  logger.info("Scheduled announcement worker started");
}

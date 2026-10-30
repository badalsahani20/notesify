/**
 * Calculates the next daily quota reset timestamp (00:00 UTC).
 */
export function getNextDailyResetDate(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  );
}

/**
 * Returns a localized human-readable reset string automatically adapted to the user's timezone.
 * Example in India (IST): "Resets in 5h 12m (5:30 AM)"
 * Example in US (EST):    "Resets in 5h 12m (8:00 PM)"
 */
export function getDailyResetDisplay(): {
  localTime: string;
  countdown: string;
  fullText: string;
} {
  const now = new Date();
  const resetDate = getNextDailyResetDate();
  const diffMs = Math.max(0, resetDate.getTime() - now.getTime());

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const localTime = resetDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const countdown = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return {
    localTime,
    countdown,
    fullText: `Resets in ${countdown} (${localTime})`,
  };
}

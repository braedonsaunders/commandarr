export interface ParsedSchedule {
  cron: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
}

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

/**
 * Parse a 12h or 24h time string into { hour, minute }.
 * Accepts: "9", "9am", "9:30", "9:30am", "21:00", "9:30pm", "14", etc.
 */
function parseTime(timeStr: string): { hour: number; minute: number } | null {
  const cleaned = timeStr.trim().toLowerCase();

  // Match patterns like "9", "9am", "9:30", "9:30pm", "21:00", "14"
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];

  if (period === 'pm' && hour < 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

type PatternMatcher = (input: string) => ParsedSchedule | null;

const patterns: PatternMatcher[] = [
  // "at midnight"
  (input) => {
    if (/\b(at\s+)?midnight\b/.test(input)) {
      return { cron: '0 0 * * *', description: 'Every day at midnight', confidence: 'high' };
    }
    return null;
  },

  // "at noon"
  (input) => {
    if (/\b(at\s+)?noon\b/.test(input)) {
      return { cron: '0 12 * * *', description: 'Every day at noon', confidence: 'high' };
    }
    return null;
  },

  // "twice a day"
  (input) => {
    if (/\btwice\s+a\s+day\b/.test(input)) {
      return { cron: '0 9,21 * * *', description: 'Twice a day (9 AM and 9 PM)', confidence: 'high' };
    }
    return null;
  },

  // "every weekday" / "weekdays"
  (input) => {
    const match = input.match(/\b(?:every\s+)?weekday(?:s)?\b(?:\s+at\s+(.+))?/);
    if (match) {
      const time = match[1] ? parseTime(match[1]) : { hour: 9, minute: 0 };
      if (!time) return null;
      return {
        cron: `${time.minute} ${time.hour} * * 1-5`,
        description: `Every weekday at ${time.hour}:${String(time.minute).padStart(2, '0')}`,
        confidence: 'high',
      };
    }
    return null;
  },

  // "every weekend"
  (input) => {
    const match = input.match(/\b(?:every\s+)?weekend(?:s)?\b(?:\s+at\s+(.+))?/);
    if (match) {
      const time = match[1] ? parseTime(match[1]) : { hour: 10, minute: 0 };
      if (!time) return null;
      return {
        cron: `${time.minute} ${time.hour} * * 0,6`,
        description: `Every weekend at ${time.hour}:${String(time.minute).padStart(2, '0')}`,
        confidence: 'high',
      };
    }
    return null;
  },

  // "every <day-name> [at <time>]"
  (input) => {
    const match = input.match(/\bevery\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b(?:\s+at\s+(.+))?/);
    if (match) {
      const dayNum = DAY_MAP[match[1]];
      if (dayNum === undefined) return null;
      const time = match[2] ? parseTime(match[2]) : { hour: 9, minute: 0 };
      if (!time) return null;
      const dayName = Object.keys(DAY_MAP).find(k => DAY_MAP[k] === dayNum && k.length > 3) ?? match[1];
      return {
        cron: `${time.minute} ${time.hour} * * ${dayNum}`,
        description: `Every ${dayName} at ${time.hour}:${String(time.minute).padStart(2, '0')}`,
        confidence: 'high',
      };
    }
    return null;
  },

  // "every morning [at <time>]"
  (input) => {
    const match = input.match(/\bevery\s+morning\b(?:\s+at\s+(.+))?/);
    if (match) {
      const time = match[1] ? parseTime(match[1]) : { hour: 9, minute: 0 };
      if (!time) return null;
      return {
        cron: `${time.minute} ${time.hour} * * *`,
        description: `Every morning at ${time.hour}:${String(time.minute).padStart(2, '0')}`,
        confidence: 'high',
      };
    }
    return null;
  },

  // "every evening [at <time>]" / "every night [at <time>]"
  (input) => {
    const match = input.match(/\bevery\s+(?:evening|night)\b(?:\s+at\s+(.+))?/);
    if (match) {
      const time = match[1] ? parseTime(match[1]) : { hour: 21, minute: 0 };
      if (!time) return null;
      return {
        cron: `${time.minute} ${time.hour} * * *`,
        description: `Every evening at ${time.hour}:${String(time.minute).padStart(2, '0')}`,
        confidence: 'high',
      };
    }
    return null;
  },

  // "every X minutes"
  (input) => {
    const match = input.match(/\bevery\s+(\d+)\s+min(?:ute)?s?\b/);
    if (match) {
      const mins = parseInt(match[1], 10);
      if (mins < 1 || mins > 59) return null;
      return {
        cron: `*/${mins} * * * *`,
        description: `Every ${mins} minute${mins === 1 ? '' : 's'}`,
        confidence: 'high',
      };
    }
    return null;
  },

  // "every X hours"
  (input) => {
    const match = input.match(/\bevery\s+(\d+)\s+hours?\b/);
    if (match) {
      const hrs = parseInt(match[1], 10);
      if (hrs < 1 || hrs > 23) return null;
      return {
        cron: `0 */${hrs} * * *`,
        description: `Every ${hrs} hour${hrs === 1 ? '' : 's'}`,
        confidence: 'high',
      };
    }
    return null;
  },

  // "every hour" / "hourly"
  (input) => {
    if (/\b(?:every\s+hour|hourly)\b/.test(input)) {
      return { cron: '0 * * * *', description: 'Every hour', confidence: 'high' };
    }
    return null;
  },

  // "every day at <time>" / "daily at <time>" / "daily"
  (input) => {
    const match = input.match(/\b(?:every\s+day|daily)\b(?:\s+at\s+(.+))?/);
    if (match) {
      const time = match[1] ? parseTime(match[1]) : { hour: 9, minute: 0 };
      if (!time) return null;
      return {
        cron: `${time.minute} ${time.hour} * * *`,
        description: `Every day at ${time.hour}:${String(time.minute).padStart(2, '0')}`,
        confidence: 'high',
      };
    }
    return null;
  },

  // "weekly [at <time>]" / "every week [at <time>]"
  (input) => {
    const match = input.match(/\b(?:weekly|every\s+week)\b(?:\s+at\s+(.+))?/);
    if (match) {
      const time = match[1] ? parseTime(match[1]) : { hour: 9, minute: 0 };
      if (!time) return null;
      return {
        cron: `${time.minute} ${time.hour} * * 1`,
        description: `Every Monday at ${time.hour}:${String(time.minute).padStart(2, '0')}`,
        confidence: 'high',
      };
    }
    return null;
  },

  // "at <time>" (fallback — every day at that time)
  (input) => {
    const match = input.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/);
    if (match) {
      const time = parseTime(match[1]);
      if (!time) return null;
      return {
        cron: `${time.minute} ${time.hour} * * *`,
        description: `Every day at ${time.hour}:${String(time.minute).padStart(2, '0')}`,
        confidence: 'medium',
      };
    }
    return null;
  },
];

/**
 * Parse a natural language schedule description into a cron expression.
 * Returns null if the input cannot be parsed.
 */
export function parseNaturalSchedule(input: string): ParsedSchedule | null {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return null;

  for (const matcher of patterns) {
    const result = matcher(normalized);
    if (result) return result;
  }

  return null;
}

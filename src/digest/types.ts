// Plan morning-digest § 1. The contract every part of § 2 builds on.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's night, folded from its lines in runs/<night>.jsonl. */
export type DigestRow = {
  job: string;
  /** Last owner seen for the job. `null` stays `null`; views render it as `—`. */
  owner: string | null;
  /** Lines logged for the job. */
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  /** Lines with status `fail`. */
  fails: number;
  lastStatus: RunStatus;
  /** Most recent `error` logged for the job, or `null` if it never logged one. */
  lastError: string | null;
  /** `at` exactly as logged, offset kept (styleguide: never convert to UTC). */
  firstAt: string;
  lastAt: string;
};

export type StatusCounts = Record<RunStatus, number>;

export type Night = {
  night: string;
  /** Sorted by job. Empty when nothing ran. */
  rows: DigestRow[];
  /** Lines per status, over every line that parsed. */
  counts: StatusCounts;
  /** Lines that didn't parse: counted, never thrown. */
  badLines: number;
};

/** A night is `YYYY-MM-DD`. Anything else is not a night (and never reaches the disk). */
export const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads `runs/<night>.jsonl`. Returns `null` when the night has no file (or isn't a night),
 * so routes can answer 404.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;

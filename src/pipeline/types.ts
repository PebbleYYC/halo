// Stored shapes: the daily_scores JSON columns the queries read, and the options both stages take.
import type { ReasonCode } from "@/lib/reasons";
import type { ChargeDriver } from "@/core/scoring/drivers";
import type { RecoveryForecast } from "@/core/scoring/forecast";
import type { HrRecoveryResult } from "@/core/scoring/hrRecovery";
import type { BaselineState } from "@/core/scoring/types";
import type { Drain, EnergyBand } from "@/core/algorithms/energyBank";
import type { FitnessCategory, FitnessEstimate } from "@/core/algorithms/fitnessLevel";
import type { HealthMonitorResult } from "@/core/algorithms/healthMonitor";
import type { HealthspanResult } from "@/core/algorithms/healthspan";
import type { TagImpact } from "@/core/algorithms/journalImpact";
import type { SleepPlan } from "@/core/algorithms/sleepPlanner";
import type { Interval } from "@/core/algorithms/stress";
import type { HrvStatus } from "@/core/algorithms/hrvStatus";
import type { PrimaryBenefit, TeLabel } from "@/core/algorithms/trainingEffect";
import type { TrainingReadiness } from "@/core/algorithms/trainingReadiness";
import type { TrainingStatus } from "@/core/algorithms/trainingStatus";
import type { StrainTarget } from "@/core/algorithms/strainTarget";
import type { RestingHrSource } from "./restingHr";

/** Bump on any scoring change; a mismatch at startup rescores every day. What each bump changed is in git log. */
export const SCORING_VERSION = 19;

export type PipelineOptions = {
  timeZone: string;
  /** `waistCm` (mobile): optional, for the Nes 2011 VO2max estimate (fitnessLevel.ts). */
  profile: { birthDate: string; sex: "male" | "female"; maxHr: number; heightCm?: number | null; waistCm?: number | null };
};

export type BaselineSummary = { mean: number; sd: number; status: BaselineState["status"]; nValid: number } | null;

/** Stage 1, `daily_scores.strain`. */
export type Stage1Day = {
  /** Hash of the non-sample inputs; a change reruns stage 1 for the day. */
  key: string;
  hrCount: number;
  /** Minutes with HR before and after local noon (SRI coverage). */
  hrMinutesAm: number;
  hrMinutesPm: number;
  lastHrTs: number | null;
  restingHr: number;
  /**
   * Google's daily resting HR first, then Halo's sleep-session estimate; then (mobile) the newest of either from the
   * 30 days before, an estimate from the day's own still HR, and 60 bpm (src/pipeline/restingHr.ts).
   */
  restingHrSource: RestingHrSource;
  maxHr: number;
  /** Effort 0–100 (Day Strain × 100 / 21), or null with too little HR. */
  effort: number | null;
  /**
   * The day's load in Banister TRIMP (version 15): heart rate above the waking floor outside workouts, all of it inside
   * them, plus the workouts' muscular load; what Day Strain maps and training load sums. Absent on older rows.
   */
  trimp?: number | null;
  /** This day's own median still waking heart rate as a share of the reserve (later days' floors read it); null with under 30 such minutes. */
  wakingHrr?: number | null;
  /** The waking floor Day Strain used, a share of the reserve (strain.ts). */
  floorHrr?: number;
  /** Zones 1–5 on heart-rate reserve: lower bounds (bpm) and seconds. */
  zoneLower: number[];
  zoneSeconds: number[];
  /** Seconds below Zone 1 ("Zone 0"); absent on days stored before version 9. */
  zoneBelowSeconds?: number;
  /**
   * Mobile, versions 10–14: seconds at 40–50 % of heart-rate reserve (ACSM moderate, then inside Zone 0), which Halo
   * Age's moderate-activity input added to zones 1–3. Not written since version 15, whose Zone 1 starts at 40 %.
   */
  moderateSeconds?: number;
  /**
   * Mobile: Halo Age's zone time as [40–80 %, ≥ 80 % of heart-rate reserve] seconds, counted only inside a workout or in
   * a bout of 10 minutes or more (healthspan.ts zoneBoutSeconds); absent on rows stored before the bout rule.
   */
  boutZoneSeconds?: [number, number] | [number, number, number];
  /**
   * Version 16: last night's Sleep Stress (sleepStress.ts), % of its asleep minutes with heart rate in a high-stress state,
   * and how many such minutes there were; null without stages or heart rate.
   */
  sleepStress?: { pct: number; minutes: number } | null;
  /** Stress Monitor's resting daytime HR for the day (independent of the baseline). */
  dayAggregate: number | null;
  stillMinutes: number;
};

/** Stage 1, `daily_scores.activities`. */
export type Stage1Activity = {
  id: string;
  /** Activity Strain as Effort 0–100: the session's cardio TRIMP (no waking floor) plus its muscular TRIMP. */
  effort: number | null;
  /** Version 15: the heart-rate part of the session's load, Banister TRIMP; null with too little HR. */
  cardioTrimp?: number | null;
  /** Version 15: the muscular part (strength-type sessions, strain.ts muscularTrimp); 0 for other types. */
  muscularTrimp?: number;
  /** Version 19: peak EPOC, ml/kg (trainingEffect.ts), on `vo2max`; null with too little HR. */
  epocPeak?: number | null;
  vo2max?: number;
  /** Version 19: seconds under 80 %, at 80 % and over, and over 90 % of max HR (Training Effect's primary benefit). */
  maxHrSeconds?: { below80: number; from80: number; above90: number } | null;
  hrCount: number;
  avgHr: number | null;
  maxHr: number | null;
  zoneSeconds: number[];
  zoneBelowSeconds?: number;
  hrr: HrRecoveryResult | null;
};

export type RecoveryRow = {
  value: number | null;
  reason: ReasonCode | null;
  nightsLeft?: number;
  provisional: boolean;
  /** Inputs whose baseline is stale today. */
  stale: string[];
  /** Terms the score used (respiratory rate counts only when raised; skin temperature not since version 17). */
  terms: string[];
  /** The score gained a term after it was first shown. */
  updated: boolean;
  inputs: { hrv: number | null; rhr: number | null; resp: number | null; sleepPerf: number | null; skinTempDev: number | null };
  baselines: { hrv: BaselineSummary; rhr: BaselineSummary; resp: BaselineSummary; skinTemp: BaselineSummary };
  /** Last night's HRV z as Recovery scored it: ln(ms) against the ln baseline since version 17. */
  hrvZ: number | null;
  drivers: ChargeDriver[];
  forecast: RecoveryForecast | null;
  forecastNightsLeft: number;
};

export type SleepRow = {
  reason: ReasonCode | null;
  main: {
    id: string;
    start: number;
    end: number;
    processed: boolean;
    staged: boolean;
    inBedMin: number;
    asleepMin: number;
    awakeMin: number;
    deepMin: number | null;
    remMin: number | null;
    lightMin: number | null;
    efficiency: number;
    wakeEvents: number | null;
    /** Version 16: minutes from getting into bed to the first sleep (staged nights), else null. */
    latencyMin?: number | null;
  } | null;
  naps: { id: string; start: number; end: number; asleepMin: number }[];
  /** 0–100: WHOOP's 2025 four parts (sleep.ts sleepPerformance) since version 16. */
  performance: number | null;
  /** Version 16: the four parts on 0–100 (null where the input was missing); null without a score. */
  parts?: { hours: number; consistency: number | null; efficiency: number; stress: number | null } | null;
  /** The personalised baseline need (upper quartile of 28 nights), hours; the debt ledger's need. */
  needHours: number;
  /** Version 16: the night's full need it was scored against (the evening's plan: baseline + strain + debt − naps), minutes. */
  needMin?: number;
  needNights: number;
  /** Main sleep plus yesterday's naps, the debt ledger's night. */
  creditedMin: number | null;
  debtMin: number;
  /** Raw SRI on [−100, 100] over the 7 nights ending on D (Halo Age's sleep-regularity input). */
  sri: number | null;
  /**
   * 0–100: since version 16, WHOOP-style Sleep Consistency (the last 24 hours against each of the 4 days before,
   * sleepRegularity.ts laggedPairs); before, the 7-day SRI's display value.
   */
  consistency: number | null;
  /** Version 16: Sleep Stress, % of last night's asleep minutes in a high-stress state (sleepStress.ts); null without one. */
  stressPct?: number | null;
};

export type StressRow = {
  provisional: boolean;
  average: number | null;
  lowMin: number;
  mediumMin: number;
  highMin: number;
  latest: { ts: number; value: number } | null;
  longestHigh: { start: number; minutes: number } | null;
  referenceHr: number | null;
};

export type EnergyBankRow =
  | { value: null; reason: ReasonCode; provisional: boolean }
  | {
      value: number;
      reason: null;
      provisional: boolean;
      /** The level at wake. */
      startLevel: number;
      wake: number;
      until: number;
      /** Points gained (sleep, calm minutes) and lost (negative), before the 5–100 clamp. */
      charged: number;
      drained: number;
      topDrains: Drain[];
      naps: Interval[];
      /** Version 18: where the curve starts (local midnight when it carries on from yesterday, else wake) and its level there. */
      from?: number;
      fromLevel?: number;
      /** Version 18: Garmin's Body Battery band of `value`. */
      band?: EnergyBand;
    };

export type TrainingLoadRow = {
  /** Acute ÷ chronic load (Garmin's Load Ratio, readiness.ts), or null. */
  acwr: number | null;
  /** Version 18: Garmin-style acute load (10-day decaying, normalised to 7 days) and chronic load (28-day mean of it), TRIMP. */
  acute?: number | null;
  chronic?: number | null;
  /** ACWR over the days before D (what Strain Target uses). */
  acwrPrior: number | null;
  monotony: number | null;
  level: string;
  state: string;
  contiguousDays: number;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
};

export type StrainTargetRow = ({ reason: null } & StrainTarget) | { reason: ReasonCode; nightsLeft?: number };

export type SleepPlannerRow =
  | ({ reason: null; wakeDay: string; nights: number } & SleepPlan)
  | { reason: ReasonCode; nightsLeft?: number; needMin: number };

export type HealthMonitorRow = (HealthMonitorResult & { reason: null; stale: string[] }) | { reason: ReasonCode };

/**
 * `fitnessEstimate` (mobile): Fitness Age and Halo's own VO2max estimate for the day, shown on Fitness. Since version 18
 * `paceOfAging` is the weekly value (published on Mondays, with 21 of the last 31 days scored for Recovery; `paceDays`
 * counts those days), `paceDaily` the day's own and `paceAsOf` the Monday it was published.
 */
export type HealthspanRow = ((HealthspanResult & { reason: null; age: number; paceDaily?: number | null; paceAsOf?: string | null }) | { reason: ReasonCode; dataDays: number }) & {
  fitnessEstimate?: FitnessEstimate | null;
};

export type FitnessRow =
  | { reason: null; vo2max: number; source: "run" | "daily"; sourceDay: string; percentile: number; category: FitnessCategory; age: number }
  | { reason: ReasonCode };

export type JournalImpactRow = { key: string; impacts: TagImpact[] };

/** Version 19: HRV Status (hrvStatus.ts), Garmin-style: the 7-day average against your baseline band. */
export type HrvStatusRow = HrvStatus;

/** Version 19: one workout's Garmin-style Aerobic Training Effect (trainingEffect.ts). */
export type TrainingSession = {
  id: string;
  /** 0–5, one decimal. */
  te: number;
  label: TeLabel;
  benefit: PrimaryBenefit;
  /** Peak EPOC, ml/kg. */
  epoc: number;
  /** Hours of Recovery Time it added on its own (before combining with what was left). */
  recoveryHours: number;
  /** Its end, unix seconds. */
  end: number;
};

/**
 * Version 19, `daily_scores.training`: Garmin-style training answers for the day. Recovery Time in hours at wake and at
 * `until` (the day's end, or the last heart rate today); Training Readiness at wake and now; Training Status.
 */
export type TrainingRow = {
  /** Activity class 0–10, what Training Effect is judged against. */
  activityClass: number;
  sessions: TrainingSession[];
  recoveryTime: { atWake: number; now: number; until: number };
  readiness: ({ reason: null; atWake: TrainingReadiness | null } & TrainingReadiness) | { reason: ReasonCode };
  status: ({ reason: null } & TrainingStatus) | { reason: ReasonCode };
};

/** One day's stage-2 columns, keyed by their daily_scores column name. */
export type Stage2Row = {
  recovery: RecoveryRow;
  sleep: SleepRow;
  training_load: TrainingLoadRow;
  strain_target: StrainTargetRow;
  sleep_planner: SleepPlannerRow;
  energy_bank: EnergyBankRow;
  stress: StressRow;
  health_monitor: HealthMonitorRow;
  healthspan: HealthspanRow;
  fitness: FitnessRow;
  journal_impact: JournalImpactRow;
  hrv_status: HrvStatusRow;
  training: TrainingRow;
};

/** Every Stage2Row key, once: `satisfies` fails the build when a column is added to one and not the other. */
export const STAGE2_COLUMNS = Object.keys({
  recovery: 1,
  sleep: 1,
  training_load: 1,
  strain_target: 1,
  sleep_planner: 1,
  energy_bank: 1,
  stress: 1,
  health_monitor: 1,
  healthspan: 1,
  fitness: 1,
  journal_impact: 1,
  hrv_status: 1,
  training: 1,
} satisfies Record<keyof Stage2Row, 1>) as (keyof Stage2Row)[];

// Screen view-model queries ported from the web app: each takes a QueryCtx (ctx.ts), reads the Store and returns the
// web's VM shapes (types.ts) unchanged, so the ported UI consumes them as is.
export type { QueryCtx } from "./ctx";
export * from "./types";
export {
  type DayRow,
  type ExerciseRow,
  type MetricsRow,
  ACTIVITY_NAME,
  activityItem,
  activityKind,
  distanceOf,
  firstDay,
  lastStored,
  loadDays,
  loadSeries,
  maxHrOf,
  recoveryMetric,
  sleepMetric,
  strainMetric,
  stressNow,
  timeline,
  timelineOf,
  todayOf,
} from "./common";
export { getHome, type HomeOptions, VITAL_LABEL, REVIEW_FROM_MIN, dashboardDefault, dashboardKeys, keyStats, illnessRaised, latestReport } from "./home";
export { getRecovery, driverItems, driverLabel, contributors, insightOf as recoveryInsight } from "./recovery";
export { getSleep, nightHrOf, consistencyOf, insightOf as sleepInsight } from "./sleep";
export { getStrain, STRAIN_EXTRAS, calorieSplit, coach, zoneBounds, zoneNote, zoneRows, hrChart, hrChartOf } from "./strain";
export { getActivities, ACTIVITY_PAGE_DAYS } from "./activities";
export { getActivity, withTypical } from "./activity";
export {
  getTraining,
  getHrvStatus,
  trainingEffectVM,
  type TrainingVM,
  type TrainingReadinessVM,
  type RecoveryTimeVM,
  type TrainingStatusVM,
  type TrainingEffectVM,
  type HrvStatusVM,
} from "./training";
export { getHealthHub, getHealth, getHealthspan, getMonitor, getStress, getFitness, getHeartRate, hrMinutes, acwrStatus, ECG_RESULT, NO_RESULT } from "./health";
export { getTrends, parseTrendMetric, TREND_GROUPS, TREND_METRICS, type TrendGroup, type TrendMetric, type TrendMetricKey, type TrendsVM } from "./trends";
export {
  getMetricDetail,
  getMetric,
  DETAIL_KEYS,
  isDetailKey,
  rangeStats,
  STEP_TARGET,
  WEEKLY_TARGET,
  type DetailKey,
  type Extreme,
  type Hour,
  type MetricDetailVM,
  type MetricVM,
  type Point,
  type RangeStats,
  type Section,
} from "./metric";
export { getCalendarMonth, MONTH } from "./calendar";
export {
  type DashboardKey,
  type BodyKey,
  type ExtraKey,
  type ExtraMetric,
  type FormatKey,
  type TrendRange,
  type LoggedEntry,
  type LogType,
  DASHBOARD_DEFAULT,
  DASHBOARD_GROUPS,
  DASHBOARD_LABEL,
  DASHBOARD_METRICS,
  BODY_METRICS,
  EXTRA_KEYS,
  EXTRA_METRICS,
  PHONE_DEFAULT,
  PHONE_STATS,
  RANGE_DAYS,
  RANGES,
  isDashboardKey,
  extraMetric,
  metricHref,
} from "./_lib";

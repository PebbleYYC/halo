// Workout names as Fitbit writes them (mobile). Fitbit's app names a workout by its exercise ("Weights", "Spinning",
// "Interval Workout"); Health Connect carries a type code and, from Fitbit, usually that name as the title. Halo shows
// the title when there is one, else Fitbit's name for the type, and the editor offers Fitbit's list.

/** Fitbit's exercise list, in the order its picker shows the common ones, each with its Health Connect type. */
export const FITBIT_EXERCISES: { label: string; type: string }[] = [
  { label: "Walk", type: "WALKING" },
  { label: "Run", type: "RUNNING" },
  { label: "Treadmill", type: "RUNNING_TREADMILL" },
  { label: "Hike", type: "HIKING" },
  { label: "Outdoor Bike", type: "BIKING" },
  { label: "Spinning", type: "BIKING_STATIONARY" },
  { label: "Weights", type: "WEIGHTLIFTING" },
  { label: "Strength Training", type: "STRENGTH_TRAINING" },
  { label: "Interval Workout", type: "HIGH_INTENSITY_INTERVAL_TRAINING" },
  { label: "Circuit Training", type: "CALISTHENICS" },
  { label: "Bootcamp", type: "BOOT_CAMP" },
  { label: "Aerobic Workout", type: "EXERCISE_CLASS" },
  { label: "Elliptical", type: "ELLIPTICAL" },
  { label: "Stairclimber", type: "STAIR_CLIMBING_MACHINE" },
  { label: "Rowing Machine", type: "ROWING_MACHINE" },
  { label: "Swim", type: "SWIMMING_POOL" },
  { label: "Open Water Swim", type: "SWIMMING_OPEN_WATER" },
  { label: "Yoga", type: "YOGA" },
  { label: "Pilates", type: "PILATES" },
  { label: "Stretching", type: "STRETCHING" },
  { label: "Dancing", type: "DANCING" },
  { label: "Martial Arts", type: "MARTIAL_ARTS" },
  { label: "Kickboxing", type: "BOXING" },
  { label: "Hockey", type: "ICE_HOCKEY" },
  { label: "Skating", type: "ICE_SKATING" },
  { label: "Skiing", type: "SKIING" },
  { label: "Snowboarding", type: "SNOWBOARDING" },
  { label: "Snowshoeing", type: "SNOWSHOEING" },
  { label: "Basketball", type: "BASKETBALL" },
  { label: "Soccer", type: "SOCCER" },
  { label: "Volleyball", type: "VOLLEYBALL" },
  { label: "Tennis", type: "TENNIS" },
  { label: "Pickleball", type: "RACQUETBALL" },
  { label: "Badminton", type: "BADMINTON" },
  { label: "Golf", type: "GOLF" },
  { label: "Climbing", type: "ROCK_CLIMBING" },
  { label: "Rowing", type: "ROWING" },
  { label: "Paddling", type: "PADDLING" },
  { label: "Workout", type: "OTHER_WORKOUT" },
];

const LABEL = new Map(FITBIT_EXERCISES.map((e) => [e.type, e.label]));

/** "ICE_HOCKEY" → "Ice hockey", for a type Fitbit's list doesn't name. */
const pretty = (type: string) => {
  const s = type.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Fitbit's name for a Health Connect exercise type. */
export const typeLabel = (type: string) => LABEL.get(type) ?? pretty(type);

/** A workout's name as Fitbit shows it: its own title, else its type's name. */
export const workoutName = (e: { type: string; name: string | null }) => e.name?.trim() || typeLabel(e.type);

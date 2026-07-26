import type { Equipment, Muscle, TrackingType } from "./schema";

export type SeedExercise = {
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles?: Muscle[];
  equipment: Equipment;
  trackingType?: TrackingType;
};

/**
 * Built-in exercise library (ownerId = null). Kept deliberately close to the
 * movements people actually log — a 1000-entry library makes search worse,
 * not better, and users can add their own anyway.
 */
export const SEED_EXERCISES: SeedExercise[] = [
  // ---- Chest ----
  { name: "Bench Press (Barbell)", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], equipment: "barbell" },
  { name: "Bench Press (Dumbbell)", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], equipment: "dumbbell" },
  { name: "Incline Bench Press (Barbell)", primaryMuscle: "chest", secondaryMuscles: ["shoulders", "triceps"], equipment: "barbell" },
  { name: "Incline Bench Press (Dumbbell)", primaryMuscle: "chest", secondaryMuscles: ["shoulders", "triceps"], equipment: "dumbbell" },
  { name: "Decline Bench Press (Barbell)", primaryMuscle: "chest", secondaryMuscles: ["triceps"], equipment: "barbell" },
  { name: "Chest Press (Machine)", primaryMuscle: "chest", secondaryMuscles: ["triceps"], equipment: "machine" },
  { name: "Chest Fly (Dumbbell)", primaryMuscle: "chest", equipment: "dumbbell" },
  { name: "Cable Fly", primaryMuscle: "chest", equipment: "cable" },
  { name: "Pec Deck", primaryMuscle: "chest", equipment: "machine" },
  { name: "Push Up", primaryMuscle: "chest", secondaryMuscles: ["triceps", "abs"], equipment: "bodyweight", trackingType: "reps" },
  { name: "Dip (Chest)", primaryMuscle: "chest", secondaryMuscles: ["triceps"], equipment: "bodyweight", trackingType: "reps" },

  // ---- Back ----
  { name: "Deadlift (Barbell)", primaryMuscle: "back", secondaryMuscles: ["hamstrings", "glutes", "traps"], equipment: "barbell" },
  { name: "Romanian Deadlift (Barbell)", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes", "back"], equipment: "barbell" },
  { name: "Pull Up", primaryMuscle: "lats", secondaryMuscles: ["biceps", "back"], equipment: "bodyweight", trackingType: "reps" },
  { name: "Chin Up", primaryMuscle: "lats", secondaryMuscles: ["biceps"], equipment: "bodyweight", trackingType: "reps" },
  { name: "Lat Pulldown (Cable)", primaryMuscle: "lats", secondaryMuscles: ["biceps"], equipment: "cable" },
  { name: "Seated Row (Cable)", primaryMuscle: "back", secondaryMuscles: ["biceps", "lats"], equipment: "cable" },
  { name: "Bent Over Row (Barbell)", primaryMuscle: "back", secondaryMuscles: ["lats", "biceps"], equipment: "barbell" },
  { name: "Bent Over Row (Dumbbell)", primaryMuscle: "back", secondaryMuscles: ["lats", "biceps"], equipment: "dumbbell" },
  { name: "T-Bar Row", primaryMuscle: "back", secondaryMuscles: ["lats", "biceps"], equipment: "barbell" },
  { name: "Chest Supported Row (Machine)", primaryMuscle: "back", secondaryMuscles: ["lats"], equipment: "machine" },
  { name: "Straight Arm Pulldown", primaryMuscle: "lats", equipment: "cable" },
  { name: "Face Pull", primaryMuscle: "shoulders", secondaryMuscles: ["traps", "back"], equipment: "cable" },
  { name: "Shrug (Barbell)", primaryMuscle: "traps", equipment: "barbell" },
  { name: "Shrug (Dumbbell)", primaryMuscle: "traps", equipment: "dumbbell" },
  { name: "Back Extension", primaryMuscle: "back", secondaryMuscles: ["glutes", "hamstrings"], equipment: "bodyweight", trackingType: "reps" },

  // ---- Shoulders ----
  { name: "Overhead Press (Barbell)", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: "barbell" },
  { name: "Overhead Press (Dumbbell)", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: "dumbbell" },
  { name: "Arnold Press", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: "dumbbell" },
  { name: "Shoulder Press (Machine)", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: "machine" },
  { name: "Lateral Raise (Dumbbell)", primaryMuscle: "shoulders", equipment: "dumbbell" },
  { name: "Lateral Raise (Cable)", primaryMuscle: "shoulders", equipment: "cable" },
  { name: "Rear Delt Fly (Dumbbell)", primaryMuscle: "shoulders", secondaryMuscles: ["back"], equipment: "dumbbell" },
  { name: "Rear Delt Fly (Machine)", primaryMuscle: "shoulders", equipment: "machine" },
  { name: "Front Raise (Dumbbell)", primaryMuscle: "shoulders", equipment: "dumbbell" },
  { name: "Upright Row (Barbell)", primaryMuscle: "shoulders", secondaryMuscles: ["traps"], equipment: "barbell" },

  // ---- Arms ----
  { name: "Bicep Curl (Barbell)", primaryMuscle: "biceps", equipment: "barbell" },
  { name: "Bicep Curl (Dumbbell)", primaryMuscle: "biceps", equipment: "dumbbell" },
  { name: "Hammer Curl (Dumbbell)", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "dumbbell" },
  { name: "Preacher Curl", primaryMuscle: "biceps", equipment: "barbell" },
  { name: "Incline Curl (Dumbbell)", primaryMuscle: "biceps", equipment: "dumbbell" },
  { name: "Cable Curl", primaryMuscle: "biceps", equipment: "cable" },
  { name: "Concentration Curl", primaryMuscle: "biceps", equipment: "dumbbell" },
  { name: "Tricep Pushdown (Cable)", primaryMuscle: "triceps", equipment: "cable" },
  { name: "Overhead Tricep Extension (Dumbbell)", primaryMuscle: "triceps", equipment: "dumbbell" },
  { name: "Skull Crusher (Barbell)", primaryMuscle: "triceps", equipment: "barbell" },
  { name: "Close Grip Bench Press", primaryMuscle: "triceps", secondaryMuscles: ["chest"], equipment: "barbell" },
  { name: "Dip (Triceps)", primaryMuscle: "triceps", secondaryMuscles: ["chest"], equipment: "bodyweight", trackingType: "reps" },
  { name: "Tricep Kickback", primaryMuscle: "triceps", equipment: "dumbbell" },
  { name: "Wrist Curl", primaryMuscle: "forearms", equipment: "dumbbell" },
  { name: "Farmer's Walk", primaryMuscle: "forearms", secondaryMuscles: ["traps", "abs"], equipment: "dumbbell", trackingType: "weight_time" },

  // ---- Legs ----
  { name: "Squat (Barbell)", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], equipment: "barbell" },
  { name: "Front Squat (Barbell)", primaryMuscle: "quads", secondaryMuscles: ["glutes", "abs"], equipment: "barbell" },
  { name: "Squat (Smith Machine)", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "smith" },
  { name: "Hack Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "machine" },
  { name: "Leg Press", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], equipment: "machine" },
  { name: "Bulgarian Split Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "dumbbell" },
  { name: "Lunge (Dumbbell)", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "dumbbell" },
  { name: "Goblet Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "dumbbell" },
  { name: "Leg Extension", primaryMuscle: "quads", equipment: "machine" },
  { name: "Leg Curl (Lying)", primaryMuscle: "hamstrings", equipment: "machine" },
  { name: "Leg Curl (Seated)", primaryMuscle: "hamstrings", equipment: "machine" },
  { name: "Good Morning", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes", "back"], equipment: "barbell" },
  { name: "Hip Thrust (Barbell)", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings"], equipment: "barbell" },
  { name: "Glute Bridge", primaryMuscle: "glutes", equipment: "bodyweight", trackingType: "reps" },
  { name: "Cable Kickback", primaryMuscle: "glutes", equipment: "cable" },
  { name: "Hip Abduction (Machine)", primaryMuscle: "glutes", equipment: "machine" },
  { name: "Calf Raise (Standing)", primaryMuscle: "calves", equipment: "machine" },
  { name: "Calf Raise (Seated)", primaryMuscle: "calves", equipment: "machine" },
  { name: "Calf Press (Leg Press)", primaryMuscle: "calves", equipment: "machine" },

  // ---- Core ----
  { name: "Plank", primaryMuscle: "abs", secondaryMuscles: ["obliques"], equipment: "bodyweight", trackingType: "time" },
  { name: "Hanging Leg Raise", primaryMuscle: "abs", equipment: "bodyweight", trackingType: "reps" },
  { name: "Cable Crunch", primaryMuscle: "abs", equipment: "cable" },
  { name: "Crunch", primaryMuscle: "abs", equipment: "bodyweight", trackingType: "reps" },
  { name: "Sit Up", primaryMuscle: "abs", equipment: "bodyweight", trackingType: "reps" },
  { name: "Russian Twist", primaryMuscle: "obliques", secondaryMuscles: ["abs"], equipment: "plate", trackingType: "reps" },
  { name: "Ab Wheel Rollout", primaryMuscle: "abs", equipment: "other", trackingType: "reps" },
  { name: "Side Plank", primaryMuscle: "obliques", equipment: "bodyweight", trackingType: "time" },
  { name: "Woodchopper (Cable)", primaryMuscle: "obliques", equipment: "cable" },

  // ---- Olympic / full body ----
  { name: "Power Clean", primaryMuscle: "full_body", secondaryMuscles: ["traps", "quads", "back"], equipment: "barbell" },
  { name: "Clean and Jerk", primaryMuscle: "full_body", secondaryMuscles: ["shoulders", "quads"], equipment: "barbell" },
  { name: "Snatch", primaryMuscle: "full_body", secondaryMuscles: ["shoulders", "traps"], equipment: "barbell" },
  { name: "Kettlebell Swing", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings", "back"], equipment: "kettlebell" },
  { name: "Thruster", primaryMuscle: "full_body", secondaryMuscles: ["quads", "shoulders"], equipment: "barbell" },
  { name: "Burpee", primaryMuscle: "full_body", equipment: "bodyweight", trackingType: "reps" },

  // ---- Cardio / conditioning (interval-friendly) ----
  { name: "Treadmill Run", primaryMuscle: "cardio", equipment: "machine", trackingType: "distance_time" },
  { name: "Cycling", primaryMuscle: "cardio", equipment: "machine", trackingType: "distance_time" },
  { name: "Rowing Machine", primaryMuscle: "cardio", secondaryMuscles: ["back"], equipment: "machine", trackingType: "distance_time" },
  { name: "Stair Climber", primaryMuscle: "cardio", equipment: "machine", trackingType: "time" },
  { name: "Elliptical", primaryMuscle: "cardio", equipment: "machine", trackingType: "distance_time" },
  { name: "Jump Rope", primaryMuscle: "cardio", secondaryMuscles: ["calves"], equipment: "other", trackingType: "time" },
  { name: "Battle Ropes", primaryMuscle: "cardio", secondaryMuscles: ["shoulders"], equipment: "other", trackingType: "time" },
  { name: "Mountain Climbers", primaryMuscle: "abs", secondaryMuscles: ["cardio"], equipment: "bodyweight", trackingType: "time" },
  { name: "Sled Push", primaryMuscle: "quads", secondaryMuscles: ["glutes", "cardio"], equipment: "other", trackingType: "weight_time" },
];

export type SeedAchievement = {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: number;
};

/**
 * `icon` is a lucide-react icon name, resolved client-side. Keep keys stable —
 * they're the primary key and unlocks reference them.
 */
export const SEED_ACHIEVEMENTS: SeedAchievement[] = [
  { key: "first_workout", title: "First Rep", description: "Complete your first workout", icon: "Sparkles", tier: 1 },
  { key: "workouts_10", title: "Regular", description: "Complete 10 workouts", icon: "CalendarCheck", tier: 1 },
  { key: "workouts_50", title: "Committed", description: "Complete 50 workouts", icon: "Flame", tier: 2 },
  { key: "workouts_100", title: "Century", description: "Complete 100 workouts", icon: "Trophy", tier: 3 },
  { key: "streak_7", title: "Seven Straight", description: "Train 7 days in a row", icon: "Zap", tier: 2 },
  { key: "streak_30", title: "Unbroken", description: "Train 30 days in a row", icon: "Crown", tier: 3 },
  { key: "volume_10k", title: "Ten Tonne", description: "Lift 10,000 kg in one workout", icon: "Weight", tier: 2 },
  { key: "volume_1m", title: "Millionaire", description: "Lift 1,000,000 kg all-time", icon: "Gem", tier: 3 },
  { key: "pr_first", title: "New Best", description: "Set your first personal record", icon: "TrendingUp", tier: 1 },
  { key: "pr_25", title: "Record Breaker", description: "Set 25 personal records", icon: "Medal", tier: 2 },
  { key: "early_bird", title: "Early Bird", description: "Finish a workout before 7am", icon: "Sunrise", tier: 1 },
  { key: "night_owl", title: "Night Owl", description: "Finish a workout after 10pm", icon: "Moon", tier: 1 },
  { key: "social_first_friend", title: "Gym Buddy", description: "Add your first friend", icon: "UserPlus", tier: 1 },
  { key: "social_coop", title: "Better Together", description: "Finish a co-op workout", icon: "Users", tier: 2 },
  { key: "marathon", title: "Marathon", description: "Train for over two hours in one session", icon: "Hourglass", tier: 2 },
  { key: "all_muscles_week", title: "Full Coverage", description: "Hit every major muscle group in one week", icon: "Target", tier: 3 },
];

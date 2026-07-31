import type { SeedAchievement } from "./types";

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

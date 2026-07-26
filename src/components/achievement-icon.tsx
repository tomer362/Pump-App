"use client";

import {
  Sparkles,
  CalendarCheck,
  Flame,
  Trophy,
  Zap,
  Crown,
  Weight,
  Gem,
  TrendingUp,
  Medal,
  Sunrise,
  Moon,
  UserPlus,
  Users,
  Hourglass,
  Target,
  Award,
} from "lucide-react";

/**
 * Achievements store a lucide icon name in the database; this maps it to a
 * component. An explicit map (rather than a dynamic import) keeps the icon set
 * tree-shakeable and guarantees every key renders something.
 */
const ICONS = {
  Sparkles,
  CalendarCheck,
  Flame,
  Trophy,
  Zap,
  Crown,
  Weight,
  Gem,
  TrendingUp,
  Medal,
  Sunrise,
  Moon,
  UserPlus,
  Users,
  Hourglass,
  Target,
} as const;

export function AchievementIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Award;
  return <Icon className={className} strokeWidth={2.2} />;
}

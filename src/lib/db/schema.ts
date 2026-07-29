import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ==========================================================================
   Better Auth tables. Field names are dictated by better-auth's core schema —
   do not rename them. Only `user` carries extra app columns (see below).
   ========================================================================== */

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

    /* --- App-specific profile columns --- */
    // Public handle used for search and @-style profile URLs.
    username: text("username").unique(),
    bio: text("bio"),
    // Stored weights are ALWAYS kilograms; this is a display preference only.
    unit: text("unit", { enum: ["kg", "lb"] }).default("kg").notNull(),
    defaultRestSeconds: integer("default_rest_seconds").default(120).notNull(),
    homeGymId: uuid("home_gym_id"),
    onboardedAt: timestamp("onboarded_at"),
  },
  (t) => [index("user_username_idx").on(t.username)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ==========================================================================
   Reference data
   ========================================================================== */

export const MUSCLES = [
  "chest",
  "back",
  "lats",
  "traps",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "obliques",
  "neck",
  "cardio",
  "full_body",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "band",
  "smith",
  "plate",
  "other",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/**
 * How a set is measured. `reps` covers ordinary lifting; `time` drives the
 * interval/TTS mode; the rest exist so cardio and loaded carries aren't
 * shoehorned into weight×reps.
 */
export const TRACKING_TYPES = [
  "weight_reps",
  "reps",
  "time",
  "distance_time",
  "weight_time",
] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export const exercise = pgTable(
  "exercise",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stable identifier for built-in library entries; null for user-created
    // exercises. The uuid is generated per-database, so it can't be the key a
    // checked-in data file references — this is what the seed upserts on and
    // what `exercise_alternative` pairs are authored against. Never settable
    // through a server action.
    slug: text("slug"),
    name: text("name").notNull(),
    primaryMuscle: text("primary_muscle", { enum: MUSCLES }).notNull(),
    secondaryMuscles: jsonb("secondary_muscles")
      .$type<Muscle[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    equipment: text("equipment", { enum: EQUIPMENT }).notNull(),
    trackingType: text("tracking_type", { enum: TRACKING_TYPES })
      .default("weight_reps")
      .notNull(),
    instructions: text("instructions"),
    // Long-form "what it trains": joint action, which tissue does the work,
    // which quality it builds. Seeded for built-ins only.
    bodyEffect: text("body_effect"),
    // Curated form demonstration. Null → the UI falls back to a YouTube
    // search link, labelled as a search (see lib/exercise-video.ts).
    videoUrl: text("video_url"),
    // Null owner = built-in library exercise, visible to everyone.
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    // Soft delete for custom exercises. Deleting the row cascades away every
    // workout_set that referenced it, which silently rewrites history and
    // wipes the records built from it — so "delete" archives instead. Archived
    // exercises drop out of search and the picker; their detail page still
    // resolves, because past workouts link to it.
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("exercise_owner_idx").on(t.ownerId),
    index("exercise_muscle_idx").on(t.primaryMuscle),
    // Postgres unique indexes permit many NULLs, so every custom exercise
    // (slug null) coexists here without a partial-index WHERE clause.
    uniqueIndex("exercise_slug_idx").on(t.slug),
  ],
);

/**
 * Curated "try this instead" pairs, with a note on how the muscle effect
 * differs. Directed on purpose: the note is written from `exerciseId`'s point
 * of view, so a pair that should read both ways is two rows carrying two
 * different sentences. Auto-mirroring would put the wrong sentence on the
 * reverse side.
 */
export const exerciseAlternative = pgTable(
  "exercise_alternative",
  {
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercise.id, { onDelete: "cascade" }),
    alternativeId: uuid("alternative_id")
      .notNull()
      .references(() => exercise.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    position: integer("position").default(0).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.exerciseId, t.alternativeId] }),
    index("exercise_alternative_src_idx").on(t.exerciseId),
  ],
);

/* ==========================================================================
   Routines (templates)
   ========================================================================== */

export const routine = pgTable(
  "routine",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    isPublic: boolean("is_public").default(true).notNull(),
    // Set when a routine was copied from someone else, so we can show
    // provenance ("from @tomer") and count shares.
    sourceRoutineId: uuid("source_routine_id"),
    folder: text("folder"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("routine_user_idx").on(t.userId)],
);

export const routineExercise = pgTable(
  "routine_exercise",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routine.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercise.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    notes: text("notes"),
    restSeconds: integer("rest_seconds"),
    // Exercises sharing a group letter are performed as a superset.
    supersetGroup: text("superset_group"),
    // Interval mode (#14): seconds of work / rest, spoken via SpeechSynthesis.
    intervalWorkSeconds: integer("interval_work_seconds"),
    intervalRestSeconds: integer("interval_rest_seconds"),
  },
  (t) => [index("routine_exercise_routine_idx").on(t.routineId)],
);

export const SET_TYPES = ["normal", "warmup", "drop", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];

export const routineSet = pgTable(
  "routine_set",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineExerciseId: uuid("routine_exercise_id")
      .notNull()
      .references(() => routineExercise.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    setType: text("set_type", { enum: SET_TYPES }).default("normal").notNull(),
    targetWeightKg: real("target_weight_kg"),
    targetReps: integer("target_reps"),
    targetSeconds: integer("target_seconds"),
    targetDistanceM: real("target_distance_m"),
    targetRpe: real("target_rpe"),
  },
  (t) => [index("routine_set_parent_idx").on(t.routineExerciseId)],
);

/* ==========================================================================
   Workouts (sessions)
   ========================================================================== */

export const workout = pgTable(
  "workout",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id").references(() => routine.id, {
      onDelete: "set null",
    }),
    gymId: uuid("gym_id"),
    name: text("name").notNull(),
    note: text("note"),
    photoUrl: text("photo_url"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    // Null while the workout is still in progress. At most one null per user.
    endedAt: timestamp("ended_at"),
    // Deload / overload multiplier (#15). 1 = as prescribed, 0.8 = -20%.
    loadMultiplier: real("load_multiplier").default(1).notNull(),
    // Denormalised so the feed and history never re-aggregate sets.
    totalVolumeKg: real("total_volume_kg").default(0).notNull(),
    totalSets: integer("total_sets").default(0).notNull(),
    totalReps: integer("total_reps").default(0).notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    prCount: integer("pr_count").default(0).notNull(),
    coopSessionId: uuid("coop_session_id"),
  },
  (t) => [
    index("workout_user_started_idx").on(t.userId, t.startedAt),
    index("workout_active_idx").on(t.userId, t.endedAt),
    // Enforces "at most one unfinished workout per user" in the database.
    // Every start path is a check-then-insert, so without this a double-tap
    // can create a second active workout that the UI then hides — and which
    // permanently blocks starting anything else.
    uniqueIndex("workout_one_active_idx")
      .on(t.userId)
      .where(sql`${t.endedAt} IS NULL`),
  ],
);

export const workoutExercise = pgTable(
  "workout_exercise",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workout.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercise.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    notes: text("notes"),
    restSeconds: integer("rest_seconds"),
    supersetGroup: text("superset_group"),
    intervalWorkSeconds: integer("interval_work_seconds"),
    intervalRestSeconds: integer("interval_rest_seconds"),
  },
  (t) => [index("workout_exercise_workout_idx").on(t.workoutId)],
);

export const workoutSet = pgTable(
  "workout_set",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutExerciseId: uuid("workout_exercise_id")
      .notNull()
      .references(() => workoutExercise.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    setType: text("set_type", { enum: SET_TYPES }).default("normal").notNull(),
    weightKg: real("weight_kg"),
    reps: integer("reps"),
    seconds: integer("seconds"),
    distanceM: real("distance_m"),
    rpe: real("rpe"),
    // A set only counts toward volume/PRs once ticked.
    completedAt: timestamp("completed_at"),
    // Epley estimate cached at write time so PR checks are one comparison.
    estimated1rm: real("estimated_1rm"),
  },
  (t) => [index("workout_set_parent_idx").on(t.workoutExerciseId)],
);

/* ==========================================================================
   Personal records
   ========================================================================== */

export const PR_KINDS = ["1rm", "weight", "volume", "reps"] as const;
export type PrKind = (typeof PR_KINDS)[number];

export const personalRecord = pgTable(
  "personal_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercise.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: PR_KINDS }).notNull(),
    value: real("value").notNull(),
    // Context for display: "120kg × 5"
    weightKg: real("weight_kg"),
    reps: integer("reps"),
    workoutSetId: uuid("workout_set_id").references(() => workoutSet.id, {
      onDelete: "cascade",
    }),
    workoutId: uuid("workout_id").references(() => workout.id, {
      onDelete: "cascade",
    }),
    achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  },
  (t) => [
    // One current record per user/exercise/kind — upserted as they improve.
    uniqueIndex("pr_unique_idx").on(t.userId, t.exerciseId, t.kind),
  ],
);

/* ==========================================================================
   Social graph
   ========================================================================== */

export const follow = pgTable(
  "follow",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follow_following_idx").on(t.followingId),
  ],
);

export const FRIEND_STATUSES = ["pending", "accepted", "declined"] as const;

/**
 * Friendship is mutual and explicit (the spec's "add friends"), and is what
 * gates gym presence. Following is one-way and only affects the feed.
 */
export const friendRequest = pgTable(
  "friend_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: FRIEND_STATUSES })
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    respondedAt: timestamp("responded_at"),
  },
  (t) => [
    uniqueIndex("friend_pair_idx").on(t.requesterId, t.addresseeId),
    index("friend_addressee_idx").on(t.addresseeId, t.status),
  ],
);

/* ==========================================================================
   Gyms + presence
   ========================================================================== */

export const gym = pgTable(
  "gym",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    city: text("city"),
    // Short human code so friends can join without a search ("PUMP-4F2A").
    joinCode: text("join_code").notNull().unique(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("gym_name_idx").on(t.name)],
);

export const gymMember = pgTable(
  "gym_member",
  {
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gym.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gymId, t.userId] }),
    index("gym_member_user_idx").on(t.userId),
  ],
);

/**
 * "I'm at the gym" (#11). A TTL row rather than a live channel — Vercel Hobby
 * can't hold sockets, and this only needs to be correct when someone opens
 * the feed. Rows past `expiresAt` are simply filtered out on read.
 */
export const gymPresence = pgTable(
  "gym_presence",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    gymId: uuid("gym_id").references(() => gym.id, { onDelete: "cascade" }),
    note: text("note"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [index("gym_presence_expiry_idx").on(t.expiresAt)],
);

/* ==========================================================================
   Feed
   ========================================================================== */

export const post = pgTable(
  "post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id")
      .notNull()
      .unique()
      .references(() => workout.id, { onDelete: "cascade" }),
    caption: text("caption"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    likeCount: integer("like_count").default(0).notNull(),
    commentCount: integer("comment_count").default(0).notNull(),
  },
  (t) => [index("post_created_idx").on(t.createdAt), index("post_user_idx").on(t.userId)],
);

export const postLike = pgTable(
  "post_like",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export const postComment = pgTable(
  "post_comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Single-level threading: replies point at a top-level comment.
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("post_comment_post_idx").on(t.postId, t.createdAt)],
);

/* ==========================================================================
   Achievements
   ========================================================================== */

export const achievement = pgTable("achievement", {
  // Stable string key ("first_workout", "volume_100k") so seeds are idempotent.
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  tier: integer("tier").default(1).notNull(),
});

export const userAchievement = pgTable(
  "user_achievement",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    achievementKey: text("achievement_key")
      .notNull()
      .references(() => achievement.key, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
    // Whether the unlock animation has been shown to the user yet.
    seenAt: timestamp("seen_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementKey] })],
);

/* ==========================================================================
   Co-op sessions (#16)
   ========================================================================== */

export const coopSession = pgTable(
  "coop_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id").references(() => routine.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    joinCode: text("join_code").notNull().unique(),
    // Deload/overload for the whole room: whoever joins gets the routine's
    // weights scaled the same way, so "70% week" means one thing per session.
    loadMultiplier: real("load_multiplier").default(1).notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
  },
  (t) => [index("coop_host_idx").on(t.hostId)],
);

export const coopParticipant = pgTable(
  "coop_participant",
  {
    coopSessionId: uuid("coop_session_id")
      .notNull()
      .references(() => coopSession.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id").references(() => workout.id, {
      onDelete: "set null",
    }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    // Cheap denormalised counters — this is what the 3s poll reads, so it
    // must never require joining through sets.
    setsCompleted: integer("sets_completed").default(0).notNull(),
    volumeKg: real("volume_kg").default(0).notNull(),
    lastSetAt: timestamp("last_set_at"),
    restingUntil: timestamp("resting_until"),
  },
  (t) => [primaryKey({ columns: [t.coopSessionId, t.userId] })],
);

/* ==========================================================================
   Web push
   ========================================================================== */

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("push_user_idx").on(t.userId),
    // Unique per (user, endpoint) — NOT on endpoint alone. A global unique
    // endpoint would let one account claim another account's device by
    // submitting its endpoint.
    uniqueIndex("push_user_endpoint_idx").on(t.userId, t.endpoint),
  ],
);

/* ==========================================================================
   Notifications
   ========================================================================== */

export const NOTIFICATION_TYPES = [
  "like",
  "comment",
  "comment_reply",
  "friend_request",
  "friend_accepted",
  "gym_presence",
  "achievement",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * In-app notification inbox. Push is best-effort and iOS drops subscriptions,
 * so this table — not the notification tray — is the source of truth for
 * "what happened while you were away".
 */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: NOTIFICATION_TYPES }).notNull(),
    // Who caused it. Null for system events like an achievement unlock.
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    postId: uuid("post_id").references(() => post.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id").references(() => workout.id, {
      onDelete: "cascade",
    }),
    body: text("body"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("notification_user_idx").on(t.userId, t.createdAt),
    index("notification_unread_idx").on(t.userId, t.readAt),
  ],
);

/* ==========================================================================
   Rate limiting
   ========================================================================== */

/**
 * Fixed-window counters. Deliberately in Postgres rather than Redis: Hobby has
 * no durable KV, and these writes are tiny compared with the actions they
 * guard. Rows are overwritten in place per window, so the table stays small.
 */
export const rateLimit = pgTable(
  "rate_limit",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    windowStart: timestamp("window_start").notNull(),
    count: integer("count").default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.action] })],
);

/* ==========================================================================
   Relations
   ========================================================================== */

export const userRelations = relations(user, ({ many }) => ({
  workouts: many(workout),
  routines: many(routine),
  posts: many(post),
  achievements: many(userAchievement),
}));

export const routineRelations = relations(routine, ({ one, many }) => ({
  user: one(user, { fields: [routine.userId], references: [user.id] }),
  exercises: many(routineExercise),
}));

export const routineExerciseRelations = relations(
  routineExercise,
  ({ one, many }) => ({
    routine: one(routine, {
      fields: [routineExercise.routineId],
      references: [routine.id],
    }),
    exercise: one(exercise, {
      fields: [routineExercise.exerciseId],
      references: [exercise.id],
    }),
    sets: many(routineSet),
  }),
);

export const routineSetRelations = relations(routineSet, ({ one }) => ({
  routineExercise: one(routineExercise, {
    fields: [routineSet.routineExerciseId],
    references: [routineExercise.id],
  }),
}));

export const workoutRelations = relations(workout, ({ one, many }) => ({
  user: one(user, { fields: [workout.userId], references: [user.id] }),
  routine: one(routine, {
    fields: [workout.routineId],
    references: [routine.id],
  }),
  exercises: many(workoutExercise),
  post: one(post),
}));

export const workoutExerciseRelations = relations(
  workoutExercise,
  ({ one, many }) => ({
    workout: one(workout, {
      fields: [workoutExercise.workoutId],
      references: [workout.id],
    }),
    exercise: one(exercise, {
      fields: [workoutExercise.exerciseId],
      references: [exercise.id],
    }),
    sets: many(workoutSet),
  }),
);

export const workoutSetRelations = relations(workoutSet, ({ one }) => ({
  workoutExercise: one(workoutExercise, {
    fields: [workoutSet.workoutExerciseId],
    references: [workoutExercise.id],
  }),
}));

export const postRelations = relations(post, ({ one, many }) => ({
  user: one(user, { fields: [post.userId], references: [user.id] }),
  workout: one(workout, {
    fields: [post.workoutId],
    references: [workout.id],
  }),
  likes: many(postLike),
  comments: many(postComment),
}));

export const postCommentRelations = relations(postComment, ({ one }) => ({
  post: one(post, { fields: [postComment.postId], references: [post.id] }),
  user: one(user, { fields: [postComment.userId], references: [user.id] }),
}));

/* ==========================================================================
   Inferred types
   ========================================================================== */

export type User = typeof user.$inferSelect;
export type Exercise = typeof exercise.$inferSelect;
export type Routine = typeof routine.$inferSelect;
export type RoutineExercise = typeof routineExercise.$inferSelect;
export type RoutineSet = typeof routineSet.$inferSelect;
export type Workout = typeof workout.$inferSelect;
export type WorkoutExercise = typeof workoutExercise.$inferSelect;
export type WorkoutSet = typeof workoutSet.$inferSelect;
export type PersonalRecord = typeof personalRecord.$inferSelect;
export type Gym = typeof gym.$inferSelect;
export type Post = typeof post.$inferSelect;
export type PostComment = typeof postComment.$inferSelect;
export type Achievement = typeof achievement.$inferSelect;
export type CoopSession = typeof coopSession.$inferSelect;
export type CoopParticipant = typeof coopParticipant.$inferSelect;

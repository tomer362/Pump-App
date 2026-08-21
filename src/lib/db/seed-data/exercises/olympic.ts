import type { SeedExercise } from "../types";

export const OLYMPIC: SeedExercise[] = [
  {
    slug: "power-clean",
    name: "Power Clean",
    primaryMuscle: "full_body",
    secondaryMuscles: ["traps", "quads", "back"],
    equipment: "barbell",
    instructions:
      "Set up as for a deadlift with the bar over mid-foot.\nPull the bar to the hips, then extend the hips and knees violently and pull yourself under.\nCatch it on the front delts in a quarter squat and stand.",
    bodyEffect:
      "A maximal-velocity triple extension of the hips, knees and ankles, followed immediately by pulling the body underneath the bar to receive it.\n\nThe glutes, hamstrings and quads produce the drive, the traps and upper back finish the pull and hold the bar's path close, and the whole trunk transmits force between the two ends. Catching it loads everything eccentrically in a fraction of a second.\n\nIt develops rate of force development — how quickly force can be produced — better than almost any slow lift, which is why it dominates athletic programmes. It is a technical skill first, so a badly executed clean trains coordination errors rather than power.",
    alternatives: [
      {
        slug: "hang-clean",
        note: "Starting from the hip removes the pull from the floor, which cuts most of the technical difficulty while keeping the explosive extension.",
      },
      {
        slug: "high-pull-dumbbell",
        note: "Trains the same explosive pull without any catch, so it is far easier to learn and much less demanding technically.",
      },
      {
        slug: "trap-bar-deadlift",
        note: "Loads the same muscles far heavier but slowly, building strength rather than the speed a clean develops.",
      },
    ],
  },
  {
    slug: "hang-clean",
    name: "Hang Clean",
    primaryMuscle: "full_body",
    secondaryMuscles: ["traps", "quads"],
    equipment: "barbell",
    instructions:
      "Stand holding the bar at the hips, then hinge to just above the knee.\nExplode by extending the hips and shrugging, then pull under the bar.\nCatch on the shoulders in a quarter squat.",
    bodyEffect:
      "An explosive triple extension starting from a hanging position above the knee, so the lift begins where the leverage is already good and the bar is already moving under control.\n\nThe glutes, hamstrings and quads produce the drive and the traps and upper back finish the pull, with the trunk rigid throughout. Removing the floor pull removes the portion where most technical errors occur.\n\nIt gives most of the power-development benefit of a full clean at a fraction of the coaching cost, which makes it the more practical choice for anyone not competing in weightlifting. It trains nothing about the first pull from the floor.",
    alternatives: [
      {
        slug: "power-clean",
        note: "Starting from the floor adds the first pull and a longer acceleration path, at a considerably higher technical cost.",
      },
      {
        slug: "kettlebell-swing",
        note: "Trains the same explosive hip extension with almost no technical requirement and no catch at all.",
      },
      {
        slug: "high-pull-dumbbell",
        note: "Keeps the explosive pull and drops the catch entirely, making it the simplest way to train the pattern.",
      },
    ],
  },
  {
    slug: "clean-and-jerk",
    name: "Clean and Jerk",
    primaryMuscle: "full_body",
    secondaryMuscles: ["shoulders", "quads"],
    equipment: "barbell",
    instructions:
      "Clean the bar to the shoulders.\nDip and drive it overhead, splitting or pushing the feet under to receive it.\nRecover to standing with the bar locked out overhead.",
    bodyEffect:
      "Two explosive lifts chained together: a clean from the floor to the shoulders, then a jerk that drives the bar overhead and receives it in a split or squat.\n\nThe entire posterior chain and quads drive both extensions, the trunk transmits force twice, the shoulders and triceps stabilise a heavy load overhead, and the whole body absorbs two rapid eccentric catches. It is the most complete expression of whole-body power in a single lift.\n\nIt loads more of the body at higher velocity than anything else, which is why it is a contested sport in its own right. The technical demand is very high and the overhead catch is unforgiving of poor mobility or fatigue.",
    alternatives: [
      {
        slug: "power-clean",
        note: "The first half alone — the same explosive pull without the overhead portion or its mobility requirement.",
      },
      {
        slug: "push-press",
        note: "Trains the jerk's leg-driven overhead portion without any catch, which is far simpler to learn.",
      },
      {
        slug: "thruster",
        note: "Combines a squat and an overhead press continuously, giving a whole-body demand with much less technique.",
      },
    ],
  },
  {
    slug: "snatch",
    name: "Snatch",
    primaryMuscle: "full_body",
    secondaryMuscles: ["shoulders", "traps"],
    equipment: "barbell",
    instructions:
      "Take a wide grip and set up over the bar as for a deadlift.\nAccelerate the bar past the hips with a violent extension and pull yourself under.\nCatch it locked out overhead in a squat, then stand.",
    bodyEffect:
      "Moving a barbell from the floor to overhead in one continuous movement, which requires the highest bar velocity of any lift and the deepest catch position.\n\nThe hips, knees and ankles extend maximally, the traps and upper back accelerate the bar, and the shoulders and trunk must then stabilise a wide-grip overhead load at the bottom of a squat. Every joint works near its end range at speed.\n\nIt produces the highest power outputs measured in any resistance exercise, which is its entire purpose. The technical and mobility requirements are the steepest in the gym, and without coaching it is far more likely to teach bad habits than build power.",
    alternatives: [
      {
        slug: "hang-power-snatch",
        note: "Starting from the hip and catching higher removes most of the mobility and technical demand while keeping the speed.",
      },
      {
        slug: "power-clean",
        note: "Catching at the shoulders rather than overhead is substantially easier to learn and much less mobility-dependent.",
      },
      {
        slug: "kettlebell-swing",
        note: "Trains explosive hip extension with essentially no technical barrier, though nothing goes overhead.",
      },
    ],
  },
  {
    slug: "hang-power-snatch",
    name: "Hang Power Snatch",
    primaryMuscle: "full_body",
    secondaryMuscles: ["shoulders", "traps"],
    equipment: "barbell",
    instructions:
      "Hold the bar with a wide grip at the hips, then hinge to just above the knee.\nExtend explosively and pull the bar overhead.\nCatch it locked out in a quarter squat and stand.",
    bodyEffect:
      "An explosive extension from a hang, sending a wide-grip bar overhead and catching it above parallel rather than in a deep squat.\n\nThe hips and legs drive, the traps and upper back accelerate the bar, and the shoulders lock out and stabilise it overhead. Catching high removes the deep squat position that makes a full snatch so mobility-dependent.\n\nIt keeps most of the power-development stimulus while cutting the technical and mobility barriers substantially, which makes it a realistic option for general athletic training. It still demands a solid overhead position and confident technique.",
    alternatives: [
      {
        slug: "snatch",
        note: "The full lift from the floor with a deep catch, which is a far greater power expression and far harder to learn.",
      },
      {
        slug: "hang-clean",
        note: "Catching at the shoulders rather than overhead removes the overhead mobility requirement entirely.",
      },
      {
        slug: "high-pull-dumbbell",
        note: "Explosive pulling with no catch at all, which is the simplest entry point to the pattern.",
      },
    ],
  },
  {
    slug: "thruster",
    name: "Thruster",
    primaryMuscle: "full_body",
    secondaryMuscles: ["quads", "shoulders"],
    equipment: "barbell",
    instructions:
      "Hold the bar in a front rack and squat to full depth.\nDrive up out of the squat and let the momentum carry into an overhead press.\nLock out overhead, then lower the bar back to the rack.",
    bodyEffect:
      "A front squat and an overhead press fused into one continuous movement, so the leg drive flows straight into the press with no pause.\n\nThe quads and glutes drive the squat, the trunk and upper back hold the front rack rigid, and the shoulders and triceps finish the press overhead. Because it links the largest and one of the smallest muscle groups, the metabolic cost is enormous.\n\nIt is one of the most efficient whole-body conditioning movements there is, and it exposes any weak link between the legs and the overhead position instantly. It is far too fatiguing to be a good strength lift for either half of the movement.",
    alternatives: [
      {
        slug: "push-press",
        note: "Drops the squat and keeps the leg-driven press, which allows far heavier overhead loading.",
      },
      {
        slug: "front-squat-barbell",
        note: "Isolates the squat half, letting the legs be loaded heavily without the shoulders becoming the limit.",
      },
      {
        slug: "wall-ball",
        note: "The same squat-to-press pattern with a light ball, which keeps the conditioning demand at much lower joint stress.",
      },
    ],
  },
  {
    slug: "wall-ball",
    name: "Wall Ball",
    primaryMuscle: "full_body",
    secondaryMuscles: ["quads", "shoulders"],
    equipment: "other",
    trackingType: "weight_reps",
    instructions:
      "Hold a medicine ball at the chest and squat to full depth.\nDrive up and throw the ball to a target on the wall.\nCatch it and absorb straight into the next squat.",
    bodyEffect:
      "A squat-to-throw chain in which the ball is released rather than decelerated, so the drive can be fully explosive, and then caught and absorbed into the next repetition.\n\nThe quads and glutes drive the squat, the shoulders and triceps throw, and the trunk transmits force and then absorbs the catch. The continuous cycle of producing and absorbing force is what drives the heart rate up so sharply.\n\nIt trains whole-body power endurance with much lower joint loading than a barbell thruster, which is why it is a conditioning staple. The light ball means it does almost nothing for maximal strength.",
    alternatives: [
      {
        slug: "thruster",
        note: "A barbell version with far more load, which builds more strength but is much harder on the shoulders and back.",
      },
      {
        slug: "medicine-ball-slam",
        note: "Keeps the explosive throw and drops the squat, concentrating the effort on the trunk and shoulders.",
      },
      {
        slug: "burpee",
        note: "Similar whole-body conditioning with no equipment, though without the throwing or catching component.",
      },
    ],
  },
  {
    slug: "medicine-ball-slam",
    name: "Medicine Ball Slam",
    primaryMuscle: "full_body",
    secondaryMuscles: ["abs", "lats"],
    equipment: "other",
    trackingType: "weight_reps",
    instructions:
      "Hold a slam ball overhead with the body extended.\nThrow it into the floor as hard as you can, folding at the hips.\nPick it up and repeat without pausing.",
    bodyEffect:
      "A maximal-effort throw from an overhead, extended position down into the floor, so the whole front of the body contracts violently to fold the torso over.\n\nThe lats drive the arms down, rectus abdominis and the obliques flex the trunk explosively, and the hips fold to finish. Because the ball is released into the floor, nothing has to be decelerated and the effort can be genuinely maximal.\n\nThat freedom to accelerate all the way through is what makes it useful — most trunk work is limited by having to slow the load down. It is a power and conditioning tool, and it builds essentially no size or maximal strength.",
    alternatives: [
      {
        slug: "wall-ball",
        note: "Adds a squat and a catch, making it more of a whole-body conditioning movement and less of a pure throw.",
      },
      {
        slug: "cable-crunch",
        note: "Trains the same trunk flexion under controlled progressive load, which builds the muscle rather than the power.",
      },
      {
        slug: "kettlebell-swing",
        note: "Also explosive and hip-driven, but extending the body rather than folding it — the opposite pattern.",
      },
    ],
  },
  {
    slug: "burpee",
    name: "Burpee",
    primaryMuscle: "full_body",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "From standing, drop the hands to the floor and kick the feet back to a plank.\nLower the chest to the floor, press back up and jump the feet in.\nStand and jump, then repeat.",
    bodyEffect:
      "A chain of transitions — squat, plank, push-up, jump — that moves the body through nearly its full range and repeatedly changes the direction of effort.\n\nThe chest, shoulders and triceps press, the quads and glutes drive the jump, and the trunk works constantly to control the transitions. Because the whole body is repeatedly raised and lowered, oxygen demand climbs almost immediately.\n\nIt is about the most efficient conditioning movement available with no equipment and almost no space. Nothing about it is heavy enough to build strength, and fatigue degrades the positions fast, which is where people hurt their lower back.",
    alternatives: [
      {
        slug: "mountain-climbers",
        note: "Similar conditioning without the jump or the push-up, which is far easier on the knees and shoulders.",
      },
      {
        slug: "thruster",
        note: "A loaded whole-body conditioning movement, with more strength stimulus and much more joint load.",
      },
      {
        slug: "jump-squat",
        note: "Keeps the explosive jump and drops the floor transitions, isolating the lower-body power component.",
      },
    ],
  },
  {
    slug: "jump-squat",
    name: "Jump Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "calves"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Squat to about parallel and jump as high as you can.\nLand softly on the whole foot with the knees tracking over the toes.\nAbsorb the landing and go straight into the next rep.",
    bodyEffect:
      "A squat taken through to a full jump, so the leg extension is maximal-velocity and ends with the feet leaving the ground.\n\nThe quads, glutes and calves extend explosively, and the same muscles then absorb the landing eccentrically at forces well above bodyweight. The trunk stays rigid to transmit force in both directions.\n\nIt develops rate of force development and reactive strength in the legs with no equipment at all, which makes it the simplest power exercise there is. The landings accumulate real joint stress, so volume should stay low and quality high.",
    alternatives: [
      {
        slug: "box-jump",
        note: "Jumping onto a box removes most of the landing impact, which makes it far kinder to the knees at similar height.",
      },
      {
        slug: "power-clean",
        note: "Trains the same explosive triple extension with a heavy bar, at a much higher technical cost.",
      },
      {
        slug: "squat-barbell",
        note: "Loads the same muscles far heavier but slowly, building maximal strength rather than speed.",
      },
    ],
  },
  {
    slug: "box-jump",
    name: "Box Jump",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "calves"],
    equipment: "other",
    trackingType: "reps",
    instructions:
      "Stand a short step from a box, dip and swing the arms.\nJump and land softly with both feet fully on the box, knees bent.\nStep down — do not jump down — and reset.",
    bodyEffect:
      "An explosive jump onto a raised surface, where the concentric drive is maximal but the landing occurs at nearly the height you left from, so the impact is small.\n\nThe quads, glutes and calves produce the extension and the trunk stays rigid to transmit it; the landing requires control and absorption but at a fraction of the force of a drop landing.\n\nThat asymmetry — full effort up, little impact down — makes it the safest way to train lower-body power in volume, provided you step down rather than jump. Chasing box height rather than jump height just means tucking the knees more, which trains nothing.",
    alternatives: [
      {
        slug: "jump-squat",
        note: "Landing at ground level makes the eccentric far heavier, which trains reactive strength but stresses the knees more.",
      },
      {
        slug: "power-clean",
        note: "Loads the same triple extension with a barbell, developing power against real external resistance.",
      },
      {
        slug: "step-up",
        note: "The same box with no jump at all — a slow single-leg strength movement rather than a power one.",
      },
    ],
  },
  {
    slug: "turkish-get-up",
    name: "Turkish Get Up",
    primaryMuscle: "full_body",
    secondaryMuscles: ["shoulders", "obliques"],
    equipment: "kettlebell",
    trackingType: "weight_reps",
    instructions:
      "Lie on your back holding a bell locked out over one shoulder.\nRoll to the elbow, then the hand, bridge the hips, sweep the leg back and stand — keeping the arm vertical throughout.\nReverse every step to return.",
    bodyEffect:
      "A slow, multi-stage transition from lying to standing and back, performed while holding a load locked out overhead the entire time.\n\nThe shoulder and rotator cuff work continuously to keep the bell stable through every position change, the obliques and abs control the roll and the bridge, and the hips and legs do the standing. Every joint is loaded in a different way at each stage.\n\nIt trains overhead stability, trunk control and movement through positions most training never visits, which is why it is used as both an assessment and a warm-up. It is slow, technical, and a poor use of time if strength or size is the goal.",
    alternatives: [
      {
        slug: "single-arm-overhead-carry",
        note: "Keeps the overhead stability demand while walking, which is far simpler to learn and easier to load.",
      },
      {
        slug: "half-kneeling-pallof-press",
        note: "Trains the trunk and hip control component without the overhead load or the transitions.",
      },
      {
        slug: "overhead-press-dumbbell",
        note: "Builds overhead strength directly and heavily, with none of the movement or stability complexity.",
      },
    ],
  },
  {
    slug: "single-arm-overhead-carry",
    name: "Single-Arm Overhead Carry",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["obliques", "traps"],
    equipment: "kettlebell",
    trackingType: "weight_time",
    instructions:
      "Press a bell overhead and lock the arm out with the biceps beside the ear.\nWalk with the ribs down, keeping the arm vertical.\nSwap sides and repeat.",
    bodyEffect:
      "A loaded carry with the weight held overhead on one side, so the shoulder must stabilise a load above the head while the trunk resists being pulled sideways.\n\nThe deltoids, rotator cuff and serratus work continuously to keep the shoulder blade and humerus in position, while the obliques and quadratus lumborum on the opposite side stop the torso leaning. The upper traps hold the shoulder blade rotated up.\n\nIt is one of the best ways to build overhead stability and trunk control together, and it exposes any shoulder that cannot hold a good overhead position under fatigue. It is not a strength or size exercise — the load is limited by stability, not by the muscles.",
    alternatives: [
      {
        slug: "turkish-get-up",
        note: "Takes the same overhead-stability demand through a full sequence of positions, which is far more complex.",
      },
      {
        slug: "suitcase-carry",
        note: "Loads the same anti-side-bend trunk demand with the weight at the hip, allowing much heavier loading.",
      },
      {
        slug: "overhead-press-dumbbell",
        note: "Builds overhead strength through a range rather than holding one position isometrically.",
      },
    ],
  },
];

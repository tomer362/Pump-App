import type { SeedExercise } from "../types";

export const BACK: SeedExercise[] = [
  /* ---- Vertical pulling ---- */
  {
    slug: "pull-up",
    name: "Pull Up",
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps", "back"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hang from a bar with an overhand grip slightly wider than the shoulders.\nPull the shoulder blades down first, then drive the elbows to the ribs until the chin clears the bar.\nLower all the way to a full hang.",
    bodyEffect:
      "Shoulder adduction and extension in a closed chain — the hands stay fixed and the body travels. The shoulder blades must depress and rotate downward before the arm can do useful work.\n\nLatissimus dorsi is the prime mover, pulling the upper arm down and in toward the ribs. Teres major, the lower traps and rhomboids control the shoulder blade, the biceps and brachialis flex the elbow, and the abs stop the body swinging.\n\nIt is the most complete expression of upper-body pulling strength, and because it moves your whole bodyweight through a long range it builds back width faster than most machine work. The catch is that it is unscalable downward — below a certain strength you simply cannot do one, which is what assisted and band versions exist for.",
    alternatives: [
      {
        slug: "chin-up",
        note: "An underhand grip puts the biceps in a stronger position, so they take much more of the load and the lats slightly less — usually a few reps easier.",
      },
      {
        slug: "lat-pulldown-cable",
        note: "The same pulling line with a load you can dial in precisely, so you can train the pattern below bodyweight or well past failure. The trunk stops working.",
      },
      {
        slug: "assisted-pull-up-machine",
        note: "Identical mechanics with part of your bodyweight counterweighted away, which keeps the closed-chain pattern while the strength is being built.",
      },
    ],
  },
  {
    slug: "chin-up",
    name: "Chin Up",
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hang with an underhand grip about shoulder width.\nPull the elbows down and back until the chin clears the bar.\nLower to a full hang under control.",
    bodyEffect:
      "The same closed-chain vertical pull as a pull-up, but supinating the hands rotates the upper arm outward and puts the elbow flexors in their strongest line of pull.\n\nLatissimus dorsi still drives shoulder adduction and extension, while the biceps brachii — which is a much better elbow flexor when supinated — takes a substantially larger share than in a pull-up. The path also stays closer to the body, which reduces the pure width component.\n\nMost people manage more reps here than on pull-ups, which makes it the better place to accumulate volume and the better arm builder of the two. It develops the lats slightly less directly, so the two are complements rather than substitutes.",
    alternatives: [
      {
        slug: "pull-up",
        note: "Overhand and wider puts the biceps in a weaker position and hands more of the work to the lats, biasing back width over arm size.",
      },
      {
        slug: "neutral-grip-pull-up",
        note: "A palms-facing grip sits between the two for biceps involvement and is usually the kindest option for the elbows and shoulders.",
      },
      {
        slug: "lat-pulldown-underhand",
        note: "Same grip and line of pull with an adjustable stack, so you can train it lighter than bodyweight or take it past failure safely.",
      },
    ],
  },
  {
    slug: "neutral-grip-pull-up",
    name: "Neutral Grip Pull Up",
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps", "back"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hang from parallel handles with the palms facing each other.\nPull the elbows straight down to the ribs.\nLower to a full hang without letting the shoulders shrug up.",
    bodyEffect:
      "A closed-chain vertical pull with the forearms in neutral rotation, so the shoulder and elbow both sit in their most mechanically neutral positions throughout.\n\nThe lats drive shoulder extension and adduction as always, but brachialis and brachioradialis take a larger share of the elbow flexion than the biceps does, and the shoulder is neither internally nor externally rotated under load. Teres major and the lower traps control the shoulder blade.\n\nThe neutral position is why this is usually the most comfortable of the three grips for anyone with cranky elbows or shoulders, and strength here tends to sit between pull-ups and chin-ups. It builds slightly less width than a wide overhand pull because the arms travel closer to the body.",
    alternatives: [
      {
        slug: "pull-up",
        note: "A wider overhand grip pulls the arms further from the body, which emphasises lat width more but is harder on the shoulder.",
      },
      {
        slug: "chin-up",
        note: "Supinating puts the biceps in their strongest line, so the arms take more of the load and the elbows more of the stress.",
      },
      {
        slug: "lat-pulldown-neutral",
        note: "The same neutral pulling line with a stack, so it can be loaded below bodyweight or taken past failure.",
      },
    ],
  },
  {
    slug: "assisted-pull-up-machine",
    name: "Assisted Pull Up (Machine)",
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps"],
    equipment: "machine",
    trackingType: "assist_reps",
    instructions:
      "Set enough assistance that you can complete clean reps but still struggle at the end.\nKneel or stand on the pad, pull the chin over the bar.\nLower to a full hang each rep.",
    bodyEffect:
      "A vertical pull-up with a counterweighted platform cancelling part of your bodyweight, so the joint action and the closed-chain mechanics are preserved while the effective load drops.\n\nThe lats, teres major, rhomboids and biceps all work in the same pattern as an unassisted pull-up. What changes is that the pad also steadies the body, so the abs and the anti-swing control contribute much less.\n\nIt exists to bridge the gap to a real pull-up and to extend heavy sets past failure. The assistance is a ladder, not a destination — the useful measure of progress is the counterweight going down, which makes it worth logging the assist rather than the reps alone.",
    alternatives: [
      {
        slug: "pull-up",
        note: "Full bodyweight with the trunk genuinely working to stop the body swinging — the thing this machine is training you toward.",
      },
      {
        slug: "lat-pulldown-cable",
        note: "Similar adjustable loading, but seated and open-chain, so the body stays fixed and the load moves instead.",
      },
      {
        slug: "band-assisted-pull-up",
        note: "Band assistance is greatest at the bottom and least at the top, which matches the strength curve better than a constant counterweight.",
      },
    ],
  },
  {
    slug: "band-assisted-pull-up",
    name: "Band Assisted Pull Up",
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps"],
    equipment: "band",
    trackingType: "reps",
    instructions:
      "Loop a band over the bar and put a foot or knee in it.\nPull to the bar as you would unassisted.\nLower to a full hang; the band will help most at the bottom.",
    bodyEffect:
      "A pull-up with elastic assistance that is strongest at full hang and weakest at the top, because the band's tension falls as it shortens.\n\nThe lats, teres major and elbow flexors work exactly as in a pull-up, but the assistance profile matches the natural strength curve — most help where you are weakest, least where you are strongest. The body must still resist swinging, so the trunk keeps working.\n\nThat makes it a better strength-building assist than a machine for most people, since the top of the rep stays genuinely hard. The drawback is that band assistance is difficult to quantify and progresses in coarse jumps between band sizes.",
    alternatives: [
      {
        slug: "assisted-pull-up-machine",
        note: "A constant counterweight is easy to log and to decrease in small steps, but it also assists most at the top where you need it least.",
      },
      {
        slug: "pull-up",
        note: "The unassisted version, which this is a scaffold toward — full bodyweight and full trunk involvement.",
      },
      {
        slug: "lat-pulldown-cable",
        note: "Precise, loggable loading in a seated position, at the cost of the closed-chain mechanics and the anti-swing work.",
      },
    ],
  },
  {
    slug: "lat-pulldown-cable",
    name: "Lat Pulldown (Cable)",
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps"],
    equipment: "cable",
    instructions:
      "Set the thigh pad snug and take a grip a little wider than the shoulders.\nPull the bar to the upper chest, leading with the elbows and letting the shoulder blades drop.\nReturn all the way up until the lats lengthen.",
    bodyEffect:
      "An open-chain vertical pull: the body is anchored and the bar travels. The shoulder adducts and extends while the shoulder blades depress and rotate downward.\n\nLatissimus dorsi is the prime mover, with teres major, the lower traps and rhomboids controlling the shoulder blade and the biceps flexing the elbow. Because the thighs are pinned, the trunk does far less than in a pull-up.\n\nThe great advantage is precise, adjustable load: you can train the pattern well below bodyweight, take it past failure, and progress in small steps. The great limitation is that no amount of pulldown strength guarantees a pull-up, because the pattern and the trunk demand differ.",
    alternatives: [
      {
        slug: "pull-up",
        note: "Moving your body instead of the bar adds real trunk work and closed-chain shoulder-blade control that the pad removes.",
      },
      {
        slug: "lat-pulldown-underhand",
        note: "An underhand grip pulls the elbows closer to the body and hands the biceps a much larger share of the work.",
      },
      {
        slug: "straight-arm-pulldown",
        note: "Keeping the elbow locked removes the biceps entirely, isolating the lat's shoulder-extension role without any arm involvement.",
      },
    ],
  },
  {
    slug: "lat-pulldown-underhand",
    name: "Lat Pulldown (Underhand)",
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps"],
    equipment: "cable",
    instructions:
      "Take a shoulder-width underhand grip and set the thigh pad.\nPull the bar to the upper chest with the elbows travelling down and back.\nControl the return to a full stretch.",
    bodyEffect:
      "A vertical pull with the hands supinated, which rotates the upper arm outward and brings the elbows down closer to the sides than a wide overhand grip allows.\n\nThe lats still drive shoulder extension, but the biceps — far stronger supinated — take a much larger share, and the lower lat fibres get a slightly better line as the elbows finish close to the ribs. Shoulder-blade depression still comes from the lower traps.\n\nPeople usually pull more weight here than overhand, which makes it a good way to overload the pattern. That extra load is partly the arms doing more work, so it builds the lats slightly less directly than the overhand version does.",
    alternatives: [
      {
        slug: "lat-pulldown-cable",
        note: "An overhand grip weakens the biceps' leverage, so a larger share of the work stays on the lats.",
      },
      {
        slug: "chin-up",
        note: "Same grip and line of pull moving your own bodyweight, which adds trunk control and a closed-chain shoulder blade.",
      },
      {
        slug: "lat-pulldown-neutral",
        note: "A neutral grip sits between the two for biceps involvement and is usually the easiest on the elbows.",
      },
    ],
  },
  {
    slug: "lat-pulldown-neutral",
    name: "Lat Pulldown (Neutral Grip)",
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps", "back"],
    equipment: "cable",
    instructions:
      "Attach a V-handle or parallel bar and set the thigh pad.\nPull to the upper chest, elbows tracking straight down beside the ribs.\nReturn to a full stretch overhead.",
    bodyEffect:
      "A vertical pull with the forearms in neutral rotation, which keeps the shoulder out of both internal and external rotation and lets the elbows travel in a straight line down the sides.\n\nThe lats and teres major do the shoulder work; brachialis and brachioradialis take more of the elbow flexion than in an underhand pull, and the lower traps still depress the shoulder blade. The narrow path favours lat thickness in the lower fibres over pure width.\n\nIt is the most joint-friendly of the pulldown grips and usually the one people can load most consistently. Because the arms travel close to the body it does less for the upper, wider lat fibres than a broad overhand grip.",
    alternatives: [
      {
        slug: "lat-pulldown-cable",
        note: "A wider overhand grip pulls the arms further out from the body, which biases the upper lat fibres and back width.",
      },
      {
        slug: "neutral-grip-pull-up",
        note: "Same grip against your own bodyweight, adding trunk control and closed-chain mechanics the seat removes.",
      },
      {
        slug: "seated-row-cable",
        note: "Pulling horizontally instead of vertically shifts emphasis from the lats onto the mid-back retractors.",
      },
    ],
  },
  {
    slug: "single-arm-lat-pulldown",
    name: "Single-Arm Lat Pulldown",
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps", "obliques"],
    equipment: "cable",
    instructions:
      "Attach a single handle high and kneel or sit facing the stack.\nPull the elbow down to the ribs, letting the shoulder blade travel with it.\nReach back up until the lat lengthens fully.",
    bodyEffect:
      "A one-armed vertical pull in which the shoulder blade is free to move through its whole range, because nothing on the other side restricts it.\n\nThe lat works through a longer arc than a bar allows — a deeper reach at the top and a fuller squeeze at the bottom — while the obliques resist the sideways pull of the stack. The biceps flex the elbow as usual.\n\nThe extra range and the freedom of the shoulder blade make this a strong lat hypertrophy option, and training one side at a time exposes and corrects imbalances a bar hides. It takes roughly twice as long per set, which is its main practical cost.",
    alternatives: [
      {
        slug: "lat-pulldown-cable",
        note: "Two hands on one bar is faster and heavier, but the fixed bar limits how far the shoulder blade can travel at each end.",
      },
      {
        slug: "single-arm-cable-row",
        note: "Same one-sided freedom pulling horizontally, which shifts emphasis from the lats to the mid-back retractors.",
      },
      {
        slug: "straight-arm-pulldown",
        note: "Locking the elbow removes the biceps entirely and isolates shoulder extension, though with far less load.",
      },
    ],
  },
  {
    slug: "straight-arm-pulldown",
    name: "Straight Arm Pulldown",
    primaryMuscle: "lats",
    equipment: "cable",
    instructions:
      "Stand facing a high pulley with a straight bar or rope, arms extended and elbows locked softly.\nSweep the bar down to the thighs in an arc, keeping the arms straight.\nLet it rise back overhead until the lats stretch.",
    bodyEffect:
      "Pure shoulder extension with the elbow held at a fixed angle, so the arm acts as a single rigid lever pivoting at the shoulder.\n\nBecause the elbow never flexes, the biceps are removed from the equation entirely and latissimus dorsi works essentially alone, with the long head of the triceps assisting in extending the shoulder and the abs bracing against the pull.\n\nThat isolation is the point: it is the cleanest way to feel and train the lat without the arms failing first, which makes it an excellent warm-up before heavy pulling and a good finisher after it. The long lever means the load will always be modest.",
    alternatives: [
      {
        slug: "lat-pulldown-cable",
        note: "Bending the elbow brings the biceps in and multiplies the load, but the arms now share work the lat was doing alone.",
      },
      {
        slug: "dumbbell-pullover",
        note: "The same shoulder-extension arc with a free weight, loading the lat hardest in the stretched overhead position instead of the shortened one.",
      },
      {
        slug: "single-arm-lat-pulldown",
        note: "Adds elbow flexion and a longer one-sided range, so more total load but less pure isolation of the lat.",
      },
    ],
  },
  {
    slug: "dumbbell-pullover",
    name: "Dumbbell Pullover",
    primaryMuscle: "lats",
    secondaryMuscles: ["chest", "triceps"],
    equipment: "dumbbell",
    instructions:
      "Lie across or along a bench holding one bell over the chest with both hands.\nLower it back over the head with the elbows softly bent until the ribs stretch.\nPull it back over the chest without letting the ribs flare.",
    bodyEffect:
      "Shoulder extension from a deeply flexed overhead position, with the elbow held at a fixed angle so the arm works as one lever.\n\nLatissimus dorsi is loaded at its longest, most stretched length as the weight passes behind the head, with the sternal chest fibres and the long head of triceps contributing through the arc. The abs must work hard to stop the ribcage flaring as the arms go overhead.\n\nThe stretched-position loading is what makes it valuable — very few lat exercises load the muscle at long lengths, and that is a strong growth stimulus. The overhead position is demanding on the shoulder, so it wants control and moderate weight, not maximum load.",
    alternatives: [
      {
        slug: "straight-arm-pulldown",
        note: "Same shoulder-extension arc, but the cable loads the shortened position hardest instead of the overhead stretch.",
      },
      {
        slug: "cable-pullover",
        note: "Keeps tension even through the whole arc rather than peaking at the overhead position, and is much easier on the shoulder.",
      },
      {
        slug: "lat-pulldown-cable",
        note: "Adds elbow flexion for far more load, but never reaches the deeply stretched overhead position this trains.",
      },
    ],
  },
  {
    slug: "cable-pullover",
    name: "Cable Pullover",
    primaryMuscle: "lats",
    secondaryMuscles: ["triceps"],
    equipment: "cable",
    instructions:
      "Kneel facing a high pulley with a rope, arms extended overhead.\nHinge slightly and pull the rope down past the face to the hips, arms nearly straight.\nLet it draw back overhead into a full stretch.",
    bodyEffect:
      "Shoulder extension through a long arc from full overhead flexion to the hips, with the elbow fixed so the lat is the only muscle that can shorten the lever.\n\nLatissimus dorsi does nearly all of the work, assisted by the long head of triceps and by teres major, while the abs brace against the overhead pull. The cable holds resistance even from the stretched top to the shortened bottom.\n\nCombining a long range with constant tension makes this one of the better lat isolation movements, and the kneeling position removes any temptation to use the legs. Load stays modest because the arm is a long lever throughout.",
    alternatives: [
      {
        slug: "dumbbell-pullover",
        note: "A free weight loads the stretched overhead position much harder, but goes almost weightless as the arms come down.",
      },
      {
        slug: "straight-arm-pulldown",
        note: "A shorter arc that starts in front of you rather than overhead, so it misses the deeply stretched position entirely.",
      },
      {
        slug: "lat-pulldown-cable",
        note: "Bending the elbows brings the biceps in and allows far heavier loading of the same shoulder extension.",
      },
    ],
  },
  /* ---- Horizontal pulling ---- */
  {
    slug: "bent-over-row-barbell",
    name: "Bent Over Row (Barbell)",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "barbell",
    instructions:
      "Hinge until the torso is somewhere between 45° and horizontal, back flat.\nPull the bar to the lower ribs or navel, leading with the elbows.\nLower under control without letting the torso rise.",
    bodyEffect:
      "Horizontal shoulder extension with shoulder-blade retraction, performed while the spinal erectors hold a hinged torso static against the weight of both the bar and your upper body.\n\nThe rhomboids, mid traps and rear deltoids retract the shoulder blades; the lats and teres major pull the upper arm back; the biceps flex the elbow. Behind all of it, the erectors, glutes and hamstrings work isometrically to hold the hinge — often the real limiting factor.\n\nIt builds mid-back thickness and bracing strength at the same time, which is why it remains a staple in almost every programme. That dual demand is also its weakness: the lower back fatigues before the back muscles do, and form degrades under load in ways a supported row prevents.",
    alternatives: [
      {
        slug: "chest-supported-row-machine",
        note: "The pad removes the spinal-erector demand entirely, so the mid-back can be trained to failure without the lower back deciding when the set ends.",
      },
      {
        slug: "pendlay-row",
        note: "Resetting the bar on the floor each rep enforces a strict horizontal torso and adds an explosive start, but removes any eccentric loading.",
      },
      {
        slug: "seated-row-cable",
        note: "Same horizontal pull with the torso supported and upright, trading the bracing demand for consistent tension and easier progression.",
      },
    ],
  },
  {
    slug: "pendlay-row",
    name: "Pendlay Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "traps"],
    equipment: "barbell",
    instructions:
      "Set the torso parallel to the floor with the bar on the ground.\nPull explosively to the lower chest, then return the bar fully to the floor.\nReset the position each rep; the torso must not rise.",
    bodyEffect:
      "A horizontal row started from a dead stop with the torso held rigidly parallel to the floor, so every rep begins with no stored elastic energy and no momentum.\n\nThe mid traps, rhomboids and rear delts retract the shoulder blades while the lats drive the upper arm back; the erectors, glutes and hamstrings hold the horizontal torso isometrically between reps. The dead start recruits more fast-twitch fibre than a continuous row.\n\nIt builds explosive pulling strength and enforces honest positioning, which makes it a favourite for people whose bent-over rows drift upright under load. Returning the bar to the floor removes the eccentric portion, so it is a worse pure hypertrophy stimulus than a controlled row.",
    alternatives: [
      {
        slug: "bent-over-row-barbell",
        note: "Keeping the bar in the air preserves the eccentric and keeps tension continuous, at the cost of letting the torso creep upright.",
      },
      {
        slug: "t-bar-row",
        note: "The fixed pivot supports the load path, so you can pull heavier with less demand on positioning and the lower back.",
      },
      {
        slug: "chest-supported-row-machine",
        note: "Removes the isometric hinge completely, letting the mid back work to failure without the erectors ending the set.",
      },
    ],
  },
  {
    slug: "bent-over-row-dumbbell",
    name: "Bent Over Row (Dumbbell)",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "dumbbell",
    instructions:
      "Hinge forward with a bell in each hand, back flat and knees soft.\nPull both bells to the hips, elbows travelling back past the ribs.\nLower fully until the arms hang and the shoulder blades spread.",
    bodyEffect:
      "A hinged horizontal pull with two independent loads, so each shoulder blade retracts through its own full range rather than being limited by a shared bar.\n\nThe rhomboids, mid traps and rear delts retract, the lats and teres major extend the shoulder, and the biceps flex the elbows. The erectors, glutes and hamstrings hold the hinge isometrically throughout.\n\nThe independent path lets the elbows travel further back than a bar allows and exposes any side-to-side difference immediately. It loads less than a barbell row and the hinge still fatigues the lower back, which caps how long a set can usefully run.",
    alternatives: [
      {
        slug: "bent-over-row-barbell",
        note: "One bar allows considerably heavier loading and a simpler setup, but limits how far each shoulder blade can travel and hides imbalances.",
      },
      {
        slug: "chest-supported-row-dumbbell",
        note: "Lying on an incline removes the hinge, so the mid back can be trained to failure without the lower back giving out first.",
      },
      {
        slug: "single-arm-row-dumbbell",
        note: "One arm at a time with the other hand supporting takes the lower back out and allows a longer range per side.",
      },
    ],
  },
  {
    slug: "single-arm-row-dumbbell",
    name: "Single-Arm Row (Dumbbell)",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "dumbbell",
    instructions:
      "Brace one hand and knee on a bench, other foot on the floor, back flat.\nPull the bell to the hip, letting the shoulder blade travel back with it.\nLower until the arm hangs and the shoulder blade reaches forward.",
    bodyEffect:
      "A one-sided horizontal pull with the torso supported by the free hand, so the spine is braced externally rather than held by the erectors alone.\n\nThe lat, teres major, rhomboids and mid traps on the working side move through a longer arc than a two-handed row permits — the shoulder blade can reach fully forward at the bottom and fully back at the top. The obliques resist the trunk twisting toward the load.\n\nSupporting the torso means the set ends when the back muscles tire, not when the lower back does, which makes it one of the most productive rows for hypertrophy. It is slow, since every set is done twice.",
    alternatives: [
      {
        slug: "bent-over-row-dumbbell",
        note: "Rowing both sides at once halves the time but reintroduces the isometric hinge, so the lower back limits the set.",
      },
      {
        slug: "single-arm-cable-row",
        note: "A cable keeps tension even through the whole arc, where a dumbbell's resistance falls off as the elbow passes the ribs.",
      },
      {
        slug: "chest-supported-row-machine",
        note: "Also removes the lower-back demand, and trains both sides at once — but the fixed path shortens the shoulder blade's range.",
      },
    ],
  },
  {
    slug: "chest-supported-row-dumbbell",
    name: "Chest Supported Row (Dumbbell)",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "dumbbell",
    instructions:
      "Lie face down on a bench set to about 30–45° with a bell in each hand.\nPull the elbows back past the ribs, squeezing the shoulder blades together.\nLower until the arms hang fully and the blades spread.",
    bodyEffect:
      "A horizontal row with the torso resting on an inclined pad, so the spinal erectors and the hinge are removed from the exercise entirely.\n\nWhat is left is almost purely shoulder-blade retraction and shoulder extension: rhomboids, mid and lower traps, rear delts, lats and teres major, with the biceps flexing the elbows. Nothing stabilises except the muscles being trained.\n\nThat isolation is exactly the point — the set ends when the mid back fails, which makes it far more productive per set than a bent-over row for building thickness. It cannot be loaded as heavily, and it teaches none of the bracing that free rowing does.",
    alternatives: [
      {
        slug: "bent-over-row-dumbbell",
        note: "Removing the pad adds a real isometric hinge and lets you load heavier, but the lower back now decides when the set ends.",
      },
      {
        slug: "chest-supported-row-machine",
        note: "A machine version with a fixed path and easier loading, though the handles constrain how far the shoulder blades can travel.",
      },
      {
        slug: "seal-row",
        note: "Lying flat on a raised bench makes the pull purely horizontal, removing even the small amount of body English an incline allows.",
      },
    ],
  },
  {
    slug: "chest-supported-row-machine",
    name: "Chest Supported Row (Machine)",
    primaryMuscle: "back",
    secondaryMuscles: ["lats"],
    equipment: "machine",
    instructions:
      "Set the chest pad so the handles sit level with the mid chest.\nPull the handles back, driving the elbows past the ribs.\nLet the arms extend fully and the shoulder blades spread before the next rep.",
    bodyEffect:
      "A horizontal pull along a fixed path with the torso pinned against a pad, removing every stabilising and bracing demand from the movement.\n\nThe rhomboids, mid traps and rear delts retract the shoulder blades while the lats extend the shoulder and the biceps flex the elbow. Because the pad supports the trunk, none of the effort leaks into the erectors or the legs.\n\nThis is the safest place to take rowing to genuine failure and the easiest row to progress in small increments, which makes it a reliable back-thickness builder. It develops no bracing strength at all, so it belongs alongside a free-weight row rather than instead of one.",
    alternatives: [
      {
        slug: "chest-supported-row-dumbbell",
        note: "Free weights let each shoulder blade travel through its own full range instead of following the machine's fixed handle path.",
      },
      {
        slug: "bent-over-row-barbell",
        note: "Adds a substantial isometric demand on the hinge and erectors, building bracing strength the pad removes entirely.",
      },
      {
        slug: "seated-row-cable",
        note: "Upright and cable-driven, which keeps tension even and allows a longer reach forward at the start of each rep.",
      },
    ],
  },
  {
    slug: "seal-row",
    name: "Seal Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "barbell",
    instructions:
      "Lie face down on a bench raised high enough for the bar to hang clear.\nPull the bar to the bench, elbows driving back.\nLower to a dead hang without letting the legs or hips help.",
    bodyEffect:
      "A row performed lying flat on a raised bench, which makes the line of pull purely vertical relative to the floor and eliminates every possible contribution from the legs, hips and lower back.\n\nOnly the retractors and shoulder extensors can move the bar: rhomboids, mid and lower traps, rear delts, lats, teres major and the elbow flexors. There is literally no body English available.\n\nIt is the strictest row there is, which makes it excellent for building mid-back thickness and for honest progression — the weight on the bar means what it says. Setting it up requires a high bench or a purpose-built one, which is its main practical obstacle.",
    alternatives: [
      {
        slug: "chest-supported-row-dumbbell",
        note: "An incline bench is far easier to set up and lets each arm move independently, at the cost of allowing a little body English.",
      },
      {
        slug: "bent-over-row-barbell",
        note: "Free rowing loads heavier and builds real bracing strength, but it is exactly the body English this exercise exists to remove.",
      },
      {
        slug: "chest-supported-row-machine",
        note: "Similar strictness with much simpler setup and easier loading, though the handle path is fixed.",
      },
    ],
  },
  {
    slug: "t-bar-row",
    name: "T-Bar Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "barbell",
    instructions:
      "Straddle the bar, hinge forward and take the handles.\nPull the weight into the lower chest with the elbows close to the body.\nLower until the arms extend and the shoulder blades spread.",
    bodyEffect:
      "A hinged horizontal row in which one end of the bar is anchored, so the load travels through a fixed arc and part of its weight is carried by the pivot rather than by you.\n\nThe rhomboids, mid traps, lats and teres major do the pulling, with the erectors and hamstrings holding the hinge as in any bent-over row. The neutral, close grip keeps the elbows tucked, which biases the lats and lower traps over the rear delts.\n\nThe anchored path is why most people can row noticeably more here than with a free barbell, making it a good back-thickness overload. It still taxes the lower back, and the fixed arc will suit some torso lengths better than others.",
    alternatives: [
      {
        slug: "bent-over-row-barbell",
        note: "A free bar demands you control the whole path and the position, which builds more bracing strength but caps the load.",
      },
      {
        slug: "chest-supported-t-bar-row",
        note: "The same machine with a chest pad, removing the hinge so the lower back stops limiting the set.",
      },
      {
        slug: "seated-row-cable",
        note: "Upright and supported, with even cable tension instead of an arc that gets heaviest at the top.",
      },
    ],
  },
  {
    slug: "chest-supported-t-bar-row",
    name: "Chest Supported T-Bar Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "traps"],
    equipment: "machine",
    instructions:
      "Set the chest pad so the handles reach comfortably at full stretch.\nPull the handles to the ribs, driving the elbows back and squeezing the blades.\nLower to a full stretch each rep.",
    bodyEffect:
      "A T-bar row with the torso resting on an angled chest pad, so the anchored arc supports the load path and the pad supports you.\n\nRhomboids, mid and lower traps, rear delts, lats and teres major do all the work; the erectors and hamstrings do none. Grip position on most units lets you choose between a wide, rear-delt-biased pull and a close, lat-biased one.\n\nWith both the hinge and the balance removed, this is one of the most efficient back-thickness builders available, and it loads heavily in plates. The pad can restrict a full breath at heavy loads, and none of the bracing carries over to free-weight rowing.",
    alternatives: [
      {
        slug: "t-bar-row",
        note: "Without the pad the hinge is yours to hold, which builds bracing strength but lets the lower back end the set early.",
      },
      {
        slug: "chest-supported-row-dumbbell",
        note: "Free weights allow each shoulder blade its own full range instead of following the machine's fixed handles.",
      },
      {
        slug: "seal-row",
        note: "Strictest of all — flat and fully horizontal, removing even the slight leg drive an angled pad permits.",
      },
    ],
  },
  {
    slug: "seated-row-cable",
    name: "Seated Row (Cable)",
    primaryMuscle: "back",
    secondaryMuscles: ["biceps", "lats"],
    equipment: "cable",
    instructions:
      "Sit tall with a slight knee bend and take the handle.\nPull to the navel, driving the elbows back and squeezing the shoulder blades together.\nLet the arms reach fully forward and the blades spread before the next rep.",
    bodyEffect:
      "A horizontal pull performed upright against a cable, so resistance stays constant from the fully stretched reach to the fully retracted finish.\n\nRhomboids and mid traps retract the shoulder blades, the lats and teres major extend the shoulder, the rear delts assist, and the biceps flex the elbow. The erectors work only lightly, holding an upright torso rather than a hinged one.\n\nEven tension and an easy, precise stack make it the most reliable place to accumulate mid-back volume, and the long forward reach genuinely stretches the lats. It builds far less bracing strength than a bent-over row, and it is easy to cheat by rocking the torso.",
    alternatives: [
      {
        slug: "bent-over-row-barbell",
        note: "Holding a hinge under load adds a large isometric demand on the erectors and allows much heavier absolute weight.",
      },
      {
        slug: "single-arm-cable-row",
        note: "One side at a time lets the shoulder blade travel further at both ends and exposes side-to-side differences.",
      },
      {
        slug: "chest-supported-row-machine",
        note: "A pad removes the temptation to rock and makes the load fall purely on the mid back.",
      },
    ],
  },
  {
    slug: "single-arm-cable-row",
    name: "Single-Arm Cable Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "obliques"],
    equipment: "cable",
    instructions:
      "Sit or half-kneel facing a low pulley with a single handle.\nReach forward, letting the shoulder blade travel with the arm.\nPull the elbow past the ribs and squeeze, then reach out again under control.",
    bodyEffect:
      "A one-sided horizontal pull in which the shoulder blade is free to protract fully at the front and retract fully at the back, unconstrained by the other arm.\n\nThe lat, teres major, rhomboid and mid traps on the working side move through a longer arc than any two-handed row allows, while the obliques and abs resist the trunk being pulled around by the stack.\n\nThe combination of long range, constant cable tension and an anti-rotation demand makes it a strong choice for both back development and trunk control, and it corrects imbalances directly. It doubles the time per set and the load is limited by what the trunk can anchor.",
    alternatives: [
      {
        slug: "seated-row-cable",
        note: "Two hands is quicker and heavier, but the bar restricts how far each shoulder blade can travel at either end.",
      },
      {
        slug: "single-arm-row-dumbbell",
        note: "Bracing on a bench allows more load, though a dumbbell's resistance falls away as the elbow passes the ribs.",
      },
      {
        slug: "half-kneeling-cable-row",
        note: "The same pull from a split-kneeling base, which raises the anti-rotation demand considerably and lowers the usable load.",
      },
    ],
  },
  {
    slug: "half-kneeling-cable-row",
    name: "Half-Kneeling Cable Row",
    primaryMuscle: "back",
    secondaryMuscles: ["obliques", "lats"],
    equipment: "cable",
    instructions:
      "Half-kneel facing a chest-height pulley, opposite knee up.\nRow the handle to the ribs without letting the torso turn.\nReach forward again under control, resisting the twist.",
    bodyEffect:
      "A one-armed horizontal row from a narrow, split-kneeling base, so the pull of the cable constantly threatens to rotate and topple you.\n\nThe lat, rhomboid and mid traps do the rowing, but the obliques, deep abdominals and the glute of the down leg work continuously to resist rotation and hold the pelvis square. That anti-rotation component is as much the exercise as the row is.\n\nIt trains back and trunk together in a position that transfers well to real one-sided effort, and it makes any tendency to twist under load immediately obvious. The base limits the load, so it is a control and coordination movement rather than a mass builder.",
    alternatives: [
      {
        slug: "single-arm-cable-row",
        note: "A seated or standing base is more stable, so the trunk works far less and the back can be loaded much heavier.",
      },
      {
        slug: "single-arm-row-dumbbell",
        note: "Bracing on a bench removes the anti-rotation demand entirely and lets the back muscles take considerably more load.",
      },
      {
        slug: "pallof-press",
        note: "Keeps the anti-rotation demand and drops the row, isolating the trunk's resistance to twist with no back involvement.",
      },
    ],
  },
  {
    slug: "inverted-row",
    name: "Inverted Row",
    primaryMuscle: "back",
    secondaryMuscles: ["biceps", "abs"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Set a bar at hip height and hang underneath it, body straight from heels to head.\nPull the chest to the bar, squeezing the shoulder blades together.\nLower to full arm extension without letting the hips drop.",
    bodyEffect:
      "A closed-chain horizontal pull: the hands are fixed and the body travels, with the load set by how horizontal you make yourself rather than by a stack.\n\nRhomboids, mid traps and rear delts retract the shoulder blades while the lats extend the shoulder and the biceps flex the elbow. Because the body is a rigid plank, the abs and glutes work isometrically throughout — a demand no seated row has.\n\nIt is the horizontal counterpart to a pull-up, needs almost nothing, and scales smoothly by walking the feet in or out. Above a certain strength it becomes hard to load further without adding a vest or elevating the feet.",
    alternatives: [
      {
        slug: "seated-row-cable",
        note: "An adjustable stack progresses in precise steps and isolates the back, but removes all of the plank and trunk work.",
      },
      {
        slug: "chest-supported-row-machine",
        note: "Also removes the trunk demand, and makes it far easier to load heavily and push a set to genuine failure.",
      },
      {
        slug: "pull-up",
        note: "The vertical equivalent — same closed-chain principle, but the overhead line of pull biases lat width instead of mid-back thickness.",
      },
    ],
  },
  {
    slug: "meadows-row",
    name: "Meadows Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "traps"],
    equipment: "barbell",
    instructions:
      "Stand side-on to a landmine, hinged over, and grip the end of the bar overhand.\nRow the bar up toward the hip, elbow flaring slightly.\nLower to a full stretch, letting the shoulder blade reach forward.",
    bodyEffect:
      "A one-armed row along the arc of a landmine, taken from a side-on stance so the load path travels diagonally across the body rather than straight back.\n\nThe lat and teres major on the working side pull hardest at the bottom where the stretch is deepest, with the upper traps, rhomboids and rear delts finishing the retraction. The obliques and erectors hold a hinged, asymmetric position against a rotating load.\n\nThe angled arc creates an unusually strong stretch at the bottom and a hard contraction at the top, which is why it has a reputation as a back-thickness builder. The asymmetric hinge is demanding on the lower back and the setup is fiddly.",
    alternatives: [
      {
        slug: "single-arm-row-dumbbell",
        note: "Bracing on a bench removes the asymmetric hinge, so the lower back stops limiting the set — at the cost of the diagonal arc.",
      },
      {
        slug: "t-bar-row",
        note: "The same landmine principle with both hands, which loads much heavier and removes the anti-rotation demand.",
      },
      {
        slug: "single-arm-cable-row",
        note: "Constant tension through the whole arc and no hinge to hold, though without the deep bottom stretch the landmine angle creates.",
      },
    ],
  },
  /* ---- Deadlift family and spinal extension ---- */
  {
    slug: "deadlift-barbell",
    name: "Deadlift (Barbell)",
    primaryMuscle: "back",
    secondaryMuscles: ["hamstrings", "glutes", "traps"],
    equipment: "barbell",
    instructions:
      "Set the bar over mid-foot, hinge down and grip just outside the knees.\nTake the slack out, then push the floor away and stand up, keeping the bar against the legs.\nLock out with the hips through, then hinge the bar back down.",
    bodyEffect:
      "A hip and knee extension performed while the entire spine is held rigid against a load trying to fold it forward. The bar travels vertically; the body simply stops being bent.\n\nThe glutes and hamstrings extend the hips and the quads open the knees, but what makes it a back exercise is the isometric work: the spinal erectors resist flexion, the lats hold the bar against the body, and the traps and rhomboids resist the shoulders being pulled forward. The grip and forearms are often the limit.\n\nIt loads more total muscle at once than any other lift, which makes it the most efficient full-body strength builder and the most fatiguing thing in a programme. That systemic cost is real — heavy deadlifts take days to recover from and crowd out other work.",
    alternatives: [
      {
        slug: "trap-bar-deadlift",
        note: "The handles beside you shorten the lever on the spine and shift work to the quads, which is far kinder to the lower back.",
      },
      {
        slug: "romanian-deadlift-barbell",
        note: "Starting from the top and stopping above the floor keeps the hamstrings under continuous tension and removes the heavy floor break.",
      },
      {
        slug: "rack-pull",
        note: "Starting from pins skips the hardest part off the floor, letting you overload the lockout and the upper back without the full systemic cost.",
      },
    ],
  },
  {
    slug: "trap-bar-deadlift",
    name: "Trap Bar Deadlift",
    primaryMuscle: "back",
    secondaryMuscles: ["quads", "glutes", "traps"],
    equipment: "barbell",
    instructions:
      "Step into the trap bar and grip the handles at your sides.\nSit the hips down slightly more than a conventional pull, then stand up tall.\nLower under control, keeping the chest up.",
    bodyEffect:
      "A vertical pull with the load beside you rather than in front, which puts the weight much closer to the hips and lets the knees bend more at the start.\n\nBecause the load line sits nearer the body's centre, the shear and torque on the lumbar spine drop sharply and the quads take a larger share while the glutes and hamstrings extend the hips. The erectors, traps and lats still work isometrically to keep the torso rigid.\n\nThat combination — nearly all of the whole-body loading with much less spinal demand — makes it the more forgiving way to train the pattern, and the raised handles suit people who cannot reach the floor comfortably. It is less specific to the hinge, so it builds hamstrings less directly.",
    alternatives: [
      {
        slug: "deadlift-barbell",
        note: "A bar in front lengthens the lever on the spine, which trains the hinge and the erectors much harder but costs far more recovery.",
      },
      {
        slug: "romanian-deadlift-barbell",
        note: "Removes the knee bend almost entirely, concentrating the work in the hamstrings and glutes rather than sharing it with the quads.",
      },
      {
        slug: "goblet-squat",
        note: "Similar front-loaded, quad-biased pattern with a far lighter load and no floor pick-up at all.",
      },
    ],
  },
  {
    slug: "rack-pull",
    name: "Rack Pull",
    primaryMuscle: "back",
    secondaryMuscles: ["traps", "glutes"],
    equipment: "barbell",
    instructions:
      "Set pins or blocks so the bar starts at or just below the knee.\nGrip as for a deadlift, brace, and stand up by driving the hips through.\nLower back to the pins under control.",
    bodyEffect:
      "A deadlift with the bottom of the range removed, so the lift begins where the leverage is already favourable and the knees are barely bent.\n\nThe glutes finish the hip extension while the upper back — traps, rhomboids and erectors — works hardest, because the load is heavy and the shoulders are being pulled forward the whole time. The hamstrings do far less than in a full pull, and the grip is often the limit.\n\nIt exists to overload the upper back and the lockout with weights beyond a full deadlift, and to keep training the pattern when the floor position is unavailable. Because the hardest portion is skipped, it builds little off-the-floor strength and tempts people into ego-loading.",
    alternatives: [
      {
        slug: "deadlift-barbell",
        note: "The full pull trains the hardest position off the floor and the hamstrings through a real range, at much lower absolute load.",
      },
      {
        slug: "shrug-barbell",
        note: "If the goal is purely upper-trap loading, a shrug does it directly without the spinal load of a near-maximal pull.",
      },
      {
        slug: "romanian-deadlift-barbell",
        note: "Covers roughly the same top half of the range while keeping the hamstrings under tension throughout instead of resting on pins.",
      },
    ],
  },
  {
    slug: "back-extension",
    name: "Back Extension",
    primaryMuscle: "back",
    secondaryMuscles: ["glutes", "hamstrings"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Set the pad at the hip crease so the hips can fold freely.\nLower the torso by hinging at the hips, keeping the spine long.\nRise until the body is in a straight line — no further.",
    bodyEffect:
      "A hip hinge performed against your own upper-body weight, with the thighs anchored so the pelvis cannot move and only the torso travels.\n\nThe spinal erectors work isometrically to keep the spine from rounding while the glutes and hamstrings extend the hips. Rounding the back deliberately shifts the work onto the erectors dynamically; keeping it flat keeps the emphasis on the hips.\n\nIt is one of the few ways to train the posterior chain with almost no spinal compression, which makes it a reliable accessory alongside heavy pulling and a staple in lower-back rehab. Hyperextending past a straight line at the top adds nothing and compresses the lumbar joints.",
    alternatives: [
      {
        slug: "reverse-hyperextension",
        note: "Anchors the torso and moves the legs instead, which loads the glutes and hamstrings while decompressing rather than loading the spine.",
      },
      {
        slug: "good-morning",
        note: "The same hinge standing with a bar on the back — far heavier, and it loads the spine substantially.",
      },
      {
        slug: "romanian-deadlift-barbell",
        note: "A loaded standing hinge with a much greater hamstring stretch and real progressive loading, at real spinal cost.",
      },
    ],
  },
  {
    slug: "reverse-hyperextension",
    name: "Reverse Hyperextension",
    primaryMuscle: "glutes",
    secondaryMuscles: ["hamstrings", "back"],
    equipment: "machine",
    trackingType: "weight_reps",
    instructions:
      "Lie face down with the hips at the edge of the pad and legs hanging.\nRaise the legs until the body is straight, squeezing the glutes.\nLower under control without swinging.",
    bodyEffect:
      "A hip extension with the torso fixed and the legs moving — the mirror image of a back extension — so the pelvis rotates under a stationary spine.\n\nThe glutes and hamstrings extend the hips while the erectors work isometrically to hold the torso still. Because the legs hang below the pivot, the movement produces a mild traction on the lumbar spine rather than compressing it.\n\nThat decompression is the point: it trains the posterior chain in a way that tends to leave a sore lower back feeling better rather than worse, which is why it is common in both rehab and heavy powerlifting programmes. Momentum is easy to use and ruins it, so the tempo has to be deliberate.",
    alternatives: [
      {
        slug: "back-extension",
        note: "Fixes the legs and moves the torso instead, which loads the erectors more directly but compresses rather than decompresses the spine.",
      },
      {
        slug: "glute-bridge",
        note: "Trains hip extension with the spine fully supported by the floor, making it the least demanding option for an irritated back.",
      },
      {
        slug: "hip-thrust-barbell",
        note: "Loads the same hip extension far heavier through a longer range, but adds real compressive load across the hips and spine.",
      },
    ],
  },
  /* ---- Traps and upper back ---- */
  {
    slug: "shrug-barbell",
    name: "Shrug (Barbell)",
    primaryMuscle: "traps",
    equipment: "barbell",
    instructions:
      "Hold the bar at arm's length in front of the thighs.\nRaise the shoulders straight up toward the ears, keeping the arms straight.\nLower under control to a full stretch. Do not roll the shoulders.",
    bodyEffect:
      "Pure shoulder-blade elevation. The arms act as passive hooks; the only joint moving is the scapulothoracic one, and the range is short by nature.\n\nThe upper trapezius does nearly all the work, with the levator scapulae assisting and the forearms and grip loaded isometrically throughout — grip usually fails before the traps do, which is what straps are for.\n\nIt is the most direct way to load the upper traps and it takes heavy weight comfortably. The short range and the temptation to bounce mean it responds much better to a pause at the top than to added load, and rolling the shoulders adds risk without adding stimulus.",
    alternatives: [
      {
        slug: "shrug-dumbbell",
        note: "Bells at the sides let the shoulders travel straight up rather than around the thighs, giving a slightly longer, cleaner range.",
      },
      {
        slug: "farmers-walk",
        note: "Loads the traps isometrically for time rather than through a range, and trains grip and trunk stability at the same time.",
      },
      {
        slug: "face-pull",
        note: "Targets the lower and mid traps and the rear delts instead of the upper traps — the balancing partner to shrugging, not a substitute.",
      },
    ],
  },
  {
    slug: "shrug-dumbbell",
    name: "Shrug (Dumbbell)",
    primaryMuscle: "traps",
    equipment: "dumbbell",
    instructions:
      "Stand with a bell in each hand at your sides.\nLift the shoulders straight toward the ears without bending the arms.\nLower slowly to a full stretch.",
    bodyEffect:
      "Shoulder-blade elevation with the load hanging directly beside the body, so the line of pull runs straight down through the shoulder joint.\n\nThe upper trapezius is the prime mover with levator scapulae assisting, and because nothing sits in front of the thighs the shoulders can travel through their full elevation range. Grip is loaded isometrically the entire set.\n\nThe cleaner line of pull is the main advantage over a barbell, along with being able to shrug slightly behind the body. Bells become awkward to hold long before the traps are fully loaded, so grip is the practical ceiling.",
    alternatives: [
      {
        slug: "shrug-barbell",
        note: "One bar is easier to load very heavily, though it hangs in front of the thighs and slightly shortens the range.",
      },
      {
        slug: "shrug-trap-bar",
        note: "The handles sit beside the body like dumbbells but allow far heavier loading, which is the best of both for the traps.",
      },
      {
        slug: "farmers-walk",
        note: "Holds the same position isometrically for distance or time instead of moving through a range, adding grip and trunk work.",
      },
    ],
  },
  {
    slug: "shrug-trap-bar",
    name: "Shrug (Trap Bar)",
    primaryMuscle: "traps",
    secondaryMuscles: ["forearms"],
    equipment: "barbell",
    instructions:
      "Stand inside a loaded trap bar and grip the handles at your sides.\nElevate the shoulders straight up, arms straight.\nLower to a full stretch under control.",
    bodyEffect:
      "Shoulder-blade elevation with a heavy load hanging at the sides, combining a dumbbell's line of pull with a barbell's capacity to be loaded.\n\nThe upper traps and levator scapulae do the lifting through a full elevation range, and the grip and forearms work isometrically against a load that can be genuinely heavy. Nothing rests against the thighs to shorten the travel.\n\nFor the upper traps specifically this is close to the best available option: correct line of pull, full range, and no ceiling on the plates. It needs a trap bar, and grip will still be the limiting factor without straps.",
    alternatives: [
      {
        slug: "shrug-dumbbell",
        note: "The same side-loaded line of pull without a specialist bar, but the bells cap how heavy you can practically go.",
      },
      {
        slug: "shrug-barbell",
        note: "Loads just as heavily with standard equipment, though the bar in front of the thighs slightly shortens the range.",
      },
      {
        slug: "farmers-walk",
        note: "Trains the same position and grip isometrically over distance, building carrying strength instead of moving through a range.",
      },
    ],
  },
  {
    slug: "cable-shrug",
    name: "Cable Shrug",
    primaryMuscle: "traps",
    equipment: "cable",
    instructions:
      "Stand facing away from a low pulley holding a bar or handles at your sides.\nShrug the shoulders straight up, pausing briefly at the top.\nLower to a full stretch against the cable's pull.",
    bodyEffect:
      "Shoulder-blade elevation against a cable, so resistance stays constant from the fully stretched bottom to the fully elevated top rather than falling away as it does with a free weight at the top.\n\nThe upper trapezius is the prime mover with levator scapulae assisting, and the constant tension makes pausing at the top genuinely loaded — which matters in a movement whose range is only a few centimetres.\n\nEven tension and easy small increments make it the best shrug variation for feeling the muscle and for controlled progression. It cannot be loaded anywhere near as heavily as a trap bar, so it complements rather than replaces heavy shrugging.",
    alternatives: [
      {
        slug: "shrug-trap-bar",
        note: "Loads several times heavier with the same line of pull, though tension falls off at the very top of the range.",
      },
      {
        slug: "shrug-dumbbell",
        note: "Free weights are simpler to set up and the line of pull is similar, but resistance is lightest exactly where the traps are shortest.",
      },
      {
        slug: "face-pull",
        note: "Shifts the emphasis to the lower and mid traps and the rear delts, which is what most people actually need alongside shrugging.",
      },
    ],
  },
  {
    slug: "scapular-pull-up",
    name: "Scapular Pull Up",
    primaryMuscle: "traps",
    secondaryMuscles: ["lats"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hang from a bar with the arms straight.\nWithout bending the elbows, pull the shoulder blades down and back so the body rises a few centimetres.\nRelax back into a full hang under control.",
    bodyEffect:
      "Isolated shoulder-blade depression and downward rotation. The elbows never bend, so the only movement available is the shoulder blade sliding on the ribcage.\n\nThe lower trapezius and the lats do the depressing, with the rhomboids and serratus controlling the blade's position. It trains precisely the action that must happen before a pull-up can start, and that most people skip by yanking with the arms.\n\nIt costs almost nothing to do and directly improves both pull-up mechanics and shoulder health, which makes it an ideal warm-up before any vertical pulling. Its range is a few centimetres and it builds no meaningful size — it is a skill and control drill.",
    alternatives: [
      {
        slug: "pull-up",
        note: "Adds elbow flexion and the full pull, so the same shoulder-blade action happens under far more load but is easy to skip.",
      },
      {
        slug: "straight-arm-pulldown",
        note: "Also keeps the elbow locked, but drives shoulder extension through a full arc with adjustable load rather than a few centimetres.",
      },
      {
        slug: "face-pull",
        note: "Trains shoulder-blade control in a horizontal plane, targeting the rear delts and mid traps rather than the depressors.",
      },
    ],
  },
  {
    slug: "seated-row-machine",
    name: "Seated Row (Machine)",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "machine",
    instructions:
      "Set the chest pad and seat so the handles sit at mid-chest height.\nPull the handles back, driving the elbows past the ribs.\nLet the arms extend fully before the next rep.",
    bodyEffect:
      "A horizontal pull along a fixed arc with the chest supported, so neither balance nor bracing contributes anything to the movement.\n\nRhomboids, mid traps and rear delts retract the shoulder blades while the lats extend the shoulder and the biceps flex the elbows. Most units offer both a wide pronated and a close neutral grip, which shifts emphasis between rear delts and lats respectively.\n\nEasy loading, a fixed path and full support make it the simplest row to progress and the safest to take to failure, which is exactly what makes it a dependable back-thickness builder. It contributes nothing to bracing or free-weight control.",
    alternatives: [
      {
        slug: "seated-row-cable",
        note: "A cable lets you choose the handle, the height and the path, and allows a longer forward reach than fixed handles do.",
      },
      {
        slug: "chest-supported-row-dumbbell",
        note: "Free weights let each shoulder blade move through its own range instead of following the machine's arc.",
      },
      {
        slug: "bent-over-row-barbell",
        note: "Adds a substantial isometric hinge and much heavier loading, building bracing strength the machine removes.",
      },
    ],
  },
  {
    slug: "renegade-row",
    name: "Renegade Row",
    primaryMuscle: "back",
    secondaryMuscles: ["abs", "obliques"],
    equipment: "dumbbell",
    trackingType: "weight_reps",
    instructions:
      "Start in a push-up position gripping two hex dumbbells, feet wide.\nRow one bell to the hip without letting the hips rotate.\nReplace it and repeat on the other side.",
    bodyEffect:
      "A one-armed row performed from a plank, so the moment you lift a hand the body is being twisted toward the unsupported side and must resist it.\n\nThe lat, rhomboid and mid traps row the bell, while the obliques, deep abdominals and the opposite glute work maximally to keep the hips square. The supporting shoulder also works hard to stay stable on one arm.\n\nIt trains anti-rotation under a genuinely destabilising load, which is far more demanding than any static plank. The load is limited by what the trunk can anchor rather than what the back can pull, so it develops the back far less than a supported row.",
    alternatives: [
      {
        slug: "single-arm-row-dumbbell",
        note: "Bracing on a bench removes the anti-rotation demand entirely, so the back can be loaded several times heavier.",
      },
      {
        slug: "half-kneeling-cable-row",
        note: "Similar anti-rotation intent from a more stable base, with constant cable tension and no load on the supporting shoulder.",
      },
      {
        slug: "plank",
        note: "Keeps the trunk demand and drops the row, isolating the anti-extension component with no back involvement.",
      },
    ],
  },
];

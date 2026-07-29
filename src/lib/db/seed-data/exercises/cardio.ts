import type { SeedExercise } from "../types";

export const CARDIO: SeedExercise[] = [
  {
    slug: "treadmill-run",
    name: "Treadmill Run",
    primaryMuscle: "cardio",
    secondaryMuscles: ["quads", "calves"],
    equipment: "machine",
    trackingType: "distance_time",
    instructions:
      "Set a pace you can hold for the planned duration.\nRun tall with a relaxed upper body and a quick, light cadence.\nUse a 1% incline to approximate outdoor effort.",
    bodyEffect:
      "Repeated single-leg impact and propulsion: each stride is a small jump that has to be absorbed and returned, with the belt removing the need to propel yourself forward through air.\n\nThe quads and calves absorb landing forces, the glutes and hamstrings drive extension, and the trunk resists rotation with every arm swing. Centrally, the heart and lungs are the limiting system rather than any one muscle.\n\nRunning is the densest way to accumulate cardiovascular work per minute and the belt makes pace and incline exactly controllable. The impact accumulates in the shins, knees and Achilles, which is why volume needs to be built rather than jumped into.",
    alternatives: [
      {
        slug: "elliptical",
        note: "Reproduces a similar movement and heart-rate response with no impact at all, which suits sore knees or shins.",
      },
      {
        slug: "cycling",
        note: "Comparable cardiovascular work with no impact and a strong quad emphasis, but no bone-loading benefit.",
      },
      {
        slug: "rowing-machine",
        note: "Involves the upper body as well, so the same heart-rate response comes at lower leg-joint stress.",
      },
    ],
  },
  {
    slug: "treadmill-incline-walk",
    name: "Incline Walk (Treadmill)",
    primaryMuscle: "cardio",
    secondaryMuscles: ["glutes", "calves"],
    equipment: "machine",
    trackingType: "distance_time",
    instructions:
      "Set a steep incline and a walking pace you can hold without gripping the rails.\nStand tall and let the arms swing.\nIf you need to hold on, the incline or speed is too high.",
    bodyEffect:
      "Walking uphill, which raises the work per step substantially — the hip has to lift the body vertically as well as move it forward — without any flight phase or landing impact.\n\nThe glutes and hamstrings extend the hip against a much larger demand than flat walking, the calves work through a longer range, and the quads control the knee. Heart rate rises steadily rather than sharply.\n\nIt gives a genuinely moderate cardiovascular stimulus at essentially zero joint impact, which makes it the most sustainable option for anyone accumulating a lot of cardio alongside heavy lifting. Holding the rails removes most of the work and most of the point.",
    alternatives: [
      {
        slug: "treadmill-run",
        note: "Far higher intensity per minute, at the cost of real repeated impact through the knees and shins.",
      },
      {
        slug: "stair-climber",
        note: "A similar uphill hip-extension demand with a longer step and more glute involvement per stride.",
      },
      {
        slug: "cycling",
        note: "Also zero-impact, but seated and quad-dominant rather than standing and glute-dominant.",
      },
    ],
  },
  {
    slug: "cycling",
    name: "Cycling",
    primaryMuscle: "cardio",
    secondaryMuscles: ["quads", "glutes"],
    equipment: "machine",
    trackingType: "distance_time",
    instructions:
      "Set the saddle so the knee is slightly bent at the bottom of the stroke.\nHold a cadence you can sustain and adjust resistance to set the effort.\nKeep the upper body relaxed.",
    bodyEffect:
      "A closed-loop cycle of hip and knee extension with the bodyweight supported by the saddle, so the legs work continuously without any impact or landing.\n\nThe quadriceps do most of the work driving the pedal down, with the glutes extending the hip and the calves and hamstrings contributing through the rest of the stroke. Because the load is continuous and the range is fixed, muscular fatigue in the quads often arrives before cardiovascular fatigue.\n\nIt is the easiest way to accumulate a lot of cardiovascular work without joint stress, and resistance makes intensity precisely adjustable. The seated position and fixed range mean it does nothing for bone density or for the trunk.",
    alternatives: [
      {
        slug: "rowing-machine",
        note: "Adds the whole upper body and a hip hinge, so the same effort is spread over far more muscle.",
      },
      {
        slug: "treadmill-incline-walk",
        note: "Zero-impact like cycling but standing and glute-dominant, which loads bone and the hips more usefully.",
      },
      {
        slug: "assault-bike",
        note: "Adds arm drive to the same pedalling, which makes maximal efforts far harder to sustain.",
      },
    ],
  },
  {
    slug: "assault-bike",
    name: "Air Bike",
    primaryMuscle: "cardio",
    secondaryMuscles: ["quads", "shoulders"],
    equipment: "machine",
    trackingType: "distance_time",
    instructions:
      "Sit with the saddle set so the knee stays slightly bent at full extension.\nDrive with the legs and push and pull the handles together.\nHarder effort meets more fan resistance, so pace honestly.",
    bodyEffect:
      "Fan-braked cycling with the arms driving the handles as well, so resistance rises with the square of your effort — the harder you work, the disproportionately harder it becomes.\n\nThe quads and glutes drive the pedals while the chest, back and shoulders push and pull the handles, so a large fraction of the body's muscle is working simultaneously. Oxygen demand becomes the limit almost immediately at high effort.\n\nThat combination makes it the most brutally effective interval tool in most gyms, because there is no way to coast — easing off is the only way to make it easier. It is unpleasant enough that adherence is the main obstacle.",
    alternatives: [
      {
        slug: "cycling",
        note: "Legs only and with settable resistance, which makes steady-state work far more sustainable.",
      },
      {
        slug: "rowing-machine",
        note: "Also whole-body, but with a technical stroke that lets efficiency rather than raw effort carry some of the work.",
      },
      {
        slug: "battle-ropes",
        note: "Upper-body dominant conditioning, useful when the legs need a break but the heart rate does not.",
      },
    ],
  },
  {
    slug: "rowing-machine",
    name: "Rowing Machine",
    primaryMuscle: "cardio",
    secondaryMuscles: ["back", "quads"],
    equipment: "machine",
    trackingType: "distance_time",
    instructions:
      "Start compressed with the shins vertical and arms straight.\nDrive with the legs first, then swing the torso back, then pull the handle to the ribs.\nReverse that order on the recovery.",
    bodyEffect:
      "A sequenced full-body pull: legs, then hips, then arms, repeated continuously with the bodyweight supported by the seat.\n\nThe quads and glutes produce roughly two-thirds of the power on the drive, the erectors and lats finish it, and the arms complete the pull. The trunk works throughout to transmit force between the legs and the handle.\n\nSpreading the effort over so much muscle means a high heart rate at comparatively low stress on any single joint, which makes it one of the best conditioning options for a lifter. The stroke sequence is genuinely technical, and pulling with the arms first is both slower and hard on the lower back.",
    alternatives: [
      {
        slug: "assault-bike",
        note: "Also whole-body but with no technique to learn, so the effort goes straight into the fan rather than into the stroke.",
      },
      {
        slug: "ski-erg",
        note: "Upper-body and trunk dominant on the same kind of machine, which spares the legs entirely.",
      },
      {
        slug: "cycling",
        note: "Legs only and technically trivial, though it involves far less total muscle for the same heart rate.",
      },
    ],
  },
  {
    slug: "ski-erg",
    name: "Ski Erg",
    primaryMuscle: "cardio",
    secondaryMuscles: ["lats", "abs"],
    equipment: "machine",
    trackingType: "distance_time",
    instructions:
      "Stand tall holding the handles overhead.\nPull down and through by hinging at the hips and driving the arms past the thighs.\nReturn to full extension and repeat.",
    bodyEffect:
      "A repeated overhead-to-hip pull driven by a hip hinge, so the trunk and lats do most of the work while the legs mainly hold position.\n\nThe lats and triceps drive the arms down, rectus abdominis and the obliques produce the trunk flexion, and the hips hinge and extend to power the stroke. The legs work far less than on a rowing machine.\n\nThat makes it the natural choice when the legs are already fatigued from lifting but a conditioning stimulus is still wanted, and it loads the trunk in a way most cardio does not. Grip and lats tend to fail before the cardiovascular system does.",
    alternatives: [
      {
        slug: "rowing-machine",
        note: "Adds a large leg drive, which spreads the effort further and allows a higher sustainable output.",
      },
      {
        slug: "battle-ropes",
        note: "Also upper-body dominant conditioning, with a much lower technical demand and no machine required.",
      },
      {
        slug: "assault-bike",
        note: "Whole-body rather than upper-dominant, so it reaches a higher heart rate before the arms give out.",
      },
    ],
  },
  {
    slug: "stair-climber",
    name: "Stair Climber",
    primaryMuscle: "cardio",
    secondaryMuscles: ["glutes", "quads"],
    equipment: "machine",
    trackingType: "time",
    instructions:
      "Step at a pace you can hold without leaning on the rails.\nStand tall and place the whole foot on each step.\nUse the rails for balance only.",
    bodyEffect:
      "Continuous single-leg step-ups against a moving staircase, so each stride lifts the whole bodyweight through a substantial vertical range.\n\nThe glutes and quads do the lifting through a deeper hip and knee range than walking, the calves push off each step, and the hip abductors keep the pelvis level as weight transfers from foot to foot. The vertical work makes it metabolically expensive.\n\nIt gives a strong glute and cardiovascular stimulus with no impact, which is an unusual combination. Leaning on the handrails offloads a large fraction of the bodyweight and quietly removes most of the exercise.",
    alternatives: [
      {
        slug: "treadmill-incline-walk",
        note: "A similar uphill demand with a shorter step, which is easier to sustain for long durations.",
      },
      {
        slug: "step-up",
        note: "The same movement loaded and controlled, which builds single-leg strength rather than conditioning.",
      },
      {
        slug: "elliptical",
        note: "Also zero-impact, but with a much smaller vertical component and correspondingly less glute involvement.",
      },
    ],
  },
  {
    slug: "elliptical",
    name: "Elliptical",
    primaryMuscle: "cardio",
    secondaryMuscles: ["quads", "glutes"],
    equipment: "machine",
    trackingType: "distance_time",
    instructions:
      "Stand tall with the whole foot on the pedals.\nDrive through the legs and push and pull the handles.\nSet resistance so the effort comes from the legs, not from momentum.",
    bodyEffect:
      "A guided elliptical foot path that mimics running or striding while the feet never leave the pedals, so there is no flight phase and no landing.\n\nThe quads, glutes and hamstrings work through a fixed range with the arms contributing if the moving handles are used. Because the path is guided and the feet stay planted, the stabilising demand is minimal.\n\nThe absence of impact makes it a practical option for anyone whose knees, shins or Achilles cannot tolerate running volume, and it will reach a genuine cardiovascular effort. The fixed path and the machine's momentum make it very easy to do at a much lower intensity than it feels.",
    alternatives: [
      {
        slug: "treadmill-run",
        note: "Real running with impact, which is a far denser stimulus and loads bone the elliptical cannot.",
      },
      {
        slug: "treadmill-incline-walk",
        note: "Also low-impact but with a much clearer relationship between effort and output — no momentum to hide in.",
      },
      {
        slug: "cycling",
        note: "Zero-impact and seated, with resistance that makes intensity far easier to quantify.",
      },
    ],
  },
  {
    slug: "jump-rope",
    name: "Jump Rope",
    primaryMuscle: "cardio",
    secondaryMuscles: ["calves"],
    equipment: "other",
    trackingType: "time",
    instructions:
      "Hold the handles at hip height and turn the rope with the wrists, not the arms.\nStay on the balls of the feet with small, quick hops.\nKeep the elbows in and the jumps low.",
    bodyEffect:
      "Continuous low-amplitude jumping, where each hop is absorbed and returned largely by the elastic tissues of the calf and foot rather than by muscular effort alone.\n\nThe calves and the Achilles tendon do most of the work in a rapid stretch-shortening cycle, the forearms turn the rope, and the trunk stays rigid. The high cycle rate drives heart rate up quickly.\n\nIt builds calf and foot stiffness and cardiovascular fitness at once with almost no equipment or space, and the coordination demand keeps it engaging. It concentrates repeated impact in the calves and Achilles, which needs building into gradually.",
    alternatives: [
      {
        slug: "treadmill-run",
        note: "Spreads the impact across a longer stride and the whole leg rather than concentrating it in the calves.",
      },
      {
        slug: "mountain-climbers",
        note: "Similar conditioning intensity with no impact through the legs, though it loads the shoulders instead.",
      },
      {
        slug: "single-leg-calf-raise",
        note: "Trains the same calf tissue through a slow controlled range, which builds strength rather than elasticity.",
      },
    ],
  },
  {
    slug: "battle-ropes",
    name: "Battle Ropes",
    primaryMuscle: "cardio",
    secondaryMuscles: ["shoulders", "abs"],
    equipment: "other",
    trackingType: "time",
    instructions:
      "Hold an end in each hand in a quarter-squat with the chest up.\nDrive waves down the ropes as fast as you can maintain.\nKeep the hips loaded rather than standing upright.",
    bodyEffect:
      "Rapid repeated arm movement against heavy ropes, where the resistance comes from accelerating the rope's mass rather than from lifting a load.\n\nThe shoulders and arms work continuously, the trunk braces and resists rotation with every alternating wave, and the legs hold a partial squat throughout. Because the arms have a small muscle mass relative to their oxygen demand, heart rate rises very quickly.\n\nIt is an effective conditioning tool that spares the legs and the joints entirely, which makes it useful after heavy lower-body work. The intensity is entirely self-selected, so it only works as hard as you decide to.",
    alternatives: [
      {
        slug: "ski-erg",
        note: "Also upper-body dominant, but with a measurable output so the effort can actually be tracked and progressed.",
      },
      {
        slug: "assault-bike",
        note: "Whole-body rather than arms-only, which reaches a far higher sustainable output.",
      },
      {
        slug: "medicine-ball-slam",
        note: "A similar upper-body power demand in discrete explosive reps rather than continuous waves.",
      },
    ],
  },
  {
    slug: "sled-push",
    name: "Sled Push",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "cardio"],
    equipment: "other",
    trackingType: "weight_time",
    instructions:
      "Load the sled and take a low forward lean with the arms extended.\nDrive with short powerful steps, keeping the hips low.\nPush the full distance without letting the torso rise.",
    bodyEffect:
      "Horizontal propulsion against a heavy resistance, with no eccentric phase at all — the legs only ever push, never absorb.\n\nThe quads, glutes and calves drive each step while the trunk and shoulders transmit force through the arms into the sled. Because nothing is lowered under load, there is essentially no muscle damage and very little soreness afterwards.\n\nThat makes it uniquely useful: heavy leg work and severe conditioning with almost no recovery cost, which is why it appears in-season in almost every sport. It builds far less muscle than a squat, precisely because the eccentric is missing.",
    alternatives: [
      {
        slug: "sled-drag",
        note: "Pulling backward loads the quads through knee extension even more directly, with the same absence of eccentric.",
      },
      {
        slug: "leg-press",
        note: "Loads the quads far heavier with a full eccentric, which builds more muscle but costs real recovery.",
      },
      {
        slug: "treadmill-incline-walk",
        note: "Similar low-impact conditioning with a strong hip-extension demand, at far lower intensity.",
      },
    ],
  },
  {
    slug: "sled-drag",
    name: "Sled Drag",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "cardio"],
    equipment: "other",
    trackingType: "weight_time",
    instructions:
      "Attach a strap or handles and walk backward, leaning away from the sled.\nStay low and extend each knee fully with every step.\nCover the full distance without standing upright.",
    bodyEffect:
      "Backward walking against a dragged load, which forces the knee to extend fully against resistance on every step.\n\nThe quadriceps do the majority of the work through knee extension, with the glutes and calves contributing and the trunk resisting the backward pull. Like a push, there is no eccentric phase, so muscle damage is minimal.\n\nBackward dragging is widely used in knee rehabilitation because it loads the quads heavily with no impact and no lowering phase, and it builds conditioning at the same time. It needs space and a sled, and it develops very little outside the quads.",
    alternatives: [
      {
        slug: "sled-push",
        note: "Facing forward shifts more work to the hips and calves and allows heavier loading over the same distance.",
      },
      {
        slug: "leg-extension",
        note: "Isolates the same knee extension with adjustable load, but seated and with no conditioning component.",
      },
      {
        slug: "leg-press",
        note: "Loads the quads far more heavily with a full eccentric, at a much higher recovery cost.",
      },
    ],
  },
  {
    slug: "farmers-carry-conditioning",
    name: "Loaded Carry Circuit",
    primaryMuscle: "cardio",
    secondaryMuscles: ["forearms", "traps"],
    equipment: "other",
    trackingType: "weight_time",
    instructions:
      "Pick a heavy implement and carry it for a set distance without stopping.\nSwitch implement or grip and repeat for the planned time.\nSet the weight down under control between rounds.",
    bodyEffect:
      "Repeated heavy carries strung together, so the whole body works isometrically to hold position while walking, round after round.\n\nThe grip and forearms hold the load, the traps resist the shoulders being pulled down, the trunk stays rigid against whatever direction the weight pulls, and the legs walk. Holding maximal isometric tension while breathing hard is what makes it so metabolically demanding.\n\nIt trains conditioning and structural strength together in a way no machine does, and it transfers directly to carrying anything in real life. Progress is measured in distance and load rather than reps, which needs a different kind of bookkeeping.",
    alternatives: [
      {
        slug: "farmers-walk",
        note: "A single carry variation done for sets rather than continuously, which allows much heavier loading per trip.",
      },
      {
        slug: "sled-push",
        note: "Similar low-skill conditioning with heavy loading, but with no grip demand at all.",
      },
      {
        slug: "assault-bike",
        note: "Reaches a higher heart rate faster, though it builds none of the structural or grip strength a carry does.",
      },
    ],
  },
  {
    slug: "shadow-boxing",
    name: "Shadow Boxing",
    primaryMuscle: "cardio",
    secondaryMuscles: ["shoulders", "obliques"],
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Move on the balls of the feet with the hands up.\nThrow punches in combinations, rotating from the hips and feet.\nKeep moving between combinations rather than standing still.",
    bodyEffect:
      "Continuous footwork combined with repeated rotational punching, so the whole body works at a moderate but unbroken intensity.\n\nThe calves and quads drive the constant movement, the obliques and hips generate the rotation for each punch, and the shoulders work continuously to keep the hands up and throw. Nothing is heavily loaded, but nothing rests either.\n\nIt is a conditioning option that needs no equipment and no space and stays interesting, which matters more for adherence than most people admit. The lack of external load means it builds no strength, and throwing punches into air with locked elbows is hard on the joints.",
    alternatives: [
      {
        slug: "jump-rope",
        note: "Similar equipment-light conditioning with the same footwork demand and a stronger calf stimulus.",
      },
      {
        slug: "battle-ropes",
        note: "A comparable upper-body conditioning demand with real external resistance rather than air.",
      },
      {
        slug: "burpee",
        note: "Higher intensity per minute with no equipment, at the cost of far more joint stress.",
      },
    ],
  },
  {
    slug: "swimming",
    name: "Swimming",
    primaryMuscle: "cardio",
    secondaryMuscles: ["lats", "shoulders"],
    equipment: "other",
    trackingType: "distance_time",
    instructions:
      "Choose a stroke and a pace you can hold for the planned distance.\nBreathe on a regular rhythm rather than only when you need to.\nCount lengths or use the pool clock to track intervals.",
    bodyEffect:
      "Propulsion through water with the bodyweight fully supported, so the resistance comes from moving water rather than from gravity and there is no impact whatsoever.\n\nThe lats and shoulders drive most strokes, the trunk holds a streamlined position and rotates, and the legs kick continuously. Breathing is constrained by the stroke, which trains breath control alongside cardiovascular capacity.\n\nZero impact plus full-body involvement makes it the most joint-sparing serious cardio available, and useful when almost nothing else can be tolerated. It does nothing for bone density and technique limits the intensity far more than fitness does.",
    alternatives: [
      {
        slug: "rowing-machine",
        note: "Similar upper-body-dominant full-body conditioning on land, with output you can measure precisely.",
      },
      {
        slug: "cycling",
        note: "Also zero-impact and far easier to quantify, though it involves only the legs.",
      },
      {
        slug: "ski-erg",
        note: "An upper-body pulling pattern on land, useful when the shoulders should work but a pool is not available.",
      },
    ],
  },
  {
    slug: "rucking",
    name: "Rucking",
    primaryMuscle: "cardio",
    secondaryMuscles: ["glutes", "traps"],
    equipment: "other",
    trackingType: "distance_time",
    instructions:
      "Load a pack with a weight you can carry with good posture.\nWalk at a brisk pace, keeping the chest up and the straps snug.\nBuild distance before building weight.",
    bodyEffect:
      "Walking under a carried load, which raises the metabolic cost of every step and adds a continuous compressive and postural demand.\n\nThe glutes and calves do more work per step than unloaded walking, the erectors and traps hold the torso upright against the pack, and the trunk resists the load's sway. Intensity sits in the moderate range but accumulates over hours.\n\nIt is the most sustainable way to accumulate large volumes of aerobic work while also loading the skeleton and posture, and it needs almost nothing. Loading too much too early puts the strain on the lower back and the feet rather than the aerobic system.",
    alternatives: [
      {
        slug: "treadmill-incline-walk",
        note: "Raises the effort through gradient rather than load, which spares the spine and the shoulders entirely.",
      },
      {
        slug: "farmers-walk",
        note: "A far heavier carry over a short distance, building structural strength rather than aerobic capacity.",
      },
      {
        slug: "treadmill-run",
        note: "Much higher intensity per minute, with impact rather than carried load as the source of stress.",
      },
    ],
  },
  {
    slug: "bike-sprints",
    name: "Bike Sprints",
    primaryMuscle: "cardio",
    secondaryMuscles: ["quads", "glutes"],
    equipment: "machine",
    trackingType: "time",
    instructions:
      "Warm up thoroughly, then sprint all-out for a short interval.\nRecover by pedalling easily for two to four times the work duration.\nRepeat for a fixed number of rounds and stop when output drops.",
    bodyEffect:
      "Repeated maximal-effort intervals against high resistance, where each sprint drains the anaerobic systems and the recovery period is what allows the next one.\n\nThe quads and glutes work at near-maximal output while the anaerobic energy systems supply the effort and the aerobic system does the recovering between rounds. The stimulus is short, intense, and entirely impact-free.\n\nInterval work of this kind improves peak power and recovery capacity far faster than steady-state riding, in a fraction of the time. It is very demanding on recovery and competes directly with heavy leg training, so it needs placing carefully in a week.",
    alternatives: [
      {
        slug: "assault-bike",
        note: "Adds the arms, which makes maximal efforts harder and involves considerably more total muscle.",
      },
      {
        slug: "cycling",
        note: "Steady-state riding builds the aerobic base with a small fraction of the recovery cost.",
      },
      {
        slug: "sled-push",
        note: "A similar all-out interval stimulus that also loads the legs heavily, with no eccentric and little soreness.",
      },
    ],
  },
];

import type { SeedExercise } from "../types";

export const ARMS: SeedExercise[] = [
  /* ---- Biceps and elbow flexors ---- */
  {
    slug: "bicep-curl-barbell",
    name: "Bicep Curl (Barbell)",
    primaryMuscle: "biceps",
    equipment: "barbell",
    instructions:
      "Hold the bar at shoulder width with the elbows at your sides.\nCurl to the front of the shoulders without letting the elbows drift forward.\nLower under control to a full stretch.",
    bodyEffect:
      "Elbow flexion with the forearm supinated and the upper arm held still at the side, so the shoulder contributes nothing and the elbow is the only working joint.\n\nBiceps brachii is the prime mover — it both flexes the elbow and holds the forearm supinated — with brachialis underneath it and brachioradialis assisting. Because both hands are fixed on one bar, the wrists cannot adjust their angle.\n\nOne implement means the heaviest loading of any curl variation, which makes it the best place to progress elbow flexion strength. The fixed grip irritates some wrists, and standing makes it easy to swing the torso once the biceps tire.",
    alternatives: [
      {
        slug: "bicep-curl-ez-bar",
        note: "The angled grip lets the wrists sit in slight rotation, which removes most of the strain a straight bar puts on them.",
      },
      {
        slug: "bicep-curl-dumbbell",
        note: "Independent bells let each wrist rotate freely and expose side-to-side differences, at the cost of total load.",
      },
      {
        slug: "cable-curl",
        note: "Constant tension through the whole range rather than falling off at the top, and much harder to swing.",
      },
    ],
  },
  {
    slug: "bicep-curl-ez-bar",
    name: "Bicep Curl (EZ Bar)",
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "barbell",
    instructions:
      "Grip the inner angles of an EZ bar, elbows at the sides.\nCurl to the shoulders keeping the upper arms still.\nLower under control to full extension.",
    bodyEffect:
      "Elbow flexion with the forearms in semi-supination, because the bar's bends let the hands turn slightly inward instead of being locked flat.\n\nBiceps brachii still drives the movement but works slightly less than in full supination, while brachialis and brachioradialis take a marginally larger share. The wrists sit in a far more neutral, comfortable position throughout.\n\nFor most people this is the barbell curl they can actually do pain-free and load heavily week after week, which makes it the more useful of the two. The trade-off is a fractionally smaller biceps contribution than a fully supinated grip gives.",
    alternatives: [
      {
        slug: "bicep-curl-barbell",
        note: "A straight bar keeps the forearms fully supinated, which recruits the biceps hardest but strains the wrists.",
      },
      {
        slug: "preacher-curl",
        note: "An angled pad fixes the upper arm completely, removing all swing and loading the stretched bottom position harder.",
      },
      {
        slug: "cable-curl",
        note: "Even tension throughout, including the top where a bar's resistance largely disappears.",
      },
    ],
  },
  {
    slug: "bicep-curl-dumbbell",
    name: "Bicep Curl (Dumbbell)",
    primaryMuscle: "biceps",
    equipment: "dumbbell",
    instructions:
      "Stand with a bell in each hand, palms forward or turning up as you curl.\nCurl to the shoulder keeping the elbow pinned at your side.\nLower slowly to a full stretch.",
    bodyEffect:
      "Elbow flexion with each forearm free to supinate through its own range, so the hand can finish fully turned up at the top of the curl.\n\nBiceps brachii both flexes the elbow and supinates the forearm, so allowing that rotation lets it shorten more completely than a fixed bar permits. Brachialis and brachioradialis assist, and each side is loaded independently.\n\nThat freedom plus the exposure of imbalances makes it the most versatile curl, and it can be done alternating, seated, or with a deliberate twist. Total load is lower than a barbell and gravity means tension disappears at the top.",
    alternatives: [
      {
        slug: "bicep-curl-barbell",
        note: "One bar allows considerably heavier loading, though the wrists are locked and any imbalance stays hidden.",
      },
      {
        slug: "incline-curl-dumbbell",
        note: "Lying back puts the upper arm behind the body, loading the biceps in a stretched position a standing curl never reaches.",
      },
      {
        slug: "hammer-curl-dumbbell",
        note: "A neutral grip shifts the work to brachialis and brachioradialis, building forearm and arm thickness rather than the biceps peak.",
      },
    ],
  },
  {
    slug: "hammer-curl-dumbbell",
    name: "Hammer Curl (Dumbbell)",
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "dumbbell",
    instructions:
      "Hold the bells with the palms facing each other, elbows at your sides.\nCurl straight up without rotating the wrists.\nLower under control to full extension.",
    bodyEffect:
      "Elbow flexion with the forearm held in neutral rotation, so the hand neither supinates nor pronates through the movement.\n\nIn neutral, biceps brachii loses mechanical advantage and brachialis — which sits underneath it and attaches to the ulna — becomes the main elbow flexor, with brachioradialis in the forearm taking a large share. Grip is loaded harder than in a supinated curl.\n\nBrachialis pushes the biceps up as it grows, so training it adds arm thickness that supinated curling alone will not, and the neutral wrist is comfortable for almost everyone. It does less for the biceps itself, so it complements rather than replaces a standard curl.",
    alternatives: [
      {
        slug: "bicep-curl-dumbbell",
        note: "Supinating puts biceps brachii in its strongest line, targeting the muscle this variation deliberately de-emphasises.",
      },
      {
        slug: "reverse-curl",
        note: "Pronating instead of staying neutral shifts even more work to brachioradialis and the wrist extensors.",
      },
      {
        slug: "rope-hammer-curl",
        note: "Keeps the neutral grip but adds constant cable tension, so the top of the curl stays loaded.",
      },
    ],
  },
  {
    slug: "rope-hammer-curl",
    name: "Rope Hammer Curl (Cable)",
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "cable",
    instructions:
      "Attach a rope to a low pulley and hold both ends with palms facing each other.\nCurl up keeping the elbows pinned to your sides.\nLower slowly against the cable.",
    bodyEffect:
      "Neutral-grip elbow flexion against a cable, so the resistance stays constant from full extension to full flexion rather than dropping off at the top.\n\nBrachialis and brachioradialis do most of the work in the neutral position, with biceps brachii assisting. Constant tension means the shortened top position is genuinely loaded, which free weights cannot manage.\n\nThe combination of neutral wrists and continuous tension makes it one of the more comfortable and productive arm-thickness movements, and the rope allows a slight spread at the top for extra contraction. Load is capped by the stack and by how well you can keep the elbows still.",
    alternatives: [
      {
        slug: "hammer-curl-dumbbell",
        note: "Free weights load the bottom of the range harder and need no cable, but the top of the curl goes weightless.",
      },
      {
        slug: "cable-curl",
        note: "A supinated grip on the same setup, shifting the emphasis back onto biceps brachii.",
      },
      {
        slug: "reverse-curl",
        note: "Pronating the grip pushes even more work onto brachioradialis and the wrist extensors.",
      },
    ],
  },
  {
    slug: "cable-curl",
    name: "Cable Curl",
    primaryMuscle: "biceps",
    equipment: "cable",
    instructions:
      "Attach a straight or EZ bar to a low pulley and stand a step back.\nCurl to the shoulders with the elbows pinned at your sides.\nLower slowly, resisting the pull all the way down.",
    bodyEffect:
      "Supinated elbow flexion against a cable, where the line of pull runs at an angle rather than straight down, so tension persists across the whole range.\n\nBiceps brachii is the prime mover with brachialis assisting. The critical difference from a free-weight curl is at the top: a bar goes nearly weightless when the forearm passes vertical, while the cable keeps pulling.\n\nThat constant tension makes it excellent for accumulating time under load and for finishing a session, and the fixed line makes swinging obvious. Absolute loading is lower than a barbell, and the elbows drift forward easily if you are not paying attention.",
    alternatives: [
      {
        slug: "bicep-curl-barbell",
        note: "Loads far heavier and needs no machine, but resistance largely disappears at the top of the curl.",
      },
      {
        slug: "bayesian-curl",
        note: "Standing in front of the pulley puts the arm behind the body, adding a stretched position the standing version cannot reach.",
      },
      {
        slug: "preacher-curl",
        note: "The pad fixes the upper arm entirely, which removes all cheating and loads the bottom of the range hardest.",
      },
    ],
  },
  {
    slug: "bayesian-curl",
    name: "Bayesian Curl (Cable)",
    primaryMuscle: "biceps",
    equipment: "cable",
    instructions:
      "Set a single handle at a low pulley and stand facing away, arm back behind the torso.\nCurl up without letting the elbow travel forward.\nLower slowly until the arm is fully extended behind you.",
    bodyEffect:
      "Elbow flexion performed with the upper arm held behind the torso, so the shoulder is extended and the biceps — which crosses both the shoulder and the elbow — starts from a fully lengthened position.\n\nBiceps brachii is loaded at long muscle lengths throughout, the position where mechanical tension is highest and where most of the growth stimulus in a muscle comes from. The cable keeps that stretched bottom position genuinely loaded.\n\nThis is the most effective stretch-position curl available, and the combination of the shoulder angle and constant tension is what makes it different from every other curl. It is one arm at a time and the loads are small, since the stretched position is mechanically weak.",
    alternatives: [
      {
        slug: "incline-curl-dumbbell",
        note: "Achieves a similar behind-the-body arm position with free weights, but tension disappears at the top of the curl.",
      },
      {
        slug: "cable-curl",
        note: "Standing with the arms at the sides is faster and heavier, but never reaches the stretched shoulder-extended position.",
      },
      {
        slug: "preacher-curl",
        note: "Loads the opposite end — hardest at the bottom of the range with the arm in front of the body rather than behind it.",
      },
    ],
  },
  {
    slug: "incline-curl-dumbbell",
    name: "Incline Curl (Dumbbell)",
    primaryMuscle: "biceps",
    equipment: "dumbbell",
    instructions:
      "Sit back on a bench set to about 60° with the arms hanging straight down.\nCurl without letting the elbows travel forward.\nLower to a full stretch, arms hanging behind the torso.",
    bodyEffect:
      "Elbow flexion with the upper arm hanging behind the body, so the shoulder is slightly extended and the biceps — which crosses the shoulder as well as the elbow — begins fully lengthened.\n\nThat stretched starting position loads biceps brachii, particularly the long head, at long muscle lengths where the tension is greatest. Brachialis assists, and the bench prevents any body English entirely.\n\nThe stretch and the strict position make it one of the best biceps hypertrophy movements, and it exposes any tendency to swing immediately. Resistance vanishes near the top, and the stretched bottom position with heavy bells can aggravate the elbow.",
    alternatives: [
      {
        slug: "bayesian-curl",
        note: "Reaches the same stretched arm position while keeping tension on through the top, where dumbbells go slack.",
      },
      {
        slug: "bicep-curl-dumbbell",
        note: "Standing lets you use more weight and is easier on the elbow, but the arm never gets behind the body.",
      },
      {
        slug: "preacher-curl",
        note: "Loads the opposite end of the range, with the pad in front and the hardest point at the bottom of the curl.",
      },
    ],
  },
  {
    slug: "preacher-curl",
    name: "Preacher Curl",
    primaryMuscle: "biceps",
    equipment: "barbell",
    instructions:
      "Set the pad so the armpits rest at the top and the upper arms lie flat.\nCurl the bar up without lifting the elbows off the pad.\nLower slowly and stop just short of a locked elbow.",
    bodyEffect:
      "Elbow flexion with the upper arm resting on an angled pad, which fixes the shoulder in slight flexion and makes any swinging or elbow drift physically impossible.\n\nBiceps brachii and brachialis do all the work, and because the shoulder is flexed forward the long head of the biceps starts shortened — which is why the bottom of the range feels hardest and the top feels easy.\n\nThat resistance profile makes it the strictest curl there is and the one that loads the lengthened elbow position hardest. The same bottom position is where the biceps tendon is most exposed, so locking out hard with heavy weight is how people hurt an elbow here.",
    alternatives: [
      {
        slug: "incline-curl-dumbbell",
        note: "Puts the arm behind the body instead of in front, loading the long head in a genuinely stretched position.",
      },
      {
        slug: "spider-curl",
        note: "The vertical side of the pad makes the top of the curl hardest instead of the bottom — the opposite resistance profile.",
      },
      {
        slug: "cable-curl",
        note: "Constant tension across the whole range rather than a sharp peak at one end, and no stress on a locked-out elbow.",
      },
    ],
  },
  {
    slug: "spider-curl",
    name: "Spider Curl",
    primaryMuscle: "biceps",
    equipment: "dumbbell",
    instructions:
      "Lie face down on an incline bench with the arms hanging straight down.\nCurl up to the shoulders, keeping the upper arms vertical.\nLower slowly to full extension.",
    bodyEffect:
      "Elbow flexion with the upper arm hanging vertically beneath the shoulder, so the resistance arm is longest when the forearm is horizontal at the top of the curl.\n\nBiceps brachii and brachialis do all of the work with the shoulder held still by the bench. The peak difficulty sits at the fully contracted position, the exact opposite of a preacher curl.\n\nThat makes it an excellent shortened-position movement and a good pairing with any curl that loads the stretch. The chest-down position restricts breathing and the loads have to stay light, so it works best as a finisher.",
    alternatives: [
      {
        slug: "preacher-curl",
        note: "The angled pad makes the bottom of the range hardest instead of the top — the complementary resistance profile.",
      },
      {
        slug: "concentration-curl",
        note: "Also loads the shortened position hard, seated and one arm at a time, with the elbow braced on the thigh.",
      },
      {
        slug: "cable-curl",
        note: "Even tension across the whole range rather than concentrating it at one end.",
      },
    ],
  },
  {
    slug: "concentration-curl",
    name: "Concentration Curl",
    primaryMuscle: "biceps",
    equipment: "dumbbell",
    instructions:
      "Sit and brace the back of your upper arm against the inside of the thigh.\nCurl the bell to the shoulder, supinating fully at the top.\nLower slowly to full extension.",
    bodyEffect:
      "One-armed elbow flexion with the upper arm braced against the thigh, so the shoulder cannot move and the resistance arm is longest near the top of the curl.\n\nBiceps brachii does nearly all of the work with brachialis assisting; the thigh brace removes every possible contribution from the shoulder or torso. Full supination at the top shortens the biceps as completely as it can.\n\nThe strict position and the peak contraction make it a good way to actually feel the biceps working, which is why it survives as a finisher. It is slow, uses light weight, and loads only one end of the range.",
    alternatives: [
      {
        slug: "spider-curl",
        note: "The same peak-contraction emphasis with both arms at once, at the cost of the thigh brace's absolute strictness.",
      },
      {
        slug: "incline-curl-dumbbell",
        note: "Loads the opposite end — a deep stretch with the arm behind the body rather than a hard squeeze at the top.",
      },
      {
        slug: "cable-curl",
        note: "Constant tension through the whole range and both arms at once, far more efficient for accumulating volume.",
      },
    ],
  },
  {
    slug: "reverse-curl",
    name: "Reverse Curl",
    primaryMuscle: "forearms",
    secondaryMuscles: ["biceps"],
    equipment: "barbell",
    instructions:
      "Hold an EZ or straight bar with an overhand grip, elbows at your sides.\nCurl up without letting the wrists drop back.\nLower slowly to full extension.",
    bodyEffect:
      "Elbow flexion with the forearm fully pronated, which puts biceps brachii at its worst mechanical advantage and forces other muscles to take over.\n\nBrachioradialis — the large forearm muscle running from the elbow to the wrist — becomes the main elbow flexor, with brachialis assisting and the wrist extensors working isometrically to hold the hand from dropping. The biceps contributes comparatively little.\n\nIt is the most direct way to build the upper forearm and the brachioradialis, which fills out the arm from elbow to wrist. Loads are much lower than a supinated curl and the wrists complain quickly if the grip is too wide.",
    alternatives: [
      {
        slug: "hammer-curl-dumbbell",
        note: "A neutral grip keeps brachioradialis heavily involved while allowing considerably more load than full pronation.",
      },
      {
        slug: "wrist-extension",
        note: "Isolates the wrist extensors alone rather than loading them isometrically as part of an elbow-flexion movement.",
      },
      {
        slug: "bicep-curl-ez-bar",
        note: "Supinating the grip shifts the work back to the biceps and allows far heavier loading.",
      },
    ],
  },
  {
    slug: "drag-curl",
    name: "Drag Curl",
    primaryMuscle: "biceps",
    equipment: "barbell",
    instructions:
      "Hold a bar at shoulder width against the thighs.\nCurl by dragging the bar straight up the body, letting the elbows travel back.\nLower along the same path under control.",
    bodyEffect:
      "Elbow flexion combined with shoulder extension: instead of the elbow staying pinned, it travels backward as the bar drags up the torso, so the upper arm moves behind the body.\n\nThat shoulder extension keeps the long head of the biceps from going slack at the top, so it stays loaded through a position where an ordinary curl loses tension. Brachialis assists and the rear delts and lats contribute to drawing the elbows back.\n\nIt trains the biceps in its shortened position more completely than a standard curl, and the short bar path makes it easy to do strictly. The range is small and the loads modest, so it is a supplement rather than a primary curl.",
    alternatives: [
      {
        slug: "bicep-curl-barbell",
        note: "Keeping the elbows pinned gives a longer range and much heavier loading, but the top of the curl goes slack.",
      },
      {
        slug: "spider-curl",
        note: "Also emphasises the shortened position, but does it by changing the bench angle rather than by moving the elbow.",
      },
      {
        slug: "cable-curl",
        note: "Constant tension across the full range without needing to change the elbow path at all.",
      },
    ],
  },
  {
    slug: "zottman-curl",
    name: "Zottman Curl",
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "dumbbell",
    instructions:
      "Curl up with the palms supinated as in a normal curl.\nAt the top, rotate the palms to face down.\nLower slowly in the pronated position, then rotate back at the bottom.",
    bodyEffect:
      "A curl that changes grip mid-rep: supinated on the way up, pronated on the way down, so each phase loads a different muscle.\n\nThe concentric is a standard biceps curl driven by biceps brachii, while the eccentric is a reverse curl lowered under control, loading brachioradialis and the wrist extensors in the lengthening phase where they are strongest. The rotation itself trains the forearm's pronators and supinators.\n\nIt covers biceps, brachioradialis and forearm rotation in one movement, which makes it efficient when time is short. The weight is limited by whichever phase is weakest — the pronated lowering — so the biceps get less than a dedicated curl would give.",
    alternatives: [
      {
        slug: "bicep-curl-dumbbell",
        note: "Staying supinated throughout lets you load the biceps considerably heavier without the pronated phase capping the weight.",
      },
      {
        slug: "reverse-curl",
        note: "Trains only the pronated portion, but through both phases and with a heavier load than the Zottman's eccentric alone.",
      },
      {
        slug: "hammer-curl-dumbbell",
        note: "A neutral grip covers brachialis and brachioradialis without any rotation to manage mid-set.",
      },
    ],
  },
  {
    slug: "chin-up-weighted",
    name: "Weighted Chin Up",
    primaryMuscle: "biceps",
    secondaryMuscles: ["lats", "back"],
    equipment: "bodyweight",
    trackingType: "weight_reps",
    instructions:
      "Hang from a bar with an underhand grip and weight on a belt or between the feet.\nPull until the chin clears the bar.\nLower to a full hang under control.",
    bodyEffect:
      "A closed-chain vertical pull with the forearms supinated and external load added, so both the lats and the elbow flexors work against far more than bodyweight.\n\nBiceps brachii is heavily loaded because the supinated grip puts it in its strongest position, while latissimus dorsi and teres major drive the shoulder extension. The trunk works to stop the load swinging.\n\nIt is the heaviest thing the biceps can be exposed to, and heavy elbow flexion under compound load builds arms in a way isolation curls cannot match. The back is doing much of the work, so it does not replace direct curling if arm size is the specific goal.",
    alternatives: [
      {
        slug: "chin-up",
        note: "The same movement at bodyweight, which is where to build the reps before adding a belt.",
      },
      {
        slug: "bicep-curl-barbell",
        note: "Isolates the elbow flexors so all of the load reaches the biceps rather than being shared with the lats.",
      },
      {
        slug: "lat-pulldown-underhand",
        note: "Same grip and pulling line with adjustable load, so it can be scaled below bodyweight or run past failure.",
      },
      {
        slug: "pull-up-weighted",
        note: "The overhand version on the same belt, which weakens the elbow flexors and shifts the emphasis toward the lats.",
      },
    ],
  },
  /* ---- Triceps ---- */
  {
    slug: "close-grip-bench-press",
    name: "Close Grip Bench Press",
    primaryMuscle: "triceps",
    secondaryMuscles: ["chest"],
    equipment: "barbell",
    instructions:
      "Grip the bar at about shoulder width — not narrower.\nLower to the lower chest with the elbows tucked close to the ribs.\nPress up, driving through the triceps at lockout.",
    bodyEffect:
      "A horizontal press with the elbows held close to the torso, which lengthens the distance the elbow has to travel and shortens the shoulder's contribution.\n\nAll three heads of triceps brachii do the majority of the work, especially through the top half of the press, with the sternal chest and anterior deltoid assisting. Tucking the elbows also puts the shoulder in its most stable position.\n\nBecause it is a compound press, it loads the triceps far heavier than any extension movement can, which makes it the best triceps mass and lockout-strength builder. Gripping too narrow strains the wrists and adds nothing — shoulder width is the useful position.",
    alternatives: [
      {
        slug: "dip-triceps",
        note: "Also a heavy compound press for the triceps, but the vertical path and free shoulder blades load the long head through more range.",
      },
      {
        slug: "skull-crusher-barbell",
        note: "Isolates the elbow so the chest cannot help, targeting the long head under stretch at a fraction of the load.",
      },
      {
        slug: "bench-press-barbell",
        note: "A wider grip flares the elbows and hands most of the work to the chest instead of the triceps.",
      },
    ],
  },
  {
    slug: "dip-triceps",
    name: "Dip (Triceps)",
    primaryMuscle: "triceps",
    secondaryMuscles: ["chest"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Support yourself on parallel bars with the torso upright.\nLower with the elbows tracking straight back until the upper arms are parallel to the floor.\nPress back up to a full lockout.",
    bodyEffect:
      "A vertical closed-chain press performed with the torso upright, so the upper arm travels straight back and down and the shoulder contributes little.\n\nStaying upright is what makes it a triceps movement: all three heads extend the elbow against full bodyweight, with the chest assisting only slightly and the shoulder blades free to move on the ribcage. Leaning forward instead hands the work to the lower chest.\n\nFull bodyweight through a long range makes it one of the heaviest triceps movements available, and it loads easily with a belt. The deep bottom position stresses the front of the shoulder and the elbow, so range should be earned rather than forced.",
    alternatives: [
      {
        slug: "close-grip-bench-press",
        note: "Similar heavy compound triceps loading with the torso supported, which is far kinder to the shoulder.",
      },
      {
        slug: "dip-chest",
        note: "Leaning forward on the same bars shifts most of the work from the triceps to the lower chest.",
      },
      {
        slug: "bench-dip",
        note: "A far lighter version using a bench, though the fixed hand position puts the shoulder in a more awkward rotation.",
      },
      {
        slug: "dip-weighted",
        note: "The same bars with weight on a belt, which is how to keep loading dips once bodyweight reps stop being hard.",
      },
    ],
  },
  {
    slug: "bench-dip",
    name: "Bench Dip",
    primaryMuscle: "triceps",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hands on a bench behind you, legs out in front on the floor or another bench.\nLower until the upper arms are roughly parallel to the floor.\nPress back up to a full lockout.",
    bodyEffect:
      "Elbow extension against part of your bodyweight, with the hands fixed behind the body so the shoulder sits in extension and internal rotation throughout.\n\nAll three heads of the triceps extend the elbow, with the long head loaded by the shoulder's extended position. The chest and front delt contribute little.\n\nIt needs nothing but a bench and scales easily by moving the feet, which is why it is a staple of equipment-free training. The behind-the-body hand position is the least shoulder-friendly of any triceps movement, and going deep in it is a common route to a front-shoulder problem.",
    alternatives: [
      {
        slug: "dip-triceps",
        note: "Parallel bars let the shoulders sit in a neutral position rather than behind the body, which is far safer under load.",
      },
      {
        slug: "close-grip-push-up",
        note: "Similar bodyweight triceps loading with the shoulders in front of the body, where they are much more comfortable.",
      },
      {
        slug: "tricep-pushdown-cable",
        note: "Isolates the triceps with adjustable load and no shoulder stress at all.",
      },
    ],
  },
  {
    slug: "close-grip-push-up",
    name: "Close Grip Push Up",
    primaryMuscle: "triceps",
    secondaryMuscles: ["chest", "abs"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Set the hands under the shoulders or slightly narrower.\nLower with the elbows tracking back along the ribs, not flaring out.\nPress up to a full lockout.",
    bodyEffect:
      "A push-up with the hands narrow and the elbows tucked, which increases how far the elbow must travel and reduces the chest's leverage.\n\nThe triceps become the primary mover, with the sternal chest and anterior deltoid assisting; as in any push-up, serratus anterior protracts the shoulder blades and the trunk holds a rigid plank throughout.\n\nIt gives a genuine triceps stimulus with no equipment and none of the shoulder stress of bench dips, and scales through hand elevation or added load. The ceiling is bodyweight, so it stops being a strength stimulus once sets run long.",
    alternatives: [
      {
        slug: "close-grip-bench-press",
        note: "The same tucked pressing pattern with adjustable external load, which allows genuine progressive overload.",
      },
      {
        slug: "dip-triceps",
        note: "Loads the triceps with full bodyweight through a longer range, but demands much more of the shoulder.",
      },
      {
        slug: "bench-dip",
        note: "Also equipment-light, though the hands-behind-the-body position is considerably harder on the shoulder.",
      },
    ],
  },
  {
    slug: "tricep-pushdown-cable",
    name: "Tricep Pushdown (Cable)",
    primaryMuscle: "triceps",
    equipment: "cable",
    instructions:
      "Attach a bar or rope high and stand a step back with the elbows pinned to your sides.\nExtend the elbows until the arms are straight.\nReturn under control without letting the elbows drift forward.",
    bodyEffect:
      "Isolated elbow extension with the upper arm held vertical at the side, so the shoulder is neutral and only the elbow moves.\n\nThe lateral and medial heads of the triceps do most of the work, since the long head — which also crosses the shoulder — is in a shortened position and contributes less. Constant cable tension keeps the load on from stretch to lockout.\n\nIt is the most controllable triceps isolation, easy to load precisely and easy to take to failure, which makes it the default finisher after pressing. Because it under-trains the long head, it works best paired with an overhead extension.",
    alternatives: [
      {
        slug: "overhead-tricep-extension-cable",
        note: "Putting the arm overhead stretches the long head, training the part of the triceps a pushdown largely misses.",
      },
      {
        slug: "tricep-pushdown-rope",
        note: "A rope lets the hands separate at lockout, adding a little more shortening than a fixed bar allows.",
      },
      {
        slug: "close-grip-bench-press",
        note: "A compound press that loads the triceps several times heavier, though it shares the work with the chest.",
      },
    ],
  },
  {
    slug: "tricep-pushdown-rope",
    name: "Tricep Pushdown (Rope)",
    primaryMuscle: "triceps",
    equipment: "cable",
    instructions:
      "Attach a rope high and hold both ends with the elbows pinned at your sides.\nExtend the elbows and pull the rope ends apart at the bottom.\nReturn under control to a full stretch.",
    bodyEffect:
      "Elbow extension against a cable with a rope that allows the hands to separate and rotate outward as the arm straightens.\n\nThe lateral and medial heads of the triceps do the extending, and spreading the rope at lockout adds a small amount of extra shortening the fixed path of a bar prevents. The long head remains under-loaded because the shoulder stays neutral.\n\nThe free hand path suits most wrists and elbows better than a straight bar, which makes it the more comfortable pushdown for many people. The load has to be lighter than a bar allows because controlling the rope is part of the effort.",
    alternatives: [
      {
        slug: "tricep-pushdown-cable",
        note: "A fixed bar allows heavier loading and a simpler path, but the wrists are locked and the hands cannot separate.",
      },
      {
        slug: "overhead-tricep-extension-cable",
        note: "Moves the arm overhead so the long head is stretched — the portion pushdowns of any kind leave under-trained.",
      },
      {
        slug: "tricep-kickback",
        note: "Extends the shoulder as well, which loads the shortened position hard but with far less usable weight.",
      },
    ],
  },
  {
    slug: "overhead-tricep-extension-dumbbell",
    name: "Overhead Tricep Extension (Dumbbell)",
    primaryMuscle: "triceps",
    equipment: "dumbbell",
    instructions:
      "Hold one bell overhead with both hands, elbows pointing forward.\nLower it behind the head until the triceps stretch.\nExtend back up without letting the elbows flare.",
    bodyEffect:
      "Elbow extension with the shoulder fully flexed overhead, so the long head of the triceps — which attaches above the shoulder joint — is stretched across both joints at once.\n\nThat overhead position is what makes it different from a pushdown: the long head is loaded at long muscle lengths where the tension is greatest, while the lateral and medial heads assist. The abs must work to stop the ribs flaring as the weight goes back.\n\nLoading the long head under stretch is the most productive thing you can do for triceps size, and this is the simplest way to achieve it. The overhead position needs shoulder mobility, and the bottom position stresses the elbow if the weight is too heavy.",
    alternatives: [
      {
        slug: "overhead-tricep-extension-cable",
        note: "Same stretched overhead position with constant tension, so the load does not fall off as the arm straightens.",
      },
      {
        slug: "skull-crusher-barbell",
        note: "Lying down keeps the long head partly stretched with much less demand on shoulder mobility, and allows more weight.",
      },
      {
        slug: "tricep-pushdown-cable",
        note: "Keeps the arm at the side, which is easier on the shoulder and elbow but leaves the long head largely untrained.",
      },
    ],
  },
  {
    slug: "overhead-tricep-extension-cable",
    name: "Overhead Tricep Extension (Cable)",
    primaryMuscle: "triceps",
    equipment: "cable",
    instructions:
      "Attach a rope low or at head height and face away from the stack.\nWith the elbows high beside the head, extend the arms forward and up.\nReturn slowly until the triceps stretch fully behind the head.",
    bodyEffect:
      "Elbow extension with the shoulder held in flexion and a cable pulling from behind, so the long head of the triceps is stretched and loaded from full flexion right through to lockout.\n\nThe long head takes the largest share because it crosses the shoulder and is lengthened by the overhead position, with the lateral and medial heads assisting. Constant cable tension means the stretched position is genuinely resisted rather than merely reached.\n\nThe combination of a stretched long head and continuous tension makes this the most complete triceps isolation movement. Setup is fiddlier than a pushdown and the load is limited by how well you can anchor your torso.",
    alternatives: [
      {
        slug: "overhead-tricep-extension-dumbbell",
        note: "Simpler setup and heavier in the stretch, but tension falls away as the arm approaches lockout.",
      },
      {
        slug: "skull-crusher-barbell",
        note: "A lying version that still loads the long head, allows more weight and demands far less shoulder mobility.",
      },
      {
        slug: "tricep-pushdown-rope",
        note: "Arms at the sides, which is easier on the shoulder but leaves the long head in a shortened, under-loaded position.",
      },
    ],
  },
  {
    slug: "skull-crusher-barbell",
    name: "Skull Crusher (Barbell)",
    primaryMuscle: "triceps",
    equipment: "barbell",
    instructions:
      "Lie flat holding an EZ or straight bar with the arms vertical.\nBend at the elbows and lower the bar toward the forehead or just behind it.\nExtend back up without letting the upper arms drift.",
    bodyEffect:
      "Elbow extension performed lying down with the upper arms held roughly vertical, so the shoulder is flexed to about ninety degrees and the long head sits partly stretched.\n\nAll three heads extend the elbow, with the long head loaded more than in a pushdown because of the shoulder angle — and more still if the bar travels behind the head rather than to the forehead. The abs brace lightly against the load.\n\nIt loads the triceps heavily through a long range with a stable setup, which is why it remains one of the most effective mass builders for the muscle. It is also hard on the elbows, and the name is a fair warning about letting the bar drop.",
    alternatives: [
      {
        slug: "overhead-tricep-extension-cable",
        note: "Takes the arm fully overhead, stretching the long head further and keeping tension constant through lockout.",
      },
      {
        slug: "skull-crusher-dumbbell",
        note: "Independent bells let the wrists and elbows find a comfortable angle, which usually eases elbow discomfort.",
      },
      {
        slug: "close-grip-bench-press",
        note: "A compound press that loads the triceps far heavier with much less strain on the elbow joint.",
      },
    ],
  },
  {
    slug: "skull-crusher-dumbbell",
    name: "Skull Crusher (Dumbbell)",
    primaryMuscle: "triceps",
    equipment: "dumbbell",
    instructions:
      "Lie flat holding a bell in each hand with the arms vertical, palms facing each other.\nBend the elbows and lower the bells beside the head.\nExtend back up, keeping the upper arms still.",
    bodyEffect:
      "Elbow extension lying down with the forearms free to rotate, so each arm can find the wrist and elbow angle that suits it.\n\nAll three triceps heads extend the elbow, with the long head partly stretched by the flexed shoulder position. The neutral grip and independent path reduce the rotational strain a fixed bar places on the elbow.\n\nThat comfort is the main reason to choose it — it delivers most of a barbell skull crusher's stimulus at loads a sore elbow will tolerate, and exposes side-to-side differences. Absolute loading is lower and heavy bells are awkward to get into position.",
    alternatives: [
      {
        slug: "skull-crusher-barbell",
        note: "One bar loads heavier and is easier to set up, but the fixed grip is what irritates many people's elbows.",
      },
      {
        slug: "overhead-tricep-extension-dumbbell",
        note: "Taking the arms fully overhead stretches the long head further, though it demands more shoulder mobility.",
      },
      {
        slug: "tricep-pushdown-rope",
        note: "Standing with the elbows at the sides places the least stress on the elbow joint of any extension variation.",
      },
    ],
  },
  {
    slug: "jm-press",
    name: "JM Press",
    primaryMuscle: "triceps",
    secondaryMuscles: ["chest"],
    equipment: "barbell",
    instructions:
      "Lie flat with a close grip and the elbows tucked.\nLower the bar toward the upper chest and throat on a diagonal, letting the elbows travel forward.\nPress back up along the same path.",
    bodyEffect:
      "A hybrid between a close-grip press and a skull crusher: the bar travels on a diagonal so the elbow both flexes deeply and moves forward, loading the triceps across a longer range than either movement alone.\n\nAll three heads work hard, with the long head loaded by the shoulder position and the medial head heavily involved in the deep elbow flexion at the bottom. The chest contributes far less than in a normal press.\n\nIt is a well-regarded lockout and triceps-strength builder among powerlifters because it loads the triceps heavily in the position where a bench press stalls. The bar path is unusual and takes practice, and the deep bottom position is demanding on the elbow.",
    alternatives: [
      {
        slug: "close-grip-bench-press",
        note: "A simpler bar path that loads heavier overall, though the triceps work through a shorter elbow range.",
      },
      {
        slug: "skull-crusher-barbell",
        note: "Isolates the elbow more completely with no chest contribution, at a fraction of the load.",
      },
      {
        slug: "tricep-pushdown-cable",
        note: "Far easier on the elbow and simple to control, but nowhere near the loading a pressing movement provides.",
      },
    ],
  },
  {
    slug: "tricep-kickback",
    name: "Tricep Kickback",
    primaryMuscle: "triceps",
    equipment: "dumbbell",
    instructions:
      "Hinge forward with the upper arm held parallel to the torso.\nExtend the elbow until the arm is straight behind you.\nLower slowly without letting the upper arm drop.",
    bodyEffect:
      "Elbow extension with the shoulder held in extension, so the arm finishes fully straight behind the body and the triceps reaches its most shortened position.\n\nAll three heads extend the elbow, and the extended shoulder means the long head is shortened rather than stretched. Because the forearm is horizontal only at the very end, resistance peaks precisely at lockout.\n\nThat makes it a peak-contraction movement, useful as a finisher and for feeling the triceps work. The loads are tiny by necessity, the useful portion of the range is short, and it is easily the least productive triceps exercise per set.",
    alternatives: [
      {
        slug: "tricep-pushdown-cable",
        note: "Loads the same elbow extension through the whole range with far more weight and no hinge to hold.",
      },
      {
        slug: "overhead-tricep-extension-cable",
        note: "Stretches the long head instead of shortening it, which is a much stronger stimulus for growth.",
      },
      {
        slug: "close-grip-bench-press",
        note: "A compound press that loads the triceps many times heavier, and is the better use of the same training time.",
      },
    ],
  },
  {
    slug: "tricep-extension-machine",
    name: "Tricep Extension (Machine)",
    primaryMuscle: "triceps",
    equipment: "machine",
    instructions:
      "Set the seat so the elbows line up with the machine's pivot.\nExtend the arms against the pads until straight.\nReturn under control without letting the stack rest.",
    bodyEffect:
      "Elbow extension along a fixed arc with the upper arms supported, so the shoulder is held in place and the only variable is how hard the triceps push.\n\nAll three heads extend the elbow; which head dominates depends on the machine's arm position, with more shoulder flexion loading the long head more. No stabilising or grip strength is required.\n\nBeing fully supported makes it the easiest triceps movement to take to failure and to drop-set safely, which suits a muscle that responds well to volume. The pivot must line up with your elbow, and none of the stabilising carries over to pressing.",
    alternatives: [
      {
        slug: "tricep-pushdown-cable",
        note: "Similar isolation with a free path, so the arms are not constrained to the machine's arc and setup is quicker.",
      },
      {
        slug: "overhead-tricep-extension-cable",
        note: "Puts the shoulder overhead to stretch the long head, which most machines' arm positions cannot achieve.",
      },
      {
        slug: "close-grip-bench-press",
        note: "A compound press with several times the loading, building triceps strength the machine cannot.",
      },
    ],
  },
  /* ---- Forearms and grip ---- */
  {
    slug: "wrist-curl",
    name: "Wrist Curl",
    primaryMuscle: "forearms",
    equipment: "dumbbell",
    instructions:
      "Rest the forearms on a bench or your thighs with the palms up and wrists hanging over the edge.\nLet the weight roll to the fingertips, then curl it back up.\nMove only at the wrist.",
    bodyEffect:
      "Wrist flexion in isolation, with the forearm supported so only the hand moves and letting the bar roll to the fingertips adds a finger-flexion component.\n\nThe wrist flexors on the inside of the forearm — flexor carpi radialis and ulnaris, and the finger flexors — do all the work. Nothing above the elbow contributes.\n\nIt is the most direct way to build forearm flexor size and to strengthen a grip that gives out before the back does during heavy pulling. The range is small and the muscles small, so it is a genuinely minor accessory.",
    alternatives: [
      {
        slug: "wrist-extension",
        note: "Trains the opposite side of the forearm, which is usually the weaker and more neglected of the two.",
      },
      {
        slug: "farmers-walk",
        note: "Builds grip and forearm endurance isometrically under a heavy load, which transfers to pulling far better.",
      },
      {
        slug: "dead-hang",
        note: "A pure isometric grip and shoulder movement that also decompresses the shoulder, with no wrist movement at all.",
      },
    ],
  },
  {
    slug: "wrist-extension",
    name: "Wrist Extension",
    primaryMuscle: "forearms",
    equipment: "dumbbell",
    instructions:
      "Rest the forearms palms-down on a bench or your thighs, wrists over the edge.\nRaise the back of the hand as high as it will go.\nLower slowly. Use very light weight.",
    bodyEffect:
      "Wrist extension in isolation, with the forearm supported and only the hand moving upward against gravity.\n\nThe wrist extensors on the back of the forearm — extensor carpi radialis and ulnaris — do all the work. These are the muscles that stabilise the wrist during every gripping task and whose tendons are involved in tennis elbow.\n\nStrengthening them is one of the more useful things you can do for elbow durability, particularly for anyone who grips hard or plays a racket sport. The muscles are small and the loads correspondingly tiny; using anything meaningful just means the whole forearm cheats.",
    alternatives: [
      {
        slug: "reverse-curl",
        note: "Loads the wrist extensors isometrically as part of an elbow-flexion movement, adding brachioradialis work at the same time.",
      },
      {
        slug: "wrist-curl",
        note: "Trains the opposing flexors, which are already well worked by any gripping — a complement, not a substitute.",
      },
      {
        slug: "reverse-wrist-curl-barbell",
        note: "The same extension pattern with a bar, which loads both wrists identically and is easier to progress.",
      },
    ],
  },
  {
    slug: "reverse-wrist-curl-barbell",
    name: "Reverse Wrist Curl (Barbell)",
    primaryMuscle: "forearms",
    equipment: "barbell",
    instructions:
      "Rest the forearms on a bench palms-down, holding a light bar with the wrists over the edge.\nRaise the backs of the hands as far as they will go.\nLower slowly under control.",
    bodyEffect:
      "Wrist extension against a bar, with the forearms supported so both wrists move together through an identical range.\n\nThe wrist extensors on the back of the forearm do all the work, with the finger extensors assisting slightly. As with any wrist movement the range is short and the leverage poor.\n\nA bar makes it easy to progress in small, even increments and ensures neither side compensates, which is why it is the more practical version for regular elbow-health work. The loads remain very small and should stay that way.",
    alternatives: [
      {
        slug: "wrist-extension",
        note: "Dumbbells let each wrist move independently, which matters when one side is noticeably weaker or sorer.",
      },
      {
        slug: "reverse-curl",
        note: "Trains the extensors isometrically while also loading brachioradialis through a full elbow range.",
      },
      {
        slug: "wrist-curl",
        note: "The opposing flexion movement — worth pairing with this rather than choosing between them.",
      },
    ],
  },
  {
    slug: "farmers-walk",
    name: "Farmer's Walk",
    primaryMuscle: "forearms",
    secondaryMuscles: ["traps", "abs"],
    equipment: "dumbbell",
    trackingType: "weight_time",
    instructions:
      "Pick up a heavy weight in each hand and stand tall.\nWalk with short, controlled steps, ribs down and shoulders back.\nSet the weights down under control — do not drop them.",
    bodyEffect:
      "A loaded carry: everything works isometrically while the legs move. Nothing lengthens or shortens under load except the muscles that produce the steps.\n\nThe finger flexors and forearms hold the grip, the upper traps and levator scapulae resist the shoulders being pulled down, and the abs, obliques and erectors keep the spine upright against a load that wants to fold or tip it. The glutes and legs walk it.\n\nIt builds grip endurance, trap size and trunk stiffness at once, and it is about as directly applicable to real life as gym work gets. Because it is measured in distance or time rather than reps, it needs its own kind of progression.",
    alternatives: [
      {
        slug: "suitcase-carry",
        note: "Loading only one side turns it into a heavy anti-side-bend exercise, with the obliques doing far more work.",
      },
      {
        slug: "shrug-trap-bar",
        note: "Loads the traps through an actual range of motion rather than isometrically, which builds size more directly.",
      },
      {
        slug: "dead-hang",
        note: "Isolates the grip and the shoulder without any walking or trunk demand — simpler, and easier to measure.",
      },
    ],
  },
  {
    slug: "suitcase-carry",
    name: "Suitcase Carry",
    primaryMuscle: "obliques",
    secondaryMuscles: ["forearms", "traps"],
    equipment: "dumbbell",
    trackingType: "weight_time",
    instructions:
      "Hold one heavy weight at one side and stand perfectly upright.\nWalk without leaning toward or away from the load.\nSwap sides and repeat for the same distance.",
    bodyEffect:
      "A one-sided loaded carry. The weight constantly tries to bend the torso sideways, and the entire exercise is refusing to let it.\n\nThe obliques and quadratus lumborum on the unloaded side work maximally to keep the spine vertical, while the glute medius on the standing leg stops the pelvis dropping. The grip, forearms and traps on the loaded side hold isometrically as in any carry.\n\nIt trains lateral trunk stability under real load, which almost nothing else does, and it exposes side-to-side differences immediately. It is a stability exercise first — grip and traps get less than a two-sided carry gives.",
    alternatives: [
      {
        slug: "farmers-walk",
        note: "Loading both sides removes the anti-side-bend demand entirely, letting you carry far more for grip and trap work.",
      },
      {
        slug: "side-plank",
        note: "Trains the same lateral trunk musculature statically on the floor, with no grip or carrying component.",
      },
      {
        slug: "pallof-press",
        note: "Also an anti-movement trunk exercise, resisting rotation rather than side-bending.",
      },
    ],
  },
  {
    slug: "dead-hang",
    name: "Dead Hang",
    primaryMuscle: "forearms",
    secondaryMuscles: ["lats", "traps"],
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Hang from a bar with the arms straight and the shoulders relaxed but not collapsed.\nBreathe and hold for time.\nStep down rather than dropping.",
    bodyEffect:
      "A pure isometric hang: the finger flexors hold your entire bodyweight while the shoulder sits in full flexion under traction.\n\nThe forearm flexors and the small muscles of the hand do the gripping, while the lats, teres major and the rotator cuff work lightly to keep the shoulder joint controlled rather than fully passive. The load on the shoulder is distractive rather than compressive.\n\nIt builds grip endurance directly and is widely used to keep shoulders healthy, since it is one of the few positions that decompresses the joint under load. It builds no strength through a range, because there is no range.",
    alternatives: [
      {
        slug: "farmers-walk",
        note: "Also an isometric grip challenge, but with a heavier adjustable load and a real trunk and trap demand.",
      },
      {
        slug: "scapular-pull-up",
        note: "Adds active shoulder-blade depression to the hang, turning a passive hold into lower-trap and lat control work.",
      },
      {
        slug: "wrist-curl",
        note: "Trains the forearm flexors through an actual range rather than isometrically, which builds size more directly.",
      },
    ],
  },
  {
    slug: "plate-pinch",
    name: "Plate Pinch",
    primaryMuscle: "forearms",
    equipment: "plate",
    trackingType: "weight_time",
    instructions:
      "Pinch one or two smooth plates between the thumb and fingers, smooth sides out.\nHold at arm's length beside you for time.\nSet them down deliberately.",
    bodyEffect:
      "An isometric pinch grip: the thumb opposes the fingers with no bar or handle to wrap around, so the hand cannot close into its strongest position.\n\nThe thumb adductors and the finger flexors work maximally, along with the deep forearm muscles that most gripping never isolates. Pinch strength is a genuinely separate quality from crushing or supporting grip.\n\nIt is the most direct way to train the thumb side of the grip, which is the limiting factor in awkward lifting and carrying tasks. It has essentially no carryover to barbell work, where the fingers wrap and the thumb matters far less.",
    alternatives: [
      {
        slug: "farmers-walk",
        note: "Trains supporting grip with the fingers wrapped, which is the kind that limits deadlifts and rows.",
      },
      {
        slug: "dead-hang",
        note: "Also isometric and far simpler to set up, loading the fingers with bodyweight rather than the thumb with plates.",
      },
      {
        slug: "wrist-curl",
        note: "Builds the forearm flexors through a range of motion rather than holding a static pinch.",
      },
    ],
  },
];

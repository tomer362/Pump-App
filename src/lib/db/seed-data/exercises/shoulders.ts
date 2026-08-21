import type { SeedExercise } from "../types";

export const SHOULDERS: SeedExercise[] = [
  /* ---- Vertical pressing ---- */
  {
    slug: "overhead-press-barbell",
    name: "Overhead Press (Barbell)",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps"],
    equipment: "barbell",
    instructions:
      "Take the bar at the front of the shoulders, hands just outside shoulder width.\nSqueeze the glutes, pull the chin back and press straight up.\nPush the head through at the top so the bar finishes over the mid-foot.",
    bodyEffect:
      "Shoulder flexion and abduction with elbow extension, performed standing, so the whole body has to stay rigid while a load travels overhead.\n\nThe anterior deltoid drives the press with the lateral deltoid assisting, the triceps finish the lockout, and the upper traps and serratus rotate the shoulder blade upward to let the arm clear. The abs, glutes and erectors work isometrically to stop the load pushing you into an arch.\n\nIt is the cleanest measure of standing pressing strength and it trains trunk rigidity as directly as it trains shoulders. Absolute loads are modest compared with a bench press, and limited shoulder or thoracic mobility turns it into a lower-back exercise very quickly.",
    alternatives: [
      {
        slug: "seated-overhead-press-barbell",
        note: "A bench back removes the trunk demand, so the shoulders can be loaded heavier and taken closer to failure — but nothing is learned about bracing.",
      },
      {
        slug: "overhead-press-dumbbell",
        note: "Independent bells let the arms travel a natural arc and expose imbalances, at the cost of the load a bar allows.",
      },
      {
        slug: "landmine-press-shoulder",
        note: "Pressing on an angled arc rather than straight overhead is far kinder to a limited or irritable shoulder.",
      },
    ],
  },
  {
    slug: "seated-overhead-press-barbell",
    name: "Seated Overhead Press (Barbell)",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps"],
    equipment: "barbell",
    instructions:
      "Set an upright bench in a rack with the bar at shoulder height.\nPress straight up, keeping the ribs down against the back pad.\nLower to the collarbone under control.",
    bodyEffect:
      "The same overhead press with the torso supported, so the legs and trunk stop contributing and the movement becomes almost purely a shoulder and triceps action.\n\nThe anterior and lateral deltoids press, the triceps lock out, and the upper traps and serratus rotate the shoulder blade upward. The abs still work to keep the ribs from flaring, but the load no longer threatens to topple you.\n\nRemoving the balance and bracing demand means more of the load reaches the shoulders and sets can run to genuine failure, which makes it the better hypertrophy choice. The back pad also encourages arching, which turns it into an incline press if the ribs are allowed to flare.",
    alternatives: [
      {
        slug: "overhead-press-barbell",
        note: "Standing adds a real trunk and bracing demand and builds pressing strength that transfers, but caps the load the shoulders receive.",
      },
      {
        slug: "seated-overhead-press-dumbbell",
        note: "Independent bells allow a more natural arc and expose side-to-side differences the bar hides.",
      },
      {
        slug: "shoulder-press-machine",
        note: "A fixed path removes the last of the stabilising work, making it the easiest and safest way to press to failure alone.",
      },
    ],
  },
  {
    slug: "overhead-press-dumbbell",
    name: "Overhead Press (Dumbbell)",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps"],
    equipment: "dumbbell",
    instructions:
      "Stand with the bells at shoulder height, palms forward or slightly turned in.\nPress up and slightly together without clashing at the top.\nLower under control to the shoulders.",
    bodyEffect:
      "Standing shoulder flexion and abduction with two independent loads, so each arm follows its own arc and nothing shares the balancing work.\n\nThe anterior and lateral deltoids press while the rotator cuff works continuously to keep each bell tracking overhead. The triceps lock out, the traps and serratus rotate the shoulder blade, and the trunk resists the arch.\n\nThe free arc lets the arms travel in a slightly more natural path than a bar allows, which many shoulders tolerate better, and imbalances become obvious immediately. Getting heavy bells to the shoulders is the practical ceiling, so absolute loading stays lower than the barbell.",
    alternatives: [
      {
        slug: "overhead-press-barbell",
        note: "One bar loads heavier and is easier to set up, but fixes the hands in one position and hides any left-right difference.",
      },
      {
        slug: "seated-overhead-press-dumbbell",
        note: "Sitting removes the trunk demand, letting more of the load reach the shoulders and sets run closer to failure.",
      },
      {
        slug: "arnold-press",
        note: "Adding rotation on the way up brings the front delt through a longer range, at the cost of a heavier, cleaner press.",
      },
    ],
  },
  {
    slug: "seated-overhead-press-dumbbell",
    name: "Seated Overhead Press (Dumbbell)",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps"],
    equipment: "dumbbell",
    instructions:
      "Sit on an upright bench with the bells at shoulder height.\nPress up and slightly in, keeping the ribs down against the pad.\nLower under control until the elbows pass below the shoulders.",
    bodyEffect:
      "Overhead pressing with two independent loads and the torso supported, so the balancing demand stays with the shoulders while the trunk stops working.\n\nThe anterior and lateral deltoids press, the rotator cuff stabilises each bell, and the triceps finish the lockout. Sitting removes the leg drive and the anti-arch demand entirely, which means the shoulders receive a larger share of a smaller total effort.\n\nThe combination of a free arc and full support makes it one of the best shoulder hypertrophy movements — the shoulders decide when the set ends. It builds no standing pressing ability, and heavy bells are still hard to get into position.",
    alternatives: [
      {
        slug: "overhead-press-dumbbell",
        note: "Standing adds a real trunk and bracing demand that transfers to overhead work, but the shoulders receive less of the load.",
      },
      {
        slug: "seated-overhead-press-barbell",
        note: "A single bar loads heavier and is far easier to set up, though the fixed hand position suits some shoulders poorly.",
      },
      {
        slug: "shoulder-press-machine",
        note: "Removes even the balancing of the bells, making it the safest place to take a shoulder press to failure alone.",
      },
    ],
  },
  {
    slug: "arnold-press",
    name: "Arnold Press",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps"],
    equipment: "dumbbell",
    instructions:
      "Start with the bells at the chest, palms facing you.\nPress up while rotating the palms to face forward.\nReverse the rotation on the way down.",
    bodyEffect:
      "An overhead press with external rotation folded into the ascent, so the shoulder rotates outward as it flexes rather than starting already rotated.\n\nThe anterior deltoid works through a longer range than a standard press because it begins in a fully shortened, internally rotated position, and the rotator cuff is loaded through its rotational range rather than just stabilising. The lateral deltoid and triceps contribute as usual.\n\nThe longer arc and the rotation give the front delt more time under tension and give the cuff useful work, which is the case for doing it. Rotating under load is also more demanding on the shoulder joint, so loads must stay moderate and controlled.",
    alternatives: [
      {
        slug: "seated-overhead-press-dumbbell",
        note: "Pressing without the rotation is simpler and lets you use noticeably more weight, but the front delt works through a shorter range.",
      },
      {
        slug: "overhead-press-barbell",
        note: "The heaviest, most direct expression of overhead pressing, with no rotational component at all.",
      },
      {
        slug: "cable-external-rotation",
        note: "Trains the rotational element on its own with far better control, if cuff work rather than pressing is the goal.",
      },
    ],
  },
  {
    slug: "shoulder-press-machine",
    name: "Shoulder Press (Machine)",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps"],
    equipment: "machine",
    instructions:
      "Set the seat so the handles start at about shoulder height.\nPress up along the machine's path without shrugging.\nLower under control until the elbows drop below the shoulders.",
    bodyEffect:
      "Overhead pressing along a fixed path with the back supported, so nothing has to be balanced and the torso contributes nothing.\n\nThe anterior and lateral deltoids and the triceps take almost the whole load. The rotator cuff barely works, because the machine controls the path, and the trunk does not work at all.\n\nThat makes it the safest way to press to failure or to drop-set without a spotter, and the easiest shoulder press to progress in small steps. None of the stabilising or bracing transfers to free-weight or standing pressing.",
    alternatives: [
      {
        slug: "seated-overhead-press-dumbbell",
        note: "Free bells restore the balancing work of the rotator cuff and let each arm find its own arc.",
      },
      {
        slug: "overhead-press-barbell",
        note: "Standing with a bar trains bracing and full-body rigidity, which the machine removes entirely.",
      },
      {
        slug: "landmine-press-shoulder",
        note: "An angled arc rather than a strictly vertical one, which many irritable shoulders tolerate far better.",
      },
    ],
  },
  {
    slug: "push-press",
    name: "Push Press",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps", "quads"],
    equipment: "barbell",
    instructions:
      "Hold the bar at the shoulders and dip a few inches by bending the knees.\nDrive up explosively with the legs and let the momentum carry the bar past the sticking point.\nFinish the press with the arms and lock out overhead.",
    bodyEffect:
      "An overhead press with a deliberate leg drive, so the bar leaves the shoulders with momentum and the arms only have to finish what the legs started.\n\nThe quads and glutes generate the initial drive, the trunk transmits it rigidly, and the deltoids and triceps take over above the sticking point. The whole chain has to work in sequence, which makes timing as much the skill as strength.\n\nBecause the legs get the bar moving, it allows meaningfully heavier loads overhead than a strict press, which trains the lockout and the overhead position under weight a strict press could never reach. It develops the deltoids less directly per rep, since the hardest portion is assisted.",
    alternatives: [
      {
        slug: "overhead-press-barbell",
        note: "Removing the leg drive makes the deltoids do the entire job, which builds them far more directly at much lower load.",
      },
      {
        slug: "thruster",
        note: "Starts from a full squat rather than a dip, turning it into a whole-body conditioning lift with a far larger leg component.",
      },
      {
        slug: "seated-overhead-press-barbell",
        note: "Sitting makes leg drive impossible by design, isolating the shoulders with no timing or coordination element at all.",
      },
    ],
  },
  {
    slug: "landmine-press-shoulder",
    name: "Landmine Shoulder Press",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps", "abs"],
    equipment: "barbell",
    instructions:
      "Half-kneel or stand holding the end of a landmine bar at one shoulder.\nPress up and forward along the bar's arc until the arm extends.\nLower to the shoulder under control without twisting.",
    bodyEffect:
      "A press along a rising arc that travels forward as it goes up, so the arm ends somewhere between overhead and in front rather than directly above the head.\n\nThe anterior deltoid does most of the work with the triceps finishing and serratus anterior driving the shoulder blade around the ribcage at the top. Pressing one side at a time means the obliques and abs resist both rotation and side-bending.\n\nThe partial-overhead path demands far less shoulder mobility than a true overhead press, which makes it the most reliable pressing option for restricted or irritable shoulders. Loading is capped by the landmine's leverage and by the trunk.",
    alternatives: [
      {
        slug: "overhead-press-barbell",
        note: "A true vertical press loads far heavier and trains the full overhead position, but demands the mobility this variation works around.",
      },
      {
        slug: "seated-overhead-press-dumbbell",
        note: "Also allows a natural arc with more load, though it still requires taking the arm fully overhead.",
      },
      {
        slug: "pike-push-up",
        note: "An equipment-free vertical press using bodyweight, with free shoulder blades but no way to adjust the angle.",
      },
    ],
  },
  {
    slug: "pike-push-up",
    name: "Pike Push Up",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "From a push-up position, walk the feet in and lift the hips into an inverted V.\nLower the crown of the head toward the floor between the hands.\nPress back up until the arms lock out.",
    bodyEffect:
      "A closed-chain vertical press: with the hips piked, the torso is near-vertical over the hands, so pressing away from the floor is essentially an overhead press against bodyweight.\n\nThe anterior and lateral deltoids do the pressing with the triceps locking out, and — as in any push-up — the shoulder blades are free to rotate upward and protract, so serratus anterior works genuinely hard. The trunk holds the pike position throughout.\n\nIt is the most useful equipment-free shoulder press and the entry point to handstand work. The load is fixed by your bodyweight and the angle, so it progresses only by elevating the feet, which is a coarse and eventually exhausted lever.",
    alternatives: [
      {
        slug: "overhead-press-dumbbell",
        note: "Adjustable external load and precise progression, but the shoulder blades are no longer free to move as they are in a push-up.",
      },
      {
        slug: "landmine-press-shoulder",
        note: "An angled arc that demands far less shoulder mobility and can be loaded exactly, unlike bodyweight.",
      },
      {
        slug: "handstand-push-up",
        note: "The full-load progression of the same pattern — an entire bodyweight vertical press, with a real balance demand added.",
      },
    ],
  },
  {
    slug: "handstand-push-up",
    name: "Handstand Push Up",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps", "traps"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Kick up to a handstand against a wall, hands slightly wider than the shoulders.\nLower until the head lightly touches the floor.\nPress back to a full lockout without arching excessively.",
    bodyEffect:
      "A fully inverted closed-chain press: the entire bodyweight travels through a vertical arm path, with the shoulder blades free to rotate on the ribcage.\n\nThe deltoids and triceps press, the upper traps and serratus rotate the shoulder blade upward through a full range, and the whole trunk works to hold a rigid line against gravity. The wrists and forearms are loaded heavily throughout.\n\nAs a bodyweight movement it is about as demanding as vertical pressing gets, and it builds shoulder strength and overhead control together. The load is not adjustable, the entry requires real skill, and the inverted position is unforgiving of a shoulder that is not already healthy.",
    alternatives: [
      {
        slug: "pike-push-up",
        note: "The same pattern at a fraction of the load and none of the balance requirement — the sensible step before this one.",
      },
      {
        slug: "overhead-press-barbell",
        note: "Adjustable load and a controllable path, so pressing strength can be progressed precisely without any inversion.",
      },
      {
        slug: "seated-overhead-press-dumbbell",
        note: "Fully supported and easy to load, which lets the shoulders be trained to failure without the balance or wrist demand.",
      },
    ],
  },
  /* ---- Lateral / medial deltoid ---- */
  {
    slug: "lateral-raise-dumbbell",
    name: "Lateral Raise (Dumbbell)",
    primaryMuscle: "shoulders",
    equipment: "dumbbell",
    instructions:
      "Stand with a bell in each hand, elbows softly bent.\nRaise the arms out to the sides to about shoulder height, leading with the elbows.\nLower slowly; do not swing or shrug.",
    bodyEffect:
      "Shoulder abduction in the frontal plane — the arm sweeps directly out to the side, with the elbow held at a fixed angle so the shoulder is the only working joint.\n\nThe lateral head of the deltoid is the prime mover, with supraspinatus initiating the first fifteen degrees and the upper traps taking over if the arm goes much above shoulder height. The rotator cuff stabilises the humeral head throughout.\n\nThis is the movement that builds shoulder width, and almost nothing else trains the lateral delt directly — pressing recruits it only as an assistant. Gravity means resistance peaks at the top and disappears at the bottom, and the light loads involved make it easy to ruin with momentum.",
    alternatives: [
      {
        slug: "lateral-raise-cable",
        note: "A cable keeps tension on at the bottom of the arc, where a dumbbell goes completely slack against the thigh.",
      },
      {
        slug: "lateral-raise-machine",
        note: "The pads support the arms along a fixed path, which removes momentum entirely and makes failure far easier to reach safely.",
      },
      {
        slug: "leaning-lateral-raise",
        note: "Leaning away shifts the hardest part of the arc lower, loading the lateral delt through more of its stretched range.",
      },
    ],
  },
  {
    slug: "lateral-raise-cable",
    name: "Lateral Raise (Cable)",
    primaryMuscle: "shoulders",
    equipment: "cable",
    instructions:
      "Stand side-on to a low pulley and hold the handle in the far hand across the body.\nRaise the arm out to the side to shoulder height, elbow softly bent.\nLower slowly against the cable.",
    bodyEffect:
      "Shoulder abduction against a cable whose line of pull runs across the body, so resistance is present from the very bottom of the arc rather than beginning only once the arm leaves the side.\n\nThe lateral deltoid works throughout, with supraspinatus starting the movement and the upper traps taking over above shoulder height. Because tension never disappears, the muscle is loaded in its stretched position as well as its shortened one.\n\nThat continuous tension is the main reason to prefer it over dumbbells, and it makes the movement much harder to cheat with momentum. Only one arm can be trained at a time on most setups, which doubles the time per set.",
    alternatives: [
      {
        slug: "lateral-raise-dumbbell",
        note: "Both arms at once and no setup, but resistance vanishes at the bottom exactly where the cable's advantage lies.",
      },
      {
        slug: "lateral-raise-machine",
        note: "Supported arms on a fixed path, which removes momentum entirely and lets both sides work at once.",
      },
      {
        slug: "leaning-lateral-raise",
        note: "Uses a dumbbell but leans away to achieve a similar bottom-loaded resistance curve without a cable stack.",
      },
    ],
  },
  {
    slug: "leaning-lateral-raise",
    name: "Leaning Lateral Raise",
    primaryMuscle: "shoulders",
    equipment: "dumbbell",
    instructions:
      "Hold an upright with one hand and lean away so the body tilts sideways.\nRaise the free arm out to the side with a soft elbow.\nLower slowly through the full arc.",
    bodyEffect:
      "Shoulder abduction performed with the torso tilted, which rotates the whole resistance curve: the arm starts further from vertical, so gravity loads it earlier in the range.\n\nThe lateral deltoid works from a more stretched starting position and stays loaded across a longer portion of the arc than in an upright raise. Supraspinatus still initiates and the traps still take over near the top.\n\nLoading the lateral delt in its lengthened position is a strong hypertrophy stimulus and is hard to achieve with free weights any other way. Holding the lean is awkward, only one arm works at a time, and the loads are necessarily small.",
    alternatives: [
      {
        slug: "lateral-raise-cable",
        note: "Achieves the same bottom-loaded curve with constant tension and no need to hang off an upright.",
      },
      {
        slug: "lateral-raise-dumbbell",
        note: "Upright and two-armed, which is quicker and simpler but loads only the top of the arc.",
      },
      {
        slug: "lateral-raise-machine",
        note: "Even resistance on a fixed path with both arms working, removing the balance and the awkward setup.",
      },
    ],
  },
  {
    slug: "lateral-raise-machine",
    name: "Lateral Raise (Machine)",
    primaryMuscle: "shoulders",
    equipment: "machine",
    instructions:
      "Set the seat so the shoulder joint lines up with the machine's pivot.\nDrive the arms out to the sides against the pads until they reach shoulder height.\nLower under control without letting the weight stack rest.",
    bodyEffect:
      "Shoulder abduction along a fixed arc with the upper arms supported against pads, so the load is applied to the arm rather than held in the hand.\n\nThe lateral deltoid does the work with supraspinatus initiating. Because the arms are supported and the path is fixed, grip contributes nothing and momentum is essentially impossible.\n\nThat makes it the easiest place to train the lateral delt to genuine failure and to drop-set, which matters for a muscle that responds to volume and is hard to load heavily. The fixed pivot has to match your shoulder height or the line of pull is wrong.",
    alternatives: [
      {
        slug: "lateral-raise-dumbbell",
        note: "Free weights need no setup and fit any body, but tension disappears at the bottom and momentum is easy to sneak in.",
      },
      {
        slug: "lateral-raise-cable",
        note: "Constant tension including the stretched position, though only one arm can usually work at a time.",
      },
      {
        slug: "upright-row-cable",
        note: "Adds elbow flexion so the traps and biceps contribute, allowing more load but much less isolation of the lateral delt.",
      },
    ],
  },
  {
    slug: "upright-row-barbell",
    name: "Upright Row (Barbell)",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["traps"],
    equipment: "barbell",
    instructions:
      "Hold the bar at about shoulder width — not narrow.\nPull it up the front of the body, leading with the elbows, to about lower-chest height.\nLower under control. Stop if the shoulder pinches.",
    bodyEffect:
      "Shoulder abduction combined with elbow flexion and shoulder-blade elevation, so the arm rises out and up while the elbow bends — a rowing action in a vertical plane.\n\nThe lateral deltoid and upper traps do most of the work, with the biceps and brachialis flexing the elbow. Pulling high with a narrow grip forces the shoulder into internal rotation and abduction simultaneously, which is the position most likely to compress structures in the joint.\n\nIt loads the lateral delt and traps together more heavily than a raise can, which is its appeal. A wider grip and stopping at chest height keep it reasonable; a narrow grip pulled to the chin is a well-known way to irritate a shoulder.",
    alternatives: [
      {
        slug: "lateral-raise-dumbbell",
        note: "Trains the lateral delt without the internal rotation that makes upright rowing risky, at much lighter load.",
      },
      {
        slug: "upright-row-cable",
        note: "The same pattern with even tension and a rope that lets the hands separate, which relieves most of the shoulder pinch.",
      },
      {
        slug: "high-pull-dumbbell",
        note: "A wider, more explosive version that keeps the elbows above the hands and out of the compressed position.",
      },
    ],
  },
  {
    slug: "upright-row-cable",
    name: "Upright Row (Cable)",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["traps", "biceps"],
    equipment: "cable",
    instructions:
      "Attach a rope or wide bar to a low pulley.\nPull up the front of the body with the elbows leading and the hands separating.\nStop at chest height and lower under control.",
    bodyEffect:
      "Vertical rowing against a cable, with a rope allowing the hands to travel apart as they rise so the shoulder is not forced into internal rotation.\n\nThe lateral deltoid and upper traps drive the abduction and elevation while the elbow flexors contribute. Constant cable tension keeps the load on through the bottom of the range where a bar is easiest.\n\nThe rope's freedom is what makes this the tolerable version of an upright row: the same lateral-delt and trap loading with far less impingement risk. It still cannot be loaded like a barbell, and pulling above chest height re-creates the problem.",
    alternatives: [
      {
        slug: "upright-row-barbell",
        note: "A fixed bar allows heavier loading but forces the hands to stay level, which is exactly what compresses the shoulder.",
      },
      {
        slug: "lateral-raise-cable",
        note: "Removing elbow flexion isolates the lateral delt and eliminates the internal-rotation component entirely.",
      },
      {
        slug: "face-pull",
        note: "Pulls at the same height but externally rotates rather than internally, targeting rear delts and lower traps instead.",
      },
    ],
  },
  {
    slug: "high-pull-dumbbell",
    name: "High Pull (Dumbbell)",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["traps", "back"],
    equipment: "dumbbell",
    trackingType: "weight_reps",
    instructions:
      "Hold the bells in front of the thighs, hinge slightly and dip.\nDrive up and pull the bells out and up with the elbows high and wide.\nLower under control and reset.",
    bodyEffect:
      "An explosive abduction and elevation of the shoulder blades driven by a short hip and knee extension, with the elbows finishing high and wide rather than close and internally rotated.\n\nThe upper traps and lateral deltoids do the pulling, the rear delts contribute as the elbows travel back, and the hips and quads produce the initial drive. The wide elbow path keeps the shoulder out of the compressed position an upright row creates.\n\nIt trains the traps and delts with a speed component and some whole-body coordination, which makes it a useful conditioning and power movement. Being explosive, it is a poor way to accumulate controlled hypertrophy volume.",
    alternatives: [
      {
        slug: "upright-row-cable",
        note: "A controlled version of the same pull with constant tension, better for hypertrophy and much easier to do strictly.",
      },
      {
        slug: "lateral-raise-dumbbell",
        note: "Isolates the lateral delt with no hip drive and no traps, trading load and speed for precision.",
      },
      {
        slug: "power-clean",
        note: "Takes the same explosive pull further and catches the load on the shoulders, making it a full power expression rather than a shoulder movement.",
      },
    ],
  },
  /* ---- Front deltoid ---- */
  {
    slug: "front-raise-dumbbell",
    name: "Front Raise (Dumbbell)",
    primaryMuscle: "shoulders",
    equipment: "dumbbell",
    instructions:
      "Hold the bells in front of the thighs, palms down or neutral.\nRaise one or both arms straight out in front to shoulder height.\nLower slowly without swinging the torso.",
    bodyEffect:
      "Pure shoulder flexion in the sagittal plane: the arm travels straight forward and up with the elbow locked, so the shoulder is the only joint working.\n\nThe anterior deltoid is the prime mover, with the clavicular fibres of the chest assisting and the upper traps and serratus rotating the shoulder blade as the arm approaches shoulder height. Resistance peaks when the arm is horizontal.\n\nIt isolates the front delt, which is genuinely useful for someone whose pressing is limited by it — but the front delt is already heavily worked by every press and every incline movement, so this is one of the least necessary isolation exercises for most people.",
    alternatives: [
      {
        slug: "front-raise-cable",
        note: "Constant tension through the whole arc rather than a peak only at horizontal, and much harder to swing.",
      },
      {
        slug: "plate-front-raise",
        note: "A neutral two-handed grip on one implement, which is easier on the wrists and keeps both arms tracking identically.",
      },
      {
        slug: "overhead-press-dumbbell",
        note: "Trains the same front delt through a far longer range with much more load, and builds pressing strength as well.",
      },
    ],
  },
  {
    slug: "front-raise-cable",
    name: "Front Raise (Cable)",
    primaryMuscle: "shoulders",
    equipment: "cable",
    instructions:
      "Stand facing away from a low pulley with the handle in one hand at the thigh.\nRaise the arm straight forward to shoulder height.\nLower slowly against the cable's pull.",
    bodyEffect:
      "Shoulder flexion against a cable running up behind the leg, so resistance is present from the moment the arm leaves the thigh rather than only near horizontal.\n\nThe anterior deltoid does the work with the upper chest assisting, and the trunk braces lightly against the backward pull. Tension persists through the whole arc including the shortened top position.\n\nThe even loading makes it a better front-delt isolation than dumbbells and much harder to cheat. As with any front raise, its necessity depends on the rest of the programme — most people's anterior delts get plenty of work from pressing.",
    alternatives: [
      {
        slug: "front-raise-dumbbell",
        note: "Simpler and allows both arms at once, but resistance is only meaningful near the top of the arc.",
      },
      {
        slug: "low-to-high-cable-fly",
        note: "A similar upward line of pull that emphasises the upper chest rather than the front delt.",
      },
      {
        slug: "overhead-press-barbell",
        note: "Loads the anterior delt far more through a longer range while also building genuine pressing strength.",
      },
    ],
  },
  {
    slug: "plate-front-raise",
    name: "Plate Front Raise",
    primaryMuscle: "shoulders",
    equipment: "plate",
    trackingType: "weight_reps",
    instructions:
      "Hold a plate at the edges with both hands in front of the thighs.\nRaise it straight out to eye level with the arms extended.\nLower slowly under control.",
    bodyEffect:
      "Shoulder flexion with both hands on a single implement, so the arms are locked into an identical path and the forearms stay in a neutral position.\n\nThe anterior deltoids do the lifting with the upper chest assisting; the grip works isometrically to pinch the plate, and the trunk braces against the load moving away from the body.\n\nThe shared grip is easier on the wrists than palms-down dumbbells and keeps both sides moving together, which is why it is a common warm-up. Loading is coarse — plates come in fixed jumps — and the movement remains the least essential of the delt isolations.",
    alternatives: [
      {
        slug: "front-raise-cable",
        note: "Even tension through the full arc and precise loading in small increments, instead of coarse plate jumps.",
      },
      {
        slug: "front-raise-dumbbell",
        note: "Lets each arm move independently and allows a neutral or pronated grip, though the wrists take more strain.",
      },
      {
        slug: "landmine-press-shoulder",
        note: "A pressing movement on a similar forward-and-up arc, loading the front delt far more with the triceps assisting.",
      },
    ],
  },
  /* ---- Rear deltoid and shoulder health ---- */
  {
    slug: "rear-delt-fly-dumbbell",
    name: "Rear Delt Fly (Dumbbell)",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["back"],
    equipment: "dumbbell",
    instructions:
      "Hinge forward until the torso is near horizontal, bells hanging beneath the chest.\nSweep the arms out to the sides with the elbows softly bent.\nLower slowly; do not turn it into a row.",
    bodyEffect:
      "Shoulder horizontal abduction — the arm sweeps out and back away from the midline — with the elbow held at a fixed angle so the shoulder does all the moving.\n\nThe posterior deltoid is the prime mover, with the rhomboids, mid traps and infraspinatus contributing as the shoulder blades retract. Bending the elbow more turns it progressively into a row and hands the work to the lats.\n\nThe rear delt is the head that pressing never touches and rowing only partly reaches, so direct work matters for both shoulder balance and appearance. The hinged position is tiring to hold and the loads are necessarily very light.",
    alternatives: [
      {
        slug: "rear-delt-fly-machine",
        note: "The chest pad removes the hinge, so the set ends when the rear delts tire rather than when the lower back does.",
      },
      {
        slug: "face-pull",
        note: "Adds external rotation to the same horizontal abduction, so the rotator cuff and lower traps are trained alongside the rear delt.",
      },
      {
        slug: "rear-delt-fly-cable",
        note: "Cables hold tension through the whole arc, where dumbbells lose it as the arms come back down.",
      },
    ],
  },
  {
    slug: "rear-delt-fly-machine",
    name: "Rear Delt Fly (Machine)",
    primaryMuscle: "shoulders",
    equipment: "machine",
    instructions:
      "Sit facing the chest pad with the handles set at shoulder height.\nSweep the arms out and back, leading with the elbows.\nReturn under control without letting the stack rest.",
    bodyEffect:
      "Horizontal shoulder abduction on a fixed arc with the chest supported, so the hinge, the balance and the lower back are all removed from the movement.\n\nThe posterior deltoids do the work with the rhomboids and mid traps retracting the shoulder blades. Nothing else contributes, and there is no way to generate momentum from the torso.\n\nBecause the rear delt is small and responds to volume rather than load, being able to take it to failure repeatedly without a fatiguing hinge makes this among the most efficient options available. The fixed handle height must roughly match your shoulders to give a clean line of pull.",
    alternatives: [
      {
        slug: "rear-delt-fly-dumbbell",
        note: "No machine needed and each arm moves freely, but holding the hinge tires the lower back before the rear delts are done.",
      },
      {
        slug: "face-pull",
        note: "Adds external rotation, training the rotator cuff and lower traps as well as the rear delt.",
      },
      {
        slug: "rear-delt-fly-cable",
        note: "Lets you set the exact height and angle of the pull, and the crossing path adds range the machine cannot reach.",
      },
    ],
  },
  {
    slug: "rear-delt-fly-cable",
    name: "Rear Delt Fly (Cable)",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["back"],
    equipment: "cable",
    instructions:
      "Set two pulleys at shoulder height and take the handles crossed in front of you.\nSweep the arms out and back with soft elbows until they are wide.\nReturn under control, resisting the pull across.",
    bodyEffect:
      "Horizontal shoulder abduction against cables crossing in front of the body, so the arms begin further across the midline than any free weight allows and finish fully swept back.\n\nThe posterior deltoids drive the movement with the rhomboids, mid traps and infraspinatus retracting and rotating the shoulder blades. Tension is constant, so the stretched crossed position at the start is genuinely loaded.\n\nThe longer arc and even resistance make it the most complete rear-delt isolation, and standing upright avoids the fatigue of a hinge. Setup takes two pulleys and the loads are small enough that stack increments can feel coarse.",
    alternatives: [
      {
        slug: "rear-delt-fly-machine",
        note: "Simpler to set up and easier to take to failure, though the fixed handles cannot reach the crossed starting position.",
      },
      {
        slug: "rear-delt-fly-dumbbell",
        note: "Needs no cables at all, but requires holding a hinge and loses tension through much of the arc.",
      },
      {
        slug: "face-pull",
        note: "Same cable setup with external rotation added, which trains the cuff and lower traps as well as the rear delt.",
      },
    ],
  },
  {
    slug: "face-pull",
    name: "Face Pull",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["traps", "back"],
    equipment: "cable",
    instructions:
      "Set a rope at about head height and step back until the cable is taut.\nPull the rope toward the face, separating the hands and driving the elbows high.\nFinish with the knuckles beside the ears, then return under control.",
    bodyEffect:
      "Horizontal shoulder abduction combined with external rotation and shoulder-blade retraction — three actions at once, all of them the opposite of what a desk and a bench press produce.\n\nThe posterior deltoids and the mid and lower traps retract and rotate the shoulder blade upward while infraspinatus and teres minor externally rotate the humerus. The rhomboids assist throughout.\n\nIt is the single most efficient piece of shoulder-health work available, because it loads the exact muscles that pressing under-trains and that hold the shoulder in a good position. It builds little size and needs light loads to be done properly — going heavy turns it into a bad high row.",
    alternatives: [
      {
        slug: "rear-delt-fly-cable",
        note: "Drops the external rotation and isolates horizontal abduction, so it builds the rear delt more directly but does less for the cuff.",
      },
      {
        slug: "band-pull-apart",
        note: "Trains retraction and rear delts with no equipment beyond a band, though without the external rotation or the upward elbow path.",
      },
      {
        slug: "cable-external-rotation",
        note: "Isolates the rotation component alone, which is the better choice when the rotator cuff specifically is the target.",
      },
    ],
  },
  {
    slug: "band-pull-apart",
    name: "Band Pull Apart",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["traps", "back"],
    equipment: "band",
    trackingType: "reps",
    instructions:
      "Hold a light band at shoulder height with the arms straight in front.\nPull it apart until the arms are wide and the band touches the chest.\nReturn slowly without letting it snap back.",
    bodyEffect:
      "Horizontal shoulder abduction with the elbows locked, performed against elastic that gets harder the wider the arms travel — so resistance peaks exactly where the shoulder blades are fully retracted.\n\nThe posterior deltoids, rhomboids and mid traps do all the work, and because the elbows never bend the lats and biceps cannot contribute. The ascending resistance curve matches the strengthening contraction well.\n\nIt costs nothing, needs no gym, and can be done in high volume daily to counterbalance pressing and desk posture. It builds essentially no size and the loading is too light and too coarse to be a serious strength stimulus.",
    alternatives: [
      {
        slug: "rear-delt-fly-cable",
        note: "The same joint action with a measurable stack and even tension, so it can actually be progressed and built on.",
      },
      {
        slug: "face-pull",
        note: "Adds external rotation and an upward elbow path, which does considerably more for the rotator cuff and lower traps.",
      },
      {
        slug: "rear-delt-fly-machine",
        note: "Supported and loadable, making it far more effective for building the rear delt rather than just activating it.",
      },
    ],
  },
  {
    slug: "cable-external-rotation",
    name: "Cable External Rotation",
    primaryMuscle: "shoulders",
    equipment: "cable",
    instructions:
      "Set a pulley at elbow height and stand side-on, elbow tucked to the ribs at 90°.\nRotate the forearm outward away from the body, keeping the elbow pinned.\nReturn slowly. Use very light weight.",
    bodyEffect:
      "Isolated external rotation of the humerus with the elbow fixed at the side, so the only movement available is the upper arm turning in its socket.\n\nInfraspinatus and teres minor do essentially all of the work — two small muscles that nothing else in a normal programme trains directly, and whose job is to hold the head of the humerus centred while bigger muscles move the arm.\n\nBuilding their strength and endurance is the most evidence-backed thing you can do for shoulder durability, particularly alongside heavy pressing. It is not a size or strength exercise in any meaningful sense, and using anything but a light load recruits the whole shoulder and defeats the purpose.",
    alternatives: [
      {
        slug: "band-external-rotation",
        note: "Identical action with a band, which is portable and gives a gentler resistance curve at the start of the rotation.",
      },
      {
        slug: "face-pull",
        note: "Trains rotation as part of a larger pull, which is more time-efficient but far less specific to the cuff.",
      },
      {
        slug: "cable-internal-rotation",
        note: "The opposing action — worth adding only when the internal rotators are the weak side, which is uncommon.",
      },
    ],
  },
  {
    slug: "band-external-rotation",
    name: "Band External Rotation",
    primaryMuscle: "shoulders",
    equipment: "band",
    trackingType: "reps",
    instructions:
      "Anchor a light band at elbow height and stand side-on with the elbow tucked.\nRotate the forearm out away from the body without letting the elbow drift.\nReturn slowly under control.",
    bodyEffect:
      "External rotation of the humerus against elastic resistance, with the elbow pinned so nothing but the shoulder's rotators can produce the movement.\n\nInfraspinatus and teres minor work through their full rotational range, and the band's ascending tension is lightest at the start — where the joint is most vulnerable — and greatest at the end where the muscles are strongest.\n\nIt is the most practical version of cuff work: portable, cheap, and easy to do daily as a warm-up before pressing. Band tension is hard to quantify and progresses only in coarse jumps between band sizes.",
    alternatives: [
      {
        slug: "cable-external-rotation",
        note: "Even resistance and a measurable stack, so the progression can be tracked honestly in small increments.",
      },
      {
        slug: "face-pull",
        note: "Folds rotation into a larger pulling movement, training rear delts and lower traps at the same time.",
      },
      {
        slug: "band-pull-apart",
        note: "Also portable and shoulder-focused, but trains retraction rather than rotation — a complement, not a substitute.",
      },
    ],
  },
  {
    slug: "cable-internal-rotation",
    name: "Cable Internal Rotation",
    primaryMuscle: "shoulders",
    equipment: "cable",
    instructions:
      "Set a pulley at elbow height and stand side-on with the near elbow tucked to the ribs.\nRotate the forearm in across the body, elbow pinned.\nReturn slowly under control.",
    bodyEffect:
      "Isolated internal rotation of the humerus with the elbow fixed, the exact mirror of external rotation.\n\nSubscapularis is the main target — the one rotator cuff muscle on the front of the shoulder blade — with pectoralis major, latissimus and teres major assisting. It is the deep stabiliser most often missed by both pressing and cuff work.\n\nIt has a genuine role in rehabilitation and in throwing or racket sports where internal rotation strength matters. For general training it is much less commonly needed than external rotation, since the internal rotators are already well loaded by every press and pulldown.",
    alternatives: [
      {
        slug: "cable-external-rotation",
        note: "Trains the opposite direction, which is what most people actually need alongside a pressing-heavy programme.",
      },
      {
        slug: "band-external-rotation",
        note: "The portable version of the more commonly needed direction, easy to do as a warm-up before pressing.",
      },
      {
        slug: "single-arm-cable-press",
        note: "Loads internal rotation as part of a full pressing movement rather than in isolation, with far more total stimulus.",
      },
    ],
  },
  {
    slug: "prone-y-raise",
    name: "Prone Y Raise",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["traps"],
    equipment: "dumbbell",
    trackingType: "weight_reps",
    instructions:
      "Lie face down on an incline bench holding very light bells, thumbs up.\nRaise the arms overhead into a Y shape.\nLower slowly. Use tiny weights or none at all.",
    bodyEffect:
      "Shoulder flexion and abduction into an overhead Y position while lying prone, so the arms move against gravity through a range that ends fully overhead.\n\nThe lower trapezius is the main target — it rotates the shoulder blade upward and holds it down against the ribcage — with the posterior deltoid and the mid traps assisting. Very few exercises load the lower traps directly, which is why this one exists.\n\nStrong lower traps are what allow the shoulder blade to move correctly under an overhead load, so this is preventative work rather than performance work. The lever is long and the muscles small, so anything beyond two or three kilos turns it into a shrug.",
    alternatives: [
      {
        slug: "face-pull",
        note: "Also trains the lower traps and the cuff, in a standing position with more load and more total stimulus.",
      },
      {
        slug: "scapular-pull-up",
        note: "Trains shoulder-blade depression from a hang using bodyweight, targeting the lower traps in the opposite direction.",
      },
      {
        slug: "rear-delt-fly-dumbbell",
        note: "A similar prone position with the arms sweeping wide instead of overhead, targeting the rear delts rather than the lower traps.",
      },
    ],
  },
];

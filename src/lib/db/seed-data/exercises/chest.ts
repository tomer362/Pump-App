import type { SeedExercise } from "../types";

export const CHEST: SeedExercise[] = [
  {
    slug: "bench-press-barbell",
    name: "Bench Press (Barbell)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "barbell",
    instructions:
      "Grip about 1.5× shoulder width. Pull the shoulder blades back and down into the bench and keep them there.\nLower to the lower chest with the elbows tucked to roughly 45°, touch, then drive back up.\nKeep the feet planted and the ribs down — the bar path is a shallow arc, not a straight line.",
    bodyEffect:
      "Shoulder horizontal adduction combined with elbow extension, performed against a bench that fixes the shoulder blades in place. Almost all of the movement happens at the gleno-humeral and elbow joints; the torso contributes only bracing.\n\nThe sternal head of pectoralis major does most of the work, with the clavicular head contributing more the closer the elbows stay to the ribs. The triceps take over through the top third of the press and the anterior deltoid stabilises and assists throughout.\n\nBecause two hands drive one implement along a fixed path, this is the chest movement that loads heaviest — a maximal-strength lift first and a hypertrophy lift second. The bench caps how far the arm can travel behind the torso, which is why a fly variant complements it rather than duplicating it.",
    alternatives: [
      {
        slug: "bench-press-dumbbell",
        note: "Each arm carries its own load, so the stronger side cannot compensate and the anterior deltoid does far more stabilising. The bottom position is deeper, loading the pec under more stretch — at the cost of the absolute weight you can move.",
      },
      {
        slug: "chest-press-machine",
        note: "The machine removes the stabilising demand entirely, so nearly all the effort lands on the pec and triceps. Better for accumulating volume close to failure; it trains almost none of the bracing and bar-path control the barbell does.",
      },
      {
        slug: "push-up",
        note: "Same joint action, but the shoulder blades are free to protract, which brings serratus anterior into it — something the bench actively prevents. Load is capped by bodyweight, so it trains control and endurance rather than maximal strength.",
      },
    ],
  },
  {
    slug: "bench-press-dumbbell",
    name: "Bench Press (Dumbbell)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "dumbbell",
    instructions:
      "Kick the bells into position with the knees, then set the shoulder blades back.\nLower until the hands are level with or slightly below the chest, elbows at about 45°.\nPress up and slightly in without clashing the bells at the top.",
    bodyEffect:
      "The same horizontal adduction as the barbell press, but with two independent implements the arms can travel a genuinely wider arc and the hands can rotate. The shoulder blades stay pinned to the bench while the humerus moves through a longer path than a bar allows.\n\nPectoralis major is the prime mover, but the anterior deltoid and the rotator cuff work considerably harder because nothing external stabilises the load. Each side is loaded independently, so a strength imbalance shows up as a wobble instead of being hidden by the stronger arm.\n\nThe deeper bottom position puts the pec under load at longer muscle lengths, which is a strong stimulus for growth. Absolute loading is lower than the barbell and setup is awkward at heavy weights, so it tends to be the hypertrophy expression of the press rather than the strength one.",
    alternatives: [
      {
        slug: "bench-press-barbell",
        note: "One implement on a fixed path lets you load far heavier and express maximal strength, but the range of motion stops at the chest and the stabilising demand on each shoulder largely disappears.",
      },
      {
        slug: "chest-fly-dumbbell",
        note: "Removing elbow extension takes the triceps out and isolates the pec's horizontal adduction. Much lighter, much more stretch, and no carryover to pressing strength.",
      },
      {
        slug: "chest-press-machine",
        note: "Fixed path, no balancing, so you can push closer to failure safely — but it trains none of the per-side stabilising that makes the dumbbell version useful.",
      },
    ],
  },
  {
    slug: "incline-bench-press-barbell",
    name: "Incline Bench Press (Barbell)",
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders", "triceps"],
    equipment: "barbell",
    instructions:
      "Set the bench between 30° and 45°; steeper turns it into a shoulder press.\nLower to the upper chest just below the collarbone, elbows a little more tucked than on flat.\nDrive straight up over the shoulder joint.",
    bodyEffect:
      "Pressing along an inclined line means the humerus travels up and across the body rather than straight across it — shoulder flexion mixed with horizontal adduction. The steeper the bench, the more flexion and the less adduction.\n\nThat shifts emphasis onto the clavicular head of pectoralis major, the upper fibres that run from the collarbone, and onto the anterior deltoid. The sternal head still works but contributes less than on a flat bench, and the triceps still finish the lockout.\n\nMost people's upper chest lags because flat pressing under-loads it, so this earns a place as a primary press rather than an accessory. Past about 45° the anterior deltoid takes over and you have effectively swapped a chest exercise for a shoulder one.",
    alternatives: [
      {
        slug: "incline-bench-press-dumbbell",
        note: "The wider arc and free hand rotation reach the clavicular fibres through more range, and each side is loaded independently — but you will handle noticeably less weight.",
      },
      {
        slug: "low-to-high-cable-fly",
        note: "Same upper-chest bias without any elbow extension, so the triceps drop out and tension stays on the pec through the whole arc rather than peaking near lockout.",
      },
      {
        slug: "bench-press-barbell",
        note: "Flat pressing biases the larger sternal head and lets you load much heavier, but leaves the clavicular fibres comparatively under-stimulated.",
      },
    ],
  },
  {
    slug: "incline-bench-press-dumbbell",
    name: "Incline Bench Press (Dumbbell)",
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders", "triceps"],
    equipment: "dumbbell",
    instructions:
      "Bench at 30–45°. Start with the bells at the shoulders, palms forward or slightly turned in.\nPress up and in, stopping short of clashing.\nLower under control until you feel the stretch across the upper chest.",
    bodyEffect:
      "Shoulder flexion with horizontal adduction, driven by two independent loads. The arms can travel further behind the torso at the bottom and further together at the top than a bar permits.\n\nThe clavicular head of pectoralis major is the main target, assisted by the anterior deltoid; the triceps finish the press. The rotator cuff and the serratus work continuously to keep each bell tracking, so stabilising cost is high relative to the load.\n\nThis is the most reliable upper-chest hypertrophy movement for most people: long range, deep stretch, and no bar to cut the bottom short. It does not load heavily enough to be a strength lift, and getting heavy bells into position on an incline is genuinely the limiting factor.",
    alternatives: [
      {
        slug: "incline-bench-press-barbell",
        note: "Heavier absolute load and a much easier setup, but the bar stops the bottom position short and hides any left-right imbalance.",
      },
      {
        slug: "incline-chest-press-machine",
        note: "Fixed path removes the balancing demand so you can train to failure without a spotter — at the cost of the stabilising work that makes the free-weight version worth doing.",
      },
      {
        slug: "incline-fly-dumbbell",
        note: "Keeping the elbow angle fixed removes the triceps and turns it into pure horizontal adduction, so the upper pec works alone under much lighter load.",
      },
    ],
  },
  {
    slug: "decline-bench-press-barbell",
    name: "Decline Bench Press (Barbell)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps"],
    equipment: "barbell",
    instructions:
      "Hook the legs in and set the shoulder blades before unracking.\nLower to the lower chest with the elbows tucked.\nPress up on a short, nearly vertical path.",
    bodyEffect:
      "Pressing on a downward slope puts the arm path below horizontal, so the humerus adducts and extends rather than flexing. The range of motion is the shortest of the three bench angles.\n\nThat line of pull favours the lower, sternal fibres of pectoralis major, and because the anterior deltoid contributes very little, the pec and triceps carry an unusually large share. The shorter stroke is also why most people press more here than on flat.\n\nUseful as a heavy pressing variation that spares the shoulder — the reduced deltoid involvement and shorter range make it comparatively forgiving on an irritable front shoulder. It builds little that flat pressing does not, so it is a rotation option rather than a staple.",
    alternatives: [
      {
        slug: "dip-chest",
        note: "Reaches the same lower-chest fibres through a much longer range and lets the shoulder blades move freely, but loading is capped by bodyweight plus whatever you can hang from a belt.",
      },
      {
        slug: "high-to-low-cable-fly",
        note: "Same downward line of pull with no triceps involvement, so tension stays on the lower pec throughout instead of shifting to the arms near lockout.",
      },
      {
        slug: "bench-press-barbell",
        note: "Longer range and more anterior-deltoid involvement, spreading the work across the whole pec rather than concentrating it in the lower fibres.",
      },
    ],
  },
  {
    slug: "chest-press-machine",
    name: "Chest Press (Machine)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps"],
    equipment: "machine",
    instructions:
      "Set the seat so the handles sit level with the mid chest.\nPress out without letting the shoulders round forward.\nControl the return until you feel the chest lengthen, then press again.",
    bodyEffect:
      "Horizontal adduction with elbow extension along a path the machine dictates. The seat and back pad do all the stabilising, so the joints move through a fixed arc regardless of how tired you are.\n\nPectoralis major and the triceps take almost the entire load. The anterior deltoid assists but does far less than in any free-weight press, and the rotator cuff barely participates because nothing has to be balanced.\n\nThat makes it the safest place to take a chest press to genuine failure, and the easiest to drop-set. The trade-off is that none of the balance, bracing or bar-path skill transfers to a barbell — it buys chest stimulus, not pressing ability.",
    alternatives: [
      {
        slug: "bench-press-barbell",
        note: "Free-weight pressing adds bracing and bar-path control and loads far heavier, but you cannot safely train to failure without a spotter.",
      },
      {
        slug: "bench-press-dumbbell",
        note: "Each arm balances its own load, so the shoulder stabilisers and the weaker side get work the machine's fixed path removes entirely.",
      },
      {
        slug: "pec-deck",
        note: "Strips out elbow extension so the triceps stop contributing and the pec works alone — much better isolation, much less total load.",
      },
    ],
  },
  {
    slug: "incline-chest-press-machine",
    name: "Incline Chest Press (Machine)",
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders", "triceps"],
    equipment: "machine",
    instructions:
      "Set the seat so the handles line up with the upper chest, not the throat.\nPress up and forward along the machine's path.\nLower until the upper chest lengthens, without shrugging.",
    bodyEffect:
      "An inclined pressing arc — shoulder flexion mixed with horizontal adduction — held on rails so nothing has to be balanced. The pad fixes the torso and the shoulder blades, and the path never varies.\n\nThe clavicular head of pectoralis major and the anterior deltoid do the pressing, with the triceps finishing. Stabiliser involvement is minimal, so fatigue accumulates in the target muscles rather than in the shoulder girdle.\n\nIt is the most practical way to load the upper chest heavily and to failure without a spotter or an awkward dumbbell setup. It builds no free-weight pressing skill, so it works best alongside a barbell or dumbbell incline rather than replacing one.",
    alternatives: [
      {
        slug: "incline-bench-press-dumbbell",
        note: "A longer arc and independent loading per side reach the upper pec through more range and expose imbalances the machine's fixed path conceals.",
      },
      {
        slug: "low-to-high-cable-fly",
        note: "No elbow extension, so the triceps drop out entirely and the upper pec holds tension across the whole arc rather than only near lockout.",
      },
      {
        slug: "chest-press-machine",
        note: "The flat version shifts emphasis down onto the larger sternal head and usually allows more load through a slightly shorter arc.",
      },
    ],
  },
  {
    slug: "chest-press-smith",
    name: "Bench Press (Smith Machine)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "smith",
    instructions:
      "Set the bench so the bar's fixed path lands on your lower chest.\nUnrack with a wrist twist, lower to the chest, press back up.\nRe-rack by twisting the wrists forward at the top.",
    bodyEffect:
      "Horizontal adduction and elbow extension along a rail that removes every degree of freedom except up and down. Because the bar cannot drift, the body has to adapt to the bar's line rather than the other way round.\n\nPectoralis major and the triceps do the pressing and the anterior deltoid assists, much as on a free bench. What largely disappears is the stabilising work of the rotator cuff and the fine bar-path corrections, since the rails handle both.\n\nThe practical value is safety: with built-in catches you can press heavy and close to failure alone. The cost is that the fixed vertical path suits some people's shoulders poorly, and the strength it builds transfers only partly to a free barbell.",
    alternatives: [
      {
        slug: "bench-press-barbell",
        note: "A free bar lets the path follow your own shoulder mechanics and trains the stabilising the rails remove, but needs a spotter to approach failure safely.",
      },
      {
        slug: "chest-press-machine",
        note: "A converging machine arc usually tracks the shoulder joint better than a straight vertical rail, and is easier on an irritable shoulder.",
      },
      {
        slug: "bench-press-dumbbell",
        note: "Two independent loads restore all the balancing the Smith removes, and let each shoulder find its own comfortable path.",
      },
    ],
  },
  {
    slug: "floor-press-barbell",
    name: "Floor Press (Barbell)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps"],
    equipment: "barbell",
    instructions:
      "Lie on the floor with the knees bent, bar over the chest.\nLower until the upper arms touch the floor, pause briefly, then press.\nDo not bounce the elbows off the floor.",
    bodyEffect:
      "A press with the bottom of the range cut off by the floor. The upper arm can only travel until the triceps contact the ground, so the shoulder never reaches the extended, stretched position a bench allows.\n\nThat removes the pec's contribution at long muscle lengths and hands a larger share of the work to the triceps and the mid-range of pectoralis major. There is also no leg drive and no arch, so the torso contributes almost nothing.\n\nIt exists to train lockout strength and to give the shoulder a break: the limited range is precisely what makes it usable when the front of the shoulder is irritable. As a hypertrophy lift for the chest it is clearly inferior to a full-range press.",
    alternatives: [
      {
        slug: "bench-press-barbell",
        note: "Full range loads the pec at long muscle lengths, which the floor cuts off entirely — better for growth, harder on a sore shoulder.",
      },
      {
        slug: "close-grip-bench-press",
        note: "Also triceps-biased but through a full range, so it builds lockout strength without giving up the stretched portion of the press.",
      },
      {
        slug: "floor-press-dumbbell",
        note: "Independent loads let each arm find its own path and expose imbalances, at the cost of the absolute weight a bar allows.",
      },
    ],
  },
  {
    slug: "floor-press-dumbbell",
    name: "Floor Press (Dumbbell)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps"],
    equipment: "dumbbell",
    instructions:
      "Lie on the floor, bells at the shoulders, knees bent.\nPress up, then lower until the upper arms rest lightly on the floor.\nPause, then press again without bouncing.",
    bodyEffect:
      "A partial-range press: the floor stops the upper arm before the shoulder reaches end range, while two independent bells still demand balancing throughout.\n\nThe triceps and the mid-range fibres of pectoralis major carry most of the load, with the anterior deltoid and rotator cuff working continuously to keep each bell tracking. The stretched portion of the pec's range is never loaded.\n\nUseful when a bench is unavailable, when the front of the shoulder is irritable, or when you want pressing volume without the end-range stress. It will not build a full-range chest as well as a bench press and is not meant to.",
    alternatives: [
      {
        slug: "bench-press-dumbbell",
        note: "The bench allows a deep stretched position the floor removes, which is where most of the pec's growth stimulus comes from.",
      },
      {
        slug: "floor-press-barbell",
        note: "One bar means heavier loading and simpler setup, but hides any left-right difference and fixes the hands in one position.",
      },
      {
        slug: "push-up",
        note: "Similar joint action with the shoulder blades free to move, which brings serratus anterior into it — but load stops at bodyweight.",
      },
    ],
  },
  {
    slug: "chest-fly-dumbbell",
    name: "Chest Fly (Dumbbell)",
    primaryMuscle: "chest",
    equipment: "dumbbell",
    instructions:
      "Lie flat, bells above the chest, elbows softly bent and held at that angle.\nOpen the arms in a wide arc until the chest stretches, then hug them back together.\nThe elbow angle should not change through the set.",
    bodyEffect:
      "Pure shoulder horizontal adduction: the elbow is fixed, so the only joint moving is the shoulder and the only muscle that can shorten the lever is the pec.\n\nPectoralis major does essentially all of the work, with the anterior deltoid and the biceps' short head stabilising. Removing elbow extension removes the triceps entirely, which is what separates a fly from a press.\n\nBecause gravity pulls straight down, resistance peaks at the bottom of the arc — exactly where the pec is longest and most stretched, which is a potent hypertrophy stimulus. It also means tension almost vanishes at the top, and that stretched position is where shoulders get hurt if you go too heavy.",
    alternatives: [
      {
        slug: "cable-fly",
        note: "The cable keeps tension on through the whole arc, including the squeeze at the top where a dumbbell fly goes slack.",
      },
      {
        slug: "pec-deck",
        note: "The machine supports the arms and keeps the elbow angle for you, so it is far more forgiving on the shoulder at the stretched position.",
      },
      {
        slug: "bench-press-dumbbell",
        note: "Adding elbow extension brings the triceps in and lets you load several times heavier, but the pec no longer works in isolation.",
      },
    ],
  },
  {
    slug: "incline-fly-dumbbell",
    name: "Incline Fly (Dumbbell)",
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders"],
    equipment: "dumbbell",
    instructions:
      "Bench at about 30°. Bells above the upper chest, elbows softly bent.\nOpen wide until the chest stretches, then arc back together over the collarbones.\nKeep the elbow angle fixed throughout.",
    bodyEffect:
      "Horizontal adduction performed on an upward slope, so the arms sweep across the body at an angle rather than straight across it. The elbow stays locked at one angle, leaving the shoulder as the only working joint.\n\nThe clavicular fibres of pectoralis major take the largest share, with the anterior deltoid assisting more than on a flat fly. No triceps involvement at all.\n\nThe stretched bottom position loads the upper chest at long muscle lengths, which is where flies earn their keep. Resistance disappears near the top and the shoulder is vulnerable at the bottom, so this is a controlled accessory rather than a place to chase weight.",
    alternatives: [
      {
        slug: "low-to-high-cable-fly",
        note: "The cable holds tension right through the top of the arc, where a dumbbell incline fly loses resistance completely.",
      },
      {
        slug: "chest-fly-dumbbell",
        note: "The flat version shifts the emphasis down onto the larger sternal fibres and takes the anterior deltoid largely out of it.",
      },
      {
        slug: "incline-bench-press-dumbbell",
        note: "Adding elbow extension recruits the triceps and multiplies the load you can handle, but the upper pec no longer works alone.",
      },
    ],
  },
  {
    slug: "cable-fly",
    name: "Cable Fly",
    primaryMuscle: "chest",
    equipment: "cable",
    instructions:
      "Set both pulleys at chest height and take a short staggered stance.\nWith the elbows softly bent, bring the hands together in front of the sternum.\nLet the arms open back until the chest stretches, without letting the shoulders roll forward.",
    bodyEffect:
      "Shoulder horizontal adduction against a horizontal line of pull. Because the resistance comes from the side rather than from below, the load does not fall off as the arms come together.\n\nPectoralis major works alone as prime mover; the elbow angle is fixed so the triceps contribute nothing, and the anterior deltoid and rotator cuff act as stabilisers. Crossing the hands past each other adds a little more adduction at the very end.\n\nConstant tension through the whole arc, including the fully shortened position, is what a dumbbell fly cannot offer. It is a finisher and a stimulus-per-kilo movement rather than a loading one — the pulleys will run out of useful resistance long before the pec does.",
    alternatives: [
      {
        slug: "chest-fly-dumbbell",
        note: "Free weights load the stretched bottom position much harder, but tension disappears entirely as the arms come together.",
      },
      {
        slug: "pec-deck",
        note: "The machine supports the arms and fixes the path, so it is easier to push to failure and much more forgiving on the shoulder.",
      },
      {
        slug: "high-to-low-cable-fly",
        note: "Dropping the line of pull downward shifts emphasis onto the lower sternal fibres instead of spreading it across the whole pec.",
      },
    ],
  },
  {
    slug: "high-to-low-cable-fly",
    name: "High-to-Low Cable Fly",
    primaryMuscle: "chest",
    equipment: "cable",
    instructions:
      "Set both pulleys high. Step forward into a stagger and lean slightly in.\nSweep the hands down and together in front of the hips.\nReturn under control until the chest stretches across the top.",
    bodyEffect:
      "Horizontal adduction combined with shoulder extension — the arms travel down and in, following the line of the lower pec fibres from the sternum to the upper arm.\n\nThat downward path biases the lower, sternal portion of pectoralis major. The elbow angle stays fixed so the triceps stay out, and the lats contribute a little through the extension component.\n\nCables hold tension across the entire arc, so the shortened position at the bottom is genuinely loaded rather than being a rest. It complements incline work directly and is a low-risk way to add chest volume once the heavy pressing is done.",
    alternatives: [
      {
        slug: "cable-fly",
        note: "A level line of pull spreads the work across the whole pec rather than concentrating it in the lower sternal fibres.",
      },
      {
        slug: "dip-chest",
        note: "Loads the same lower-chest fibres far heavier by adding elbow extension and bodyweight, but brings the triceps in as a major contributor.",
      },
      {
        slug: "decline-bench-press-barbell",
        note: "A pressing version of the same downward line: much more load, but the triceps take a large share and the range is shorter.",
      },
    ],
  },
  {
    slug: "low-to-high-cable-fly",
    name: "Low-to-High Cable Fly",
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders"],
    equipment: "cable",
    instructions:
      "Set both pulleys low. Stagger the stance and hold the elbows softly bent.\nSweep the hands up and together to about collarbone height.\nLower under control, feeling the stretch across the upper chest.",
    bodyEffect:
      "Horizontal adduction combined with shoulder flexion — the hands travel up and in, matching the fibre direction of the clavicular head from the collarbone down to the upper arm.\n\nThe upper chest takes the largest share, with the anterior deltoid assisting through the flexion component. No triceps involvement, since the elbow angle never changes.\n\nThis is one of the few movements that loads the upper chest in its fully shortened position, which incline pressing does poorly because the bar or bells go weightless at the top. Light loads only — the point is tension and range, not weight on the stack.",
    alternatives: [
      {
        slug: "incline-fly-dumbbell",
        note: "Free weights load the stretched bottom position harder, but tension vanishes at the top where this version peaks.",
      },
      {
        slug: "incline-bench-press-dumbbell",
        note: "Adding elbow extension recruits the triceps and allows far heavier loading of the same upper-chest fibres.",
      },
      {
        slug: "cable-fly",
        note: "A level line of pull moves the emphasis off the clavicular head and spreads it across the whole pec.",
      },
    ],
  },
  {
    slug: "pec-deck",
    name: "Pec Deck",
    primaryMuscle: "chest",
    equipment: "machine",
    instructions:
      "Set the seat so the handles sit level with mid chest and the shoulders stay down.\nBring the pads together in front of you without shrugging.\nOpen back to a comfortable stretch, not a maximal one.",
    bodyEffect:
      "Pure shoulder horizontal adduction on a fixed arc, with the upper arm supported for most of the range. The elbow does not extend, and the torso is held by the back pad.\n\nPectoralis major does essentially all of the work. The triceps are entirely uninvolved and even the anterior deltoid contributes little, because there is nothing to stabilise and no path to control.\n\nBeing machine-guided and arm-supported makes it the most forgiving chest isolation available and the easiest to take to failure or drop-set safely. The corresponding limitation is that it teaches nothing about controlling a load, so it belongs after pressing rather than instead of it.",
    alternatives: [
      {
        slug: "cable-fly",
        note: "Cables allow you to choose the line of pull and to cross the hands past each other, adding adduction the machine's fixed arc cannot reach.",
      },
      {
        slug: "chest-fly-dumbbell",
        note: "Free weights load the stretched position much harder, but demand real shoulder control and lose all tension at the top.",
      },
      {
        slug: "chest-press-machine",
        note: "Adding elbow extension brings the triceps in and allows far more load, at the cost of isolating the pec.",
      },
    ],
  },
  {
    slug: "push-up",
    name: "Push Up",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "abs"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hands slightly wider than the shoulders, body in one line from head to heels.\nLower until the chest is just off the floor, elbows at about 45°.\nPress back up and let the shoulder blades spread apart at the top.",
    bodyEffect:
      "A closed-chain press: the hands stay fixed and the body moves. That single difference means the shoulder blades glide across the ribcage instead of being pinned to a bench.\n\nPectoralis major and the triceps drive the press, but serratus anterior works hard to protract the shoulder blades at the top — a muscle bench pressing actively prevents from working. The abs and glutes hold the torso rigid, so the trunk is genuinely loaded.\n\nIt builds pressing endurance, shoulder-blade control and trunk stiffness in one movement, needs no equipment, and scales through hand elevation, tempo and added load. Its ceiling is bodyweight, so it stops being a strength stimulus once you can do sets of twenty.",
    alternatives: [
      {
        slug: "bench-press-barbell",
        note: "Loads the same joint action far heavier, but pins the shoulder blades to the bench so serratus anterior and the trunk stop contributing.",
      },
      {
        slug: "deficit-push-up",
        note: "Elevating the hands lets the chest drop below them, adding the stretched range a floor push-up cannot reach.",
      },
      {
        slug: "dip-chest",
        note: "Also closed-chain, but the downward arm path shifts the emphasis onto the lower chest and loads full bodyweight rather than a fraction of it.",
      },
      {
        slug: "push-up-weighted",
        note: "A plate across the upper back turns the same movement back into strength work once thirty clean reps are easy.",
      },
    ],
  },
  {
    slug: "push-up-weighted",
    name: "Weighted Push Up",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "abs"],
    equipment: "bodyweight",
    trackingType: "weight_reps",
    instructions:
      "Have a plate, a chain or a weight vest placed across the upper back.\nSet the hands slightly wider than the shoulders and brace hard — the load makes the hips sag.\nLower the chest to just above the floor and press back up, keeping the body one line.",
    bodyEffect:
      "A horizontal closed-chain press with external load added on top of the portion of bodyweight the hands already carry, so the shoulder horizontally adducts and the elbow extends against far more than a push-up normally supplies.\n\nPectoralis major and the triceps do the pressing, with the anterior deltoid assisting. The difference from a bench press is the shoulder blades: they move freely on the ribcage, so serratus anterior works throughout, and the abdominals resist the load trying to drop the hips.\n\nAdding weight is what keeps the push-up a strength movement rather than an endurance one once thirty clean reps are easy. The plate has to be placed by somebody else and it slides, which is the practical reason a vest or a bench press usually takes over at heavier loads.",
    alternatives: [
      {
        slug: "push-up",
        note: "The same movement carrying only bodyweight, which is the honest place to be until the reps are clean and the hips stop sagging.",
      },
      {
        slug: "bench-press-barbell",
        note: "Loads the same press far more precisely and far heavier, at the cost of pinning the shoulder blades to a bench.",
      },
      {
        slug: "deficit-push-up",
        note: "Adds range instead of load by letting the chest drop below the hands, which is the other way to make a push-up harder.",
      },
    ],
  },
  {
    slug: "deficit-push-up",
    name: "Deficit Push Up",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "abs"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Set the hands on parallettes, low boxes or dumbbells.\nLower until the chest passes below the level of the hands.\nPress back up without letting the hips sag.",
    bodyEffect:
      "The same closed-chain press as a floor push-up, but raising the hands lets the torso travel below them, so the shoulder reaches an extended, stretched position the floor cuts off.\n\nPectoralis major is loaded at longer muscle lengths than an ordinary push-up allows, which is where most of the growth stimulus lives. The triceps, serratus anterior and trunk work as they do in any push-up, with the trunk working slightly harder to resist the deeper position.\n\nIt is the cheapest way to make bodyweight pressing a genuine hypertrophy stimulus again once ordinary push-ups have become easy. The deeper position is also more demanding on the front of the shoulder, so it suits healthy shoulders rather than irritable ones.",
    alternatives: [
      {
        slug: "push-up",
        note: "The floor stops the descent early, which loses the stretched range but is far kinder to an irritable front shoulder.",
      },
      {
        slug: "bench-press-dumbbell",
        note: "Reaches a similar stretched position with adjustable external load, but pins the shoulder blades so serratus and trunk drop out.",
      },
      {
        slug: "dip-chest",
        note: "Also a deep closed-chain press, but the downward path biases the lower chest and loads your entire bodyweight rather than part of it.",
      },
    ],
  },
  {
    slug: "incline-push-up",
    name: "Incline Push Up",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "abs"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hands on a bench, box or bar with the body in a straight line.\nLower the chest to the surface, elbows at about 45°.\nPress back up and spread the shoulder blades at the top.",
    bodyEffect:
      "A push-up with the hands raised, which reduces the proportion of bodyweight the arms carry. The joint action is unchanged; only the effective load falls.\n\nPectoralis major and the triceps still drive the press and serratus anterior still protracts the shoulder blades, but every muscle works against less resistance. Raising the hands also tips the pressing line slightly downward, marginally favouring the lower chest.\n\nIts value is as a regression: the same movement pattern, the same shoulder-blade mechanics, at a load a beginner can actually control for sets. Lower the surface as strength improves and it becomes an ordinary push-up.",
    alternatives: [
      {
        slug: "push-up",
        note: "The floor version carries a much larger share of bodyweight — the same movement once you can control the incline for clean sets.",
      },
      {
        slug: "chest-press-machine",
        note: "Also easy to scale, but the seat removes the trunk and shoulder-blade work that makes push-ups worth doing.",
      },
      {
        slug: "decline-push-up",
        note: "Raising the feet instead of the hands does the opposite — it increases the load and shifts emphasis toward the upper chest.",
      },
    ],
  },
  {
    slug: "decline-push-up",
    name: "Decline Push Up",
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders", "triceps"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Feet on a bench or box, hands on the floor slightly wider than the shoulders.\nLower until the chest is just off the floor.\nPress up, keeping the hips from sagging or piking.",
    bodyEffect:
      "Raising the feet tips the body forward, so the arms carry more of your bodyweight and press along a line angled up toward the head rather than straight out.\n\nThat upward line shifts emphasis onto the clavicular fibres of the upper chest and the anterior deltoid, while the triceps still finish the press. The trunk works considerably harder to stop the hips sagging in the tipped position.\n\nIt is the standard way to add both load and upper-chest bias to push-ups without equipment. Raise the feet too high and it becomes a shoulder press against the floor, with the chest contributing very little.",
    alternatives: [
      {
        slug: "push-up",
        note: "Level feet reduce the load and spread the work across the whole pec instead of biasing the upper fibres.",
      },
      {
        slug: "incline-bench-press-dumbbell",
        note: "Targets the same upper-chest fibres with adjustable external load, but pins the shoulder blades so the trunk and serratus stop working.",
      },
      {
        slug: "pike-push-up",
        note: "Takes the tipping further until the press is essentially vertical, turning it into a shoulder exercise with minimal chest involvement.",
      },
    ],
  },
  {
    slug: "dip-chest",
    name: "Dip (Chest)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Support yourself on parallel bars and lean the torso forward.\nLet the elbows flare a little and lower until the chest stretches.\nPress back up without coming fully upright.",
    bodyEffect:
      "A vertical closed-chain press. Leaning forward puts the upper arm on a downward, slightly flared path, so the shoulder both adducts and extends while the elbow extends.\n\nThe forward lean is what makes this a chest movement: it biases the lower sternal fibres of pectoralis major, with the triceps taking a large secondary share and the shoulder blades free to move on the ribcage. Staying upright instead shifts the work almost entirely to the triceps.\n\nFull bodyweight through a long range makes it one of the heaviest chest movements available without a barbell, and it loads easily with a belt. The deep bottom position is demanding on the front of the shoulder and is where people get hurt.",
    alternatives: [
      {
        slug: "decline-bench-press-barbell",
        note: "Similar downward pressing line with the torso supported and the range shorter, which is far easier on the front of the shoulder.",
      },
      {
        slug: "dip-triceps",
        note: "Staying upright instead of leaning forward moves nearly all of the work from the lower chest to the triceps.",
      },
      {
        slug: "high-to-low-cable-fly",
        note: "Same lower-chest emphasis with no triceps involvement and no shoulder stress — much lighter, purely an isolation movement.",
      },
      {
        slug: "dip-weighted",
        note: "Hanging weight from a belt is how this keeps progressing once bodyweight sets run past a dozen clean reps.",
      },
    ],
  },
  {
    slug: "dip-weighted",
    name: "Weighted Dip",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "bodyweight",
    trackingType: "weight_reps",
    instructions:
      "Hang weight from a dip belt, or hold a dumbbell between the feet.\nSupport yourself on parallel bars with a slight forward lean.\nLower until the chest stretches, then press back up without locking rigidly.",
    bodyEffect:
      "A vertical closed-chain press carrying more than your bodyweight, so the shoulder adducts and extends and the elbow extends against a load you choose rather than the one you happen to weigh.\n\nThe lower sternal fibres of pectoralis major lead, with the triceps taking a large share and the anterior deltoid holding the bottom position. The trunk works harder than on an unweighted dip because the belt swings and has to be controlled.\n\nIt is the heaviest pressing most people can do without a bench, and the only way to keep progressing dips once bodyweight reps run into the twenties. The loaded bottom position is demanding on the front of the shoulder, so depth should be earned before weight is added rather than after.",
    alternatives: [
      {
        slug: "dip-chest",
        note: "The same movement at exactly bodyweight, which is where to build clean reps and full depth before hanging anything from a belt.",
      },
      {
        slug: "chin-up-weighted",
        note: "The pulling counterpart on the same belt — a vertical pull rather than a press, and the obvious thing to pair this with.",
      },
      {
        slug: "decline-bench-press-barbell",
        note: "A similar downward pressing line with the torso supported, so it loads heavily without asking anything of the front of the shoulder.",
      },
    ],
  },
  {
    slug: "dip-machine-assisted",
    name: "Assisted Dip (Machine)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps"],
    equipment: "machine",
    trackingType: "assist_reps",
    instructions:
      "Set the assistance so you can complete clean reps without failing early.\nKneel on the pad, lean forward slightly, lower until the chest stretches.\nPress back up under control.",
    bodyEffect:
      "The same downward closed-chain press as an unassisted dip, with a counterweighted pad removing part of your bodyweight so the movement stays within reach.\n\nThe lower fibres of pectoralis major and the triceps still do the work and the shoulder blades still move freely, but against a reduced load. Because the pad also steadies the body, the trunk contributes less than on free bars.\n\nIt exists so the dip pattern can be trained before you are strong enough to do it, and so heavy sets can be extended past failure by adding assistance. Reduce the assistance over time; the goal is to stop needing it.",
    alternatives: [
      {
        slug: "dip-chest",
        note: "Full bodyweight through the same range, with the trunk genuinely working to keep you steady on free bars.",
      },
      {
        slug: "chest-press-machine",
        note: "Easier to scale and to overload precisely, but the seat removes the shoulder-blade movement that makes dipping worthwhile.",
      },
      {
        slug: "decline-push-up",
        note: "Bodyweight pressing with no machine at all, though the load is lower and the emphasis sits on the upper rather than lower chest.",
      },
      {
        slug: "dip-machine",
        note: "The other machine dip: this one supplies the load rather than subtracting from yours, so it scales upward past bodyweight.",
      },
    ],
  },
  {
    slug: "dip-machine",
    name: "Seated Dip (Machine)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps"],
    equipment: "machine",
    trackingType: "weight_reps",
    instructions:
      "Set the seat so the handles sit level with the lower chest.\nPress down and slightly forward until the elbows lock.\nReturn under control until the chest feels the stretch.",
    bodyEffect:
      "A seated downward press on a fixed path, loaded by the stack rather than by your bodyweight. The upper arm travels down and slightly forward while the elbow extends, the same joint action as a dip on bars.\n\nThe lower fibres of pectoralis major and all three heads of the triceps do the work, with the anterior deltoid assisting. The seat and back pad hold the torso, so the trunk and the shoulder-blade control that free bars demand contribute almost nothing.\n\nBecause the load is a stack and not you, it starts below bodyweight and goes far above it, which makes it the one dip variant that can be programmed by the kilogram from the first session to the last. That same support is what it gives up: it will not build the stability a free dip does.",
    alternatives: [
      {
        slug: "dip-chest",
        note: "The same pressing line on free bars at exactly bodyweight, where the trunk and shoulder blades genuinely work to keep you steady.",
      },
      {
        slug: "dip-machine-assisted",
        note: "The counterweighted station instead: it subtracts from your bodyweight rather than supplying the load, so it scales downward, not up.",
      },
      {
        slug: "dip-weighted",
        note: "Adds a belt to a free dip, which loads past bodyweight the same way but keeps the balance demand the seat removes.",
      },
    ],
  },
  {
    slug: "svend-press",
    name: "Svend Press",
    primaryMuscle: "chest",
    equipment: "plate",
    trackingType: "weight_reps",
    instructions:
      "Press two plates together between the palms at chest height.\nSqueeze hard and push the plates straight out in front of you.\nDraw them back to the chest, never letting the pressure between them drop.",
    bodyEffect:
      "Horizontal adduction driven not by moving a load through space but by pressing the hands together — the resistance is the friction you generate, and the arm extension simply lengthens the lever.\n\nPectoralis major contracts nearly isometrically at a short muscle length throughout, with the anterior deltoid holding the arms up and the triceps extending the elbows. There is no stretched position at all.\n\nThat makes it a pure squeeze-and-tension movement, useful as a warm-up to get the chest firing or as a finisher after pressing. It loads almost nothing in absolute terms and will not build size or strength on its own.",
    alternatives: [
      {
        slug: "cable-fly",
        note: "Also holds tension through the shortened position, but adds a genuine stretched range and a load you can actually progress.",
      },
      {
        slug: "pec-deck",
        note: "Trains the same adduction with real external resistance and a full range, instead of relying on self-generated tension.",
      },
      {
        slug: "push-up",
        note: "A full-range pressing movement with no equipment at all, loading the chest through a real stretch rather than a squeeze.",
      },
    ],
  },
  {
    slug: "landmine-press-chest",
    name: "Landmine Chest Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders", "triceps"],
    equipment: "barbell",
    instructions:
      "Kneel or stand facing a barbell anchored in a landmine, end held at the chest with both hands.\nPress up and forward along the bar's arc.\nReturn to the chest under control.",
    bodyEffect:
      "Pressing along an arc that rises as it travels forward, so the movement is part horizontal adduction and part shoulder flexion — and the hands converge naturally as the bar comes in.\n\nThe upper fibres of pectoralis major and the anterior deltoid take most of the load, with the triceps finishing. Because the bar is anchored, the arc is partly guided while the trunk still has to resist the rotation and the forward pull.\n\nThe angled path is unusually shoulder-friendly, which makes it a good pressing option when overhead or flat bench work is uncomfortable. Loading is limited by the leverage of the landmine, so it supplements heavy pressing rather than replacing it.",
    alternatives: [
      {
        slug: "incline-bench-press-dumbbell",
        note: "Loads the same upper-chest bias far heavier, but the fixed bench and steeper angle put more stress on the front of the shoulder.",
      },
      {
        slug: "low-to-high-cable-fly",
        note: "Same upward line of pull with the elbows fixed, so the triceps drop out and the upper pec works in isolation.",
      },
      {
        slug: "push-up",
        note: "Free shoulder blades and full trunk involvement, but no way to adjust the angle and load stops at bodyweight.",
      },
    ],
  },
  {
    slug: "guillotine-press",
    name: "Guillotine Press (Barbell)",
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders"],
    equipment: "barbell",
    instructions:
      "Lie flat with a wide grip and the elbows flared out to the sides.\nLower the bar toward the collarbone, not the sternum.\nPress straight up. Use light weight and a spotter.",
    bodyEffect:
      "A bench press with the elbows deliberately flared to ninety degrees and the bar tracking to the neck rather than the chest, which puts the humerus in pure horizontal adduction with no extension component.\n\nThat isolates pectoralis major more completely than a standard press: the triceps contribute less because the elbow travels less, and the lats cannot assist at all. The clavicular fibres get a larger share than on a tucked-elbow press.\n\nThe isolation is real and so is the risk — the flared, externally rotated bottom position is the most vulnerable one for the shoulder, and the bar is over your throat. It is a light, controlled hypertrophy variation for healthy shoulders, never a heavy lift.",
    alternatives: [
      {
        slug: "pec-deck",
        note: "Isolates the pec at least as well with none of the shoulder risk, because the machine supports the arms and caps the range.",
      },
      {
        slug: "bench-press-barbell",
        note: "Tucking the elbows brings the triceps and lats in, which is less isolating but far safer and much heavier.",
      },
      {
        slug: "cable-fly",
        note: "Pure horizontal adduction with constant tension and no bar over your throat — the same intent, safely executed.",
      },
    ],
  },
  {
    slug: "single-arm-cable-press",
    name: "Single-Arm Cable Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["abs", "triceps"],
    equipment: "cable",
    instructions:
      "Set one pulley at chest height and stand facing away in a split stance.\nPress the handle straight forward until the arm is extended and the shoulder blade protracts.\nReturn slowly, resisting the pull back and the twist.",
    bodyEffect:
      "A one-armed horizontal press with the shoulder blade free to protract at the end — and a cable pulling from one side, so the trunk has to resist rotation the entire time.\n\nPectoralis major and the triceps press, serratus anterior finishes the protraction, and the obliques and abs work isometrically to stop the torso turning. That anti-rotation demand is a genuine part of the exercise, not an afterthought.\n\nIt is the most useful chest movement for people who want pressing strength that transfers to standing, one-sided tasks, and it exposes side-to-side differences immediately. Load is limited by what your trunk can anchor, so it will never be your heaviest chest exercise.",
    alternatives: [
      {
        slug: "cable-fly",
        note: "Two-armed and elbows fixed, so the trunk stops resisting rotation and the pec works without the triceps.",
      },
      {
        slug: "push-up",
        note: "Also lets the shoulder blade protract and loads the trunk, but pushes straight down through both arms with no anti-rotation demand.",
      },
      {
        slug: "bench-press-dumbbell",
        note: "Loads each arm independently and much heavier, but lying on a bench removes both the trunk work and the shoulder-blade movement.",
      },
    ],
  },
  {
    slug: "band-chest-press",
    name: "Band Chest Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "band",
    trackingType: "reps",
    instructions:
      "Anchor a band behind you at chest height and hold an end in each hand.\nPress forward until the arms are extended and the hands nearly meet.\nReturn slowly against the band's pull.",
    bodyEffect:
      "Horizontal adduction with elbow extension against elastic rather than gravity, so the resistance grows as the band stretches and is highest exactly where the pec is shortest.\n\nPectoralis major and the triceps do the pressing, with the anterior deltoid assisting and the trunk bracing against the backward pull. The ascending resistance curve is the opposite of a dumbbell's, which peaks at the bottom.\n\nThat makes it a useful complement to free-weight pressing and a genuinely portable option — but bands are hard to quantify, progress in coarse jumps, and give almost no load in the stretched position where most growth stimulus comes from.",
    alternatives: [
      {
        slug: "cable-fly",
        note: "Also keeps tension through the shortened position, but with a measurable load you can progress in small, honest increments.",
      },
      {
        slug: "push-up",
        note: "Equipment-free like a band but loads the stretched bottom position, which is exactly where band tension disappears.",
      },
      {
        slug: "chest-press-machine",
        note: "Fixed path and precise loading, giving even resistance through the whole range instead of a band's ascending curve.",
      },
    ],
  },
  {
    slug: "squeeze-press-dumbbell",
    name: "Squeeze Press (Dumbbell)",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps"],
    equipment: "dumbbell",
    instructions:
      "Lie flat and hold two bells pressed hard together over the chest.\nLower them as one unit to the sternum, keeping the pressure between them.\nPress back up without ever letting them separate.",
    bodyEffect:
      "A neutral-grip press performed while actively pushing the bells together, so horizontal adduction is loaded both by the vertical press and by the inward squeeze.\n\nPectoralis major works against two demands at once — moving the load and holding it together — which keeps it under tension at the top where a normal press hands off to the skeleton. The triceps press, and the elbows staying tucked keeps the shoulder in a comparatively safe position.\n\nThe result is a press with an unusually strong shortened-position stimulus and very little shoulder stress, at the cost of using much lighter bells than an ordinary dumbbell press. A good finisher, a poor primary lift.",
    alternatives: [
      {
        slug: "bench-press-dumbbell",
        note: "Without the squeeze you can load far heavier and reach a deeper stretch, but the chest goes slack at lockout.",
      },
      {
        slug: "cable-fly",
        note: "Also loads the shortened position hard, and does it with a measurable stack rather than self-generated pressure.",
      },
      {
        slug: "svend-press",
        note: "Takes the squeeze idea to its extreme with almost no external load — pure tension, no meaningful stretch or progression.",
      },
    ],
  },
];

import type { SeedExercise } from "../types";

export const LEGS_POSTERIOR: SeedExercise[] = [
  /* ---- Hinges and hamstrings ---- */
  {
    slug: "romanian-deadlift-barbell",
    name: "Romanian Deadlift (Barbell)",
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["glutes", "back"],
    equipment: "barbell",
    instructions:
      "Start standing with the bar at the hips, knees softly bent.\nPush the hips back and let the bar slide down the thighs until the hamstrings stop you.\nDrive the hips forward to stand, without hyperextending at the top.",
    bodyEffect:
      "A hip hinge with the knees held at a fixed soft bend, so the hip flexes and extends while the knee barely moves and the bar stays close to the legs.\n\nBecause the knee angle does not change, the hamstrings — which cross both hip and knee — are stretched progressively as the hip folds, and they and the glutes extend it again. The spinal erectors work isometrically throughout to keep the back flat, and the lats hold the bar in.\n\nStarting from the top and stopping above the floor keeps the hamstrings under continuous tension through their most stretched range, which is why it is the reference hamstring builder. Range should be set by where the hamstrings stop you, not by touching the floor — going further just rounds the back.",
    alternatives: [
      {
        slug: "romanian-deadlift-dumbbell",
        note: "Bells at the sides let the load stay closer to the hips and each arm move freely, at the cost of total weight.",
      },
      {
        slug: "stiff-leg-deadlift",
        note: "Keeping the knees straighter increases the hamstring stretch further but reduces how much load the hips can take.",
      },
      {
        slug: "leg-curl-lying",
        note: "Trains the hamstrings' knee-flexion role instead of their hip-extension role — a genuinely different function.",
      },
    ],
  },
  {
    slug: "romanian-deadlift-dumbbell",
    name: "Romanian Deadlift (Dumbbell)",
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["glutes", "back"],
    equipment: "dumbbell",
    instructions:
      "Stand with a bell in each hand in front of or beside the thighs, knees softly bent.\nPush the hips back, letting the bells travel down the legs.\nDrive the hips forward to stand tall.",
    bodyEffect:
      "A hip hinge loaded with two independent weights, which can travel beside the legs rather than in front of them and so sit slightly closer to the hip joint.\n\nThe hamstrings lengthen under load as the hip folds and, with the glutes, extend it again. The erectors hold the spine rigid and the grip works throughout. Each side is loaded separately, so any tendency to shift weight becomes obvious.\n\nThe closer load line makes it a little kinder on the lower back than a barbell, and the setup is far simpler. Grip and the awkwardness of heavy bells cap the loading well below what the hamstrings could handle.",
    alternatives: [
      {
        slug: "romanian-deadlift-barbell",
        note: "One bar loads far heavier and is easier to progress, though it sits further from the hips and taxes the lower back more.",
      },
      {
        slug: "single-leg-romanian-deadlift",
        note: "One leg at a time adds a large balance and pelvic-control demand and exposes side-to-side differences.",
      },
      {
        slug: "good-morning",
        note: "Puts the load on the back instead of in the hands, removing grip as the limit but loading the spine considerably more.",
      },
    ],
  },
  {
    slug: "stiff-leg-deadlift",
    name: "Stiff Leg Deadlift",
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["glutes", "back"],
    equipment: "barbell",
    instructions:
      "Stand with the bar at the hips and the knees almost straight.\nHinge at the hips, lowering the bar down the legs while keeping the back flat.\nStand by driving the hips forward.",
    bodyEffect:
      "A hip hinge with the knees held nearly straight, which maximises the stretch on the hamstrings because they are lengthened at the knee as well as at the hip.\n\nThe hamstrings take the largest share and are loaded at their longest, with the glutes extending the hip and the erectors working hard isometrically. The straighter knee means a longer lever and more demand on the lower back than a Romanian deadlift.\n\nThe extreme stretch is a potent hamstring stimulus and it builds real resilience at long muscle lengths. It also means less load, more spinal demand, and a much smaller margin for a rounded back — control matters more here than on any other hinge.",
    alternatives: [
      {
        slug: "romanian-deadlift-barbell",
        note: "A soft knee bend shortens the lever, allowing considerably more load with less strain on the lower back.",
      },
      {
        slug: "back-extension",
        note: "Trains the same hinge against bodyweight with almost no spinal compression, which suits an irritable back.",
      },
      {
        slug: "leg-curl-lying",
        note: "Loads the hamstrings' other function — bending the knee — with no spinal involvement whatsoever.",
      },
    ],
  },
  {
    slug: "single-leg-romanian-deadlift",
    name: "Single-Leg Romanian Deadlift",
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["glutes"],
    equipment: "dumbbell",
    instructions:
      "Stand on one leg holding a bell in the opposite hand.\nHinge forward, letting the free leg extend behind as a counterweight.\nReturn to standing without touching the free foot down.",
    bodyEffect:
      "A hip hinge on one leg, so the pelvis must be held level by the standing hip while the hamstring and glute of that leg do all the work.\n\nThe standing hamstring lengthens and extends the hip while the glute medius and the deep hip rotators fight to stop the pelvis dropping and rotating. The trunk resists rotation throughout, and the ankle and foot work continuously to keep balance.\n\nIt trains hip stability and hamstring strength together in a way no bilateral hinge does, and it exposes asymmetries immediately. Balance limits the load long before the hamstring does, so it develops control rather than maximal strength.",
    alternatives: [
      {
        slug: "romanian-deadlift-dumbbell",
        note: "Both feet down removes the balance demand entirely, so the hamstrings can be loaded several times heavier.",
      },
      {
        slug: "bulgarian-split-squat",
        note: "Also single-leg with a large stability demand, but knee-dominant rather than hip-dominant.",
      },
      {
        slug: "leg-curl-seated",
        note: "Isolates one hamstring function with no balance component at all, useful when stability is the limit.",
      },
    ],
  },
  {
    slug: "good-morning",
    name: "Good Morning",
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["glutes", "back"],
    equipment: "barbell",
    instructions:
      "Set a bar on the upper back as for a squat, knees softly bent.\nHinge forward at the hips, keeping the back flat, until the torso approaches horizontal.\nDrive the hips forward to stand.",
    bodyEffect:
      "A hip hinge with the load carried on the upper back rather than in the hands, which puts the weight at the far end of the longest possible lever from the hips.\n\nThe hamstrings and glutes extend the hip, but the spinal erectors work extraordinarily hard isometrically because the load sits above and forward of the spine as the torso folds. The abs brace against the same force.\n\nIt is the most direct way to load the erectors and the hinge together, and it builds the position that keeps a heavy squat or deadlift from folding. The long lever means the load has to be modest, and it is unforgiving of any loss of back position.",
    alternatives: [
      {
        slug: "romanian-deadlift-barbell",
        note: "Holding the bar in the hands shortens the lever on the spine considerably, allowing far more load on the hamstrings.",
      },
      {
        slug: "back-extension",
        note: "The same hinge against bodyweight only, with almost no spinal compression — the safe way to train the pattern.",
      },
      {
        slug: "reverse-hyperextension",
        note: "Trains hip extension while decompressing rather than compressing the spine, which is the opposite of this movement.",
      },
    ],
  },
  {
    slug: "leg-curl-lying",
    name: "Leg Curl (Lying)",
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["calves"],
    equipment: "machine",
    instructions:
      "Lie face down with the pad just above the heels and the knee at the machine's pivot.\nCurl the heels toward the glutes without lifting the hips.\nLower under control to full extension.",
    bodyEffect:
      "Isolated knee flexion with the hip held extended by lying flat, so the hamstrings work at the knee while their hip-extension role is inactive.\n\nAll three hamstring muscles flex the knee, with gastrocnemius in the calf assisting because it also crosses the knee joint. Because the hip is straight, the hamstrings start relatively shortened at the hip end and lengthened at the knee end.\n\nKnee flexion is a genuinely separate hamstring function that hinging does not train, so this is a necessary complement rather than a redundant machine. Lifting the hips to cheat is the standard error and removes most of the effect.",
    alternatives: [
      {
        slug: "leg-curl-seated",
        note: "The flexed hip pre-stretches the hamstrings, which loads them at longer lengths and is generally the stronger stimulus.",
      },
      {
        slug: "nordic-curl",
        note: "A bodyweight knee flexion with an enormous eccentric load, far more demanding and better evidenced for injury prevention.",
      },
      {
        slug: "romanian-deadlift-barbell",
        note: "Trains the hamstrings' hip-extension role instead, through a stretch the curl never reaches.",
      },
    ],
  },
  {
    slug: "leg-curl-seated",
    name: "Leg Curl (Seated)",
    primaryMuscle: "hamstrings",
    equipment: "machine",
    instructions:
      "Sit with the thigh pad locked down and the roller just above the heels.\nCurl the heels back and under the seat.\nReturn under control without letting the stack rest.",
    bodyEffect:
      "Knee flexion performed with the hip flexed to roughly ninety degrees, so the hamstrings are already lengthened at the hip before the knee starts to bend.\n\nAll three hamstrings flex the knee from a pre-stretched position, which means they work at longer muscle lengths throughout the range than in a lying curl. Gastrocnemius assists at the knee.\n\nTraining a muscle at long lengths is a stronger hypertrophy stimulus, which is why the seated version generally outperforms the lying one for hamstring growth. The thigh pad has to be genuinely tight or the hips rise and the range shortens.",
    alternatives: [
      {
        slug: "leg-curl-lying",
        note: "The extended hip shortens the hamstrings at one end, so they work at shorter lengths through the same knee range.",
      },
      {
        slug: "nordic-curl",
        note: "Bodyweight knee flexion with a huge eccentric component, which is far harder and needs no machine.",
      },
      {
        slug: "single-leg-curl",
        note: "One leg at a time on the same machine, which exposes and lets you address a side-to-side difference.",
      },
    ],
  },
  {
    slug: "single-leg-curl",
    name: "Single-Leg Curl",
    primaryMuscle: "hamstrings",
    equipment: "machine",
    instructions:
      "Set up on a lying or seated curl machine but use one leg only.\nCurl through the full range without letting the hip lift or twist.\nLower slowly, then switch legs.",
    bodyEffect:
      "Knee flexion performed one leg at a time, so neither hamstring can compensate for the other and each gets the full attention of the set.\n\nThe hamstrings of the working leg flex the knee exactly as in the bilateral version; what changes is that any strength difference is now visible and correctable, and the pelvis has to be kept square rather than allowed to twist.\n\nHamstring strain risk is strongly associated with side-to-side asymmetry, which makes this more than a cosmetic detail — it is one of the few practical ways to find and address it. Each set takes twice as long.",
    alternatives: [
      {
        slug: "leg-curl-seated",
        note: "Both legs at once is faster and allows more total load, but the stronger side quietly takes more of it.",
      },
      {
        slug: "nordic-curl",
        note: "Loads both hamstrings eccentrically at a far higher intensity, with the best evidence for strain prevention.",
      },
      {
        slug: "single-leg-romanian-deadlift",
        note: "Also unilateral, but trains hip extension and balance rather than isolated knee flexion.",
      },
    ],
  },
  {
    slug: "nordic-curl",
    name: "Nordic Curl",
    primaryMuscle: "hamstrings",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Kneel with the ankles anchored under a pad or held by a partner.\nLower the torso forward as slowly as possible, keeping the hips straight.\nCatch yourself with the hands and push back up.",
    bodyEffect:
      "Knee flexion resisted eccentrically against nearly the whole bodyweight, with the hip held extended so the hamstrings are working at both of their attachments.\n\nAll three hamstrings resist the knee straightening under a load far greater than they can lift concentrically, which is why almost everyone can only lower and not return. The glutes and abs work isometrically to keep the hips from folding.\n\nHigh-force eccentric hamstring work has the strongest evidence of any exercise for reducing hamstring strains in running sports, which is the main reason to do it. It is brutally hard, produces severe soreness at first, and needs a slow introduction.",
    alternatives: [
      {
        slug: "leg-curl-seated",
        note: "A machine allows a load you can actually control through both phases and progress in small increments.",
      },
      {
        slug: "glute-ham-raise",
        note: "The same eccentric knee-flexion pattern on a dedicated bench, which supports the hips and makes the return achievable.",
      },
      {
        slug: "romanian-deadlift-barbell",
        note: "Loads the hamstrings at the hip rather than the knee, which is a complementary rather than equivalent stimulus.",
      },
    ],
  },
  {
    slug: "glute-ham-raise",
    name: "Glute Ham Raise",
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["glutes"],
    equipment: "machine",
    trackingType: "reps",
    instructions:
      "Set the foot plate so the knees sit just behind the pad.\nLower the torso forward under control until the body is horizontal.\nPull back up by driving the toes into the plate and flexing the knees.",
    bodyEffect:
      "Knee flexion and hip extension combined on a dedicated bench, so the hamstrings work at both ends of their length simultaneously through a long range.\n\nAll three hamstrings drive the knee flexion while the glutes extend the hip, and the calves contribute through the foot plate. The pad supporting the hips is what makes the concentric return achievable, unlike a Nordic curl.\n\nBecause it trains both hamstring functions at once with a real eccentric and a real concentric, it is arguably the most complete hamstring exercise there is. It needs a specific bench and is still hard enough that most people start with assistance.",
    alternatives: [
      {
        slug: "nordic-curl",
        note: "Needs no bench and loads the eccentric even harder, but almost nobody can complete the concentric.",
      },
      {
        slug: "leg-curl-seated",
        note: "Far easier to load and progress precisely, though it trains only the knee-flexion half of the hamstrings' job.",
      },
      {
        slug: "romanian-deadlift-barbell",
        note: "Loads the hip-extension half heavily, and pairs naturally with this rather than replacing it.",
      },
    ],
  },
  {
    slug: "cable-pull-through",
    name: "Cable Pull Through",
    primaryMuscle: "glutes",
    secondaryMuscles: ["hamstrings"],
    equipment: "cable",
    instructions:
      "Face away from a low pulley with a rope passed between the legs.\nHinge at the hips, letting the rope travel back.\nDrive the hips forward to stand tall and squeeze the glutes.",
    bodyEffect:
      "A hip hinge with the resistance pulling horizontally backward rather than downward, so the load is applied directly to the hips instead of through the spine.\n\nThe glutes and hamstrings extend the hip against a line of pull that is hardest at the top, exactly where a barbell hinge goes weightless. The erectors work only lightly, because the cable is not compressing the spine.\n\nThat combination makes it the best way to teach a hinge and to train hip extension when spinal loading has to stay low. The load is capped by the stack and by your ability to stay planted, so it is not a strength lift.",
    alternatives: [
      {
        slug: "romanian-deadlift-barbell",
        note: "Loads the hamstrings far heavier through a real stretch, at the cost of substantial spinal loading.",
      },
      {
        slug: "kettlebell-swing",
        note: "The same hip-extension pattern performed explosively, adding power and conditioning demand.",
      },
      {
        slug: "hip-thrust-barbell",
        note: "Loads hip extension at the top of the range even harder, with the shoulders supported and no hinge at all.",
      },
    ],
  },
  {
    slug: "kettlebell-swing",
    name: "Kettlebell Swing",
    primaryMuscle: "glutes",
    secondaryMuscles: ["hamstrings", "back"],
    equipment: "kettlebell",
    instructions:
      "Hike the bell back between the legs with a flat back.\nSnap the hips forward to float the bell to chest height — do not lift it with the arms.\nLet it swing back and repeat.",
    bodyEffect:
      "An explosive hip hinge: the bell is projected by a violent hip extension rather than lifted, and the arms only guide it.\n\nThe glutes and hamstrings produce a rapid concentric hip extension while the erectors and abs brace hard against a load swinging on a long lever. The lats hold the bell close on the backswing, and the whole thing repeats fast enough to drive the heart rate high.\n\nIt trains hip power and posterior-chain endurance at once and is one of the few conditioning tools that loads the hinge rather than the knees. Done as a squat or a front raise — the two standard errors — it trains neither.",
    alternatives: [
      {
        slug: "cable-pull-through",
        note: "The same hinge pattern under control rather than explosively, which is the better way to learn it.",
      },
      {
        slug: "romanian-deadlift-barbell",
        note: "Trains the same hip extension with far heavier loading and a real eccentric, but no power or conditioning element.",
      },
      {
        slug: "hip-thrust-barbell",
        note: "Loads hip extension at the shortened position far more heavily, with no spinal or conditioning demand.",
      },
    ],
  },
  /* ---- Glutes ---- */
  {
    slug: "hip-thrust-barbell",
    name: "Hip Thrust (Barbell)",
    primaryMuscle: "glutes",
    secondaryMuscles: ["hamstrings"],
    equipment: "barbell",
    instructions:
      "Sit with the upper back against a bench and the bar across the hips on a pad.\nDrive the hips up until the body is horizontal, ribs down.\nLower under control without resting the bar on the floor.",
    bodyEffect:
      "Horizontal hip extension with the shoulders supported, so the resistance is greatest at the top of the range where the hip is fully extended.\n\nGluteus maximus is the prime mover and reaches peak tension in its fully shortened position — the opposite of a squat, where the glutes are hardest-loaded at the bottom. The hamstrings assist and the abs must work to stop the ribs flaring and the movement becoming a back extension.\n\nLoading the glutes at end range is what makes it different from every squat and hinge, and it takes very heavy weight with almost no spinal or knee demand. The setup is awkward and the bar on the hips is uncomfortable without a decent pad.",
    alternatives: [
      {
        slug: "glute-bridge",
        note: "The same movement from the floor, which shortens the range but needs no bench and almost no setup.",
      },
      {
        slug: "single-leg-hip-thrust",
        note: "One leg at a time exposes asymmetries and adds a pelvic-control demand at a fraction of the load.",
      },
      {
        slug: "romanian-deadlift-barbell",
        note: "Loads the glutes hardest in their stretched position instead, which makes the two complementary.",
      },
    ],
  },
  {
    slug: "glute-bridge",
    name: "Glute Bridge",
    primaryMuscle: "glutes",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Lie on your back with the knees bent and feet flat, close to the hips.\nDrive the hips up until the body forms a line from knee to shoulder.\nLower under control without letting the ribs flare.",
    bodyEffect:
      "Hip extension performed lying on the floor, with the spine fully supported so no bracing or balance is required at all.\n\nGluteus maximus extends the hip and is loaded most at the top, with the hamstrings assisting. Because the shoulders rest on the floor rather than a bench, the range is shorter than a hip thrust's.\n\nIt is the simplest possible way to load hip extension and needs nothing, which makes it the standard starting point and a reliable rehabilitation exercise. Bodyweight becomes trivially easy quickly, so it needs external load or a progression to keep mattering.",
    alternatives: [
      {
        slug: "hip-thrust-barbell",
        note: "Elevating the shoulders lengthens the range and allows very heavy loading — the direct progression from this.",
      },
      {
        slug: "single-leg-glute-bridge",
        note: "One leg at a time roughly doubles the load and adds a pelvic-control demand, with no equipment needed.",
      },
      {
        slug: "reverse-hyperextension",
        note: "Trains the same hip extension with the torso fixed and the legs moving, and decompresses the lower back.",
      },
    ],
  },
  {
    slug: "single-leg-glute-bridge",
    name: "Single-Leg Glute Bridge",
    primaryMuscle: "glutes",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Lie on your back with one knee bent and foot planted, the other leg extended or tucked.\nDrive the hips up using only the planted leg, keeping the pelvis level.\nLower under control and repeat before switching.",
    bodyEffect:
      "Hip extension on one leg with the spine supported, so the working glute carries roughly the whole load while the pelvis must stay square.\n\nGluteus maximus extends the hip and gluteus medius on the same side works hard to stop the unsupported hip dropping — a demand entirely absent from the two-legged version. The hamstrings assist.\n\nDoubling the load and adding pelvic control makes it a genuine step up from a bridge with no equipment at all, and it exposes side-to-side differences immediately. The load still tops out at bodyweight, so it is a stability and endurance movement rather than a strength one.",
    alternatives: [
      {
        slug: "glute-bridge",
        note: "Both feet down halves the load and removes the pelvic-control demand — the sensible regression.",
      },
      {
        slug: "single-leg-hip-thrust",
        note: "Elevating the shoulders lengthens the range considerably and allows weight to be added.",
      },
      {
        slug: "hip-thrust-barbell",
        note: "Two legs with a loaded bar, which trains far more absolute strength but hides any asymmetry.",
      },
    ],
  },
  {
    slug: "single-leg-hip-thrust",
    name: "Single-Leg Hip Thrust",
    primaryMuscle: "glutes",
    secondaryMuscles: ["hamstrings"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Set the upper back on a bench with one foot planted and the other leg lifted.\nDrive the hips up until level, keeping the pelvis square.\nLower under control and repeat before switching sides.",
    bodyEffect:
      "Horizontal hip extension through a full range on one leg, so the working glute is loaded at end range while the pelvis must be held level against a strong rotational pull.\n\nGluteus maximus reaches peak tension fully shortened at the top, gluteus medius resists the unsupported side dropping, and the hamstrings assist. The abs work to keep the ribs down and stop the lower back arching.\n\nIt combines the hip thrust's end-range loading with a real stability demand and exposes asymmetries a barbell hides. Balancing on a bench limits how much extra load is practical, so it sits between a bridge and a loaded thrust.",
    alternatives: [
      {
        slug: "hip-thrust-barbell",
        note: "Two legs and a loaded bar allows several times the absolute load, but neither side works alone.",
      },
      {
        slug: "single-leg-glute-bridge",
        note: "From the floor rather than a bench, which shortens the range but makes balance a non-issue.",
      },
      {
        slug: "cable-kickback",
        note: "Isolates hip extension on one leg standing, with adjustable load and no balance on a bench.",
      },
    ],
  },
  {
    slug: "cable-kickback",
    name: "Cable Kickback",
    primaryMuscle: "glutes",
    equipment: "cable",
    instructions:
      "Attach an ankle strap to a low pulley and face the stack, holding on for balance.\nDrive the working leg straight back, squeezing the glute at the top.\nReturn under control without letting the back arch.",
    bodyEffect:
      "Isolated hip extension on one leg with the knee held straight, so the glute works alone against a cable with no knee or spinal involvement.\n\nGluteus maximus is the prime mover, with the hamstrings assisting; because the knee stays extended, the hamstrings are shortened at one end and contribute less than they would in a bridge. Constant cable tension holds through the whole arc.\n\nIt is the cleanest way to isolate one glute and to feel it work, which makes it useful both for correcting asymmetry and as a finisher. It cannot be loaded meaningfully, and arching the lower back to gain range replaces glute work with lumbar extension.",
    alternatives: [
      {
        slug: "single-leg-hip-thrust",
        note: "Trains the same single-leg hip extension with far more load and a genuine stability demand.",
      },
      {
        slug: "hip-thrust-barbell",
        note: "Loads glute end-range extension many times heavier, though both legs work together.",
      },
      {
        slug: "hip-abduction-machine",
        note: "Targets gluteus medius rather than maximus — the side of the hip that kickbacks barely touch.",
      },
    ],
  },
  {
    slug: "hip-abduction-machine",
    name: "Hip Abduction (Machine)",
    primaryMuscle: "glutes",
    equipment: "machine",
    instructions:
      "Sit with the pads on the outside of the thighs.\nPush the knees apart against the resistance.\nReturn slowly without letting the stack bang down.",
    bodyEffect:
      "Hip abduction — driving the thigh away from the midline — performed seated, isolating the muscles on the outside of the hip.\n\nGluteus medius and minimus do the work, with the upper fibres of gluteus maximus and tensor fasciae latae assisting. Leaning the torso forward biases the glute; sitting upright biases the tensor fasciae latae.\n\nThe abductors stabilise the pelvis on every single-leg step, and they are almost never trained to failure by compound work, which makes direct loading genuinely useful for both hip health and shape. It is entirely non-functional in position — seated abduction is nothing like standing on one leg.",
    alternatives: [
      {
        slug: "band-lateral-walk",
        note: "Trains the same abductors while standing and bearing weight, which is much closer to how they actually work.",
      },
      {
        slug: "cable-hip-abduction",
        note: "Standing and one leg at a time, combining the machine's isolation with a weight-bearing position.",
      },
      {
        slug: "side-plank",
        note: "Loads the abductors isometrically while also training the lateral trunk, with no equipment at all.",
      },
    ],
  },
  {
    slug: "cable-hip-abduction",
    name: "Cable Hip Abduction",
    primaryMuscle: "glutes",
    equipment: "cable",
    instructions:
      "Attach an ankle strap to a low pulley and stand side-on, working leg furthest from the stack.\nLift the leg out to the side without leaning.\nLower slowly against the cable.",
    bodyEffect:
      "Hip abduction performed standing on the opposite leg, so the working side lifts against the cable while the standing side stabilises the pelvis.\n\nGluteus medius and minimus of the moving leg abduct the hip, and — often more usefully — the same muscles on the standing leg work isometrically to keep the pelvis level. Both hips get trained in one movement.\n\nThe upright, weight-bearing position is much closer to how the abductors work in walking and running than a seated machine, which makes it the more transferable option. Loads are small and leaning the torso to gain range defeats the exercise.",
    alternatives: [
      {
        slug: "hip-abduction-machine",
        note: "Seated and supported, which allows far more load and lets the abductors be taken to failure safely.",
      },
      {
        slug: "band-lateral-walk",
        note: "Also standing, but continuous and both-legged, which trains endurance rather than loaded range.",
      },
      {
        slug: "single-leg-romanian-deadlift",
        note: "Loads the same pelvic-stabilising role inside a full hip-hinge movement rather than in isolation.",
      },
    ],
  },
  {
    slug: "band-lateral-walk",
    name: "Band Lateral Walk",
    primaryMuscle: "glutes",
    equipment: "band",
    trackingType: "reps",
    instructions:
      "Loop a band above the knees or around the ankles and take a half-squat stance.\nStep sideways against the band, keeping the feet pointed forward.\nWalk the same number of steps back the other way.",
    bodyEffect:
      "Repeated hip abduction while bearing weight in a half-squat, so both hips work continuously — one to abduct and step, the other to hold the pelvis level.\n\nGluteus medius and minimus on both sides work throughout, with tensor fasciae latae assisting and the quads holding the partial squat. Band tension rises as the feet separate, so the resistance peaks at the widest point of each step.\n\nIt trains the abductors in a standing, weight-bearing position and builds the endurance they need for walking and running, which is why it is standard in knee and hip rehabilitation. Band resistance is light and imprecise, so it is activation and endurance work rather than strength.",
    alternatives: [
      {
        slug: "hip-abduction-machine",
        note: "Seated with a real stack, which allows genuine progressive overload the band cannot provide.",
      },
      {
        slug: "cable-hip-abduction",
        note: "Standing and loaded with a measurable weight, combining the useful position with real progression.",
      },
      {
        slug: "side-plank",
        note: "Loads the same lateral hip musculature isometrically and adds a substantial trunk demand.",
      },
    ],
  },
  {
    slug: "frog-pump",
    name: "Frog Pump",
    primaryMuscle: "glutes",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Lie on your back with the soles of the feet together and the knees splayed out.\nDrive the hips up, squeezing the glutes hard at the top.\nLower under control and repeat for high reps.",
    bodyEffect:
      "Hip extension from a position of external rotation and abduction, with the soles together so the hips are turned out throughout the movement.\n\nThe externally rotated position emphasises the upper fibres of gluteus maximus and brings gluteus medius in, while reducing how much the hamstrings can contribute — they are shortened by the knee and hip position.\n\nThe result is a glute-dominant bridge that most people feel far more distinctly than a standard one, which makes it a useful high-rep finisher. The load is bodyweight and the range is short, so it never becomes a strength exercise.",
    alternatives: [
      {
        slug: "glute-bridge",
        note: "Feet parallel brings the hamstrings back in and allows external load to be added on the hips.",
      },
      {
        slug: "hip-thrust-barbell",
        note: "Loads the same end-range hip extension many times heavier through a longer range.",
      },
      {
        slug: "hip-abduction-machine",
        note: "Targets the abduction component this position hints at, in isolation and with real load.",
      },
    ],
  },
  /* ---- Calves ---- */
  {
    slug: "calf-raise-standing",
    name: "Calf Raise (Standing)",
    primaryMuscle: "calves",
    equipment: "machine",
    instructions:
      "Set the shoulders under the pads with the balls of the feet on the platform edge.\nRise as high onto the toes as you can, pausing at the top.\nLower until the heels drop below the platform and the calves stretch.",
    bodyEffect:
      "Ankle plantarflexion performed with the knee straight, so both muscles of the calf are in a position to contribute.\n\nGastrocnemius — which crosses the knee as well as the ankle — is only fully able to work when the knee is extended, and it takes the larger share here, with soleus underneath it assisting. The Achilles tendon is loaded throughout.\n\nThe straight-knee position is what makes this the gastrocnemius exercise, and the full stretch at the bottom matters more than the weight on the machine. Bouncing out of the bottom uses the tendon's elasticity instead of the muscle, which is the most common way to waste the set.",
    alternatives: [
      {
        slug: "calf-raise-seated",
        note: "Bending the knee takes gastrocnemius out and isolates soleus — a different muscle, not an easier version.",
      },
      {
        slug: "calf-press-leg-press",
        note: "Same straight-knee position on a leg press, which is easier to load heavily and takes the spine out of it.",
      },
      {
        slug: "single-leg-calf-raise",
        note: "One leg at a time doubles the load per calf and exposes the side-to-side difference most people have.",
      },
    ],
  },
  {
    slug: "calf-raise-seated",
    name: "Calf Raise (Seated)",
    primaryMuscle: "calves",
    equipment: "machine",
    instructions:
      "Sit with the pads across the thighs and the balls of the feet on the platform.\nRise onto the toes as high as possible and pause.\nLower until the heels drop and the calf stretches.",
    bodyEffect:
      "Ankle plantarflexion with the knee bent to about ninety degrees, which slackens gastrocnemius and takes it largely out of the movement.\n\nSoleus — the deeper, slower calf muscle that does not cross the knee — does nearly all of the work. It is the muscle responsible for standing endurance and for most of the calf's cross-sectional area at the lower end.\n\nBecause soleus can only be loaded properly with a bent knee, this is not a variation of the standing raise but a necessary complement to it. Soleus responds better to higher reps and pauses than to heavy low-rep work.",
    alternatives: [
      {
        slug: "calf-raise-standing",
        note: "A straight knee brings gastrocnemius in as the main mover — the other half of the calf, not the same one.",
      },
      {
        slug: "calf-press-leg-press",
        note: "Also straight-knee and gastrocnemius-biased, with much heavier loading available than a standing machine.",
      },
      {
        slug: "single-leg-calf-raise",
        note: "Straight-knee and unilateral, useful for finding the imbalance a seated machine will never reveal.",
      },
    ],
  },
  {
    slug: "calf-press-leg-press",
    name: "Calf Press (Leg Press)",
    primaryMuscle: "calves",
    equipment: "machine",
    instructions:
      "Sit in a leg press with the balls of the feet on the bottom edge of the platform, legs nearly straight.\nPush the platform away by extending the ankles.\nLet it return until the calves stretch fully. Keep the safeties engaged.",
    bodyEffect:
      "Ankle plantarflexion against the leg-press sled with the knees close to straight, so gastrocnemius is in a position to work while the spine carries nothing.\n\nGastrocnemius takes the larger share with soleus assisting, exactly as in a standing raise. The difference is that the load sits on the sled rather than on your shoulders, so very heavy weights carry no spinal cost.\n\nThat makes it the most practical way to load the calves heavily, and the long platform allows a deep stretch at the bottom. Letting the knees bend turns it quietly into a soleus exercise, and a sled held only by your ankles demands the safeties be set.",
    alternatives: [
      {
        slug: "calf-raise-standing",
        note: "The same straight-knee action standing, which is a more natural position but loads the spine.",
      },
      {
        slug: "calf-raise-seated",
        note: "A bent knee shifts the work entirely to soleus, which this movement barely reaches.",
      },
      {
        slug: "single-leg-calf-raise",
        note: "Needs no machine and doubles the load per calf, though it caps out at bodyweight plus a dumbbell.",
      },
    ],
  },
  {
    slug: "single-leg-calf-raise",
    name: "Single-Leg Calf Raise",
    primaryMuscle: "calves",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Stand on one foot with the ball of the foot on a step, holding a support.\nRise as high as possible onto the toes, pause, then lower until the heel drops below the step.\nComplete the set before switching legs.",
    bodyEffect:
      "Ankle plantarflexion on one leg with the knee straight, so the whole bodyweight passes through a single calf and Achilles tendon.\n\nGastrocnemius does the majority with soleus assisting, and the step allows a full stretch below neutral at the bottom. Loading one side at a time also makes the ankle and foot stabilise the whole body.\n\nSingle-leg calf strength is what walking and running actually demand, and it exposes the side-to-side differences almost everyone has and no machine reveals. Adding load means holding a dumbbell, which the grip limits well before the calf does.",
    alternatives: [
      {
        slug: "calf-press-leg-press",
        note: "Allows far heavier loading with no grip limit, though both calves work together and imbalances stay hidden.",
      },
      {
        slug: "calf-raise-standing",
        note: "Machine-loaded and two-legged, easier to progress but with the same problem of masking asymmetry.",
      },
      {
        slug: "calf-raise-seated",
        note: "Targets soleus instead by bending the knee — the complement to any straight-knee raise.",
      },
    ],
  },
  {
    slug: "tibialis-raise",
    name: "Tibialis Raise",
    primaryMuscle: "calves",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Stand with the back against a wall and the feet a foot or two in front.\nLift the toes and forefoot toward the shins as high as possible.\nLower slowly under control.",
    bodyEffect:
      "Ankle dorsiflexion — pulling the foot up toward the shin — which is the exact opposite of every calf raise and loads the front of the lower leg.\n\nTibialis anterior does the work, along with the toe extensors. This is the muscle that decelerates the foot on every heel strike when walking or running, and it is essentially never trained by anything else in a gym.\n\nStrengthening it is well regarded for shin splints and for ankle control, and it balances a lower leg that heavy calf work otherwise develops entirely on one side. It is a small muscle with a short range, so it is durability work rather than a mass builder.",
    alternatives: [
      {
        slug: "band-dorsiflexion",
        note: "Seated with a band, which allows the load and the range to be controlled more precisely than a wall version.",
      },
      {
        slug: "calf-raise-standing",
        note: "Trains the opposing muscles on the back of the lower leg — a pair, not a substitute.",
      },
      {
        slug: "single-leg-calf-raise",
        note: "Loads the other side of the same joint one leg at a time, which pairs well with dorsiflexion work.",
      },
    ],
  },
  {
    slug: "band-dorsiflexion",
    name: "Band Dorsiflexion",
    primaryMuscle: "calves",
    equipment: "band",
    trackingType: "reps",
    instructions:
      "Sit with the legs extended and a band anchored in front, looped over the forefoot.\nPull the toes back toward the shin against the band.\nRelease slowly under control.",
    bodyEffect:
      "Ankle dorsiflexion against elastic resistance with the leg supported, so the range and the load can be controlled precisely.\n\nTibialis anterior and the toe extensors do the work through a full range, and because the leg is straight and supported nothing else can compensate. Band tension rises as the foot pulls back, matching the strengthening contraction.\n\nIt is the most controllable way to load the front of the lower leg and to work around shin pain, and one leg can be trained at a time. Band resistance is coarse and light, so progression is limited to changing band.",
    alternatives: [
      {
        slug: "tibialis-raise",
        note: "Uses bodyweight against a wall, which loads harder at the top but is less precise about range.",
      },
      {
        slug: "calf-raise-seated",
        note: "Trains the opposing muscle on the back of the lower leg from the same seated position.",
      },
      {
        slug: "single-leg-calf-raise",
        note: "The plantarflexion counterpart under full bodyweight, which pairs naturally with dorsiflexion work.",
      },
    ],
  },
];

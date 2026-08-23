import type { SeedExercise } from "../types";

export const CORE: SeedExercise[] = [
  /* ---- Anti-extension ---- */
  {
    slug: "plank",
    name: "Plank",
    primaryMuscle: "abs",
    secondaryMuscles: ["obliques"],
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Rest on the forearms and toes with the body in one straight line.\nTuck the ribs down and squeeze the glutes.\nBreathe normally and hold; stop when the hips start to sag.",
    bodyEffect:
      "An isometric hold in which gravity constantly tries to drop the hips and extend the lower back, and the entire exercise is refusing to let it happen.\n\nRectus abdominis and the deep transversus abdominis resist the spine extending, the obliques hold the ribcage and pelvis aligned, and the glutes work to keep the pelvis tucked. Nothing lengthens or shortens — the muscles are trained to hold a position under load.\n\nResisting extension is what the trunk actually does under a barbell, which makes this more specific to lifting than any crunch. Once you can hold it for a minute with good position, adding time stops being useful — added load or a harder variation is the progression.",
    alternatives: [
      {
        slug: "ab-wheel-rollout",
        note: "The same anti-extension demand made dynamic and far heavier, since the lever lengthens as you roll out.",
      },
      {
        slug: "long-lever-plank",
        note: "Walking the elbows forward lengthens the lever, which increases the load substantially without adding time.",
      },
      {
        slug: "dead-bug",
        note: "Trains the same anti-extension control lying on the back, which is far easier on the shoulders and wrists.",
      },
    ],
  },
  {
    slug: "long-lever-plank",
    name: "Long Lever Plank",
    primaryMuscle: "abs",
    secondaryMuscles: ["obliques"],
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Set up in a forearm plank, then walk the elbows further forward past the shoulders.\nHold the body in a straight line with the ribs tucked.\nStop the moment the lower back starts to sag.",
    bodyEffect:
      "A plank with the support point moved further from the centre of mass, which lengthens the lever and multiplies the torque trying to extend the spine.\n\nRectus abdominis and transversus abdominis work far harder than in a standard plank to keep the pelvis tucked, and the lats and shoulders take considerably more load holding the extended position. The glutes work throughout.\n\nIt is the correct progression from a plank you can already hold for a minute — more load rather than more time, which is what actually drives adaptation. The margin before the hips sag is small, so it demands honesty about when to stop.",
    alternatives: [
      {
        slug: "plank",
        note: "Elbows under the shoulders shortens the lever dramatically, which is the right place to start and to return to.",
      },
      {
        slug: "ab-wheel-rollout",
        note: "Takes the lengthening lever through a full dynamic range instead of holding one fixed position.",
      },
      {
        slug: "body-saw",
        note: "Moves between short and long lever positions on sliders, adding the eccentric this static hold lacks.",
      },
    ],
  },
  {
    slug: "body-saw",
    name: "Body Saw",
    primaryMuscle: "abs",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Set up in a forearm plank with the feet on sliders or a towel.\nPush back through the elbows so the body slides away, lengthening the lever.\nPull back to the start without letting the hips drop.",
    bodyEffect:
      "A plank turned into a moving exercise: sliding the body back lengthens the lever progressively, so the anti-extension demand rises and falls through each rep.\n\nRectus abdominis and transversus abdominis resist the spine extending throughout, working hardest at the fully extended position. The lats and serratus work to drive the movement, and the glutes hold the pelvis tucked.\n\nThe moving lever means the abs work eccentrically as the body slides out, which a static plank never provides, and it is far easier to judge progress than by adding seconds. It needs sliders or a smooth floor, and the shoulders take real load at the far position.",
    alternatives: [
      {
        slug: "ab-wheel-rollout",
        note: "The same lengthening-lever principle through a longer range and from a harder starting position.",
      },
      {
        slug: "long-lever-plank",
        note: "Holds the extended position statically rather than moving through it, with no equipment required.",
      },
      {
        slug: "plank",
        note: "The static, short-lever baseline — the right regression when the hips start dropping.",
      },
    ],
  },
  {
    slug: "ab-wheel-rollout",
    name: "Ab Wheel Rollout",
    primaryMuscle: "abs",
    secondaryMuscles: ["lats"],
    equipment: "other",
    trackingType: "reps",
    instructions:
      "Kneel holding the wheel under the shoulders, ribs tucked.\nRoll forward as far as you can without the lower back arching.\nPull back using the abs, not the hips.",
    bodyEffect:
      "A dynamic anti-extension movement in which the lever between the hands and the hips lengthens continuously as you roll out, so the load rises through the range.\n\nRectus abdominis and transversus abdominis resist the spine extending under a rapidly increasing torque, while the lats work to pull the wheel back and the hip flexors are stretched. At full extension the demand is close to maximal for most people.\n\nIt is probably the most effective trunk exercise there is, because the resistance scales smoothly with how far you go rather than with added time or reps. Rolling out further than you can control is exactly how people hurt their lower back with it.",
    alternatives: [
      {
        slug: "plank",
        note: "A static hold at a fixed, much shorter lever — the correct regression when the back cannot stay flat.",
      },
      {
        slug: "body-saw",
        note: "A similar moving-lever demand on sliders, with a shorter range and a gentler peak load.",
      },
      {
        slug: "hanging-leg-raise",
        note: "Trains the abs by moving the pelvis rather than resisting extension — a complementary function.",
      },
    ],
  },
  {
    slug: "dead-bug",
    name: "Dead Bug",
    primaryMuscle: "abs",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Lie on your back with the arms up and the knees over the hips.\nPress the lower back into the floor and slowly extend one arm and the opposite leg.\nReturn and alternate, never letting the back lift.",
    bodyEffect:
      "An anti-extension exercise performed lying down, where extending an arm and the opposite leg lengthens the lever and tries to pull the lower back off the floor.\n\nTransversus abdominis and rectus abdominis work to keep the ribcage down and the pelvis tucked while the limbs move, and the obliques resist the diagonal pull. The spine stays still while everything else moves — which is the point.\n\nThe supine position means no load on the shoulders, wrists or neck, which makes it the most accessible trunk exercise and a staple of lower-back rehabilitation. It is easy and stays easy; it teaches control rather than building strength.",
    alternatives: [
      {
        slug: "plank",
        note: "The same anti-extension demand held in a loaded position, which is considerably harder but taxes the shoulders.",
      },
      {
        slug: "ab-wheel-rollout",
        note: "Takes the identical principle to its maximal expression, with the load rising as the lever lengthens.",
      },
      {
        slug: "hollow-body-hold",
        note: "Holds the same tucked-rib position statically with the limbs extended, which is far more demanding.",
      },
    ],
  },
  {
    slug: "hollow-body-hold",
    name: "Hollow Body Hold",
    primaryMuscle: "abs",
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Lie on your back and press the lower back flat into the floor.\nLift the shoulders and legs, arms overhead, holding a shallow banana shape.\nHold; lower the legs if the back lifts.",
    bodyEffect:
      "A static hold in which the whole body is suspended off the floor around a fixed, flattened lumbar spine, with the limbs acting as long levers pulling in both directions.\n\nRectus abdominis and transversus abdominis contract hard to hold the pelvis tucked and the ribs down, while the hip flexors hold the legs up and the shoulders hold the arms overhead. Nothing moves; everything is loaded.\n\nIt is the foundational position for gymnastics and calisthenics, because holding a rigid body is what every swing and lever depends on. It is very hard to do honestly — the lower back lifting is the universal failure, and it happens well before it feels like it has.",
    alternatives: [
      {
        slug: "dead-bug",
        note: "Moves one limb at a time instead of holding all four, which makes the same position far more achievable.",
      },
      {
        slug: "plank",
        note: "Trains the same anti-extension role face-down, which most people find easier to hold with good position.",
      },
      {
        slug: "hanging-leg-raise",
        note: "Adds a hanging position and a full pelvic tilt through range, rather than holding one fixed shape.",
      },
    ],
  },
  /* ---- Flexion and pelvic tilt ---- */
  {
    slug: "hanging-leg-raise",
    name: "Hanging Leg Raise",
    primaryMuscle: "abs",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hang from a bar with the shoulders active.\nRaise the legs, finishing by curling the pelvis up toward the ribs.\nLower slowly without swinging.",
    bodyEffect:
      "Hip flexion followed by posterior pelvic tilt — the legs come up first, then the pelvis curls, and only that second part is genuinely abdominal work.\n\nThe hip flexors, particularly iliopsoas and rectus femoris, raise the legs to horizontal, after which rectus abdominis curls the pelvis toward the ribs. The lats and grip hold the hang, and the obliques stop the body twisting.\n\nDone with a real pelvic curl it loads the abs through a full range under bodyweight, which few exercises manage. Stopping at horizontal makes it almost entirely a hip-flexor exercise, and swinging removes the load altogether.",
    alternatives: [
      {
        slug: "captains-chair-leg-raise",
        note: "Supporting the back and elbows removes the grip and swing, so the abs can be worked without the hang limiting the set.",
      },
      {
        slug: "reverse-crunch",
        note: "Isolates the pelvic-curl portion lying down, removing the hip-flexor-dominant first half entirely.",
      },
      {
        slug: "toes-to-bar",
        note: "Extends the same movement to full range with a dynamic element, which is much harder and much less strict.",
      },
      {
        slug: "hanging-leg-raise-weighted",
        note: "A dumbbell between the feet loads the far end of a long lever, which is how this stays hard past fifteen clean reps.",
      },
    ],
  },
  {
    slug: "hanging-leg-raise-weighted",
    name: "Weighted Hanging Leg Raise",
    primaryMuscle: "abs",
    equipment: "bodyweight",
    trackingType: "weight_reps",
    instructions:
      "Hold a dumbbell between the feet, or wear ankle weights.\nHang from a bar and tilt the pelvis back before anything moves.\nRaise the legs to at least hip height and lower them slowly, without swinging.",
    bodyEffect:
      "Hip flexion combined with a posterior pelvic tilt, loaded at the far end of a very long lever — the weight sits at the feet, so a small dumbbell produces a large moment at the trunk.\n\nRectus abdominis produces the tilt and resists the extension the load is trying to force, while the hip flexors raise the thighs and the lats and forearms hold the hang. It is the tilt that makes it abdominal work; swinging the legs up without it is a hip flexor exercise.\n\nAdding weight is how this stays a strength movement once fifteen clean reps are available, and the abdominals respond to load the same way any other muscle does. The grip usually fails first, which is the practical ceiling on the exercise rather than anything to do with the trunk.",
    alternatives: [
      {
        slug: "hanging-leg-raise",
        note: "The same movement at bodyweight, where the pelvic tilt and a swing-free descent should be reliable before weight is added.",
      },
      {
        slug: "cable-crunch",
        note: "Loads spinal flexion directly against a stack, which adjusts by the kilogram and does not depend on the grip holding out.",
      },
      {
        slug: "toes-to-bar",
        note: "Extends the range to the bar instead of adding load, which trains the same tilt through a far longer arc.",
      },
    ],
  },
  {
    slug: "toes-to-bar",
    name: "Toes to Bar",
    primaryMuscle: "abs",
    secondaryMuscles: ["lats"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hang from a bar and swing into a slight arch, then close the hips hard.\nBring the toes up to touch the bar between the hands.\nLower under control into the next rep.",
    bodyEffect:
      "A full-range hanging hip flexion and pelvic curl taken all the way until the feet reach the bar, usually with a rhythmic swing linking reps.\n\nThe hip flexors drive the legs up, rectus abdominis curls the pelvis through the top portion, and the lats work hard to pull the body into position. The grip is loaded throughout and the shoulders take real load in the arched position.\n\nIt trains the abs through their fullest range and adds a coordination and conditioning element, which is why it is a staple in competitive fitness. The swing means the abs do less per rep than a strict raise, and the shoulder position under a kip is demanding.",
    alternatives: [
      {
        slug: "hanging-leg-raise",
        note: "Strict and without the swing, so the abs do more of the work per rep even though the range is shorter.",
      },
      {
        slug: "captains-chair-leg-raise",
        note: "Supported at the back and elbows, which removes the grip and the swing entirely.",
      },
      {
        slug: "ab-wheel-rollout",
        note: "Loads the trunk by resisting extension rather than by flexing it, which is the more lifting-specific demand.",
      },
    ],
  },
  {
    slug: "captains-chair-leg-raise",
    name: "Captain's Chair Leg Raise",
    primaryMuscle: "abs",
    equipment: "machine",
    trackingType: "reps",
    instructions:
      "Support yourself on the forearms with the back against the pad.\nRaise the knees or straight legs, finishing by curling the pelvis up.\nLower slowly without swinging.",
    bodyEffect:
      "Hip flexion and pelvic curl performed with the back and elbows supported, so neither grip nor swing can limit or contaminate the movement.\n\nThe hip flexors raise the legs and rectus abdominis curls the pelvis at the top, exactly as in a hanging raise. Removing the hang means the lats and grip contribute nothing and the set ends when the abs do.\n\nThat support makes it the most accessible version of the movement and the easiest to keep strict, which matters because the pelvic curl is the part that actually trains the abs. Pushing back into the pad to cheat is easy and quietly removes the load.",
    alternatives: [
      {
        slug: "hanging-leg-raise",
        note: "Hanging adds grip, lat and anti-swing demands, making it a harder and more complete movement.",
      },
      {
        slug: "reverse-crunch",
        note: "Lying down isolates the pelvic curl further and removes even the hip-flexor-dominant first half.",
      },
      {
        slug: "cable-crunch",
        note: "Loads spinal flexion progressively with a stack, rather than being fixed at bodyweight.",
      },
    ],
  },
  {
    slug: "reverse-crunch",
    name: "Reverse Crunch",
    primaryMuscle: "abs",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Lie on your back with the knees bent over the hips.\nCurl the pelvis up off the floor, bringing the knees toward the chest.\nLower slowly without letting the feet swing.",
    bodyEffect:
      "Posterior pelvic tilt performed lying down: the pelvis curls toward the ribs while the shoulders stay still, which is the pure abdominal action without the hip-flexor half.\n\nThe lower fibres of rectus abdominis do the work, with the obliques assisting. Because the legs stay bent and close to the body, the hip flexors have very little leverage to contribute.\n\nThat isolation is exactly what makes it useful — most leg raises are largely hip-flexor exercises, and this removes that. The range is short and the load is bodyweight, so it is precision work rather than a heavy stimulus.",
    alternatives: [
      {
        slug: "hanging-leg-raise",
        note: "A far longer range under bodyweight, though the first half of every rep is hip-flexor dominant.",
      },
      {
        slug: "cable-crunch",
        note: "Curls the ribs toward the pelvis instead, with a stack that allows genuine progressive loading.",
      },
      {
        slug: "dead-bug",
        note: "Holds the same pelvic position while the limbs move, training control rather than producing the movement.",
      },
    ],
  },
  {
    slug: "crunch",
    name: "Crunch",
    primaryMuscle: "abs",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Lie on your back with the knees bent and feet flat.\nCurl the ribs toward the pelvis, lifting the shoulder blades off the floor.\nLower slowly. Do not pull on the neck.",
    bodyEffect:
      "Spinal flexion through a short range: the ribcage curls toward the pelvis while the lower back stays on the floor and the hips do not move.\n\nRectus abdominis does the work, with the obliques assisting. Because the hips stay still, the hip flexors are largely excluded — which is the difference between a crunch and a sit-up.\n\nIt loads the abs directly with no equipment and almost no risk, which is why it persists. The range is short and the load fixed at the weight of your own torso, so it plateaus fast and does little for the trunk's actual job of resisting movement.",
    alternatives: [
      {
        slug: "cable-crunch",
        note: "The same spinal flexion against a stack, so it can be loaded progressively instead of plateauing at bodyweight.",
      },
      {
        slug: "sit-up",
        note: "Adds hip flexion and a much longer range, bringing the hip flexors in as major contributors.",
      },
      {
        slug: "plank",
        note: "Trains the trunk's anti-extension role instead of flexing the spine, which transfers far better to lifting.",
      },
    ],
  },
  {
    slug: "sit-up",
    name: "Sit Up",
    primaryMuscle: "abs",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Lie on your back with the knees bent and feet planted or anchored.\nCurl up until the torso is upright, leading with the chest not the neck.\nLower under control.",
    bodyEffect:
      "Spinal flexion followed by hip flexion — the torso curls first, then the hip flexors pull it the rest of the way upright.\n\nRectus abdominis produces the initial curl, after which iliopsoas and rectus femoris do most of the work bringing the torso to vertical. Anchoring the feet increases the hip-flexor contribution further.\n\nThe long range and the ease of doing it anywhere are the appeal. The hip-flexor dominance means the abs get less than the movement suggests, and the repeated full flexion of the lumbar spine under load is not something an irritable back tolerates well.",
    alternatives: [
      {
        slug: "crunch",
        note: "Stopping short of sitting up keeps the movement in the abs and largely removes the hip flexors.",
      },
      {
        slug: "cable-crunch",
        note: "Loads spinal flexion progressively with a stack while keeping the hips out of it entirely.",
      },
      {
        slug: "ab-wheel-rollout",
        note: "Trains the trunk to resist extension rather than repeatedly flexing the spine — much kinder to the lower back.",
      },
    ],
  },
  {
    slug: "cable-crunch",
    name: "Cable Crunch",
    primaryMuscle: "abs",
    equipment: "cable",
    instructions:
      "Kneel facing a high pulley with a rope held beside the head.\nCurl the ribs toward the pelvis, rounding the upper back.\nReturn slowly without letting the hips take over.",
    bodyEffect:
      "Spinal flexion against a cable, which is the only common way to load the abs progressively rather than being fixed at bodyweight.\n\nRectus abdominis curls the ribcage toward the pelvis with the obliques assisting. Constant cable tension keeps the load on through the whole range, including the fully contracted position.\n\nBecause the abs are muscle like any other and respond to progressive load, having a stack to add to makes this the most straightforward way to actually build them. Hinging at the hips instead of curling the spine is the standard error and turns it into a very poor pulldown.",
    alternatives: [
      {
        slug: "crunch",
        note: "The same flexion at bodyweight with no equipment, but it plateaus as soon as it becomes easy.",
      },
      {
        slug: "machine-crunch",
        note: "Seated and supported with a stack, which makes it much harder to substitute a hip hinge for spinal flexion.",
      },
      {
        slug: "hanging-leg-raise",
        note: "Curls the pelvis toward the ribs instead of the ribs toward the pelvis — the other half of the same job.",
      },
    ],
  },
  {
    slug: "machine-crunch",
    name: "Crunch (Machine)",
    primaryMuscle: "abs",
    equipment: "machine",
    instructions:
      "Set the seat so the pivot lines up with the middle of your torso.\nCurl the ribs toward the hips against the pad.\nReturn under control without letting the stack rest.",
    bodyEffect:
      "Spinal flexion along a fixed arc with the body supported, so the hips are locked and only the trunk can produce the movement.\n\nRectus abdominis does the work with the obliques assisting; because the seat and pads hold the pelvis, the hip flexors cannot contribute and the hinge-instead-of-curl error is prevented mechanically.\n\nThat makes it the easiest way to load abdominal flexion honestly and to progress it in small increments, which suits a muscle that responds to load like any other. The pivot must line up with your torso, and it trains none of the anti-movement function the trunk actually performs.",
    alternatives: [
      {
        slug: "cable-crunch",
        note: "Similar progressive loading with a free path, which fits any body but allows the hips to cheat the movement.",
      },
      {
        slug: "crunch",
        note: "No equipment at all, at the cost of any way to add load once it becomes easy.",
      },
      {
        slug: "ab-wheel-rollout",
        note: "Trains the trunk's anti-extension role instead, which transfers far more directly to lifting.",
      },
    ],
  },
  {
    slug: "decline-sit-up",
    name: "Decline Sit Up",
    primaryMuscle: "abs",
    secondaryMuscles: ["obliques"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hook the legs into a decline bench with the head lower than the hips.\nCurl up until the torso is upright, leading with the ribs.\nLower slowly all the way back.",
    bodyEffect:
      "A sit-up performed on a decline, which lengthens the range and means the abs have to work against gravity from a position below horizontal.\n\nRectus abdominis produces the initial curl through a longer range than a flat sit-up allows, after which the hip flexors take over to bring the torso up. The steeper the decline, the more work in the bottom portion.\n\nThe extended range and the option of holding a plate make it a genuinely loadable version of the sit-up. It shares the sit-up's hip-flexor dominance and adds more repeated lumbar flexion, which suits some backs poorly.",
    alternatives: [
      {
        slug: "sit-up",
        note: "Flat on the floor shortens the range and reduces the load, which is easier on the lower back.",
      },
      {
        slug: "cable-crunch",
        note: "Loads spinal flexion progressively while keeping the hips out of it and the lumbar range short.",
      },
      {
        slug: "hanging-leg-raise",
        note: "Curls the pelvis instead of the torso, avoiding repeated loaded flexion of the lower back.",
      },
      {
        slug: "decline-sit-up-weighted",
        note: "Holding a plate at the chest puts this back into the rep ranges everything else in a session is trained in.",
      },
    ],
  },
  {
    slug: "decline-sit-up-weighted",
    name: "Weighted Decline Sit Up",
    primaryMuscle: "abs",
    secondaryMuscles: ["obliques"],
    equipment: "bodyweight",
    trackingType: "weight_reps",
    instructions:
      "Hold a plate against the chest, or behind the head for a longer lever.\nHook the feet on a decline bench and start with the torso low.\nCurl up spine by spine rather than hinging at the hip in one piece, then lower slowly.",
    bodyEffect:
      "Spinal flexion followed by hip flexion on a decline, with load held at the shoulders so the resistance grows through the bottom half of the range where the trunk is most horizontal.\n\nRectus abdominis flexes the spine and the obliques stabilise against any rotation, then the hip flexors finish the movement by drawing the torso up toward the knees. The decline is what keeps tension on at the bottom, where a flat-floor sit-up has almost none.\n\nHolding a plate turns a high-rep exercise into one that can be progressed in the same rep ranges as anything else. Yanking on the head with the plate behind it is the common fault and the reason to start with it on the chest.",
    alternatives: [
      {
        slug: "decline-sit-up",
        note: "The same movement at bodyweight, which is where the curl-up sequence should be clean before a plate is involved.",
      },
      {
        slug: "cable-crunch",
        note: "Loads spinal flexion alone against a stack, with the hip flexors largely out of it and the weight adjustable a plate at a time.",
      },
      {
        slug: "hanging-leg-raise-weighted",
        note: "Works the same trunk from the other end — the pelvis moves toward the ribs rather than the ribs toward the pelvis.",
      },
    ],
  },
  /* ---- Rotation and anti-rotation ---- */
  {
    slug: "pallof-press",
    name: "Pallof Press",
    primaryMuscle: "obliques",
    secondaryMuscles: ["abs"],
    equipment: "cable",
    instructions:
      "Stand side-on to a chest-height pulley, hands at the sternum.\nPress the handle straight out in front without letting the torso rotate.\nReturn to the chest under control.",
    bodyEffect:
      "An anti-rotation exercise: the cable pulls the hands sideways, and pressing them away lengthens the lever, so the torque trying to twist you rises as the arms extend.\n\nThe obliques, transversus abdominis and the deep spinal stabilisers work isometrically to keep the ribcage and pelvis aligned, while the glutes hold the hips square. Nothing rotates — the whole point is that it does not.\n\nResisting rotation is one of the trunk's primary jobs and almost nothing else trains it directly, which makes this a genuinely useful complement to flexion work. It is a control exercise: too much weight simply turns it into a slow, twisting cable press.",
    alternatives: [
      {
        slug: "half-kneeling-pallof-press",
        note: "Kneeling narrows the base considerably, so the trunk and hip work much harder at the same load.",
      },
      {
        slug: "woodchopper-cable",
        note: "Produces rotation rather than resisting it, training the obliques through a range instead of isometrically.",
      },
      {
        slug: "side-plank",
        note: "Loads the same lateral trunk musculature against side-bending rather than twisting.",
      },
    ],
  },
  {
    slug: "half-kneeling-pallof-press",
    name: "Half-Kneeling Pallof Press",
    primaryMuscle: "obliques",
    secondaryMuscles: ["abs", "glutes"],
    equipment: "cable",
    instructions:
      "Half-kneel side-on to a chest-height pulley, inside knee down.\nPress the handle out in front, keeping the hips and shoulders square.\nReturn under control without twisting.",
    bodyEffect:
      "Anti-rotation from a half-kneeling base, which removes the wide stance that makes a standing Pallof press manageable.\n\nThe obliques and deep abdominals resist the twist as before, but the glute of the down leg now works hard to hold the pelvis square and stop the whole body pivoting. The narrower base means the same cable load produces far more destabilising torque.\n\nIt links trunk and hip control in a position closer to how the body actually stabilises during single-leg tasks, and it exposes any tendency to compensate at the hip. The loads have to be small, which makes it a control exercise rather than a strength one.",
    alternatives: [
      {
        slug: "pallof-press",
        note: "A standing base is far more stable, so the same load is much easier and the hips work less.",
      },
      {
        slug: "half-kneeling-cable-row",
        note: "Adds a rowing movement to the same anti-rotation base, training back and trunk together.",
      },
      {
        slug: "side-plank",
        note: "Trains lateral trunk stability statically on the floor, with no cable or kneeling balance required.",
      },
    ],
  },
  {
    slug: "woodchopper-cable",
    name: "Woodchopper (Cable)",
    primaryMuscle: "obliques",
    secondaryMuscles: ["abs"],
    equipment: "cable",
    instructions:
      "Set a pulley high and stand side-on with both hands on the handle.\nPull down and across the body toward the opposite hip, pivoting the back foot.\nReturn under control along the same path.",
    bodyEffect:
      "A diagonal rotation and flexion of the trunk under load, taking the torso from an extended, rotated position down and across to a flexed, counter-rotated one.\n\nThe obliques on both sides work — one concentrically to rotate, the other eccentrically to control — with rectus abdominis flexing and the hips and legs providing the base and part of the rotation. The pattern crosses the body diagonally, which is how the abdominal fibres are actually oriented.\n\nIt trains the trunk to produce rotation rather than just resist it, which matters for throwing, striking and changing direction. Rotating under load is also the position where lumbar discs are least tolerant, so speed and weight both want limits.",
    alternatives: [
      {
        slug: "low-to-high-woodchopper",
        note: "Reverses the direction so the trunk rotates upward, loading the obliques in the opposite pattern.",
      },
      {
        slug: "pallof-press",
        note: "Resists rotation instead of producing it, which is far safer for the spine and more specific to lifting.",
      },
      {
        slug: "russian-twist",
        note: "A seated rotation with a much shorter range and no hip involvement, easier to load but less complete.",
      },
    ],
  },
  {
    slug: "low-to-high-woodchopper",
    name: "Low-to-High Woodchopper",
    primaryMuscle: "obliques",
    secondaryMuscles: ["abs", "shoulders"],
    equipment: "cable",
    instructions:
      "Set a pulley low and stand side-on with both hands on the handle at the outside hip.\nSweep up and across the body to above the opposite shoulder, pivoting the back foot.\nReturn under control.",
    bodyEffect:
      "A diagonal trunk rotation and extension, moving from a flexed and rotated position at the hip to an extended, counter-rotated one overhead.\n\nThe obliques rotate the trunk, the erectors extend it, and the shoulders and hips drive the ends of the movement. It is the mirror of a high-to-low chop and trains the opposite diagonal pattern.\n\nTogether the two directions cover the trunk's rotational range in both planes, which matters for any sport that throws or swings. Loaded rotation into extension is a demanding position for the lumbar spine, so control should come well before load.",
    alternatives: [
      {
        slug: "woodchopper-cable",
        note: "The downward direction, which is generally the safer of the two and pairs with rather than replaces this.",
      },
      {
        slug: "pallof-press",
        note: "Resists rotation rather than producing it, which is far gentler on the spine.",
      },
      {
        slug: "landmine-rotation",
        note: "A similar rotational arc with the bar's path partly guided, which makes the load easier to control.",
      },
    ],
  },
  {
    slug: "landmine-rotation",
    name: "Landmine Rotation",
    primaryMuscle: "obliques",
    secondaryMuscles: ["abs", "shoulders"],
    equipment: "barbell",
    trackingType: "weight_reps",
    instructions:
      "Hold the end of a landmine bar at chest height with both hands, arms extended.\nSweep it in an arc from hip to hip, pivoting the feet as you go.\nControl the return; do not let it drop.",
    bodyEffect:
      "A loaded trunk rotation along the arc the landmine dictates, with the arms extended so the weight sits far from the body's axis.\n\nThe obliques on both sides work — one rotating, the other decelerating — while the abs and erectors keep the spine stacked and the hips and feet pivot to let the rotation come from the whole body rather than the lumbar spine alone.\n\nThe anchored bar means the path is partly guided, which makes heavy rotational loading more controllable than with a free weight. Rotating fast under load is where the lumbar spine is least tolerant, so the pivot at the feet is not optional.",
    alternatives: [
      {
        slug: "woodchopper-cable",
        note: "A cable allows a diagonal path and constant tension, where the landmine's arc is horizontal and partly guided.",
      },
      {
        slug: "pallof-press",
        note: "Resists rotation instead of producing it — the safer and more lifting-specific side of the same quality.",
      },
      {
        slug: "russian-twist",
        note: "A seated rotation with a much shorter lever and no hip pivot, easier to control but far less complete.",
      },
    ],
  },
  {
    slug: "russian-twist",
    name: "Russian Twist",
    primaryMuscle: "obliques",
    secondaryMuscles: ["abs"],
    equipment: "plate",
    trackingType: "weight_reps",
    instructions:
      "Sit with the knees bent and the torso leaned back, feet down or lifted.\nRotate the weight from one side to the other, turning the ribcage rather than just the arms.\nKeep the chest up and the spine long.",
    bodyEffect:
      "Seated trunk rotation held in a partially reclined position, so the abs work isometrically to hold the lean while the obliques rotate.\n\nThe obliques produce and control the rotation, rectus abdominis holds the torso off the floor throughout, and the hip flexors work if the feet are lifted. The range comes almost entirely from the trunk, since the hips cannot pivot.\n\nIt is simple, needs almost nothing, and combines an isometric hold with rotation. Because the hips are fixed, all the rotation happens in the lumbar spine — which is the segment least designed for it, so light weight and honest range matter.",
    alternatives: [
      {
        slug: "pallof-press",
        note: "Resists rotation rather than forcing it through the lumbar spine, which is considerably safer.",
      },
      {
        slug: "woodchopper-cable",
        note: "Standing, so the hips and thoracic spine share the rotation instead of the lower back absorbing all of it.",
      },
      {
        slug: "side-plank",
        note: "Loads the obliques isometrically with no spinal rotation at all.",
      },
    ],
  },
  /* ---- Lateral trunk ---- */
  {
    slug: "side-plank",
    name: "Side Plank",
    primaryMuscle: "obliques",
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Lie on your side propped on one forearm, feet stacked.\nLift the hips so the body is a straight line from head to feet.\nHold, then repeat on the other side.",
    bodyEffect:
      "An isometric hold in which gravity tries to drop the hips sideways, and the whole exercise is preventing that side-bend.\n\nThe obliques and quadratus lumborum on the down side work maximally to hold the spine straight, while gluteus medius on the same side stops the pelvis dropping and the shoulder stabilisers hold the supporting arm.\n\nResisting lateral flexion is the trunk function that carrying, walking and single-leg work all depend on, and almost nothing else trains it directly. It is isometric and bodyweight-limited, so it builds position and endurance rather than size.",
    alternatives: [
      {
        slug: "suitcase-carry",
        note: "Trains the same anti-side-bend function while walking under a heavy load, which loads it far more.",
      },
      {
        slug: "copenhagen-plank",
        note: "Adds a large adductor demand by supporting the top leg on a bench, making it substantially harder.",
      },
      {
        slug: "pallof-press",
        note: "Resists rotation rather than side-bending — the other anti-movement quality the trunk needs.",
      },
    ],
  },
  {
    slug: "side-plank-hip-dip",
    name: "Side Plank Hip Dip",
    primaryMuscle: "obliques",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Set up in a side plank on the forearm.\nLower the hip toward the floor under control, then lift back above the line.\nKeep the body in one plane throughout.",
    bodyEffect:
      "A side plank made dynamic: the hip lowers and lifts, so the lateral trunk muscles work through a range rather than holding one position.\n\nThe obliques and quadratus lumborum on the down side lengthen as the hip drops and shorten to lift it, with gluteus medius controlling the pelvis. Adding movement means an eccentric component a static hold does not have.\n\nWorking through range rather than holding gives a stronger hypertrophy stimulus for the lateral trunk and makes progress easier to judge in reps. The moving hip makes it easier to lose the straight-line position, which is where it stops working.",
    alternatives: [
      {
        slug: "side-plank",
        note: "The static version, which is easier to hold correctly and the right place to start.",
      },
      {
        slug: "suitcase-carry",
        note: "Loads the same muscles isometrically under a heavy external weight rather than through bodyweight range.",
      },
      {
        slug: "dumbbell-side-bend",
        note: "Trains lateral flexion standing with adjustable load, through a similar range but with no plank demand.",
      },
    ],
  },
  {
    slug: "dumbbell-side-bend",
    name: "Dumbbell Side Bend",
    primaryMuscle: "obliques",
    equipment: "dumbbell",
    trackingType: "weight_reps",
    instructions:
      "Stand tall with one heavy bell at your side.\nBend sideways toward the weight, then pull straight back upright.\nDo not lean forward or back. Repeat on the other side.",
    bodyEffect:
      "Lateral flexion of the spine against a load hanging at one side, so the obliques on the opposite side lengthen and then shorten to pull the torso upright.\n\nThe obliques and quadratus lumborum on the working side do the lifting, with the erectors keeping the spine from rotating or flexing forward. The grip and traps hold the weight throughout.\n\nIt is the most direct way to load lateral flexion through a range, which is otherwise poorly trained. Loaded side-bending is also one of the less spine-friendly movements available, so the range should stay modest and the tempo controlled.",
    alternatives: [
      {
        slug: "suitcase-carry",
        note: "Loads the same muscles isometrically to resist side-bending rather than producing it, which is far kinder to the spine.",
      },
      {
        slug: "side-plank",
        note: "Trains the lateral trunk with no spinal movement at all, using bodyweight instead of a heavy bell.",
      },
      {
        slug: "side-plank-hip-dip",
        note: "Gives the through-range work this provides while keeping the load at bodyweight and the spine better supported.",
      },
    ],
  },
  {
    slug: "mountain-climbers",
    name: "Mountain Climbers",
    primaryMuscle: "abs",
    secondaryMuscles: ["cardio"],
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Start in a push-up position with the body in one line.\nDrive the knees alternately toward the chest at speed.\nKeep the hips low and the shoulders over the hands.",
    bodyEffect:
      "A plank with rapid alternating hip flexion, so the trunk must hold a rigid line while the legs move quickly beneath it.\n\nRectus abdominis and transversus abdominis resist the hips sagging as in any plank, the obliques resist the rotation each leg drive creates, and the hip flexors work continuously. The shoulders bear weight throughout and the pace drives heart rate high.\n\nIt combines a trunk-stability demand with real conditioning, which makes it efficient in circuits and warm-ups. Speed degrades position quickly, and once the hips rise or sag it stops training the trunk at all.",
    alternatives: [
      {
        slug: "plank",
        note: "Removes the leg movement and the conditioning element, leaving a pure and much stricter anti-extension hold.",
      },
      {
        slug: "dead-bug",
        note: "Trains the same trunk-stable, limbs-moving pattern slowly and lying down, with no shoulder load or pace.",
      },
      {
        slug: "burpee",
        note: "A full-body conditioning movement with far more total work and much less trunk-specific demand.",
      },
    ],
  },
  {
    slug: "hanging-knee-raise-twist",
    name: "Hanging Oblique Knee Raise",
    primaryMuscle: "obliques",
    secondaryMuscles: ["abs"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hang from a bar with the shoulders active.\nRaise the knees up and across toward one shoulder, curling the pelvis.\nLower under control and alternate sides.",
    bodyEffect:
      "A hanging knee raise with a rotational component, so the pelvis both curls upward and turns toward one side against bodyweight.\n\nThe obliques produce the rotation and assist the curl, rectus abdominis curls the pelvis, and the hip flexors raise the legs. The lats and grip hold the hang while the whole trunk resists swinging.\n\nIt trains the obliques through a genuine range under bodyweight, which most rotational work does not manage. The rotation makes swinging even easier than in a straight leg raise, and momentum removes the load entirely.",
    alternatives: [
      {
        slug: "hanging-leg-raise",
        note: "Without the twist it loads rectus abdominis more directly and is much easier to keep strict.",
      },
      {
        slug: "woodchopper-cable",
        note: "Standing rotation against a stack, which is far easier to load progressively than bodyweight.",
      },
      {
        slug: "captains-chair-leg-raise",
        note: "Supported at the back and elbows, which removes the swing that makes the hanging version hard to do strictly.",
      },
    ],
  },
  {
    slug: "l-sit",
    name: "L-Sit",
    primaryMuscle: "abs",
    secondaryMuscles: ["quads"],
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Support yourself on parallettes or the floor with the arms locked and shoulders pressed down.\nLift the legs straight out in front to form an L.\nHold; tuck the knees if the position collapses.",
    bodyEffect:
      "A supported static hold with the legs held horizontal in front, so the hip flexors work maximally while the trunk keeps the pelvis from tipping backward.\n\nThe hip flexors hold the legs up, rectus abdominis and the obliques hold the pelvis tucked against them, the quads keep the knees locked, and the triceps, lats and shoulder depressors hold the body clear of the floor.\n\nIt demands strength, hamstring flexibility and shoulder control all at once, which is why it is a benchmark in gymnastics training. Everything about it is isometric and bodyweight-fixed, so it builds position and static strength rather than size.",
    alternatives: [
      {
        slug: "hollow-body-hold",
        note: "Trains the same rigid-trunk position lying down, with no shoulder support or flexibility requirement.",
      },
      {
        slug: "hanging-leg-raise",
        note: "Moves the same hip flexion and pelvic curl through a range instead of holding one position.",
      },
      {
        slug: "captains-chair-leg-raise",
        note: "Supports the back and elbows, making a similar leg-raise demand far more accessible.",
      },
    ],
  },
];

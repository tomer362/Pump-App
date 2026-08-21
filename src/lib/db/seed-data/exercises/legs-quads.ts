import type { SeedExercise } from "../types";

export const LEGS_QUADS: SeedExercise[] = [
  /* ---- Bilateral squatting ---- */
  {
    slug: "squat-barbell",
    name: "Squat (Barbell)",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings"],
    equipment: "barbell",
    instructions:
      "Set the bar across the upper back, stance about shoulder width, toes slightly out.\nBrace, then sit down and back until the hip crease passes the knee.\nDrive up through the whole foot, keeping the chest and hips rising together.",
    bodyEffect:
      "Simultaneous flexion and extension at the hip, knee and ankle under a load carried on the torso, so the spine is compressed and braced while the legs do the moving.\n\nThe quadriceps extend the knee and the glutes extend the hip, with the adductors contributing substantially out of the bottom and the hamstrings stabilising the knee. The erectors, abs and upper back work isometrically to keep the torso from folding — the reason a squat is felt everywhere the next day.\n\nIt loads more muscle through a longer range than almost anything else, which is why it remains the reference lower-body strength lift. That comes with real systemic and spinal cost, and depth is limited by ankle and hip mobility rather than by strength for many people.",
    alternatives: [
      {
        slug: "front-squat-barbell",
        note: "Moving the bar to the front forces a more upright torso, which shifts load onto the quads and off the lower back.",
      },
      {
        slug: "leg-press",
        note: "The seat carries the spinal load entirely, so the legs can be trained heavy and to failure without any bracing demand.",
      },
      {
        slug: "goblet-squat",
        note: "A far lighter front-loaded squat that teaches the same pattern with almost no spinal load or setup.",
      },
    ],
  },
  {
    slug: "front-squat-barbell",
    name: "Front Squat (Barbell)",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "abs"],
    equipment: "barbell",
    instructions:
      "Rack the bar across the front delts with the elbows high, hands relaxed.\nSquat down keeping the torso as upright as possible.\nDrive up without letting the elbows drop.",
    bodyEffect:
      "A squat with the load in front of the body, which shifts the centre of mass forward and forces the torso to stay far more upright than a back squat allows.\n\nThe quadriceps take a substantially larger share because the knee travels further forward, while the glutes still extend the hip. The upper back, abs and erectors work extremely hard isometrically — the bar will simply fall off the front if the torso rounds.\n\nThe upright position reduces shear on the lumbar spine and makes it the more quad-dominant and generally more back-friendly squat. Loads are lower than a back squat and the front rack position is uncomfortable until wrist and shoulder mobility allow it.",
    alternatives: [
      {
        slug: "squat-barbell",
        note: "The bar on the back allows a forward lean and considerably heavier loading, sharing more of the work with the glutes and hips.",
      },
      {
        slug: "goblet-squat",
        note: "The same front-loaded, upright pattern with a fraction of the load and no rack position to master.",
      },
      {
        slug: "hack-squat",
        note: "Machine-guided and quad-biased like a front squat, with the trunk supported so it never limits the set.",
      },
    ],
  },
  {
    slug: "goblet-squat",
    name: "Goblet Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "dumbbell",
    instructions:
      "Hold a single bell or kettlebell against the chest with both hands.\nSquat down between the knees, keeping the chest tall.\nDrive up through the whole foot.",
    bodyEffect:
      "A front-loaded squat with the weight held at the chest, which acts as a counterbalance and lets most people sit into a deeper, more upright squat than they can achieve unloaded.\n\nThe quadriceps extend the knee and the glutes and adductors the hip, while the upper back and abs work isometrically to hold the load against the chest. The counterbalance effect means less mobility is required to reach depth.\n\nIt is the best way to learn and to practise a squat pattern, and the load is capped low enough that it stays a technique and volume exercise rather than a strength one. Once you can handle a heavy bell it stops progressing usefully.",
    alternatives: [
      {
        slug: "front-squat-barbell",
        note: "The same upright front-loaded position with a barbell, which removes the ceiling on how heavy it can get.",
      },
      {
        slug: "squat-barbell",
        note: "Loads far heavier with the bar on the back, but demands more mobility and puts real load through the spine.",
      },
      {
        slug: "leg-press",
        note: "Trains the same knee and hip extension with no balance or trunk demand at all, and loads much heavier.",
      },
    ],
  },
  {
    slug: "squat-smith-machine",
    name: "Squat (Smith Machine)",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "smith",
    instructions:
      "Set the bar on the upper back and place the feet slightly forward of the bar.\nSquat down along the fixed path until the hips pass the knees.\nDrive back up and twist to re-rack.",
    bodyEffect:
      "A squat along a fixed vertical rail, so balance is removed and the feet can be placed forward of the body in a way a free bar would never allow.\n\nThe quadriceps and glutes do the work, but the rails take over all the stabilising and the erectors do far less than in a free squat. Setting the feet forward increases knee flexion and biases the quads further.\n\nThe safety catches make it a practical way to squat heavy and to failure alone, and the forward foot position is a genuinely effective quad-biased variation. The fixed path does not match everyone's natural squat line, and none of the balance transfers to a free bar.",
    alternatives: [
      {
        slug: "squat-barbell",
        note: "A free bar lets the path follow your own mechanics and trains all the bracing the rails remove.",
      },
      {
        slug: "hack-squat",
        note: "A dedicated angled machine that supports the back properly rather than leaving the spine to a vertical rail.",
      },
      {
        slug: "leg-press",
        note: "Removes the spinal load completely while keeping heavy knee and hip extension.",
      },
    ],
  },
  {
    slug: "hack-squat",
    name: "Hack Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "machine",
    instructions:
      "Set the shoulders under the pads and the feet mid-platform.\nLower until the knees reach about ninety degrees or deeper.\nDrive up without locking out hard at the top.",
    bodyEffect:
      "A squat performed on an angled sled with the back supported, so the torso is held rigid and the legs work along a fixed path.\n\nThe quadriceps do the majority of the work — the back support and the foot position keep the knees travelling forward through a long range — with the glutes extending the hip and the adductors assisting. The spinal erectors are almost entirely unloaded.\n\nThat combination makes it one of the most effective quad builders available, and the back pad means the set ends when the legs fail rather than when the trunk does. It builds no bracing or balance, and the fixed path is unforgiving if it does not match your proportions.",
    alternatives: [
      {
        slug: "squat-barbell",
        note: "Loads the whole body and trains bracing, but the trunk and lower back often fail before the quads do.",
      },
      {
        slug: "leg-press",
        note: "Similar supported loading with more scope to vary foot position, though usually a shorter effective range for the quads.",
      },
      {
        slug: "front-squat-barbell",
        note: "A free-weight route to the same quad bias, adding a substantial upper-back and trunk demand.",
      },
    ],
  },
  {
    slug: "leg-press",
    name: "Leg Press",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings"],
    equipment: "machine",
    instructions:
      "Set the feet mid-platform about shoulder width.\nLower until the knees reach roughly ninety degrees without letting the lower back round off the pad.\nPress back without snapping the knees straight.",
    bodyEffect:
      "Knee and hip extension against a sled, with the back and pelvis supported so the spine carries none of the load.\n\nThe quadriceps and glutes do the work, with the adductors and hamstrings assisting; foot position shifts the balance, with feet low and narrow biasing the quads and high and wide biasing the glutes and hamstrings. No bracing or balancing is required at all.\n\nRemoving the spinal load means the legs can be trained very heavy and to genuine failure, which makes it the workhorse of most leg programmes. Letting the lower back round at the bottom under a heavy sled is the one way it commonly causes injury.",
    alternatives: [
      {
        slug: "hack-squat",
        note: "The angled sled and shoulder pads usually allow a longer range of knee flexion, which is a stronger quad stimulus.",
      },
      {
        slug: "squat-barbell",
        note: "Adds full trunk and bracing demand and builds transferable strength, at the cost of loading the spine heavily.",
      },
      {
        slug: "bulgarian-split-squat",
        note: "One leg at a time, which exposes imbalances and adds a stability demand the sled removes entirely.",
      },
    ],
  },
  {
    slug: "pendulum-squat",
    name: "Pendulum Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "machine",
    instructions:
      "Set the shoulders under the pads and the feet on the platform.\nLower along the machine's swinging arc until the knees are deeply flexed.\nDrive back up under control.",
    bodyEffect:
      "A squat along a curved, pendulum-shaped arc rather than a straight line, which keeps the resistance more constant relative to the leg's changing leverage.\n\nThe quadriceps take the bulk of the work through a very long range of knee flexion, with the glutes extending the hip at the bottom. The back is supported throughout, so the trunk contributes nothing.\n\nThe arc means the bottom position stays loaded rather than becoming disproportionately hard, which lets the quads work through a deeper range than most machines allow. It is a specialist piece of equipment that many gyms do not have.",
    alternatives: [
      {
        slug: "hack-squat",
        note: "The most widely available machine with a similar back-supported quad bias, though on a straight rather than curved path.",
      },
      {
        slug: "leg-press",
        note: "Common in every gym and easy to load very heavily, but usually through a shorter range of knee flexion.",
      },
      {
        slug: "front-squat-barbell",
        note: "A free-weight movement with the same quad emphasis, adding trunk and upper-back demand no machine provides.",
      },
    ],
  },
  {
    slug: "belt-squat",
    name: "Belt Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "machine",
    instructions:
      "Attach the belt around the hips and stand on the platform.\nSquat down to depth, holding the handles lightly for balance only.\nDrive up through the whole foot.",
    bodyEffect:
      "A squat in which the load hangs from the hips rather than resting on the shoulders, so the spine is loaded in traction rather than compression.\n\nThe quadriceps and glutes do the same work as in any squat, and because nothing sits on the back the erectors and upper back are essentially unloaded. The hip position also allows a very upright torso.\n\nThat makes it the most useful heavy squat variation for anyone whose lower back limits their training, and it allows leg volume on days when spinal loading needs to stay low. It requires a specific machine or setup, and it trains none of the bracing that makes squatting a whole-body lift.",
    alternatives: [
      {
        slug: "squat-barbell",
        note: "Loads the spine and trains full-body bracing, which is exactly what this variation is designed to avoid.",
      },
      {
        slug: "leg-press",
        note: "Also removes spinal compression and is far more widely available, though the seated position removes the standing pattern.",
      },
      {
        slug: "hack-squat",
        note: "Supports the back on a pad rather than unloading it entirely, with a strong quad bias and easy loading.",
      },
    ],
  },
  {
    slug: "zercher-squat",
    name: "Zercher Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "abs"],
    equipment: "barbell",
    instructions:
      "Cradle the bar in the crooks of both elbows against the torso.\nSquat down between the knees, keeping the chest up.\nDrive up without letting the bar slide down.",
    bodyEffect:
      "A squat with the load carried in the crooks of the elbows, in front of and below the shoulders, which pulls the torso forward harder than any other bar position.\n\nThe quadriceps and glutes do the leg work, but the upper back, abs and erectors work extraordinarily hard to resist being folded forward — often the true limit of the lift. The front-loaded position also permits a very deep, upright squat.\n\nIt builds trunk and upper-back strength as much as legs, and the low bar position lets people squat deep who cannot get there otherwise. The bar on bare elbows is genuinely painful and caps the load long before the legs are done.",
    alternatives: [
      {
        slug: "front-squat-barbell",
        note: "A similar front-loaded, upright squat with the bar on the shoulders instead of the elbows — far more comfortable and heavier.",
      },
      {
        slug: "goblet-squat",
        note: "The same counterbalanced front-loading with a bell against the chest, at much lighter load and no discomfort.",
      },
      {
        slug: "squat-barbell",
        note: "The bar on the back allows the heaviest loading of all, but drops most of the trunk demand this variation creates.",
      },
    ],
  },
  {
    slug: "box-squat",
    name: "Box Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings"],
    equipment: "barbell",
    instructions:
      "Set a box so sitting on it puts you at or just below parallel.\nSit back onto the box under control, pause without relaxing.\nDrive up off the box without rocking.",
    bodyEffect:
      "A squat to a fixed depth with a pause on a box, which breaks the stretch-shortening cycle and forces the ascent to start from a dead stop.\n\nSitting back rather than down increases hip flexion relative to knee flexion, so the glutes and hamstrings take a larger share than in a free squat while the quads still extend the knee. The pause removes all elastic assistance out of the bottom.\n\nIt teaches consistent depth, builds starting strength from the hardest position, and is easier on the knees than a deep free squat. Rocking back onto the box under load compresses the spine sharply, which is the one thing that must not happen.",
    alternatives: [
      {
        slug: "squat-barbell",
        note: "A continuous squat uses the stretch reflex out of the bottom and trains a fuller, more natural range.",
      },
      {
        slug: "pause-squat",
        note: "Removes the elastic assistance the same way but without a box, so the depth is yours to control rather than fixed.",
      },
      {
        slug: "hip-thrust-barbell",
        note: "If the hip-dominant emphasis is the goal, this loads hip extension directly with no knee or spinal demand.",
      },
    ],
  },
  {
    slug: "pause-squat",
    name: "Pause Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "barbell",
    instructions:
      "Squat to depth as normal and hold the bottom position for two to three seconds.\nStay tight; do not relax into the hole.\nDrive up without any bounce.",
    bodyEffect:
      "A squat with a deliberate hold at the bottom, which dissipates the elastic energy stored in the tissues and makes the ascent begin from rest.\n\nThe quadriceps and glutes must produce the entire force from the weakest position with no rebound, and the trunk and upper back work far longer isometrically than in a touch-and-go rep. Time under tension rises sharply.\n\nIt builds strength precisely where squats stall and ruthlessly exposes any position that only works because of momentum. The loads have to drop considerably, and it is far more fatiguing per rep than a normal squat.",
    alternatives: [
      {
        slug: "squat-barbell",
        note: "Touch-and-go reps use the stretch reflex, which allows much heavier loading and less fatigue per set.",
      },
      {
        slug: "box-squat",
        note: "Achieves a similar dead-stop start with a fixed depth, and shifts more of the work onto the hips.",
      },
      {
        slug: "front-squat-barbell",
        note: "Also demands a rigid upright position out of the bottom, but through continuous rather than paused reps.",
      },
    ],
  },
  /* ---- Unilateral ---- */
  {
    slug: "bulgarian-split-squat",
    name: "Bulgarian Split Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "dumbbell",
    instructions:
      "Set the rear foot on a bench and the front foot far enough forward to keep the shin near vertical.\nLower until the rear knee nearly touches the floor.\nDrive up through the front heel.",
    bodyEffect:
      "A deep single-leg squat with the rear foot elevated, so almost all the load sits on the front leg and the rear leg only balances.\n\nThe quadriceps and glutes of the front leg do the work through a very long range, with the adductors heavily involved in stabilising and the glute medius working constantly to keep the pelvis level. The rear hip flexor is stretched at the bottom.\n\nIt loads one leg through a longer range than a bilateral squat reaches, exposes imbalances immediately, and demands very little absolute weight — which makes it a heavy leg exercise with almost no spinal load. It is exhausting, hard to balance, and takes twice as long per set.",
    alternatives: [
      {
        slug: "split-squat",
        note: "Both feet on the floor is far more stable and easier to load, though the range and the stretch are shorter.",
      },
      {
        slug: "lunge-dumbbell",
        note: "Stepping rather than staying in place adds a dynamic component and less range per rep on the working leg.",
      },
      {
        slug: "leg-press",
        note: "Removes all balance and stability demand so the quads can be loaded far heavier — but hides any imbalance.",
      },
    ],
  },
  {
    slug: "split-squat",
    name: "Split Squat (Dumbbell)",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "dumbbell",
    instructions:
      "Stand in a long split stance with both feet on the floor.\nLower the rear knee straight down toward the floor.\nDrive up through the front foot without stepping.",
    bodyEffect:
      "A stationary single-leg squat with both feet grounded, so the rear leg provides real support while the front leg does most of the work.\n\nThe front leg's quadriceps and glutes drive the movement, with the glute medius stabilising the pelvis and the adductors assisting. The rear foot's contact means balance is far less of a limiting factor than in a Bulgarian variation.\n\nThat stability lets you load it heavier and focus on the working leg rather than on staying upright, which makes it the better single-leg starting point and a good way to build toward harder variations. The range is shorter and the front leg receives less of the total load.",
    alternatives: [
      {
        slug: "bulgarian-split-squat",
        note: "Elevating the rear foot removes its support, putting far more load on the front leg through a longer range.",
      },
      {
        slug: "lunge-dumbbell",
        note: "Adds a step, which brings in deceleration and coordination but reduces the load the working leg can take.",
      },
      {
        slug: "step-up",
        note: "Removes the rear leg entirely at the top of the rep, making it the most concentric-dominant single-leg option.",
      },
    ],
  },
  {
    slug: "lunge-dumbbell",
    name: "Lunge (Dumbbell)",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "dumbbell",
    instructions:
      "Stand tall with a bell in each hand.\nStep forward and lower until the back knee nearly touches the floor.\nPush back to the start, or step through into the next rep.",
    bodyEffect:
      "A single-leg squat entered dynamically by stepping, so the working leg has to absorb and decelerate the body before it can extend it.\n\nThe front leg's quadriceps and glutes do the lifting, the glute medius controls the pelvis against a narrow base, and the adductors stabilise. Stepping forward adds an eccentric braking demand that a stationary split squat does not have.\n\nIt trains single-leg strength alongside deceleration and balance, which transfers directly to walking, running and changing direction. The step limits how heavy you can safely load it, and the front knee takes a real braking force each rep.",
    alternatives: [
      {
        slug: "reverse-lunge",
        note: "Stepping backward reduces the braking force on the front knee considerably and biases the glutes more.",
      },
      {
        slug: "split-squat",
        note: "Staying in place removes the step entirely, so more load can be used and the working leg gets more of it.",
      },
      {
        slug: "walking-lunge",
        note: "Chaining steps together adds continuous stability and conditioning demand rather than resetting each rep.",
      },
    ],
  },
  {
    slug: "reverse-lunge",
    name: "Reverse Lunge (Dumbbell)",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "dumbbell",
    instructions:
      "Stand tall and step backward, lowering the rear knee toward the floor.\nKeep the front shin near vertical and the weight on the front foot.\nDrive back to standing through the front leg.",
    bodyEffect:
      "A lunge entered by stepping backward, so the front foot stays planted and the body lowers over it rather than crashing into a new position.\n\nThe front leg's glutes and quadriceps do the work, with the hip taking a slightly larger share than in a forward lunge because the torso leans marginally more. The braking force on the front knee is much lower, since the front foot never decelerates a step.\n\nThat makes it the more knee-friendly lunge and the easier one to load, while still training single-leg strength and pelvic control. It requires a little more balance on the way back than a forward step does.",
    alternatives: [
      {
        slug: "lunge-dumbbell",
        note: "Stepping forward adds a real deceleration demand on the front knee, useful for athletic transfer but harder on the joint.",
      },
      {
        slug: "split-squat",
        note: "No stepping at all, which makes it the most stable and the easiest of the three to load heavily.",
      },
      {
        slug: "step-up",
        note: "Purely concentric on the working leg, with almost no eccentric braking at all.",
      },
    ],
  },
  {
    slug: "walking-lunge",
    name: "Walking Lunge",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "cardio"],
    equipment: "dumbbell",
    trackingType: "weight_reps",
    instructions:
      "Hold a bell in each hand and step forward into a lunge.\nDrive up and step straight through into the next lunge with the other leg.\nKeep the torso tall throughout.",
    bodyEffect:
      "A continuous chain of lunges with no reset between reps, so each rep begins from a moving, single-leg position rather than a stable stance.\n\nThe quadriceps and glutes of each leg alternate between driving and absorbing, while the glute medius and adductors work constantly to control the pelvis over a narrow base. The continuous nature drives heart rate up substantially.\n\nIt trains single-leg strength, balance and conditioning simultaneously, which makes it efficient and thoroughly unpleasant. Fatigue degrades the position quickly, and it needs floor space most gyms only sort of have.",
    alternatives: [
      {
        slug: "lunge-dumbbell",
        note: "Resetting between reps lets you keep better position and use more weight per rep, with much less conditioning demand.",
      },
      {
        slug: "reverse-lunge",
        note: "Stepping backward from a fixed stance is far easier on the knees and much easier to control under load.",
      },
      {
        slug: "bulgarian-split-squat",
        note: "Loads one leg through a far longer range with no travel and no conditioning component at all.",
      },
    ],
  },
  {
    slug: "step-up",
    name: "Step Up",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "dumbbell",
    trackingType: "weight_reps",
    instructions:
      "Set a box at about knee height and place one whole foot on it.\nDrive up through that foot without pushing off the back leg.\nLower under control and repeat before switching sides.",
    bodyEffect:
      "A single-leg knee and hip extension performed by lifting the entire body onto a box, with the trailing leg contributing nothing if done honestly.\n\nThe quadriceps and glutes of the working leg do all the work, and the glute medius holds the pelvis level as the body's weight transfers over one foot. Box height determines how much hip flexion — and therefore how much glute — is involved.\n\nBecause it is almost purely concentric on the working leg, it is unusually easy on the joints and very easy to scale by changing box height. The temptation to push off the trailing foot is constant and quietly removes most of the training effect.",
    alternatives: [
      {
        slug: "bulgarian-split-squat",
        note: "Adds a full eccentric and a deep stretch on the working leg, which is a substantially stronger stimulus.",
      },
      {
        slug: "reverse-lunge",
        note: "Trains the same single-leg pattern with a real lowering phase, and needs no box.",
      },
      {
        slug: "leg-press",
        note: "Loads the quads far heavier with both legs and no balance requirement, though imbalances stay hidden.",
      },
    ],
  },
  {
    slug: "pistol-squat",
    name: "Pistol Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "abs"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Stand on one leg with the other extended in front.\nLower under control all the way to the bottom, keeping the free leg off the floor.\nDrive back up without touching down.",
    bodyEffect:
      "A full-depth single-leg squat with the other leg held out in front, which requires the entire bodyweight to be controlled on one leg through the deepest possible range.\n\nThe quadriceps and glutes of the standing leg work through their full range, the glute medius holds the pelvis level, and the abs and hip flexors of the free leg work hard to keep it extended. Ankle mobility is a hard prerequisite.\n\nIt is the most demanding bodyweight leg movement and builds real single-leg strength, balance and mobility together. Load is fixed at bodyweight and the mobility requirement excludes many people entirely, which limits its usefulness as a training staple.",
    alternatives: [
      {
        slug: "bulgarian-split-squat",
        note: "Similar single-leg loading through a long range, but the rear foot's balance support makes it accessible and loadable.",
      },
      {
        slug: "step-up",
        note: "Trains one leg with adjustable difficulty via box height and none of the mobility or balance prerequisites.",
      },
      {
        slug: "split-squat",
        note: "A far more stable single-leg pattern that can be loaded progressively with dumbbells.",
      },
    ],
  },
  {
    slug: "sissy-squat",
    name: "Sissy Squat",
    primaryMuscle: "quads",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Hold a support and rise onto the balls of the feet.\nLet the knees travel forward and lean back, lowering until the thighs and torso form a line.\nPull back up using the quads only.",
    bodyEffect:
      "Knee extension with the hip held straight, so the body pivots at the knee alone and the quadriceps work without any hip contribution.\n\nAll four heads of the quadriceps are loaded, and because the hip stays extended, rectus femoris — which crosses both hip and knee — is stretched rather than shortened, which no other squat variation achieves. The knee travels far forward under load.\n\nIt loads the quads, especially rectus femoris, at long muscle lengths in a way squatting cannot, which is why it has persisted despite its reputation. The extreme knee flexion under bodyweight is demanding on the joint, so it wants gradual introduction and a support to hold.",
    alternatives: [
      {
        slug: "leg-extension",
        note: "Isolates knee extension seated, which is far kinder to the knee and lets the load be adjusted precisely.",
      },
      {
        slug: "reverse-nordic-curl",
        note: "The same hip-extended quad stretch performed kneeling, which distributes the load more comfortably.",
      },
      {
        slug: "hack-squat",
        note: "A quad-biased squat with the back supported, loading far heavier without the extreme knee position.",
      },
    ],
  },
  {
    slug: "reverse-nordic-curl",
    name: "Reverse Nordic Curl",
    primaryMuscle: "quads",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Kneel upright with the hips straight and the torso tall.\nLean back slowly, keeping a straight line from knees to head.\nPull yourself back up using the quads.",
    bodyEffect:
      "Controlled knee flexion resisted by the quadriceps, performed kneeling with the hip held extended so the quads are lengthened at both ends.\n\nRectus femoris in particular is loaded in a deeply stretched position, since it crosses the hip as well as the knee and the extended hip lengthens it further. The glutes and abs work isometrically to keep the body in a straight line.\n\nStretch-position loading of the quads is a strong hypertrophy stimulus and this is one of very few ways to achieve it without equipment. It is much harder than it looks, the range is easy to overestimate, and the knees need to be eased into it.",
    alternatives: [
      {
        slug: "sissy-squat",
        note: "Standing rather than kneeling, which reaches a similar stretch but concentrates far more pressure on the knee joint.",
      },
      {
        slug: "leg-extension",
        note: "Isolates the quads with adjustable load, but the seated position means rectus femoris is never stretched at the hip.",
      },
      {
        slug: "bulgarian-split-squat",
        note: "Loads the quads through a long range with real external weight, though without the hip-extended stretch.",
      },
    ],
  },
  {
    slug: "cyclist-squat",
    name: "Cyclist Squat (Heels Elevated)",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes"],
    equipment: "barbell",
    instructions:
      "Stand with the heels on small plates or a wedge, feet close together.\nSquat down keeping the torso upright and letting the knees travel forward.\nDrive up through the whole foot.",
    bodyEffect:
      "A squat with the heels raised, which lets the knee travel much further forward before the ankle runs out of range and keeps the torso upright.\n\nThat forward knee travel means more knee flexion for the same depth, so the quadriceps take a substantially larger share while the glutes and lower back do less. The narrow stance further reduces the adductors' contribution.\n\nIt is the most quad-biased free-weight squat and a practical solution for people whose ankle mobility limits their depth. The loads are lower than a normal squat and it does little for the posterior chain.",
    alternatives: [
      {
        slug: "front-squat-barbell",
        note: "Also quad-biased and upright, but via the bar position rather than the heels, and heavier through the whole chain.",
      },
      {
        slug: "hack-squat",
        note: "Delivers the same quad bias with the back supported, so the trunk never limits the set.",
      },
      {
        slug: "squat-barbell",
        note: "Flat feet and a wider stance spread the work across the glutes and hips instead of concentrating it in the quads.",
      },
    ],
  },
  /* ---- Knee extension isolation ---- */
  {
    slug: "leg-extension",
    name: "Leg Extension",
    primaryMuscle: "quads",
    equipment: "machine",
    instructions:
      "Set the back pad so the knee lines up with the machine's pivot.\nExtend the legs until straight without snapping the knees.\nLower under control to a full stretch.",
    bodyEffect:
      "Isolated knee extension with the hip fixed by the seat, so the quadriceps work without any contribution from the hip or the rest of the body.\n\nAll four heads extend the knee, though rectus femoris is at a disadvantage because the seated position keeps the hip flexed and the muscle shortened at one end. Resistance peaks near full extension.\n\nIt is the only way to load the quads without also loading the hips and spine, which makes it valuable for adding quad volume cheaply and for training around a back or hip problem. It is open-chain and non-functional, and heavy loads at full lockout put real shear on the knee.",
    alternatives: [
      {
        slug: "reverse-nordic-curl",
        note: "Extends the hip rather than flexing it, which loads rectus femoris in a stretched position the seat prevents.",
      },
      {
        slug: "hack-squat",
        note: "A compound quad movement with the same back support, loading far more muscle through a longer range.",
      },
      {
        slug: "sissy-squat",
        note: "Also loads the quads with the hip extended, using bodyweight rather than a stack.",
      },
    ],
  },
  {
    slug: "leg-extension-single-leg",
    name: "Single-Leg Extension",
    primaryMuscle: "quads",
    equipment: "machine",
    instructions:
      "Set up as for a normal leg extension but use one leg at a time.\nExtend fully without snapping the knee.\nLower slowly and repeat before switching.",
    bodyEffect:
      "Knee extension performed one leg at a time, so neither side can compensate for the other and each receives the full attention of the set.\n\nThe quadriceps of the working leg do all of the work with the hip fixed by the seat, exactly as in the bilateral version. The difference is entirely in the loading distribution rather than the mechanics.\n\nIt is the simplest way to find and correct a strength difference between legs, and it lets a rehabilitating side be loaded independently of the healthy one. Each set takes twice as long, and the total load is naturally lower.",
    alternatives: [
      {
        slug: "leg-extension",
        note: "Both legs at once is faster and allows more total load, but the stronger leg quietly takes more of it.",
      },
      {
        slug: "bulgarian-split-squat",
        note: "Also single-leg, but compound and weight-bearing, which transfers far better to real movement.",
      },
      {
        slug: "step-up",
        note: "A single-leg compound movement with almost no eccentric load, useful when the knee is being reintroduced to work.",
      },
    ],
  },
  {
    slug: "hip-adduction-machine",
    name: "Hip Adduction (Machine)",
    primaryMuscle: "quads",
    equipment: "machine",
    instructions:
      "Sit with the pads against the inside of the thighs, legs apart.\nSqueeze the legs together against the resistance.\nReturn slowly to a comfortable stretch.",
    bodyEffect:
      "Hip adduction — drawing the thigh toward the midline — performed seated, so the adductor group works in isolation with no other joint involved.\n\nAdductor magnus, longus and brevis and gracilis do all the work. Adductor magnus in particular is also a powerful hip extensor and is heavily involved in squatting out of the bottom, which is why the group matters more than its reputation suggests.\n\nDirect adductor work builds a muscle group that squatting loads but rarely takes to failure, and strengthening it is well supported for groin-strain prevention. It is an isolation exercise with no compound carryover, and the machine's range is often short.",
    alternatives: [
      {
        slug: "copenhagen-plank",
        note: "Loads the adductors isometrically in a side-plank position, which is the more direct groin-injury prevention exercise.",
      },
      {
        slug: "squat-barbell",
        note: "Recruits the adductors heavily out of the bottom as part of a compound lift, though never to failure.",
      },
      {
        slug: "bulgarian-split-squat",
        note: "Loads the adductors substantially as stabilisers while training the whole leg through a long range.",
      },
    ],
  },
  {
    slug: "copenhagen-plank",
    name: "Copenhagen Plank",
    primaryMuscle: "quads",
    secondaryMuscles: ["obliques"],
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Lie on your side with the top leg resting on a bench at the knee or ankle.\nLift the hips so the body forms a straight line, supported by the elbow and the top leg.\nHold, then swap sides.",
    bodyEffect:
      "A side plank in which the top leg supports the body from a bench, so the adductors of that leg must contract hard just to hold the position.\n\nThe adductor group on the elevated side works maximally and isometrically, while the obliques and quadratus lumborum resist the hips dropping as in any side plank. Supporting at the ankle rather than the knee lengthens the lever considerably.\n\nIt has the strongest evidence of any exercise for reducing groin injuries in field sports, which is why it has spread from football rehabilitation into general training. It is isometric and awkward, so it builds position and durability rather than size.",
    alternatives: [
      {
        slug: "hip-adduction-machine",
        note: "Trains the same muscles through an actual range with adjustable load, which builds size more directly.",
      },
      {
        slug: "side-plank",
        note: "Keeps the lateral trunk demand without any adductor loading — much easier and a reasonable starting point.",
      },
      {
        slug: "bulgarian-split-squat",
        note: "Loads the adductors as stabilisers within a full leg exercise rather than isolating them.",
      },
    ],
  },
];

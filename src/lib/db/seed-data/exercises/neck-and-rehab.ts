import type { SeedExercise } from "../types";

export const NECK_AND_REHAB: SeedExercise[] = [
  {
    slug: "neck-flexion-harness",
    name: "Neck Flexion",
    primaryMuscle: "neck",
    equipment: "other",
    trackingType: "reps",
    instructions:
      "Lie face up on a bench with the head hanging off the end, a light plate held on the forehead.\nTuck the chin and curl the head up.\nLower slowly through a full range. Start with no weight at all.",
    bodyEffect:
      "Cervical flexion under load: the head curls forward against resistance while the rest of the spine stays still.\n\nThe deep neck flexors and sternocleidomastoid do the work. These are the muscles that decelerate the head, and their strength is directly related to how much force reaches the brain during an impact.\n\nNeck strength is one of the few modifiable factors associated with reduced concussion risk in contact sports, which is why it is standard in rugby, wrestling and boxing programmes. The neck is delicate and the range is small — this is a place for very light loads and very slow progression.",
    alternatives: [
      {
        slug: "neck-extension-harness",
        note: "The opposing direction, which must be trained alongside this rather than instead of it.",
      },
      {
        slug: "neck-isometric",
        note: "Loads the same muscles without any movement at all, which is the safer starting point.",
      },
      {
        slug: "shrug-barbell",
        note: "Loads the upper traps rather than the neck itself — related musculature, but a different function.",
      },
    ],
  },
  {
    slug: "neck-extension-harness",
    name: "Neck Extension",
    primaryMuscle: "neck",
    secondaryMuscles: ["traps"],
    equipment: "other",
    trackingType: "reps",
    instructions:
      "Lie face down on a bench with the head off the end, using a harness or a light plate on the back of the head.\nRaise the head until you are looking forward.\nLower slowly. Start with bodyweight only.",
    bodyEffect:
      "Cervical extension under load: the head lifts backward against resistance while the trunk stays still on the bench.\n\nThe cervical erectors, splenius and upper trapezius do the work. These muscles hold the head up against gravity all day and are what resist a forward-flexion impact.\n\nTrained alongside flexion, this builds a neck that can absorb force from multiple directions, which is the point of neck training in contact sport. It is also the region where excessive load does real damage, so range and weight both want to stay conservative.",
    alternatives: [
      {
        slug: "neck-flexion-harness",
        note: "The opposing direction — the pair only makes sense trained together, never one alone.",
      },
      {
        slug: "neck-isometric",
        note: "Static holds in every direction, which is the safest way to begin loading the neck.",
      },
      {
        slug: "prone-y-raise",
        note: "Trains the lower traps and upper-back posture that support the neck, without loading it directly.",
      },
    ],
  },
  {
    slug: "neck-isometric",
    name: "Neck Isometric Hold",
    primaryMuscle: "neck",
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Press your hand against your forehead, the back of your head, or one side.\nPush back with the neck without letting the head move at all.\nHold, breathe, then switch direction.",
    bodyEffect:
      "A static contraction of the neck muscles against your own hand, with no movement of the cervical spine at any point.\n\nWhichever direction you press, the opposing neck muscles contract isometrically — flexors against the forehead, extensors against the back, the side flexors against a hand at the temple. The joint stays completely still.\n\nBecause nothing moves, this is the safest possible way to begin loading the neck, and it can be done anywhere with no equipment. It builds far less than loaded work through a range, so it is a starting point rather than a destination.",
    alternatives: [
      {
        slug: "neck-flexion-harness",
        note: "Loads the same flexors through an actual range, which builds considerably more strength.",
      },
      {
        slug: "neck-extension-harness",
        note: "The through-range version for the extensors, and the natural progression from holding still.",
      },
      {
        slug: "farmers-walk",
        note: "Loads the traps and upper back isometrically under heavy weight, supporting the neck indirectly.",
      },
    ],
  },
  {
    slug: "chin-tuck",
    name: "Chin Tuck",
    primaryMuscle: "neck",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Sit or stand tall and draw the chin straight back, making a double chin.\nDo not tilt the head down.\nHold briefly, then release.",
    bodyEffect:
      "A retraction of the head over the shoulders, which is a gliding movement of the upper cervical vertebrae rather than a nod.\n\nThe deep neck flexors — longus colli and longus capitis — contract to draw the head back, while the muscles at the base of the skull lengthen. These deep muscles are the postural stabilisers of the neck and are typically weak in anyone who spends the day looking at a screen.\n\nIt is one of the most common exercises in neck rehabilitation because it directly addresses the forward-head position and the headaches that come with it. It is a positional correction, not a strength exercise, and needs frequency rather than load.",
    alternatives: [
      {
        slug: "neck-isometric",
        note: "Adds resistance to the same deep flexors, which is the next step once the position itself is easy to find.",
      },
      {
        slug: "prone-y-raise",
        note: "Addresses the upper-back position that a forward head usually sits on top of, rather than the neck alone.",
      },
      {
        slug: "face-pull",
        note: "Trains the mid and lower traps and rear delts that hold the shoulders back, supporting head position indirectly.",
      },
    ],
  },
  {
    slug: "wall-slide",
    name: "Wall Slide",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["traps"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Stand with the back against a wall, forearms flat against it at shoulder height.\nSlide the arms up the wall, keeping the forearms and wrists in contact.\nLower under control without letting the ribs flare.",
    bodyEffect:
      "Shoulder flexion overhead with the arms held against a wall, which forces the shoulder blades to rotate upward rather than letting the ribcage arch to fake the range.\n\nSerratus anterior and the lower trapezius rotate the shoulder blade upward, while the rotator cuff keeps the humerus centred and the abs stop the ribs flaring. The wall makes any compensation immediately obvious.\n\nIt is the standard drill for restoring overhead mechanics, and it is genuinely useful as a warm-up before pressing for anyone whose overhead position is limited. It is a mobility and control exercise with essentially no loading.",
    alternatives: [
      {
        slug: "prone-y-raise",
        note: "Loads the same lower traps and upward rotation lying down, with a small external weight rather than a wall.",
      },
      {
        slug: "band-pull-apart",
        note: "Trains retraction rather than upward rotation, which is a related but different part of shoulder-blade control.",
      },
      {
        slug: "landmine-press-shoulder",
        note: "A loaded press on an arc that works with a limited overhead range rather than trying to restore it.",
      },
    ],
  },
  {
    slug: "hip-airplane",
    name: "Hip Airplane",
    primaryMuscle: "glutes",
    secondaryMuscles: ["obliques"],
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Balance on one leg hinged forward with the other leg extended behind.\nRotate the pelvis open toward the standing side, then closed, keeping the standing foot still.\nControl both directions slowly.",
    bodyEffect:
      "Controlled internal and external rotation of the standing hip while balancing in a hinged single-leg position.\n\nThe glute max and the deep external rotators control the closing rotation, the glute medius and internal rotators control the opening one, and the whole foot and ankle work continuously to keep balance. The trunk resists collapsing toward the floor.\n\nHip rotation under load is what running and cutting demand and what almost nothing in a gym trains, which makes this a genuinely useful addition for athletes. It is a control exercise — balance limits it long before the muscles do.",
    alternatives: [
      {
        slug: "single-leg-romanian-deadlift",
        note: "Trains the same hinged single-leg position with real load, but resists rotation rather than producing it.",
      },
      {
        slug: "cable-hip-abduction",
        note: "Loads the lateral hip directly with a stack, though without the rotational component.",
      },
      {
        slug: "band-lateral-walk",
        note: "Trains the same abductors and rotators with far less balance demand, in a standing position.",
      },
    ],
  },
  {
    slug: "ankle-dorsiflexion-mobilisation",
    name: "Ankle Mobilisation",
    primaryMuscle: "calves",
    equipment: "bodyweight",
    trackingType: "reps",
    instructions:
      "Half-kneel with the front foot flat and a hand's width from a wall.\nDrive the knee forward over the toes without letting the heel lift.\nHold briefly at end range and repeat, moving the foot back as it improves.",
    bodyEffect:
      "A loaded stretch of the ankle into dorsiflexion, with bodyweight driving the shin forward over a fixed foot.\n\nThe calf muscles and the Achilles tendon lengthen, and the joint capsule at the front of the ankle is mobilised. Because the heel stays down, the movement has to come from the joint rather than from lifting off.\n\nAnkle dorsiflexion is the most common limit on squat depth, and improving it changes the squat more than any cue does. It is mobility work — it changes available range, not strength, and the gain only holds if it is used under load afterwards.",
    alternatives: [
      {
        slug: "cyclist-squat",
        note: "Works around a limited ankle by raising the heels rather than trying to change the range.",
      },
      {
        slug: "tibialis-raise",
        note: "Strengthens the muscle that produces dorsiflexion rather than stretching the tissue that limits it.",
      },
      {
        slug: "single-leg-calf-raise",
        note: "Loads the same calf tissue through a full range under bodyweight, which maintains range as well as building strength.",
      },
    ],
  },
  {
    slug: "hip-flexor-stretch",
    name: "Half-Kneeling Hip Flexor Stretch",
    primaryMuscle: "quads",
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Half-kneel with the back knee down and the front foot flat.\nSqueeze the back glute and tuck the pelvis under, then lean forward slightly.\nHold and breathe; do not arch the lower back.",
    bodyEffect:
      "A stretch of the front of the hip on the kneeling side, with the pelvis actively tucked so the length is taken at the hip rather than the lower back.\n\nIliopsoas and rectus femoris are lengthened across the hip while the glute on the same side contracts to hold the pelvic tuck. That active contraction is what stops the stretch being felt as a lumbar arch instead.\n\nTight hip flexors limit hip extension in squatting, hinging and running, and this is the most reliable way to address it. Without the glute squeeze it becomes a lower-back extension and achieves nothing at the hip.",
    alternatives: [
      {
        slug: "reverse-nordic-curl",
        note: "Loads the same hip flexors and rectus femoris in a stretched position, which builds strength as well as range.",
      },
      {
        slug: "glute-bridge",
        note: "Trains hip extension actively rather than stretching passively, which is often the better route to the same result.",
      },
      {
        slug: "bulgarian-split-squat",
        note: "Puts the rear hip flexor under a loaded stretch inside a full leg exercise.",
      },
    ],
  },
  {
    slug: "thoracic-extension-foam-roller",
    name: "Thoracic Extension (Foam Roller)",
    primaryMuscle: "back",
    equipment: "other",
    trackingType: "reps",
    instructions:
      "Lie back over a foam roller placed across the upper back, hands behind the head.\nExtend gently over the roller, keeping the ribs from flaring.\nMove the roller a few centimetres and repeat up the mid back.",
    bodyEffect:
      "A segmental extension of the mid back over a fixed fulcrum, with the roller providing the pivot the thoracic spine lacks when lying flat.\n\nThe thoracic vertebrae and the joints where the ribs attach are mobilised into extension, while the abs work to stop the movement escaping into the lumbar spine. The muscles themselves are being lengthened rather than loaded.\n\nA stiff thoracic spine limits overhead reaching, front-rack positions and bar placement in the squat, and this is the standard way to address it. It is mobility work only — the range gained needs loading afterwards to stick.",
    alternatives: [
      {
        slug: "wall-slide",
        note: "Trains the overhead position actively with shoulder-blade control, which converts new range into usable movement.",
      },
      {
        slug: "prone-y-raise",
        note: "Strengthens the lower traps and thoracic extensors that hold an upright position rather than stretching into it.",
      },
      {
        slug: "face-pull",
        note: "Loads the upper-back muscles that oppose a rounded thoracic posture, with real resistance.",
      },
    ],
  },
  {
    slug: "calf-stretch-wall",
    name: "Standing Calf Stretch",
    primaryMuscle: "calves",
    equipment: "bodyweight",
    trackingType: "time",
    instructions:
      "Place both hands on a wall with one leg back and the heel down.\nStraighten the back knee to stretch the upper calf, then bend it slightly for the lower calf.\nHold each position and breathe.",
    bodyEffect:
      "A sustained stretch of the calf complex, with the knee position determining which of its two muscles is lengthened.\n\nWith the knee straight, gastrocnemius — which crosses the knee — is stretched; bending the knee slackens it and shifts the stretch onto soleus underneath. The Achilles tendon is loaded in both positions.\n\nCovering both positions is what makes the stretch worth doing, since most people only ever do the straight-knee version. It changes available ankle range rather than building anything, so it complements loaded calf work rather than replacing it.",
    alternatives: [
      {
        slug: "ankle-dorsiflexion-mobilisation",
        note: "Drives the same range actively with bodyweight over a fixed foot, which tends to transfer to squatting better.",
      },
      {
        slug: "single-leg-calf-raise",
        note: "Loads the calf through its full range under bodyweight, which maintains length while building strength.",
      },
      {
        slug: "tibialis-raise",
        note: "Strengthens the opposing muscle at the front of the shin, addressing the same joint from the other side.",
      },
    ],
  },
];

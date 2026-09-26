// Trigger lexicon for the clinical context engine.
//
// The trigger/scope approach follows the published NegEx (Chapman et al., 2001) and
// ConText (Harkema et al., 2009) algorithms. The phrase lists below were written for this
// project; no third-party lexicon file was copied. Every entry is English.
//
// Entry fields:
//   p      phrase (spaces match any whitespace) or RegExp source when `re` is true
//   cat    assertion | experiencer | temporality | med_status | allergy | pseudo
//   v      value set on entities in scope (allergy: 'present' | 'absent')
//   dir    'pre' (applies forward), 'post' (applies backward) or 'both'
//   types  entity types the entry applies to (default: all)
//   variant 'misspelling' for tolerated spelling errors (reported in evidence)
//   re     true when `p` is a RegExp source rather than a phrase

const PROBLEM_TYPES = ['problem', 'procedure'];
const MED = ['medication'];

const e = (cat, v, dir, phrases, extra = {}) => phrases.map(p => ({ cat, v, dir, p, ...extra }));

export const TRIGGERS = [
  // Pseudo-triggers: consume text that would otherwise look like a trigger.
  ...e('pseudo', null, 'pre', [
    'no change', 'no significant change', 'no interval change', 'no increase', 'no decrease', 'not only',
    'no further', 'without difficulty', 'gram negative', 'gram-negative', 'not necessarily', 'not certain whether',
    'history of present illness', 'hpi', 'history and physical', 'h&p', 'history taking', 'clinical history',
    'social history', 'mother reports', 'father reports', 'mother states', 'father states', 'family reports',
    'per mother', 'per father', 'per family', 'mother at bedside', 'father at bedside', 'family at bedside',
    'accompanied by his mother', 'accompanied by her mother', 'accompanied by his father', 'accompanied by her father',
    'according to his mother', 'according to her mother', 'according to the family', 'discussed with family',
    'discussed with the family', 'no longer'
  ]),

  // Assertion: absent
  ...e('assertion', 'absent', 'pre', [
    'no', 'not', 'denies', 'denied', 'denying', 'deny', 'without', 'negative for', 'neg for', 'free of',
    'absence of', 'no evidence of', 'no signs of', 'no sign of', 'no symptoms of', 'no history of', 'no h/o',
    'no hx of', 'no hx', 'never had', 'never developed', 'does not have', "doesn't have", 'did not have',
    'not have', 'not taking', 'not on', 'denies taking', 'ruled out for', 'rules out', 'no known'
  ]),
  ...e('assertion', 'absent', 'post', [
    'ruled out', 'was ruled out', 'is ruled out', 'has been ruled out', 'have been ruled out', 'were ruled out',
    'excluded', 'was excluded', 'has been excluded', 'is negative', 'was negative', 'negative', 'absent',
    'not seen', 'not present', 'not found', 'not detected', 'resolved and absent', 'denied', 'is denied',
    'was denied', 'denied by patient', 'denied by the patient'
  ]),

  // Assertion: possible (uncertain). "not ruled out" etc. are longer than "ruled out" and win.
  ...e('assertion', 'possible', 'pre', [
    'possible', 'possibly', 'probable', 'probably', 'likely', 'suspected', 'suspect', 'suspicious for',
    'suspicion of', 'suspicion for', 'concern for', 'concerning for', 'question of', 'questionable', 'may have',
    'might have', 'could be', 'could have', 'may be', 'rule out', 'to rule out', 'r/o', 'cannot rule out',
    'can not rule out', 'cannot exclude', 'differential diagnosis', 'differential includes', 'ddx', 'not certain if'
  ]),
  ...e('assertion', 'possible', 'pre', ['consider', 'considering', 'to exclude', 'to evaluate for', 'evaluate for',
    'workup for', 'work-up for'], { types: PROBLEM_TYPES }),
  ...e('assertion', 'possible', 'post', [
    'suspected', 'is suspected', 'unlikely', 'is unlikely', 'is possible', 'possible', 'likely', 'is likely',
    'cannot be ruled out', 'can not be ruled out', 'could not be ruled out', 'not ruled out', 'not excluded',
    'cannot be excluded', 'not yet ruled out'
  ]),
  ...e('assertion', 'possible', 'both', ['versus', 'vs', 'vs.']),

  // Assertion: conditional (hypothetical)
  ...e('assertion', 'conditional', 'pre', [
    'if', 'return if', 'come back if', 'in case of', 'should he develop', 'should she develop',
    'should the patient develop', 'should patient develop', 'should there be', 'watch for', 'monitor for',
    'warning signs of', 'at risk for', 'at risk of', 'risk of', 'to prevent', 'prophylaxis against'
  ], { types: PROBLEM_TYPES }),

  // Experiencer
  ...e('experiencer', 'family', 'pre', [
    'mother', 'father', 'mom', 'dad', 'brother', 'brothers', 'sister', 'sisters', 'sibling', 'siblings', 'son',
    'daughter', 'grandmother', 'grandfather', 'grandparent', 'grandparents', 'aunt', 'uncle', 'cousin', 'parent',
    'parents', 'maternal', 'paternal', 'family history of', 'family hx of', 'family history significant for',
    'family history positive for', 'fhx', 'fhx of', 'fh of', 'family member', 'family members'
  ]),
  ...e('experiencer', 'family', 'post', [
    'in his mother', 'in her mother', 'in his father', 'in her father', "in the patient's mother",
    "in the patient's father", 'in the family', 'runs in the family', 'in family', 'in his brother',
    'in her brother', 'in his sister', 'in her sister'
  ]),
  ...e('experiencer', 'other', 'pre', [
    'wife', 'husband', 'spouse', 'partner', 'friend', 'roommate', 'coworker', 'co-worker', 'sick contact',
    'sick contacts', 'neighbor', 'neighbour'
  ]),

  // Temporality
  ...e('temporality', 'historical', 'pre', [
    'history of', 'h/o', 'hx of', 'hx', 'past medical history', 'past history of', 'pmh', 'previous',
    'previously', 'prior', 'prior history of', 'remote history of', 's/p', 'status post', 'in the past',
    'childhood'
    // "old" is deliberately absent: "45 year old man with diabetes" is not a past diagnosis.
  ], { types: PROBLEM_TYPES }),
  ...e('temporality', 'historical', 'post', [
    'years ago', 'months ago', 'resolved', 'in the past', 'last year'
  ], { types: PROBLEM_TYPES }),
  // No year trigger: "diabetes since 2015" or "diagnosed in 2015" is usually an ongoing condition.
  ...e('temporality', 'future', 'pre', [
    'will', 'plan to', 'planned', 'planning to', 'scheduled for', 'to be scheduled for', 'going to',
    'booked for', 'due for', 'referred for'
  ], { types: PROBLEM_TYPES }),
  ...e('temporality', 'future', 'post', ['planned', 'is planned', 'scheduled', 'is scheduled'], { types: PROBLEM_TYPES }),

  // Medication status
  ...e('med_status', 'current', 'pre', [
    'is on', 'currently on', 'currently taking', 'remains on', 'maintained on', 'continue', 'continues',
    'continued on', 'continuing', 'continue on', 'taking', 'takes', 'started on', 'was started on',
    'on treatment with', 'receiving', 'uses', 'using', 'switched to', 'changed to', 'controlled on',
    'well controlled on', 'managed on', 'stable on'
  ], { types: MED }),
  ...e('med_status', 'current', 'post', ['continued', 'ongoing', 'to continue'], { types: MED }),
  ...e('med_status', 'discontinued', 'both', [
    'discontinue', 'discontinued', 'discontinuing', 'stop', 'stopped', 'stopping', 'd/c', "d/c'd", "dc'd",
    'dced', 'd/ced', 'hold', 'held', 'holding', 'ceased', 'cease', 'withdrawn', 'withdraw'
  ], { types: MED }),
  ...e('med_status', 'discontinued', 'pre', ['off', 'no longer taking', 'no longer on', 'stopped taking', 'stop taking',
    'stopping taking', 'quit taking', 'discontinued taking', 'ceased taking'], { types: MED }),
  ...e('med_status', 'discontinued', 'both', ['quit', 'quitted'], { types: MED }),
  ...e('med_status', 'discontinued', 'post', [
    'was discontinued', 'has been discontinued', 'was stopped', 'has been stopped', "was d/c'd", 'was d/c',
    'was held', 'on hold', 'is on hold'
  ], { types: MED }),
  ...e('med_status', 'discontinued', 'both', [
    'discontinud', 'discontiued', 'discontined', 'discontinuted', 'discountinued', 'stoped'
  ], { types: MED, variant: 'misspelling' }),
  ...e('med_status', 'proposed', 'pre', [
    'start', 'starting', 'initiate', 'initiating', 'begin', 'plan to start', 'plan to begin', 'will start',
    'will begin', 'to start', 'consider', 'consider starting', 'recommend', 'recommended', 'suggest',
    'may benefit from', 'trial of', 'switch to', 'add', 'considering', 'considering starting'
  ], { types: MED }),
  ...e('med_status', 'historical', 'pre', [
    'previously on', 'was on', 'used to take', 'formerly on', 'previously took', 'prior use of',
    'history of taking', 'had been on', 'past use of'
  ], { types: MED }),

  // Allergy (applies to medication entities; turns them into allergy records)
  ...e('allergy', 'present', 'pre', [
    'allergic to', 'allergy to', 'allergies to', 'allergic reaction to', 'hypersensitivity to', 'anaphylaxis to',
    'intolerance to', 'intolerant to', 'reaction to'
  ], { types: MED }),
  ...e('allergy', 'present', 'post', ['allergy', 'allergic', 'allergies', 'hypersensitivity'], { types: MED }),
  ...e('allergy', 'absent', 'pre', [
    'not allergic to', 'no allergy to', 'no allergies to', 'no known allergy to', 'no known allergies to',
    'denies allergy to', 'denies allergies to', 'no hypersensitivity to'
  ], { types: MED })
];

// Words that end a trigger's scope, by category. A trigger of the same category also ends it.
const COMMON_TERMINATORS = [
  'but', 'however', 'although', 'though', 'yet', 'except', 'aside from', 'apart from', 'whereas', 'which',
  'cause of', 'etiology of', 'source of', 'secondary to'
];
export const TERMINATORS = {
  assertion: [...COMMON_TERMINATORS, 'reports', 'reported', 'complains of', 'c/o', 'presents with',
    'presented with', 'positive for', 'admits to', 'has', 'have', 'had'],
  experiencer: [...COMMON_TERMINATORS, 'patient', 'pt', 'the patient', 'he', 'she', 'himself', 'herself'],
  temporality: [...COMMON_TERMINATORS, 'currently', 'now', 'today', 'presents', 'presented', 'c/o',
    'complains of', 'at present', 'this admission', 'on admission'],
  med_status: [...COMMON_TERMINATORS],
  allergy: [...COMMON_TERMINATORS, 'takes', 'taking', 'on', 'prescribed', 'continue']
};

// Scope limits in words.
export const WINDOW = { pre: 12, post: 8, allergyPre: 8, bothBackward: 6 };

// Section headers ("Family History:") and the defaults they set inside their section.
export const SECTIONS = [
  { kind: 'family', set: { experiencer: 'family' },
    names: ['family history', 'family medical history', 'family hx', 'fhx', 'fh'] },
  { kind: 'past_history', set: { temporality: 'historical' },
    names: ['past medical history', 'past surgical history', 'past history', 'medical history', 'pmh', 'psh'] },
  { kind: 'past_medications', set: { med_status: 'historical' },
    names: ['past medications', 'previous medications', 'prior medications'] },
  { kind: 'medications', set: { med_status: 'current' },
    names: ['current medications', 'home medications', 'active medications', 'discharge medications',
      'medication list', 'medications', 'current meds', 'home meds', 'meds'] },
  { kind: 'allergies', set: { allergy: 'present' }, names: ['drug allergies', 'allergies', 'allergy'] },
  { kind: 'plan', set: { med_status: 'proposed' }, names: ['plan'] },
  { kind: 'differential', set: { assertion: 'possible' },
    names: ['differential diagnosis', 'differential diagnoses', 'differentials', 'differential', 'ddx'] },
  // Recognised so their contents get no default
  { kind: 'neutral', set: {},
    names: ['history of present illness', 'hpi', 'chief complaint', 'cc', 'assessment', 'impression',
      'examination', 'social history'] }
];

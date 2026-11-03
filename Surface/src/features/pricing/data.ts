export const pricingFilters = [
  { id: 'all', label: 'All options' },
  { id: 'single', label: 'One statement' },
  { id: 'cycle', label: 'Application cycle' },
  { id: 'human', label: 'Human review' },
] as const

export type PricingFilter = (typeof pricingFilters)[number]['id']

export const pricingPlans = [
  {
    id: 'free',
    group: 'single',
    eyebrow: 'Start here',
    title: 'Free assessment',
    description: 'Identify the biggest issue, one genuine strength, and whether the statement needs rebuilding or refinement.',
    price: '$0',
    payment: 'No account required',
    features: [
      'Central issue and priority fixes',
      'One clear strength to preserve',
      'Rebuild or refine recommendation',
      'Voice and originality cues',
    ],
    action: 'Start free assessment',
  },
  {
    id: 'complete',
    group: 'single',
    eyebrow: 'One complete report',
    title: 'Complete assessment',
    description: 'A full diagnostic plus one revised-draft check, saved securely to your customer account.',
    price: '$29',
    payment: 'One-time payment',
    features: [
      'Complete criterion-based report',
      'Sentence and paragraph analysis',
      'Evidence and prompt coverage maps',
      'One revision check after your first report',
      'Reopen both reports from any device',
    ],
    action: 'Unlock report + revision check',
  },
  {
    id: 'cycle',
    group: 'cycle',
    eyebrow: 'For an active application season',
    title: 'Application cycle access',
    description: 'Five complete reports over 60 days, with report history and secure access across devices.',
    price: '$99',
    payment: 'Five assessment credits',
    features: [
      'Five saved complete assessments',
      'Draft and program-specific revisions',
      'Credit and expiry tracking',
      'Every report stored in your dashboard',
    ],
    action: 'Choose cycle access',
  },
  {
    id: 'expert',
    group: 'human',
    eyebrow: 'Automated depth plus expert judgment',
    title: 'Cycle plus human review',
    description: 'Five assessments and one detailed strategic, structural, and line-level human review.',
    price: '$249',
    payment: 'One-time payment',
    features: [
      'Everything in cycle access',
      'One detailed human statement review',
      'Program positioning and evidence review',
      'Submission workspace and status tracking',
    ],
    action: 'Add human review',
  },
] as const

export const comparisonDetails = [
  { label: 'Secure access', detail: 'Phone, tablet, laptop, and desktop' },
  { label: 'Payment', detail: 'One-time Stripe checkout' },
  { label: 'Ownership', detail: 'Your statement remains yours' },
  { label: 'Account', detail: 'Email and password sign-in' },
] as const

export const choiceGuide = [
  { situation: 'One statement, one deadline', recommendation: 'Choose the $29 complete assessment.' },
  { situation: 'Several schools or repeated revisions', recommendation: 'Choose the $99 application cycle.' },
  { situation: 'High-stakes submission requiring direct review', recommendation: 'Choose the $249 human review package.' },
] as const

export const checkoutPlans = {
  complete: {
    title: 'Complete statement assessment',
    price: '$29',
    description: 'Unlock the full criterion-referenced report plus one revised-draft check.',
    includes: [
      'Complete scorecard with reasons for every rating',
      'Sentence-level diagnosis and revision direction',
      'Prompt, evidence, paragraph, and voice analysis',
      'One revised-draft reassessment after your first report',
    ],
  },
  cycle: {
    title: 'Application cycle access',
    price: '$99',
    description: 'Review and compare multiple drafts across a focused application period.',
    includes: [
      'Five complete assessments over 60 days',
      'Draft comparison and report history',
      'Program and prompt fit checks',
      'Revision progress across every dimension',
    ],
  },
  expert: {
    title: 'Application cycle + human review',
    price: '$249',
    description: 'Combine the full Statement Studio system with one detailed strategic and line-level human review.',
    includes: [
      'Everything in application cycle access',
      'One detailed human review',
      'Strategic positioning and evidence strengthening',
      'Line-level recommendations and final quality control',
    ],
  },
} as const

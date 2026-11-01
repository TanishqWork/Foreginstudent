export const pathways = [
  { id: 'health', index: 'A', title: 'Public health and health sciences', description: 'MPH, DrPH, MHA, nursing, epidemiology, biomedical sciences, and related degrees' },
  { id: 'business', index: 'B', title: 'Business and leadership', description: 'MBA, MPH and MBA, healthcare management, executive, and leadership programs' },
  { id: 'stem', index: 'C', title: 'STEM and research', description: 'Engineering, computer science, data science, biological sciences, and research degrees' },
  { id: 'policy', index: 'D', title: 'Policy and interdisciplinary programs', description: 'MPP, MPA, international affairs, development, education, and combined degrees' },
] as const

export const reviewSteps = [
  { title: 'Select the specialist pathway', description: 'The assessment begins with the degree, field, institution, prompt, and review objective.' },
  { title: 'Submit the statement and exact prompt', description: 'Prompt coverage and word limit compliance are assessed alongside the writing itself.' },
  { title: 'Receive a structured assessment', description: 'The report identifies strengths, risks, evidence gaps, paragraph issues, and revision priorities.' },
  { title: 'Compare the next draft or request expert review', description: 'Applicants can assess progress or add human judgment for final strategic and editorial work.' },
] as const

export const testimonials = [
  { name: 'Dr. Cornelius Nomeshi', role: 'Harvard MPH alum', quote: 'Dr. Banda’s expertise transformed my application strategy, from refining my personal statement to choosing programs, recommenders, and funding options.', schools: ['Harvard', 'Columbia', 'Johns Hopkins'] },
  { name: 'Dr. Elorm Adom', role: 'STEM MPH/MBA alum, Johns Hopkins', quote: 'His mentorship strengthened every part of my application, from strategy to storytelling.', schools: ['Harvard', 'Yale', 'Johns Hopkins', 'Columbia'] },
] as const

export const applicantStories = [
  { name: 'Dr. Sharon Karbo', role: 'STEM MPH/MBA graduate', quote: 'I was accepted to Columbia, UPenn, Brown, and Johns Hopkins, all with generous scholarships.' },
  { name: 'Dr. Ama Essuman', role: 'MPH/MBA candidate and Sommer Scholar', quote: 'Dr. Banda helped me assess my fit and understand the Sommer Scholarship. I am now an MPH/MBA student and Sommer Scholar at Johns Hopkins.' },
  { name: 'Emmanuel Animashaun', role: 'STEM MPH/MBA alum', quote: 'Every piece of guidance was spot on. I was admitted to Johns Hopkins, Yale, and Harvard with generous scholarships.' },
] as const

export const plans = [
  { id: 'free', title: 'Free assessment', description: 'Biggest issue, genuine strength, priority fixes, and rebuild or refine recommendation', action: 'Start free assessment', price: '$0' },
  { id: 'complete', title: 'Complete statement assessment', description: 'Complete report, sentence analysis, evidence map, paragraph review, and one revised-draft check', action: 'Unlock the report + revision check', price: '$29' },
  { id: 'cycle', title: 'Application cycle access', description: 'Five assessments over 60 days, draft comparison, program fit checks, and report history', action: 'Choose cycle access', price: '$99' },
  { id: 'expert', title: 'Application cycle + human review', description: 'Everything in cycle access plus one detailed strategic and line-level human review', action: 'Add human review', price: '$249' },
] as const

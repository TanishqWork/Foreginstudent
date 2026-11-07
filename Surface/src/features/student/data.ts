export interface StudentProfile {
  name: string
  discipline: string
  level: string
  goals: string[]
  onboarded: boolean
}

export interface Essay {
  id: string
  title: string
  subject: string
  type: string
  status: 'draft' | 'reviewed' | 'complete'
  targetWords: number
  prompt: string
  content: string
  updatedAt: string
  createdAt: string
  feedbackScore?: number
}

export const sampleEssay = `Urban green spaces are often described as the lungs of a city. Yet their value extends beyond environmental protection. For international students adapting to a new academic and cultural environment, accessible parks can also support social connection and psychological well-being. This essay argues that universities should treat access to urban green space as part of student support, while recognising that access alone does not guarantee equitable benefits.

One important benefit is the opportunity for restoration. Moving to a new country can introduce unfamiliar expectations, financial pressures, and language barriers. A nearby park provides a setting in which students can pause from these demands without needing to spend money. Hartig et al. (2014) review several pathways through which contact with nature may support health, including stress reduction and social cohesion. However, this wider evidence should not be treated as proof that every student will experience the same outcome.

Green spaces may also create opportunities for belonging. Unlike formal university events, a shared outdoor space allows participation on different terms: a student might join a walking group, study with a friend, or simply become familiar with the neighbourhood. These activities can support relationships beyond the classroom. The strength of this argument depends on distinguishing the availability of a space from the social conditions that make it welcoming.

There are, nevertheless, limits to a policy focused only on proximity. A park may be physically close but difficult to reach safely, inaccessible to a student with a disability, or uncomfortable after dark. Cultural expectations and competing demands on time can also influence use. Universities should therefore consult students before deciding which activities or spaces would be most helpful.

In conclusion, urban green space can contribute to a more supportive university experience when it is understood as a resource for restoration and connection. Universities can make this contribution more equitable through accessible routes, low-pressure activities, and student-led consultation. These measures complement, rather than replace, appropriate academic and mental-health support.`

const sampleDate = '2026-11-05T11:30:00.000Z'
export const initialEssays: Essay[] = [
  { id: 'urban-green-spaces', title: 'The role of green spaces in student well-being', subject: 'Environmental studies', type: 'Argumentative essay', status: 'draft', targetWords: 1500, prompt: 'Evaluate how urban green spaces can support university students. Develop an argument supported by research, and consider the limits of your position.', content: sampleEssay, createdAt: '2026-11-02T08:00:00.000Z', updatedAt: sampleDate },
  { id: 'digital-belonging', title: 'Finding belonging in a digital classroom', subject: 'Education', type: 'Reflective essay', status: 'reviewed', targetWords: 1000, prompt: 'Reflect on a learning experience and connect your observations with a relevant educational concept.', content: 'When I joined my first online seminar, I understood the reading but hesitated to contribute. I was translating my thoughts while the conversation moved ahead. This experience made me question whether participation should be measured only by how often a student speaks.\n\nOver time, written discussion prompts gave me space to develop my response. I learned that my hesitation did not mean I lacked ideas; it reflected the conditions in which I was being asked to share them.\n\nIn future group work, I will suggest a short period of individual reflection before discussion. This small change could create more than one way for classmates to contribute.', createdAt: '2026-10-28T09:00:00.000Z', updatedAt: '2026-11-04T14:15:00.000Z' },
  { id: 'sustainable-campuses', title: 'What makes a sustainable campus?', subject: 'Sustainability', type: 'Discussion essay', status: 'complete', targetWords: 1200, prompt: 'Discuss different approaches to campus sustainability and explain their implications.', content: 'A sustainable campus requires more than efficient buildings. Decisions about transport, food, procurement, and student participation all shape its environmental impact. This discussion considers how these approaches can work together.\n\nTechnical improvements can reduce energy demand, while meaningful participation helps the university understand how its policies affect everyday behaviour. A useful strategy combines measurable changes with opportunities for students and staff to contribute.\n\nThe most effective approach is therefore an ongoing process of measurement, consultation, and revision, rather than a single project with a fixed endpoint.', createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-30T16:00:00.000Z' },
]

export const countWords = (text: string) => text.trim() ? (text.trim().match(/\S+/gu)?.length ?? 0) : 0

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}

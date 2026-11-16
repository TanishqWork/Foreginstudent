// Presentation-only options and fictional examples from the supplied handoff.
export type PathwayId = 'health' | 'business' | 'stem' | 'policy'

export interface AssessmentPathway {
  id: PathwayId
  index: string
  title: string
  description: string
  fieldLabel: string
  fieldPlaceholder: string
  degrees: string[]
  goals: { value: string; label: string }[]
}

export interface StatementType {
  value: string
  label: string
  focus: string
}

export const assessmentPathways: AssessmentPathway[] = [
  {
    "id": "health",
    "index": "A",
    "title": "Public health and health sciences",
    "description": "MPH, DrPH, MHA, nursing, biomedical sciences",
    "fieldLabel": "Public health or health science field",
    "fieldPlaceholder": "Epidemiology",
    "degrees": [
      "MPH",
      "DrPH",
      "PhD",
      "MS",
      "MSc",
      "MHA",
      "Nursing graduate program",
      "Biomedical sciences",
      "Pharmaceutical sciences",
      "MPH/MBA",
      "Other"
    ],
    "goals": [
      {
        "value": "first_draft",
        "label": "First draft"
      },
      {
        "value": "near_final",
        "label": "Near final draft"
      },
      {
        "value": "program_fit",
        "label": "Program fit"
      },
      {
        "value": "clarity",
        "label": "Clarity"
      },
      {
        "value": "scholarship_readiness",
        "label": "Scholarship readiness"
      },
      {
        "value": "leadership",
        "label": "Leadership narrative"
      }
    ]
  },
  {
    "id": "business",
    "index": "B",
    "title": "Business and leadership",
    "description": "MBA, MPH and MBA, management, executive programs",
    "fieldLabel": "Industry or leadership field",
    "fieldPlaceholder": "Healthcare management",
    "degrees": [
      "MBA",
      "MPH/MBA",
      "Executive program",
      "Healthcare management",
      "Management",
      "Entrepreneurship",
      "Leadership program",
      "Other"
    ],
    "goals": [
      {
        "value": "first_draft",
        "label": "First draft"
      },
      {
        "value": "near_final",
        "label": "Near final draft"
      },
      {
        "value": "leadership",
        "label": "Leadership narrative"
      },
      {
        "value": "program_fit",
        "label": "School fit"
      },
      {
        "value": "career",
        "label": "Career progression"
      },
      {
        "value": "combined",
        "label": "Combined degree coherence"
      }
    ]
  },
  {
    "id": "stem",
    "index": "C",
    "title": "STEM and research",
    "description": "Engineering, data science, computer science, research MS and PhD",
    "fieldLabel": "Technical or research field",
    "fieldPlaceholder": "Data science",
    "degrees": [
      "PhD",
      "Research MS",
      "MSc",
      "MEng",
      "Engineering",
      "Computer science",
      "Data science",
      "Artificial intelligence",
      "Biological sciences",
      "Environmental sciences",
      "Other"
    ],
    "goals": [
      {
        "value": "first_draft",
        "label": "First draft"
      },
      {
        "value": "near_final",
        "label": "Near final draft"
      },
      {
        "value": "research_fit",
        "label": "Research fit"
      },
      {
        "value": "program_fit",
        "label": "Faculty and program fit"
      },
      {
        "value": "clarity",
        "label": "Clarity"
      },
      {
        "value": "technical",
        "label": "Technical preparation"
      }
    ]
  },
  {
    "id": "policy",
    "index": "D",
    "title": "Policy and interdisciplinary programs",
    "description": "MPP, MPA, international affairs, development, education",
    "fieldLabel": "Policy or interdisciplinary field",
    "fieldPlaceholder": "Health policy",
    "degrees": [
      "MPP",
      "MPA",
      "International affairs",
      "International development",
      "Education",
      "Public policy",
      "Combined degree",
      "Other"
    ],
    "goals": [
      {
        "value": "first_draft",
        "label": "First draft"
      },
      {
        "value": "near_final",
        "label": "Near final draft"
      },
      {
        "value": "program_fit",
        "label": "Program fit"
      },
      {
        "value": "policy",
        "label": "Policy problem definition"
      },
      {
        "value": "leadership",
        "label": "Leadership narrative"
      },
      {
        "value": "scholarship_readiness",
        "label": "Scholarship readiness"
      }
    ]
  }
]

export const statementTypes: StatementType[] = [
  {
    "value": "statement_of_purpose",
    "label": "Statement of purpose",
    "focus": "Preparation, degree rationale, goals, and program fit"
  },
  {
    "value": "personal_statement",
    "label": "Personal statement",
    "focus": "Motivation, growth, perspective, and professional direction"
  },
  {
    "value": "personal_history",
    "label": "Personal history or diversity statement",
    "focus": "Context, barriers, perspective, contribution, and inclusion"
  },
  {
    "value": "research_statement",
    "label": "Research statement",
    "focus": "Research direction, methods, scholarly preparation, and faculty fit"
  },
  {
    "value": "scholarship_essay",
    "label": "Scholarship or fellowship essay",
    "focus": "Leadership, impact, mission alignment, and future contribution"
  },
  {
    "value": "leadership_essay",
    "label": "Leadership essay",
    "focus": "Challenge, decisions, team leadership, measurable impact, and reflection"
  },
  {
    "value": "career_goals",
    "label": "Career goals essay",
    "focus": "Career direction, preparation, why now, and degree logic"
  },
  {
    "value": "combined_degree",
    "label": "Combined degree statement",
    "focus": "Why both degrees, integration, career logic, and combined fit"
  },
  {
    "value": "motivation_letter",
    "label": "Motivation letter",
    "focus": "Motivation, preparation, fit, contribution, and future direction"
  },
  {
    "value": "supplemental_essay",
    "label": "Supplemental essay",
    "focus": "Direct response to the specific prompt and institutional context"
  },
  {
    "value": "other",
    "label": "Other statement type",
    "focus": "Prompt alignment, clarity, evidence, and fit"
  }
]

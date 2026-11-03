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

export interface AssessmentSample {
  id: string
  label: string
  pathway: PathwayId
  degree: string
  field: string
  institution: string
  program: string
  wordLimit: number
  reviewGoal: string
  statementType: string
  prompt: string
  statement: string
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

export const assessmentSamples: AssessmentSample[] = [
  {
    "id": "mphmba",
    "label": "MPH and MBA",
    "pathway": "business",
    "degree": "MPH/MBA",
    "field": "Health systems and healthcare management",
    "institution": "Johns Hopkins University",
    "program": "MPH and MBA dual degree",
    "wordLimit": 800,
    "reviewGoal": "combined",
    "statementType": "combined_degree",
    "prompt": "Describe your professional goals, why you are pursuing both the MPH and MBA, and how the combined degree will prepare you to lead change in health systems.",
    "statement": "During a vaccine delivery project in northern Ghana, I watched a technically sound public health plan fail because operational decisions were fragmented. Twelve rural communities had missed scheduled outreach for two consecutive weeks. As a health delivery adviser, I led a six person district team to analyze weekly coverage data, map delayed routes, and review cold chain and transport constraints. We redesigned the dispatch schedule, assigned clear decision rights, and introduced a weekly operations review. Within eight weeks, the district reduced missed settlements by 38 percent, restored regular outreach across all twelve communities, and vaccinated more than 18,000 children.\n\nThe project changed how I understood health leadership. Epidemiologic evidence could define who was being missed, but delivery depended on financing, supply chain management, team performance, negotiation, and accountability. I later managed a broader implementation portfolio with a budget of approximately $250,000, coordinated district health teams and nonprofit partners, and trained 42 frontline health workers on performance review. These responsibilities strengthened my ability to lead under pressure, but they also exposed gaps in my preparation. I could assess the health problem and recommend interventions, yet I lacked formal training in organizational strategy, managerial finance, and operations at scale.\n\nMy public health training has prepared me to evaluate disease burden, interpret quantitative evidence, and design programs for population impact. I have conducted statistical analysis using R, supported survey design, and used implementation data to compare performance across districts. This preparation allows me to ask which populations are being missed, why delivery differs across settings, and whether an intervention is producing equitable results. The MPH will deepen my training in health systems, program evaluation, and policy analysis so that I can design strategies that are technically credible and responsive to population needs.\n\nThe MBA is equally necessary. My career goal is to lead health delivery organizations that can allocate resources, manage multidisciplinary teams, build sustainable partnerships, and make disciplined decisions under uncertainty. The MBA will give me the finance, operations, and organizational leadership skills I still lack. The combined degree is not a collection of two credentials. It is the training required to connect population evidence with institutional execution. The MPH will help me determine what should be done and how impact should be measured. The MBA will prepare me to build the organization, financing model, and operating system required to deliver it.\n\nI am drawn to this program because the curriculum combines courses in health systems, operations, finance, and strategy with an applied practicum. I am also interested in faculty and research centers whose work on health financing, implementation, and organizational performance aligns with my goal of improving delivery in low resource settings. The opportunity to learn with public health practitioners and business leaders would help me test solutions from both perspectives. I would contribute experience from clinical practice, outbreak response, policy advising, quantitative analysis, and implementation across government and nonprofit settings.\n\nAfter completing the degree, I plan to lead regional health delivery initiatives and scale operating models that improve emergency preparedness, vaccination, and essential health services. In the long term, my objective is to build an organization that helps governments translate policy into reliable delivery systems. I want to leave the program able to connect evidence with execution, public purpose with financial discipline, and health goals with accountable management."
  },
  {
    "id": "mph",
    "label": "MPH",
    "pathway": "health",
    "degree": "MPH",
    "field": "Epidemiology and global health",
    "institution": "Columbia University",
    "program": "Master of public health",
    "wordLimit": 750,
    "reviewGoal": "program_fit",
    "statementType": "statement_of_purpose",
    "prompt": "Describe your preparation for public health study, your goals, and why this program is the right fit.",
    "statement": "In the district hospital where I worked as a medical officer, patients often arrived after preventable complications had become emergencies. Treating the immediate illness was necessary, but it did not answer why the same conditions continued to affect the same communities. That question moved my attention from individual care to population health.\n\nI began supporting a local review of maternal referrals and helped the clinical team classify delays in recognition, transport, and facility response. I cleaned routine records, worked with nurses to verify incomplete entries, and presented the findings during a district quality meeting. The review showed that transport delays and inconsistent referral communication were common among the most serious cases. The district team used the findings to revise its referral call process and introduce a weekly review of emergency transfers.\n\nThis experience taught me that public health improvement requires reliable data, implementation discipline, and trust across professional groups. It also exposed gaps in my preparation. I want stronger training in epidemiologic methods, program evaluation, and health systems research so that I can assess interventions with greater rigor and design studies that support policy decisions.\n\nThe MPH will prepare me to work at the intersection of surveillance, implementation research, and health system performance. I am drawn to a program that combines quantitative training with practical field engagement and a strong global health community. I hope to contribute clinical experience, knowledge of district health delivery, and a commitment to collaborative problem solving.\n\nMy long term goal is to lead applied research and policy programs that improve emergency and routine health services in low resource settings. I want to build evidence that is methodologically sound, operationally useful, and responsive to the communities it is intended to serve."
  },
  {
    "id": "phd",
    "label": "STEM PhD",
    "pathway": "stem",
    "degree": "PhD",
    "field": "Computer science and machine learning",
    "institution": "University of Cambridge",
    "program": "PhD in computer science",
    "wordLimit": 1000,
    "reviewGoal": "research_fit",
    "statementType": "research_statement",
    "prompt": "Describe your research preparation, proposed area of study, and reasons for applying to this department.",
    "statement": "My research interest is the design of reliable machine learning systems for clinical decision support under data shift. I became interested in this problem while building a risk classification model from hospital records collected across three sites. The model performed well during internal validation but deteriorated when tested at a hospital with different documentation practices and patient characteristics.\n\nFor my master’s thesis, I compared calibration and discrimination across temporal and geographic validation sets. I implemented gradient boosted trees and regularized logistic regression, evaluated subgroup performance, and used bootstrap confidence intervals to quantify uncertainty. The analysis showed that changes in missingness patterns explained part of the performance loss, while differences in disease prevalence affected calibration. This work resulted in a first author conference paper and a reproducible analysis package.\n\nI then joined a research group studying robust learning from heterogeneous health data. My role included data preprocessing, experiment design, error analysis, and evaluation of domain generalization methods. I was particularly interested in cases where average performance concealed poor results for smaller patient groups. These projects strengthened my preparation in statistical learning, Python, causal reasoning, and responsible evaluation.\n\nFor doctoral study, I want to investigate methods that combine uncertainty estimation, transportability, and subgroup aware evaluation for clinical prediction. I am interested in how models can signal when deployment conditions differ from training conditions, and how evaluation can better reflect the decisions clinicians must make. The department’s work in machine learning, health data, and trustworthy artificial intelligence offers a strong setting for this research.\n\nI hope to work with faculty studying robust machine learning and clinical applications, while contributing experience in applied evaluation across hospital settings. My long term goal is to lead research that makes clinical machine learning systems more reliable, transparent, and useful across diverse health systems."
  },
  {
    "id": "mpp",
    "label": "MPP",
    "pathway": "policy",
    "degree": "MPP",
    "field": "Public policy and international development",
    "institution": "University of Oxford",
    "program": "Master of public policy",
    "wordLimit": 800,
    "reviewGoal": "policy",
    "statementType": "statement_of_purpose",
    "prompt": "Describe a policy problem you want to address and how the program will prepare you to contribute.",
    "statement": "During an outbreak response assignment, I saw national guidance reach district teams after critical operational decisions had already been made. The policy itself was technically sound, yet the implementation system was too slow to support local action. This gap between policy design and delivery is the problem I want to address.\n\nI later supported an emergency preparedness review across several regions. I interviewed district managers, compared readiness plans, and analyzed recurring delays in information flow, procurement, and coordination. The review found that many districts had formal plans but lacked clear authority, routine financing, and practical mechanisms for joint decision making. I helped translate the findings into recommendations for simplified reporting and clearer operational responsibilities.\n\nThese experiences have prepared me to understand health policy from the perspective of frontline institutions. They have also shown me the need for stronger training in political economy, public finance, policy analysis, and implementation. Technical evidence alone does not explain why institutions act, why reforms stall, or how limited resources should be allocated.\n\nI want to use the MPP to study how governments can build emergency systems that are accountable during routine periods and responsive during crises. The program’s emphasis on economics, evidence, and public leadership would strengthen my ability to assess policy choices and work across ministries, partners, and local governments.\n\nAfter the degree, I plan to advise governments and regional institutions on preparedness financing and implementation. My goal is to help create policies that can be executed under real constraints, measured against public outcomes, and improved through transparent learning."
  }
]

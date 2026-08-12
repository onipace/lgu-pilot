export const WORKSHOP_SESSION = {
  program: "eSANGGUNI",
  module: "Module 1",
  title: "Smart Legislation: AI for Local Government",
  poweredBy: "eSANGGUNI â€” AI for Local Government",
};

export const MODULE_CONFIG = {
  ella: {
    id: "ella" as const,
    name: "E.L.L.A.",
    fullName: "Legal Researcher",
    workshopSubtopic:
      "AI for RA 7160 Compliance and Analysis",
    tagline: "AI-powered legal research over 2,643 documents",
    description:
      "Query the complete R.A. 7160 (Local Government Code), its IRR, DILG Opinions, SC Jurisprudence, and all 349 Pitogo Municipal Ordinances. Get cited, grounded answers in seconds.",
    accentColor: "hsl(239 76% 64%)",
    accentClass: "ella",
    borderClass: "border-[hsl(239_76%_64%/0.4)]",
    badgeClass: "bg-[hsl(239_76%_64%/0.15)] text-[hsl(239_76%_80%)] border-[hsl(239_76%_64%/0.3)]",
    buttonClass:
      "bg-[hsl(239_76%_64%)] hover:bg-[hsl(239_76%_56%)] text-white",
    href: "/ella",
    samplePrompts: [
      {
        label: "Municipal tax powers",
        prompt:
          "What are the limitations on municipal taxation under RA 7160?",
      },
      {
        label: "Kapangyarihan ng Sangguniang Bayan",
        prompt:
          "Ano ang mga kapangyarihan ng Sangguniang Bayan ayon sa Seksyon 447?",
      },
      {
        label: "Valid ordinance requirements",
        prompt:
          "What are the requirements for a valid ordinance under RA 7160?",
      },
      {
        label: "Kapangyarihan ng Alkalde",
        prompt:
          "Paano tinutukoy ng Seksyon 444 ang mga kapangyarihan ng Alkalde ng Munisipalidad?",
      },
      {
        label: "DILG opinions on LGU powers",
        prompt:
          "What DILG opinions address the scope of LGU regulatory powers?",
      },
      {
        label: "Mga ordinansa ng Pitogo",
        prompt:
          "Ano ang mga pangunahing ordinansa ng Munisipalidad ng Pitogo na may kaugnayan sa negosyo at kabuhayan?",
      },
      {
        label: "SC jurisprudence on LGUs",
        prompt:
          "What SC jurisprudence cases define the limits of local government taxing authority?",
      },
      {
        label: "Proseso ng pagpasa ng ordinansa",
        prompt:
          "Ano ang tamang proseso para makapasa ng ordinansa ang Sangguniang Bayan?",
      },
      {
        label: "Municipal budget process",
        prompt:
          "Explain the budget process for a municipality under RA 7160",
      },
      {
        label: "Karapatan ng mga barangay",
        prompt:
          "Ano ang mga karapatan at tungkulin ng mga barangay ayon sa Local Government Code?",
      },
    ],
    explainerSteps: [
      {
        step: 1,
        title: "Ask a Legal Question",
        description:
          "Type any question about R.A. 7160, local government powers, or Pitogo ordinances in plain English or Filipino.",
      },
      {
        step: 2,
        title: "RAG Document Retrieval",
        description:
          "E.L.L.A. searches 2,643 documents using BM25 full-text search + a LightRAG knowledge graph to find the most relevant sections.",
      },
      {
        step: 3,
        title: "AI-Synthesized Answer",
        description:
          "The AI synthesizes a grounded, cited response. Every legal claim is backed by a specific section number.",
      },
      {
        step: 4,
        title: "Review Citations",
        description:
          "The citations panel on the right shows every section referenced — click any to drill down.",
      },
    ],
    knowledgeBase: { ra7160: 532, ordinances: 349, irr: 39, dilg_opinions: 1562, jurisprudence: 161, total: 2643 },
  },

  obra: {
    id: "obra" as const,
    name: "O.B.R.A.",
    fullName: "Ordinance Builder",
    workshopSubtopic: "AI for Ordinance Drafting and Review",
    tagline: "Draft compliant ordinances with AI guidance",
    description:
      "Generate properly structured Philippine municipal ordinances from templates. Includes automatic RA 7160 compliance review with risk scoring.",
    accentColor: "hsl(158 64% 45%)",
    accentClass: "obra",
    borderClass: "border-[hsl(158_64%_45%/0.4)]",
    badgeClass: "bg-[hsl(158_64%_45%/0.15)] text-[hsl(158_64%_70%)] border-[hsl(158_64%_45%/0.3)]",
    buttonClass:
      "bg-[hsl(158_64%_45%)] hover:bg-[hsl(158_64%_37%)] text-white",
    href: "/obra",
    samplePrompts: [
      {
        label: "Market Fee Ordinance",
        prompt:
          "Draft a Market Fee Ordinance for Pitogo market vendors",
      },
      {
        label: "Solid Waste Ordinance",
        prompt:
          "Draft a Solid Waste Management ordinance referencing RA 9003",
      },
      {
        label: "Review existing draft",
        prompt:
          "Paste an existing ordinance draft and check its compliance score",
      },
    ],
    explainerSteps: [
      {
        step: 1,
        title: "Choose a Template",
        description:
          "Select from Tax, Regulatory, Appropriation, or General ordinance templates — each pre-structured for compliance.",
      },
      {
        step: 2,
        title: "Fill in the Details",
        description:
          "Provide the title, subject matter, key provisions, and target area. The AI uses these to customize the draft.",
      },
      {
        step: 3,
        title: "Generate Your Draft",
        description:
          "O.B.R.A. generates a fully formatted ordinance with WHEREAS clauses, BODY, Penal Provisions, and Effectivity Clause.",
      },
      {
        step: 4,
        title: "Review Compliance",
        description:
          "Get an RA 7160 compliance score (0–100), risk flags, and structural issue recommendations.",
      },
    ],
    knowledgeBase: { ra7160: 532, ordinances: 349, irr: 39, dilg_opinions: 1562, jurisprudence: 161, total: 2643 },
  },

  yala: {
    id: "yala" as const,
    name: "Y.A.L.A.",
    fullName: "AI Assistant",
    workshopSubtopic:
      "AI for Legislative Queries",
    tagline: "AI constituent chat for Pitogo LGU services",
    description:
      "A friendly AI assistant that answers questions about Pitogo LGU services, local ordinances, and legislative processes — in English or Filipino.",
    accentColor: "hsl(38 95% 55%)",
    accentClass: "yala",
    borderClass: "border-[hsl(38_95%_55%/0.4)]",
    badgeClass: "bg-[hsl(38_95%_55%/0.15)] text-[hsl(38_95%_75%)] border-[hsl(38_95%_55%/0.3)]",
    buttonClass:
      "bg-[hsl(38_95%_55%)] hover:bg-[hsl(38_95%_47%)] text-[hsl(222_47%_9%)] font-semibold",
    href: "/yala",
    samplePrompts: [
      {
        label: "Business permit",
        prompt: "Paano mag-apply ng business permit sa Pitogo?",
      },
      {
        label: "Tax ordinances",
        prompt: "What are the tax ordinances affecting market vendors?",
      },
      {
        label: "Barangay clearance",
        prompt: "Ano ang proseso para makakuha ng barangay clearance?",
      },
      {
        label: "Construction permits",
        prompt: "What local fees apply to construction permits?",
      },
      {
        label: "Sanggunian process",
        prompt: "Paano nagpapasa ng resolusyon ang Sangguniang Bayan?",
      },
      {
        label: "Mga ordinansa sa kalinisan",
        prompt: "Ano ang mga ordinansa ng Pitogo tungkol sa kalinisan at kalikasan?",
      },
      {
        label: "Real property tax",
        prompt: "How is real property tax computed for residential land in Pitogo?",
      },
      {
        label: "Pagtatala ng negosyo",
        prompt: "Magkano ang bayad para sa pagtatala ng bagong negosyo sa munisipyo?",
      },
    ],
    explainerSteps: [
      {
        step: 1,
        title: "Ask in Any Language",
        description:
          "Y.A.L.A. understands English and Filipino. Ask about permits, fees, ordinances, or any Pitogo LGU service.",
      },
      {
        step: 2,
        title: "Knowledge-Grounded Replies",
        description:
          "Answers are grounded in the actual Pitogo ordinance database — not generic internet content.",
      },
      {
        step: 3,
        title: "Constituent-Friendly Tone",
        description:
          "Y.A.L.A. communicates in plain language, the way a helpful LGU officer would — not in dense legalese.",
      },
      {
        step: 4,
        title: "Workshop Demo Mode",
        description:
          "In this workshop, use Y.A.L.A. to simulate constituent interactions. Try the sample prompts on the left.",
      },
    ],
    knowledgeBase: { ra7160: 532, ordinances: 349, irr: 39, dilg_opinions: 1562, jurisprudence: 161, total: 2643 },
  },

  likha: {
    id: "likha" as const,
    name: "L.I.K.H.A.",
    fullName: "Archive Digitizer",
    workshopSubtopic: "AI for Ordinance Digitization & Archiving",
    tagline: "From paper scans to searchable archive in minutes",
    description:
      "Batch-upload ordinance PDFs and scans. AI extracts text via OCR, parses metadata, classifies subjects, and publishes to a BM25-searchable archive — with mandatory human review at every legal gate.",
    accentColor: "hsl(14 87% 55%)",
    accentClass: "likha",
    borderClass: "border-[hsl(14_87%_55%/0.4)]",
    badgeClass: "bg-[hsl(14_87%_55%/0.15)] text-[hsl(14_87%_75%)] border-[hsl(14_87%_55%/0.3)]",
    buttonClass:
      "bg-[hsl(14_87%_55%)] hover:bg-[hsl(14_87%_47%)] text-white",
    href: "/likha",
    samplePrompts: [],
    explainerSteps: [],
    knowledgeBase: { ra7160: 0, ordinances: 0, irr: 0, dilg_opinions: 0, jurisprudence: 0, total: 0 },
  },

  linaw: {
    id: "linaw" as const,
    name: "L.I.N.A.W.",
    fullName: "Ordinance Codifier",
    workshopSubtopic: "AI for Ordinance Codification",
    tagline: "Cross-reference, detect conflicts, assemble codified volumes",
    description:
      "Import ordinances via JSON, scan, or manual entry. AI classifies into code titles, detects cross-references and contradictions, and assembles codified volumes — with HITL approval at every legal decision.",
    accentColor: "hsl(199 89% 48%)",
    accentClass: "linaw",
    borderClass: "border-[hsl(199_89%_48%/0.4)]",
    badgeClass: "bg-[hsl(199_89%_48%/0.15)] text-[hsl(199_89%_75%)] border-[hsl(199_89%_48%/0.3)]",
    buttonClass:
      "bg-[hsl(199_89%_48%)] hover:bg-[hsl(199_89%_40%)] text-white",
    href: "/linaw",
    samplePrompts: [],
    explainerSteps: [],
    knowledgeBase: { ra7160: 0, ordinances: 0, irr: 0, dilg_opinions: 0, jurisprudence: 0, total: 0 },
  },
} as const;

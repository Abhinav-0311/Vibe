export type ArchitectureStressStatus = "resilient" | "watch" | "at-risk";

export type ArchitectureStressAssessment = {
  id: "schema" | "security" | "portability" | "cost" | "recovery" | "stability";
  title: string;
  status: ArchitectureStressStatus;
  summary: string;
  evidence: string[];
  actions: string[];
};

export type ArchitectureStressResult = {
  score: number;
  label: "Resilient" | "Needs review" | "At risk";
  assessments: ArchitectureStressAssessment[];
  disclaimer: string;
};

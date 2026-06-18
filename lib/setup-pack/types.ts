export type SetupArtifactKind = "rules" | "memory" | "session" | "integration";

export type SetupArtifact = {
  id: string;
  path: string;
  title: string;
  description: string;
  kind: SetupArtifactKind;
  content: string;
};

export type SetupPack = {
  version: 1;
  projectName: string;
  summary: string;
  artifacts: SetupArtifact[];
};

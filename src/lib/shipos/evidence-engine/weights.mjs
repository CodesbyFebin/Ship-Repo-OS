/** Proposed ShipOS Engineering Index weights from the V3 product direction. Not a measured production score. */
export const ENGINEERING_INDEX_VERSION = "1.0.0";

export const ENGINEERING_INDEX_WEIGHTS = Object.freeze({
  security_supply_chain: 20,
  code_quality_maintainability: 15,
  testing_reliability: 15,
  cicd_release: 12,
  documentation_dx: 10,
  performance_accessibility: 10,
  github_discoverability: 8,
  community_governance: 5,
  reproducibility_provenance: 5,
});

export const ENGINEERING_INDEX_DIMENSIONS = Object.freeze([
  { id: "security_supply_chain", name: "Security & supply chain", weight: 20 },
  { id: "code_quality_maintainability", name: "Code quality & maintainability", weight: 15 },
  { id: "testing_reliability", name: "Testing & reliability", weight: 15 },
  { id: "cicd_release", name: "CI/CD & release engineering", weight: 12 },
  { id: "documentation_dx", name: "Documentation & DX", weight: 10 },
  { id: "performance_accessibility", name: "Performance & accessibility", weight: 10 },
  { id: "github_discoverability", name: "GitHub discoverability", weight: 8 },
  { id: "community_governance", name: "Community & governance", weight: 5 },
  { id: "reproducibility_provenance", name: "Reproducibility & provenance", weight: 5 },
]);

export const ACCEPTANCE_GATES = Object.freeze([
  { id: "G0", title: "Repository and live URL validated" },
  { id: "G1", title: "Feature map traceable to source files" },
  { id: "G2", title: "Storyboard conforms to schema" },
  { id: "G3", title: "Every captured scene has a source URL and capture manifest" },
  { id: "G4", title: "Video and audio render successfully" },
  { id: "G5", title: "Captions align with narration" },
  { id: "G6", title: "Artifact hashes verify" },
  { id: "G7", title: "Verification receipt validates" },
  { id: "G8", title: "Unauthorized publishing is rejected" },
]);

import { createSkillsService } from "./skills-service";
import type { SkillsService } from "./skills-types";

let service: SkillsService | undefined;

export function getDefaultSkillsService(): SkillsService {
  if (!service) {
    service = createSkillsService();
    void service.load();
  }

  return service;
}

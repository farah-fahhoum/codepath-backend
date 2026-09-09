export interface Roadmap {
  id: number;
  title: string;
  description?: string;
  skillLevel: string;
  targetSkillLevelId?: number;
  modulesCount?: number;
  duration?: number;
  createdAt: Date;
}

export interface RoadmapWithModules extends Roadmap {
  targetSkillLevelId: number;
  pathModules: PathModule[];
}

export interface PathModule {
  id: number;
  learningPathId: number;
  title: string;
  description: string;
  estimatedHours?: number;
  moduleOrder?: number;
  topicId?: number;
  learningObjectives?: any;
  successCriteria?: any;
  createdAt: Date;
  updatedAt: Date;
  moduleResources: ModuleResource[];
  moduleProblems: ModuleProblem[];
  topic?: Topic;
}

export interface ModuleResource {
  id: number;
  pathModuleId: number;
  resourceType: string;
  title: string;
  description?: string;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModuleProblem {
  id: number;
  pathModuleId: number;
  externalProblemId: string;
  platform: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Topic {
  id: number;
  title: string;
  tags?: string;
  rating?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

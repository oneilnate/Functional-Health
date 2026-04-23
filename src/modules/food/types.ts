/**
 * Food Pod Prototype — mobile-side type definitions.
 * Matches the API contract from the Drizzle schema (api/drizzle/schema.ts)
 * and the spec in art_1byWlV0c.
 */

export type PodStatus = 'draft' | 'generating' | 'ready' | 'failed';
export type MealStatus = 'pending_upload' | 'uploaded' | 'analyzed';
export type PipelineStage = 'vision' | 'grounding' | 'script' | 'tts' | 'upload';
export type StageState = 'pending' | 'running' | 'complete' | 'failed';

export type StageStatus = Partial<
  Record<
    PipelineStage,
    {
      status: StageState;
      startedAt?: string;
      completedAt?: string;
      error?: string;
    }
  >
>;

export type Meal = {
  id: string;
  podId: string;
  status: MealStatus;
  imageUrl?: string;
  capturedAt?: string;
};

export type GroundedFacts = {
  aggregate: Record<string, number>;
  targets: Record<string, number>;
  gaps: {
    nutrient: string;
    delta: number;
    severity: 'primary' | 'secondary' | 'tertiary';
  }[];
  patterns: string[];
};

export type Pod = {
  id: string;
  userId: string;
  status: PodStatus;
  timespanDays: number;
  mealsCount: number;
  mealsList: Meal[];
  stageStatus: StageStatus;
  createdAt: string;
  completedAt?: string;
  groundedFacts?: GroundedFacts;
};

export type TranscriptSegment = {
  startSec: number;
  endSec: number;
  text: string;
  emphasisWords: string[];
};

export type Podcast = {
  transcript: {
    segments: TranscriptSegment[];
    totalDurationSec: number;
    title: string;
  };
  audioUrl: string;
};

/** Shape returned by POST /api/pods/:podId/meals */
export type CreateMealResponse = {
  mealId: string;
  uploadUrl: string;
  storagePath: string;
};

export type FastingStage = {
  hour: number;
  label: string;
  emoji: string;
  description: string;
  color: string;
};

export type FastingMilestone = {
  hour: number;
  label: string;
  color: string;
};

export const FASTING_STAGES: FastingStage[] = [
  {
    hour: 0,
    label: "Getting started",
    emoji: "◐",
    description: "Your fast has started. Use this first stretch to settle in and ease into the window you chose.",
    color: "#6366f1",
  },
  {
    hour: 2,
    label: "Post-meal transition",
    emoji: "◔",
    description: "Early hunger can come and go here. Hydrate, keep your pace steady, and check in with how you feel.",
    color: "#818cf8",
  },
  {
    hour: 4,
    label: "Fat burning warm-up",
    emoji: "○",
    description: "This is a common point for cravings or distraction. Pause, reset, and stick to the plan that feels reasonable for you.",
    color: "#a78bfa",
  },
  {
    hour: 6,
    label: "Fat burning",
    emoji: "◑",
    description: "You’re moving deeper into the window. Keep the rest of your day calm, practical, and well hydrated.",
    color: "#34d399",
  },
  {
    hour: 8,
    label: "Glycogen dipping",
    emoji: "◕",
    description: "Many people use this range as a steady fasting rhythm. Focus on consistency, not stretching the clock.",
    color: "#f59e0b",
  },
  {
    hour: 10,
    label: "Glycogen depleted",
    emoji: "✦",
    description: "Stay attentive to energy, mood, and routine. Your goal is a repeatable habit, not an all-out push.",
    color: "#f97316",
  },
  {
    hour: 12,
    label: "Ketosis building",
    emoji: "⬢",
    description: "This is where many planned windows land. Finish strong if this matches your schedule and comfort level.",
    color: "#ef4444",
  },
  {
    hour: 14,
    label: "Ketosis",
    emoji: "△",
    description: "Pause and reassess. If this goes beyond your normal plan, make sure the session still feels appropriate.",
    color: "#ec4899",
  },
  {
    hour: 16,
    label: "Autophagy window",
    emoji: "◆",
    description: "A common target for structured fasting routines. Consistency at your planned window matters more than going longer.",
    color: "#8b5cf6",
  },
  {
    hour: 18,
    label: "Deep autophagy",
    emoji: "⬡",
    description: "This is FastTrack's cautious upper planning limit. Continue only if it matches your plan and you feel well.",
    color: "#a855f7",
  },
] as const;

export const FASTING_MILESTONES: FastingMilestone[] = [
  { hour: 0, label: "Getting started", color: "#6366f1" },
  { hour: 2, label: "Post-meal transition", color: "#818cf8" },
  { hour: 4, label: "Fat burning warm-up", color: "#a78bfa" },
  { hour: 8, label: "Glycogen dipping", color: "#f59e0b" },
  { hour: 12, label: "Ketosis building", color: "#ef4444" },
  { hour: 16, label: "Autophagy window", color: "#8b5cf6" },
  { hour: 18, label: "Deep autophagy", color: "#a855f7" },
] as const;

export function getCurrentStage(elapsedHours: number) {
  return FASTING_STAGES.reduce((currentStage, stage) => {
    return elapsedHours >= stage.hour ? stage : currentStage;
  }, FASTING_STAGES[0]);
}

export function getCurrentStageIndex(elapsedHours: number) {
  return FASTING_STAGES.findIndex((stage) => stage.hour === getCurrentStage(elapsedHours).hour);
}

export function getCurrentMilestone(elapsedHours: number) {
  return FASTING_MILESTONES.reduce((currentMilestone, milestone) => {
    return elapsedHours >= milestone.hour ? milestone : currentMilestone;
  }, FASTING_MILESTONES[0]);
}

export function getNextMilestone(elapsedHours: number) {
  return FASTING_MILESTONES.find((milestone) => milestone.hour > elapsedHours) ?? null;
}

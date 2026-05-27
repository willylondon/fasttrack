export type FastingStage = {
  hour: number;
  label: string;
  emoji: string;
  description: string;
  color: string;
};

export const FASTING_STAGES: FastingStage[] = [
  {
    hour: 0,
    label: "Fed State",
    emoji: "🌙",
    description: "Digesting, insulin elevated. The fast has begun.",
    color: "#6366f1",
  },
  {
    hour: 2,
    label: "Blood Sugar Drop",
    emoji: "📉",
    description: "Blood glucose stabilising. Early hunger may peak.",
    color: "#818cf8",
  },
  {
    hour: 4,
    label: "Glycogen Depletion",
    emoji: "⏳",
    description: "Burning through stored glycogen. First real hunger wave — push through.",
    color: "#a78bfa",
  },
  {
    hour: 6,
    label: "Mild Ketosis",
    emoji: "⚡",
    description: "Ketone bodies appearing. Energy is shifting fuel sources.",
    color: "#34d399",
  },
  {
    hour: 8,
    label: "Fat-Burning Mode",
    emoji: "🔥",
    description: "Glycogen depleted. Body running on fat. Ketones rising.",
    color: "#f59e0b",
  },
  {
    hour: 10,
    label: "Steady Ketosis",
    emoji: "🧠",
    description: "Mental clarity improving. Appetite fading. You are in the zone.",
    color: "#f97316",
  },
  {
    hour: 12,
    label: "Deep Ketosis",
    emoji: "⚡",
    description: "Brain running on ketones. Strong appetite suppression. Sharp focus.",
    color: "#ef4444",
  },
  {
    hour: 14,
    label: "HGH Rising",
    emoji: "📈",
    description: "Human growth hormone elevated. Muscle preservation active.",
    color: "#ec4899",
  },
  {
    hour: 16,
    label: "Autophagy Begins",
    emoji: "🧬",
    description: "Cellular cleanup started! Damaged proteins being recycled. The sweet spot.",
    color: "#8b5cf6",
  },
  {
    hour: 18,
    label: "Deep Autophagy",
    emoji: "🔬",
    description: "Autophagy intensifying. Cellular repair in overdrive.",
    color: "#a855f7",
  },
  {
    hour: 20,
    label: "Immune Regen",
    emoji: "🛡️",
    description: "Stem cell activation. Immune system renewing old cells.",
    color: "#d946ef",
  },
  {
    hour: 24,
    label: "Full Reset",
    emoji: "🏆",
    description: "BDNF peaking. Neurogenesis active. Major metabolic reset.",
    color: "#f59e0b",
  },
  {
    hour: 36,
    label: "Deep Healing",
    emoji: "🧘",
    description: "Inflammation crushed. Deep repair mode. Profound autophagy.",
    color: "#10b981",
  },
  {
    hour: 48,
    label: "Peak Longevity",
    emoji: "🎯",
    description: "Growth hormone at peak. Maximum regeneration. Elite milestone.",
    color: "#06b6d4",
  },
] as const;

export function getCurrentStage(elapsedHours: number) {
  return FASTING_STAGES.reduce((currentStage, stage) => {
    return elapsedHours >= stage.hour ? stage : currentStage;
  }, FASTING_STAGES[0]);
}

export function getCurrentStageIndex(elapsedHours: number) {
  return FASTING_STAGES.findIndex((stage) => stage.hour === getCurrentStage(elapsedHours).hour);
}

export function xpForNextLevel(level: number) {
  return Math.max(250, level * 250);
}

export function calculateLevel(xp: number) {
  let remainingXp = Math.max(0, xp);
  let level = 1;

  while (remainingXp >= xpForNextLevel(level)) {
    remainingXp -= xpForNextLevel(level);
    level += 1;
  }

  return level;
}

export function xpIntoCurrentLevel(xp: number) {
  let remainingXp = Math.max(0, xp);
  let level = 1;

  while (remainingXp >= xpForNextLevel(level)) {
    remainingXp -= xpForNextLevel(level);
    level += 1;
  }

  return remainingXp;
}

export function streakBonusForXp(currentStreak: number) {
  if (currentStreak >= 30) {
    return 120;
  }

  if (currentStreak >= 14) {
    return 80;
  }

  if (currentStreak >= 7) {
    return 50;
  }

  if (currentStreak >= 3) {
    return 25;
  }

  return 0;
}

export function xpForFasting(durationMinutes: number, stageReached: number, currentStreak: number) {
  const hoursXp = Math.round((Math.max(0, durationMinutes) / 60) * 10);
  const stageXp = Math.max(0, stageReached) * 25;
  const streakXp = streakBonusForXp(currentStreak);

  return hoursXp + stageXp + streakXp;
}

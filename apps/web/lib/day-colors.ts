const DAY_COLORS = [
  { name: "coral", hex: "#FF6B42", tailwind: "border-coral" },
  { name: "blue", hex: "#4A90D9", tailwind: "border-[#4A90D9]" },
  { name: "green", hex: "#6BC96B", tailwind: "border-[#6BC96B]" },
  { name: "purple", hex: "#9B6BD4", tailwind: "border-[#9B6BD4]" },
  { name: "amber", hex: "#D4A26B", tailwind: "border-[#D4A26B]" },
] as const;

export type DayColor = (typeof DAY_COLORS)[number];

export function getDayColor(dayIndex: number): DayColor {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

export { DAY_COLORS };

/**
 * AutonomyDial — PRD §2 (Intent Preview & Autonomy Dial)
 *
 * Slider that controls AI's autonomy level:
 * 0 = Full Manual | 33 = Suggest Only | 66 = Auto + Approval | 100 = Full Auto
 */

import { useUIStore } from "@/store/useUIStore";

const LEVELS = [
  { value: 0, label: "Full Manual", desc: "AI takes no actions", color: "text-muted-foreground" },
  { value: 33, label: "Suggest Only", desc: "AI suggests, you decide", color: "text-blue-400" },
  { value: 66, label: "Auto + Approval", desc: "AI acts, you approve critical", color: "text-amber-400" },
  { value: 100, label: "Full Auto", desc: "AI handles everything", color: "text-emerald-400" },
];

export default function AutonomyDial({ compact = false }) {
  const autonomyLevel = useUIStore((s) => s.autonomyLevel);
  const setAutonomyLevel = useUIStore((s) => s.setAutonomyLevel);

  const currentLevel = LEVELS.reduce((closest, level) =>
    Math.abs(level.value - autonomyLevel) < Math.abs(closest.value - autonomyLevel)
      ? level
      : closest
  );

  const handleChange = (e) => {
    const raw = Number(e.target.value);
    // Snap to nearest level
    const snapped = LEVELS.reduce((closest, level) =>
      Math.abs(level.value - raw) < Math.abs(closest.value - raw) ? level : closest
    );
    setAutonomyLevel(snapped.value);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Autonomy
        </span>
        <span className={`text-xs font-semibold ${currentLevel.color}`}>
          {currentLevel.label}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">AI Autonomy Level</h3>
        <span className={`text-sm font-bold ${currentLevel.color}`}>
          {currentLevel.label}
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={autonomyLevel}
        onChange={handleChange}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-blue-500"
        aria-label="AI Autonomy Level"
      />

      <div className="mt-2 flex justify-between">
        {LEVELS.map((level) => (
          <button
            key={level.value}
            onClick={() => setAutonomyLevel(level.value)}
            className={`text-[10px] transition-colors ${
              currentLevel.value === level.value
                ? level.color + " font-semibold"
                : "text-muted-foreground hover:text-muted-foreground"
            }`}
          >
            {level.label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{currentLevel.desc}</p>
    </div>
  );
}

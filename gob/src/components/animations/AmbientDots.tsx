/**
 * Ambient drifting particles for the hero. Pure CSS animation
 * (transform + opacity only) — no JavaScript required.
 */

const DOTS = [
  { left: "12%", top: "18%", size: 5, duration: "16s", delay: "0s" },
  { left: "85%", top: "22%", size: 3, duration: "20s", delay: "-4s" },
  { left: "70%", top: "12%", size: 4, duration: "17s", delay: "-8s" },
  { left: "90%", top: "58%", size: 3, duration: "22s", delay: "-2s" },
  { left: "8%", top: "64%", size: 4, duration: "19s", delay: "-6s" },
  { left: "45%", top: "8%", size: 3, duration: "21s", delay: "-10s" },
  { left: "25%", top: "82%", size: 5, duration: "18s", delay: "-3s" },
  { left: "65%", top: "78%", size: 3, duration: "23s", delay: "-7s" },
  { left: "93%", top: "84%", size: 4, duration: "16s", delay: "-11s" },
  { left: "50%", top: "38%", size: 3, duration: "20s", delay: "-5s" },
];

export function AmbientDots() {
  return (
    <div className="ambient-dots" aria-hidden="true">
      {DOTS.map((dot, index) => (
        <span
          key={index}
          style={{
            left: dot.left,
            top: dot.top,
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            animationDelay: dot.delay,
            animationDuration: dot.duration,
          }}
        />
      ))}
    </div>
  );
}
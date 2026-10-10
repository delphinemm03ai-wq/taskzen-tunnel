import type { BulletsBlock } from "@/types/funnel";

/** Liste à puces, même pastille mousse que la landing. */
export function Bullets({ block }: { block: BulletsBlock }) {
  return (
    <div style={{ maxWidth: "42rem" }}>
      {block.titre && (
        <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: "1.2rem" }}>{block.titre}</h2>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.7rem" }}>
        {block.items.map((item) => (
          <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem" }}>
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                marginTop: 4,
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "2px solid var(--color-accent)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)" }} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

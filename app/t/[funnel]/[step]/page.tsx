import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockRenderer } from "@/components/funnel/blocks/BlockRenderer";
import { allFunnels, getFunnel } from "@/funnels";

type Params = Promise<{ funnel: string; step: string }>;

// Seules les étapes déclarées dans funnels/ existent : tout autre slug = 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return allFunnels.flatMap((f) => f.etapes.map((e) => ({ funnel: f.slug, step: e.slug })));
}

function findStep(funnelSlug: string, stepSlug: string) {
  const funnel = getFunnel(funnelSlug);
  const step = funnel?.etapes.find((e) => e.slug === stepSlug);
  return funnel && step ? { funnel, step } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { funnel, step } = await params;
  const found = findStep(funnel, step);
  if (!found) return {};
  return {
    title: `${found.step.titre} | ${found.funnel.nom}`,
    description: found.step.metaDescription,
  };
}

export default async function FunnelStepPage({ params }: { params: Params }) {
  const { funnel, step } = await params;
  const found = findStep(funnel, step);
  if (!found) notFound();

  return (
    <main className="paper-grain" style={{ minHeight: "100vh", position: "relative" }}>
      {found.step.blocs.map((block, i) => (
        <section
          key={i}
          data-block={block.type}
          style={{
            background: i % 2 === 1 ? "var(--color-bg-soft)" : "transparent",
            paddingTop: i === 0 ? "5rem" : "3.5rem",
            paddingBottom: "3.5rem",
          }}
        >
          <div className="container-tight">
            <BlockRenderer block={block} />
          </div>
        </section>
      ))}
    </main>
  );
}

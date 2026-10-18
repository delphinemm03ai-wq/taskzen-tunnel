import type { Block } from "@/types/funnel";
import { AcheterBlock } from "./AcheterBlock";
import { Bullets } from "./Bullets";
import { Countdown } from "./Countdown";
import { CtaButton } from "./CtaButton";
import { Faq } from "./Faq";
import { Hero } from "./Hero";
import { ImageBlock } from "./ImageBlock";
import { OptinBlock } from "./OptinBlock";
import { RichText } from "./RichText";
import { TelechargerBlock } from "./TelechargerBlock";
import { Testimonial } from "./Testimonial";
import { VideoEmbed } from "./VideoEmbed";

/**
 * Aiguillage config -> composant. Le `default` reçoit `never` : un type de bloc
 * ajouté à l'union sans branche ici casse la compilation.
 */
export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "hero":
      return <Hero block={block} />;
    case "richText":
      return <RichText block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "video":
      return <VideoEmbed block={block} />;
    case "bullets":
      return <Bullets block={block} />;
    case "faq":
      return <Faq block={block} />;
    case "testimonial":
      return <Testimonial block={block} />;
    case "countdown":
      return <Countdown block={block} />;
    case "cta":
      return <CtaButton block={block} />;
    case "optin":
      return <OptinBlock block={block} />;
    case "acheter":
      return <AcheterBlock block={block} />;
    case "telecharger":
      return <TelechargerBlock block={block} />;
    default: {
      const unhandled: never = block;
      throw new Error(`Type de bloc non géré : ${JSON.stringify(unhandled)}`);
    }
  }
}

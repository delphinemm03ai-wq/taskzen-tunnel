import { TunnelsRoute } from "@/components/editor/EditorRoute";

export const metadata = {
  title: "Tes tunnels | Taskzen Tunnel",
  robots: { index: false, follow: false },
};

export default function TunnelsPage() {
  return <TunnelsRoute />;
}

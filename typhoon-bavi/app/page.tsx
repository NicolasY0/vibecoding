import dynamic from "next/dynamic";

// Leaflet 必须在客户端加载
const Monitor = dynamic(() => import("./Monitor"), { ssr: false });

export default function Page() {
  return <Monitor />;
}

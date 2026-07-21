import type { Metadata } from "next";
import { BatteryView } from "@/features/battery/battery-view";

export const metadata: Metadata = {
  title: "Battery",
  description: "Battery charge, health, and cycle count.",
};

export default function BatteryPage() {
  return <BatteryView />;
}

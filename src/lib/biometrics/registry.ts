import { SimulatedBiometricsSource } from "./simulated-source";
import type { BiometricsSource, SourceCapabilities } from "./types";

export interface SourceDescriptor {
  id: string;
  label: string;
  description: string;
  capabilities: SourceCapabilities;
  /** Absent while a source is only a planned integration. */
  create?: () => BiometricsSource;
}

/**
 * The single place the app learns which physiological sources exist. Shipping a
 * real integration means adding a descriptor with a `create` factory — no UI or
 * state changes required.
 */
export const SOURCE_REGISTRY: SourceDescriptor[] = [
  {
    id: "simulated",
    label: "Demo sensor",
    description: "Synthetic heart rate and HRV that react to the workout. Useful without a strap.",
    capabilities: { heartRate: true, rrIntervals: true, hrv: true, battery: true },
    create: () => new SimulatedBiometricsSource(),
  },
  {
    id: "ble-heart-rate",
    label: "Bluetooth strap",
    description: "Standard BLE heart-rate service with RR intervals, for chest straps and armbands.",
    capabilities: { heartRate: true, rrIntervals: true, hrv: true, battery: true },
  },
  {
    id: "watch-relay",
    label: "Watch relay",
    description: "Live stream from a paired watch or phone app over the network.",
    capabilities: { heartRate: true, rrIntervals: false, hrv: false, battery: false },
  },
];

export function findDescriptor(id: string): SourceDescriptor | undefined {
  return SOURCE_REGISTRY.find((descriptor) => descriptor.id === id);
}

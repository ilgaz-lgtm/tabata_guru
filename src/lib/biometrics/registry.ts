import { SimulatedBiometricsSource } from "./simulated-source";
import {
  WebBluetoothHeartRateSource,
  isWebBluetoothSupported,
} from "./web-bluetooth-source";
import type { BiometricsSource, SourceCapabilities } from "./types";

export interface SourceDescriptor {
  id: string;
  label: string;
  description: string;
  capabilities: SourceCapabilities;
  /** Absent while a source is only a planned integration. */
  create?: () => BiometricsSource;
  /** Secondary connect path that lists every nearby device in the chooser. */
  createUnfiltered?: () => BiometricsSource;
  /** Label for the `createUnfiltered` action. */
  unfilteredLabel?: string;
  /** Runtime support check, evaluated in the browser. */
  isSupported?: () => boolean;
  /** Shown instead of the connect button when `isSupported` is false. */
  unsupportedMessage?: string;
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
    description:
      "Synthetic heart rate and HRV that react to the workout. Useful without a strap.",
    capabilities: {
      heartRate: true,
      rrIntervals: true,
      hrv: true,
      battery: true,
    },
    create: () => new SimulatedBiometricsSource(),
  },
  {
    id: "ble-heart-rate",
    label: "Polar H10 / BLE strap",
    description:
      "Live heart rate and RR intervals over Web Bluetooth, using the standard heart-rate service.",
    capabilities: {
      heartRate: true,
      rrIntervals: true,
      hrv: true,
      battery: true,
    },
    create: () => new WebBluetoothHeartRateSource(),
    createUnfiltered: () =>
      new WebBluetoothHeartRateSource({ acceptAllDevices: true }),
    unfilteredLabel: "Show all devices",
    isSupported: () => isWebBluetoothSupported(),
    unsupportedMessage:
      "Bluetooth heart-rate sensors require a Web Bluetooth compatible browser.",
  },
  {
    id: "watch-relay",
    label: "Watch relay",
    description:
      "Live stream from a paired watch or phone app over the network.",
    capabilities: {
      heartRate: true,
      rrIntervals: false,
      hrv: false,
      battery: false,
    },
  },
];

export function findDescriptor(id: string): SourceDescriptor | undefined {
  return SOURCE_REGISTRY.find((descriptor) => descriptor.id === id);
}

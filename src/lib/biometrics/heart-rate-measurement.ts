/**
 * Parser for the Bluetooth SIG Heart Rate Measurement characteristic (0x2A37).
 * Layout is flag-driven, so nothing here may assume a fixed packet size:
 * Polar H10 emits 8-bit heart rate with RR intervals, other straps use 16-bit
 * heart rate, and RR intervals arrive in batches whenever notifications are
 * slower than the heartbeat.
 */

export interface HeartRateMeasurement {
  bpm: number;
  sensorContactSupported: boolean;
  /** Only meaningful when contact detection is supported. */
  sensorContactDetected?: boolean;
  energyExpendedKj?: number;
  /** RR intervals in whole milliseconds, oldest first. */
  rrIntervals: number[];
}

/** RR intervals are transmitted in units of 1/1024 second. */
export const RR_UNIT_MS = 1000 / 1024;

const FLAG_HR_16_BIT = 0x01;
const FLAG_CONTACT_DETECTED = 0x02;
const FLAG_CONTACT_SUPPORTED = 0x04;
const FLAG_ENERGY_EXPENDED = 0x08;
const FLAG_RR_INTERVALS = 0x10;

export function rrUnitsToMs(units: number): number {
  return Math.round(units * RR_UNIT_MS);
}

export function parseHeartRateMeasurement(data: DataView): HeartRateMeasurement {
  if (data.byteLength < 2) throw new Error("Heart rate measurement packet too short");

  const flags = data.getUint8(0);
  let offset = 1;

  const wide = (flags & FLAG_HR_16_BIT) !== 0;
  const bpm = wide ? data.getUint16(offset, true) : data.getUint8(offset);
  offset += wide ? 2 : 1;

  const sensorContactSupported = (flags & FLAG_CONTACT_SUPPORTED) !== 0;

  let energyExpendedKj: number | undefined;
  if ((flags & FLAG_ENERGY_EXPENDED) !== 0 && offset + 2 <= data.byteLength) {
    energyExpendedKj = data.getUint16(offset, true);
    offset += 2;
  }

  const rrIntervals: number[] = [];
  if ((flags & FLAG_RR_INTERVALS) !== 0) {
    // Trailing bytes are a variable-length list; a truncated tail is ignored
    // rather than throwing, so one malformed packet cannot kill the stream.
    while (offset + 2 <= data.byteLength) {
      rrIntervals.push(rrUnitsToMs(data.getUint16(offset, true)));
      offset += 2;
    }
  }

  return {
    bpm,
    sensorContactSupported,
    ...(sensorContactSupported ? { sensorContactDetected: (flags & FLAG_CONTACT_DETECTED) !== 0 } : {}),
    ...(energyExpendedKj === undefined ? {} : { energyExpendedKj }),
    rrIntervals,
  };
}

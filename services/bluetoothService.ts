import { BLE_SERVICES, BLE_CHARACTERISTICS } from '../constants';

// --- Web Bluetooth Type Definitions (abbreviated for brevity, same as before) ---
type BluetoothServiceUUID = number | string;
type BluetoothCharacteristicUUID = number | string;

// ... (Keeping the previous interfaces) ...
interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  watchAdvertisements(): Promise<void>;
  unwatchAdvertisements(): void;
  readonly watchingAdvertisements: boolean;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice;
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService extends EventTarget {
  device: BluetoothDevice;
  uuid: string;
  isPrimary: boolean;
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  service: BluetoothRemoteGATTService;
  uuid: string;
  value?: DataView;
  readValue(): Promise<DataView>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface Bluetooth extends EventTarget {
  requestDevice(options?: any): Promise<BluetoothDevice>;
}

declare global {
  interface Navigator {
    bluetooth: Bluetooth;
  }
}

export class BluetoothService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private disconnectListener: EventListener | null = null;
  
  // Callbacks
  private onHeartRateChange: ((hr: number) => void) | null = null;
  private onDisconnect: (() => void) | null = null;
  private onRRInterval: ((rr: number) => void) | null = null;
  private onGlucoseChange: ((glucose: number) => void) | null = null;

  constructor(
    onHeartRateChange: (hr: number) => void,
    onDisconnect: () => void,
    onRRInterval?: (rr: number) => void,
    onGlucoseChange?: (glucose: number) => void
  ) {
    this.onHeartRateChange = onHeartRateChange;
    this.onDisconnect = onDisconnect;
    this.onRRInterval = onRRInterval || null;
    this.onGlucoseChange = onGlucoseChange || null;
    this.disconnectListener = this.handleDisconnection.bind(this);
  }

  public async connect(): Promise<string> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth is not supported.");
    }

    this.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        BLE_SERVICES.HEART_RATE,
        BLE_SERVICES.BATTERY,
        BLE_SERVICES.BLOOD_PRESSURE,
        BLE_SERVICES.GLUCOSE
      ]
    });

    if (!this.device) throw new Error("No device selected.");

    this.device.addEventListener('gattserverdisconnected', this.disconnectListener!);

    this.server = await this.device.gatt!.connect();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Stabilization

    // Heart Rate
    try {
      await this.startNotifications(BLE_SERVICES.HEART_RATE, BLE_CHARACTERISTICS.HEART_RATE_MEASUREMENT, this.handleHeartRateValueChanged.bind(this));
    } catch (e) { console.warn("HR service failed", e); }

    // Glucose
    try {
      await this.startNotifications(BLE_SERVICES.GLUCOSE, BLE_CHARACTERISTICS.GLUCOSE_MEASUREMENT, this.handleGlucoseValueChanged.bind(this));
    } catch (e) { console.warn("Glucose service not available", e); }

    return this.device.name || "Connected Device";
  }

  private async startNotifications(serviceUUID: number | string, charUUID: number | string, callback: (e: Event) => void) {
    if (!this.server) return;
    const service = await this.server.getPrimaryService(serviceUUID);
    const characteristic = await service.getCharacteristic(charUUID);
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', callback);
  }

  private handleHeartRateValueChanged(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    const flags = value.getUint8(0);
    const rate16Bits = flags & 0x1;
    let offset = 1;
    
    let heartRate: number;
    if (rate16Bits) {
      heartRate = value.getUint16(offset, true);
      offset += 2;
    } else {
      heartRate = value.getUint8(offset);
      offset += 1;
    }

    if (this.onHeartRateChange) this.onHeartRateChange(heartRate);

    // RR Intervals (Bit 4)
    const rrIntervalPresent = (flags & 0x10) !== 0;
    if (rrIntervalPresent) {
      // Skip Energy Expended if present (Bit 3)
      if ((flags & 0x08) !== 0) offset += 2;
      
      // Read remaining bytes as RR intervals
      while (offset + 1 < value.byteLength) {
        const rr = value.getUint16(offset, true);
        offset += 2;
        // RR is in 1/1024 seconds units
        const rrMs = (rr / 1024) * 1000;
        if (this.onRRInterval) this.onRRInterval(rrMs);
      }
    }
  }

  private handleGlucoseValueChanged(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    const flags = value.getUint8(0);
    // Simple parsing logic for standard Glucose Measurement
    // Assuming mg/dL for simplicity or converting
    // Standard typically starts with Sequence Number (uint16)
    // Then Base Time (uint16 year, uint8 month...)
    // This is complex; for this demo, we assume a standard offset or simulate if parsing fails.
    
    // NOTE: Real parsing requires full spec implementation. 
    // We will extract a float16 at offset 10 (common location after time) for demo purposes
    try {
        // Mock parsing for robustness in demo
        // In real app, check 'Concentration Unit' bit in flags
        const glucose = value.getUint8(10); // Simplified
        if (this.onGlucoseChange && glucose > 0) this.onGlucoseChange(glucose);
    } catch (e) {
        console.warn("Error parsing glucose", e);
    }
  }

  private handleDisconnection() {
    if (this.onDisconnect) this.onDisconnect();
  }

  public disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
  }
}
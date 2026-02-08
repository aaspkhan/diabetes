import { BLE_SERVICES, BLE_CHARACTERISTICS } from '../constants';

// --- Web Bluetooth Type Definitions ---
// Required because standard TypeScript lib.dom.d.ts excludes Web Bluetooth API types.

type BluetoothServiceUUID = number | string;
type BluetoothCharacteristicUUID = number | string;

interface BluetoothRequestDeviceFilter {
  services?: BluetoothServiceUUID[];
  name?: string;
  namePrefix?: string;
  manufacturerData?: { companyIdentifier: number; dataPrefix?: BufferSource; mask?: BufferSource }[];
  serviceData?: { service: BluetoothServiceUUID; dataPrefix?: BufferSource; mask?: BufferSource }[];
}

interface RequestDeviceOptions {
  filters?: BluetoothRequestDeviceFilter[];
  optionalServices?: BluetoothServiceUUID[];
  acceptAllDevices?: boolean;
}

interface BluetoothRemoteGATTDescriptor {
  characteristic: BluetoothRemoteGATTCharacteristic;
  uuid: string;
  value?: DataView;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothCharacteristicProperties {
  broadcast: boolean;
  read: boolean;
  writeWithoutResponse: boolean;
  write: boolean;
  notify: boolean;
  indicate: boolean;
  authenticatedSignedWrites: boolean;
  reliableWrite: boolean;
  writableAuxiliaries: boolean;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  service: BluetoothRemoteGATTService;
  uuid: string;
  properties: BluetoothCharacteristicProperties;
  value?: DataView;
  getDescriptor(descriptor: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTDescriptor>;
  getDescriptors(descriptor?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTDescriptor[]>;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface BluetoothRemoteGATTService extends EventTarget {
  device: BluetoothDevice;
  uuid: string;
  isPrimary: boolean;
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
  getIncludedService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getIncludedServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice;
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

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

interface Bluetooth extends EventTarget {
  getAvailability(): Promise<boolean>;
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}

declare global {
  interface Navigator {
    bluetooth: Bluetooth;
  }
}
// --- End of Web Bluetooth Type Definitions ---

export class BluetoothService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private disconnectListener: EventListener | null = null;
  
  // Callbacks
  private onHeartRateChange: ((hr: number) => void) | null = null;
  private onDisconnect: (() => void) | null = null;

  constructor(
    onHeartRateChange: (hr: number) => void,
    onDisconnect: () => void
  ) {
    this.onHeartRateChange = onHeartRateChange;
    this.onDisconnect = onDisconnect;
    this.disconnectListener = this.handleDisconnection.bind(this);
  }

  public async connect(): Promise<string> {
    try {
      if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth is not supported in this browser. Please use Chrome on Android.");
      }

      console.log('Requesting Bluetooth Device...');
      
      // We use acceptAllDevices to ensure we see all potential watches.
      // We list services in optionalServices to ensure we can access them after connection.
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
            BLE_SERVICES.HEART_RATE, 
            BLE_SERVICES.BATTERY, 
            BLE_SERVICES.BLOOD_PRESSURE,
            "00001800-0000-1000-8000-00805f9b34fb", // Generic Access
            "00001801-0000-1000-8000-00805f9b34fb"  // Generic Attribute
        ]
      });

      if (!this.device) throw new Error("No device selected.");

      if (this.disconnectListener) {
        this.device.removeEventListener('gattserverdisconnected', this.disconnectListener);
        this.device.addEventListener('gattserverdisconnected', this.disconnectListener);
      }

      console.log('Connecting to GATT Server...');
      if (!this.device.gatt) {
        throw new Error("Device does not support GATT connection.");
      }

      this.server = await this.device.gatt.connect();

      if (!this.server) throw new Error("Could not connect to GATT Server.");

      // CRITICAL FIX: Add a delay to allow the Android Bluetooth stack to stabilize
      // the connection before we start bombarding it with service discovery requests.
      // This prevents the "5 second auto-disconnect" issue.
      console.log('Stabilizing connection...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Attempt to read battery as a "Keep Alive" ping if available
      try {
        await this.readBatteryLevel(this.server);
      } catch (e) {
        console.log("Battery service not available or failed to read (non-fatal).");
      }

      // Subscribe to Heart Rate
      try {
        await this.startHeartRateNotifications(this.server);
      } catch (err) {
        console.warn("Could not subscribe to Heart Rate service:", err);
        // Do not throw here; we want to keep the connection alive even if HR fails initially.
      }
      
      return this.device.name || "Connected Device";
    } catch (error) {
      console.error('Connection failed', error);
      // Clean up if initial connection fails
      if (this.device && this.device.gatt?.connected) {
         this.device.gatt.disconnect();
      }
      throw error;
    }
  }

  public disconnect() {
    if (this.device && this.device.gatt?.connected) {
      console.log("User initiated disconnect");
      // Remove listener to prevent triggering the onDisconnect callback for a manual action
      if (this.disconnectListener) {
         this.device.removeEventListener('gattserverdisconnected', this.disconnectListener);
      }
      this.device.gatt.disconnect();
      // Manually trigger cleanup
      if (this.onDisconnect) this.onDisconnect();
    }
  }

  private handleDisconnection() {
    console.log('Device disconnected unexpectedly');
    if (this.onDisconnect) this.onDisconnect();
  }

  private async readBatteryLevel(server: BluetoothRemoteGATTServer) {
      const service = await server.getPrimaryService(BLE_SERVICES.BATTERY);
      const characteristic = await service.getCharacteristic(BLE_CHARACTERISTICS.BATTERY_LEVEL);
      const value = await characteristic.readValue();
      const level = value.getUint8(0);
      console.log(`Initial Battery Level: ${level}%`);
  }

  private async startHeartRateNotifications(server: BluetoothRemoteGATTServer) {
    const service = await server.getPrimaryService(BLE_SERVICES.HEART_RATE);
    const characteristic = await service.getCharacteristic(BLE_CHARACTERISTICS.HEART_RATE_MEASUREMENT);
    
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', this.handleHeartRateValueChanged.bind(this));
    console.log('Heart Rate notifications started');
  }

  private handleHeartRateValueChanged(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    // Parsing the Heart Rate Measurement Value
    const flags = value.getUint8(0);
    const rate16Bits = flags & 0x1;
    let heartRate: number;
    if (rate16Bits) {
      heartRate = value.getUint16(1, true); // Little Endian
    } else {
      heartRate = value.getUint8(1);
    }

    if (this.onHeartRateChange) {
      this.onHeartRateChange(heartRate);
    }
  }
}
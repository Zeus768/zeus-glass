import { Platform, Share, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_DEVICES_KEY = '@zeus_cast_devices';

export interface CastDevice {
  id: string;
  name: string;
  type: 'dlna' | 'chromecast' | 'manual';
  ip: string;
  port: number;
  lastSeen?: string;
}

// DLNA SOAP templates
const DLNA_SET_URI = (url: string, title: string) => `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <CurrentURI>${url}</CurrentURI>
      <CurrentURIMetaData>&lt;DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"&gt;&lt;item&gt;&lt;dc:title&gt;${title}&lt;/dc:title&gt;&lt;upnp:class&gt;object.item.videoItem&lt;/upnp:class&gt;&lt;res protocolInfo="http-get:*:video/mp4:*"&gt;${url}&lt;/res&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;</CurrentURIMetaData>
    </u:SetAVTransportURI>
  </s:Body>
</s:Envelope>`;

const DLNA_PLAY = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Play>
  </s:Body>
</s:Envelope>`;

const DLNA_STOP = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:Stop>
  </s:Body>
</s:Envelope>`;

// Common DLNA renderer control paths
const DLNA_CONTROL_PATHS = [
  '/MediaRenderer/AVTransport/Control',
  '/upnp/control/AVTransport1', 
  '/AVTransport/Control',
  '/dmr/control/AVTransport',
  '/dev/88024a42-a984-fc25-339d-24aaa94a2885/svc/upnp-org/AVTransport/action',
];

export const castService = {
  // Get saved devices
  getSavedDevices: async (): Promise<CastDevice[]> => {
    try {
      const stored = await AsyncStorage.getItem(SAVED_DEVICES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  // Save a device
  saveDevice: async (device: CastDevice) => {
    const devices = await castService.getSavedDevices();
    const existing = devices.findIndex(d => d.id === device.id);
    if (existing >= 0) {
      devices[existing] = { ...device, lastSeen: new Date().toISOString() };
    } else {
      devices.push({ ...device, lastSeen: new Date().toISOString() });
    }
    await AsyncStorage.setItem(SAVED_DEVICES_KEY, JSON.stringify(devices));
  },

  // Remove a device
  removeDevice: async (deviceId: string) => {
    const devices = await castService.getSavedDevices();
    const filtered = devices.filter(d => d.id !== deviceId);
    await AsyncStorage.setItem(SAVED_DEVICES_KEY, JSON.stringify(filtered));
  },

  // Scan local network for DLNA renderers
  // This probes common IPs on the local subnet for DLNA services
  scanForDevices: async (
    onFound: (device: CastDevice) => void,
    onProgress: (scanned: number, total: number) => void
  ): Promise<void> => {
    // Common DLNA ports
    const ports = [8008, 1400, 8060, 49152, 49153, 8080, 7000];
    const subnet = '192.168.1'; // Most common home network
    const ipsToScan = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
    
    let scanned = 0;
    const total = ipsToScan.length;
    
    // Scan in batches of 20
    for (let i = 0; i < ipsToScan.length; i += 20) {
      const batch = ipsToScan.slice(i, i + 20);
      
      await Promise.allSettled(
        batch.map(async (ip) => {
          for (const port of [8008, 1400, 49152]) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 1500);
              
              const response = await fetch(`http://${ip}:${port}/description.xml`, {
                signal: controller.signal,
              });
              clearTimeout(timeout);
              
              if (response.ok) {
                const text = await response.text();
                const nameMatch = text.match(/<friendlyName>(.*?)<\/friendlyName>/);
                const name = nameMatch ? nameMatch[1] : `Device at ${ip}`;
                
                // Check if it has AVTransport (media renderer)
                if (text.includes('AVTransport') || text.includes('MediaRenderer')) {
                  onFound({
                    id: `dlna-${ip}-${port}`,
                    name,
                    type: 'dlna',
                    ip,
                    port,
                  });
                }
              }
            } catch {
              // Device not found at this IP/port, continue
            }
          }
          scanned++;
          onProgress(scanned, total);
        })
      );
    }
  },

  // Cast to DLNA device
  castToDLNA: async (device: CastDevice, videoUrl: string, title: string): Promise<boolean> => {
    // Try each control path until one works
    for (const path of DLNA_CONTROL_PATHS) {
      try {
        const controlUrl = `http://${device.ip}:${device.port}${path}`;
        
        // First, set the video URI
        const setResponse = await fetch(controlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"',
          },
          body: DLNA_SET_URI(videoUrl, title),
        });
        
        if (setResponse.ok || setResponse.status === 200) {
          // Then send Play command
          await fetch(controlUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml; charset="utf-8"',
              'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
            },
            body: DLNA_PLAY,
          });
          
          // Save the device for quick access
          await castService.saveDevice(device);
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  },

  // Stop playback on DLNA device
  stopDLNA: async (device: CastDevice): Promise<void> => {
    for (const path of DLNA_CONTROL_PATHS) {
      try {
        const controlUrl = `http://${device.ip}:${device.port}${path}`;
        await fetch(controlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#Stop"',
          },
          body: DLNA_STOP,
        });
        return;
      } catch {
        continue;
      }
    }
  },

  // Cast via Chromecast (Android intent)
  castToChromecast: async (videoUrl: string): Promise<void> => {
    if (Platform.OS === 'android') {
      // Try to open Google Home app for casting
      const googleHomeUrl = 'googlehome://cast';
      const canOpen = await Linking.canOpenURL(googleHomeUrl);
      
      if (canOpen) {
        await Linking.openURL(googleHomeUrl);
      } else {
        // Fallback: open cast settings
        await Linking.openSettings();
      }
    }
  },

  // Share video URL to external apps (VLC, BubbleUPnP, etc.)
  shareToApp: async (videoUrl: string, title: string): Promise<void> => {
    try {
      await Share.share({
        title: `Zeus Glass: ${title}`,
        message: videoUrl,
        url: Platform.OS === 'ios' ? videoUrl : undefined,
      });
    } catch {
      // User cancelled share
    }
  },
};

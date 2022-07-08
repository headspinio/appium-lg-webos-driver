import { W3CCapabilities } from '@appium/types';

export interface WebOSCapabilities extends W3CCapabilities {
  deviceInfo: Record<string, string>;
}

import log from '../logger';
import {exec} from 'teen_process';
import {system} from 'appium/support';

const ARES_DEVICE = 'ares-device';
const ARES_INSTALL = 'ares-install';
const ARES_LAUNCH = 'ares-launch';
//const ARES_PACKAGE = 'ares-package';

/**
 * Run an Ares related command
 * @param {string} bin - name of ares binary to run
 * @param {string[]} [args] - list of args to apply
 *
 * @returns {Promise<import('teen_process').ExecResult<string>>}
 */
async function runCmd(bin, args = []) {
  log.info(`Running command: ${bin} ${args.join(' ')}`);
  try {
    return await exec(bin, args, {shell: system.isWindows()});
  } catch (err) {
    const e = /** @type {import('teen_process').ExecError} */ (err);
    const stdout = e.stdout?.replace(/[\r\n]+/, ' ');
    const stderr = e.stderr?.replace(/[\r\n]+/, ' ');
    e.message =
      `${e.message}. Stdout was: '${stdout}'. Stderr was: '${stderr}'. ` +
      `Make sure the webOS CLI tools are installed and available in your PATH.`;
    throw e;
  }
}

/**
 * Run an Ares related command that takes an optional --device flag
 *
 * @param {string} bin - name of ares binary to run
 * @param {string} [deviceName] - device name/ID as shown in ares-setup-device
 * @param {string[]} [args] - array of args to apply to command
 *
 * @returns {Promise<import('teen_process').ExecResult<string>>}
 */
async function runDeviceCmd(bin, deviceName, args = []) {
  if (deviceName) {
    args.push('--device', deviceName);
  }
  return await runCmd(bin, args);
}

/**
 * Retrieve info about a device using ares-device
 *
 * @param {string} [deviceName] - device to explicitly get info for, otherwise default
 * @returns {Promise<Record<string, string>>}
 */
export async function getDeviceInfo(deviceName) {
  log.info(`Getting device info for device: ${deviceName || 'default'}`);
  try {
    let {stdout, stderr} = await runDeviceCmd(ARES_DEVICE, deviceName, ['-i']);
    log.debug(`ares-device stdout: ${stdout}`);
    log.debug(`ares-device stderr: ${stderr}`);
    stdout = stdout.trim();
    const dataParseRe = /^(.+?) : (.+)$/gm;
    const matches = stdout.matchAll(dataParseRe);
    const result = [...matches].reduce((acc, m) => {
      const key = m[1].trim();
      const value = m[2].trim();
      // Skip info/log lines that start with brackets
      if (!key.startsWith('[')) {
        acc[key] = value;
      }
      return acc;
    }, /** @type {Record<string,string>} */ ({}));
    log.debug(`Parsed device info: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    log.error(`Failed to get device info: ${error.message}`);
    throw error;
  }
}

/**
 * Launch an installed app by its app id, including params if desired
 *
 * @param {string} appId - the app ID
 * @param {string} [deviceName] - device name to launch an app on
 * @param {import('type-fest').JsonObject} [launchParams] - dictionary of app launch parameters, will be JSON
 * stringified and passed to ares-launch
 */
export async function launchApp(appId, deviceName, launchParams) {
  log.info(`Launching app '${appId}'`);
  const args = [appId];
  if (launchParams) {
    args.push('--params', JSON.stringify(launchParams));
  }
  await runDeviceCmd(ARES_LAUNCH, deviceName, args);
}

/**
 * Close the current app
 * @param {string} appId
 * @param {string} [deviceName] - device name to close current app on
 */
export async function closeApp(appId, deviceName) {
  log.info(`Closing app '${appId}'`);
  await runDeviceCmd(ARES_LAUNCH, deviceName, ['-c', appId]);
}

/**
 * Install an IPK file to the device
 * @param {string} ipkPath - path to .ipk file
 * @param {string} appId - the package ID of the app
 * @param {string} [deviceName] - device name to install app on
 */
export async function installApp(ipkPath, appId, deviceName) {
  log.info(`Installing app '${appId}' from ${ipkPath}`);
  await runDeviceCmd(ARES_INSTALL, deviceName, [ipkPath]);
}

/**
 * Uninstall an app from the device
 * @param {string} appId - the package ID of the app
 * @param {string} [deviceName] - device name to uninstall app on
 */
export async function uninstallApp(appId, deviceName) {
  log.info(`Uninstalling app '${appId}'`);
  await runDeviceCmd(ARES_INSTALL, deviceName, ['-r', appId]);
}

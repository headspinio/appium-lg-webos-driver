import log from '../logger';
import path from 'path';
import { exec } from 'teen_process';
import { fs } from 'appium/support';

const ARES = 'ares';
const ARES_DEVICE_INFO = 'ares-device-info';
const ARES_EXTEND_DEV = 'ares-extend-dev';
const ARES_INSTALL = 'ares-install';
const ARES_LAUNCH = 'ares-launch';
const ARES_PACKAGE = 'ares-package';

const WEBOS_CLI_PATH_PREFIX = ['CLI', 'bin'];
const LG_HOME = process.env.LG_WEBOS_TV_SDK_HOME;

let lgHomeVerified = false;

/**
 * Verify the existence of the LG WebOS CLI tools.
 *
 * @throws Error if the tools can't be verified
 */
async function verifyLgHome() {
  if (LG_HOME) {
    const testPath = path.resolve(LG_HOME, ...WEBOS_CLI_PATH_PREFIX, ARES);
    if (await fs.exists(testPath)) {
      lgHomeVerified = true;
      return;
    }
  }
  throw new Error(`Could not verify the appropriate LG WebOS TV ` +
                  `SDK binaries exist. Ensure the ` +
                  `LG_WEBOS_TV_SDK_HOME environment variable is set ` +
                  `and the CLI dir exists inside of it with accessible ` +
                  `permissions`);
}

/**
 * Run an Ares related command
 * @param string bin - name of ares binary to run
 * @param string[] args - list of args to apply
 *
 * @returns {Promise<import('@types/teen_process').ExecResult<string>>}
 */
async function runCmd(bin, args) {
  if (!lgHomeVerified) {
    await verifyLgHome();
  }
  const _bin = path.resolve(LG_HOME, ...WEBOS_CLI_PATH_PREFIX, bin);
  log.info(`Running command: ${_bin} ${args.join(' ')}`);
  try {
    return await exec(_bin, args);
  } catch (e) {
    const stdout = e.stdout.replace(/[\r\n]+/, ' ');
    const stderr = e.stderr.replace(/[\r\n]+/, ' ');
    e.message = `${e.message}. Stdout was: '${stdout}'. Stderr was: '${stderr}'`;
    throw e;
  }
}

/**
 * Run an Ares related command that takes an optional --device flag
 *
 * @param string bin - name of ares binary to run
 * @param string? deviceName - device name/ID as shown in ares-setup-device
 * @param string[]? args - array of args to apply to command
 *
 * @returns {Promise<import('@types/teen_process').ExecResult<string>>}
 */
async function runDeviceCmd(bin, deviceName = null, args = []) {
  if (deviceName) {
    args.push('--device', deviceName);
  }
  return await runCmd(bin, args);
}

/**
 * Attempt to extend developer mode on the connected device. This will as
 * a side effect cause the developer app to be launched
 *
 * @param deviceName? - device to extend, otherwise whichever is connected
 */
export async function extendDevMode(deviceName = null) {
  log.info(`Extending dev mode on device`);
  await runDeviceCmd(ARES_EXTEND_DEV, deviceName);
}

/**
 * Retrieve info about a device using ares-device-info
 *
 * @param deviceName? - device to explicitly get info for, otherwise default
 *
 * @returns {Promise<Record<string, string>>}
 */
export async function getDeviceInfo(deviceName = null) {
  log.info(`Getting device info`);
  let {stdout} = await runDeviceCmd(ARES_DEVICE_INFO, deviceName);
  stdout = stdout.trim();
  const dataParseRe = /^(.+) : (.+)$/gm;
  const matches = stdout.matchAll(dataParseRe);
  return [...matches].reduce((acc, m) => {
    acc[m[1]] = m[2];
    return acc;
  }, {});
}

/**
 * Launch an installed app by its app id, including params if desired
 *
 * @param string appId - the app ID
 * @param string? deviceName - device name to launch an app on
 * @param {Record<string, any>?} launchParams - dictionary of app launch parameters, will be JSON
 * stringified and passed to ares-launch
 */
export async function launchApp(appId, deviceName = null, launchParams = null) {
  log.info(`Launching app '${appId}'`);
  const args = [appId];
  if (launchParams) {
    args.push('--params', JSON.stringify(launchParams));
  }
  await runDeviceCmd(ARES_LAUNCH, deviceName, args);
}

/**
 * Close the current app
 * @param string? deviceName - device name to close current app on
 */
export async function closeApp(appId, deviceName = null) {
  log.info(`Closing app '${appId}'`);
  await runDeviceCmd(ARES_LAUNCH, deviceName, ['-c', appId]);
}

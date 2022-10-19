import {Env} from '@humanwhocodes/env';
import {fs} from 'appium/support';
import _ from 'lodash';
import path from 'node:path';
import {exec} from 'teen_process';
import log from '../logger';

const ARES_DEVICE_INFO = 'ares-device-info';
const ARES_EXTEND_DEV = 'ares-extend-dev';
const ARES_INSTALL = 'ares-install';
const ARES_LAUNCH = 'ares-launch';
//const ARES_PACKAGE = 'ares-package';

const env = new Env();

export const LG_WEBOS_TV_SDK_HOME = 'LG_WEBOS_TV_SDK_HOME';

const WEBOS_CLI_PATH_PREFIX = ['CLI', 'bin'];

/**
 * Returns the path to the LG WebOS TV SDK home directory.
 * @throws If the {@linkcode LG_WEBOS_TV_SDK_HOME} environment variable is not set
 * @returns {string}
 */
export const getLgHome = _.once(() => {
  /** @type {string} */
  try {
    return env.require(LG_WEBOS_TV_SDK_HOME);
  } catch {
    throw new TypeError(`Ensure the "${LG_WEBOS_TV_SDK_HOME}" environment variable 
is set; see https://webostv.developer.lge.com/sdk/command-line-interface/installation/
for more information`);
  }
});

/**
 * Checks if `executablePath` is indeed executable and throws otherwise.
 * @throws If `executablePath` is not executable
 * @param {string} executablePath
 */
async function assertAresExecutable(executablePath) {
  const isExecutable = await fs.isExecutable(executablePath);
  if (!isExecutable) {
    throw new Error(
      `${executablePath} does not exist or is not executable. Ensure the "CLI" dir exists inside of ${LG_WEBOS_TV_SDK_HOME} with executable permissions.`
    );
  }
}

/**
 * Get absolute path to an LG SDK executable.
 *
 * @param {string} basename - The basename of the executable.
 * @returns {Promise<string>}
 */
export async function getAresExecutablePath(basename) {
  const executablePath = path.resolve(getLgHome(), ...WEBOS_CLI_PATH_PREFIX, basename);
  await assertAresExecutable(executablePath);
  return executablePath;
}

/**
 * Run an Ares related command
 * @param {string} basename - name of ares executable to run
 * @param {string[]} [args] - list of args to apply
 *
 * @returns {Promise<import('teen_process').ExecResult<string>>}
 */
async function runCmd(basename, args = []) {
  const executablePath = await getAresExecutablePath(basename);
  log.info(`Running command: ${executablePath} ${args.join(' ')}`);
  try {
    return await exec(executablePath, args);
  } catch (err) {
    const e = /** @type {import('teen_process').ExecError} */ (err);
    const stdout = e.stdout.replace(/[\r\n]+/, ' ');
    const stderr = e.stderr.replace(/[\r\n]+/, ' ');
    e.message = `${e.message}. Stdout was: '${stdout}'. Stderr was: '${stderr}'`;
    throw e;
  }
}

/**
 * Run an Ares related command that takes an optional --device flag
 *
 * @param {string} basename - name of ares executable to run
 * @param {string} [deviceName] - device name/ID as shown in ares-setup-device
 * @param {string[]} [args] - array of args to apply to command
 *
 * @returns {Promise<import('teen_process').ExecResult<string>>}
 */
async function runDeviceCmd(basename, deviceName, args = []) {
  if (deviceName) {
    args.push('--device', deviceName);
  }
  return await runCmd(basename, args);
}

/**
 * Attempt to extend developer mode on the connected device. This will as
 * a side effect cause the developer app to be launched
 *
 * @param {string} [deviceName] - device to extend, otherwise whichever is connected
 * @returns {Promise<void>}
 */
export async function extendDevMode(deviceName) {
  log.info(`Extending dev mode on device`);
  await runDeviceCmd(ARES_EXTEND_DEV, deviceName);
}

/**
 * Retrieve info about a device using ares-device-info
 *
 * @param {string} [deviceName] - device to explicitly get info for, otherwise default
 * @returns {Promise<Record<string, string>>}
 */
export async function getDeviceInfo(deviceName) {
  log.info(`Getting device info`);
  let {stdout} = await runDeviceCmd(ARES_DEVICE_INFO, deviceName);
  stdout = stdout.trim();
  const dataParseRe = /^(.+) : (.+)$/gm;
  const matches = stdout.matchAll(dataParseRe);
  return [...matches].reduce((acc, m) => {
    acc[m[1]] = m[2];
    return acc;
  }, /** @type {Record<string,string>} */ ({}));
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

/**
 * Env check.  Should be run at time of driver instantiation.
 *
 * Must not be async.
 * @returns {void}
 */
export function preflightCheck() {
  getLgHome();
}

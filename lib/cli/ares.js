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
 * Attempt to extend developer mode on the connected device. This will as
 * a side effect cause the developer app to be launched
 *
 * @param deviceName? - device to extend, otherwise whichever is connected
 */
export async function extendDevMode(deviceName = null) {
  log.info(`Extending dev mode${deviceName ? ' on device ' + deviceName : ''}`);
  let args = [];
  if (deviceName) {
    args = ['--device', deviceName];
  }
  await runCmd(ARES_EXTEND_DEV, args);
}

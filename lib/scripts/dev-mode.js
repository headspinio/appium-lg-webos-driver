import B from 'bluebird';
import _ from 'lodash';
import path from 'path';
import { assertLgHome } from '../cli/ares';

/**
 * @type {any}
 */
let novacom;

/**
 * @type {any}
 */
let luna;

const setNovacom = _.once(async () => {
  const lgHomePath = await assertLgHome();
  novacom = require(path.resolve(lgHomePath, 'CLI', 'lib', 'base', 'novacom.js'));
});

const setLuna = _.once(async () => {
  const lgHomePath = await assertLgHome();
  luna = require(path.resolve(lgHomePath, 'CLI', 'lib', 'base', 'luna.js'));
});

async function main() {
  const deviceId = 'Tor1P7';
  const session = await getNovacomSession(deviceId);
  try {
    const enabled = await getDevModeStatus(session);
    console.log(enabled);
    await setDevModeStatus(session, true);
  } finally {
    session.end();
  }
}

/**
 * @param {string} deviceId
 */
async function getNovacomSession(deviceId) {
  await setNovacom();
  await setLuna();
  return await new B((res, rej) => {
    try {
      new (/** @type {any} */novacom).Session(deviceId, (/** @type {Error} */err, /** @type {any} */session) => {
        if (err) {
          return rej(err);
        }
        session.__deviceId = deviceId;
        res(session);
      });
    } catch (err) {
      rej(err);
    }
  });
}

/**
 * @param {any} session
 */
async function getDevModeStatus(session) {
  const opts = {session, device: session.__deviceId};
  const cmd = {service: 'com.webos.service.devmode', method: 'getDevMode'};
  return await lunaSend(opts, cmd, {});
}

/**
 * @param {any} session
 * @param {boolean} enabled
 */
async function setDevModeStatus(session, enabled) {
  const opts = {session, device: session.__deviceId};
  const cmd = {service: 'com.webos.service.devmode', method: 'setDevMode'};
  return await lunaSend(opts, cmd, {enabled});
}

/**
 * @typedef {{session: any, device: string}} LunaOpts
 * @typedef {{service: string, method: string, returnValue?: string}} LunaCommand
 * @typedef {Record<string, any>} LunaParams
 */

/**
 * @param {LunaOpts} opts
 * @param {LunaCommand} cmd
 * @param {LunaParams} params
 */
async function lunaSend(opts, cmd, params) {
  if (!cmd.returnValue) {
    cmd.returnValue = 'return.returnValue';
  }
  return await new B((res, rej) => {
    try {
      luna.send(opts, cmd, params, (/** @type {any}*/result) => {
        if (result.returnValue) {
          return res(result.enabled);
        }
        rej(new Error(`Checking dev mode failed with code ${result.errorCode} and explanation '${result.errorText}'`));
      }, (/** @type {Error} */err) => {
        rej(err);
      });
    } catch (err) {
      rej(err);
    }
  });
}

main().catch((e) => {
  console.error(e); // eslint-disable-line no-console
  process.exit(1);
});

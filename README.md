# Appium LG WebOS Driver

An Appium 2.x driver for LG WebOS apps

⚠️  UNDER ACTIVE DEVELOPMENT ⚠️

## Installation

If you're using the standard Appium CLI tool to manage drivers:

```
appium driver install --source=npm appium-lg-webos-driver
```

(Or if you're using NPM to manage dependencies, just include the `appium-lg-webos-driver` npm
package in your `package.json`)

## Additional Requirements

- You must have the [LG webOS SDK](https://webostv.developer.lge.com/sdk/webos-tv-sdk/introduction/)
- You must have the `LG_WEBOS_TV_SDK_HOME` env var set as described in the SDK setup guide
- You must have an LG webOS TV device on the same network as your Appium host, with all ports accessible to the network
- You must have your TV device set up and showing as available by using the [`ares-setup-device`](https://www.webosose.org/docs/tools/sdk/cli/cli-user-guide/#ares-setup-device) CLI tool
- You should be able to run `ares-device-info --device <name>` and have it show the correct details for your connected device

## Capabilities

|Capability|Description|
|----------|-----------|
|`platformName`|[Required] Must be `LGTV`|
|`appium:deviceName`|[Required] The name of the connected device, as it shows up in `ares-launch --device-list`|
|`appium:deviceHost`|[Required] The IP address of the connected device, as it shows up in `ares-launch --device-list`|
|`appium:appId`|[Required] The app package ID, if you want Appium to use an app already on the TV. Exclusive with `appium:app`|
|`appium:app`|[Optional] An absolute path to your `.ipk` app file, if you want Appium to install the app.|
|`appium:debuggerPort`|[Optional; default `9998`] The port on the device exposed for remote Chromium debugging.|
|`appium:chromedriverExecutable`|[Optional] Most LG TVs run a very old version of Chrome. Because this driver uses Chromedriver under the hood, you'll need to have a very old version of Chromedriver handy that works with the version of Chrome backing the apps on your TV. In our testing, we've found Chromedriver 2.36 to work with most TVs. You need to tell the driver where you've installed this version of Chromedriver using the `appium:chromedriverExecutable` capability, passing in an absolute path to the Chromedriver binary.|
|`appium:autoExtendDevMode`|[Optional; default `true`] Whether you want Appium to extend the dev mode timer on the device whenever a new session starts.|
|`appium:appLaunchParams`|[Optional; default `{}`] A key/value object of app launch param to be passed to `ares-launch`|
|`appium:appLaunchCooldown`|[Optional; default `3000`] How many ms to wait after triggering app launch to attempt to connect to it via Chromedriver.|
|`appium:fullReset`|[Optional; default `false`] If this is set to `true`, the driver will: uninstall the app before starting the session. Cannot be used with `appium:noReset`|
|`appium:noReset`|[Optional; default `false`] If this is set to `true`, the driver will: skip resetting local storage on session start. Cannot be used with `appium:fullReset`|

## Supported Commands

These are the WebDriver (and extension) commands supported by this driver. Note that in its normal
operation, this driver acts as a Chromedriver proxy. Thus, after a session is created, *all*
typical WebDriver commands are available (find element, get page source, click element, etc...).
Some commands may not make sense in a TV context (dealing with multiple windows, for example).

|Command|Parameters|Description|
|-------|----------|-----------|
|`createSession`|`capabilities`|Start a session using capabilities from the list above. This will launch your app in debug mode and start a Chromedriver proxy to the underyling TV browser|
|`deleteSession`||Stop a session|
|`executeScript`|`script`, `args`|In the typical case, this executes JavaScript within the browser, just like the typical WebDriver method. If the script is prefixed with `webos: `, the driver will attempt to find a special "webOS command" to run with your provided args.|

### webOS Commands

As a way to provide access to additional commands unique to the webOS platform, this driver has
extended the `executeScript` command in such a way that if you pass in a script like `webos:
scriptName`, then the driver will execute a special webOS command named `scriptName`. The following
webOS commands are available (note that in all these, the parameters list includes named parameters
that must be present in a JSON object, constituting the first argument of the `executeScript` args
list):

|webOS Command|Parameters|Description|
|-------------|----------|-----------|
|`pressKey`|`key`, `duration`|Press a remote key for `duration` milliseconds (defaults to 100). The value of `key` must be one of: `enter`, `right`, `left`, `up`, `down`, `back`, `playPause`, `fwd`, `rev`|

Example of using a webOS command (in the WebdriverIO JS client):

```js
await driver.executeScript('webos: pressKey', [{key: 'right', duration: 200}]);
```

## Development

This project is developed using Node.js. To work on it, clone the repo and run `npm install` inside
it.

### Developer Scripts

| Script              | Description                           |
|---------------------|---------------------------------------|
| `npm run build`     | Transpile the code                    |
| `npm run dev`       | Same as `build` but watch for changes |
| `npm run lint`      | Check code style                      |
| `npm run clean`     | Remove all build and NPM artifacts    |
| `npm run reinstall` | `clean` plus install                  |
| `npm run test:unit` | Run unit tests                        |
| `npm run test:e2e`  | Run e2e tests                         |
| `npm run test`      | Run unit tests                        |

### E2E Tests

Currently, the E2E tests require the use of an app not bundled with the project. It can be
downloaded from [Suitest](https://suite.st) at this location:
[webos.ipk](https://file.suite.st/watchmedemo/packages/webos.ipk).

Two environment variables must be set before running `npm run test:e2e`:

- `TEST_APP`: the path on your local system to the IPK file.
- `TEST_DEVICE`: the name of the LG device as it is shown when connected via `ares-setup-device`.
- `TEST_DEVICE_HOST`: the IP address of the connected LG TV.

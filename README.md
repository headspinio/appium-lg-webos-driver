# Appium LG WebOS Driver

[![npm version](https://img.shields.io/npm/v/appium-lg-webos-driver.svg)](https://npmjs.org/package/appium-lg-webos-driver)

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

- You must have the [LG webOS SDK](https://webostv.developer.lge.com/develop/tools/sdk-introduction)
- You must have the `LG_WEBOS_TV_SDK_HOME` env var set as described in the SDK setup guide
- You must have an LG webOS TV device on the same network as your Appium host, with all ports accessible to the network
- The TV must be in [Developer Mode](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app) (must have the Dev Mode app and be signed in, with Dev Mode actually turned "On" in the app)
- You must have your TV device set up and showing as available using the [`ares-setup-device`](https://www.webosose.org/docs/tools/sdk/cli/cli-user-guide/#ares-setup-device) CLI tool
    - Please use v`1.12.4` which is available from https://webostv.developer.lge.com/develop/tools/webos-tv-cli-installation for now. (or [this comment for Linux](https://github.com/headspinio/appium-lg-webos-driver/pull/57#issuecomment-2153496885))
- You should be able to run `ares-device-info --device <name>` and have it show the correct details for your connected device
- The first time you run an Appium session, the driver will attempt to pair itself with the TV as a remote. A permission popup will appear that you need to interact with. You should only need to do this once. If the driver is reinstalled, its permission token cache is removed, or the TV is updated (and potentially even some other circumstances) re-pairing might be necessary.

## Capabilities

|Capability|Description|
|----------|-----------|
|`platformName`|[Required] Must be `lgtv`|
|`appium:automationName`|[Required] Must be `webos`|
|`appium:deviceName`|[Required] The name of the connected device, as it shows up in `ares-launch --device-list`|
|`appium:deviceHost`|[Required] The IP address of the connected device, as it shows up in `ares-launch --device-list`|
|`appium:appId`|[Required] The app package ID, if you want Appium to use an app already on the TV. Exclusive with `appium:app`|
|`appium:app`|[Optional] An absolute path to your `.ipk` app file, if you want Appium to install the app.|
|`appium:debuggerPort`|[Optional; default `9998`] The port on the device exposed for remote Chromium debugging.|
|`appium:chromedriverExecutable`(*)|[Optional] Most LG TVs run a very old version of Chrome. Because this driver uses Chromedriver under the hood, you'll need to have a very old version of Chromedriver handy that works with the version of Chrome backing the apps on your TV. In our testing, we've found Chromedriver 2.36 to work with most TVs. You need to tell the driver where you've installed this version of Chromedriver using the `appium:chromedriverExecutable` capability, passing in an absolute path to the Chromedriver binary.|
| `appium:chromedriverExecutableDir`(*) | [Optional] Full path to the folder where chromedriver executables are located. This folder is used then to store the downloaded chromedriver executables if automatic download is enabled with `chromedriver_autodownload` security flag. Please read [Automatic Discovery of Compatible Chromedriver in appium-uiautomator2-driver](https://github.com/appium/appium-uiautomator2-driver?tab=readme-ov-file#automatic-discovery-of-compatible-chromedriver) for more details. If the chrome version on the TV is lower than v63 major version, the using chrome version will be `Chrome/63.0.3239.0` forcefully to use chromedriver 2.36 for the session. Lower chromedriver could raise `cannot find Chrome binary` error, which prevent starting chromedriver session. |
|`appium:websocketPort`|[Optional; default `3000`] The websocket port on the device exposed for remote control|
|`appium:websocketPortSecure`|[Optional; default `3001`] The secure websocket port on the device exposed for remote control|
|`appium:useSecureWebsocket`|[Optional; default `false`] Flag that enables use of `websocketPortSecure` port, also starts WebSocket over https instead. **DISCLAIMER** Enabling this flag, it is required to set environment variable `export NODE_TLS_REJECT_UNAUTHORIZED=0`, which can be a potential security risk. A new session request might get `unable to get local issuer certificate` error message.|
|`appium:autoExtendDevMode`|[Optional; default `true`] Whether you want Appium to extend the dev mode timer on the device whenever a new session starts.|
|`appium:appLaunchParams`|[Optional; default `{}`] A key/value object of app launch param to be passed to `ares-launch`|
|`appium:appLaunchCooldown`|[Optional; default `3000`] How many ms to wait after triggering app launch to attempt to connect to it via Chromedriver.|
|`appium:fullReset`|[Optional; default `false`] If this is set to `true`, the driver will: uninstall the app before starting the session. Cannot be used with `appium:noReset`|
|`appium:noReset`|[Optional; default `false`] If this is set to `true`, the driver will: skip resetting local storage on session start. Cannot be used with `appium:fullReset`|
|`appium:remoteOnly`|[Optional; default `false`] If this is set to `true`, the driver will not attempt to start Chromedriver and communicate via the debug protocol to the application. Instead the app will be launched, and nothing else. You will only have access to remote control commands in a "fire-and-forget" fashion. Useful when dealing with non-web-based apps.|
|`appium:rcMode`|[Optional; default `js`; must be `rc` or `js`] When the value is `js`, the `webos: pressKey` command will operate with JS executed via Chromedriver. Otherwise, keys will be sent using the websocket remote control API. Note that when `appium:remoteOnly` is set to true, the value of `appium:rcMode` will always behave as if set to `rc`.|
|`appium:keyCooldown`|[Optional; default `750`] How long to wait in between remote key presses|

(*) `appium:chromedriverExecutable` or `appium:chromedriverExecutableDir` are required. The chromedriver autodwonload works only when `appium:chromedriverExecutableDir` is provided.
If both capabilities are given, `appium:chromedriverExecutableDir` will take priority.

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
|`pressKey`|`key`, `duration`|Press a remote key for `duration` milliseconds (defaults to 100). The value of `key` must be one of the values listed below|
|`listApps`| |Return the list of installed applications. The `id` key in each value is `appium:appId`. |
|`activeAppInfo`| |Return current foreground application information.|

Example of using a webOS command (in the WebdriverIO JS client):

```js
await driver.executeScript('webos: pressKey', [{key: 'right', duration: 200}]);
```

#### webos: pressKey

Here are the accepted values, based on the `appium:rcMode`. Casing does not matter.

##### When `appium:rcMode` is `js`:

- `enter`
- `right`
- `left`
- `up`
- `down`
- `back`
- `playPause`
- `fwd`
- `rev`

##### When `appium:rcMode` is `rc`:

- `HOME`
- `LEFT`
- `RIGHT`
- `UP`
- `DOWN`
- `ENTER`
- `BACK`
- `VOL_UP`
- `VOL_DOWN`
- `MUTE`
- `UNMUTE`
- `PLAY`
- `STOP`
- `REWIND`
- `FF`
- `CHAN_UP`
- `CHAN_DOWN`

#### webos: listApps

Response example:

```ruby
# Ruby
apps = driver.execute_script "webos: listApps"
#=> [{"networkStableTimeout"=>0,
# "checkUpdateOnLaunch"=>true,
# "requiredPermissions"=>["all"],
# "class"=>{"hidden"=>true},
# "title"=>"AirPlay",
# "allowWidget"=>false,
# "icon"=>"https://192.168.21.67:3001/resources/6a7d9dd6e94e6fb1d69163ada80efe8c6540efa8/AirPlay_Icon-77x77.png",
# "tileSize"=>"normal",
# "inAppSetting"=>false,
# "closeOnRotation"=>false,
# "nativeLifeCycleInterfaceVersion"=>2,
# "folderPath"=>"/usr/palm/applications/airplay",
# "transparent"=>false,
# "version"=>"1.0.0",
# "trustLevel"=>"trusted",
# "hasPromotion"=>false,
# "enableCBSPolicy"=>false,
# "lockable"=>true,
# "systemApp"=>true,
# "mediumLargeIcon"=>"AirPlay_Icon-115x115.png",
# "main"=>"LunaExecutable",
# ...
# ]
apps.map { |app| app["id"]}
# => ["airplay",
#  "amazon",
#  "amazon.alexa.view",
#  "amazon.alexapr",
#  "com.apple.appletv",
#  "com.disney.disneyplus-prod",
#  "com.fubotv.app",
#  ...
# ]

```

#### webos: activeAppInfo

Response example:

```ruby
# Ruby
driver.execute_script "webos: activeAppInfo"
#=> {"returnValue"=>true, "appId"=>"com.your.app", "processId"=>"", "windowId"=>""}
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

Some environment variables must be set before running `npm run test:e2e`:

- `TEST_APP`: the path on your local system to the IPK file.
- `TEST_DEVICE`: the name of the LG device as it is shown when connected via `ares-setup-device`.
- `TEST_DEVICE_HOST`: the IP address of the connected LG TV.

## release

This repository is released with regular npm command:

```
npm version patch # etc
npm publish
# push the local commit and tag to this repository
```

## Credits

* Development for this driver is sponsored by [HeadSpin](https://headspin.io).

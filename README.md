# Appium LG WebOS Driver

An Appium 2.x driver for LG WebOS apps

!!! UNDER HEAVY DEVELOPMENT, NOT READY FOR GENERAL USE !!!

## Installation

If you're using the standard Appium CLI tool to manage drivers:

```
appium driver install --source=npm appium-lg-webos-driver
```

(Or if you're using NPM to manage dependencies, just include the `appium-lg-webos-driver` npm
package in your `package.json`)

## Additional Requirements

- LG SDK
- `LG_WEBOS_TV_SDK_HOME` env var set
- Device setup and available in `ares-setup-device`
- Should be able to run `ares-device-info --device <name>` and have it work
- `ar` (library archives) CLI utility available (for unarchiving IPKs)

## Capabilities

|Capability|Description|
|--|--|
|`platformName`|[Required] Must be `LGTV`|
|`appium:deviceName`|[Required] The name of the connected device, as it shows up in `ares-launch --device-list`|
|`appium:deviceHost`|[Required] The IP address of the connected device, as it shows up in `ares-launch --device-list`|
|`appium:app`|An absolute path to your `.ipk` app file, if you want Appium to install the app. Exclusive with `appium:appId`|
|`appium:appId`|The app package ID, if you want Appium to use an app already on the TV. Exclusive with `appium:app`|
|`appium:debuggerPort`|[Optional; default `9998`] The port on the device exposed for remote Chromium debugging.|
|`appium:chromedriverExecutable`|[Optional] Most LG TVs run a very old version of Chrome. Because this driver uses Chromedriver under the hood, you'll need to have a very old version of Chromedriver handy that works with the version of Chrome backing the apps on your TV. In our testing, we've found Chromedriver 2.36 to work with most TVs. You need to tell the driver where you've installed this version of Chromedriver using the `appium:chromedriverExecutable` capability, passing in an absolute path to the Chromedriver binary.|
|`appium:autoExtendDevMode`|[Optional; default `true`] Whether you want Appium to extend the dev mode timer on the device whenever a new session starts.|
|`appium:appLaunchParams`|[Optional; default `{}`] A key/value object of app launch param to be passed to `ares-launch`|
|`appium:appLaunchCooldown`|[Optional; default `3000`] How many ms to wait after triggering app launch to attempt to connect to it via Chromedriver.|

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

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

- `TEST_APP`: the path on your local system to the IPK file
- `TEST_DEVICE`: the name of the LG device as it is shown when connected via `ares-setup-device`.

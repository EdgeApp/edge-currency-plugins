# Currency Contribution Guide

This guide will assist you in contributing a UTXO currency integration as an
addition to the set of currently supported UTXO currencies.

## Prerequisites

Before you start, be sure to clone this repo for your development and testing
purposes. Follow the [installation instructions here.](../README.md)

## Integration Steps

### 1. Create a new currency plugin

Create a new currency plugin info file in the `src/common/utxobased/info`
directory. The format of this file is as follows:

```ts
import { EdgeCurrencyInfo } from "edge-core-js/types";

const currencyInfo: EdgeCurrencyInfo = {
  // Edge Core currency plugin information.
};

const engineInfo: EngineInfo = {
  // Currency plugin engine information.
};

const coinInfo: CoinInfo = {
  // Currency plugin coin specific information for AltcoinJS library interfacing.
};

// Export the plugin info as a single interface.
export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo };
```

Follow the type information and JSDocs to complete each info object. You may
also reference existing currency info files for guidance, specifically for the
loosely typed fields in `EdgeCurrencyInfo`.

### 2. Register new currency info

Import and add the new currency plugin info into the `src/common/utxobased/info/all.ts`
file:

```ts
import { info as mycurrency } from "./mycurrency";
// ...

export { info as mycurrency } from "./mycurrency";
// ...

export const all = {
  bitcoin,
  // ...
  mycurrency,
  // ...
};
```

Note, be sure to both import and export the new currency plugin info with
identifier alias to uniquely identify the currency plugin. Use alphanumeric
sorting when placing the new currency plugin info in the `all` object.

### 3. Test the new currency plugin

Run the Webpack dev-server with `yarn start` and leverage the `debugUri` in
your application to quickly iterate while debugging/developing.

### 4. Submit a pull request

Once you have completed the integration and testing, submit a pull request to
the `main` branch of this repository on GitHub for this project.

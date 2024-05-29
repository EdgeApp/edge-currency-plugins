# Edge Currency Plugin for UTXO-Based currencies

> Plugins for [edge-core-js](https://github.com/EdgeApp/edge-core-js), to support various cryptocurrencies such as bitcoin, bitcoin cash, and litecoin,

## Installing

First, add this library to your project:

```sh
npm i -s edge-currency-plugins
```

### Node.js

For Node.js, you should call `addEdgeCorePlugins` to register these plugins with edge-core-js:

```js
const { addEdgeCorePlugins, lockEdgeCorePlugins } = require("edge-core-js");
const plugins = require("edge-currency-plugins");

addEdgeCorePlugins(plugins);

// Once you are done adding plugins, call this:
lockEdgeCorePlugins();
```

You can also add plugins individually if you want to be more picky:

```js
addEdgeCorePlugins({
  bitcoin: plugins.bitcoin,
});
```

### Browser

The bundle located in `dist/edge-currency-plugins.js` will automatically register itself with edge-core-js. Just serve the entire `dist` directory along with your app, and then load the script:

```html
<script src='https://example.com/app/dist/edge-currency-plugins.js'>
```

If you want to debug this project, run `yarn start` to start a Webpack server,
and then adjust your script URL to http://localhost:8084/edge-currency-plugins.js.

### React Native

The `edge-currency-plugins` package will automatically install itself using React Native autolinking.
To integrate the plugins with edge-core-js, add its URI to the context component:

```jsx
import { pluginUri, makePluginIo } from "edge-currency-plugins";
<MakeEdgeContext
  nativeIo={{
    "edge-currency-plugins": makePluginIo(),
  }}
  pluginUris={[pluginUri]}
  // Plus other props as required...
/>;
```

To debug this project, run `yarn start` to start a Webpack server, and then use `debugUri` instead of `pluginUri`.

# edge-rest-wallet

> A REST API for storing & sending money, powered by Edge

This repository implements a simple API for accessing a wallet on a web server. This can be useful for automated payouts, promotions, e-commerce, and various similar things.

We make this code available for free, but it does require an Edge SDK API key. Please copy `config.sample.json` to `config.json` and add your API key in there.

## REST API

To launch the REST API, just type `yarn start`.

You can also build the server code by running `yarn build`, which puts its output in the `lib` folder. You can then use `forever-service` or similar tools to install the software on your server machine.

```sh
# install:
sudo forever-service install wallet --script lib/index.js --start

# manage:
sudo service wallet restart
sudo service wallet stop

# uninstall:
sudo forever-service delete wallet
```

## Demo app

Run `yarn demo` to launch the demo app in your web browser.

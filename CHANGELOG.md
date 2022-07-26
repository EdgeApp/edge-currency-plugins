# edge-currency-plugins

## v1.1.2 (2022-07-26)

- Fix: Upgrade edge-sync-client to include patch
 
## v1.1.1 (2022-07-12)

- Fix: Add feathercoin blockbook server
- Fix: Engine crashs on fetching server list network failure
- Fix: Spend issues caused by not saving UTXOs locally without needing a network event

## v1.1.0 (2022-06-29)

- Change: Computes the sat/vByte used for a given transaction, and adds feeRateUsed object to the EdgeTransaction output.

## v1.0.0 (2022-06-22)

- Fix: Fix a logic error in UtxoEngineState.processUtxos
- Change: Disable BCH to BSV splitting for now
- Change: Add detailed logs for Socket errors caused by cleaner

## v1.0.0-rc.6 (2022-06-21)

- Fix: Fee rounding errors for some spending cases (particularly sweek keys for segwit wallets)
- Change: Use WhatsOnChain.com as the block explorer URLs for BSV

## v1.0.0-rc.5 (2022-06-21)

- Fix: Insufficient funds error for edge case (max spend on a zero-balance wallet)

## v1.0.0-rc.4 (2022-06-20)

- Fix: Avoid redundant ADDRESSES_CHECKED events after initial sync

## v1.0.0-rc.3 (2022-06-20)

- Fix: Balance bug after sending transactions

## v1.0.0-rc.2 (2022-06-17)

- Fix: Improve connection states and fix reconnection bugs caused when connections are unreliable
- Fix: Improve BSV address format support for addresses coming from networks

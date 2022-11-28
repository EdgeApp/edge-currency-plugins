# edge-currency-plugins

## v1.3.0 (2022-11-28)

- add: forceIndex option to getReceiveAddress to get specific derivation index
- add: Return balance of address with getReceiveAddress
- add: utxoSourceAddress option to makeSpend to only use UTXOs from a specific address
- add: forceChangeAddress option to makeSpend to force change to go to specific address

## v1.2.3 (2022-10-31)

- Rewrite wallet balance update algorithm
- Change ADDRESS_BALANCE_CHANGED event to take an array of balances
- Emit address balance update event after initializing addresses
- Add metadataState to dumpData

## v1.2.2 (2022-10-14)

- Dash: Add InstantSend detection

## v1.2.1 (2022-09-19)

- Fix: Correctly import uncompressed WIFs

## v1.2.0 (2022-09-02)

- Add: outputSort param for makeSpend to allow for sorting outputs

## v1.1.6 (2022-08-26)

- Fix: Broken processing of Taproot addresses in the inputs of receiving transactions

## v1.1.5 (2022-08-22)

- Fix: Broken max-spend caused by support for memos in OP_RETURN

## v1.1.4 (2022-08-19)

- Fix: Always delete a UTXO that's missing from the network
- Add: Extra logging for failed makeSpend caused by altcoin-js

## v1.1.3 (2022-08-04)

- Add support for adding an OP_RETURN output

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

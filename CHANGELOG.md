# edge-currency-plugins

## v2.0.4 (2023-07-17)

- Fixed: Race condition during re-sync causing impartial processor data ("Missing processor address" bug)

## v2.0.3 (2023-06-22)

- Fixed: Throw DustSpendError instead of obscure blockbook error message for dust spend transaction broadcasts.

## v2.0.2 (2023-04-10)

- Query `networkFees` endpoint with pluginId instead of currencyCode

## v2.0.1 (2023-04-04)

- fixed: Bug with signMessage cleaning of `EdgeSignMessageOptions['otherParams']`

## v2.0.0 (2023-3-28)

- changed: Upgrade security access to private keys in EdgeWalletInfo
- changed: Add signMessage API to replace signMessageBase64 in otherMethods

## v1.3.7 (2023-3-23)

- Improve log detail in order to better troubleshoot spending issues.

## v1.3.6 (2023-1-18)

- Fixed: Reduce the KEEP_ALIVE_MS blockbook server heartbeat time

## v1.3.5 (2023-1-6)

- Fixed: Incorrect types path in package.json

## v1.3.4 (2023-1-6)

- Added: Support bech32 addresses as `segwitAddress` for `EdgeFreshAddress`
- Added: RBF flags for Bitcoin and Litecoin

## v1.3.3 (2022-12-21)

- fix: Upgrade dependencies to fix vulnerabilities and some data-layer issues.

## v1.3.2 (2022-12-16)

- fix: Report the correct balance for old Airbitz-created addresses.

## v1.3.1 (2022-11-29)

- fix: Enable and fix BCH to BSV splitting

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

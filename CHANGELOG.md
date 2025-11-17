# edge-currency-plugins

## Unreleased

- fixed: Change PIVX blockbook server list.

## 3.8.8 (2025-11-06)

- fixed: Fix failed transaction processing for FIRO transactions with SparkSpend inputs.

## 3.8.7 (2025-11-05)

- fixed: Added retry delay to fix dropped transaction thrashing.

## 3.8.6 (2025-10-13)

- fixed: (QTUM) Explorer URLs

## 3.8.5 (2025-09-09)

- added: Add optional `memoIndex` to otherParams to force output index of OP_RETURN

## 3.8.4 (2025-08-20)

- changed: Update blockbook servers
- changed: Require the environment to support es2015 & `async` functions.
- fixed: Avoid deprecated Gradle syntax.

## 3.8.3 (2025-07-14)

- added: Added Edge blockbook servers to DASH, LTC, and PIVX.
- fixed: Crash when running under NodeJS due to missing memletConfig

## 3.8.2 (2025-06-09)

- changed: Remove NOWNodes blockbook connection for Firo.

## 3.8.1 (2025-06-02)

- changed: Added cashaddr prefixes to ecash.
- changed: Added ecash to bitcoincash forks.

## 3.8.0 (2025-05-19)

- added: Added eCash.

## 3.7.0 (2025-04-15)

- added: Added PIVX.
- changed: Replace asmjs secp256k1 library with bigint compatible version

## 3.6.1 (2025-04-07)

- fixed: (QTUM) Populate `blockbookServers`

## 3.6.0 (2025-04-07)

- added: Add Bitcoin Testnet4 plugin

## 3.5.4 (2025-03-26)

- changed: Change Ravencoin explorer.

## 3.5.3-1 (2025-02-26)

- fixed: Re-publish to hopefully fix malformed 3.5.3 package.

## 3.5.3 (2025-02-26)

- fixed: Update vin cleaner match blockbook spec with safe defaults

## 3.5.2 (2025-02-04)

- fixed: Update the last-seen checkpoint when the sync finishes, even if we haven't seen any new transactions.

## 3.5.1 (2025-01-22)

- changed: Remove Blockbook servers from persisted internal servers list when updating this list from payload/default servers.
- fixed: Remove blockbook.firo.org Blockbook server form default Blockbook server list.

## 3.5.0 (2025-01-15)

- added: Implement `updateInfoPayload` for `EdgeCurrencyEngine` to get currency info updates from info-server.
- changed: Implement new Seen Tx Checkpoint API for all currencies.
- fixed: Fixed cleaner failure for getInfo Blockbook request.

## 3.4.5 (2024-12-12)

- added: Edge servers added to blockbook server list for BTC, BCH, DOGE, FIRO, and LTC.

## 3.4.4 (2024-11-08)

- fixed: Improper handling of WebSocket message processing errors, causing sync-halting.
- fixed: Add support for processing coinbase inputs on block reward transactions.

## 3.4.3 (2024-10-15)

- fixed: Re-publish to NPM with missing files included.

## 3.4.2 (2024-10-11)

- removed: Removed unreliable bitcoincash `xpubExplorer` link

## 3.4.1 (2024-10-10)

- fixed: Change DOGE minimum relay fee to 0.01 DOGE/kB.

## 3.4.0 (2024-09-24)

- changed: No longer allow for the custom server list to be empty; fallback to default servers if no custom servers are provided.

## 3.3.2 (2024-09-09)

- fixed: Fix incorrect `EdgeTransaction.nativeAmount` returned by `EdgeCurrencyEngine.sweepPrivateKey`

## 3.3.1 (2024-08-20)

- fixed: Update NowNodes URL's for DASH, GRS, and FIRO.

## 3.3.0 (2024-08-20)

- added: Support for blockbook server connections with "%{key-name}" key parameters
- fixed: Ensure server scoring is done on all server tasks
- changed: Refactor pickNextTask to implement generators to replace Deferred promises
- changed: Rename `initOption` nowNodeApiKey -> nowNodesApiKey

## 3.2.1 (2024-07-19)

- fixed: Bug causing default currency info server list to overwrite user's customer servers
- fixed: Unnecessary reconnect to Blockbook servers during ever call to engine's `changeUserSettings`

## 3.2.0 (2024-06-17)

- added: Support for splitting LTC->BTC

## 3.1.0 (2024-06-11)

- changed: Use new `enableRbf` field on `EdgeSpendInfo`
- changed: Deprecated `enableRbf` in `EdgeSpendInfo['otherParams']`

## 3.0.2 (2024-06-03)

- fixed: Check transaction input sequence values for RBF transaction acceleration.

## 3.0.1 (2024-05-29)

- changed: Changed webpack dev server port to 8084 to resolve conflict with metro's 8081 usage.

## 3.0.0 (2024-05-14)

- added: Added blockbook-nownode server configs to BTC, BCH, DASH, DGB, GRS, LTC, and FIRO
- added: Support for ElectrumX server WebSocket connections under 'electrumws(s):' protocol scheme.
- added: Query for UTXO data from ElectrumX servers (sans transaction data).
- added: `memletConfig` option to new `makePluginIo` API to config memlet memory usage.
- changed: Plugin package now builds itself into a react-native module using webpack (see README for installation guide).
- changed: Upgrade edge-core-js dependency to v2

## 2.6.2 (2024-04-24)

- changed: Reorganize `currencyInfo`.

## 2.6.1 (2024-04-22)

- fixed: Missing `scriptPubkeyByPath` processor data from wallet data dump returned by `dumpData`
- fixed: Prevent wallet processor data corruption ("Missing processor address" error)

## 2.6.0 (2024-04-09)

- added: New fallback server engine info, starting with NOWNodes blockbook servers

## 2.5.4 (2024-01-26)

- fixed: Check for NaN target totals in `subtractFee` style transactions
- removed: Disable `accelerate` for bip44 wallets

## 2.5.3 (2024-01-24)

- changed: Add insufficient funds check `subtractFee` style transactions

## 2.5.2 (2024-01-23)

- removed: Disable `accelerate` for bip32 (Airbitz) wallets

## 2.5.1 (2023-11-10)

- changed: Disabled RBF for Litecoin
- fixed: Respect `canReplaceByFee` flag from currency info in engine `accelerate` function

## 2.5.0 (2023-10-31)

- added: `accelerate` method to `UtxoEngine` for RBF support.
- fixed: Incorrect handling of `vout` for Blockbook transactions
- fixed: Incorrectly populating `ourReceiveAddress` for new transactions from `makeSpend`

## 2.4.1 (2023-10-27)

- fixed: Bug with new `maximumFeeRate` entry in `FeeInfo` not applying due to disk/info-server overwriting the field.

## 2.4.0 (2023-10-23)

- changed: Re-enabled maximum fee rate checks from AltcoinJS.
- added: Configurable `maximumFeeRate` field for currency info's `EngineInfo` to change from default 5000 sats-per-vbyte

## v2.3.0 (2023-09-29)

- removed: BSV from BCH's split options

## v2.2.1 (2023-09-15)

- added: Dynamic fudge factors for UTXO fees

## v2.2.0 (2023-09-12)

- added: Support the latest core memo API's.

## v2.1.1 (2023-09-15)

- added: Dynamic fudge factors for UTXO fees

## v2.1.0 (2023-08-02)

- Changed: Upgraded AltcoinJS to first published version based on BitcoinJS v6.1.3
- Added: Support for pay-to-taproot address support (P2TR) for Bitcoin wallets.

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

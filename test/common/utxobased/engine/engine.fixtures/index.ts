import bitcoinTestnet_dummyAddressData from './bitcoinTestnet/dummyAddressData'
import bitcoinTestnet_dummyHeadersData from './bitcoinTestnet/dummyHeadersData'
import bitcoinTestnet_dummyTransactionsData from './bitcoinTestnet/dummyTransactionsData'
import bitcoinTestnet_tests from './bitcoinTestnet/tests'

export const fixtures = [
  {
    dummyAddressData: bitcoinTestnet_dummyAddressData,
    dummyHeadersData: bitcoinTestnet_dummyHeadersData,
    dummyTransactionsData: bitcoinTestnet_dummyTransactionsData,
    tests: bitcoinTestnet_tests
  }
]

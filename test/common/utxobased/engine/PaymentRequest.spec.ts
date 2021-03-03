import * as chai from 'chai'
import { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'

import { getSpendTargets } from '../../../../src/common/utxobased/engine/paymentRequest'

chai.should()
chai.use(chaiAsPromised)

describe('PaymentRequest', function () {
  it('calculate spend target', async function () {
    const outputs = [
      {
        amount: 239200,
        address: 'n3YaQSkTXrpbQyAns1kQQRxsECMn9ifx5n'
      }
    ]
    const result = getSpendTargets(outputs)
    expect(result).to.eql({
      nativeAmount: 239200,
      spendTargets: [
        {
          publicAddress: 'n3YaQSkTXrpbQyAns1kQQRxsECMn9ifx5n',
          nativeAmount: '239200'
        }
      ]
    })
  })
})

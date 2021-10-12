import { expect } from 'chai'
import { describe, it } from 'mocha'

import { cdsScriptTemplates } from '../../../../../src/common/utxobased/keymanager/bitcoincashUtils/checkdatasig'

describe('bitcoin cash checkdatasig scripting tests', () => {
  const redeemScript = cdsScriptTemplates.replayProtection(
    '038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508'
  )
  it('bitcoin cash checkdatasig redeem script test', () => {
    expect(redeemScript).to.equal(
      '4630440220256c12175e809381f97637933ed6ab97737d263eaaebca6add21bced67fd12a402205ce29ecc1369d6fc1b51977ed38faaf41119e3be1d7edfafd7cfaf0b6061bd070021038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508bb21038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508ac'
    )
  })
})

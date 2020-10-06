import * as chai from 'chai'

import { Account, makeAccount, makePrivateAccount, makePrivateAccountFromMnemonic } from '../../src/common/Account'
import { BIP43PurposeTypeEnum, NetworkEnum } from '../../src/common/utxobased/keymanager/keymanager'
import { getCoinFromString } from '../../src/common/utxobased/keymanager/coinmapper'

chai.should()

describe('Account', function() {
  function verifyAccountValues(account: Account, xpub: string, values: any) {
    const { coinType } = getCoinFromString(values.coinName)
    account.xpub.should.equal(xpub)
    account.purpose.should.equal(values.purpose)
    account.coinName.should.equal(values.coinName)
    account.coin.should.equal(coinType)
    account.networkType.should.equal(values.networkType)
    chai.expect(typeof account.path).to.be.equal('object')
    chai.expect(typeof account.getPubKey).to.be.equal('function')
    chai.expect(typeof account.getScriptPubKey).to.be.equal('function')
    chai.expect(typeof account.getAddress).to.be.equal('function')
    chai.expect(typeof account.getAddressFromPathString).to.be.equal('function')
  }

  describe('makeAccount', function() {
    it('should create an account from an xpub', function() {
      const xpub = 'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj'
      const config = {
        purpose: BIP43PurposeTypeEnum.Legacy,
        coinName: 'bitcoin',
        networkType: NetworkEnum.Mainnet
      }
      const account = makeAccount(xpub, config)
      verifyAccountValues(account, xpub, config)
    })
    it('should create an account from an ypub', function() {
      const ypub = 'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP'
      const config = {
        purpose: BIP43PurposeTypeEnum.WrappedSegwit,
        coinName: 'bitcoin',
        networkType: NetworkEnum.Mainnet
      }
      const account = makeAccount(ypub, config)
      verifyAccountValues(account, ypub, config)
    })
    it('should create an account from an zpub', function() {
      const zpub = 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs'
      const config = {
        purpose: BIP43PurposeTypeEnum.Segwit,
        coinName: 'bitcoin',
        networkType: NetworkEnum.Mainnet
      }
      const account = makeAccount(zpub, config)
      verifyAccountValues(account, zpub, config)
    })
  })

  describe('makePrivateAccount', function() {
    it('should create an account from an xprv', function() {
      const xprv = 'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb'
      const xpub = 'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj'
      const config = {
        purpose: BIP43PurposeTypeEnum.Legacy,
        coinName: 'bitcoin',
        networkType: NetworkEnum.Mainnet
      }
      const account = makePrivateAccount(xprv, config)
      verifyAccountValues(account, xpub, config)
    })
    it('should create an account from an yprv', function() {
      const yprv = 'yprvAHwhK6RbpuS3dgCYHM5jc2ZvEKd7Bi61u9FVhYMpgMSuZS613T1xxQeKTffhrHY79hZ5PsskBjcc6C2V7DrnsMsNaGDaWev3GLRQRgV7hxF'
      const ypub = 'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP'
      const config = {
        purpose: BIP43PurposeTypeEnum.WrappedSegwit,
        coinName: 'bitcoin',
        networkType: NetworkEnum.Mainnet
      }
      const account = makePrivateAccount(yprv, config)
      verifyAccountValues(account, ypub, config)
    })
    it('should create an account from an zprv', function() {
      const zprv = 'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE'
      const zpub = 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs'
      const config = {
        purpose: BIP43PurposeTypeEnum.Segwit,
        coinName: 'bitcoin',
        networkType: NetworkEnum.Mainnet
      }
      const account = makePrivateAccount(zprv, config)
      verifyAccountValues(account, zpub, config)
    })
  })

  describe('makePrivateAccountFromMnemonic', function() {
    it('should create an account from an mnemonic', function() {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      const xpub = 'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj'
      const config = {
        purpose: BIP43PurposeTypeEnum.Legacy,
        coinName: 'bitcoin',
        networkType: NetworkEnum.Mainnet
      }
      const account = makePrivateAccountFromMnemonic(mnemonic, config)
      verifyAccountValues(account, xpub, config)
    })
  })
})
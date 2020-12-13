import * as chai from 'chai'

import { makePath, makePathFromString, normalizePath, Path } from '../../src/common/Path'
import { BIP43PurposeTypeEnum, ScriptTypeEnum, AddressTypeEnum  } from '../../src/common/utxobased/keymanager/keymanager'
import { getCoinFromString } from '../../src/common/utxobased/keymanager/coinmapper'

const should = chai.should()

describe('Path', function() {
  function validatePathValues(path: Path, expectedValues: any) {
    path.purpose.should.equal(expectedValues.purpose, 'incorrect purpose')
    path.coin.should.equal(expectedValues.coin, 'incorrect coin')
    path.index.should.equal(expectedValues.index, 'incorrect index')
    path.scriptType.should.equal(expectedValues.scriptType, 'incorrect script type')
    path.addressType.should.equal(expectedValues.addressType, 'incorrect address type')

    expectedValues.isChange && path.isChangePath().should.equal(expectedValues.isChange)
  }

  describe('normalizePath', function() {
    it('should normalize a full hardened path string', function() {
      const pathStr = "m/49'/0'/0'/0/0"
      const normalizedPath = normalizePath(pathStr)
      normalizedPath.should.equal('m_49__0__0__0___0')
    })
    it('should normalize a hardened path string up to the prefix', function() {
      const pathStr = "m/49'/0'/0'/0"
      const normalizedPath = normalizePath(pathStr)
      normalizedPath.should.equal('m_49__0__0__0')
    })
    it('should normalize a hardened path string up to the account', function() {
      const pathStr = "m/49'/0'/0'"
      const normalizedPath = normalizePath(pathStr)
      normalizedPath.should.equal('m_49__0__0')
    })
    it('should fail to normalize an Airbitz path string that is not complete', function() {
      const pathStr = "m/0"
      const fn = () => normalizePath(pathStr)
      fn.should.throw
    })
    it('should fail to normalize a hardened bip43 path string that is not complete', function() {
      const pathStr = "m/49'/0'"
      const fn = () => normalizePath(pathStr)
      fn.should.throw
    })
  })
  
  describe('makePathFromString', function() {
    it('should return an Airbitz path object from a string', function() {
      const pathStr = "m/0/0/3"
      const path = makePathFromString(pathStr)

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.Airbitz,
        coin: 0,
        isChange: false,
        index: 3,
        scriptType: ScriptTypeEnum.p2pkh,
        addressType: AddressTypeEnum.p2pkh
      })
    })
    it('should return a legacy path object from a string', function() {
      const pathStr = "m/44'/0'/0'/0/0"
      const path = makePathFromString(pathStr)

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.Legacy,
        coin: 0,
        isChange: false,
        index: 0,
        scriptType: ScriptTypeEnum.p2pkh,
        addressType: AddressTypeEnum.p2pkh
      })
    })
    it('should return a wrapped segwit path object from a string', function() {
      const pathStr = "m/49'/0'/0'/0/10"
      const path = makePathFromString(pathStr)

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.WrappedSegwit,
        coin: 0,
        isChange: false,
        index: 10,
        scriptType: ScriptTypeEnum.p2wpkhp2sh,
        addressType: AddressTypeEnum.p2sh
      })
    })
    it('should return a segwit path object from a string', function() {
      const pathStr = "m/84'/0'/0'/1/4"
      const path = makePathFromString(pathStr)

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.Segwit,
        coin: 0,
        isChange: true,
        index: 4,
        scriptType: ScriptTypeEnum.p2wpkh,
        addressType: AddressTypeEnum.p2wpkh
      })
    })
  })

  describe('makePath', function() {
    it('should return a path object from a coin name config', function() {
      const coinName = 'dogecoin'
      const path = makePath({
        purpose: BIP43PurposeTypeEnum.Legacy,
        index: 0,
        coinName
      })

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.Legacy,
        isChange: false,
        index: 0,
        coin: getCoinFromString(coinName).coinType,
        scriptType: ScriptTypeEnum.p2pkh,
        addressType: AddressTypeEnum.p2pkh
      })
    })
    it('should return a path object from an Airbitz config', function() {
      const path = makePath({
        purpose: BIP43PurposeTypeEnum.Airbitz,
        coin: 0,
        change: 1,
        index: 0,
      })

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.Airbitz,
        coin: 0,
        isChange: false,
        index: 0,
        scriptType: ScriptTypeEnum.p2pkh,
        addressType: AddressTypeEnum.p2pkh
      })
    })
    it('should return a path object from a legacy config', function() {
      const path = makePath({
        purpose: BIP43PurposeTypeEnum.Legacy,
        coin: 0,
        change: 1,
        index: 0
      })

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.Legacy,
        coin: 0,
        isChange: true,
        index: 0,
        scriptType: ScriptTypeEnum.p2pkh,
        addressType: AddressTypeEnum.p2pkh
      })
    })
    it('should return a path object from a wrapped segwit config', function() {
      const path = makePath({
        purpose: BIP43PurposeTypeEnum.WrappedSegwit,
        coin: 3,
        index: 8
      })

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.WrappedSegwit,
        coin: 3,
        index: 8,
        scriptType: ScriptTypeEnum.p2wpkhp2sh,
        addressType: AddressTypeEnum.p2sh
      })
    })
    it('should return a path object from a segwit config', function() {
      const path = makePath({
        purpose: BIP43PurposeTypeEnum.Segwit,
        coin: 8,
        change: 1,
        index: 100
      })

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.Segwit,
        coin: 8,
        isChange: true,
        index: 100,
        scriptType: ScriptTypeEnum.p2wpkh,
        addressType: AddressTypeEnum.p2wpkh
      })
    })
  })

  describe('clone', function() {
    it('should clone a path values into a new object', function() {
      const path = makePath({
        purpose: BIP43PurposeTypeEnum.Segwit,
        coin: 8,
        index: 100
      })
      const clone = path.clone()
      validatePathValues(clone, {
        purpose: BIP43PurposeTypeEnum.Segwit,
        coin: 8,
        index: 100,
        scriptType: ScriptTypeEnum.p2wpkh,
        addressType: AddressTypeEnum.p2wpkh
      })
    })
  })

  describe('getChangePath', function() {
    describe('Airbitz format', function() {
      it('should return null since Airbitz paths do not have a change path', function() {
        const path = makePath({
          purpose: BIP43PurposeTypeEnum.Airbitz,
          coin: 0,
          index: 100
        })
        const changePath = path.getChangePath()
        chai.expect(changePath).to.be.undefined
      })
    })
    describe('bip43 format', function() {
      it('should return a path object with the same config but for the change path', function() {
        const path = makePath({
          purpose: BIP43PurposeTypeEnum.Segwit,
          coin: 0,
          change: 0,
          index: 100
        })
        const changePath = path.getChangePath() as Path
        validatePathValues(path, {
          purpose: BIP43PurposeTypeEnum.Segwit,
          coin: 0,
          index: 100,
          isChange: false,
          scriptType: ScriptTypeEnum.p2wpkh,
          addressType: AddressTypeEnum.p2wpkh
        })
        validatePathValues(changePath, {
          purpose: BIP43PurposeTypeEnum.Segwit,
          coin: 0,
          index: 100,
          isChange: true,
          scriptType: ScriptTypeEnum.p2wpkh,
          addressType: AddressTypeEnum.p2wpkh
        })
      })
    })
  })

  describe('goTo', function() {
    it('should be able to update the index', function() {
      const newIndex = 1234
      const path = makePathFromString("m/44'/0'/0'/0/0")
      path.goTo(newIndex)
      path.index.should.equal(newIndex)
    })
  })

  describe('next', function() {
    it('should go to the next sequential index #1', function() {
      const path = makePathFromString("m/44'/0'/0'/0/0")
      path.next()
      path.index.should.equal(1)
    })
    it('should go to the next sequential index #2', function() {
      const path = makePathFromString("m/44'/0'/0'/0/88")
      path.next()
      path.index.should.equal(89)
    })
  })

  describe('toAccount', function() {
    describe('Airbitz format', function() {
      it('should return the string representation of the path up to the account index', function() {
        const path = makePathFromString("m/0/0/12")
        const accountStr = path.toAccount()
        accountStr.should.to.equal("m/0/0")
      })
      it('should return the normalized string representation of the path up to the account index', function() {
        const path = makePathFromString("m/0/0/43")
        const accountStr = path.toAccount(true)
        accountStr.should.to.equal("m_0_0")
      })
    })
    describe('bip43 format', function() {
      it('should return the string representation of the path up to the account index', function() {
        const path = makePathFromString("m/44'/0'/0'/0/0")
        const accountStr = path.toAccount()
        accountStr.should.to.equal("m/44'/0'/0'")
      })
      it('should return the normalized string representation of the path up to the account index', function() {
        const path = makePathFromString("m/44'/0'/0'/0/0")
        const accountStr = path.toAccount(true)
        accountStr.should.to.equal("m_44__0__0")
      })
    })
  })

  describe('toPrefix', function() {
    describe('Airbitz format', function() {
      it('should return the string representation of the path up to the prefix', function() {
        const path = makePathFromString("m/0/0/12")
        const accountStr = path.toPrefix()
        accountStr.should.to.equal("m/0/0")
      })
      it('should return the normalized string representation of the path up to the prefix', function() {
        const path = makePathFromString("m/0/0/42")
        const accountStr = path.toPrefix(true)
        accountStr.should.to.equal("m_0_0")
      })
    })
    describe('bip43 format', function() {
      it('should return the string representation of the path up to the prefix', function() {
        const path = makePathFromString("m/44'/0'/0'/0/0")
        const accountStr = path.toPrefix()
        accountStr.should.to.equal("m/44'/0'/0'/0")
      })
      it('should return the normalized string representation of the path up to the prefix', function() {
        const path = makePathFromString("m/44'/0'/0'/0/0")
        const accountStr = path.toPrefix(true)
        accountStr.should.to.equal("m_44__0__0__0")
      })
    })
  })

  describe('toString', function() {
    describe('Airbitz format', function() {
      it('should return the string representation of the path up to the address index', function() {
        const path = makePathFromString("m/0/0/2")
        const accountStr = path.toString()
        accountStr.should.to.equal("m/0/0/2")
      })
      it('should return the normalized string representation of the path up to the address index', function() {
        const path = makePathFromString("m/0/0/42")
        const accountStr = path.toString(true)
        accountStr.should.to.equal("m_0_0___42")
      })
    })
    describe('bip43 format', function() {
      it('should return the string representation of the path up to the address index', function() {
        const path = makePathFromString("m/44'/0'/0'/0/2")
        const accountStr = path.toString()
        accountStr.should.to.equal("m/44'/0'/0'/0/2")
      })
      it('should return the normalized string representation of the path up to the address index', function() {
        const path = makePathFromString("m/44'/0'/0'/1/23")
        const accountStr = path.toString(true)
        accountStr.should.to.equal("m_44__0__0__1___23")
      })
    })
  })
})

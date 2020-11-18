import * as chai from 'chai'

import { makePath, makePathFromString, normalizePath, Path } from '../../src/common/Path'
import { BIP43PurposeTypeEnum } from '../../src/common/utxobased/keymanager/keymanager'
import { getCoinFromString } from '../../src/common/utxobased/keymanager/coinmapper'

chai.should()

describe('Path', function() {
  function validatePathValues(path: Path, expectedValues: any) {
    path.purpose.should.equal(expectedValues.purpose)
    path.coin.should.equal(expectedValues.coin)
    path.account.should.equal(expectedValues.account)
    path.change.should.equal(expectedValues.change)
    path.index.should.equal(expectedValues.index)
  }

  describe('normalizePath', function() {
    it('should normalize a full hardened path string', function() {
      const pathStr = "m/49'/0'/0'/0/0"
      const normalizedPath = normalizePath(pathStr)
      normalizedPath.should.equal('m_49__0__0__0___0')
    })
    it('should normalize a hardened path string up to the change', function() {
      const pathStr = "m/49'/0'/0'/0"
      const normalizedPath = normalizePath(pathStr)
      normalizedPath.should.equal('m_49__0__0__0')
    })
    it('should normalize a hardened path string up to the account', function() {
      const pathStr = "m/49'/0'/0'"
      const normalizedPath = normalizePath(pathStr)
      normalizedPath.should.equal('m_49__0__0')
    })
    it('should fail to normalize a hardened path string that is not complete', function() {
      const pathStr = "m/49'/0'"
      const normalizedPath = normalizePath(pathStr)
      normalizedPath.should.equal(pathStr)
    })
  })
  
  describe('makePathFromString', function() {
    it('should return a legacy path object from a string', function() {
      const pathStr = "m/44'/0'/0'/0/0"
      const path = makePathFromString(pathStr)

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.Legacy,
        coin: 0,
        account: 0,
        change: 0,
        index: 0
      })
    })
    it('should return a wrapped segwit path object from a string', function() {
      const pathStr = "m/49'/0'/1'/0/10"
      const path = makePathFromString(pathStr)

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.WrappedSegwit,
        coin: 0,
        account: 1,
        change: 0,
        index: 10
      })
    })
    it('should return a segwit path object from a string', function() {
      const pathStr = "m/84'/0'/0'/1/4"
      const path = makePathFromString(pathStr)

      validatePathValues(path, {
        purpose: BIP43PurposeTypeEnum.Segwit,
        coin: 0,
        account: 0,
        change: 1,
        index: 4
      })
    })
  })

  describe('makePath', function() {
    it('should return a path object from a coin name config', function() {
      const coinName = 'dogecoin'
      const config = {
        purpose: BIP43PurposeTypeEnum.Legacy,
        account: 0,
        change: 0,
        index: 0
      }
      const path = makePath({
        ...config,
        coinName
      })

      validatePathValues(path, {
        ...config,
        coin: getCoinFromString(coinName).coinType,
      })
    })
    it('should return a path object from a legacy config', function() {
      const config = {
        purpose: BIP43PurposeTypeEnum.Legacy,
        coin: 0,
        account: 0,
        change: 0,
        index: 0
      }
      const path = makePath(config)

      validatePathValues(path, config)
    })
    it('should return a path object from a wrapped segwit config', function() {
      const config = {
        purpose: BIP43PurposeTypeEnum.WrappedSegwit,
        coin: 3,
        account: 10,
        change: 1,
        index: 8
      }
      const path = makePath(config)

      validatePathValues(path, config)
    })
    it('should return a path object from a segwit config', function() {
      const config = {
        purpose: BIP43PurposeTypeEnum.Segwit,
        coin: 8,
        account: 1,
        change: 0,
        index: 100
      }
      const path = makePath(config)

      validatePathValues(path, config)
    })
  })

  describe('clone', function() {
    it('should clone a path values into a new object', function() {
      const config = {
        purpose: BIP43PurposeTypeEnum.Segwit,
        coin: 8,
        account: 1,
        change: 0,
        index: 100
      }
      const path = makePath(config)
      const clone = path.clone()
      validatePathValues(path, clone)
    })
  })

  describe('goTo', function() {
    it('should be able to update the index', function() {
      const newIndex = 1234
      const path = makePathFromString("m/44'/0'/0'/0/0")
      path.goTo(newIndex)
      path.index.should.equal(newIndex)
    })
    it('should be able to update the index and change', function() {
      const newIndex = 1234
      const newChange = 1
      const path = makePathFromString("m/44'/0'/0'/0/0")
      path.goTo(newIndex, newChange)
      path.index.should.equal(newIndex)
      path.change.should.equal(newChange)
    })
  })

  describe('goToChange', function() {
    it('should update the change', function() {
      const newChange = 2
      const path = makePathFromString("m/44'/0'/0'/0/0")
      path.goToChange(newChange)
      path.change.should.equal(newChange)
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
    it('should return the string representation of the path up to the account', function() {
      const path = makePathFromString("m/44'/0'/0'/0/0")
      const accountStr = path.toAccount()
      accountStr.should.to.equal("m/44'/0'/0'")
    })
    it('should return the normalized string representation of the path up to the account', function() {
      const path = makePathFromString("m/44'/0'/0'/0/0")
      const accountStr = path.toAccount(true)
      accountStr.should.to.equal("m_44__0__0")
    })
  })

  describe('toChange', function() {
    it('should return the string representation of the path up to the change', function() {
      const path = makePathFromString("m/44'/0'/0'/0/0")
      const accountStr = path.toChange()
      accountStr.should.to.equal("m/44'/0'/0'/0")
    })
    it('should return the normalized string representation of the path up to the change', function() {
      const path = makePathFromString("m/44'/0'/0'/0/0")
      const accountStr = path.toChange(true)
      accountStr.should.to.equal("m_44__0__0__0")
    })
  })

  describe('toString', function() {
    it('should return the string representation of the path up to the account', function() {
      const path = makePathFromString("m/44'/0'/0'/0/0")
      const accountStr = path.toString()
      accountStr.should.to.equal("m/44'/0'/0'/0/0")
    })
    it('should return the normalized string representation of the path up to the account', function() {
      const path = makePathFromString("m/44'/0'/0'/0/0")
      const accountStr = path.toString(true)
      accountStr.should.to.equal("m_44__0__0__0___0")
    })
  })
})
const cloneDeep = require('lodash.clonedeep')
const deepFreeze = require('deep-freeze')
const expect = require('expect.js')
const yajsondiff = require('.')
const { diff, applyChanges, revertChanges } = yajsondiff

describe('yaDiff', function () {
  const empty = {}

  describe('A target that has no properties', function () {
    it('shows no differences when compared to another empty object', function () {
      expect(diff({}, {})).to.be(null)
      expect(diff('foo', 'foo')).to.be(null)
      expect(diff(undefined, undefined)).to.be(null)
      expect(diff({ foo: null }, { foo: null })).to.be(null)
      expect(diff({ foo: undefined }, { foo: undefined })).to.be(null)
    })

    describe('when compared to a different type of keyless object', function () {
      const comparandTuples = [
        ['an array', {
          key: []
        }],
        ['an object', {
          key: {}
        }],
        ['a date', {
          key: new Date()
        }],
        ['a null', {
          key: null
        }],
        ['a regexp literal', {
          key: /a/
        }],
        ['Math', {
          key: Math
        }]
      ]

      comparandTuples.forEach(function (lhsTuple) {
        comparandTuples.forEach(function (rhsTuple) {
          if (lhsTuple[0] === rhsTuple[0]) {
            return
          }
          it('shows differences when comparing ' + lhsTuple[0] + ' to ' + rhsTuple[0], function () {
            const differences = diff(lhsTuple[1], rhsTuple[1])
            expect(differences).to.be.ok()
            expect(differences.length).to.be(1)
            expect(differences[0]).to.have.property('kind')
            expect(differences[0].kind).to.be('E')
          })
        })
      })
    })

    describe('when compared with an object having other properties', function () {
      const comparand = {
        other: 'property',
        another: 13.13
      }
      const differences = diff(empty, comparand)

      it('the differences are reported', function () {
        expect(differences).to.be.ok()
        expect(differences.length).to.be(2)

        expect(differences[0]).to.have.property('kind')
        expect(differences[0].kind).to.be('N')
        expect(differences[0]).to.have.property('path')
        expect(differences[0].path).to.be.an(Array)
        expect(differences[0].path[0]).to.eql('other')
        expect(differences[0]).to.have.property('rhs')
        expect(differences[0].rhs).to.be('property')

        expect(differences[1]).to.have.property('kind')
        expect(differences[1].kind).to.be('N')
        expect(differences[1]).to.have.property('path')
        expect(differences[1].path).to.be.an(Array)
        expect(differences[1].path[0]).to.eql('another')
        expect(differences[1]).to.have.property('rhs')
        expect(differences[1].rhs).to.be(13.13)
      })

    })

  })

  describe('A target that has one property', function () {
    const lhs = {
      one: 'property'
    }

    it('shows no differences when compared to itself', function () {
      expect(diff(lhs, lhs)).to.be(null)
    })

    it('shows the property as removed when compared to an empty object', function () {
      const differences = diff(lhs, empty)
      expect(differences).to.be.ok()
      expect(differences.length).to.be(1)
      expect(differences[0]).to.have.property('kind')
      expect(differences[0].kind).to.be('D')
    })

    it('shows the property as edited when compared to an object with null', function () {
      const differences = diff(lhs, {
        one: null
      })
      expect(differences).to.be.ok()
      expect(differences.length).to.be(1)
      expect(differences[0]).to.have.property('kind')
      expect(differences[0].kind).to.be('E')
    })

    it('shows the property as edited when compared to an array', function () {
      const differences = diff(lhs, ['one'])
      expect(differences).to.be.ok()
      expect(differences.length).to.be(1)
      expect(differences[0]).to.have.property('kind')
      expect(differences[0].kind).to.be('E')
    })

  })

  describe('A target that has null value', function () {
    const lhs = {
      key: null
    }

    it('shows no differences when compared to itself', function () {
      expect(diff(lhs, lhs)).to.be(null)
    })

    it('shows the property as removed when compared to an empty object', function () {
      const differences = diff(lhs, empty)
      expect(differences).to.be.ok()
      expect(differences.length).to.be(1)
      expect(differences[0]).to.have.property('kind')
      expect(differences[0].kind).to.be('D')
    })

    it('shows the property is changed when compared to an object that has value', function () {
      const differences = diff(lhs, {
        key: 'value'
      })
      expect(differences).to.be.ok()
      expect(differences.length).to.be(1)
      expect(differences[0]).to.have.property('kind')
      expect(differences[0].kind).to.be('E')
    })

    it('shows that an object property is changed when it is set to null', function () {
      lhs.key = {
        nested: 'value'
      }
      const differences = diff(lhs, {
        key: null
      })
      expect(differences).to.be.ok()
      expect(differences.length).to.be(1)
      expect(differences[0]).to.have.property('kind')
      expect(differences[0].kind).to.be('E')
    })

  })


  describe('A target that has a date value', function () {
    const lhs = {
      key: new Date(555555555555)
    }

    it('shows the property is changed with a new date value', function () {
      const differences = diff(lhs, {
        key: new Date(777777777777)
      })
      expect(differences).to.be.ok()
      expect(differences.length).to.be(1)
      expect(differences[0]).to.have.property('kind')
      expect(differences[0].kind).to.be('E')
    })

  })


  describe('A target that has a NaN', function () {
    const lhs = {
      key: NaN
    }

    it('shows the property is changed when compared to another number', function () {
      const differences = diff(lhs, {
        key: 0
      })
      expect(differences).to.be.ok()
      expect(differences.length).to.be(1)
      expect(differences[0]).to.have.property('kind')
      expect(differences[0].kind).to.be('E')
    })

    it('shows no differences when compared to another NaN', function () {
      const differences = diff(lhs, {
        key: NaN
      })
      expect(differences).to.be(null)
    })

  })

  describe('When filtering keys', function () {
    const lhs = {
      enhancement: 'Filter/Ignore Keys?',
      numero: 11,
      submittedBy: 'ericclemmons',
      supportedBy: ['ericclemmons'],
      status: 'open'
    }
    const rhs = {
      enhancement: 'Filter/Ignore Keys?',
      numero: 11,
      submittedBy: 'ericclemmons',
      supportedBy: [
        'ericclemmons',
        'TylerGarlick',
        'flitbit',
        'ergdev'
      ],
      status: 'closed',
      fixedBy: 'flitbit'
    }

    describe('if the filtered property is an array', function () {

      it('changes to the array do not appear as a difference', function () {
        const prefilter = function (_, key) {
          return key === 'supportedBy'
        }
        const differences = diff(lhs, rhs, prefilter)
        expect(differences).to.be.ok()
        expect(differences.length).to.be(2)
        expect(differences[0]).to.have.property('kind')
        expect(differences[0].kind).to.be('E')
        expect(differences[1]).to.have.property('kind')
        expect(differences[1].kind).to.be('N')
      })

    })

    describe('if the filtered property is not an array', function () {

      it('changes do not appear as a difference', function () {
        const prefilter = function (_, key) {
          return key === 'fixedBy'
        }
        const differences = diff(lhs, rhs, prefilter)
        expect(differences).to.be.ok()
        expect(differences.length).to.be(4)
        expect(differences[0]).to.have.property('kind')
        expect(differences[0].kind).to.be('A')
        expect(differences[1]).to.have.property('kind')
        expect(differences[1].kind).to.be('A')
        expect(differences[2]).to.have.property('kind')
        expect(differences[2].kind).to.be('A')
        expect(differences[3]).to.have.property('kind')
        expect(differences[3].kind).to.be('E')
      })

    })
  })

  describe('A target that has nested values', function () {
    const nestedOne = {
      noChange: 'same',
      levelOne: {
        levelTwo: 'value'
      },
      arrayOne: [{
        objValue: 'value'
      }]
    }
    const nestedTwo = {
      noChange: 'same',
      levelOne: {
        levelTwo: 'another value'
      },
      arrayOne: [{
        objValue: 'new value'
      }, {
        objValue: 'more value'
      }]
    }

    it('shows no differences when compared to itself', function () {
      expect(diff(nestedOne, nestedOne)).to.be(null)
    })

    it('shows the property as removed when compared to an empty object', function () {
      const differences = diff(nestedOne, empty)
      expect(differences).to.be.ok()
      expect(differences.length).to.be(3)
      expect(differences[0]).to.have.property('kind')
      expect(differences[0].kind).to.be('D')
      expect(differences[1]).to.have.property('kind')
      expect(differences[1].kind).to.be('D')
    })

    it('shows the property is changed when compared to an object that has value', function () {
      const differences = diff(nestedOne, nestedTwo)
      expect(differences).to.be.ok()
      expect(differences.length).to.be(3)
    })

    it('shows the property as added when compared to an empty object on left', function () {
      const differences = diff(empty, nestedOne)
      expect(differences).to.be.ok()
      expect(differences.length).to.be(3)
      expect(differences[0]).to.have.property('kind')
      expect(differences[0].kind).to.be('N')
    })

    describe('when diff is applied to a different empty object', function () {
      const differences = diff(nestedOne, nestedTwo)

      it('has result with nested values', function () {
        const result = applyChanges({}, differences[0])
        expect(result.levelOne).to.be.ok()
        expect(result.levelOne).to.be.an('object')
        expect(result.levelOne.levelTwo).to.be.ok()
        expect(result.levelOne.levelTwo).to.eql('another value')
      })

      it('has result with array object values', function () {
        const result = applyChanges({}, differences[2])
        expect(result.arrayOne).to.be.ok()
        expect(result.arrayOne).to.be.an('array')
        expect(result.arrayOne[0]).to.be.ok()
        expect(result.arrayOne[0].objValue).to.be.ok()
        expect(result.arrayOne[0].objValue).to.equal('new value')
      })

      it('has result with added array objects', function () {
        const result = applyChanges({}, differences[1])
        expect(result.arrayOne).to.be.ok()
        expect(result.arrayOne).to.be.an('array')
        expect(result.arrayOne[1]).to.be.ok()
        expect(result.arrayOne[1].objValue).to.be.ok()
        expect(result.arrayOne[1].objValue).to.equal('more value')
      })
    })
  })

  describe('can apply a diff between two arrays', function () {
    const lhs = ['a', 'b', 'c', 'd']
    const rhs = ['a', 'c']

    it('can apply diffs between two top level arrays', function () {
      const changes = diff(lhs, rhs)

      expect(applyChanges(lhs, changes)).to.eql(['a', 'c'])
    })
  })

  describe('Comparing regexes should work', function () {
    const lhs = /foo/
    const rhs = /foo/i

    it('can compare regex instances', function () {
      const differences = diff(lhs, rhs)

      expect(differences.length).to.be(1)

      expect(differences[0].kind).to.be('E')
      expect(differences[0].path).to.not.be.ok()
      expect(differences[0].lhs).to.be('/foo/')
      expect(differences[0].rhs).to.be('/foo/i')
    })
  })

  describe('subject.toString is not a function', function () {
    const lhs = {
      left: 'yes',
      right: 'no',
    }
    const rhs = {
      left: {
        toString: true,
      },
      right: 'no',
    }

    it('should not throw a TypeError', function () {
      expect(diff(lhs, rhs).length).to.be(1)
    })
  })

  describe('can differentiate an object\'s key with undefined as a value vs the absence of a key', function () {

    it('should detect a difference with undefined property on lhs', function () {
      const differences = diff({ foo: undefined }, {})

      expect(differences).to.be.an(Array)
      expect(differences.length).to.be(1)

      expect(differences[0].kind).to.be('D')
      expect(differences[0].path).to.be.an('array')
      expect(differences[0].path).to.have.length(1)
      expect(differences[0].path[0]).to.be('foo')
      expect(differences[0].lhs).to.be(undefined)

    })

    it('should detect a difference with undefined property on rhs', function () {
      const differences = diff({}, { foo: undefined })

      expect(differences).to.be.an(Array)
      expect(differences.length).to.be(1)

      expect(differences[0].kind).to.be('N')
      expect(differences[0].path).to.be.an('array')
      expect(differences[0].path).to.have.length(1)
      expect(differences[0].path[0]).to.be('foo')
      expect(differences[0].rhs).to.be(undefined)

    })
  })

  describe('Can safely handle diffing nulls and undefineds', function () {
    it('should not throw a TypeError', function () {
      const patches = diff(null, undefined)
      expect(patches).to.eql([{ kind: 'D', lhs: null }])
      // todo this can't happen yet
      // expect(applyChanges(null, patches)).to.be(undefined)
      // expect(revertChanges(undefined, patches)).to.be(null)
    })

    it('should not throw a TypeError', function () {

      const differences = diff(Object.create(null), { foo: undefined })

      expect(differences).to.be.an(Array)
      expect(differences.length).to.be(1)

      expect(differences[0].kind).to.be('N')
      expect(differences[0].rhs).to.be(undefined)
    })
  })

  describe('Applying and reverting changes should be non mutative', function () {
    it('should not modify the change object', function () {
      const change1 = { kind: 'N', path: ['foo'], rhs: {} }
      const change2 = { kind: 'N', path: ['foo', 'bar'], rhs: 'bug' }
      const clone1 = cloneDeep(change1)
      const clone2 = cloneDeep(change2)
      const target = applyChanges({}, [clone1, clone2])
      expect(Object.keys(target)).to.eql(['foo'])
      expect(Object.keys(target.foo)).to.eql(['bar'])
      expect(change1).to.eql(clone1)
      expect(change2).to.eql(clone2)
    })

    const changeFail = { kind: 'E', path: ['foo'], lhs: true, rhs: false }
    const changeSucceed = { kind: 'E', path: ['foo'], lhs: 1, rhs: 3 }
    const revertLHSFalsey = { kind: 'E', path: ['foo'], lhs: -1, rhs: 1 }
    const revertBothFalsey = { kind: 'E', path: ['foo'], lhs: -1, rhs: -3 }
    const revertLHSTruthy = { kind: 'E', path: ['foo'], lhs: 1, rhs: 3 }
    const revertBothTruthy = { kind: 'E', path: ['foo'], lhs: 1, rhs: 3 }
    it('applies changes correctly when the new value is truthy', function() {
      const result = applyChanges({ foo: changeSucceed.lhs }, changeSucceed)
      expect(result.foo).to.equal(changeSucceed.rhs)
    })
    it('applies changes correctly when the new value is falsey', function() {
      const result = applyChanges({ foo: changeFail.lhs }, changeFail)
      expect(result.foo).to.equal(changeFail.rhs)
    })
    it('reverts changes correctly when both values are truthy', function() {
      const result = revertChanges({ foo: 'hello' }, revertBothTruthy)
      expect(result.foo).to.equal(revertBothTruthy.lhs)
    })
    it('reverts changes correctly when both values are falsey', function() {
      const result = revertChanges({ foo: 'hello' }, revertBothFalsey)
      expect(result.foo).to.equal(revertBothFalsey.lhs)
    })
    it('reverts changes correctly when the new value is truthy', function() {
      const result = revertChanges({ foo: revertLHSTruthy.rhs }, revertLHSTruthy)
      expect(result.foo).to.equal(revertLHSTruthy.lhs)
    })
    it('reverts changes correctly when the new value is falsey', function() {
      const result = revertChanges({ foo: revertLHSFalsey.rhs }, revertLHSFalsey)
      expect(result.foo).to.equal(revertLHSFalsey.lhs)
    })
  })

  describe('integration tests', () => {
    it('ignores empty patches', () => {
      expect(applyChanges({}, undefined)).to.eql({})
      expect(applyChanges({}, null)).to.eql({})
      expect(applyChanges({}, [])).to.eql({})
      expect(applyChanges({}, [null])).to.eql({})
      expect(applyChanges({}, [undefined])).to.eql({})
      expect(revertChanges({}, null)).to.eql({})
      expect(revertChanges({}, undefined)).to.eql({})
      expect(revertChanges({}, [])).to.eql({})
      expect(revertChanges({}, [null])).to.eql({})
      expect(revertChanges({}, [undefined])).to.eql({})
    })

    it('object key order does not matter', function () {
      const obj1 = {
        foo: 'bar',
        faz: [
          1,
          'pie',
          {
            food: 'yum'
          }
        ]
      }

      const obj2 = {
        faz: [
          1,
          'pie',
          {
            food: 'yum'
          },
        ],
        foo: 'bar'
      }
      expect(diff(obj1, obj2)).to.be(null)
      expect(applyChanges(obj1, null)).to.eql(obj2)
      expect(revertChanges(obj2, null)).to.eql(obj1)
    })

    it('array order does matter', function () {
      const obj1 = {
        foo: 'bar',
        faz: [
          'pie',
          1,
          {
            food: 'yum'
          }
        ]
      }

      const obj2 = {
        faz: [
          1,
          'pie',
          {
            food: 'yum'
          },
        ],
        foo: 'bar'
      }
      const differences = diff(obj1, obj2)
      expect(differences).to.eql([ { path: [ 'faz', 1 ], kind: 'E', lhs: 1, rhs: 'pie' },
      { path: [ 'faz', 0 ], kind: 'E', lhs: 'pie', rhs: 1 } ])
      expect(applyChanges(obj1, differences)).to.eql(obj2)
      expect(revertChanges(obj2, differences)).to.eql(obj1)
    })

    it('works on frozen objects', function () {
      const obj1 = deepFreeze({
        foo: 'bar',
        faz: [
          'pie',
          1,
          {
            food: 'yum'
          }
        ]
      })

      const obj2 = deepFreeze({
        faz: [
          1,
          'pie',
          {
            food: 'yum'
          },
        ],
        foo: 'bar'
      })
      const differences = diff(obj1, obj2)
      expect(differences).to.eql([ { path: [ 'faz', 1 ], kind: 'E', lhs: 1, rhs: 'pie' }, { path: [ 'faz', 0 ], kind: 'E', lhs: 'pie', rhs: 1 } ])
      deepFreeze(differences)
      expect(applyChanges(obj1, differences)).to.eql(obj2)
      expect(revertChanges(obj2, differences)).to.eql(obj1)
    })
    it('reverting can handle complex objects', () => {
      const before = {
        name: 'my object',
        description: 'it\'s an object!',
        details: {
          it: 'has',
          an: 'array',
          with: ['a', 'few', 'elements']
        }
      }

      const after = {
        name: 'updated object',
        description: 'it\'s an object!',
        details: {
          it: 'has',
          an: 'array',
          with: ['a', 'few', 'more', 'elements', { than: 'before' }]
        }
      }

      const differences = diff(before, after)
      expect(applyChanges(before, differences)).to.eql(after)
      expect(revertChanges(after, differences)).to.eql(before)
    })
    it('Differences in nested arrays are detected', function () {
      const lhs = {
        id: 'Release',
        phases: [{
          id: 'Phase1',
          tasks: [{
            id: 'Task1'
          }, {
            id: 'Task2'
          }]
        }, {
          id: 'Phase2',
          tasks: [{
            id: 'Task3'
          }]
        }]
      }
      const rhs = {
        id: 'Release',
        phases: [{
          // E: Phase1 -> Phase2
          id: 'Phase2',
          tasks: [{
            id: 'Task3'
          }]
        }, {
          id: 'Phase1',
          tasks: [{
            id: 'Task1'
          }, {
            id: 'Task2'
          }]
        }]
      }
      const differences = diff(lhs, rhs)

      // there should be differences
      expect(differences).to.be.ok()
      expect(differences.length).to.be(6)
      expect(applyChanges(lhs, differences)).to.eql(rhs)
      expect(revertChanges(rhs, differences)).to.eql(lhs)
    })

  })

})

# yajsondiff

**yajsondiff** is Yet Another Json Diffing library. It is a Typescript fork of [Deep Diff](https://github.com/flitbit/diff). It's API has been paired down, simplified, and is now non-destructive and always returns new objects in applying and reverting changes.

[![CircleCI](https://circleci.com/gh/bustle/yajsondiff.svg?style=svg)](https://circleci.com/gh/bustle/yajsondiff)
[![NPM](https://nodei.co/npm/yajsondiff.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/yajsondiff/)

## Install
```bash
npm install yajsondiff
```

## Features
* Get the structural differences between two objects.
* Differences can be applied and reverted.

## Installation
```bash
npm install yajsondiff
```

### Usage
```typescript
import { diff, applyChanges, revertChanges } from 'yajsondiff'
import assert from 'assert'

const original = {
  name: 'my object',
  description: 'it\'s an object!',
  details: {
    it: 'has',
    an: 'array',
    with: ['a', 'few', 'elements']
  }
}

const updated = {
  name: 'updated object',
  description: 'it\'s an object!',
  details: {
    it: 'has',
    an: 'array',
    with: ['a', 'few', 'more', 'elements', { than: 'before' }]
  }
}

const differences = diff(original, updated)
assert.deepEqual(applyChanges(original, differences), updated)
assert.deepEqual(revertChanges(updated, differences), original)
```

## API Documentation
* `diff(lhs, rhs, prefilter): Change[] | null` - calculates the differences between two objects, optionally prefiltering elements for comparison, and optionally using the specified accumulator.
* `applyChanges(target: any, changes: Change | Change[] | null): any` - applies a single change or an array array of changes to a target object.
* `revertChanges(target: any, changes: Change | Change[] | null): any` - reverts a single change or an array array of changes to a target object.

#### Arguments

* `lhs` - the left-hand operand; the origin object.
* `rhs` - the right-hand operand; the object being compared structurally with the origin object.
* `prefilter` - an optional function that determines whether difference analysis should continue down the object graph.

Returns either an array of changes or `null`.

#### Differences
Differences are reported as one or more change records. Change records have the following structure:

* `kind` - indicates the kind of change; will be one of the following:
  * `N` - indicates a newly added property/element
  * `D` - indicates a property/element was deleted
  * `E` - indicates a property/element was edited
  * `A` - indicates a change occurred within an array
* `path` - the property path (from the left-hand-side root)
* `lhs` - the value on the left-hand-side of the comparison (undefined if kind === 'N')
* `rhs` - the value on the right-hand-side of the comparison (undefined if kind === 'D')
* `index` - when kind === 'A', indicates the array index where the change occurred
* `item` - when kind === 'A', contains a nested change record indicating the change that occurred at the array index

Change records are generated for all structural differences between `origin` and `comparand`. The methods only consider an object's own properties and array elements; those inherited from an object's prototype chain are not considered.

Changes to arrays are recorded simplistically. We care most about the shape of the structure; therefore we don't take the time to determine if an object moved from one slot in the array to another. Instead, we only record the structural
differences. If the structural differences are applied from the `comparand` to the `origin` then the two objects will compare as "deep equal" using most `isEqual` implementations such as found in [lodash](https://github.com/bestiejs/lodash) or [underscore](http://underscorejs.org/).

```typescript
import { diff, applyChanges, revertChanges } from 'yajsondiff'
import assert from 'assert'

const original = {
  name: 'my object',
  description: 'it\'s an object!',
  details: {
    it: 'has',
    an: 'array',
    with: ['a', 'few', 'elements']
  }
}

const updated = {
  name: 'updated object',
  description: 'it\'s an object!',
  details: {
    it: 'has',
    an: 'array',
    with: ['a', 'few', 'more', 'elements', { than: 'before' }]
  }
}

console.log(diff(original, updated))
[ { kind: 'E',
    path: [ 'name' ],
    lhs: 'my object',
    rhs: 'updated object' },
  { kind: 'E',
    path: [ 'details', 'with', 2 ],
    lhs: 'elements',
    rhs: 'more' },
  { kind: 'A',
    path: [ 'details', 'with' ],
    index: 3,
    item: { kind: 'N', rhs: 'elements' } },
  { kind: 'A',
    path: [ 'details', 'with' ],
    index: 4,
    item: { kind: 'N', rhs: { than: 'before' } } } ]
```

#### Pre-filtering Object Properties

The `prefilter`'s signature should be `function(path, key)` and it should return a truthy value for any `path`-`key` combination that should be filtered. If filtered, the difference analysis does no further analysis of on the identified object-property path.

```typescript
import { diff } from 'yajsondiff'
import assert from 'assert'

const data = {
  issue: 126,
  submittedBy: 'abuzarhamza',
  title: 'readme.md need some additional example prefilter',
  posts: [
    {
      date: '2018-04-16',
      text: `additional example for prefilter for yajsondiff would be great.`
    }
  ]
}

const clone = JSON.parse(JSON.stringify(data))
clone.title = 'README.MD needs additional example illustrating how to prefilter'
clone.disposition = 'completed'

const two = diff(data, clone)
const none = diff(data, clone,
  (path, key) => path.length === 0 && ~['title', 'disposition'].indexOf(key)
)

assert.equal(two.length, 2, 'should reflect two differences')
assert.ok(none == null, 'should reflect no differences')
```

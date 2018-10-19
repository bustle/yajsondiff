import cloneDeep from 'lodash.clonedeep'

abstract class BaseDiff {
  readonly kind: string
  readonly path: any[] | undefined
  constructor(path: any[] | undefined) {
    if (path) {
      if (Array.isArray(path) && !path.length) {
        return
      }
      this.path = path
    }
  }
}

class EditDiff extends BaseDiff {
  readonly kind = 'E'
  readonly lhs: any
  readonly rhs: any
  constructor(path: any[] | undefined, origin: any, value: any) {
    super(path)
    this.lhs = origin
    this.rhs = value
  }
}

class NewDiff extends BaseDiff {
  readonly kind = 'N'
  readonly rhs: any
  constructor(path: any[] | undefined, value: any) {
    super(path)
    this.rhs = value
  }
}

class DeleteDiff extends BaseDiff {
  readonly kind = 'D'
  readonly lhs: any
  constructor(path: any[] | undefined, origin: any) {
    super(path)
    this.lhs = origin
  }
}

class ArrayDiff extends BaseDiff {
  readonly index: number
  readonly item: any
  readonly kind = 'A'
  constructor(path: any[] | undefined, index: number, item: any) {
    super(path)
    this.index = index
    this.item = item
  }
}

type Change = EditDiff | NewDiff | DeleteDiff | ArrayDiff

function arrayRemove(arr: any[], from: number, to?: number) {
  const rest = arr.slice((to || from) + 1 || arr.length)
  arr.length = from < 0 ? arr.length + from : from
  arr.push.apply(arr, rest)
  return arr
}

function realTypeOf(subject: any) {
  const type = typeof subject
  if (type !== 'object') {
    return type
  }

  if (subject === Math) {
    return 'math'
  } else if (subject === null) {
    return 'null'
  } else if (Array.isArray(subject)) {
    return 'array'
  } else if (Object.prototype.toString.call(subject) === '[object Date]') {
    return 'date'
  } else if (typeof subject.toString === 'function' && /^\/.*\//.test(subject.toString())) {
    return 'regexp'
  }
  return 'object'
}

// http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
function hashThisString(str: string) {
  let hash = 0
  if (str.length === 0) {
    return hash
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

// Gets a hash of the given object in an array order-independent fashion
// also object key order independent (easier since they can be alphabetized)
export function getOrderIndependentHash(object: any) {
  let accum = 0
  const type = realTypeOf(object)

  if (type === 'array') {
    for (const item of object) {
      // Addition is commutative so this is order indep
      accum += getOrderIndependentHash(item)
    }

    const arrayString = '[type: array, hash: ' + accum + ']'
    return accum + hashThisString(arrayString)
  }

  if (type === 'object') {
    for (const key in object) {
      if (object.hasOwnProperty(key)) {
        const keyValueString =
          '[ type: object, key: ' + key + ', value hash: ' + getOrderIndependentHash(object[key]) + ']'
        accum += hashThisString(keyValueString)
      }
    }

    return accum
  }

  // Non object, non array...should be good?
  const stringToHash = '[ type: ' + type + ' ; value: ' + object + ']'
  return accum + hashThisString(stringToHash)
}

interface DeepDiffOptions {
  readonly changes?: Change[]
  readonly key?: any
  readonly lhs: any
  readonly orderIndependent?: boolean
  readonly path?: string[]
  readonly prefilter?: (path: any, key: any) => void
  readonly rhs: any
  readonly stack?: any[]
}

export function deepDiff({
  lhs,
  rhs,
  changes = [],
  prefilter,
  path = [],
  key,
  stack = [],
  orderIndependent = false,
}: DeepDiffOptions) {
  const currentPath = path.slice(0)
  if (typeof key !== 'undefined' && key !== null) {
    if (prefilter && prefilter(currentPath, key)) {
      return
    }
    currentPath.push(key)
  }
  // Use string comparison for regexes
  if (realTypeOf(lhs) === 'regexp' && realTypeOf(rhs) === 'regexp') {
    lhs = lhs.toString()
    rhs = rhs.toString()
  }

  const lType = typeof lhs
  const rType = typeof rhs

  const lDefined =
    lType !== 'undefined' ||
    (stack &&
      stack.length &&
      stack[stack.length - 1].lhs &&
      Object.getOwnPropertyDescriptor(stack[stack.length - 1].lhs, key))
  const rDefined =
    rType !== 'undefined' ||
    (stack &&
      stack.length &&
      stack[stack.length - 1].rhs &&
      Object.getOwnPropertyDescriptor(stack[stack.length - 1].rhs, key))

  if (!lDefined && rDefined) {
    changes.push(new NewDiff(currentPath, rhs))
  } else if (!rDefined && lDefined) {
    changes.push(new DeleteDiff(currentPath, lhs))
  } else if (realTypeOf(lhs) !== realTypeOf(rhs)) {
    changes.push(new EditDiff(currentPath, lhs, rhs))
  } else if (realTypeOf(lhs) === 'date' && lhs - rhs !== 0) {
    changes.push(new EditDiff(currentPath, lhs, rhs))
  } else if (lType === 'object' && lhs !== null && rhs !== null) {
    let reachedBottomOfStack
    for (let i = stack.length - 1; i > -1; i--) {
      if (stack[i].lhs === lhs) {
        reachedBottomOfStack = true
        break
      }
    }
    if (!reachedBottomOfStack) {
      stack.push({ lhs, rhs })
      if (Array.isArray(lhs)) {
        // If order doesn't matter, we need to sort our arrays
        if (orderIndependent) {
          lhs.sort((a: any, b: any) => getOrderIndependentHash(a) - getOrderIndependentHash(b))
          rhs.sort((a: any, b: any) => getOrderIndependentHash(a) - getOrderIndependentHash(b))
        }
        let i = rhs.length - 1
        let j = lhs.length - 1
        while (i > j) {
          changes.push(new ArrayDiff(currentPath, i, new NewDiff(undefined, rhs[i--])))
        }
        while (j > i) {
          changes.push(new ArrayDiff(currentPath, j, new DeleteDiff(undefined, lhs[j--])))
        }
        for (; i >= 0; i--) {
          deepDiff({ lhs: lhs[i], rhs: rhs[i], changes, prefilter, path: currentPath, key: i, stack, orderIndependent })
        }
      } else {
        const lhsKeys = Object.keys(lhs)
        const rhsKeys: Array<string | null> = Object.keys(rhs)
        for (let i = 0; i < lhsKeys.length; i++) {
          const k = lhsKeys[i]
          const indexOfRhsKey = rhsKeys.indexOf(k)
          if (indexOfRhsKey >= 0) {
            deepDiff({
              lhs: lhs[k],
              rhs: rhs[k],
              changes,
              prefilter,
              path: currentPath,
              key: k,
              stack,
              orderIndependent,
            })
            rhsKeys[indexOfRhsKey] = null
          } else {
            deepDiff({
              lhs: lhs[k],
              rhs: undefined,
              changes,
              prefilter,
              path: currentPath,
              key: k,
              stack,
              orderIndependent,
            })
          }
        }
        for (let i = 0; i < rhsKeys.length; i++) {
          const k = rhsKeys[i]
          if (k) {
            deepDiff({
              lhs: undefined,
              rhs: rhs[k],
              changes,
              prefilter,
              path: currentPath,
              key: k,
              stack,
              orderIndependent,
            })
          }
        }
      }
      stack.length = stack.length - 1
    } else if (lhs !== rhs) {
      // lhs is contains a cycle at this element and it differs from rhs
      changes.push(new EditDiff(currentPath, lhs, rhs))
    }
  } else if (lhs !== rhs) {
    if (!(lType === 'number' && isNaN(lhs) && isNaN(rhs))) {
      changes.push(new EditDiff(currentPath, lhs, rhs))
    }
  }
}

interface ObservableDiffOptions {
  readonly lhs: any
  readonly observer?: (change: any) => void
  readonly orderIndependent?: boolean
  readonly prefilter?: (path: any, key: any) => void
  readonly rhs: any
}

export function observableDiff({ lhs, rhs, observer, prefilter, orderIndependent }: ObservableDiffOptions) {
  const changes: any[] = []
  deepDiff({ lhs, rhs, changes, prefilter, orderIndependent })
  if (observer) {
    for (const change of changes) {
      observer(change)
    }
  }
  return changes
}

interface OrderIndependentDeepDiffOptions {
  readonly changes?: Change[]
  readonly key?: any
  readonly lhs: any
  readonly path?: string[]
  readonly prefilter?: (path: any, key: any) => void
  readonly rhs: any
  readonly stack?: any[]
}

export function orderIndependentDeepDiff({
  lhs,
  rhs,
  changes,
  prefilter,
  path,
  key,
  stack,
}: OrderIndependentDeepDiffOptions) {
  return deepDiff({ lhs, rhs, changes, prefilter, path, key, stack, orderIndependent: true })
}

interface AccumulateDiffOptions {
  readonly accum?: any[]
  readonly lhs: any
  readonly prefilter?: (path: any, key: any) => void
  readonly rhs: any
}
function accumulateDiff({ lhs, rhs, prefilter, accum }: AccumulateDiffOptions) {
  const observer = accum
    ? (difference: any) => {
        if (difference) {
          accum.push(difference)
        }
      }
    : undefined
  const changes = observableDiff({ lhs, rhs, observer, prefilter })
  return accum ? accum : changes.length ? changes : undefined
}

export function accumulateOrderIndependentDiff({ lhs, rhs, prefilter, accum }: AccumulateDiffOptions) {
  const observer = accum
    ? (difference: any) => {
        if (difference) {
          accum.push(difference)
        }
      }
    : undefined
  const changes = observableDiff({ lhs, rhs, observer, prefilter, orderIndependent: true })
  return accum ? accum : changes.length ? changes : undefined
}

interface ArrayChangeOptions {
  readonly arr: any[]
  readonly change: Change
  readonly index: number
}

export function applyArrayChange({ arr, index, change }: ArrayChangeOptions) {
  if (change.path && change.path.length) {
    let it = arr[index]
    let i
    for (i = 0; i < change.path.length - 1; i++) {
      it = it[change.path[i]]
    }
    switch (change.kind) {
      case 'A':
        applyArrayChange({ arr: it[change.path[i]], index: change.index, change: change.item })
        break
      case 'D':
        delete it[change.path[i]]
        break
      case 'E':
      case 'N':
        it[change.path[i]] = change.rhs
        break
    }
  } else {
    switch (change.kind) {
      case 'A':
        applyArrayChange({ arr: arr[index], index: change.index, change: change.item })
        break
      case 'D':
        arr = arrayRemove(arr, index)
        break
      case 'E':
      case 'N':
        arr[index] = change.rhs
        break
    }
  }
  return arr
}

function applyChange(target: any, change: Change) {
  if (target && change && change.kind) {
    let it = target
    let i = -1
    const last = change.path ? change.path.length - 1 : 0
    while (++i < last) {
      if (!change.path) {
        throw new Error('There must be a path to continue down tree')
      }
      if (typeof it[change.path[i]] === 'undefined') {
        it[change.path[i]] =
          typeof change.path[i + 1] !== 'undefined' && typeof change.path[i + 1] === 'number' ? [] : {}
      }
      it = it[change.path[i]]
    }
    switch (change.kind) {
      case 'A':
        if (change.path && typeof it[change.path[i]] === 'undefined') {
          it[change.path[i]] = []
        }
        applyArrayChange({ arr: change.path ? it[change.path[i]] : it, index: change.index, change: change.item })
        break
      case 'D':
        if (!change.path) {
          throw new Error('There must be a path to delete')
        }
        delete it[change.path[i]]
        break
      case 'E':
      case 'N':
        if (!change.path) {
          throw new Error('There must be a path to set')
        }
        it[change.path[i]] = change.rhs
        break
    }
  }
}

export function applyChanges(target: any, changes: Change | Change[]) {
  const targetClone = cloneDeep(target)
  changes = Array.isArray(changes) ? changes : [changes]
  for (const change of changes) {
    const changeClone = cloneDeep(change)
    applyChange(targetClone, changeClone)
  }
  return targetClone
}

export function revertArrayChange({ arr, index, change }: ArrayChangeOptions) {
  if (change.path && change.path.length) {
    // the structure of the object at the index has changed...
    let it = arr[index]
    let i
    for (i = 0; i < change.path.length - 1; i++) {
      it = it[change.path[i]]
    }
    switch (change.kind) {
      case 'A':
        revertArrayChange({ arr: it[change.path[i]], index: change.index, change: change.item })
        break
      case 'D':
        it[change.path[i]] = change.lhs
        break
      case 'E':
        it[change.path[i]] = change.lhs
        break
      case 'N':
        delete it[change.path[i]]
        break
    }
  } else {
    // the array item is different...
    switch (change.kind) {
      case 'A':
        revertArrayChange({ arr: arr[index], index: change.index, change: change.item })
        break
      case 'D':
        arr[index] = change.lhs
        break
      case 'E':
        arr[index] = change.lhs
        break
      case 'N':
        arr = arrayRemove(arr, index)
        break
    }
  }
  return arr
}

function revertChange(target: any, change: Change) {
  if (target && change && change.kind) {
    if (!change.path) {
      throw new Error("This change doesn't have a path")
    }
    let i
    for (i = 0; i < change.path.length - 1; i++) {
      if (typeof target[change.path[i]] === 'undefined') {
        target[change.path[i]] = {}
      }
      target = target[change.path[i]]
    }
    switch (change.kind) {
      case 'A':
        // Array was modified...
        // it will be an array...
        revertArrayChange({ arr: target[change.path[i]], index: change.index, change: change.item })
        break
      case 'D':
        // Item was deleted...
        target[change.path[i]] = change.lhs
        break
      case 'E':
        // Item was edited...
        target[change.path[i]] = change.lhs
        break
      case 'N':
        // Item is new...
        delete target[change.path[i]]
        break
    }
  }
}

export function revertChanges(target: any, changes: Change | Change[]) {
  const targetClone = cloneDeep(target)
  changes = Array.isArray(changes) ? changes : [changes]
  for (const change of changes) {
    const changeClone = cloneDeep(change)
    revertChange(targetClone, changeClone)
  }
  return targetClone
}

interface ApplyDiffOptions {
  readonly filter?: (target: any, source: any, change: Change) => any
  readonly source: any
  readonly target: any
}

export function applyDiff({ target, source, filter }: ApplyDiffOptions) {
  if (target && source) {
    const onChange = (change: Change) => {
      if (!filter || filter(target, source, change)) {
        applyChange(target, change)
      }
    }
    observableDiff({ lhs: target, rhs: source, observer: onChange })
  }
}

export default function(original: any, updated: any, prefilter?: (path: any, key: any) => void, accum?: any[]) {
  return accumulateDiff({ lhs: original, rhs: updated, prefilter, accum })
}

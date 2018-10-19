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

interface DeepDiffOptions {
  readonly changes?: Change[]
  readonly key?: any
  readonly lhs: any
  readonly path?: string[]
  readonly prefilter?: (path: any, key: any) => void
  readonly rhs: any
  readonly stack?: any[]
}

function deepDiff({ lhs, rhs, changes = [], prefilter, path = [], key, stack = [] }: DeepDiffOptions) {
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
        let rhsLength = rhs.length - 1
        let lhsLength = lhs.length - 1
        while (rhsLength > lhsLength) {
          changes.push(new ArrayDiff(currentPath, rhsLength, new NewDiff(undefined, rhs[rhsLength--])))
        }
        while (lhsLength > rhsLength) {
          changes.push(new ArrayDiff(currentPath, lhsLength, new DeleteDiff(undefined, lhs[lhsLength--])))
        }
        for (; rhsLength >= 0; rhsLength--) {
          deepDiff({
            lhs: lhs[rhsLength],
            rhs: rhs[rhsLength],
            changes,
            prefilter,
            path: currentPath,
            key: rhsLength,
            stack,
          })
        }
      } else {
        const lhsKeys = Object.keys(lhs)
        const rhsKeys: Array<string | null> = Object.keys(rhs)
        for (const lhsKey of lhsKeys) {
          const indexOfRhsKey = rhsKeys.indexOf(lhsKey)
          if (indexOfRhsKey >= 0) {
            deepDiff({
              lhs: lhs[lhsKey],
              rhs: rhs[lhsKey],
              changes,
              prefilter,
              path: currentPath,
              key: lhsKey,
              stack,
            })
            rhsKeys[indexOfRhsKey] = null
          } else {
            deepDiff({
              lhs: lhs[lhsKey],
              rhs: undefined,
              changes,
              prefilter,
              path: currentPath,
              key: lhsKey,
              stack,
            })
          }
        }
        for (const rhsKey of rhsKeys) {
          if (rhsKey) {
            deepDiff({
              lhs: undefined,
              rhs: rhs[rhsKey],
              changes,
              prefilter,
              path: currentPath,
              key: rhsKey,
              stack,
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

  return changes
}

function applyArrayChange(arr: any[], index: number, change: Change) {
  if (change.path && change.path.length) {
    let it = arr[index]
    let i
    for (i = 0; i < change.path.length - 1; i++) {
      it = it[change.path[i]]
    }
    switch (change.kind) {
      case 'A':
        applyArrayChange(it[change.path[i]], change.index, change.item)
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
        applyArrayChange(arr[index], change.index, change.item)
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
        applyArrayChange(change.path ? it[change.path[i]] : it, change.index, change.item)
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

function revertArrayChange(arr: any[], index: number, change: Change) {
  if (change.path && change.path.length) {
    // the structure of the object at the index has changed...
    let it = arr[index]
    let i
    for (i = 0; i < change.path.length - 1; i++) {
      it = it[change.path[i]]
    }
    switch (change.kind) {
      case 'A':
        revertArrayChange(it[change.path[i]], change.index, change.item)
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
        revertArrayChange(arr[index], change.index, change.item)
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
        revertArrayChange(target[change.path[i]], change.index, change.item)
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

export function applyChanges(target: any, changes: Change | Change[]) {
  const targetClone = cloneDeep(target)
  changes = Array.isArray(changes) ? changes : [changes]
  for (const change of changes) {
    const changeClone = cloneDeep(change)
    applyChange(targetClone, changeClone)
  }
  return targetClone
}

export default function(original: any, updated: any, prefilter?: (path: any, key: any) => void) {
  const differences = deepDiff({ lhs: original, rhs: updated, prefilter })
  return differences.length ? differences : undefined
}

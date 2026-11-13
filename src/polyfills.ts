/**
 * Comprehensive Polyfills for KaiOS 2.5.3.2 (Gecko 48 / Firefox 48)
 * Polyfills all post-Firefox-48 Web APIs and ECMAScript intrinsics
 * used by React 19, React DOM, and the game engine.
 */

(function initGecko48Polyfills() {
  if (typeof window === 'undefined') return;
  const win = window as unknown as Record<string, unknown>;

  // 1. globalThis (Firefox 65+)
  if (typeof win.globalThis === 'undefined') {
    win.globalThis = window;
  }

  // 2. Symbol.toStringTag (Firefox 51+)
  if (typeof Symbol !== 'undefined' && !(Symbol as unknown as Record<string, unknown>).toStringTag) {
    try {
      Object.defineProperty(Symbol, 'toStringTag', {
        value: Symbol('toStringTag'),
      });
    } catch {
      // ignore if frozen
    }
  }

  // 3. Object.getOwnPropertyDescriptors (Firefox 50+ — used in React 19 bundle)
  if (typeof Object.getOwnPropertyDescriptors !== 'function') {
    (Object as unknown as Record<string, unknown>).getOwnPropertyDescriptors = function <T>(
      obj: T
    ): PropertyDescriptorMap {
      if (obj === null || obj === undefined) {
        throw new TypeError('Cannot convert undefined or null to object');
      }
      const target = Object(obj);
      const keys: Array<string | symbol> = Object.getOwnPropertyNames(target);
      if (typeof Object.getOwnPropertySymbols === 'function') {
        const syms = Object.getOwnPropertySymbols(target);
        for (let i = 0; i < syms.length; i++) {
          keys.push(syms[i]);
        }
      }
      const descriptors: PropertyDescriptorMap = {};
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const d = Object.getOwnPropertyDescriptor(target, key);
        if (d !== undefined) {
          (descriptors as Record<string | symbol, PropertyDescriptor>)[key] = d;
        }
      }
      return descriptors;
    };
  }

  // 4. Object.values / Object.entries / Object.fromEntries
  if (typeof Object.values !== 'function') {
    Object.values = function <T>(obj: { [s: string]: T } | ArrayLike<T>): T[] {
      const keys = Object.keys(obj);
      const out: T[] = [];
      for (let i = 0; i < keys.length; i++) {
        out.push((obj as Record<string, T>)[keys[i]]);
      }
      return out;
    };
  }

  if (typeof Object.entries !== 'function') {
    Object.entries = function <T>(obj: { [s: string]: T } | ArrayLike<T>): [string, T][] {
      const keys = Object.keys(obj);
      const out: [string, T][] = [];
      for (let i = 0; i < keys.length; i++) {
        out.push([keys[i], (obj as Record<string, T>)[keys[i]]]);
      }
      return out;
    };
  }

  if (typeof Object.fromEntries !== 'function') {
    Object.fromEntries = function (entries: Iterable<readonly [PropertyKey, any]>): any {
      const obj: Record<PropertyKey, any> = {};
      const arr = Array.from(entries as unknown as ArrayLike<[PropertyKey, any]>);
      for (let i = 0; i < arr.length; i++) {
        const pair = arr[i];
        if (pair && pair.length >= 2) {
          obj[pair[0]] = pair[1];
        }
      }
      return obj;
    };
  }

  // 5. Promise.allSettled (Firefox 71+ — referenced in React 19) & Promise.prototype.finally (Firefox 58+)
  if (typeof Promise !== 'undefined') {
    if (typeof Promise.allSettled !== 'function') {
      (Promise as unknown as Record<string, unknown>).allSettled = function (
        promises: Iterable<any>
      ): Promise<any[]> {
        const list = Array.from(promises as unknown as ArrayLike<any>);
        return Promise.all(
          list.map(function (p) {
            return Promise.resolve(p).then(
              function (value) {
                return { status: 'fulfilled', value: value };
              },
              function (reason) {
                return { status: 'rejected', reason: reason };
              }
            );
          })
        );
      };
    }

    if (typeof Promise.prototype.finally !== 'function') {
      Promise.prototype.finally = function <T>(this: Promise<T>, onFinally?: (() => void) | null): Promise<T> {
        const P = this.constructor as PromiseConstructor;
        return this.then(
          function (value) {
            return P.resolve(typeof onFinally === 'function' ? onFinally() : undefined).then(function () {
              return value;
            });
          },
          function (reason) {
            return P.resolve(typeof onFinally === 'function' ? onFinally() : undefined).then(function () {
              throw reason;
            });
          }
        );
      };
    }
  }

  // 6. queueMicrotask (Firefox 69+ — required by React 19 scheduler/reconciler)
  if (typeof win.queueMicrotask !== 'function') {
    const resolvedPromise = typeof Promise !== 'undefined' ? Promise.resolve() : null;
    win.queueMicrotask = function (callback: () => void) {
      if (resolvedPromise) {
        resolvedPromise.then(callback).catch(function (err) {
          setTimeout(function () {
            throw err;
          }, 0);
        });
      } else {
        setTimeout(callback, 0);
      }
    };
  }

  // 7. reportError (Firefox 95+ — used by React 19 error reporting)
  if (typeof win.reportError !== 'function') {
    win.reportError = function (error: unknown) {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(error);
      }
    };
  }

  // 8. AbortController & AbortSignal (Firefox 57+ — referenced by React 19)
  if (typeof win.AbortController === 'undefined') {
    class PolyfillAbortSignal {
      public aborted = false;
      public reason: unknown = undefined;
      public onabort: ((this: PolyfillAbortSignal, ev: Event) => unknown) | null = null;
      private listeners: Array<(ev: Event) => void> = [];

      public addEventListener(type: string, listener: (ev: Event) => void): void {
        if (type === 'abort' && this.listeners.indexOf(listener) === -1) {
          this.listeners.push(listener);
        }
      }

      public removeEventListener(type: string, listener: (ev: Event) => void): void {
        if (type === 'abort') {
          const idx = this.listeners.indexOf(listener);
          if (idx !== -1) this.listeners.splice(idx, 1);
        }
      }

      public dispatchEvent(ev: Event): boolean {
        if (typeof this.onabort === 'function') {
          this.onabort.call(this, ev);
        }
        for (let i = 0; i < this.listeners.length; i++) {
          this.listeners[i](ev);
        }
        return true;
      }

      public throwIfAborted(): void {
        if (this.aborted) {
          throw this.reason || new Error('Aborted');
        }
      }
    }

    class PolyfillAbortController {
      public signal: PolyfillAbortSignal;
      constructor() {
        this.signal = new PolyfillAbortSignal();
      }
      public abort(reason?: unknown): void {
        if (this.signal.aborted) return;
        this.signal.aborted = true;
        this.signal.reason = reason !== undefined ? reason : new Error('AbortError');
        const ev = typeof Event === 'function' ? new Event('abort') : ({ type: 'abort' } as Event);
        this.signal.dispatchEvent(ev);
      }
    }

    win.AbortSignal = PolyfillAbortSignal;
    win.AbortController = PolyfillAbortController;
  }

  // 9. Array.prototype.includes & String.prototype.replaceAll / padStart / padEnd / trimStart / trimEnd
  if (!Array.prototype.includes) {
    Array.prototype.includes = function <T>(this: T[], searchElement: T, fromIndex?: number): boolean {
      const len = this.length >>> 0;
      if (len === 0) return false;
      const n = (fromIndex || 0) | 0;
      let k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
      while (k < len) {
        if (this[k] === searchElement || (Number.isNaN(this[k]) && Number.isNaN(searchElement))) {
          return true;
        }
        k++;
      }
      return false;
    };
  }

  const strProto = String.prototype as String & {
    replaceAll?: (searchValue: string | RegExp, replaceValue: string | ((substring: string, ...args: any[]) => string)) => string;
    padStart?: (targetLength: number, padString?: string) => string;
    padEnd?: (targetLength: number, padString?: string) => string;
    trimStart?: () => string;
    trimEnd?: () => string;
    trimLeft?: () => string;
    trimRight?: () => string;
  };

  if (typeof strProto.replaceAll !== 'function') {
    strProto.replaceAll = function (this: string, search: string | RegExp, replacement: any): string {
      if (search instanceof RegExp) {
        if (search.flags.indexOf('g') === -1) {
          throw new TypeError('String.prototype.replaceAll called with a non-global RegExp argument');
        }
        return this.replace(search, replacement);
      }
      return this.split(String(search)).join(replacement);
    };
  }

  if (typeof strProto.padStart !== 'function') {
    strProto.padStart = function (this: string, targetLength: number, padString?: string): string {
      const len = targetLength >> 0;
      const filler = String(padString !== undefined ? padString : ' ');
      if (this.length >= len || filler.length === 0) return String(this);
      let padLen = len - this.length;
      let repeated = '';
      while (repeated.length < padLen) repeated += filler;
      return repeated.slice(0, padLen) + String(this);
    };
  }

  if (typeof strProto.padEnd !== 'function') {
    strProto.padEnd = function (this: string, targetLength: number, padString?: string): string {
      const len = targetLength >> 0;
      const filler = String(padString !== undefined ? padString : ' ');
      if (this.length >= len || filler.length === 0) return String(this);
      let padLen = len - this.length;
      let repeated = '';
      while (repeated.length < padLen) repeated += filler;
      return String(this) + repeated.slice(0, padLen);
    };
  }

  if (typeof strProto.trimStart !== 'function') {
    strProto.trimStart =
      strProto.trimLeft ||
      function (this: string): string {
        return this.replace(/^\s+/, '');
      };
  }

  if (typeof strProto.trimEnd !== 'function') {
    strProto.trimEnd =
      strProto.trimRight ||
      function (this: string): string {
        return this.replace(/\s+$/, '');
      };
  }

  // 10. Element.prototype.matches & Element.prototype.closest & NodeList.prototype.forEach
  if (typeof Element !== 'undefined') {
    const proto = Element.prototype as unknown as Record<string, unknown>;
    if (typeof proto.matches !== 'function') {
      proto.matches =
        proto.mozMatchesSelector ||
        proto.webkitMatchesSelector ||
        function (this: Element, s: string): boolean {
          const matches = (this.ownerDocument || document).querySelectorAll(s);
          let i = matches.length;
          while (--i >= 0 && matches.item(i) !== this) {
            // continue
          }
          return i > -1;
        };
    }
    if (typeof proto.closest !== 'function') {
      proto.closest = function (this: Element, s: string): Element | null {
        let el: Element | null = this;
        do {
          if (el.matches(s)) return el;
          el = el.parentElement || (el.parentNode as Element | null);
        } while (el !== null && el.nodeType === 1);
        return null;
      };
    }
  }

  if (typeof NodeList !== 'undefined' && NodeList.prototype && !NodeList.prototype.forEach) {
    (NodeList.prototype as unknown as { forEach: unknown }).forEach = Array.prototype.forEach;
  }

  // 11. Safe performance User Timing methods
  if (typeof performance !== 'undefined') {
    const perf = performance as unknown as Record<string, unknown>;
    if (typeof perf.measure !== 'function') perf.measure = function () {};
    if (typeof perf.clearMeasures !== 'function') perf.clearMeasures = function () {};
    if (typeof perf.getEntriesByType !== 'function') {
      perf.getEntriesByType = function () {
        return [];
      };
    }
  }
})();

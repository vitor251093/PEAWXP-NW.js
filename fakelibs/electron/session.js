/*
  Electron Docs
  https://www.electronjs.org/docs/latest/api/session

  NW.js Docs
  ?

  Manage browser sessions, cookies, cache, proxy settings, etc.
  Only available in the main process.

  ?
*/

const WebRequest = require('./WebRequest')
const throwUnsupportedException = require('./utils/unsupported-exception')

class Session {
    static _sessions = {}


    static defaultSession = new Session({
        name: "",
        persistent: true,
        cache: true
    })
    static fromPartition(partition, opts) {
        if (partition === "") {
            return this.defaultSession
        }
        const shouldPersist = partition.startsWith("persist:")
        if (this._sessions[partition]) {
            return _sessions[partition]
        }
        let session = new Session({
            name: partition,
            persistent: shouldPersist,
            cache: opts?.cache === undefined ? true : opts?.cache
        })
        this._sessions[partition] = session
        return session
    }


    constructor(opts) {
        this.spellCheckerEnabled = false
        this._webRequest = new WebRequest()
        this._name = opts.name
        this._persistent = opts.persistent
        this._enabledCache = opts.cache
    }


    get webRequest() {
        return this._webRequest
    }


    isPersistent() {
        return this._persistent
    }
    setSpellCheckerEnabled(enable) {
        if (enable) {
            throwUnsupportedException("Session.setSpellCheckerEnabled can't accept the value 'true'")
        }
    }
    isSpellCheckerEnabled() {
        return this.spellCheckerEnabled
    }


    _events = {}
    async dispatchEvent(event) {
        let listeners = this._events[event.type] || [];
        listeners.forEach(listener => {
            listener.apply(undefined, event.args);
        })
    }
    on(eventName, listener) {
        this._events[eventName] = this._events[eventName] || []
        this._events[eventName].push(listener);
        return this;
    }
}
module.exports = Session
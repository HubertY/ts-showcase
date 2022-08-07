var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class ContextComponent {
    constructor(name, makeContext) {
        this.name = name;
        this.makeContext = makeContext;
    }
    instantiate(...args) {
        return new this.makeContext(...args);
    }
}
class Script {
    constructor(name, contexts, fun) {
        this.name = name;
        this.contexts = contexts;
        this.fun = fun;
    }
}
class TimeComponent {
    constructor(engine) {
        this.engine = engine;
    }
    now() {
        return this.engine.timestamp;
    }
    waitDuration(t) {
        return this.waitUntil(this.engine.timestamp + t);
    }
    waitUntil(t) {
        return __awaiter(this, void 0, void 0, function* () {
            const prom = makeResolvable();
            this.engine.scheduleWake(t);
            this.engine.yieldFromCurrentExecution((s) => s.timestamp >= t, prom);
            return prom;
        });
    }
}
class ProcessComponent {
    constructor(engine) {
        this.engine = engine;
    }
    spawn(s, ctx, ...args) {
        this.engine.run(s, ctx, ...args);
    }
    execute(s, ctx, ...args) {
        const instance = this.engine.run(s, ctx, ...args);
        const prom = makeResolvable();
        this.engine.yieldFromCurrentExecution(() => instance.done, prom);
        return prom;
    }
}
class BaseContext {
    _add(comp, ...args) {
        this[comp.name] = comp.instantiate(...args);
        return this;
    }
}
function makeResolvable() {
    let out;
    const ret = new Promise((resolve) => { out = () => { resolve(); return ret; }; });
    ret.resolve = out;
    return ret;
}
class ScriptInstance {
    constructor(script, ctx, ...args) {
        this.runtime = undefined;
        this.wake = makeResolvable();
        this.finished = makeResolvable();
        this.done = false;
        this.script = script;
        this.context = ctx;
        this.args = args;
        this.wake.then(() => { this.run(); });
    }
    run() {
        this.runtime = this.script.fun(this.context, ...this.args);
        this.runtime.then(() => { this.finished.resolve(); this.done = true; });
    }
}
class ScriptingEngine {
    constructor() {
        this.timestamp = 0;
        this.scriptInstances = new Set();
        this.flags = new Map();
        this.currentlyExecuting = null;
        this.currentExecution = makeResolvable().resolve();
        this.wakeTimes = [];
        this.forwardTime = 0;
        this.Time = this.createContextComponent("Time", TimeComponent);
        this.Process = this.createContextComponent("Process", ProcessComponent);
    }
    scheduleWake(t) {
        if (t < this.timestamp) {
            throw RangeError("cannot go back in time (yet)");
        }
        for (let i = 0; i < this.wakeTimes.length; i++) {
            if (this.wakeTimes[i] == t) {
                return;
            }
            else if (this.wakeTimes[i] < t) {
                this.wakeTimes.splice(i, 0, t);
                return;
            }
        }
        this.wakeTimes.push(t);
    }
    createContextComponent(name, makeContext) {
        return new ContextComponent(name, makeContext);
    }
    createContext() {
        return new BaseContext()._add(this.Time, this)._add(this.Process, this);
    }
    createEmptyContext() {
        return new BaseContext();
    }
    createScript(name, contexts, fun) {
        return new Script(name, contexts, fun);
    }
    run(script, ctx, ...args) {
        const instance = new ScriptInstance(script, ctx, ...args);
        this.scriptInstances.add(instance);
        this.flags.set(instance, () => true);
        instance.finished.then(() => { this.signalCurrentExecutionDone(); });
        return instance;
    }
    signalCurrentExecutionDone() {
        this.currentlyExecuting = null;
        this.currentExecution.resolve();
    }
    yieldFromCurrentExecution(wakeCondition, trigger) {
        if (this.currentlyExecuting) {
            this.flags.set(this.currentlyExecuting, wakeCondition);
            this.currentlyExecuting.wake = trigger;
            this.signalCurrentExecutionDone();
        }
        else {
            throw new ReferenceError("don't know what script is currently executing! did you forget an await?");
        }
    }
    tick() {
        return __awaiter(this, void 0, void 0, function* () {
            //wake up exactly one script and run it
            for (const script of this.scriptInstances) {
                const flag = this.flags.get(script);
                if (flag && flag(this)) {
                    this.currentlyExecuting = script;
                    this.flags.delete(script);
                    this.currentlyExecuting.wake.resolve();
                    yield this.currentExecution;
                    return true;
                }
            }
            return false;
        });
    }
    tickUntil(t) {
        return __awaiter(this, void 0, void 0, function* () {
            this.forwardTime = t;
            while (yield this.tick())
                ;
            while (this.wakeTimes.length && this.wakeTimes[this.wakeTimes.length - 1] <= t) {
                this.timestamp = this.wakeTimes.pop();
                while (yield this.tick())
                    ;
            }
        });
    }
}
export { ScriptingEngine };

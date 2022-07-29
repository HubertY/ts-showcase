export declare type FilterProperties<Type, Filter> = {
    [Property in keyof Type as Type[Property] extends Filter ? Property : never]: Type[Property];
};
export declare type Rest<A extends unknown[]> = A extends [unknown, ...infer A2] ? A2 : never;
export declare type ExtractComponentName<X extends ContextComponent<any, any[], any>> = X extends ContextComponent<infer S, any, any> ? S : never;
export declare type ExtractComponentFunctions<X extends ContextComponent<any, any[], any>> = X extends ContextComponent<string, any, infer T> ? FilterProperties<T, Function> : {};
export declare type ExtractComponentSchema<X extends ContextComponent<any, any[], any>> = {
    [key in ExtractComponentName<X>]: ExtractComponentFunctions<X>;
};
export declare type Mergify<A extends unknown[]> = A extends [] ? {} : A[0] & Mergify<Rest<A>>;
export declare type ExtractComponentSchemaAndMerge<C extends ContextComponent<any, any[], any>[]> = Mergify<{
    [key in keyof C]: ExtractComponentSchema<C[key]>;
}>;
export declare type ScriptFunction<C extends ContextComponent<any, any, any>[], A extends any[], B extends Promise<any>> = (ctx: ExtractComponentSchemaAndMerge<C>, ...args: A) => B;
export declare type Constructor<A extends unknown[], T> = new (...args: A) => T;
declare class ContextComponent<S extends string, A extends unknown[], T> {
    name: S;
    makeContext: Constructor<A, T>;
    instantiate(...args: A): FilterProperties<T, Function>;
    constructor(name: S, makeContext: Constructor<A, T>);
}
declare class Script<S extends string, C extends ContextComponent<any, any, any>[], A extends any[], B extends Promise<any>> {
    name: S;
    contexts: [...C];
    fun: ScriptFunction<C, A, B>;
    constructor(name: S, contexts: [...C], fun: (ctx: ExtractComponentSchemaAndMerge<C>, ...args: A) => B);
}
declare class TimeComponent {
    engine: ScriptingEngine;
    now(): number;
    waitDuration(t: number): Promise<void>;
    waitUntil(t: number): Promise<void>;
    constructor(engine: ScriptingEngine);
}
declare class ProcessComponent {
    engine: ScriptingEngine;
    spawn<C extends ContextComponent<any, any, any>[], A extends any[], B extends Promise<any>>(s: Script<any, C, A, B>, ctx: ExtractComponentSchemaAndMerge<C>, ...args: A): void;
    execute<C extends ContextComponent<any, any, any>[], A extends any[], B extends Promise<any>>(s: Script<any, C, A, B>, ctx: ExtractComponentSchemaAndMerge<C>, ...args: A): Resolvable;
    constructor(engine: ScriptingEngine);
}
export declare type Context<C> = BaseContext & C;
declare class BaseContext {
    _add<C, S extends string, A extends unknown[], T>(this: Context<C>, comp: ContextComponent<S, A, T>, ...args: A): Context<C & ExtractComponentSchema<ContextComponent<S, A, T>>>;
}
export declare type Resolvable = Promise<void> & {
    resolve: () => Resolvable;
};
declare class ScriptInstance<S extends string, C extends ContextComponent<any, any, any>[], A extends any[], B extends Promise<any>> {
    runtime: B | undefined;
    wake: Resolvable;
    finished: Resolvable;
    done: boolean;
    script: Script<S, C, A, B>;
    context: ExtractComponentSchemaAndMerge<C>;
    args: A;
    run(): void;
    constructor(script: Script<S, C, A, B>, ctx: ExtractComponentSchemaAndMerge<C>, ...args: A);
}
export declare type UnknownScriptInstance = ScriptInstance<any, any, any, any>;
export declare type Flag = (eng: ScriptingEngine) => boolean;
declare class ScriptingEngine {
    timestamp: number;
    scriptInstances: Set<UnknownScriptInstance>;
    flags: Map<UnknownScriptInstance, Flag>;
    currentlyExecuting: UnknownScriptInstance | null;
    currentExecution: Resolvable;
    Time: ContextComponent<"Time", [engine: ScriptingEngine], TimeComponent>;
    Process: ContextComponent<"Process", [engine: ScriptingEngine], ProcessComponent>;
    wakeTimes: number[];
    forwardTime: number;
    scheduleWake(t: number): void;
    createContextComponent<S extends string, A extends any[], T>(name: S, makeContext: Constructor<A, T>): ContextComponent<S, A, T>;
    createContext(): Context<ExtractComponentSchema<ContextComponent<"Time", [this], TimeComponent>> & ExtractComponentSchema<ContextComponent<"Process", [this], ProcessComponent>>>;
    createEmptyContext(): BaseContext;
    createScript<S extends string, C extends ContextComponent<any, any, any>[], A extends any[], B extends Promise<any>>(name: S, contexts: [...C], fun: (ctx: Mergify<{
        [key in keyof C]: ExtractComponentSchema<C[key]>;
    }>, ...args: A) => B): Script<S, C, A, B>;
    run<S extends string, C extends ContextComponent<any, any, any>[], A extends any[], B extends Promise<any>>(script: Script<S, C, A, B>, ctx: ExtractComponentSchemaAndMerge<C>, ...args: A): ScriptInstance<S, C, A, B>;
    signalCurrentExecutionDone(): void;
    yieldFromCurrentExecution(wakeCondition: Flag, trigger: Resolvable): void;
    tick(): Promise<boolean>;
    tickUntil(t: number): Promise<void>;
    constructor();
}
export { ScriptingEngine };
export type { ContextComponent, BaseContext, Script, TimeComponent, ProcessComponent, ScriptInstance };

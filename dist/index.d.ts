declare type CompilerOptions = import("monaco-editor").languages.typescript.CompilerOptions;
import { createTypeScriptSandbox } from "./sandbox/index";
declare type Monaco = typeof import("monaco-editor");
declare global {
    interface Window {
        require: any;
        ts: typeof import("typescript") | undefined;
    }
}
export interface ShowcaseOptions {
    /**options for the Typescript compiler */
    compilerOptions?: CompilerOptions;
    local?: {
        localDeps: string[];
        libDir: string;
    };
    initialCode?: string;
}
export declare class Showcase {
    sandbox: ReturnType<typeof createTypeScriptSandbox> | undefined;
    localScripts: Map<string, string>;
    destroyed: boolean;
    scriptDoc: Document | undefined;
    run(target: Document): Promise<void>;
    destroy(): void;
    focus(): void;
    get editor(): import("monaco-editor").editor.IStandaloneCodeEditor | undefined;
    private initialize;
    constructor(domEle: HTMLElement, opts?: ShowcaseOptions);
}
export declare function init(arg: {
    editor: Monaco;
    ts: typeof import("typescript");
}): void;
export declare function fetchModulesFromCDN(): Promise<{
    editor: Monaco;
    ts: typeof import("typescript");
}>;
export {};

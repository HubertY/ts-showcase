declare type Monaco = typeof import("monaco-editor");
declare type SandboxLib = typeof import("./sandbox");
export declare type ShowcaseInitialization = {
    editor: Monaco;
    sandbox: SandboxLib;
};
declare global {
    interface Window {
        require: any;
        [key: string]: any;
    }
}
declare class Showcase {
    sandbox: ReturnType<SandboxLib["createTypeScriptSandbox"]>;
    localScripts: Map<string, string>;
    run(): Promise<void>;
    focus(): void;
    get editor(): import("monaco-editor").editor.IStandaloneCodeEditor;
    constructor(sandbox: ReturnType<SandboxLib["createTypeScriptSandbox"]>, localScripts?: Map<string, string>);
}
export declare function makeShowcase(inits: ShowcaseInitialization, domID: string, localDeps?: string[], libDir?: string, initialCode?: string): Promise<Showcase>;
export declare function init(sandboxPath: string): Promise<ShowcaseInitialization>;
export {};

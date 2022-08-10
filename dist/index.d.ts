declare type Monaco = typeof import("monaco-editor");
declare type SandboxLib = typeof import("./sandbox");
declare type ShowcaseInitialization = {
    editor: Monaco;
    sandbox: SandboxLib;
};
declare global {
    interface Window {
        require: any;
        [key: string]: any;
    }
}
export declare class Showcase {
    sandbox: ReturnType<SandboxLib["createTypeScriptSandbox"]> | undefined;
    localScripts: Map<string, string>;
    destroyed: boolean;
    scriptDoc: Document | undefined;
    run(): Promise<void>;
    target(doc: Document): void;
    destroy(): void;
    focus(): void;
    get editor(): import("monaco-editor").editor.IStandaloneCodeEditor | undefined;
    private initialize;
    constructor(domEle: HTMLElement, localDeps?: string[], libDir?: string, initialCode?: string);
}
export declare function init(sandboxPath: string): Promise<ShowcaseInitialization>;
export {};

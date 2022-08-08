export declare function directory(url: string): Promise<string[]>;
export declare function massFetch(dir: string, paths: string[], callback: (path: string, data: string) => void): Promise<void>;

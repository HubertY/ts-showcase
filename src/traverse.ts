export async function directory(url: string) {
    return (await (await fetch(url)).json()).paths as string[];
}

export async function massFetch(paths: string[], callback: (path: string, data: string) => void) {
    for (const path of paths) {
        const data = await (await fetch(path)).text();
        callback(path, data);
    }
}


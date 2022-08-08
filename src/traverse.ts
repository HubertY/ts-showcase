export async function directory(url: string) {
    return (await (await fetch(url)).json()).paths as string[];
}

export async function massFetch(dir: string, paths: string[], callback: (path: string, data: string) => void) {
    for (const path of paths) {
        const data = await (await fetch(`${dir}/${path}`)).text();
        callback(path, data);
    }
}


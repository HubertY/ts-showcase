export async function massFetch(directory: string, filter: (s: string) => boolean, callback: (path: string, data: string) => void) {
    // http://localhost:8080
    const dir = await (await fetch(directory)).json();
    console.log(dir);
    const paths: Array<string> = dir.paths.filter(filter);
    for (const path of paths) {
        const data = await (await fetch(path)).text();
        callback(path, data);
    }
}


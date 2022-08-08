var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export function directory(url) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield (yield fetch(url)).json()).paths;
    });
}
export function massFetch(dir, paths, callback) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const path of paths) {
            const data = yield (yield fetch(`${dir}/${path}`)).text();
            callback(path, data);
        }
    });
}

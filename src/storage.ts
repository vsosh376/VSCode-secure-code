import * as path from 'path';
import * as fs from 'fs/promises';

export async function loadMap(dir: string) {
    try {
        const data = await fs.readFile(path.join(dir, '.secret.json'), 'utf-8');
        return JSON.parse(data);
    } catch {
        return null;
    }
}

export async function saveMap(dir: string, map: any) {
    await fs.writeFile(path.join(dir, '.secret.json'), JSON.stringify(map, null, 2));
}

export async function deleteMap(dir: string) {
    try {
        await fs.unlink(path.join(dir, '.secret.json'));
    } catch {}
}

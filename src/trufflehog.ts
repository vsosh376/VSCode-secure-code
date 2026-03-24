import { exec } from 'child_process';
import { promisify } from 'util';
import { basename } from 'path';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

const run = promisify(exec);

export async function scan(dir: string, patterns: string[] = [], keywords: string[] = []) {
    const thDir = path.join(__dirname, '..', 'trufflehog-3.92.5');
    const win = os.platform() === 'win32';

    let cfgFlag = '';
    let tmpFile = '';

    if (patterns.length > 0) {
        const kws = keywords.length > 0 ? keywords : [''];
        const yaml = [
            'detectors:',
            '  - name: custom',
            '    keywords:',
            ...kws.map(k => `      - "${k}"`),
            '    regex:',
            ...patterns.map((p, i) => `      p${i}: '${p.replace(/'/g, "''")}'`),
        ].join('\n') + '\n';
        tmpFile = path.join(os.tmpdir(), `th_cfg_${Date.now()}.yaml`);
        await fs.writeFile(tmpFile, yaml, 'utf-8');
        cfgFlag = `--config="${tmpFile}"`;
    }

    const cmd = win
        ? `powershell -Command "cd '${thDir}'; go run . filesystem '${dir}' --json ${cfgFlag}"`
        : `cd "${thDir}" && go run . filesystem "${dir}" --json ${cfgFlag}`;

    try {
        const { stdout } = await run(cmd, {
            maxBuffer: 10 * 1024 * 1024,
            shell: win ? 'powershell.exe' : '/bin/bash'
        });
        return parse(stdout);
    } catch (e: any) {
        if (e.stdout) return parse(e.stdout);
        throw new Error(e.message);
    } finally {
        if (tmpFile) fs.unlink(tmpFile).catch(() => {});
    }
}

function parse(out: string) {
    const res: any = {};

    for (const line of out.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
            const obj = JSON.parse(t.replace(/\\/g, '\\\\'));
            if (obj.Raw && obj.SourceMetadata?.Data?.Filesystem) {
                const name = basename(obj.SourceMetadata.Data.Filesystem.file);
                if (!res[name]) res[name] = [];
                res[name].push(obj.Raw);
            }
        } catch {}
    }

    return res;
}

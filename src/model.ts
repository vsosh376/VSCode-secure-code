import * as fs from 'fs/promises';
import * as path from 'path';

async function loadConfig() {
    const data = await fs.readFile(path.join(__dirname, '..', 'config.json'), 'utf-8');
    return JSON.parse(data);
}

async function ask(prompt: string, text: string) {
    const cfg = await loadConfig();

    const res = await fetch(cfg.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: cfg['model-name'],
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: text }
            ],
            stream: false
        })
    });

    const data: any = await res.json();
    return data.message.content;
}

export async function findSecrets(code: string) {
    const cfg = await loadConfig();
    const raw = await ask(cfg['master-prompt'], code);
    const checked = await ask(cfg['check-prompt'], raw);

    try {
        return JSON.parse(checked);
    } catch {
        return {};
    }
}

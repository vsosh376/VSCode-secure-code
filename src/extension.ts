import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { scan } from './trufflehog';
import { findSecrets } from './model';
import { hideSecrets, restoreSecrets } from './anon';
import { getCode } from './collector';
import { loadMap, saveMap, deleteMap } from './storage';

let dict: any = null;

async function loadConfig() {
    const data = await fs.readFile(path.join(__dirname, '..', 'config.json'), 'utf-8');
    return JSON.parse(data);
}

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('code-anonymizer.view', new MyView())
    );
}

class MyView implements vscode.WebviewViewProvider {
    async resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = { enableScripts: true };

        const dir = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (dir) dict = await loadMap(dir);

        const show = (loading = false) => {
            const btn = dict ? 'Restore' : 'Hide';
            const saveBtn = dict ? `<button onclick="vscode.postMessage({type:'save'})">Save Dictionary</button>` : '';
            const loader = loading ? `<div class="loading"><div class="spinner"></div><span>Processing...</span></div>` : '';

            webviewView.webview.html = `<!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { padding: 15px; }
                    button {
                        width: 100%; padding: 12px; margin-bottom: 10px;
                        cursor: pointer; border: none; border-radius: 6px;
                        background: #7c3aed; color: white;
                    }
                    button:hover { background: #6d28d9; }
                    button:disabled { opacity: 0.6; }
                    .loading { display: flex; align-items: center; justify-content: center; padding: 10px; background: rgba(124,58,237,0.1); border-radius: 6px; gap: 10px; }
                    .spinner { width: 16px; height: 16px; border: 2px solid rgba(124,58,237,0.3); border-top-color: #7c3aed; border-radius: 50%; animation: spin 0.8s linear infinite; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    .loading span { color: #7c3aed; }
                </style>
            </head>
            <body>
                <button onclick="vscode.postMessage({type:'toggle'})" ${loading ? 'disabled' : ''}>${btn}</button>
                ${loader}
                ${saveBtn}
                <script>
                    const vscode = acquireVsCodeApi();
                </script>
            </body>
            </html>`;
        };

        show();

        webviewView.webview.onDidReceiveMessage(async (msg: any) => {
            if (msg.type === 'toggle') {
                show(true);
                dict ? await doDecrypt() : await doEncrypt();
                show(false);
            } else if (msg.type === 'save') {
                await doSave();
            }
        });
    }
}

async function doEncrypt() {
    const dir = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!dir) return;

    try {
        const cfg = await loadConfig();
        const all: any = {};

        if (cfg.trufflehog === 1) {
            const s1 = await scan(dir, cfg.patterns ?? [], cfg.keywords ?? []);
            for (const [file, list] of Object.entries(s1)) {
                if (!all[file]) all[file] = [];
                for (const s of list as string[]) {
                    if (!all[file].includes(s)) all[file].push(s);
                }
            }
        }

        if (cfg.model === 1) {
            const code = await getCode();
            const s2 = await findSecrets(code);
            for (const [file, list] of Object.entries(s2)) {
                if (!all[file]) all[file] = [];
                for (const s of list as string[]) {
                    if (!(all[file] as string[]).includes(s)) (all[file] as string[]).push(s);
                }
            }
        }

        if (cfg.patterns && cfg.patterns.length > 0) {
            const s3 = await scanPatterns(cfg.patterns);
            for (const [file, list] of Object.entries(s3)) {
                if (!all[file]) all[file] = [];
                for (const s of list as string[]) {
                    if (!(all[file] as string[]).includes(s)) (all[file] as string[]).push(s);
                }
            }
        }

        if (!Object.keys(all).length) return;

        const res = await hideSecrets(all);
        dict = res.map;
    } catch {}
}

async function scanPatterns(patterns: string[]) {
    const res: any = {};
    const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');

    for (const uri of files) {
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const text = doc.getText();
            const name = uri.fsPath.split('/').pop() || uri.fsPath;

            for (const p of patterns) {
                const src = p.replace(/\(\?i\)/g, '');
                const flags = p.includes('(?i)') ? 'gi' : 'g';
                let rx: RegExp;
                try {
                    rx = new RegExp(src, flags);
                } catch { continue; }
                let m;
                while ((m = rx.exec(text)) !== null) {
                    const val = m[0];
                    if (!res[name]) res[name] = [];
                    if (!res[name].includes(val)) res[name].push(val);
                }
            }
        } catch {}
    }

    return res;
}

async function doDecrypt() {
    const dir = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!dir || !dict) return;

    try {
        await restoreSecrets(dict);
        dict = null;
        await deleteMap(dir);
    } catch {}
}

async function doSave() {
    const dir = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!dir || !dict) return;

    try {
        await saveMap(dir, dict);
    } catch {}
}

export function deactivate() {}

import * as vscode from 'vscode';
import { scan } from './trufflehog';
import { findSecrets } from './model';
import { hideSecrets, restoreSecrets } from './anon';
import { getCode } from './collector';
import { loadMap, saveMap, deleteMap } from './storage';

let dict: any = null;

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
        const s1 = await scan(dir);
        const code = await getCode();
        const s2 = await findSecrets(code);

        const all: any = { ...s1 };
        for (const [file, list] of Object.entries(s2)) {
            if (!all[file]) all[file] = [];
            for (const s of list as string[]) {
                if (!all[file].includes(s)) all[file].push(s);
            }
        }

        if (!Object.keys(all).length) return;

        const res = await hideSecrets(all);
        dict = res.map;
    } catch {}
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

import * as vscode from 'vscode';
import * as path from 'path';

export async function getCode() {
    if (!vscode.workspace.workspaceFolders) throw new Error('no workspace');

    const root = vscode.workspace.workspaceFolders[0];
    const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
    let out = '';

    for (const f of files) {
        try {
            const doc = await vscode.workspace.openTextDocument(f);
            const rel = path.relative(root.uri.fsPath, f.fsPath);
            out += `\n\n${rel}\n\n${doc.getText()}`;
        } catch {}
    }

    return out;
}

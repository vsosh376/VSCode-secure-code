import * as vscode from 'vscode';

export async function hideSecrets(secrets: any) {
    const map: any = {};
    let n = 1;
    let changed = 0;

    for (const [name, list] of Object.entries(secrets)) {
        const found = await vscode.workspace.findFiles(`**/${name}`, '**/node_modules/**');

        for (const uri of found) {
            const doc = await vscode.workspace.openTextDocument(uri);
            let text = doc.getText();
            let edited = false;

            for (const s of list as string[]) {
                if (text.includes(s)) {
                    const key = `secret_${n}`;
                    map[key] = s;
                    text = text.replaceAll(s, key);
                    n++;
                    edited = true;
                }
            }

            if (edited) {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), text);
                await vscode.workspace.applyEdit(edit);
                await doc.save();
                changed++;
            }
        }
    }

    return { map, changed };
}

export async function restoreSecrets(map: any) {
    const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');

    for (const uri of files) {
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            let text = doc.getText();
            let edited = false;

            for (const [key, val] of Object.entries(map)) {
                if (text.includes(key)) {
                    text = text.replaceAll(key, val as string);
                    edited = true;
                }
            }

            if (edited) {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), text);
                await vscode.workspace.applyEdit(edit);
                await doc.save();
            }
        } catch {}
    }
}

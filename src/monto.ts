import { commands, ExtensionContext, EventEmitter, Range, Selection, TextDocumentContentProvider, TextEditor, TextEditorRevealType, TextEditorSelectionChangeEvent, Uri, ViewColumn, workspace, window } from 'vscode';
import { NotificationHandler, NotificationType } from 'vscode-jsonrpc';
import { LanguageClient } from 'vscode-languageclient';

export namespace Monto {

    // Products

    export interface Product {
        uri: string;
        name: string;
        language: string;
        content: string;
        rangeMap: RangePair[];

        // Internal fields
        rangeMapST: RangePair[];
        rangeMapTS: RangePair[];
        handleSelectionChange: boolean;
    }

    export interface RangePair {
        sbegin: number; send: number;
        tbegin: number; tend: number;
    }

    namespace PublishProduct {
        export const type = new NotificationType<Product, void>(
            "monto/publishProduct"
        );
    }

    let products = new Map<string, Product>();

    function saveProduct(product: Product) {
        let uri = productToTargetUri(product);
        product.rangeMapST = product.rangeMap.sort((a , b) =>
            (b.tend - b.tbegin) - (a.tend - a.tbegin)
        );
        product.rangeMapTS = product.rangeMap.sort((a , b) =>
            (a.tend - a.tbegin) - (b.tend - b.tbegin)
        );
        products.set(uri.toString(), product);
        product.handleSelectionChange = false;
        montoProvider.onDidChangeEmitter.fire(uri);
    }

    export function showProduct(product: Product) {
        openInEditor(productToTargetUri(product), true);
    }

    function getProduct(uri: Uri): Product {
        let p = products.get(uri.toString());
        if (p === undefined) {
            let range = { sbegin: 0, send: 0, tbegin: 0, tend: 0 };
            return {
                uri: uri.toString(),
                name: "",
                language: "",
                content: "",
                rangeMap: [range],
                rangeMapST: [range],
                rangeMapTS: [range],
                handleSelectionChange: false
            };
        } else {
            return p;
        }
    }

    function productToTargetUri(product: Product): Uri {
        let path = Uri.parse(product.uri).path;
        return Uri.parse(`monto:${path}-${product.name}.${product.language}`);
    }

    function targetUriToSourceUri(uri: Uri): Uri {
        let path = uri.path.substring(0, uri.path.lastIndexOf("-"));
        return Uri.parse(`file:${path}`);
    }

    // Monto URI scheme

    const montoScheme = 'monto';

    const montoProvider = new class implements TextDocumentContentProvider {
        onDidChangeEmitter = new EventEmitter<Uri>();

        provideTextDocumentContent(uri: Uri): string {
            let product = products.get(uri.toString());
            if (product === undefined) {
                return "unknown content";
            } else {
                return product.content;
            }
        }

        get onDidChange() {
            return this.onDidChangeEmitter.event;
        }

        dispose() {
            this.onDidChangeEmitter.dispose();
        }
    };

    // Setup

    export function setup(
            name: string,
            context: ExtensionContext,
            client: LanguageClient,
            handler: NotificationHandler<Product>
        ) {
        window.onDidChangeTextEditorSelection(change => {
            if (isMontoEditor(change.textEditor)) {
                selectLinkedSourceRanges(change);
            }
        });

        context.subscriptions.push(
            commands.registerCommand(`${name}.selectLinkedEditors`, () => {
                selectLinkedTargetRanges();
            })
        );

        context.subscriptions.push(workspace.registerTextDocumentContentProvider(montoScheme, montoProvider));

        client.onReady().then(_ => {
            client.onNotification(PublishProduct.type, product => {
                saveProduct(product);
                handler(product);
            });
        });
    }

    function isMontoEditor(editor: TextEditor): Boolean {
        return editor.document.uri.scheme === 'monto';
    }

    // Source to target linking

    function selectLinkedTargetRanges() {
        let editor = window.activeTextEditor;
        if (editor !== undefined) {
            let sourceEditor = editor;
            let sourceUri = sourceEditor.document.uri.toString();
            let sourceSelections = sourceEditor.selections;
            window.visibleTextEditors.forEach(targetEditor => {
                if (isMontoEditor(targetEditor)) {
                    let targetUri = targetEditor.document.uri;
                    let targetSourceUri = targetUriToSourceUri(targetUri);
                    if (targetSourceUri.toString() === sourceUri) {
                        let product = getProduct(targetUri);
                        let targetSelections =
                        sourceSelections.map(sourceSelection => {
                            return getSelection(product, sourceEditor, sourceSelection, targetEditor, true);
                        });
                        if (targetSelections.length > 0) {
                            product.handleSelectionChange = false;
                            showSelections(targetEditor, targetSelections);
                        }
                    }
                }
            });
        }
    }

    // Target to source linking

    function selectLinkedSourceRanges(change: TextEditorSelectionChangeEvent) {
        let targetEditor = change.textEditor;
        let targetUri = targetEditor.document.uri;
        let sourceUri = targetUriToSourceUri(targetUri);
        openInEditor(sourceUri, false).then(sourceEditor => {
            let product = getProduct(targetUri);
            if (product.handleSelectionChange) {
                let sourceSelections =
                    change.selections.map(targetSelection => {
                        return getSelection(product, targetEditor, targetSelection, sourceEditor, false);
                    });
                if (sourceSelections.length > 0) {
                    showSelections(sourceEditor, sourceSelections);
                }
            } else {
                product.handleSelectionChange = true;
            }
        });
    }

    // Utilities

    function getSelection(product : Product, fromEditor: TextEditor, fromSelection: Selection, toEditor: TextEditor, forward: boolean): Range {
        let fromOffset = fromEditor.document.offsetAt(fromSelection.start);
        let pair = findContainingRange(product, fromOffset, forward);
        if (pair === undefined) {
            return new Range(0, 0, 0, 0);
        } else if (forward) {
            return pairToTargetSelection(toEditor, pair);
        } else {
            return pairToSourceSelection(toEditor, pair);
        }
    }

    function findContainingRange(product : Product, offset: number, forward: boolean): RangePair | undefined {
        if (forward) {
            return product.rangeMapST.find(entry =>
                (entry.sbegin <= offset) && (offset < entry.send)
            );
        } else {
            return product.rangeMapTS.find(entry =>
                (entry.tbegin <= offset) && (offset < entry.tend)
            );
        }
    }

    function pairToSourceSelection(editor: TextEditor, entry: RangePair): Range {
        return pairToSelection(editor, entry.sbegin, entry.send);
    }

    function pairToTargetSelection(editor: TextEditor, entry: RangePair): Range {
        return pairToSelection(editor, entry.tbegin, entry.tend);
    }

    function pairToSelection(editor: TextEditor, start: number, end: number): Range {
        let s = editor.document.positionAt(start);
        let f = editor.document.positionAt(end);
        return new Range(s, f);
    }

    function showSelections(editor: TextEditor, selections: Range[]) {
        window.showTextDocument(
            editor.document,
            {
                preserveFocus: false,
                preview: false
            }
        );
        editor.selections = selections.map(s => new Selection(s.start, s.end));
        editor.revealRange(selections[0], TextEditorRevealType.InCenterIfOutsideViewport);
    }

    function openInEditor(uri: Uri, isTarget: boolean): Thenable<TextEditor>  {
        return window.showTextDocument(
            uri,
            {
                preserveFocus: isTarget,
                viewColumn: isTarget ? ViewColumn.Two : ViewColumn.One,
                preview: false
            }
        );
    }

}

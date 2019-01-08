import { ExtensionContext, EventEmitter, Range, Selection, TextDocumentContentProvider, TextEditor, TextEditorRevealType, TextEditorSelectionChangeEvent, Uri, ViewColumn, workspace, window } from 'vscode';
import { NotificationHandler, NotificationType } from 'vscode-jsonrpc';
import { LanguageClient } from 'vscode-languageclient';

export namespace Monto {

    // Products

    export interface Product {
        uri: string;
        name: string;
        language: string;
        content: string;
        rangeMap: [RangePair];

        // Internal fields
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
        product.rangeMap = product.rangeMap.sort((a , b) =>
            (a.tend - a.tbegin) - (b.tend - b.tbegin)
        );
        products.set(uri.toString(), product);
        product.handleSelectionChange = false;
        montoProvider.onDidChangeEmitter.fire(uri);
    }

    export function showProduct(product: Product) {
        openInEditor(productToTargetUri(product), true);
    }

    function getProduct(uri: Uri): Product | undefined {
        return products.get(uri.toString());
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
            if (product) {
                return product.content;
            } else {
                return "unknown content";
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
            context: ExtensionContext,
            client: LanguageClient,
            handler: NotificationHandler<Product>
        ) {
        window.onDidChangeTextEditorSelection(change => {
            if (isMontoEditor(change.textEditor)) {
                selectLinkedRanges(change);
            }
        });

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

    function selectLinkedRanges(change: TextEditorSelectionChangeEvent) {
        let targetEditor = change.textEditor;
        let targetUri = targetEditor.document.uri;
        let sourceUri = targetUriToSourceUri(targetUri);
        openInEditor(sourceUri, false).then(sourceEditor => {
            let product = getProduct(targetUri);
            if (product) {
                if (product.handleSelectionChange) {
                    let sourceSelection = getSourceSelection(product, targetEditor, change.selections[0], sourceEditor);
                    if (sourceSelection) {
                        showSourceSelection(sourceEditor, sourceSelection);
                    }
                } else {
                    product.handleSelectionChange = true;
                }
            }
        });
    }

    function getSourceSelection(product : Product, targetEditor: TextEditor, targetSelection: Selection, sourceEditor: TextEditor): Range | undefined {
        let targetOffset = targetEditor.document.offsetAt(targetSelection.start);
        let pair = findContaining(product.rangeMap, targetOffset);
        if (pair) {
            return pairToSourceSelection(sourceEditor, pair);
        } else {
            return undefined;
        }
    }

    function findContaining(positions: [RangePair], targetOffset: number): RangePair | undefined {
        return positions.find(entry =>
            (entry.tbegin <= targetOffset) && (targetOffset < entry.tend)
        );
    }

    function pairToSourceSelection(editor: TextEditor, entry: RangePair): Range {
        let s = editor.document.positionAt(entry.sbegin);
        let f = editor.document.positionAt(entry.send);
        return new Range(s, f);
    }

    function showSourceSelection(editor: TextEditor, selection: Range) {
        window.showTextDocument(
            editor.document,
            {
                preserveFocus: false,
                preview: false
            }
        );
        editor.selections = [new Selection(selection.start, selection.end)];
        editor.revealRange(selection, TextEditorRevealType.InCenterIfOutsideViewport);
    }

    // Utilities

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

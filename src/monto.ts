import { ExtensionContext, EventEmitter, TextDocumentContentProvider, Uri, ViewColumn, workspace, window } from 'vscode';
import { NotificationHandler, NotificationType } from 'vscode-jsonrpc';
import { LanguageClient } from 'vscode-languageclient';

export namespace Monto {

    // Products

    export interface Product {
        uri: string;
        name: string;
        language: string;
        content: string;
    }

    namespace PublishProduct {
        export const type = new NotificationType<Product, void>(
            "monto/publishProduct"
        );
    }

    let products = new Map<string, Product>();

    function saveProduct(product : Product) {
        let uri = productToUri(product);
        products.set(uri.toString(), product);
        montoProvider.onDidChangeEmitter.fire(uri);
    }

    export function showProduct(product : Product) {
        let uri = productToUri(product).toString();
        let editors = window.visibleTextEditors;
        let uris = editors.map(editor => editor.document.uri.toString());
        if (uris.indexOf(uri) === -1) {
            window.showTextDocument(
                productToUri(product),
                {
                    preserveFocus: true,
                    viewColumn: ViewColumn.Beside,
                    preview: false,
                }
            );
        }
    }

    function productToUri(product : Product) : Uri {
        let path = Uri.parse(product.uri).path;
        return Uri.parse(`monto:${path}-${product.name}.${product.language}`);
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
            client : LanguageClient,
            handler : NotificationHandler<Product>
        ) {
        client.onReady().then(_ => {
            context.subscriptions.push(workspace.registerTextDocumentContentProvider(montoScheme, montoProvider));
            client.onNotification(PublishProduct.type, product => {
                saveProduct(product);
                handler(product);
            });
        });
    }

}

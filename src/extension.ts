'use strict';

import { ExtensionContext, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { Monto } from './monto';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    let java = "/usr/bin/java";
    let args = [
        "-classpath",
        "/Users/asloane/Projects/Kiama/kiama/extras/target/scala-2.12/kiama-extras-assembly-2.3.0-SNAPSHOT-tests.jar",
        "org.bitbucket.inkytonik.kiama.example.minijava.Main",
        "--server"
    ];

    let serverOptions: ServerOptions = {
        run: {
            command: java,
            args: args,
            options: {}
        },
        debug: {
            command: java,
            args: args.concat(["--debug"]),
            options: {}
        }
    };

    let clientOptions: LanguageClientOptions = {
        documentSelector: [
            {
                scheme: 'file',
                language: 'minijava'
            }
        ],
        diagnosticCollectionName: "minijava"
    };

    client = new LanguageClient(
        'minijavaLanguageServer',
        'MiniJava Language Server',
        serverOptions,
        clientOptions
    );

    Monto.setup(context, client, product => {
        if (shouldShowProduct(product)) {
            Monto.showProduct(product);
        }
    });

    context.subscriptions.push(client.start());
}

function shouldShowProduct(product: Monto.Product): Boolean {
    let config = workspace.getConfiguration('minijava');
    return (product.name === 'name' && config.showNameAnalysisStructure) ||
        (product.name === 'outline' && config.showOutline) ||
        (product.name === 'source' && config.showSource) ||
        (product.name === 'sourcetree' && config.showSourceTree) ||
        (product.name === 'target' && config.showTarget) ||
        (product.name === 'targettree' && config.showTargetTree);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

'use strict';

import { ExtensionContext } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions
} from 'vscode-languageclient';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    let java = "/usr/bin/java";
    let args = [
        "-cp",
        "/Users/asloane/Projects/Kiama/kiama/extras/target/scala-2.12/kiama-extras-assembly-2.2.1-SNAPSHOT-tests.jar",
        "org.bitbucket.inkytonik.kiama.example.minijava.ServerMain",
        "--Koutput", "string"
    ];

    let serverOptions: ServerOptions = {
        run: {
            command: java,
            args: args,
            options: {}
        },
        debug: {
            command: java,
            args: args.concat(["--Kdebug"]),
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

    context.subscriptions.push(client.start());
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

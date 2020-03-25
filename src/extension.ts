// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

'use strict';

import { ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient';
import { Monto } from './monto';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    let java = "/usr/bin/java";
    let args = [
        "-classpath",
        "/Users/asloane/Projects/Kiama/kiama/extras/target/scala-2.13/kiama-extras-assembly-2.3.0-SNAPSHOT-tests.jar",
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

    Monto.setup("minijava", context, client);

    context.subscriptions.push(client.start());
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

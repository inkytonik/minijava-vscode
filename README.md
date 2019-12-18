# minijava README

VSCode Language Server Client for Kiama's MiniJava compiler.

## Features

On file open and save, the MiniJava compiler will be run and any resulting diagnostics will be displayed.
Monto products such as AST displays are availble.
See the extension settings for available products.
Once a product is enabled, save a file and you should see another view open with the product content.

## Running

This extension is not currently published on the extension marketplace so you will have to install it manually in your extensions or run it from VSCode.
Before running, you will need to use the sbt command `extras/Test/assembly` in Kiama to generate a JAR with all necessary components.
Then check `src/extension.ts` and set the JAR path to the location of your JAR file.
With this setup the extension should start the server when a MiniJava file is opened.

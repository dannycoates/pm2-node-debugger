// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as Net from 'net';
import { resolve } from 'path';
import { ChromeDebugSession, logger } from 'vscode-chrome-debug-core';
import { PM2 } from './pm2'

let NodeDebugSession: typeof ChromeDebugSession;
let pm2: PM2;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('extension.pickPM2Process', config => pm2.pickProcess()));
	pm2 = await PM2.connect()
	context.subscriptions.push(pm2)
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('pm2-node', new Pm2NodeDebugConfigurationProvider()))
	const debuggerSrc = vscode.extensions.getExtension('ms-vscode.node-debug2')?.extensionPath as string;
  const { NodeDebugAdapter } = await import(resolve(debuggerSrc, 'out', 'src', 'nodeDebugAdapter'))
  const { NodeBreakpoints } = await import(resolve(debuggerSrc, 'out', 'src', 'nodeBreakpoints'))
  const { NodeScriptContainer } = await import(resolve(debuggerSrc, 'out', 'src', 'nodeScripts'))
  NodeDebugSession = ChromeDebugSession.getSession({
    extensionName: 'pm2-node-debugger',
    adapter: NodeDebugAdapter,
    breakpoints: NodeBreakpoints,
    scriptContainer: NodeScriptContainer
	})
	logger.log('hello love')
	const factory = new PM2DebugAdapterDescriptorFactory();
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('pm2-node', factory));
	context.subscriptions.push(factory);
}

// this method is called when your extension is deactivated
export function deactivate() {}

class Pm2NodeDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
	resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration): vscode.ProviderResult<vscode.DebugConfiguration> {
			return debugConfiguration;
	}
	resolveDebugConfigurationWithSubstitutedVariables(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration): vscode.ProviderResult<vscode.DebugConfiguration> {
		const servicePort = debugConfiguration.service.split('|')
		debugConfiguration.name = `PM2: ${servicePort[0]} (${servicePort[1]})`;
		debugConfiguration.port = parseInt(servicePort[1], 10)
		return debugConfiguration
	}
}

class PM2DebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

	private server?: Net.Server;

	createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

		if (!this.server) {
			// start listening on a random port
			this.server = Net.createServer(socket => {
				const session = new NodeDebugSession();
				session.setRunAsServer(true);
				session.start(<NodeJS.ReadableStream>socket, socket);
			}).listen(0);
		}

		// make VS Code connect to debug server
		return new vscode.DebugAdapterServer((<Net.AddressInfo>this.server.address()).port);
	}

	dispose() {
		if (this.server) {
			this.server.close();
		}
	}
}

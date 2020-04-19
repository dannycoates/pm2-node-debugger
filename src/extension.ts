// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { PM2 } from "./pm2";

let pm2: PM2;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  pm2 = await PM2.connect();
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.pickPM2Process", (config) =>
      pm2.pickProcess()
    )
  );
  context.subscriptions.push(pm2);
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      "pm2-node",
      new Pm2NodeDebugConfigurationProvider()
    )
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

class Pm2NodeDebugConfigurationProvider
  implements vscode.DebugConfigurationProvider {
  async resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    cfg: vscode.DebugConfiguration
  ): Promise<vscode.DebugConfiguration> {
    if (vscode.workspace.getConfiguration().get("debug.node.useV3", false)) {
      // ensure it's available and active
      const x = vscode.extensions.getExtension("ms-vscode.js-debug-nightly");
      if (x) {
        if (!x.isActive) {
          await x.activate();
        }
        cfg.__workspaceFolder = "${workspaceFolder}";
        cfg.useV3 = true;
      }
    }
    return cfg;
  }
  resolveDebugConfigurationWithSubstitutedVariables(
    folder: vscode.WorkspaceFolder | undefined,
    cfg: vscode.DebugConfiguration
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    if (!cfg.service) {
      return undefined;
    }
    const servicePort = cfg.service.split("|");
    let name = `PM2: ${servicePort[0]}`;
    if (servicePort[2] !== "undefined") {
      name += ` (${servicePort[2]})`;
    }
    cfg.name = name;
    cfg.port = parseInt(servicePort[1], 10);
    delete cfg.service;
    cfg.type = cfg.useV3 ? "pwa-node" : "node2";
    delete cfg.useV3;
    return cfg;
  }
}

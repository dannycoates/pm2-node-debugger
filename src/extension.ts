// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { PM2 } from "./pm2";
import { execSync } from "child_process";
import { get } from "http";

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

function connect(port: number, times: number) {
  return new Promise<void>((resolve, reject) => {
    get(`http://localhost:${port}/`, () => resolve()).on("error", (e) => {
      if (times > 0) {
        setTimeout(() => resolve(connect(port, times - 1)), 100);
      }
      reject(e);
    });
  });
}

async function signal(pid: number, port: number) {
  if (process.platform === "win32") {
    const command = `node -e process._debugProcess(${pid})`;
    execSync(command, { timeout: 200 });
  } else {
    process.kill(pid, "SIGUSR1");
  }
  await connect(port, 10);
}

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
  async resolveDebugConfigurationWithSubstitutedVariables(
    folder: vscode.WorkspaceFolder | undefined,
    cfg: vscode.DebugConfiguration
  ): Promise<vscode.DebugConfiguration | undefined> {
    if (!cfg.service) {
      return undefined;
    }
    const serviceInfo = cfg.service.split("|");
    // 0: name
    // 1: pid
    // 2: debug port
    // 3: service port
    let name = `PM2: ${serviceInfo[0]}`;
    if (serviceInfo[3] !== "undefined") {
      name += ` (${serviceInfo[3]})`;
    }
    const pid = parseInt(serviceInfo[1], 10);
    cfg.name = name;
    cfg.port = parseInt(serviceInfo[2], 10) || 9229;
    await signal(pid, cfg.port);
    delete cfg.service;
    cfg.type = cfg.useV3 ? "pwa-node" : "node2";
    delete cfg.useV3;
    return cfg;
  }
}

import * as vscode from "vscode";
// The PM2 typedef isn't very accurate
// @ts-ignore
import { custom as PM2api } from "pm2";
import type * as PM2API from "pm2";

const inspectRE = /--inspect(?:-brk)?(?:=(?:(\[[0-9a-fA-F:]*\]|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|[a-zA-Z0-9\.]*):)?(\d+))?/;
const inspectPortRE = /--inspect-port=(\d+)/;

function matchPort(str: string) {
  const portMatch = inspectPortRE.exec(str);
  if (portMatch) {
    return parseInt(portMatch[1], 10);
  }
  const match = inspectRE.exec(str);
  if (match) {
    // ignore 'host', PM2 is a local process
    return parseInt(match[2], 10) || 9229;
  }
  return null;
}

function findDebugPort(d: PM2API.ProcessDescription) {
  const x = d as any;
  return matchPort(x.pm2_env.args) || matchPort(x.pm2_env.NODE_OPTIONS);
}

export class PM2 {
  pm2api: typeof PM2API;

  static async connect() {
    const instance = new PM2api();
    await new Promise((resolve, reject) => {
      instance.connect((err: Error, meta: any) => {
        if (err) {
          return reject(err);
        }
        resolve(meta);
      });
    });
    return new PM2(instance);
  }

  private constructor(pm2api: typeof PM2API) {
    this.pm2api = pm2api;
  }

  list(): Promise<PM2API.ProcessDescription[]> {
    return new Promise((resolve, reject) => {
      this.pm2api.list((err, list) => {
        if (err) {
          return reject(err);
        }
        resolve(list);
      });
    });
  }

  describe(process: string | number): Promise<PM2API.ProcessDescription> {
    return new Promise((resolve, reject) => {
      this.pm2api.describe(process, (err, list) => {
        if (err) {
          return reject(err);
        }
        resolve(list[0]);
      });
    });
  }

  async pickProcess() {
    const ps = await this.list();
    const picks = ps
      .map<any>((p) => {
        // @ts-ignore
        const description = p.pm2_env.PORT && `port: ${p.pm2_env.PORT}`;
        return {
          label: p.name,
          description,
          status: p.pm2_env?.status,
          pid: p.pid,
          debugPort: findDebugPort(p),
          // @ts-ignore
          port: p.pm2_env.PORT,
        };
      })
      .filter((p) => p.status === "online" && p.debugPort);
    if (!picks.length) {
      vscode.window.showErrorMessage("No debuggable PM2 processes are running");
      return null;
    }
    const item = await vscode.window.showQuickPick(picks, {
      canPickMany: false,
    });

    return item
      ? `${item.label}|${item.pid}|${item.debugPort}|${item.port}`
      : null;
  }

  dispose() {
    this.pm2api.disconnect();
  }
}

import * as vscode from 'vscode';
// @ts-ignore
import { custom as PM2api } from 'pm2'
import type * as PM2API from 'pm2'

const inspectRE = /--inspect=(\d+)/

function matchPort(str: string) {
  const match = inspectRE.exec(str)
  if (match) {
    return parseInt(match[1], 10)
  }
  return null
}

function findDebugPort(d: PM2API.ProcessDescription) {
  const x = d as any
  return matchPort(x.pm2_env.args) || matchPort(x.pm2_env.NODE_OPTIONS)
}

export class PM2 {
  pm2api: typeof PM2API
  
  static async connect() {
    console.log('connecting')
    const instance = new PM2api()
    await new Promise((resolve, reject) => {
      instance.connect((err:Error, meta: any) => {
        if (err) { return reject(err) }
        resolve(meta)
        console.log('connected')
      })
    })
    return new PM2(instance)
  }

  private constructor(pm2api: typeof PM2API) {
    this.pm2api = pm2api
  }

  list(): Promise<PM2API.ProcessDescription[]> {
    return new Promise((resolve, reject) => {
      this.pm2api.list((err, list) => {
        if (err) { return reject(err) }
        resolve(list)
      })
    })
  }

  describe(process: string | number): Promise<PM2API.ProcessDescription> {
    return new Promise((resolve, reject) => {
      this.pm2api.describe(process, (err, list) => {
        if (err) { return reject(err) }
        resolve(list[0])
      })
    })
  }


  async pickProcess() {
    const ps = await this.list()
    const item = await vscode.window.showQuickPick(
      ps.map<any>(p => ({
        label: p.name,
        description: p.pm2_env?.status,
        detail: `debugger port: ${findDebugPort(p)}`,
        debugPort: findDebugPort(p)
      }))
      .filter(p => p.description === 'online' && p.debugPort), { canPickMany: false })

    return item ? `${item.label}|${item.debugPort}` : null
  }

  dispose() {
    this.pm2api.disconnect()
  }
}
interface RequireCb {
  (...args: any[]): any
}

type RequireDependency = string;
type RequireCustomStore = Record<string, RequireCb>;

class Require {
  private store: Record<string, Promise<any>> = {}
  private path: Record<string, string> = {}

  private load(pathStr: string, force?: boolean): Promise<any> {
    const path = this.path[pathStr] || pathStr

    if (!this.store[path] || force) {
      this.store[path] = new Promise(async (resolve, reject) => {
        const script = document.createElement('script')
        const fnKey = this.randomFn()

        try {
          const res = await fetch(path)
          const scriptText = await res.text()
          const requireCustom = this.getRequireCustomStore()

          requireCustom[fnKey] = (...args: unknown[]) => {
            const { cb, deps } = this.parseDefineArgs(args)
            const exportsModule = {}
            const module = { exports: exportsModule }
            const loadedDeps = deps.map((dep) => {
              if (dep === "exports") return Promise.resolve(exportsModule)
              if (dep === "module") return Promise.resolve(module)
              if (dep === "require") {
                return Promise.resolve(this.require.bind(this))
              }

              return this.load(dep)
            })

            Promise.all(loadedDeps)
              .then((depData) => {
                const result = cb(...depData)
                resolve(result === undefined ? module.exports : result)
              })
              .catch(reject)
              .finally(() => {
                script.remove()
                this.deleteRequireCustom(fnKey)
              })
          }

          script.onerror = () => {
            reject(new Error(`Failed to execute runtime module "${path}".`))
            this.deleteRequireCustom(fnKey)
          }
          script.textContent = [
            "(function() {",
            `const define = window.requireCustom.${fnKey};`,
            "define.amd = true;",
            scriptText,
            "})()"
          ].join("\n");

          document.body.appendChild(script)
        } catch (error) {
          reject(error)
          script.remove()
          this.deleteRequireCustom(fnKey)
        }
      })
    }

    return this.store[path]
  }

  async require(pathList: string[], force?: boolean): Promise<any[]> {
    const data: any[] = []

    for (const path of pathList) {
      data.push(await this.load(path, force))
    }

    return data
  }

  register(path: string, value: any): void {
    this.store[path] = Promise.resolve(value)
  }

  addStartStore(startStore: Record<string, Promise<any>>): void {
    for (const [key, value] of Object.entries(startStore)) {
      this.store[key] = value
    }
  }

  setPath(path: Record<string, string>): void {
    for (const [key, value] of Object.entries(path)) {
      this.path[key] = value
    }
  }

  clearForTests(): void {
    this.store = {}
    this.path = {}
  }

  private getRequireCustomStore(): RequireCustomStore {
    const existing = (window as { requireCustom?: RequireCustomStore })
      .requireCustom

    if (existing) return existing

    const requireCustom: RequireCustomStore = {}
    ;(window as { requireCustom?: RequireCustomStore }).requireCustom =
      requireCustom

    return requireCustom
  }

  private deleteRequireCustom(fnKey: string): void {
    const windowWithRequire = window as { requireCustom?: RequireCustomStore }
    if (!windowWithRequire.requireCustom) return

    delete windowWithRequire.requireCustom[fnKey]

    if (Object.keys(windowWithRequire.requireCustom).length === 0) {
      delete windowWithRequire.requireCustom
    }
  }

  private parseDefineArgs(args: unknown[]): {
    cb: RequireCb;
    deps: RequireDependency[];
  } {
    const defineArgs = typeof args[0] === "string" ? args.slice(1) : args
    const deps = Array.isArray(defineArgs[0])
      ? defineArgs[0] as RequireDependency[]
      : []
    const cb = (Array.isArray(defineArgs[0]) ? defineArgs[1] : defineArgs[0]) as
      | RequireCb
      | Record<string, unknown>

    if (typeof cb === "function") {
      return { cb, deps }
    }

    return {
      cb: () => cb,
      deps
    }
  }

  private randomFn(): string {
    return `fn_${new Date().getTime()}_${Math.floor(Math.random() * 10000)}`
  }
}

export const require = new Require()

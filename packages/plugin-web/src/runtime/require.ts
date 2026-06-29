interface RequireCb {
  (...args: any[]): any
}

class Require {
  private store: Record<string, Promise<any>> = {}
  private path: Record<string, string> = {}

  private load(pathStr: string, force?: boolean) {
    const path = this.path[pathStr] || pathStr

    if (!this.store[path] || force) {
      this.store[path] = new Promise(async (resolve) => {
        const script = document.createElement('script')
        const res = await fetch(path)
        const scriptText = await res.text()
        const fnKey = this.randomFn()

        ;(window as any).requireCustom = {
          [fnKey]: (deps: string[] | RequireCb, cb: RequireCb) => {
            if (typeof deps === 'function') {
              cb = deps
              deps = []
            }

            this.require(deps).then((depData) => {
              resolve(cb(...depData))
              script.remove()
              delete (window as any).requireCustom[fnKey]
            })
          },
        }

        script.innerText = `(function() {const define = window.requireCustom.${fnKey};define.amd=true;${scriptText}})()`.replace(/\n/g, '')

        document.body.appendChild(script)
      })
    }

    return this.store[path]
  }

  async require(pathList: string[], force?: boolean) {
    const data: any[] = []

    for (const path of pathList) {
      data.push(await this.load(path, force))
    }

    return data
  }

  addStartStore(startStore: Record<string, Promise<any>>) {
    for (const [key, value] of Object.entries(startStore)) {
      this.store[key] = value
    }
  }

  setPath(path: Record<string, string>) {
    for (const [key, value] of Object.entries(path)) {
      this.path[key] = value
    }
  }

  private randomFn() {
    return `fn_${new Date().getTime()}_${Math.floor(Math.random() * 10000)}`
  }
}

export const require = new Require()

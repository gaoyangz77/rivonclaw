import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { extname, join, resolve } from "node:path"
import { ROUTES } from "../../routes.js"
import { LANGUAGE_OPTIONS } from "../../i18n/languages.js"
import { getStepsForRoute } from "./index.js"

const SRC_ROOT = resolve(__dirname, "../..")
const TARGET_SELECTOR = /^\[data-tutorial-id="([^"]+)"\]$/

function walkSource(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) walkSource(path, files)
    else if ([".ts", ".tsx"].includes(extname(entry.name))) files.push(path)
  }
  return files
}

function hasTranslation(resource: object, key: string): boolean {
  let value: unknown = resource
  for (const segment of key.split(".")) {
    if (!value || typeof value !== "object" || !(segment in value)) return false
    value = (value as Record<string, unknown>)[segment]
  }
  return typeof value === "string" && value.length > 0
}

const renderedSource = ["pages", "components"]
  .flatMap((directory) => walkSource(join(SRC_ROOT, directory)))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n")

describe("tutorial step registry", () => {
  it("keeps the audited Affiliate tutorials at their intended coverage", () => {
    const expectedStepCounts: Record<string, number> = {
      "/commerce/affiliate/attention": 5,
      "/commerce/affiliate/team": 5,
      "/commerce/product-knowledge": 3,
      "/commerce/affiliate/campaigns": 5,
      "/commerce/affiliate/creators": 4,
      "/commerce/affiliate/history": 4,
      "/commerce/affiliate/intelligence": 4,
    }

    for (const [route, expectedCount] of Object.entries(expectedStepCounts)) {
      expect(getStepsForRoute(route), `${route} tutorial step count`).toHaveLength(expectedCount)
    }

    expect(getStepsForRoute("/commerce/affiliate")).toBe(
      getStepsForRoute("/commerce/affiliate/creators"),
    )
  })

  it("covers every sidebar route with a tutorial", () => {
    const sidebarRoutes = ROUTES.filter((route) =>
      route.navLabelKey &&
      !route.navHidden &&
      !route.internal
    )

    for (const route of sidebarRoutes) {
      expect(getStepsForRoute(route.path), `${route.path} tutorial`).not.toHaveLength(0)
    }
  })

  it("keeps all registered steps structurally usable", () => {
    const routesWithTutorials = ROUTES
      .filter((route) => !route.internal)
      .map((route) => route.path)

    for (const route of routesWithTutorials) {
      for (const step of getStepsForRoute(route)) {
        expect(step.target, `${route} target`).toMatch(/\S/)
        expect(step.titleKey, `${route} title key`).toMatch(/^tutorial\./)
        expect(step.bodyKey, `${route} body key`).toMatch(/^tutorial\./)
      }
    }
  })

  it("uses stable, rendered targets for every audited tutorial", () => {
    const auditedRoutes = ROUTES.filter((route) => !route.internal)

    for (const route of auditedRoutes) {
      const stepIds = new Set<string>()
      for (const step of getStepsForRoute(route.path)) {
        expect(step.id, `${route.path} step id`).toMatch(/\S/)
        expect(stepIds.has(step.id!), `${route.path} duplicate step id ${step.id}`).toBe(false)
        stepIds.add(step.id!)

        const targetId = step.target.match(TARGET_SELECTOR)?.[1]
        expect(targetId, `${route.path} stable target for ${step.id}`).toBeDefined()
        expect(
          renderedSource.includes(`data-tutorial-id="${targetId}"`),
          `${route.path} rendered target ${targetId}`,
        ).toBe(true)
      }
    }
  })

  it("provides English and Chinese copy for every audited step", () => {
    const english = LANGUAGE_OPTIONS.find((language) => language.code === "en")
    const chinese = LANGUAGE_OPTIONS.find((language) => language.code === "zh")
    expect(english).toBeDefined()
    expect(chinese).toBeDefined()

    const missing: string[] = []
    for (const route of ROUTES.filter((entry) => !entry.internal)) {
      for (const step of getStepsForRoute(route.path)) {
        for (const language of [english!, chinese!]) {
          for (const key of [step.titleKey, step.bodyKey]) {
            if (!hasTranslation(language.resource, key)) missing.push(`${language.code} ${key}`)
          }
        }
      }
    }
    expect(missing).toEqual([])
  })
})

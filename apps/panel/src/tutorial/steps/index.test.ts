import { describe, expect, it } from "vitest"
import { ROUTES } from "../../routes.js"
import { getStepsForRoute } from "./index.js"

describe("tutorial step registry", () => {
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
})

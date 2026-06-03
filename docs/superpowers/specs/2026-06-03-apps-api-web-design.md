# Apps API And Web Design

**Goal**

Create two minimal applications under `apps`: an Express-based API server and a React + Ant Design web app.

**API**

- Use TypeScript and Express.
- Keep code under `src` with `router/v1`, `middleware`, `service`, and a minimal `modules/health` boundary.
- Expose `GET /api/v1/health`.
- Install `@earendil-works/pi-ai` and `@earendil-works/pi-agent-core`.

**Web**

- Use React + Vite + Ant Design.
- Keep a minimal module boundary with `config`, `modules/health`, and `shared`.
- Read the API base URL from `VITE_API_BASE_URL`.
- Render only a minimal page with no extra features.

**Testing**

- Add tests before implementation.
- Cover the API health service and health route.
- Cover the web env reader and minimal render path.

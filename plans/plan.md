Proposal: Modern Opinionated Micro-Frontend Framework
Goals and Philosophy
The new framework is designed to make building large-scale, modular web UIs easy and productive, much like Next.js did for monolithic apps. Its core goal is to enable teams to develop independent micro frontend modules that plug together seamlessly. Each micro-frontend (MFE) is an autonomous mini-application responsible for a slice of the UI. Just as microservices broke up backend systems, MFEs “are isolated frontends for particular domains” that can be built and deployed independently
. By default the framework will be opinionated and zero-config, providing sensible defaults and conventions (folder structure, routing, state management) so developers can focus on features instead of boilerplate. In short, the philosophy is: “scale by vertical slice, not by complexity”. Performance, scalability, and a great developer experience are first-class concerns, balancing automation with flexibility so teams can move fast without reinventing the wheel.
Key Features
CLI Scaffolding & Presets: A single CLI (create-mfe-app / jorvel init) to generate new projects or MFEs with one command. It should prompt for or preset everything (project name, templating engine, frameworks) and create a ready-to-run repo (monorepo or multi-repo) with a host container and one or more remotes. Inspired by Next.js and Nx, commands like jorvel generate host <name> and jorvel generate remote <name> will bootstrap each piece
.
File-Based Routing: Convention-over-configuration file routing (like Next.js) both at the host and within each MFE. The host “shell” app owns top-level routes (e.g. /dashboard/*, /profile/*), while each MFE handles its own internal sub-routes
. The framework will automatically wire these together. Optionally a visual routing editor (new UI tool) could let developers drag-and-drop route hierarchies.
Zero-Config Module Federation: Built-in Webpack 5 (or similar) Module Federation support to share code at runtime. By convention, all apps under apps/ or similar are automatically federated: no manual Webpack config is required. The framework will generate module-federation configs (host and remotes) behind the scenes, sharing only core libraries (React, ReactDOM, Router, a pub-sub library, etc.) as singletons to avoid version mismatches
. In practice, this yields “just works” federated imports: import Cart from 'shop/Cart' loads the remote module at run-time. Teams get the benefits of MFEs (independent deployment) with zero initial setup.
State & Communication Abstractions: A built-in event bus/pub‑sub system and/or shared state store will simplify cross-MFE communication. For example, the framework could include a context or global Redux store that MFEs can hook into. Alternatively, it can export a singleton EventBus API so MFEs publish and subscribe to events (e.g. eventBus.publish('user:login'))
. This enforces the recommended loose coupling pattern: MFEs broadcast domain events rather than tightly calling into each other
. By default, each MFE will be completely encapsulated; shared state (like auth/user info or cart totals) must go through these explicit channels.
Built-in Dev Server & Hot Reload: A single jorvel dev command starts up the development environment. In monorepo mode, it concurrently serves the host and any MFEs, with live-reload/HMR across all parts. When the host is served, its MFE remotes are proxied locally (or bundled) so changes propagate immediately. We’ll use Turbopack/Rspack or Webpack Dev Server under the hood for blazing-fast rebuilds
. The dev server will compile pages on-demand (like Next’s next dev) so you can start up instantly without precompiling everything
. Source maps, TypeScript type-checking, and ESLint will be on by default for instant feedback.
SSR/SSG Support: Server-side rendering (SSR) and static-generation (SSG) will be first-class. The host shell can prerender or stream the composed page for performance and SEO. For example, on a page load the container could server-render each MFE (via Node or edge functions) and stitch the HTML. This “fragments” approach (similar to [Partial Hydration/Islands]) will allow edge computation and faster first-byte times
. Optionally, MFEs can declare if they support SSR; static-export (SSG) can pre-build pure-SPA pages. We will integrate out-of-the-box with popular SSR patterns (Edge Side Includes (ESI), streaming with Node, or even frameworks like Piral/ILC
). The end result: teams get SSR/SSG with minimal setup (one flag in config).
Performance Optimization: Automatic code-splitting and lazy loading. Each MFE’s code is split into chunks so only needed code loads on demand. The framework will enforce performance budgets and warn if a bundle grows too large
. It will also optimize images and assets (e.g. leveraging a Next/Image-like loader). Out-of-the-box caching (long-term caching headers, content hashes) and support for modern bundlers (Turbopack/Rspack as default) will speed up dev and prod builds
. Advanced options like partial hydration (“islands architecture”) can be enabled for extremely dynamic pages
.
CI/CD & DevOps Integrations: Opinionated scaffolding will include sample CI workflows. For example, the CLI can generate GitHub Actions or GitLab CI pipelines that build and test only changed projects (monorepo nx affected style) and can publish each MFE to a CDN separately. We’ll provide recommended pipelines for “à la carte” versus “affected” deployments, as described by Nx
. Built-in support for previews (e.g. deploy PR apps to a “mfe-cloud” or Vercel-like environment) and easy rollout strategies (canary flags, feature toggles) will help teams deploy safely.
TypeScript and Tooling: TypeScript support is integrated by default (all templates are TS). A shared global types repo will help MFEs understand each other’s public APIs. Strict typing at boundaries will be encouraged. Additionally, we’ll include tools like ESLint and Prettier configs out of the box, plus editor plugins (optional) to streamline development.
Shared Libraries & Design System: A convention for shared UI libraries or utilities will be supported. We can generate a libs/ui-components package that MFEs can import for common components (buttons, form fields, etc). This encourages consistency without forcing a single build: MFEs reuse design assets via NPM or workspace libs. The framework might even inject an optional UI kit or Tailwind preset.
Example File/Folder Architecture
A typical monorepo layout might look like:
/my-app/                      # Monorepo root
  package.json, jorvel.config.js # Project config, lists MFEs and settings
  /apps/                      # All host & micro-app projects
    /shell/                   # The container (shell) application
      public/
      src/
        pages/                # File-based routes for shell
        components/           # Shared within shell
      module-federation.config.js 
    /dashboard/               # A micro-frontend (remote)
      public/
      src/
        pages/                # MFE’s internal routes (file-based or code)
        components/
      module-federation.config.js
    /profile/                 # Another micro-frontend
      ...  
  /libs/                      # Shared libraries or UI components
    /ui/                      # Common design system components
    /state/                   # Shared Redux logic or pub-sub types
This structure is inspired by Nx and other monorepo patterns
. In monorepo mode, jorvel dev will concurrently serve shell and all MFEs under /apps/. In multi-repo mode, the host’s config (jorvel.config.js) can list external endpoints for each remote. The framework will generate this layout automatically. For example, using Nx-style generators:
# Initialize shell (host) with remotes `shop` and `cart`
jorvel generate host apps/shell --remotes=shop,cart 
# Initialize a new remote linked to shell
jorvel generate remote apps/about --host=shell 
As Nx shows, once generated you can do jorvel serve shell to start the shell, and it will automatically serve or proxy the remotes
. This leads to a smooth developer experience: one terminal bootstraps the entire micro-frontend environment.
Routing
Shell (Container) Routing: The container app manages high-level navigation. Its router is the single source of truth for top-level routes and lazy-loads MFEs accordingly. For example:
// ShellApp.jsx (container)
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardApp from 'dashboard/DashboardApp'; 
import ProfileApp from 'profile/ProfileApp'; 
export default function ShellApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard/*" element={<DashboardApp/>}/>
        <Route path="/profile/*" element={<ProfileApp/>}/>
      </Routes>
    </BrowserRouter>
  );
}
Here, the shell mounts each MFE at a sub-path (e.g. /dashboard/* for the dashboard micro-frontend)
. The framework automates this wiring: declaring a route in jorvel.config.js or a special apps.json could auto-generate these import statements. We encourage no path conflicts across MFEs (each MFE gets a unique base path) and will warn if overlaps occur
. Micro-Frontend (Remote) Routing: Each MFE contains its own internal router (file-based or manual). Those routers only see sub-routes under their base path. For example, DashboardApp (at /dashboard) might define /reports/:id or /settings within its own code
. This scoping avoids conflicts. In practice, the framework will scaffold each MFE with a routing setup (e.g. a pages/ directory or a React Router snippet) so developers just drop in pages. Cross-App Navigation: To navigate between MFEs, we use events or a common history. A link in one MFE that points to another (e.g. “Go to Profile”) will dispatch a message to the shell. For example:
// In Dashboard MFE:
window.dispatchEvent(new CustomEvent('jorvel:navigate', { detail: '/profile/settings' }));
The shell listens for jorvel:navigate and executes history.pushState() accordingly
. Alternatively, we can expose a shared useNavigate hook that under the hood publishes to the shell’s router. This event-based approach is explicitly recommended to keep MFEs decoupled
. Framework Support: Under the hood, we may leverage libraries like single-spa, qiankun, or Next.js Module Federation to handle mounting/unmounting for us
. But to the user, it will “just work” – they write routes in each app and the framework composes them at runtime.
Module Federation and Composition
This framework uses Webpack Module Federation (or similar bundler features) to compose MFEs at runtime without shipping them to npm. Each remote MFE exposes certain components or pages, and the shell loads them over the network. By convention, jorvel build will produce a remoteEntry.js for each MFE, and the shell’s build references them.
Automatic Federation Setup: The CLI sets up module-federation.config.js for each app. In most cases, no manual editing is needed. We’ll assume each app’s package.json and directory name define its federation name. For example, the dashboard app auto-exposes dashboard/DashboardApp components. Shared dependencies (React, etc.) are automatically deduped as singletons
. Developers can override or extend this config if needed.
Sharing Strategy: The framework encourages sharing only core libraries to avoid version skew
. By default, things like React, ReactDOM, Router, and one common pub-sub library (if used) are shared. Everything else (component libraries, business code) is bundled per-MFE to guarantee MFE independence. This follows Nx’s advice to “share as little as possible” to avoid mismatch problems
.
Deployment: Each MFE can be deployed independently to its own CDN or URL. The shell’s code references them by public URL (configurable). We will support both static hosting (publish all remotes first, then update the shell’s route table) or dynamic discovery (see below).
Discovery & Orchestration: In the future, we may provide an MFE registry. MFEs could self-register their endpoints with a central service (like a service-discovery pattern
). The shell could then query this registry on startup to find which remotes exist, eliminating hard-coded remote URLs. This would enable truly pluggable architectures where adding a new MFE requires no code change in the shell. For MVP, static config is fine, but “micro-frontend discovery” is a known area for innovation
.
Communication and Shared State
With multiple independent apps on one page, communication must be explicit. We will provide helper patterns and APIs:
Event Bus / Pub-Sub: The framework will bundle a small pub-sub library (or use the browser’s CustomEvent) so MFEs can publish events. For example, a Cart MFE can emit eventBus.publish('cart:updated', { count: 3 }), and Header MFE subscribes to update the cart icon. This loosely couples MFEs
. The container ensures a single shared bus instance is passed to all MFEs. Under the hood, we might adopt existing libraries (e.g. [@micro-frontends/event-bus]) or roll our own.
Global State Store (Optional): For scenarios like authentication or user profile, an application-wide state store can be offered. The framework could generate a shared Redux/Vuex store module in /libs/state/ that all MFEs import. Each MFE only imports the namespaced slice it needs. For example, authentication state lives in a shared auth store; the Profile MFE updates it, and Header automatically sees the change. This pattern is popular for simple data sharing
.
Props & Callbacks: In build-time integration (monorepo) scenarios, we can allow the shell to pass props to MFEs. For instance, the shell may embed <DashboardApp user={user} onLogout={handleLogout}/>. This prop-passing couples MFEs to the shell’s data model, so we use it sparingly (mostly for initial data bootstrap)
.
URL/Route Parameters: We encourage encoding navigation state in the URL when possible. Each MFE will read its relevant query or path parameters from the URL to know what to display. For example, setting ?theme=dark or #/lang=fr can be a simple way to share data. This avoids complex messaging for trivial state and leverages the browser’s native capabilities
.
Whichever method is used, we will document best practices. Thoughtworks and experts all recommend starting simple (props/events) and evolving to a formal event schema if needed
. The framework may optionally provide a schema registry or TypeScript types for events to avoid mismatches.
CI/CD, Testing and Performance Optimization
Automated Pipelines: We’ll ship sample CI templates (GitHub Actions, GitLab CI) that build and test each MFE independently and the shell as needed. For example, the CI can run mfe test --affected=cart,checkout on only changed projects (monorepo affected). Nx-style caching and parallelism can be integrated to speed up builds. The framework will encourage one pipeline per MFE (to maximize autonomy) plus a “integration” job that runs end-to-end tests on the assembled app.
End-to-End and Contract Tests: Testing MFEs in isolation can be done with standard tools (Jest, Mocha). For cross-app flows, end-to-end tests (Cypress or Playwright) should navigate the assembled host page. We’ll include starter configs for E2E that spin up all MFEs in a test environment. We will also advise writing contract tests for the APIs/events each MFE publishes. For example, each MFE’s endpoint can have a JSON schema for its events, and a shared test suite verifies the shapes.
Performance Budgets: The build tooling will allow setting budgets (e.g. “each MFE bundle should be <2 MB” or “Time to First Byte <300ms”). If exceeded, the CLI emits warnings. By default we’ll enable gzip and brotli compression and long-term caching headers. Image optimization (or using an external image service) will be part of the stack. Also, using a modern bundler like Turbopack by default gives a big speed boost in dev
. In production, the default bundler can be tuned (e.g. Tree-shaking, minification, and code splitting are automatic) so MFEs only load what they need, addressing the “multiple bundles” overhead
. We may also integrate lightweight telemetry (e.g. sending basic performance metrics back to a dashboard) if optional analytics are desired.
Edge and SSR Options: For maximum performance, we’ll support deploying the host and MFEs to edge runtimes (Cloudflare Workers, AWS Lambda@Edge, etc.) so that the composition happens geographically close to users. Techniques like Edge Side Includes (ESI) are on the table. The Cloudflare team’s “Fragments” architecture shows that server-rendering each piece in parallel can vastly speed up first paint
. While we may not build full edge orchestration in MVP, we will leave hooks (adapters) so that an MFE’s server code can run anywhere (node, serverless, edge).
Developer Experience
We will put the developer first. The framework should “just feel right”:
CLI Tools: Commands like jorvel dev, jorvel build, jorvel test, jorvel lint will mirror Next.js/Nx tools. Scaffolding commands (jorvel new, jorvel generate) use smart defaults. The CLI should be interactive (with helpful prompts and docs) yet also fully scriptable for CI.
TypeScript and Linting: Out of the box, projects are TypeScript-enabled with strict type checking. Linters (ESLint/TSLint) and formatters (Prettier) are preconfigured. We might adopt Next.js’s ESLint rules or Nx defaults. Any generated code (pages, components) will include example tests and TypeScript interfaces to guide developers.
Fast Refresh / Live Reload: Instant feedback is key. We’ll leverage React Fast Refresh (or Vue’s HMR) so that changes in code update the browser without full reload. Even when editing one MFE, the shell will reflect changes immediately thanks to HMR proxying
. The dev experience should feel as seamless as working in a single Next.js app.
Editor/IDE Integration: To aid adoption, we’ll provide code snippets or a VS Code extension that recognizes jorvel.config.js and provides auto-completion (e.g. for MFE names). Path aliases for MFEs (so you can import X from 'my-mfe/path' without relative paths) will be configured automatically.
Monorepo Support: We recognize teams may prefer multiple repos. Thus, all tooling works in both monorepo and polyrepo modes. In monorepo, dependencies are hoisted (Yarn/NPM workspaces or Nx) and cached; in polyrepo, the CLI will allow adding remote URLs to the config. We may even integrate with Git submodule or GitHub repo templates for multi-repo starters.
The emphasis is on reducing boilerplate. For example, jorvel dev should detect new MFEs added to the workspace and serve them without extra config. Everything is plug-and-play, akin to how Next.js’s create-next-app hides webpack from the user.
Unique Innovations
While building on existing best practices, our framework will offer several distinct advances:
Zero-Config Federation: Most existing MFE solutions (like manual Module Federation or single-spa) require extensive setup. Here, no webpack configs or extra libraries: the CLI handles federation automatically. Developers only worry about their code.
Automated Orchestration: We envision a built-in orchestrator/“composer.” For example, jorvel build could produce a JSON manifest of available MFEs and routes. A “host builder” would automatically stitch their manifests into the final host. This means adding a new MFE is as simple as running jorvel generate remote; the rest of the system flows.
Visual Router (Editor): As an innovative UX, a GUI tool (web-based or IDE-integrated) could allow teams to drag routes/MFEs in a flowchart. This visual mapping would export to jorvel.config.js. It’s an optional feature to simplify understanding complex route hierarchies.
Dynamic Discovery: Going beyond static endpoints, the framework might include an optional MFE discovery registry/service. MFEs could register themselves (via API or a config file), and the host dynamically fetches the list of active MFEs and their versions. This enables “plug-in” MFEs without redeploying the shell, akin to service discovery in microservices.
Smart Defaults for CI/CD: We could partner with hosting platforms (like Vercel or Netlify) to offer one-click MFE deployments. For example, a mfe deploy command might automatically containerize each MFE or push it to a container registry and configure a CDN distribution (similar to Zephyr Cloud for Module Federation
).
Performance Insights: Uniquely, the framework could include a performance dashboard during jorvel dev, highlighting which MFEs are largest or slowest, based on real-time profiling. It might suggest splitting or lazy-loading components that exceed a threshold.
Runtime Resilience: We might incorporate health-checks for MFEs. If a remote fails to load (404 or timeout), the host can fallback to a static “feature disabled” message or a cached version, rather than breaking the whole page. This kind of automatic error handling is uncommon in MF solutions.
By bundling these innovations, the framework will feel “smarter” than generic MFE approaches. For example, instead of manually juggling webpack configs, writing event boilerplate, and handcrafting CI scripts, developers get an all-in-one toolkit that thinks about composition, routes, and builds for them.
Development Roadmap (Phases)
We propose a staged rollout:
MVP (v0.1):
Scope: Core functionality only. Support React (with plan to extend to other frameworks later). Monorepo with host+remote. Basic CLI to generate host and one remote. Module Federation setup (manual config possible). Shell routing and remote lazy-loading. Simple dev server that runs shell + one MFE. Use React Router for navigation. Basic state sharing via props/events.
Goal: Prove the concept: “create a multi-MFE app in minutes.” Focus on DX and stability of core features. No SSR yet (CSR only).
Beta (v0.5):
Scope: Flesh out missing features. Add TypeScript support, auto-sharing of state (Redux) and event bus. Implement monorepo pipelines (cache, parallel builds). Introduce SSR support (server-side host rendering pulling MFEs, static export for pages). Add more CLI commands (multiple remotes, workspaces). Provide sample CI configurations. Polishing error handling and logging.
Goal: Encourage early adopters. Gather feedback on workflow. Ensure all key use-cases (routing, federation, deployment) work reliably.
Release Candidate (v1.0):
Scope: Polish DX and stability. Build the visual routing editor and orchestration tools. Add advanced performance tooling (bundle analyzer, budgets). Expand framework compatibility (e.g. Vue/Angular via optional CLI flags). Harden SSR (edge functions support). Write comprehensive documentation and examples.
Goal: Launch as a stable framework. Provide migration guides for existing apps (e.g. converting a Next.js multi-app to MFE architecture).
Stable (v1.x and beyond):
Scope: Long-term maintenance and feature expansion. Possibly monetize by offering enterprise services (hosted orchestration dashboard, analytics). Explore machine-learning optimizations (e.g. auto-splitting based on usage patterns). Keep the ecosystem growing with plugins (e.g. commerce, analytics).
Goal: Establish as the go-to micro-frontend toolkit, with a vibrant open-source community.
Throughout development, we will iterate with user feedback, continuously integrate improvements to developer experience, and align with emerging web platform features (like React Server Components or Wasm).
Conclusion
This proposed framework bridges the gap between the freedom of micro-frontends and the ease of a unified framework. By codifying best practices (explicit routing, module federation, event-driven integration) and automating the tedious setup, it promises both modularity and simplicity. Developers will get the performance and team-autonomy benefits of micro-frontends without the pain of wiring it all up. With phased development from MVP to stable, we can deliver a polished, Next.js-like DX for the next generation of large-scale web apps.
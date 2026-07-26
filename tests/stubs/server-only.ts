/**
 * `server-only` exists to make the RSC bundler fail a build when a server
 * module is pulled into a client bundle. Under vitest there is no such bundle
 * — the tests *are* the server — so it's stubbed out rather than worked
 * around at every import site.
 */
export {};

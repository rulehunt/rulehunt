export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Example API endpoint
    if (url.pathname === "/api/hello") {
      return new Response(JSON.stringify({ message: "Hello from RuleHunt API" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Serve static assets (index.html by default)
    return env.ASSETS.fetch(request);
  },
};

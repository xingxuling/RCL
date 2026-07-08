import { createRclMcpHttpServer } from '../src/rcl-mcp-server.mjs';

const server = createRclMcpHttpServer({ path: '/mcp', sessionId: 'rcl-vercel-mcp' });

export default function handler(request, response) {
  if (request.url?.startsWith('/api/mcp')) {
    request.url = request.url.replace('/api/mcp', '/mcp') || '/mcp';
  }
  return server.emit('request', request, response);
}

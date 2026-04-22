/**
 * MSW v2 handlers for the example service.
 * These handlers are shared across vitest-native unit tests and Playwright
 * screenshot tests — a single mock surface per endpoint.
 *
 * Happy path: GET /api/example -> 200 { id: '1', name: 'Example' }
 * Error path:  GET /api/example?error=1 -> 500 { error: 'Internal server error' }
 */
import { HttpResponse, http } from 'msw';

export const exampleHandlers = [
  http.get('https://api.example.com/api/example', ({ request }) => {
    const url = new URL(request.url);

    if (url.searchParams.get('error') === '1') {
      return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return HttpResponse.json({ id: '1', name: 'Example' }, { status: 200 });
  }),
];

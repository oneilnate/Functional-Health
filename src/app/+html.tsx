/**
 * +html.tsx — Static HTML shell for the Expo web export.
 *
 * Sets a non-empty <title> in the static HTML so that accessibility tools
 * (axe, Lighthouse) that check document-title before JavaScript hydrates
 * always find a valid title. The expo-router <Head> component overwrites
 * this at runtime with the route-specific title.
 *
 * Without this file, Expo emits an empty <title data-rh="true"></title>
 * in the static HTML, which triggers a document-title axe violation.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function HtmlRoot({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Static fallback title — overwritten by expo-router <Head> at runtime */}
        <title>Functional Health</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

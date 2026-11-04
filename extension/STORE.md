# Publishing on Firefox Add-ons (addons.mozilla.org)

Everything to paste into the submission form at https://addons.mozilla.org/developers/addon/submit/distribution.
Free to publish. The same listing covers Firefox on desktop and on Android.

## Files to upload

| Step | File | How to make it |
|---|---|---|
| Add-on package | `dist-extension/baa-ook-club-firefox-1.0.0.zip` | `npm run ext:build` |
| Source code (AMO asks because the code is bundled/minified) | `dist-extension/baa-ook-club-source-1.0.0.zip` | `npm run ext:source` |
| Screenshots | `extension/store/1-key-setup.png` … `5-conversation.png` (1280×800) | already made |

Before uploading, check it with Mozilla's linter (same checks AMO runs): `npx web-ext lint --source-dir dist-extension/firefox`.
Current result: 0 errors, 3 warnings, explained in the reviewer notes below.

## Listing

**Name:** Baa-ook Club

**Summary** (max 250 characters):
> A cozy place to talk a book over, out loud. Upload a PDF, pick an animated host (a sheep, a yeti, a storyteller or a pixel blob) and ask anything about it. Answers come from the book, spoken aloud. Uses your own free Gemini API key.

**Description:**
> Hand a book to an animated host and talk it through.
>
> • Upload any PDF book (up to 50 MB).
> • Pick your host: Woolf the calm sheep, Frost the big-hearted yeti, Silas the fireside storyteller or Pip the punchy pixel blob. Each has their own personality, voice and colour of room.
> • Ask questions by typing (or by voice in browsers with built-in speech recognition). The host answers from the book, honestly says when something isn't in it, and reads the answer aloud.
> • Switch hosts mid-conversation; the show notes keep everything, with replay.
>
> Bring your own key: Baa-ook Club uses Google's Gemini API with your own free key from aistudio.google.com/apikey. Your key stays in this browser and is only sent to Google. There are no accounts, no analytics and no ads.
>
> Please note: your book and questions are sent to Google Gemini to be answered. On Gemini's free tier Google may use what you send to improve its products, so don't upload anything sensitive or personal. Google requires Gemini API users to be 18 or older. In Firefox the mic button isn't shown, because Firefox has no built-in speech recognition; typing works everywhere.
>
> The characters are Rive community animations used under CC BY 4.0: Kuzu Kuzu Mee by musaadanur, Wave, Hear and talk by japarj (remix of JcToon), Character face animation by ak2665622, and Rive Avatar by nasmith.

**Categories:** Games & Entertainment (pick a second one if the form asks, e.g. Other)

**Tags:** books, reading, ai, voice, podcast

**Homepage:** https://shriy-singh.github.io/baa-ook-club/

**Support site:** https://github.com/shriy-singh/baa-ook-club/issues

**Privacy policy:** https://shriy-singh.github.io/baa-ook-club/privacy.html
(The form may ask you to paste the policy text instead of a link; copy it from that page.)

**License:** MIT License (matches `LICENSE` in the repo). The characters stay under their artists' CC BY 4.0 licences; that's stated in the description and in `LICENSE`.

**Screenshot captions:**
1. Bring your own free Gemini key; it stays in your browser.
2. Woolf the sheep hosts in a sage-green room.
3. Frost the yeti listens with both ears.
4. Pip, the 8-bit blob, keeps answers short and punchy.
5. Ask about your book and the host answers out loud, with show notes.

## Data collection declaration

The manifest declares `data_collection_permissions.required: ["personalCommunications"]`, because the extension
sends the user's own messages (typed questions) and their uploaded book to a third party (Google Gemini) to work.
No category matches "AI chat about a document" exactly; if the reviewer suggests another, change it in
`extension/build.mjs` and rebuild.

## Notes to reviewer (paste into "Notes for reviewers")

> Baa-ook Club is open source: https://github.com/shriy-singh/baa-ook-club. The attached source zip is that repository at the submitted version.
>
> Build: Node.js 20 or later, then `npm ci` and `npm run ext:build`. The Firefox package is written to `dist-extension/firefox/` (and zipped as `dist-extension/baa-ook-club-firefox-1.0.0.zip`). The extension pages are built with Vite from `extension/` and shared React code in `components/` and `lib/`.
>
> What it does: extension pages only (a toolbar popup that opens `index.html` in a tab). No content scripts, no background script, no access to websites or tabs. Network access is limited by CSP (`connect-src 'self' https://generativelanguage.googleapis.com`) and host permission to Google's Gemini API, called with the user's own API key, which is stored in `storage.local`. The host permission is requested in the click that saves the key.
>
> WebAssembly: `rive.wasm` is the official Rive animation runtime from the npm package `@rive-app/canvas` (`extension/build.mjs` copies it unmodified from `node_modules/@rive-app/canvas/rive.wasm`); it needs `'wasm-unsafe-eval'`. The `.riv` files in `characters/` are Rive animation data, not code.
>
> Linter warnings (3 × UNSAFE_VAR_ASSIGNMENT, innerHTML): two are inside React DOM's handling of `dangerouslySetInnerHTML`, which this extension never uses; one is in the Rive runtime's optional FPS counter, which writes a fixed label and a number. No user or remote content is ever written as HTML.
>
> Testing without your own key: get a free key at https://aistudio.google.com/apikey, paste it on the first screen, then drop any PDF.

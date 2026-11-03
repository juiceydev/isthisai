todo

## type

- Work Sans - SIL Open Font License.
- Bulky Pixels - (c) 1999 Smoking Drum. Free for personal and commercial use,
  redistribution allowed with credit and a link to https://www.smokingdrum.com.
  Bundled as a two-glyph subset (A, I) in `src/assets/bulky-pixels-ai.woff2`;
  the original terms are in `src/assets/bulky-pixels-license.txt`.

## notifications

Optional web push. Generate a key pair once:

```
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in `.env`.

- After submitting a link, the page offers "notify me when it's checked". Accepting
  stores the browser push subscription in `data/subs.json` against that check id.
  Publishing the check sends one notification and drops the id.
- The admin panel offers "notify me" for new pending submissions. That
  subscription is only accepted for a logged-in admin.
- Dead subscriptions (404/410) are deleted; entries expire after 90 days.
- iOS only delivers these when the site is added to the home screen.

# Anonymous site feedback

The shared header opens the native dialog in `src/components/Feedback.astro`.
It captures `location.href` when opened, including query filters and the hash.
There is no email field, account lookup, analytics payload, or identity column.

The receiver is `Code.gs`, deployed under the DHC Google account as a web app
executing as the owner with access set to **Anyone**. It can append reports to
the fixed private spreadsheet; it does not expose spreadsheet contents.

Spreadsheet: https://docs.google.com/spreadsheets/d/1IgdN_Y-OnftFJkTMwNr2PLCvxlqYWhCDtNu03rV_5GQ/edit
Tab: `Ziņojumi`; columns: timestamp, kind, description, page URL, status, request ID.

After the Google owner authorizes the deployment, set its `/exec` URL as the
Astro build variable `PUBLIC_FEEDBACK_ENDPOINT` and rebuild. This is a public
write-only endpoint URL, not a credential. Without it the UI explicitly says
submission is not connected; it never pretends to have sent a report.

Submission uses a normal POST into a hidden iframe. The receiver acknowledges
with `postMessage` after a successful sheet write. The client validates the
Google response origin and the random request ID. Failed/timed-out submissions
retain the draft; an identical retry reuses the ID and the receiver deduplicates
it. The receiver validates fields, stores user input as literal text, applies
a honeypot and a 30-report global per-minute cap, and serializes writes.
These basic controls do not replace stronger spam protection if volume grows.

The site is static. Any change to the endpoint build variable requires a new
build. Google deployment changes require a new deployed script version.

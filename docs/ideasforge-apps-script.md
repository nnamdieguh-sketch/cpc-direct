# Connect IdeasForge numbers (Apps Script snippet)

The portal's **IdeasForge** tab pulls live data from the `IdeasForge` tab in your
workbook through a new `ideasForge` action on the **same Apps Script** that already
powers the advisory app. Nothing else is exposed — only that one tab.

> Not comfortable editing Apps Script? Paste your current `doPost`/`Code.gs` to me
> and I'll return the exact, ready-to-paste version. The snippet below is the
> generic form.

## Steps
1. Open the Apps Script project bound to your workbook (Extensions → Apps Script).
2. Set `IDEAS_TAB` below to the **exact** name of your IdeasForge tab.
3. Paste `handleIdeasForge_` into the project.
4. In your `doPost(e)` router, add a branch for the `ideasForge` action, next to
   your existing admin actions (e.g. `allLeads`):

   ```js
   if (action === 'ideasForge') return handleIdeasForge_(body);
   ```
5. **Deploy → Manage deployments → Edit → New version → Deploy** (so the change
   goes live). Access stays "Anyone".

## Snippet

```js
// Set this to the exact name of your IdeasForge tab.
var IDEAS_TAB = 'IdeasForge';

function handleIdeasForge_(body) {
  // Reuse your existing admin-key check. If you have a helper for it,
  // call that instead of this line.
  if (!body || body.adminKey !== getAdminKey_()) {
    return json_({ ok: false, error: 'unauthorized' });
  }

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(IDEAS_TAB);
  if (!sh) return json_({ ok: true, ideas: [] });

  var values = sh.getDataRange().getValues();
  if (values.length < 2) return json_({ ok: true, ideas: [] });

  var headers = values[0].map(function (h) { return String(h).trim(); });
  var MAP = {
    'Date': 'date', 'Timestamp': 'date',
    'Full Name': 'name', 'Name': 'name',
    'Email': 'email',
    'Phone / WhatsApp': 'phone', 'Phone/Whatsapp': 'phone', 'Phone': 'phone',
    'Country': 'country',
    'Idea Name': 'idea',
    'Problem It Solves': 'problem',
    'Target Customer': 'target',
    'Current Stage': 'stage',
    'Support Needed': 'support',
    'Additional Notes': 'notes'
  };

  var ideas = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.join('').trim() === '') continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var key = MAP[headers[c]] || headers[c];
      var val = row[c];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[key] = val;
    }
    ideas.push(obj);
  }
  ideas.reverse(); // newest first
  return json_({ ok: true, ideas: ideas });
}

// Minimal helpers — only paste these if your project doesn't already have them
// (it almost certainly does, under your own names):
// function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
// function getAdminKey_(){ return PropertiesService.getScriptProperties().getProperty('ADMIN_KEY'); }
```

The portal reads `{ ok: true, ideas: [...] }` and shows the count by stage plus a
searchable table. The columns are matched flexibly, so minor header differences
still work.

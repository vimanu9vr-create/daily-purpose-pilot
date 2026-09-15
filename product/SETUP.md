# Getting the workbook selling

Sold through **Lemon Squeezy**, store `manifestai`. 5% + 50¢ per sale, merchant
of record, so VAT and sales tax are their problem rather than yours.

```
product/
  The Seven-Day Reset - ManifestAI.pdf   ← the $29 product
  Day One - free sample.pdf               ← the free lead magnet
  index.html                              ← the sales page
  thanks.html                             ← the Day 8 upsell page
  img/                                    ← the five page previews
  walkthrough.mp4 + poster.jpg            ← the video
  og.jpg                                  ← share card for WhatsApp / socials
  gumroad-description.md                  ← the long product description
```

---

## The live URLs

| What | Where |
| --- | --- |
| Sales page | `daily-purpose-pilot.vimanu9-vr.workers.dev/reset/` |
| Day 8 upsell page | `daily-purpose-pilot.vimanu9-vr.workers.dev/reset/thanks.html` |
| Paid checkout | `manifestai.lemonsqueezy.com/checkout/buy/c73986b9-9546-4221-9cad-b929e885f369` |
| Free sample | `manifestai.lemonsqueezy.com/checkout/buy/805526bf-3fef-48dd-9522-045a898bf2ad` |

Both carry `?embed=1` on the page, so `lemon.js` opens them as an overlay rather
than sending anyone to lemonsqueezy.com. Every context switch loses people, and
the moment between deciding and paying is the worst one to introduce a second
website. If the script fails to load the buttons still work as ordinary links.

---

## How a buyer actually gets the file

This took three wrong attempts, so it is written down properly.

Lemon Squeezy gives each product **one** "access your product" button. It shows
up twice — in the confirmation modal after payment, and in the receipt email.
Both point at the buyer's order page, where the PDF lives.

**Never put your own URL in either of those button link fields.** It does not
add a second destination; it *replaces* the download. Someone pays, gets sent to
a marketing page instead of their file, and you don't find out until they
complain. Leave both at their defaults.

The upsell goes somewhere else — **Product → Links**. Up to three links shown on
the order page *next to* the download rather than instead of it:

| Product | Link title | URL |
| --- | --- | --- |
| The Seven-Day Reset | `Day 8 — start the app free` | `…/reset/thanks.html` |
| Day One — free sample | `The full seven days — $29` | `…/reset/` |

One link gets clicked. Three get ignored.

The PDF also carries the app link on page 2 and the last page, so someone who
never clicks anything inside Lemon Squeezy still finds it.

---

## Product settings that matter

Both: tax category **eBook**, shown on storefront, file attached.

Check the file is genuinely attached. An empty Files box means nothing downloads
no matter what else is configured, and checkout gives no hint anything is wrong.

The long description — about 6,200 characters, in `gumroad-description.md`
despite the filename — goes on the product page, not the short field in the
create panel. The length is deliberate: descriptions over 5,000 characters earn
substantially more than two-line ones. Don't trim it.

---

## Deploying a change

```bash
cd ~/Claude/Projects/"Manifest anything Ai"
cp product/index.html product/thanks.html public/reset/
git add -A && git commit -m "…" && git push
```

Editing `product/index.html` alone changes nothing anyone can see. The live site
serves the copy in `public/reset/`.

---

## Still outstanding

**Three real testimonials.** `index.html` has the section written and ready,
sitting in an HTML comment near the author note. It's commented out because
there is nothing true to put in it yet, and invented quotes are both illegal in
most places and obvious to the people you're trying to persuade.

The honest way to fill it inside a week: give the PDF free to ten people who fit
the audience, ask them to do Days 1 and 2, then ask one question — **"what did
you notice?"** Use their exact words, a first name and a city, and say on the
page that they got a free copy. Disclosed early feedback is still social proof.
The thank-you page now asks buyers the same question, so answers should start
arriving on their own.

Specificity converts, not praise. *"I wrote the sentence on day one and realised
I'd been avoiding it for a year"* does work that *"Great workbook!"* cannot.
Then delete the `<!--` and `-->` around the section.

**Buy your own copy and refund it.** Lemon Squeezy refunds instantly. It is the
only way to know the chain holds: overlay opens, payment completes, the modal
offers the PDF, the file is the right one, the receipt arrives, the Day 8 link
is on the order page. A broken download found by your first real customer costs
you that customer and the review.

---

## What to expect

Average conversion on a page like this is around 3%; a good one reaches 6–8%.
Per hundred visitors, three to eight sales — $80 to $210 after fees.

The number that decides the outcome is the hundred, not the percentage. Get it
live, send a hundred people, read the answer. Zero sales means the offer or the
audience is wrong. Two or more means it works and the rest is a traffic problem,
which is the better problem to have.

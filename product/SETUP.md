# Getting the workbook selling

Four files, two of them yours to configure. Twenty minutes end to end.

```
product/
  The Seven-Day Reset - ManifestAI.pdf   ← upload to Gumroad ($29)
  Day One - free sample.pdf               ← upload as a second, free product
  index.html                              ← the sales page
  thanks.html                             ← where buyers land after paying
  img/                                    ← the five page previews
  walkthrough.mp4 + poster.jpg            ← the video
  og.jpg                                  ← share card for WhatsApp / socials
```

Everything except the two PDFs must be uploaded together and keep this folder
shape — the page references `img/`, the video and `og.jpg` by relative path.

---

## 1. Create the product on Gumroad

[gumroad.com](https://gumroad.com) → New product → **Digital product**.

| Field | Value |
| --- | --- |
| Name | The Seven-Day Reset |
| Price | **$29** |
| File | `The Seven-Day Reset - ManifestAI.pdf` |
| Cover | Take a screenshot of the PDF's first page |

**Write a long description.** This matters more than it sounds: Gumroad
products with descriptions over 5,000 characters earn roughly twenty times
what products under 500 characters earn. Do not upload the file with two lines
under it. Copy the body text out of `index.html` — the problem, the mechanism,
what's inside, who it's for — and paste it in.

Add two or three images as well. Products with a cover plus interior shots
substantially outperform products with a bare cover.

---

## 2. Send buyers to the thank-you page

In the product's settings, find **Redirect after purchase** (Gumroad also
calls this the "URL redirect" or content redirect) and set it to:

```
https://daily-purpose-pilot.vimanu9-vr.workers.dev/reset/thanks.html
```

That page is the only place the app is sold properly. Someone who has just
paid you is the warmest audience this business will ever have, which is
exactly why the sales page doesn't waste itself on them.

---

## 3. Wire up every link — one command

**Until you do this, the buy buttons and the download button cannot work.**
They point at a product that does not exist yet. That is not a bug in the
page; there is nothing on the other end of them.

```bash
cd ~/Claude/Projects/"Manifest anything Ai"/product
./configure.sh
```

It asks for three things and fills in every link on both pages:

| It asks for | Example |
| --- | --- |
| Paid product URL | `https://you.gumroad.com/l/reset` |
| Free sample URL | `https://you.gumroad.com/l/dayone` |
| Download URL for buyers | leave blank to use the Gumroad library |

Then it prints every link on both pages and refuses to finish if a single
placeholder is left. Run it again any time your URLs change.

### Why the download button won't work when *you* click it

It sends people to their Gumroad library, which only has the file in it if
that browser is signed into the Gumroad account that bought it. Clicking it
yourself, signed out, gets you an empty library — which looks broken and
isn't.

The only honest test is to buy your own product and refund it (step 7). If
you'd rather the button went straight to the file, paste the direct download
URL from your own receipt email when `configure.sh` asks for it.

The file is deliberately **not** served from your own site. A link like
`/reset/The Seven-Day Reset.pdf` is a public link to a paid product — anybody
who guesses it, or is sent it, skips paying.

The buy buttons carry Gumroad's overlay script, so checkout opens on top of
your page rather than sending people to gumroad.com and back. Every context
switch loses people, and the moment between deciding and paying is the worst
one to introduce a second website. If the script fails to load the buttons
still work as ordinary links, so nothing depends on it.

---

## 4. Put it online

It can live on the domain you already have, for nothing:

```bash
mkdir -p ~/Claude/Projects/"Manifest anything Ai"/public/reset
cp -R index.html thanks.html walkthrough.mp4 poster.jpg og.jpg img \
   ~/Claude/Projects/"Manifest anything Ai"/public/reset/
cd ~/Claude/Projects/"Manifest anything Ai" && git add -A && git commit -m "Add the workbook sales page" && git push
```

Live at `daily-purpose-pilot.vimanu9-vr.workers.dev/reset/` on the next
deploy.

The whole page weighs about 450 KB, and the video's 800 KB only downloads if
somebody taps it. That matters more than it sounds — a tenth of a second of
load time is worth roughly 8–10% of conversions, and over half of mobile
visitors abandon a page that takes more than three seconds.

---

## 5. Create the free sample product

The page ends with a free offer for people who won't buy today — Day One, the
cover and the page explaining the mechanism. Their email address is worth more
than their bounce, and email is the largest sales channel for products like
this.

Make a **second Gumroad product**:

| Field | Value |
| --- | --- |
| Name | Day One — free sample |
| Price | **$0** |
| File | `Day One - free sample.pdf` |

Gumroad collects the email for you, so this needs no mailing list, no SMTP and
no signup form. Then replace the second placeholder:

```bash
sed -i '' 's|https://REPLACE-WITH-YOUR-FREE-GUMROAD-LINK|https://YOURNAME.gumroad.com/l/dayone|g' index.html
```

Those addresses are the beginning of the list that eventually matters more
than the page does.

---

## 6. Get three real testimonials

`index.html` has a testimonial section written and ready, sitting in an HTML
comment near the author note. It is commented out because there is nothing
true to put in it yet, and invented quotes are both illegal in most places and
obvious to the people you are trying to persuade.

The honest way to fill it inside a week: give the PDF free to ten people who
fit the audience, ask them to do Days 1 and 2, then ask one question —
**"what did you notice?"** Use their exact words, a first name and a city, and
say on the page that they received a free copy. Disclosed early feedback is
still social proof.

What converts is specificity, not praise. *"I wrote the sentence on day one
and realised I'd been avoiding it for a year"* does work that *"Great
workbook!"* cannot.

Then delete the `<!--` and `-->` around the section.

---

## 7. Check it yourself before anyone else does

Buy your own product. Gumroad lets you refund yourself immediately, and it is
the only way to know the whole chain works.

- The button opens checkout without leaving the page
- Payment completes
- You land on the thank-you page, not Gumroad's default receipt
- The PDF actually downloads, and it is the right file
- The email arrives

A broken download discovered by your first real customer costs you that
customer and the rating.

---

## What to expect

Gumroad's average conversion is 3.2% of visitors; a good page reaches 6–8%.
So per hundred people who land here, two to eight sales — $50 to $200 after
fees.

The number that decides the outcome is the hundred, not the percentage.
Forty-four percent of Gumroad products never earn anything, and almost always
because nobody saw them. Get it live, send a hundred people, and read the
answer. Zero sales means the offer or the audience is wrong. Two or more means
it works and the rest is a traffic problem, which is the better problem to
have.

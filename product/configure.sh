#!/usr/bin/env bash
#
# Fills in every link that depends on your Gumroad account.
#
# Until this is run the buy buttons and the download button cannot work — not
# because they are broken, but because the product they point at does not
# exist yet. Create the two products on Gumroad first, then run this once.
#
#   ./configure.sh
#
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "Paste your Gumroad links. Create the products first if you haven't."
echo
read -rp "  Paid product URL   (e.g. https://you.gumroad.com/l/reset)   : " PAID
read -rp "  Free sample URL    (e.g. https://you.gumroad.com/l/dayone)  : " FREE
echo
read -rp "  Direct download URL for buyers [blank = Gumroad library]    : " DOWN
DOWN="${DOWN:-https://app.gumroad.com/library}"

[ -z "$PAID" ] && { echo "The paid URL is required."; exit 1; }
[ -z "$FREE" ] && FREE="$PAID"

for f in index.html thanks.html; do
  [ -f "$f" ] || continue
  # macOS sed needs the empty -i argument; GNU sed does not. Try both.
  sed -i '' -e "s|https://REPLACE-WITH-YOUR-GUMROAD-LINK|$PAID|g" \
            -e "s|https://REPLACE-WITH-YOUR-FREE-GUMROAD-LINK|$FREE|g" \
            -e "s|https://app.gumroad.com/library|$DOWN|g" "$f" 2>/dev/null \
  || sed -i -e "s|https://REPLACE-WITH-YOUR-GUMROAD-LINK|$PAID|g" \
            -e "s|https://REPLACE-WITH-YOUR-FREE-GUMROAD-LINK|$FREE|g" \
            -e "s|https://app.gumroad.com/library|$DOWN|g" "$f"
done

echo "Checking nothing was missed…"
LEFT=$(grep -o 'href="[^"]*"' index.html thanks.html | grep -c "REPLACE-WITH" || true)
if [ "$LEFT" -eq 0 ]; then
  echo "  ✓ every link resolved"
  echo
  echo "Links now live on the two pages:"
  grep -ho 'href="http[^"]*"' index.html thanks.html | sort -u | sed 's/href=//; s/"//g; s/^/    /'
else
  echo "  ✗ $LEFT placeholder(s) still present — check the output above"
  exit 1
fi

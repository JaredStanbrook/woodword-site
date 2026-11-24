-- Each product page now has its own design (worker/designs/<id>/), chosen by
-- id, in place of a shared layout, palette and heading typeface. The four
-- example pieces move to the designs ported from their old layouts; anything
-- else starts on the draft design until its own is made. Data only: the
-- column is unchanged.
UPDATE `product`
SET `design` = json_set(
  json_remove(`design`, '$.layout', '$.palette', '$.typeface'),
  '$.id', CASE `slug`
    WHEN 'nord-dining-table' THEN 'nord'
    WHEN 'hearth-sideboard' THEN 'hearth'
    WHEN 'grid-shelving' THEN 'grid'
    WHEN 'settle-bench' THEN 'settle'
    ELSE 'draft'
  END,
  '$.extra', json('{}'),
  '$.photos', json('{}')
)
WHERE json_extract(`design`, '$.id') IS NULL;

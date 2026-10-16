Pixel Eagle sprites

All full-size frames are 40x40 px with the feet on the same baseline (row 37),
so the ALERT "!" bubble and its 2 px hop fit without changing frame size.
Minis are 20x15 px. Props are cropped tight.

Folders
  svg/      vector, 1 unit = 1 pixel (crisp edges)
  png/1x/   transparent, native size
  png/8x/   transparent, nearest-neighbour upscale
  sheet_40x40_1x.png / _8x.png + sheet_40x40.json   all 40x40 frames, 6 per row

Animation notes
  RUN / FLAP     alternate pose_run_flap_1 and _2
  HEAD FLIP      pose_head_flip_2 is the mirror of _1; swap every 6 frames
  ALERT          hop frame; body is 2 px higher than idle, shadow stays put
Shadows are #2B2266 at 22% opacity.

Safety gear
  gear_on_*      the eagle wearing/holding each item (40x40, same baseline)
  gear_on_full   hard hat + hi-vis vest + whistle
  gear_*         the items alone, cropped, for layering
  mini_hard_hat  20x15 map mini with a hard hat

Geared set (*_geared)
  Every pose, prop-on-mascot sprite and mini again with hard hat + hi-vis vest + whistle,
  plus expr_* (40x38) and icon_* (32x32 big, 26x26 small) crops.
  sheet_geared_40x40_*.png + .json hold all geared 40x40 frames in the same order.
  Duck & cover shows the hat between the wing feathers; low crawl has no whistle;
  the sign covers the whistle.

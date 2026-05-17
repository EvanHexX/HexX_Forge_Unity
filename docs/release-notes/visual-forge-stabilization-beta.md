# Visual Forge Stabilization Beta Release Notes

## Summary
- This beta focuses on stabilizing Visual Forge for video and image based portrait work.
- The release keeps ASAR disabled while UI naming, placeholder pages, and Visual Forge validation are verified.
- ASAR will be tested in a separate follow-up build after this UI/content release is confirmed.

## Highlights
- Stabilized Visual Forge naming across the app navigation and Home dashboard.
- Verified the video and image workflow surfaces used for preview, loop creation, export, and preset work.
- Kept FFmpeg/frei0r runtime resources outside ASAR so packaged builds can load external tool binaries and plugins reliably.
- Added clearer preparation states for Core Lab and Synthesis Lab while those features remain unimplemented.

## Beta QA Checklist
- Load a video in Visual Forge and confirm preview playback works.
- Create a loop video and confirm the generated output is loaded back into the viewport.
- Export a WebM and confirm FFmpeg completes without missing runtime/plugin errors.
- Load an image, apply background/color-key controls, and export PNG.
- Confirm Sidebar and Home labels are correct in English, Korean, and Simplified Chinese.
- Confirm Core Lab and Synthesis Lab show splash preview plus preparation text.

## Known Notes
- ASAR is intentionally still disabled for this beta.
- Code signing is not yet configured, so Windows SmartScreen may warn on first launch.
- Core Lab and Synthesis Lab remain placeholder pages until their feature workflows are implemented.

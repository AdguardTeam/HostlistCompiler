# Demo Creation Guide

Instructions for creating demonstration videos and GIFs showcasing AdBlock Compiler features.

## Recording Tools

### Windows
- **OBS Studio** (Free, open-source): https://obsproject.com/
- **ScreenToGif** (Free, GIF-specific): https://www.screentogif.com/
- **ShareX** (Free, screenshots & GIFs): https://getsharex.com/

### macOS
- **QuickTime Player** (Built-in): File → New Screen Recording
- **Kap** (Free, open-source): https://getkap.co/
- **CleanShot X** (Paid): https://cleanshot.com/

### Cross-Platform
- **OBS Studio**: https://obsproject.com/
- **Peek** (Linux): https://github.com/phw/peek

## Recommended Settings

### For GIFs
- **Resolution**: 1280x720 (720p) or 1920x1080 (1080p)
- **Frame Rate**: 10-15 FPS (reduces file size)
- **Duration**: 10-30 seconds per feature
- **File Size**: Target < 5MB for GitHub README embedding

### For Videos
- **Resolution**: 1920x1080 (1080p)
- **Frame Rate**: 30 FPS
- **Format**: MP4 (H.264 codec)
- **Duration**: 1-3 minutes total

## Demo Scenarios

### 1. Visual Diff Feature (Priority 1)

**What to Show:**
- Compile a filter list twice with slightly different sources
- Highlight the diff visualization showing added/removed/unchanged rules
- Toggle "Show unchanged lines" checkbox
- Show diff statistics (e.g., "+52 added, -18 removed, 1,234 unchanged")

**Script:**
1. Open https://adblock.jaysonknight.com
2. Navigate to "Simple Mode" tab
3. Enter: `https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt`
4. Click "Compile Filter List"
5. Wait for compilation to complete
6. Modify the source slightly (add one more URL)
7. Click "Compile Filter List" again
8. Show the diff section appearing automatically
9. Demonstrate the "Show unchanged lines" toggle
10. Highlight color coding (green = added, red = removed)

**Annotations to Add:**
- "🎨 Visual Diff" title at start
- Arrow pointing to diff section: "Automatic change detection"
- Callout bubble: "70-80% cache compression"
- End with: "See exactly what changed between compilations"

### 2. Batch API Processing (Priority 2)

**What to Show:**
- Use curl or Postman to send batch compilation request
- Show parallel processing of multiple filter lists
- Display individual results with unique IDs

**Script:**
1. Open terminal or Postman
2. Create batch request JSON:
```json
{
  "requests": [
    {
      "id": "adguard-dns",
      "configuration": {
        "name": "AdGuard DNS",
        "sources": [{"source": "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt"}],
        "transformations": ["Deduplicate", "RemoveEmptyLines"]
      }
    },
    {
      "id": "easylist",
      "configuration": {
        "name": "EasyList",
        "sources": [{"source": "https://easylist.to/easylist/easylist.txt"}],
        "transformations": ["Deduplicate", "Compress"]
      }
    }
  ]
}
```
3. Send POST to `https://adblock-compiler.jayson-knight.workers.dev/compile/batch`
4. Show response with both compilations completed
5. Highlight individual results with IDs

**Annotations to Add:**
- "⚡ Batch API" title
- "Process up to 10 lists in parallel" subtitle
- Highlight response time: "Completed in X.Xs"

### 3. Real-time Progress (Server-Sent Events) (Priority 3)

**What to Show:**
- Browser DevTools Network tab showing SSE events
- Progress bar updating in real-time
- Live logs showing each phase

**Script:**
1. Open Web UI and DevTools (F12)
2. Navigate to Network tab, filter by "compile/stream"
3. Start a compilation with multiple sources
4. Show EventStream connection in Network tab
5. Display progress bar moving with events
6. Show console logs for each event type:
   - `source:start`
   - `source:complete`
   - `transformation:start`
   - `result`
   - `done`

**Annotations to Add:**
- "🔄 Real-time Events" title
- Split screen: Web UI + DevTools
- Label each event type in console
- "Full observability into compilation process"

### 4. Quick Feature Overview (Priority 1)

**What to Show:**
- All major features in quick succession (30-60 seconds)

**Script:**
1. **Intro**: Show homepage briefly (2s)
2. **Simple Mode**: Quick compilation (5s)
3. **Visual Diff**: Show diff section (5s)
4. **Advanced Mode**: JSON configuration (5s)
5. **Progress Events**: Real-time logs (5s)
6. **Download**: Download compiled list (3s)
7. **API**: Show curl command example (5s)
8. **Metrics**: Show /metrics endpoint response (5s)

**Annotations to Add:**
- Feature labels appearing over each section
- "All Features in 60 Seconds" title
- Links at end: GitHub, Docs, API

## Post-Production

### Converting Video to GIF

**Using FFmpeg:**
```bash
# High quality GIF
ffmpeg -i input.mp4 -vf "fps=15,scale=1280:-1:flags=lanczos" -c:v gif output.gif

# Optimized for file size
ffmpeg -i input.mp4 -vf "fps=10,scale=800:-1:flags=lanczos" -c:v gif output-small.gif
```

**Using Online Tools:**
- **ezgif.com**: https://ezgif.com/video-to-gif
- **CloudConvert**: https://cloudconvert.com/mp4-to-gif

### Optimizing GIF File Size

**Using gifsicle:**
```bash
gifsicle -O3 --colors 256 input.gif -o optimized.gif
```

**Using ImageMagick:**
```bash
convert input.gif -fuzz 5% -layers Optimize optimized.gif
```

### Adding Annotations

**Tools:**
- **Camtasia** (Paid): Professional annotations and callouts
- **Kapwing** (Free): https://www.kapwing.com/tools/add-text-to-video
- **GIMP** (Free): For static GIF frame editing

## Hosting & Embedding

### GitHub
Place GIFs/videos in `docs/assets/` directory:
```markdown
![Visual Diff Demo](docs/assets/visual-diff-demo.gif)
```

### YouTube
1. Upload full demo video
2. Create unlisted or public video
3. Embed in README:
```markdown
[![Demo Video](https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)
```

### Cloudflare R2/S3
For large files, host on CDN:
```markdown
![Demo](https://assets.adblock.jaysonknight.com/demo.gif)
```

## Final Checklist

### Before Recording
- [ ] Clear browser cache and cookies
- [ ] Close unnecessary tabs/applications
- [ ] Use clean browser profile (no extensions visible)
- [ ] Set browser zoom to 100%
- [ ] Prepare test data/URLs in advance
- [ ] Test the feature flow beforehand

### During Recording
- [ ] Move mouse slowly and deliberately
- [ ] Pause briefly between actions (easier to edit)
- [ ] Avoid unnecessary clicks/movements
- [ ] Keep recordings focused (one feature at a time)

### After Recording
- [ ] Trim excess time at start/end
- [ ] Speed up slow parts (e.g., compilation wait)
- [ ] Add annotations/callouts for key features
- [ ] Optimize file size (target < 5MB for GIFs)
- [ ] Test playback before publishing

## Example Folder Structure

```
docs/assets/
├── visual-diff-demo.gif          # Visual diff feature (< 5MB)
├── batch-api-demo.gif            # Batch processing (< 5MB)
├── real-time-progress.gif        # SSE events (< 5MB)
├── full-demo.mp4                 # Complete walkthrough (hosted elsewhere)
└── screenshots/
    ├── web-ui-home.png
    ├── simple-mode.png
    ├── advanced-mode.png
    └── diff-view.png
```

## Quick Commands

### Record with OBS Studio
1. Open OBS Studio
2. **Sources** → **+** → **Display Capture** or **Window Capture**
3. Select browser window
4. **Settings** → **Output**:
   - Output Mode: Simple
   - Recording Format: MP4
   - Recording Quality: High Quality
5. Click **Start Recording**
6. Perform demo
7. Click **Stop Recording**

### Record with ScreenToGif
1. Open ScreenToGif
2. Click **Recorder**
3. Position recording frame over browser
4. Click **Record** (or press F7)
5. Perform demo
6. Click **Stop** (or press F8)
7. **File** → **Save as** → Choose optimization level

### Convert and Optimize in One Step
```bash
# Record → Convert → Optimize
ffmpeg -i input.mp4 -vf "fps=12,scale=1024:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 output.gif && gifsicle -O3 output.gif -o final.gif
```

## Tips for Best Results

1. **Keep it Short**: 15-30 seconds per GIF, 2-3 minutes for video
2. **Show Value**: Focus on unique/impressive features
3. **Use Real Data**: Actual filter lists, not dummy data
4. **Add Captions**: Explain what's happening
5. **Optimize Aggressively**: Smaller files = faster loads = more views
6. **Test Playback**: Ensure GIFs loop smoothly
7. **Mobile Friendly**: Test on mobile browsers
8. **Accessibility**: Add alt text for screen readers

## Resources

- **Demo Inspiration**: https://github.com/topics/demo
- **GIF Best Practices**: https://web.dev/efficient-animated-content/
- **Screen Recording Guide**: https://obsproject.com/wiki/
- **Video Optimization**: https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/video

---

**Questions?** Open an issue at https://github.com/jaypatrick/adblock-compiler/issues

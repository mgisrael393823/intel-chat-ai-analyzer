# Responsive Layout Test Checklist

## Breakpoints Applied
- **Mobile**: < 640px (default)
- **Small**: 640px+ (`sm:`)
- **Medium**: 768px+ (`md:`) - Not used in new layout
- **Large**: 1024px+ (`lg:`) - Main layout switch
- **Extra Large**: 1280px+ (`xl:`) - Wider sidebar

## Layout Changes by Breakpoint

### Mobile (< 640px)
- Stacked layout (sidebar above chat)
- Reduced padding: `p-2`
- Simplified header text ("Back" instead of "Back to Home")
- Full-width sidebar and chat
- Smaller text sizes

### Tablet (640px - 1023px)
- Still stacked layout
- Normal padding: `p-4`
- Full header text visible
- Better spacing

### Desktop (1024px+)
- Side-by-side layout
- Sidebar width: 400px
- Gap between columns: 24px
- Chat takes remaining space

### Wide Desktop (1280px+)
- Sidebar width: 450px
- Same layout as desktop

## Testing Scenarios

### 1. Mobile Portrait (375x667 - iPhone SE)
- [ ] Open app and verify stacked layout
- [ ] Upload a file - verify sidebar scrolls independently
- [ ] Type long message - verify input grows but doesn't push chat off screen
- [ ] Open keyboard - verify chat is still visible above input
- [ ] Send 50+ messages - verify smooth scrolling
- [ ] Rotate to landscape - verify layout adapts

### 2. Mobile Landscape (667x375)
- [ ] Verify layout remains stacked (not side-by-side)
- [ ] Check that header is still visible
- [ ] Verify chat messages area has enough height
- [ ] Test with keyboard open

### 3. Tablet Portrait (768x1024 - iPad)
- [ ] Verify stacked layout (not side-by-side yet)
- [ ] Check spacing and padding
- [ ] Test with on-screen keyboard
- [ ] Verify file upload zone is fully visible

### 4. Tablet Landscape (1024x768)
- [ ] Verify side-by-side layout activates
- [ ] Sidebar should be 400px wide
- [ ] Chat should fill remaining space
- [ ] Test scrolling in both columns independently

### 5. Desktop (1440x900)
- [ ] Verify side-by-side layout
- [ ] Sidebar width: 450px (xl breakpoint)
- [ ] Test window resize from 1440 to 900 width
- [ ] Verify no horizontal scroll at any width
- [ ] Test with browser zoom 67% to 150%

### 6. Dynamic Viewport (Mobile)
- [ ] iOS Safari: Test with URL bar visible/hidden
- [ ] Android Chrome: Test with URL bar visible/hidden
- [ ] Verify layout doesn't jump when bars hide/show
- [ ] Test pull-to-refresh doesn't break layout

### 7. Content Overflow Tests
- [ ] Upload 10+ files - verify sidebar scrolls
- [ ] Long filename - verify truncation with ellipsis
- [ ] Send message with 2000 characters
- [ ] Test with 100+ chat messages
- [ ] Multiple "Processing..." status files

### 8. Interaction Tests
- [ ] Drag and drop file on mobile (should work)
- [ ] Tap outside input to dismiss keyboard
- [ ] Swipe to scroll in chat
- [ ] Long press to select text in messages
- [ ] Double-tap to zoom (should be disabled)

## CSS Classes Applied

### Container Structure
```
min-h-screen flex flex-col - Full height, column layout
flex-1 min-h-0 - Flexible height with overflow prevention
overflow-y-auto - Vertical scroll when needed
```

### Responsive Utilities
```
p-2 sm:p-4 - Padding responsive
w-full lg:w-[400px] xl:w-[450px] - Width responsive
flex-col lg:flex-row - Layout direction
gap-4 lg:gap-6 - Gap sizing
hidden sm:inline - Text visibility
text-lg sm:text-xl - Font size
```

## Known Issues to Test For
1. iOS Safari 100vh includes URL bar - using flex instead
2. Android keyboard can push layout - fixed with flex-shrink-0
3. Radix ScrollArea needs explicit height - added min-h-0
4. Chat input growth can break layout - constrained with max-height

## Browser Testing Matrix
- Chrome (Windows, Mac, Android)
- Safari (Mac, iOS)
- Firefox (Windows, Mac)
- Edge (Windows)
- Samsung Internet (Android)

## Performance Metrics to Check
- First paint on mobile < 1.5s
- Smooth scrolling at 60fps
- No layout shift when loading messages
- Touch response < 100ms
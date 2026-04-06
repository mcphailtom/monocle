//go:build darwin

package desktop

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#cgo LDFLAGS: -framework Cocoa

#import <Cocoa/Cocoa.h>

static CGFloat gDesiredCenterY = 26.0;

static void applyTrafficLightPosition(NSWindow *window) {
	NSButton *close = [window standardWindowButton:NSWindowCloseButton];
	NSButton *mini  = [window standardWindowButton:NSWindowMiniaturizeButton];
	NSButton *zoom  = [window standardWindowButton:NSWindowZoomButton];

	if (!close || !close.superview) return;

	NSView *container = close.superview;
	CGFloat containerH = container.frame.size.height;

	for (NSButton *btn in @[close, mini, zoom]) {
		NSRect f = btn.frame;
		if (container.isFlipped) {
			f.origin.y = gDesiredCenterY - f.size.height / 2.0;
		} else {
			f.origin.y = containerH - gDesiredCenterY - f.size.height / 2.0;
		}
		btn.frame = f;
	}
}

// Re-apply on window events that reset button positions.
@interface MonocleTrafficLightObserver : NSObject
@property (nonatomic, weak) NSWindow *window;
@end

@implementation MonocleTrafficLightObserver
- (void)reapply:(NSNotification *)note {
	if (self.window) {
		// Dispatch async to run after macOS finishes its own layout pass.
		dispatch_async(dispatch_get_main_queue(), ^{
			applyTrafficLightPosition(self.window);
		});
	}
}
@end

static MonocleTrafficLightObserver *observer = nil;

void configureTrafficLights(double centerY) {
	gDesiredCenterY = (CGFloat)centerY;

	dispatch_async(dispatch_get_main_queue(), ^{
		NSWindow *window = [[NSApp windows] firstObject];
		if (!window) return;

		applyTrafficLightPosition(window);

		if (!observer) {
			observer = [[MonocleTrafficLightObserver alloc] init];
			observer.window = window;

			NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
			SEL sel = @selector(reapply:);
			[nc addObserver:observer selector:sel name:NSWindowDidResizeNotification object:window];
			[nc addObserver:observer selector:sel name:NSWindowDidBecomeKeyNotification object:window];
			[nc addObserver:observer selector:sel name:NSWindowDidExitFullScreenNotification object:window];
			[nc addObserver:observer selector:sel name:NSWindowDidMoveNotification object:window];
		}
	});
}
*/
import "C"

import "time"

// configureTrafficLightPosition moves the macOS traffic light buttons so their
// vertical center aligns with centerY pixels from the top of the window.
// A notification observer keeps them in position across resizes and focus changes.
func configureTrafficLightPosition(centerY float64) {
	go func() {
		// Short delay to ensure the window is fully laid out by Wails.
		time.Sleep(100 * time.Millisecond)
		C.configureTrafficLights(C.double(centerY))
	}()
}

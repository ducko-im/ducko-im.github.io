import AppKit

// Exports the SF Symbols the windows show as SVG path data, taken from the glyphs AppKit draws on this Mac. Run it on a
// Mac with the macOS release the captures were taken on, outside the sandbox, which renders symbols differently. Each
// glyph is checked against AppKit's own rendering of the symbol at 2x before it is written.
// Usage: swift symbols.swift <out.ts>
//        swift symbols.swift --png <out-dir> <symbol> <point-size> <weight>   (one candidate at 2x, for matching)

/// A text style, as Ducko's SwiftUI views set one, or a fixed size and weight.
enum Font {
    case style(NSFont.TextStyle)
    case system(CGFloat, NSFont.Weight)

    var configuration: NSImage.SymbolConfiguration {
        switch self {
        case let .style(style): NSImage.SymbolConfiguration(textStyle: style, scale: .medium)
        case let .system(size, weight): NSImage.SymbolConfiguration(pointSize: size, weight: weight, scale: .medium)
        }
    }
}

/// The keys `icon()` accepts, each with its symbol and the font it is drawn in, and where Ducko sets that font. AppKit
/// draws the three traffic-light glyphs and the two menu glyphs itself; their sizes were matched against the captures.
let table: [(key: String, symbol: String, font: Font)] = [
    ("xmarkLight", "xmark", .system(9, .black)), // the close button's hover glyph, matched against chat-lights-hover
    ("minusLight", "minus", .system(9.5, .black)), // the minimize button's hover glyph, matched against chat-lights-hover
    ("plusLight", "plus", .system(9.5, .black)), // the zoom button's hover glyph, matched against chat-lights-hover
    ("chevronRightGroup", "chevron.right", .system(10, .semibold)), // GroupHeaderRow: caption2, semibold
    ("chevronDownStatus", "chevron.down", .system(8, .semibold)), // StatusBarView
    ("checkmarkMenu", "checkmark", .system(13.25, .regular)), // NSMenu's state mark, matched against contacts-status-menu
    ("bubblesFillRoom", "bubble.left.and.bubble.right.fill", .system(14.4, .regular)), // RoomRow: 0.45 × the avatar
    ("infoCircle", "info.circle", .style(.body)), // ChatHeaderView
    ("clock", "clock", .style(.body)), // ChatHeaderView
    ("lockOpen", "lock.open", .style(.body)), // ChatHeaderView
    ("person2", "person.2", .style(.body)), // ChatHeaderView
    ("chevronDownMenu", "chevron.down", .system(7.6, .heavy)), // the borderless menu's indicator, matched against chat-key
    ("pencilSubject", "pencil", .style(.caption1)), // RoomSubjectView
    ("checkmarkDelivery", "checkmark", .style(.caption2)), // MessageMetadataView
    ("pencilEdit", "pencil", .style(.body)), // ReplyComposeBar
    ("xmarkCircleFill", "xmark.circle.fill", .style(.body)), // ReplyComposeBar and the tab's close button
    ("paperclip", "paperclip", .style(.title3)), // MessageInputView
    ("arrowUpCircleFill", "arrow.up.circle.fill", .style(.title2)), // MessageInputView
    ("number", "number", .style(.body)), // ConversationActivitySlot in a tab
    ("chevronDownOverflow", "chevron.down", .style(.body)), // ChatTabBarView's overflow menu
    ("bubblesEmpty", "bubble.left.and.bubble.right", .style(.largeTitle)), // ChatContainerView's empty state
    ("ellipsisBubbleFill", "ellipsis.bubble.fill", .style(.callout)), // ConversationActivitySlot
]

let weights: [String: NSFont.Weight] = [
    "ultralight": .ultraLight, "thin": .thin, "light": .light, "regular": .regular, "medium": .medium,
    "semibold": .semibold, "bold": .bold, "heavy": .heavy, "black": .black,
]

func fail(_ message: String, code: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data("\(message)\n".utf8))
    exit(code)
}

/// CUINamedVectorGlyph has no public interface. Key-value coding reads its values, but not a CGPath, which this calls
/// through the runtime.
func cgPath(_ object: NSObject, _ name: String) -> CGPath {
    let selector = NSSelectorFromString(name)
    guard object.responds(to: selector) else { fail("\(type(of: object)) has no \(name)") }
    return unsafeBitCast(object.method(for: selector)!, to: (@convention(c) (AnyObject, Selector) -> Unmanaged<CGPath>).self)(
        object, selector
    ).takeUnretainedValue()
}

func value<T>(_ object: NSObject, _ key: String) -> T {
    guard let value = object.value(forKey: key) as? T else { fail("\(type(of: object)) has no \(key) of type \(T.self)") }
    return value
}

/// The monochrome rendering's layers in drawing order: fills add to the outline, and erasers cut a gap out of it, such
/// as the one around the front bubble of bubble.left.and.bubble.right.fill. Erasers report an opacity of 0, so they are
/// told apart by their own flag.
func visibleOutline(_ vector: NSObject) -> CGPath {
    var visible: CGPath = CGMutablePath()
    for layer in value(vector, "monochromeLayers") as [NSObject] {
        let shape = cgPath(layer, "shape")
        guard value(layer, "strokeWidth") as Double == 0 else { fail("a stroked layer in \(vector)") }
        if value(layer, "isEraserLayer") as Bool {
            visible = visible.subtracting(shape)
        } else if value(layer, "opacity") as Double > 0 {
            visible = visible.union(shape)
        }
    }
    return visible
}

struct Glyph {
    let image: NSImage
    /// The outline in the image's points, y pointing down as in SVG.
    let path: CGPath
}

func glyph(_ symbol: String, _ configuration: NSImage.SymbolConfiguration) -> Glyph {
    guard let image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?.withSymbolConfiguration(configuration),
          let rep = image.representations.first, let vector = rep.value(forKey: "vectorGlyph") as? NSObject
    else { fail("no vector glyph for \(symbol)") }
    let outline = visibleOutline(vector)
    let scale: Double = value(vector, "scale")
    let alignment = (value(vector, "alignmentRect") as NSValue).rectValue
    // The outline is in the glyph's pixels with y pointing down, from the top of its unrounded alignment rect. AppKit
    // draws that rect from the rounded rect's origin (y up), which puts its top at this y in SVG terms.
    let top = image.size.height - alignment.origin.y - (value(vector, "alignmentRectUnrounded") as NSValue).rectValue.height
    var transform = CGAffineTransform(translationX: alignment.origin.x, y: top).scaledBy(x: 1 / scale, y: 1 / scale)
    guard let path = outline.copy(using: &transform) else { fail("cannot transform \(symbol)") }
    return Glyph(image: image, path: path)
}

func bitmap(_ size: CGSize, _ draw: (CGContext) -> Void) -> NSBitmapImageRep {
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: Int(size.width * 2), pixelsHigh: Int(size.height * 2), bitsPerSample: 8,
        samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ), let context = NSGraphicsContext(bitmapImageRep: rep) else { fail("cannot make a bitmap") }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.cgContext.scaleBy(x: 2, y: 2)
    draw(context.cgContext)
    NSGraphicsContext.restoreGraphicsState()
    return rep
}

/// AppKit's own drawing of the image at 2x.
func rendered(_ image: NSImage) -> NSBitmapImageRep {
    bitmap(image.size) { _ in image.draw(in: NSRect(origin: .zero, size: image.size)) }
}

/// The summed alpha difference between AppKit's drawing of the image and a fill of the path, both at 2x.
func mismatch(_ glyph: Glyph) -> Int {
    let appKit = rendered(glyph.image)
    let ours = bitmap(glyph.image.size) { context in
        context.translateBy(x: 0, y: glyph.image.size.height)
        context.scaleBy(x: 1, y: -1)
        context.addPath(glyph.path)
        context.setFillColor(.black)
        context.fillPath()
    }
    var sum = 0
    for y in 0 ..< appKit.pixelsHigh {
        for x in 0 ..< appKit.pixelsWide {
            sum += abs(Int(appKit.colorAt(x: x, y: y)!.alphaComponent * 255) - Int(ours.colorAt(x: x, y: y)!.alphaComponent * 255))
        }
    }
    return sum
}

/// Hundredths of a point, a fiftieth of a pixel at 2x, without the zeros SVG doesn't need.
func number(_ value: CGFloat) -> String {
    var text = String(format: "%.2f", value)
    while text.hasSuffix("0") { text.removeLast() }
    if text.hasSuffix(".") { text.removeLast() }
    if text == "-0" { return "0" }
    if text.hasPrefix("0.") { text.removeFirst() }
    if text.hasPrefix("-0.") { text.remove(at: text.index(after: text.startIndex)) }
    return text
}

func svgPath(_ path: CGPath) -> String {
    var data = ""
    path.applyWithBlock { element in
        let points = element.pointee.points
        func coordinates(_ count: Int) -> String {
            (0 ..< count).map { "\(number(points[$0].x)) \(number(points[$0].y))" }.joined(separator: " ")
        }
        switch element.pointee.type {
        case .moveToPoint: data += "M\(coordinates(1))"
        case .addLineToPoint: data += "L\(coordinates(1))"
        case .addQuadCurveToPoint: data += "Q\(coordinates(2))"
        case .addCurveToPoint: data += "C\(coordinates(3))"
        case .closeSubpath: data += "Z"
        @unknown default: fail("unknown path element")
        }
    }
    return data
}

let usage = "usage: symbols.swift <out.ts> | --png <out-dir> <symbol> <point-size> <weight>"
let arguments = CommandLine.arguments
if arguments.count > 1, arguments[1] == "--png" {
    guard arguments.count == 6, let size = Double(arguments[4]), let weight = weights[arguments[5]] else { fail(usage, code: 2) }
    let candidate = glyph(arguments[3], Font.system(size, weight).configuration)
    try FileManager.default.createDirectory(atPath: arguments[2], withIntermediateDirectories: true)
    let file = URL(fileURLWithPath: arguments[2]).appendingPathComponent("\(arguments[3])-\(arguments[4])-\(arguments[5]).png")
    try rendered(candidate.image).representation(using: .png, properties: [:])!.write(to: file)
    print(file.path)
    exit(0)
}
guard arguments.count == 2 else { fail(usage, code: 2) }

let version = ProcessInfo.processInfo.operatingSystemVersion
var entries: [String] = []
for entry in table {
    let symbol = glyph(entry.symbol, entry.font.configuration)
    // Per 2x pixel, in alpha steps of 255. The composited layers leave a few hundredths of anti-aliasing noise at their
    // seams; a misplaced glyph or a missed eraser averages above 1.
    let difference = Double(mismatch(symbol)) / Double(symbol.image.size.width * symbol.image.size.height * 4)
    guard difference < 0.1 else { fail("\(entry.key): the outline differs from AppKit's drawing (\(difference))") }
    entries.append(
        "  \(entry.key): { width: \(number(symbol.image.size.width)), height: \(number(symbol.image.size.height)), path: '\(svgPath(symbol.path))' },"
    )
}
let header = """
// Generated by .claude/skills/fidelity-pass/scripts/symbols.swift from the SF Symbols of macOS \
\(version.majorVersion).\(version.minorVersion).\(version.patchVersion). Don't edit; rerun the script.

/** Each symbol's image size in points, which AppKit lays it out at, and its outline in that box. */
export const symbols = {
"""
let source = header + "\n" + entries.joined(separator: "\n") + "\n} as const;\n"
try source.write(toFile: arguments[1], atomically: true, encoding: .utf8)
print("wrote \(table.count) symbols to \(arguments[1])")
